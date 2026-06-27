// no-new-info command: a worker signals that it was woken on feedback carrying
// nothing actionable (e.g. the reviewer's own approval summary echoed back, a
// stale or duplicate comment). Distinct from feedback-done (which concedes and
// resumes the loop) and pushback (which disagrees and re-triggers review):
// no-new-info tells the orchestrator the wake was spurious, so it preserves the
// settled review gate and re-parks without churning another review round.
//
// Usage: nw no-new-info -m "<what woke me / why there's nothing to do>"
//
// Auto-detects the work item ID from the current git branch (ninthwave/{ID}).
// Writes a durable one-shot signal the orchestrator consumes on its next poll,
// and logs a friction entry so we can keep tightening which relay paths still
// misclassify reviewer/bot text as human feedback.

import { join } from "path";
import { die } from "../output.ts";
import {
  writeNoNewInfoSignal,
  type DaemonIO,
} from "../daemon.ts";
import { extractItemId } from "./heartbeat.ts";

// ── Types ────────────────────────────────────────────────────────────

export interface NoNewInfoDeps {
  io: DaemonIO;
  getBranch: () => string | null;
  now: () => Date;
}

const defaultDeps: NoNewInfoDeps = {
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
  now: () => new Date(),
};

// ── Argument parsing ─────────────────────────────────────────────────

interface ParsedArgs {
  reason: string | null;
}

export function parseNoNewInfoArgs(args: string[]): ParsedArgs {
  let reason: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-m" || arg === "--message") {
      reason = args[++i] ?? null;
    } else if (reason === null && !arg.startsWith("-")) {
      // Allow a bare positional reason as a convenience.
      reason = arg;
    }
  }
  return { reason };
}

// ── Friction logging ─────────────────────────────────────────────────

/**
 * Write a friction entry to the project's friction inbox recording the spurious
 * wake. projectRoot resolves to the main repo (via `--git-common-dir`) even when
 * run from a worker's worktree, so the entry lands in the triage inbox without
 * being committed to the PR branch -- committing would change the head SHA and
 * retrigger the very loop we are escaping.
 */
function logFriction(
  projectRoot: string,
  itemId: string,
  reason: string,
  deps: NoNewInfoDeps,
): void {
  try {
    const frictionDir = join(projectRoot, ".ninthwave", "friction");
    if (!deps.io.existsSync(frictionDir)) {
      deps.io.mkdirSync(frictionDir, { recursive: true });
    }
    const iso = deps.now().toISOString();
    const fileStamp = iso.replace(/:/g, "-").replace(/\.\d+Z$/, "Z");
    const body = `item: ${itemId}
date: ${iso}
severity: low
description: Spurious worker wake (no-new-info) on ${itemId}. The worker was relaunched on feedback that carried nothing actionable and reported: ${reason}
`;
    deps.io.writeFileSync(
      join(frictionDir, `${fileStamp}--${itemId}.md`),
      body,
      "utf-8",
    );
  } catch { /* best-effort -- friction logging must never block the signal */ }
}

// ── Command implementation ───────────────────────────────────────────

/**
 * Register a no-new-info signal for the current worker.
 * Auto-detects the item ID from the current git branch (ninthwave/{ID}).
 * Returns a status message.
 */
export function cmdNoNewInfo(
  args: string[],
  projectRoot: string,
  deps: NoNewInfoDeps = defaultDeps,
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

  const { reason } = parseNoNewInfoArgs(args);
  if (!reason || !reason.trim()) {
    die('No-new-info requires a reason. Usage: nw no-new-info -m "<what woke me / why there is nothing to do>"');
    return ""; // unreachable
  }

  writeNoNewInfoSignal(projectRoot, id, reason.trim(), deps.io);
  logFriction(projectRoot, id, reason.trim(), deps);

  const msg = `No-new-info signal written for ${id} (friction logged)`;
  console.log(msg);
  return msg;
}
