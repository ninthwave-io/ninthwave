// pushback command: workers register machine-actionable disagreement with a
// review comment without pushing a no-op commit.
// Usage: nw pushback -m "<reason>" [--comment-id <id>] [--comment-type issue|review]
//
// Auto-detects the work item ID from the current git branch (ninthwave/{ID}).
// Writes a durable signal file the orchestrator consumes on its next poll cycle
// (recording the pushback round and re-triggering the review loop) and posts a
// structured, auditable comment to the PR thread so the reviewer sees the
// rationale.

import { die } from "../output.ts";
import {
  writePushbackSignal,
  type DaemonIO,
} from "../daemon.ts";
import { prComment, prList } from "../gh.ts";
import { formatPushbackComment } from "../pushback.ts";
import { extractItemId } from "./heartbeat.ts";

// ── Types ────────────────────────────────────────────────────────────

export interface PushbackDeps {
  io: DaemonIO;
  getBranch: () => string | null;
  /** Post a structured comment to the PR thread. Best-effort. Returns true on success. */
  postComment: (projectRoot: string, branch: string, reason: string) => boolean;
}

const defaultDeps: PushbackDeps = {
  io: {
    writeFileSync: (await import("fs")).writeFileSync,
    readFileSync: (await import("fs")).readFileSync,
    unlinkSync: (await import("fs")).unlinkSync,
    existsSync: (await import("fs")).existsSync,
    mkdirSync: (await import("fs")).mkdirSync,
    renameSync: (await import("fs")).renameSync,
  },
  getBranch: () => {
    try {
      const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], { stdout: "pipe", stderr: "pipe" });
      return result.exitCode === 0 ? result.stdout.toString().trim() : null;
    } catch {
      return null;
    }
  },
  postComment: (projectRoot, branch, reason) => {
    try {
      const list = prList(projectRoot, branch, "open");
      if (!list.ok || list.data.length === 0) return false;
      const prNumber = list.data[0].number;
      const hubRepoNwo = process.env.HUB_REPO_NWO || undefined;
      return prComment(projectRoot, prNumber, formatPushbackComment(reason, hubRepoNwo));
    } catch {
      return false;
    }
  },
};

// ── Argument parsing ─────────────────────────────────────────────────

interface ParsedArgs {
  reason: string | null;
  commentId?: number;
  commentType?: "issue" | "review";
}

export function parsePushbackArgs(args: string[]): ParsedArgs {
  let reason: string | null = null;
  let commentId: number | undefined;
  let commentType: "issue" | "review" | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-m" || arg === "--message") {
      reason = args[++i] ?? null;
    } else if (arg === "--comment-id") {
      const raw = args[++i];
      const parsed = raw != null ? Number(raw) : NaN;
      if (Number.isFinite(parsed)) commentId = parsed;
    } else if (arg === "--comment-type") {
      const raw = args[++i];
      if (raw === "issue" || raw === "review") commentType = raw;
    } else if (reason === null && !arg.startsWith("-")) {
      // Allow a bare positional reason as a convenience.
      reason = arg;
    }
  }

  return { reason, commentId, commentType };
}

// ── Command implementation ───────────────────────────────────────────

/**
 * Register a pushback against review feedback for the current worker.
 * Auto-detects the item ID from the current git branch (ninthwave/{ID}).
 * Returns a status message.
 */
export function cmdPushback(
  args: string[],
  projectRoot: string,
  deps: PushbackDeps = defaultDeps,
): string {
  const branch = deps.getBranch();
  if (!branch) {
    die("Could not detect current git branch");
    return ""; // unreachable
  }

  const id = extractItemId(branch);
  if (!id) {
    die(`Not on an item branch (expected "ninthwave/<ID>", got "${branch}")`);
    return ""; // unreachable
  }

  const { reason, commentId, commentType } = parsePushbackArgs(args);
  if (!reason || !reason.trim()) {
    die('Pushback requires a reason. Usage: nw pushback -m "<why you disagree>"');
    return ""; // unreachable
  }

  writePushbackSignal(projectRoot, id, reason.trim(), deps.io, { commentId, commentType });

  const posted = deps.postComment(projectRoot, branch, reason.trim());

  const msg = posted
    ? `Pushback registered for ${id} (signal written, comment posted to PR)`
    : `Pushback registered for ${id} (signal written; PR comment not posted)`;
  console.log(msg);
  return msg;
}
