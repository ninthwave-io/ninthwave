// Structured metrics emitter for orchestrator runs.
// Collects timing, item counts, CI retry counts, merge strategy,
// cost/token tracking, and tool info as structured log events.

import type { OrchestratorItem, OrchestratorConfig } from "./orchestrator.ts";
import { run } from "./shell.ts";
import type { RunResult } from "./types.ts";

// ── Metrics schema ────────────────────────────────────────────────────

export interface ItemMetric {
  id: string;
  state: string;
  ciRetryCount: number;
  /** Number of worker crash retries for this item. */
  retryCount: number;
  tool: string;
  prNumber?: number;
  /** Total tokens used by this item's worker session. Null when cost data is unavailable. */
  tokensUsed?: number | null;
  /** Total cost in USD for this item's worker session. Null when cost data is unavailable. */
  costUsd?: number | null;
  /** Input tokens used. Null when unavailable. */
  inputTokens?: number | null;
  /** Output tokens used. Null when unavailable. */
  outputTokens?: number | null;
  /** Model identifier used by the worker. Null when unavailable. */
  model?: string | null;
  /** Detection latency in milliseconds for this item's last transition. */
  detectionLatencyMs?: number;
  /** ISO timestamp of when the worker was launched. */
  startedAt?: string;
  /** ISO timestamp of when the worker completed or failed. */
  endedAt?: string;
  /** Exit code from the worker process (null when unknown). */
  exitCode?: number | null;
}

/** Aggregate detection latency percentiles for a run. */
export interface DetectionLatencyStats {
  /** Median detection latency in milliseconds. */
  p50Ms: number;
  /** 95th percentile detection latency in milliseconds. */
  p95Ms: number;
  /** Maximum detection latency in milliseconds. */
  maxMs: number;
  /** Number of transitions with latency measurements. */
  sampleCount: number;
  /** True when p95 exceeds the slow detection threshold (default 60s). */
  slowDetection: boolean;
}

export interface RunMetrics {
  /** ISO 8601 timestamp of when the run started. */
  runTimestamp: string;
  /** Wall-clock duration in milliseconds. */
  wallClockMs: number;
  /** Total items tracked by this run. */
  itemsAttempted: number;
  /** Items that reached the "done" state. */
  itemsCompleted: number;
  /** Items that reached the "stuck" state. */
  itemsFailed: number;
  /** Merge strategy used for this run. */
  mergeStrategy: string;
  /** Per-item metrics. */
  items: ItemMetric[];
  /** Aggregate tokens used across all items. Null when no cost data is available. */
  totalTokensUsed: number | null;
  /** Aggregate cost in USD across all items. Null when no cost data is available. */
  totalCostUsd: number | null;
  /** Aggregate input tokens across all items. Null when unavailable. */
  totalInputTokens?: number | null;
  /** Aggregate output tokens across all items. Null when unavailable. */
  totalOutputTokens?: number | null;
  /** Cost per merged PR. Null when no cost or PR data. */
  costPerPr?: number | null;
  /** Count of unique models used by workers. */
  modelBreakdown?: Record<string, number>;
  /** Detection latency percentiles for this run. Null when no latency data is available. */
  detectionLatency: DetectionLatencyStats | null;
}

// ── Detection latency helpers ─────────────────────────────────────────

/** Default threshold (ms) above which p95 detection latency is flagged as slow. */
export const SLOW_DETECTION_THRESHOLD_MS = 60_000; // 60 seconds

/**
 * Compute a percentile value from a sorted array of numbers.
 * Uses nearest-rank method. Returns 0 for empty arrays.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)]!;
}

/**
 * Compute detection latency stats from item latency values.
 * Returns null when no items have latency data.
 */
export function computeDetectionLatency(
  latencies: number[],
  thresholdMs: number = SLOW_DETECTION_THRESHOLD_MS,
): DetectionLatencyStats | null {
  if (latencies.length === 0) return null;

  const sorted = [...latencies].sort((a, b) => a - b);
  const p50Ms = percentile(sorted, 50);
  const p95Ms = percentile(sorted, 95);
  const maxMs = sorted[sorted.length - 1]!;

  return {
    p50Ms,
    p95Ms,
    maxMs,
    sampleCount: sorted.length,
    slowDetection: p95Ms > thresholdMs,
  };
}

// ── Cost/token parsing ────────────────────────────────────────────────

/** Parsed cost summary from a worker session's exit output or heartbeat. */
export interface CostSummary {
  tokensUsed: number | null;
  costUsd: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  model?: string | null;
}

