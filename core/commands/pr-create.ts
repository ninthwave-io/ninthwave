// pr-create command: workers wrap `gh pr create` so the recurring failure
// modes under concurrent orchestration load recover automatically instead of
// forcing manual recovery:
//
//  1. Missing domain label -- labels are stripped from `gh pr create` and
//     applied after creation via the REST issues endpoint, creating the label
//     on the fly when absent. A missing `domain:<x>` label is never a hard
//     failure, and labelling avoids the `read:project` scope that
//     `gh pr edit --add-label` demands.
//  2. Transient auth / timeouts -- a concrete token is pinned into the
//     subprocess environment (avoiding keychain flakiness mid-run) and
//     transient 401 / connect-timeout failures join rate limits in the shared
//     retry-with-backoff pathway.
//  3. Merged + deleted base ref -- a stacked PR whose base was squash-merged
//     and deleted is retried against the default branch, with one actionable
//     message instead of an opaque GraphQL error.
//
// All other gh failures bubble up unchanged so the worker still sees real
// errors immediately.
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
import {
  runGhWithRateLimitRetry,
  preResolveGhToken,
  isBaseRefMissingError,
  applyPrLabels as defaultApplyPrLabels,
  getDefaultBranch as defaultGetDefaultBranch,
  type GhRetryOptions,
} from "../gh.ts";

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

// ── Label extraction ────────────────────────────────────────────────

/**
 * Split `--label`/`-l` flags out of the forwarded args. Labels are applied
 * after the PR is created (via the REST issues endpoint) rather than passed to
 * `gh pr create`, because `gh pr create --label` hard-fails when the label does
 * not yet exist. Recognises the separate (`--label value`, `-l value`), joined
 * (`--label=value`, `-l=value`), and comma-separated (`--label "a,b"`) forms --
 * gh treats `--label` as a comma-split string slice, so a single flag may carry
 * multiple labels.
 */
export function extractLabelArgs(args: string[]): { labels: string[]; rest: string[] } {
  const labels: string[] = [];
  const rest: string[] = [];
  const pushLabelValue = (value: string) => {
    for (const part of value.split(",")) {
      const trimmed = part.trim();
      if (trimmed) labels.push(trimmed);
    }
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--label" || arg === "-l") {
      const value = args[i + 1];
      if (value !== undefined) {
        pushLabelValue(value);
        i++; // consume the value
      }
      continue;
    }
    if (arg.startsWith("--label=")) {
      pushLabelValue(arg.slice("--label=".length));
      continue;
    }
    if (arg.startsWith("-l=")) {
      pushLabelValue(arg.slice("-l=".length));
      continue;
    }
    rest.push(arg);
  }
  return { labels, rest };
}

// ── Base ref handling ───────────────────────────────────────────────

/** True when args carry an explicit `--base`/`-B` target. */
export function hasBaseFlag(args: string[]): boolean {
  return args.some((a) => a === "--base" || a.startsWith("--base=") || a === "-B");
}

/**
 * Replace the value of an existing `--base`/`-B` flag with `newBase`. Used to
 * retarget a stacked PR at the default branch when its original base merged and
 * was deleted. Returns the args unchanged when no base flag is present.
 */
export function replaceBaseArg(args: string[], newBase: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--base" || arg === "-B") {
      out.push(arg, newBase);
      i++; // skip the old value
      continue;
    }
    if (arg.startsWith("--base=")) {
      out.push(`--base=${newBase}`);
      continue;
    }
    out.push(arg);
  }
  return out;
}

