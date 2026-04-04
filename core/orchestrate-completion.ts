// Exit summary formatting, completion banners, and completion/recovery keyboard prompts.
// Pure logic with no external dependencies.

// ── Types ───────────────────────────────────────────────────────────

export interface CompletionSummaryItem {
  state: string;
  startedAt?: string;
  endedAt?: string;
  remoteSnapshot?: { state: string };
}

/**
 * Action chosen at the post-completion prompt.
 * - "run-more": re-enter interactive selection flow
 * - "clean": clean up worktrees for done items
 * - "quit": exit the TUI
 */
export type CompletionAction = "run-more" | "clean" | "quit";

export type EngineRecoveryAction = "restart" | "quit";

// ── Helpers ─────────────────────────────────────────────────────────

export function completionSummaryState(item: CompletionSummaryItem): "done" | "blocked" | "stuck" | "queued" | "active" {
  const state = item.remoteSnapshot?.state ?? item.state;

  if (state === "done") return "done";
  if (state === "blocked") return "blocked";
  if (state === "stuck") return "stuck";
  if (state === "queued" || state === "ready") return "queued";
  return "active";
}

// ── Exit summary ────────────────────────────────────────────────────

/**
 * Format a compact one-line exit summary for terminal scrollback.
 * Format: "ninthwave: N merged, M stuck, K queued (Xm Ys) | Lead time: p50 Xm, p95 Ym"
 */
export function formatExitSummary(
  allItems: CompletionSummaryItem[],
  runStartTime: string,
): string {
  const merged = allItems.filter((i) => completionSummaryState(i) === "done").length;
  const blocked = allItems.filter((i) => completionSummaryState(i) === "blocked").length;
  const stuck = allItems.filter((i) => completionSummaryState(i) === "stuck").length;
  const queued = allItems.filter((i) => completionSummaryState(i) === "queued").length;
  const active = allItems.filter((i) => completionSummaryState(i) === "active").length;

  // Duration
  const elapsed = Math.max(0, Date.now() - new Date(runStartTime).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1000);
  const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const blockedSegment = blocked > 0 ? `, ${blocked} blocked` : "";
  let line = active > 0
    ? `ninthwave: ${merged} done, ${active} active, ${stuck} stuck, ${queued} queued${blockedSegment} (${durationStr})`
    : `ninthwave: ${merged} merged, ${stuck} stuck, ${queued} queued${blockedSegment} (${durationStr})`;

  // Lead time (time from start to done for each completed item)
  const leadTimes = allItems
    .filter((i) => completionSummaryState(i) === "done" && i.startedAt && i.endedAt)
    .map((i) => new Date(i.endedAt!).getTime() - new Date(i.startedAt!).getTime())
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b);

  if (leadTimes.length > 0) {
    const p50Idx = Math.max(0, Math.ceil(0.5 * leadTimes.length) - 1);
    const p95Idx = Math.max(0, Math.ceil(0.95 * leadTimes.length) - 1);
    const p50m = Math.round(leadTimes[p50Idx]! / 60_000);
    const p95m = Math.round(leadTimes[p95Idx]! / 60_000);
    line += ` | Lead time: p50 ${p50m}m, p95 ${p95m}m`;
  }

  return line;
}

// ── Completion banner ───────────────────────────────────────────────

/**
 * Format the completion banner shown when all items reach terminal state.
 * Returns the banner text as an array of lines.
 */
export function formatCompletionBanner(
  allItems: CompletionSummaryItem[],
  runStartTime: string,
): string[] {
  const merged = allItems.filter((i) => completionSummaryState(i) === "done").length;
  const blocked = allItems.filter((i) => completionSummaryState(i) === "blocked").length;
  const stuck = allItems.filter((i) => completionSummaryState(i) === "stuck").length;
  const active = allItems.filter((i) => completionSummaryState(i) === "active").length;
  const total = allItems.length;

  const elapsed = Math.max(0, Date.now() - new Date(runStartTime).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1000);
  const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const lines: string[] = [];
  lines.push("");
  lines.push(
    active > 0
      ? `  Work still in progress. ${merged} done, ${active} active, ${stuck} stuck. (${durationStr})`
      : blocked > 0
        ? `  All runnable items complete. ${merged} merged, ${stuck} stuck, ${blocked} blocked. (${durationStr})`
        : `  All ${total} items complete. ${merged} merged, ${stuck} stuck. (${durationStr})`,
  );

  const leadTimes = allItems
    .filter((i) => completionSummaryState(i) === "done" && i.startedAt && i.endedAt)
    .map((i) => new Date(i.endedAt!).getTime() - new Date(i.startedAt!).getTime())
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b);
  if (leadTimes.length > 0) {
    const p50Idx = Math.max(0, Math.ceil(0.5 * leadTimes.length) - 1);
    const p95Idx = Math.max(0, Math.ceil(0.95 * leadTimes.length) - 1);
    const p50m = Math.round(leadTimes[p50Idx]! / 60_000);
    const p95m = Math.round(leadTimes[p95Idx]! / 60_000);
    lines.push(`  Lead time: p50 ${p50m}m, p95 ${p95m}m`);
  }

  lines.push("");
  lines.push("  [r] Run more  [c] Clean up  [q] Quit");
  lines.push("");
  return lines;
}

// ── Key prompts ─────────────────────────────────────────────────────

/**
 * Wait for a completion prompt keypress (r, c, q, or Ctrl-C).
 * Returns the chosen action. Resolves when a valid key is pressed.
 */
export function waitForCompletionKey(
  stdin: NodeJS.ReadStream,
  signal?: AbortSignal,
): Promise<CompletionAction> {
  return new Promise<CompletionAction>((resolve) => {
    if (signal?.aborted) {
      resolve("quit");
      return;
    }

    const onAbort = () => {
      cleanup();
      resolve("quit");
    };

    const onData = (key: string) => {
      switch (key) {
        case "r":
          cleanup();
          resolve("run-more");
          break;
        case "c":
          cleanup();
          resolve("clean");
          break;
        case "q":
        case "\x03": // Ctrl-C
          cleanup();
          resolve("quit");
          break;
        // Ignore other keys
      }
    };

    function cleanup() {
      stdin.removeListener("data", onData);
      signal?.removeEventListener("abort", onAbort);
    }

    stdin.on("data", onData);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function waitForEngineRecoveryKey(
  stdin: NodeJS.ReadStream,
  signal?: AbortSignal,
): Promise<EngineRecoveryAction> {
  return new Promise<EngineRecoveryAction>((resolve) => {
    if (signal?.aborted) {
      resolve("quit");
      return;
    }

    const onAbort = () => {
      cleanup();
      resolve("quit");
    };

    const onData = (key: string) => {
      switch (key.toLowerCase()) {
        case "r":
          cleanup();
          resolve("restart");
          break;
        case "q":
        case "\x03":
          cleanup();
          resolve("quit");
          break;
      }
    };

    function cleanup() {
      stdin.removeListener("data", onData);
      signal?.removeEventListener("abort", onAbort);
    }

    stdin.on("data", onData);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