/**
 * Parse Claude Code's exit summary for token count and cost.
 *
 * Handles common output formats:
 *   - "Total tokens: 42,567" or "Tokens: 42567"
 *   - "Total cost: $3.45" or "Cost: $0.12"
 *
 * Returns null for each field that cannot be parsed.
 * Gracefully handles empty input, malformed text, and tools
 * that don't report cost data.
 */
export function parseCostSummary(text: string): CostSummary {
  if (!text) return { tokensUsed: null, costUsd: null };

  let tokensUsed: number | null = null;
  let costUsd: number | null = null;

  // Match token count: "Total tokens: 42,567", "Tokens: 42567", "Total token: 100,000"
  // Requires either "total" prefix or plural "tokens" to avoid false positives
  // like "CSRF token: 12345".
  const tokenMatch = text.match(/(?:total\s+tokens?|tokens)\s*[:=]\s*([\d,]+)/i);
  if (tokenMatch) {
    const parsed = parseInt(tokenMatch[1]!.replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      tokensUsed = parsed;
    }
  }

  // Match cost: "$3.45" or "cost: $0.12" or "cost: 1.23"
  const costMatch = text.match(/cost\s*[:=]\s*\$?\s*([\d.]+)/i);
  if (costMatch) {
    const parsed = parseFloat(costMatch[1]!);
    if (!isNaN(parsed) && parsed >= 0) {
      costUsd = parsed;
    }
  }

  return { tokensUsed, costUsd };
}

// ── Worker telemetry parsing ────────────────────────────────────────

/** Parsed telemetry from worker screen output. */
export interface WorkerTelemetry {
  exitCode: number | null;
  stderrTail: string;
}

/**
 * Parse worker telemetry from screen output.
 *
 * Extracts:
 * - Exit code: looks for patterns like "exit code 1", "exited with 1",
 *   "Process exited with code 1", or "Exit status: 1"
 * - Stderr tail: extracts the last 20 non-empty lines from the screen
 *   (the screen content itself serves as the stderr proxy since worker
 *   output is captured on the terminal)
 *
 * Returns null exit code and empty stderr when input is empty.
 */
export function parseWorkerTelemetry(screenText: string): WorkerTelemetry {
  if (!screenText) return { exitCode: null, stderrTail: "" };

  let exitCode: number | null = null;

  // Match exit code patterns:
  // "exit code 1", "exit code: 1", "exited with 1", "exited with code 1"
  // "Process exited with code 1", "Exit status: 1"
  const exitMatch = screenText.match(
    /(?:exit\s+(?:code|status)\s*[:=]?\s*|exited\s+with\s+(?:code\s+)?|process\s+exited\s+with\s+code\s+)(\d+)/i,
  );
  if (exitMatch) {
    const parsed = parseInt(exitMatch[1]!, 10);
    if (!isNaN(parsed)) {
      exitCode = parsed;
    }
  }

  // Extract last 20 non-empty lines as stderr tail
  const lines = screenText.split("\n").filter((l) => l.trim());
  const tail = lines.slice(-20).join("\n");

  return { exitCode, stderrTail: tail };
}

// ── Metrics collection ────────────────────────────────────────────────

/**
 * Collect run metrics from orchestrator state at completion.
 *
 * @param allItems - All orchestrator items at run completion
 * @param config - Orchestrator config (for merge strategy)
 * @param startTime - ISO timestamp when the run started
 * @param endTime - ISO timestamp when the run ended
 * @param aiTool - The AI tool used for this run (e.g., "claude", "cursor")
 * @param costData - Optional per-item cost data parsed from worker exit output
 */
