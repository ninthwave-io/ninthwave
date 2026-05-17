// pr-create command: workers wrap `gh pr create` with rate-limit-aware
// retries so a transient GraphQL rate-limit hit doesn't burn the worker's
// own retry budget. All other gh failures bubble up unchanged so the
// worker still sees real errors immediately.
//
// When invoked without an explicit `--head` flag, the current git branch is
// resolved via `git rev-parse --abbrev-ref HEAD` and forwarded as
// `--head <branch>`. Inside a worktree, `gh pr create`'s own head
// auto-resolution can fall back to the default branch and fail with a
// misleading "head branch 'main' is the same as base branch 'main'"
// message even though the worktree is on a feature branch with commits
// ahead of origin/main. Explicit `--head` removes that trap.
//
// Usage: nw pr-create [<gh pr create args>...]
// Example: nw pr-create --label "domain:foo" --title "fix: ..." --body "$(cat <<'EOF' ... EOF)"

import { GH_TIMEOUT } from "../shell.ts";
import { runGhWithRateLimitRetry, type GhRetryOptions } from "../gh.ts";

/** Default upper bound on a single rate-limit backoff (5 minutes). */
const DEFAULT_MAX_WAIT_MS = 5 * 60_000;

/** Default ceiling on rate-limit retries before falling back to the worker. */
const DEFAULT_MAX_RETRIES = 5;

// ── Head resolution ─────────────────────────────────────────────────

/**
 * True when args already specify a head ref. Recognises the long form in
 * both separate (`--head value`) and joined (`--head=value`) styles, plus
 * gh's short alias `-H`.
 */
export function hasHeadFlag(args: string[]): boolean {
  return args.some((a) => a === "--head" || a.startsWith("--head=") || a === "-H");
}

export type HeadResolution =
  | { kind: "ok"; args: string[] }
  | { kind: "error"; message: string };

/**
 * Inject `--head <branch>` into the forwarded args when the caller did not
 * already specify a head ref. Returns an error result when the current
 * branch cannot be resolved (detached HEAD, git missing, not a repo) so the
 * caller can surface a clear message instead of silently passing
 * `--head HEAD` or an empty value to gh.
 */
export function resolveHeadArgs(
  args: string[],
  getBranch: () => string | null,
): HeadResolution {
  if (hasHeadFlag(args)) return { kind: "ok", args };
  const branch = getBranch();
  if (!branch) {
    return {
      kind: "error",
      message:
        "nw pr-create: could not determine the current branch " +
        "(detached HEAD, not a git repository, or `git rev-parse --abbrev-ref HEAD` failed). " +
        "Pass --head <branch> explicitly.",
    };
  }
  return { kind: "ok", args: ["--head", branch, ...args] };
}

// ── Command implementation ──────────────────────────────────────────

export interface PrCreateDeps {
  /** Test seam: resolve the current git branch. Return null on detached HEAD or failure. */
  getBranch?: () => string | null;
  /** Test seam: override the underlying gh runner (forwarded to the retry helper). */
  runAsyncImpl?: GhRetryOptions["runAsyncImpl"];
  /** Test seam: override the rate_limit query (forwarded to the retry helper). */
  queryRateLimitImpl?: GhRetryOptions["queryRateLimitImpl"];
  /** Test seam: override sleep (forwarded to the retry helper). */
  sleepImpl?: GhRetryOptions["sleepImpl"];
}

/**
 * Default git branch resolver. Returns null for detached HEAD (`git`
 * reports the literal string `HEAD`) or when the git invocation fails for
 * any reason, so callers can produce a clearer error than passing
 * `--head HEAD` to gh.
 */
function defaultGetBranch(): string | null {
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) return null;
    const branch = result.stdout.toString().trim();
    if (branch === "" || branch === "HEAD") return null;
    return branch;
  } catch {
    return null;
  }
}

/**
 * Forward arbitrary `gh pr create` args through the shared rate-limit-aware
 * retry helper. Prints the gh stdout (the PR URL on success), prints stderr
 * on failure, and exits with the gh exit code.
 *
 * Implements the worker side of the M-ORCH-19 contract: rate-limit failures
 * are absorbed by the shared backoff/retry pathway instead of consuming the
 * worker's prescribed retries.
 */
export async function cmdPrCreate(
  args: string[],
  projectRoot: string,
  deps: PrCreateDeps = {},
): Promise<number> {
  const getBranch = deps.getBranch ?? defaultGetBranch;

  const resolved = resolveHeadArgs(args, getBranch);
  if (resolved.kind === "error") {
    process.stderr.write(`${resolved.message}\n`);
    return 1;
  }

  const result = await runGhWithRateLimitRetry(["pr", "create", ...resolved.args], {
    cwd: projectRoot,
    timeout: GH_TIMEOUT,
    maxRetries: DEFAULT_MAX_RETRIES,
    maxWaitMs: DEFAULT_MAX_WAIT_MS,
    runAsyncImpl: deps.runAsyncImpl,
    queryRateLimitImpl: deps.queryRateLimitImpl,
    sleepImpl: deps.sleepImpl,
    onRetry: ({ attempt, waitMs, stderr }) => {
      // One concise line per backoff so users tailing the worker see why we paused.
      const seconds = Math.round(waitMs / 1000);
      const reason = stderr.split("\n")[0] ?? "rate limit";
      process.stderr.write(
        `nw pr-create: rate limit hit (attempt ${attempt + 1}); waiting ${seconds}s before retry. ${reason}\n`,
      );
    },
  });

  if (result.stdout) {
    process.stdout.write(result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
  }
  if (result.exitCode !== 0 && result.stderr) {
    process.stderr.write(result.stderr.endsWith("\n") ? result.stderr : `${result.stderr}\n`);
  }
  return result.exitCode;
}