/** Extract the PR number from a `gh pr create` URL (e.g. .../pull/42 -> 42). */
export function extractPrNumber(stdout: string): number | null {
  const match = stdout.match(/\/pull\/(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1]!, 10);
  return Number.isNaN(n) ? null : n;
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
  /** Test seam: the environment to pin a resolved gh token into (defaults to process.env). */
  env?: Record<string, string | undefined>;
  /** Test seam: resolve a concrete gh token to pin into the environment. */
  resolveTokenImpl?: () => string | null;
  /** Test seam: resolve the repository default branch (for base-ref recovery). */
  getDefaultBranchImpl?: (repoRoot: string) => string | null;
  /** Test seam: ensure + apply labels to a created PR. Returns true on success. */
  applyLabelsImpl?: (repoRoot: string, prNumber: number, labels: string[]) => boolean;
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
  const env = deps.env ?? process.env;
  const getDefaultBranch = deps.getDefaultBranchImpl ?? defaultGetDefaultBranch;
  const applyLabels = deps.applyLabelsImpl ?? defaultApplyPrLabels;

  // Pin a concrete token into the subprocess environment so a burst of gh
  // calls during this run does not repeatedly hit the keychain (which flakes
  // with transient 401s under concurrent agent load). The pinned token reaches
  // the spawned gh process only because `env` is process.env in production and
  // child processes inherit it; the injectable `deps.env` seam exists purely so
  // tests can assert the pinning without mutating the real process environment.
  preResolveGhToken(env, deps.resolveTokenImpl ?? undefined);

  const resolved = resolveHeadArgs(args, getBranch);
  if (resolved.kind === "error") {
    process.stderr.write(`${resolved.message}\n`);
    return 1;
  }

  // Labels are applied after creation (via REST) so a missing domain label
  // never hard-fails `gh pr create`, and labelling avoids the read:project
  // scope `gh pr edit --add-label` demands.
  const { labels, rest } = extractLabelArgs(resolved.args);

  const runCreate = (createArgs: string[]) =>
    runGhWithRateLimitRetry(["pr", "create", ...createArgs], {
      cwd: projectRoot,
      timeout: GH_TIMEOUT,
      maxRetries: DEFAULT_MAX_RETRIES,
      maxWaitMs: DEFAULT_MAX_WAIT_MS,
      runAsyncImpl: deps.runAsyncImpl,
      queryRateLimitImpl: deps.queryRateLimitImpl,
      sleepImpl: deps.sleepImpl,
      onRetry: ({ attempt, waitMs, reason, stderr }) => {
        // One concise line per backoff so users tailing the worker see why we paused.
        const seconds = Math.round(waitMs / 1000);
        const firstLine = stderr.split("\n")[0] ?? reason;
        process.stderr.write(
          `nw pr-create: transient ${reason} failure (attempt ${attempt + 1}); waiting ${seconds}s before retry. ${firstLine}\n`,
        );
      },
    });

  let result = await runCreate(rest);

  // Merged + deleted base ref: a stacked PR's dependency squash-merged and its
  // branch was auto-deleted. Retry once against the default branch.
  if (result.exitCode !== 0 && isBaseRefMissingError(result.stderr) && hasBaseFlag(rest)) {
    const defaultBranch = getDefaultBranch(projectRoot);
    if (defaultBranch) {
      process.stderr.write(
        `nw pr-create: base branch is gone (merged and deleted); retrying against the default branch '${defaultBranch}'.\n`,
      );
      result = await runCreate(replaceBaseArg(rest, defaultBranch));
    } else {
      process.stderr.write(
        "nw pr-create: base branch is gone (merged and deleted) and the default branch " +
          "could not be resolved. Re-run with an explicit --base pointing at an existing branch.\n",
      );
    }
  }

  if (result.stdout) {
    process.stdout.write(result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
  }
  if (result.exitCode !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr.endsWith("\n") ? result.stderr : `${result.stderr}\n`);
    }
    return result.exitCode;
  }

  // PR created -- apply labels best-effort. A labelling failure must not fail
  // the command (the PR exists; the orchestrator can recover labels).
  if (labels.length > 0) {
    const prNumber = extractPrNumber(result.stdout);
    if (prNumber === null) {
      process.stderr.write(
        `nw pr-create: PR created but could not parse its number to apply labels (${labels.join(", ")}).\n`,
      );
    } else {
      const applied = applyLabels(projectRoot, prNumber, labels);
      if (!applied) {
        process.stderr.write(
          `nw pr-create: PR #${prNumber} created but applying labels (${labels.join(", ")}) failed; continuing.\n`,
        );
      }
    }
  }

  return result.exitCode;
}