export function collectRunMetrics(
  allItems: OrchestratorItem[],
  config: OrchestratorConfig,
  startTime: string,
  endTime: string,
  aiTool: string,
  costData?: Map<string, CostSummary>,
): RunMetrics {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const wallClockMs = Math.max(0, end - start);

  const items: ItemMetric[] = allItems.map((item) => {
    const cost = costData?.get(item.id);
    return {
      id: item.id,
      state: item.state,
      ciRetryCount: item.ciFailCount,
      retryCount: item.retryCount,
      tool: aiTool,
      ...(item.prNumber != null ? { prNumber: item.prNumber } : {}),
      tokensUsed: cost?.tokensUsed ?? null,
      costUsd: cost?.costUsd ?? null,
      inputTokens: cost?.inputTokens ?? null,
      outputTokens: cost?.outputTokens ?? null,
      model: cost?.model ?? null,
      ...(item.detectionLatencyMs != null ? { detectionLatencyMs: item.detectionLatencyMs } : {}),
      ...(item.startedAt ? { startedAt: item.startedAt } : {}),
      ...(item.endedAt ? { endedAt: item.endedAt } : {}),
      ...(item.exitCode != null ? { exitCode: item.exitCode } : {}),
    };
  });

  // Compute detection latency percentiles from items that have latency data
  const latencies = allItems
    .map((item) => item.detectionLatencyMs)
    .filter((ms): ms is number => ms != null && ms > 0);
  const detectionLatency = computeDetectionLatency(latencies);

  // Aggregate totals -- null when no items have cost data
  const itemsWithTokens = items.filter((i) => i.tokensUsed != null);
  const itemsWithCost = items.filter((i) => i.costUsd != null);

  const totalTokensUsed = itemsWithTokens.length > 0
    ? itemsWithTokens.reduce((sum, i) => sum + i.tokensUsed!, 0)
    : null;
  const totalCostUsd = itemsWithCost.length > 0
    ? itemsWithCost.reduce((sum, i) => sum + i.costUsd!, 0)
    : null;

  // Aggregate input/output tokens
  const itemsWithInput = items.filter((i) => i.inputTokens != null);
  const itemsWithOutput = items.filter((i) => i.outputTokens != null);
  const totalInputTokens = itemsWithInput.length > 0
    ? itemsWithInput.reduce((sum, i) => sum + i.inputTokens!, 0)
    : null;
  const totalOutputTokens = itemsWithOutput.length > 0
    ? itemsWithOutput.reduce((sum, i) => sum + i.outputTokens!, 0)
    : null;

  // Model breakdown: count items per model
  const modelBreakdown: Record<string, number> = {};
  for (const item of items) {
    if (item.model) {
      modelBreakdown[item.model] = (modelBreakdown[item.model] ?? 0) + 1;
    }
  }

  // Cost per PR: total cost / items with PRs that completed
  const completedWithPR = items.filter((i) => i.state === "done" && i.prNumber != null);
  const costPerPr = totalCostUsd != null && completedWithPR.length > 0
    ? Math.round((totalCostUsd / completedWithPR.length) * 100) / 100
    : null;

  return {
    runTimestamp: startTime,
    wallClockMs,
    itemsAttempted: allItems.length,
    itemsCompleted: allItems.filter((i) => i.state === "done").length,
    itemsFailed: allItems.filter((i) => i.state === "stuck").length,
    mergeStrategy: config.mergeStrategy,
    items,
    totalTokensUsed,
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    costPerPr,
    modelBreakdown: Object.keys(modelBreakdown).length > 0 ? modelBreakdown : undefined,
    detectionLatency,
  };
}

/** Shell runner signature -- injectable for testing. */
export type ShellRunner = (cmd: string, args: string[]) => RunResult;

/**
 * Stage and commit files under a given sub-path of the repo.
 * Handles both analytics and friction paths (and any other `.ninthwave/` subdirectory).
 *
 * Only stages files under `relPath` -- never commits unrelated changes.
 *
 * Safety: if non-relPath files are already staged in the index, unstages the
 * files we just added and returns false to avoid accidentally including them.
 *
 * @param projectRoot - The git repo root
 * @param relPath - Relative path to stage (e.g., ".ninthwave/friction")
 * @param commitMessage - Commit message to use
 * @param runner - Injectable shell runner (defaults to the real shell)
 * @returns true when a commit was created, false otherwise
 */
export function commitPathFiles(
  projectRoot: string,
  relPath: string,
  commitMessage: string,
  runner: ShellRunner = (cmd, args) => run(cmd, args),
): boolean {
  // 1. Check if relPath has any changes (staged, unstaged, or untracked)
  const status = runner("git", ["-C", projectRoot, "status", "--porcelain", "--", relPath]);
  if (status.exitCode !== 0 || !status.stdout.trim()) {
    return false; // no changes
  }

  // 2. Stage files under relPath
  runner("git", ["-C", projectRoot, "add", "--", relPath]);

  // 3. Safety check: ensure only relPath files are staged
  const staged = runner("git", ["-C", projectRoot, "diff", "--name-only", "--cached"]);
  const stagedFiles = staged.stdout.split("\n").filter(Boolean);
  const nonRelPath = stagedFiles.filter((f) => !f.startsWith(relPath));

  if (nonRelPath.length > 0) {
    // Unstage the files we just added to avoid leaving them staged
    runner("git", ["-C", projectRoot, "restore", "--staged", "--", relPath]);
    return false; // dirty index
  }

  // 4. Commit
  runner("git", ["-C", projectRoot, "commit", "-m", commitMessage]);
  return true;
}
