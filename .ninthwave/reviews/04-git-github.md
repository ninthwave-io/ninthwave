# Review 4: Git & GitHub Integration

## Summary

The git/GitHub layer spans eight modules: `core/git.ts` (389 LOC) provides git operations, `core/gh.ts` (615 LOC) wraps the GitHub CLI, `core/cross-repo.ts` (430 LOC) handles sibling directory navigation and bootstrap, `core/commands/pr-monitor.ts` (676 LOC) implements CI polling and transition detection, `core/stack-comments.ts` (86 LOC) manages stack navigation PR comments, `core/commands/conflicts.ts` (80 LOC) detects file-level overlaps, `core/commands/reconcile.ts` (428 LOC) synchronizes state after daemon crash, and `core/lock.ts` (119 LOC) provides mkdir-based distributed locking.

The layer is well-structured with clean separation of concerns: `git.ts` provides pure git operations (no GitHub awareness), `gh.ts` wraps the `gh` CLI with typed responses, and `pr-monitor.ts` orchestrates both for the polling loop. The async variants in `gh.ts` (lines 102-188) keep the TUI responsive during network calls. Error handling follows a consistent pattern: git operations throw on failure, gh operations return empty arrays/objects, and the orchestrator interprets both.

The most significant concerns are: (1) `gh.ts` silently swallowing GitHub API errors as empty results, which can cause the orchestrator to misinterpret transient outages as "no data" and stall, (2) a TOCTOU window in `lock.ts` between `tryMkdir` and `writePid` where a crash leaves an unowned lock directory, (3) cross-repo bootstrap passing user-controlled `alias` values to `gh repo clone` and `gh repo create` without shell-metacharacter sanitization, (4) `--force-with-lease` in `daemonRebase` potentially having a stale local ref when the daemon's last fetch predates a worker push, and (5) the `reconcile.ts` title-matching heuristic potentially failing on PRs where workers use different title formats than the work item title.

Cross-reference: Review 1 identified `OrchestratorItem`/`DaemonStateItem` divergence (Finding 1) -- this review surfaces the downstream impact: `resolvedRepoRoot` not being serialized means cross-repo items lose their target repo after daemon restart, forcing reconcile to fall back to hub-repo-only queries. Review 2 identified `executeMerge` non-atomicity (Finding 6) -- this review examines the `daemonRebase` and `rebaseOnto` functions that execute the post-merge restack steps. Review 3 identified partition TOCTOU (Finding 2) -- the same class of race exists in `lock.ts` (Finding 2 below).

## Findings

### 1. GitHub API errors silently return empty results -- SEVERITY: high
**Tag:** SIMPLIFY

Multiple functions in `gh.ts` silently return empty arrays/objects when the `gh` CLI fails:

- `prList()` (line 42): returns `[]` on exit code != 0
- `prView()` (line 63): returns `{}` on exit code != 0
- `prChecks()` (line 81): returns `[]` on exit code != 0
- `listPrComments()` (line 511): returns `[]` on exit code != 0
- `fetchTrustedPrComments()` (lines 459-465, 467-473): catches all errors, returns `[]`

The async variants (`prListAsync`, `prViewAsync`, `prChecksAsync`) follow the same pattern (lines 130, 152, 170).

**Impact chain for `prChecks` returning `[]`:**

1. `checkPrStatus()` in `pr-monitor.ts` (line 189) filters for non-SKIPPED checks: `const nonSkipped = checks.filter(c => c.state !== "SKIPPED")`
2. With an empty array, `nonSkipped.length === 0`, so `ciStatus` remains `"unknown"` (line 191)
3. With `ciStatus === "unknown"`, `status` stays `"pending"` (line 201)
4. The item stays in `ci-pending` state indefinitely

During a GitHub API outage (or rate limiting), **every** item in `ci-pending` state will get `ciStatus: "unknown"` every poll cycle. The items never advance and never trigger the stuck/retry logic (which only fires for `implementing` state workers). The system silently stalls until GitHub recovers.

**Impact chain for `prList` returning `[]`:**

1. `checkPrStatus()` (line 163) sees no open PRs: `openPrs.length === 0`
2. Checks for merged PRs (line 166): `mergedPrs = prList(repoRoot, branch, "merged")` -- also returns `[]` during outage
3. Returns `${id}\t\tno-pr` (line 172)
4. The orchestrator sees `no-pr` status and may try to re-launch the item

This is especially dangerous for stacked branches: if `prList` returns `[]` during an outage, the orchestrator may conclude the dependency's PR doesn't exist and roll back dependents.

**Recommendation:** Add a distinction between "API returned zero results" and "API call failed":

```typescript
type GhResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function prChecks(repoRoot: string, prNumber: number): GhResult<CheckResult[]> {
  const result = ghInRepo(repoRoot, [...]);
  if (result.exitCode !== 0) return { ok: false, error: result.stderr };
  // ... parse ...
  return { ok: true, data: parsed };
}
```

Callers can then distinguish "no checks" from "API failed" and hold state during outages. This is the highest-impact finding in this review. Estimated effort: ~100 LOC across `gh.ts` + callers.

### 2. Lock TOCTOU: crash between tryMkdir and writePid -- SEVERITY: medium
**Tag:** SIMPLIFY

`acquireLock()` (`lock.ts:77-114`) performs:
1. `tryMkdir(lockPath)` -- create the lock directory atomically (line 82)
2. `writePid(lockPath)` -- write PID file inside the directory (line 83)
3. `verifyPid(lockPath)` -- re-read PID to confirm ownership (line 85)

If the process crashes (SIGKILL, OOM) between step 1 and step 2, the lock directory exists but contains no PID file. `isLockStale()` (line 14) checks `existsSync(pidFile)` and returns `true` if missing -- so the lock is correctly detected as stale. **This is handled correctly.**

However, there's a subtler TOCTOU in the stale-lock recovery path (lines 92-99):

```typescript
if (isLockStale(lockPath)) {       // Process A: detects stale
  removeLockDir(lockPath);          // Process A: removes lock
  if (tryMkdir(lockPath)) {         // Process B may also be here
    writePid(lockPath);
    if (verifyPid(lockPath)) {      // Process A: writes PID
      return;                       // Process A: thinks it owns the lock
    }
  }
}
```

**Race scenario:**
1. Process A detects stale lock, calls `removeLockDir()`
2. Process B also detected stale lock (just before A removed it), calls `removeLockDir()` (no-op, already gone)
3. Process A calls `tryMkdir()` → succeeds
4. Process B calls `tryMkdir()` → fails (dir exists)
5. Process A writes PID, verifies → owns the lock. Correct.

The `verifyPid` guard (lines 48-56) addresses the case where both processes succeed in `tryMkdir` -- but `mkdir` is atomic on POSIX, so only one can succeed. The actual guard is that `tryMkdir` returns `false` for the loser, sending them back to the retry loop.

**Remaining gap:** If Process A creates the directory (step 3) but crashes before `writePid` (step 4), Process B enters the retry loop, sees no PID file, detects stale, removes the dir, and acquires the lock. But Process A's crash leaves no trace -- this is safe behavior (the lock is correctly released by staleness detection).

**The real concern is scope:** `acquireLock`/`releaseLock` are only imported by `cross-repo.ts` (lines 80, 98, 111, 120) for protecting the `.cross-repo-index` file. The lock isn't used by the main daemon loop, partition allocation, or state file writes. The scope is appropriately narrow.

**Recommendation:** The lock implementation is adequate for its current scope (protecting a small index file from concurrent cross-repo updates). The `verifyPid` guard handles the most dangerous TOCTOU race. Two improvements:
1. Add a `finally` block in `acquireLock` to clean up the lock directory if `writePid` throws (e.g., disk full). Currently, a throw from `writePid` leaves the directory without a PID file.
2. Document the concurrency model: "This lock is designed for single-machine, multi-process locking. Not suitable for NFS or other network filesystems."
Estimated effort: ~10 LOC.

### 3. Cross-repo bootstrap: alias used in shell commands without sanitization -- SEVERITY: medium
**Tag:** SIMPLIFY

`bootstrapRepo()` (`cross-repo.ts:210-329`) uses the `alias` parameter in several shell commands:

- Line 240: `run("gh", ["repo", "clone", \`${org}/${alias}\`, targetPath])` -- `alias` is passed as a CLI argument to `gh`
- Line 305: `run("gh", ["repo", "create", \`${org}/${alias}\`, ...])` -- same
- Line 229: `join(parentDir, alias)` -- `alias` becomes part of a filesystem path

The `alias` value originates from the `Repo:` field in work item markdown files (`work-item-files.ts:103-105`):
```typescript
const repoMatch = line.match(/^\*\*Repo:\*\*\s+(.+)/);
if (repoMatch) {
  repoAlias = repoMatch[1]!.trim();
}
```

This is a simple regex match with no validation. A malicious or malformed work item could set `Repo: ../../../etc/passwd` or `Repo: foo; rm -rf /`.

**Mitigation analysis:**

1. **Shell injection via `run()`**: The `run()` function (`core/shell.ts`) uses `Bun.spawnSync` with an array of arguments, NOT `shell: true`. This means arguments are passed directly to the executable without shell interpretation. `foo; rm -rf /` would be passed as a literal string to `gh`, which would fail with "repo not found" rather than executing the injection. **Shell injection is NOT possible.**

2. **Path traversal via `join(parentDir, alias)`**: `alias = "../../../etc"` would resolve to a path outside the project directory. `join("/Users/rob/code/ninthwave/..", "../../../etc")` = `/etc`. The `isGitRepo()` check (line 66) would fail for `/etc` (no `.git` dir), so `resolveRepo()` would throw. But `bootstrapRepo` catches that exception (line 224) and continues to the bootstrap path, which would `mkdirSync("/etc", { recursive: true })` -- but `/etc` already exists, so this is a no-op. Then `git init` would run in `/etc`. This is a realistic attack vector if work item files are untrusted.

3. **GitHub API injection**: `org/alias` is passed to `gh repo view` and `gh repo clone`. GitHub usernames/repo names are restricted to `[a-zA-Z0-9._-]`, so the GitHub API would reject malformed names. But the `gh` CLI itself may not validate before attempting the API call.

**Recommendation:** Validate the `alias` field against a strict pattern:

```typescript
const VALID_ALIAS = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
if (!VALID_ALIAS.test(alias)) {
  return { status: "failed", reason: `invalid-alias: '${alias}' contains disallowed characters` };
}
```

This matches GitHub's repo name restrictions. Apply the same validation in `resolveRepo()`. Estimated effort: ~10 LOC.

### 4. Force-push safety: daemonRebase --force-with-lease vs stale refs -- SEVERITY: medium
**Tag:** SIMPLIFY

`daemonRebase()` (`git.ts:277-296`) performs:
1. `fetch origin main` (line 279) -- updates `origin/main` ref
2. `rebase origin/main` (line 283) -- replays commits
3. `push --force-with-lease origin <branch>` (line 292) -- pushes rebased history

`--force-with-lease` is safer than `--force` because it checks that the remote ref matches the local tracking ref. If the remote was updated (e.g., by a worker push) since the last fetch, the push is rejected.

**The concern:** `daemonRebase` fetches `origin/main` (step 1) but does NOT fetch `origin/<branch>`. This means the local tracking ref for `origin/<branch>` may be stale. Specifically:

1. Daemon's last fetch of `origin/ninthwave/H-1` was 5 minutes ago (local ref: `abc123`)
2. Worker pushes a new commit to `origin/ninthwave/H-1` (remote ref: `def456`)
3. Daemon calls `daemonRebase()`, which fetches `origin/main` only
4. Daemon rebases onto `origin/main` (from the local branch, which is still at `abc123`)
5. Daemon pushes `--force-with-lease origin ninthwave/H-1`

At step 5, `--force-with-lease` compares the daemon's local tracking ref (`abc123`) against the remote (`def456`). They don't match, so **the push is correctly rejected**. The function returns `false`, and the caller falls back to a worker rebase request.

**However**, there's a subtler issue: the daemon's local branch in the worktree may be behind the worker's push. Step 4 rebases the daemon's local branch (which doesn't have the worker's latest commit). If the daemon had fetched the branch first, the rebase would include the worker's commit. Without the fetch, the rebase produces a history that is missing the worker's latest work.

In the scenario where the push succeeds (the worker hasn't pushed since the last fetch), the rebase result is correct -- it replays all commits from the local branch onto the new main. But the daemon's worktree is not always in sync with what was pushed to the remote.

The `executeMerge` function (`orchestrator.ts:1759`) is where `daemonRebase` is called. After a successful rebase, it transitions to `ci-pending` (line 1761). If the rebase pushed a rebased version that is missing a worker's recent commit, CI will run on incomplete code. The worker would need to push again.

**In practice**, `daemonRebase` is called from two contexts:
1. **Pre-merge rebase** (`orchestrator.ts:1752`): The PR is already CI-passed, so the worker has finished pushing. The risk of a concurrent push is low.
2. **Post-merge sibling rebase** (`orchestrator.ts:1930`): Rebases sibling branches after a merge. Workers may still be active on siblings. This is the higher-risk path.

For context 2, if the push succeeds (no concurrent worker push), the rebase is correct. If the push fails, the fallback is appropriate.

**Recommendation:** Add a fetch of the branch before rebasing:
```typescript
const fetchBranch = run("git", ["-C", repoRoot, "fetch", "origin", branch, "--quiet"]);
if (fetchBranch.exitCode !== 0) return false;
```
Insert this after line 279 (fetch main) and before line 283 (rebase). This ensures the local branch is up-to-date with the remote before rebasing, and makes `--force-with-lease` comparison meaningful. Estimated effort: ~3 LOC.

### 5. prTitleMatchesWorkItem: fragile heuristic for merge detection -- SEVERITY: medium
**Tag:** SIMPLIFY

`prTitleMatchesWorkItem()` (`work-item-utils.ts:284`) is used in three critical paths:

1. **`buildSnapshot`** (`orchestrate.ts:585, 765`): Determines if a merged PR belongs to the current work item. A mismatch means the orchestrator ignores a legitimately merged PR.
2. **`reconcile`** (`reconcile.ts:272`): Determines if a merged PR should trigger work item file deletion. A mismatch means the work item file is not cleaned up.
3. **`cleanStaleBranchForReuse`** (`launch.ts:376`): Determines if a merged branch should be deleted before relaunching with new work.

The function normalizes both titles and checks if the PR title contains the work item title as a substring. Let me trace the normalization:

```typescript
export function prTitleMatchesWorkItem(prTitle: string, todoTitle: string): boolean {
  const normPr = normalizeTitleForComparison(prTitle);
  const normTodo = normalizeTitleForComparison(todoTitle);
  return normPr.includes(normTodo);
}
```

Workers create PRs with titles like `fix: <description> (H-1)` or `feat: implement parser (H-PAR-1)`. The work item title is typically `<description>`. The normalization strips punctuation and lowercases. The check is `normPr.includes(normTodo)` -- the PR title must contain the (normalized) work item title.

**Failure scenario 1: Worker uses a rephrased title.** If the work item title is "Add validation to parser" and the worker creates `fix: add input validation to the parser (H-PAR-1)`, the normalized PR title is `fix add input validation to the parser hpar1` and the normalized work item title is `add validation to parser`. The `includes` check fails because "input" appears between "add" and "validation".

**Failure scenario 2: Very short work item titles.** A work item titled "Fix" would match any PR with "fix" in the title. This is the reverse problem -- too many matches.

**Failure scenario 3: Unicode/emoji in titles.** Work item titles with emoji (e.g., from a GitHub issue) may normalize differently than worker-generated PR titles.

The function is critical for the collision safety guard (prevents false deletion when a work item ID is reused). The heuristic is pragmatic but introduces a class of false negatives (legitimate merges ignored because the worker rephrased the title) and false positives (unrelated PRs matching short titles).

**Impact of false negative (title mismatch on legitimate merge):**
- In `buildSnapshot`: The merged PR is not recognized. The item stays in its current state (e.g., `implementing`) even though the work was already merged. It would eventually timeout and be marked stuck.
- In `reconcile`: The work item file is not deleted. It persists as an apparent open item in the next daemon cycle, potentially relaunching work that's already done.

**Impact of false positive (unrelated PR matches):**
- A PR from a different tool/person with a similar description matches. The orchestrator falsely marks the item as merged. Low risk since ninthwave PRs use the `ninthwave/*` branch prefix, which is a strong discriminator before title matching applies.

**Recommendation:** In addition to title matching, always check if the merged PR's branch name matches `ninthwave/<todoId>`. The branch name is a stronger signal than the title. The title check should be a secondary guard for collision detection (same branch name, different work item), not the primary merge detection. Currently, `buildSnapshot` already checks `snap.prNumber === orchItem.prNumber` before falling back to title matching (line 584), which is the right precedence. Ensure `reconcile` follows the same pattern. Estimated effort: ~15 LOC.

### 6. Comment spam prevention: thorough but relies on text prefix matching -- SEVERITY: low
**Tag:** KEEP

`processComments()` (`orchestrator.ts:1405-1458`) filters comments to prevent relaying the orchestrator's own comments back to workers:

- Line 1433: `if (comment.body.startsWith("**[Orchestrator]**")) continue;`
- Line 1434: `if (comment.body.includes("<!-- ninthwave-orchestrator-status -->")) continue;`
- Line 1436: `if (/\*\*\[Worker:/.test(comment.body)) continue;`

This covers three cases:
1. Plain-text orchestrator comments (e.g., merge audit trail)
2. Hidden-marker orchestrator status comments (living status table)
3. Worker self-comments (any worker ID, not just this worker)

**Remaining risk:** A trusted human collaborator whose comment starts with `**[Orchestrator]**` would be silently filtered. This is extremely unlikely in practice -- the prefix is distinctive. The `TRUSTED_ASSOCIATIONS` filter in `fetchTrustedPrComments` (`gh.ts:427`) only includes `OWNER`, `MEMBER`, `COLLABORATOR`, which further narrows the population.

**Self-amplification risk:** Could the orchestrator's own comments trigger `fetchTrustedPrComments`? The orchestrator posts via `prComment()` which uses the `gh` CLI. The `gh` CLI uses the authenticated user's identity. If the authenticated user has `OWNER` or `MEMBER` association, the orchestrator's comments would pass the `TRUSTED_ASSOCIATIONS` filter. They would then be filtered by the text-prefix checks (lines 1433-1436).

**What if the text prefix is missing?** The `upsertOrchestratorComment` function (`gh.ts:572-614`) always includes `ORCHESTRATOR_COMMENT_MARKER` (line 602). The plain-text `prComment` calls always include `**[Orchestrator]**` prefix (lines 1809, 2005). Worker comments include `**[Worker:` prefix per the agent prompt convention. All three filters are consistently applied at the creation site.

**Recommendation:** Keep. The three-layer filter (text prefix, HTML marker, worker regex) is sufficient. The risk of self-amplification is theoretically present but prevented by consistent prefixing at the creation site. Consider adding an `<!-- ninthwave-comment -->` HTML marker to all orchestrator/worker comments as a unified filter, replacing the text-prefix checks. This would be more robust against format changes. Low priority.

### 7. Stacked branch base corruption: deleted base branch -- SEVERITY: medium
**Tag:** SIMPLIFY

When a dependency gets stuck, the orchestrator rolls back pre-WIP dependents to `queued` with `baseBranch` cleared (Review 2, Finding 9). When a dependency's PR is merged, `executeMerge` (`orchestrator.ts:1833-1891`) restacks dependents using `rebaseOnto()`.

**Scenario: dependency PR is merged, but its branch is deleted before restack runs.**

1. Dependency A's PR is merged via `prMerge()` with `--delete-branch` (`gh.ts:219`).
2. `executeMerge` transitions A to `merged` (line 1804).
3. GitHub auto-deletes the `ninthwave/A` branch (both local and remote).
4. `executeMerge` attempts to restack dependent B:
   - Gets `depBranch = "ninthwave/A"` (line 1839)
   - Calls `rebaseOnto(worktreePath, "main", "ninthwave/A", "ninthwave/B")` (line 1869)
   - `rebaseOnto` (`git.ts:310-328`) runs `git rebase --onto main ninthwave/A ninthwave/B`
   - **`ninthwave/A` no longer exists as a local ref** -- the rebase fails

However, examining the flow more carefully: `prMerge` uses `--delete-branch` (line 219), which deletes the remote branch. But the local branch in the worktree still exists until the worktree is cleaned. The `rebaseOnto` call (line 1869) operates on the worktree path of the dependent (B), not the dependency (A). The `oldBase` parameter (`ninthwave/A`) needs to be resolvable as a ref in B's worktree.

**Key question:** Does B's worktree have a local ref for `ninthwave/A`? B's worktree was created from `ninthwave/A` as its start point (via `baseBranch`). The start point creates the worktree branch from that ref, but doesn't create a local tracking branch for it. So `ninthwave/A` may not exist as a local ref in B's worktree.

However, `git rebase --onto <newBase> <oldBase> <branch>` resolves `<oldBase>` as a commit SHA, not just a branch name. If the commit that `ninthwave/A` pointed to is still in the git object database (it is -- squash-merge creates a new commit but doesn't garbage-collect the old one), then `ninthwave/A` can be resolved via `origin/ninthwave/A` or the reflog.

**But** if `origin/ninthwave/A` is also deleted (GitHub auto-delete removed it), and no local ref points to it, the ref is unresolvable. `rebaseOnto` would fail and return `false` (line 322). The fallback path (lines 1858-1865) sends a manual rebase instruction to the worker. The worker message includes `git rebase --onto main ninthwave/A ninthwave/B && git push --force-with-lease` -- which has the same unresolvable ref problem.

**Recommendation:** Before calling `rebaseOnto`, save the dependency branch's commit SHA while it's still resolvable:

```typescript
// In executeMerge, before prMerge:
const depCommitSha = deps.resolveRef?.(depBranch) ?? depBranch;
// ... prMerge (which deletes the branch) ...
// ... restack using depCommitSha instead of depBranch:
deps.rebaseOnto(worktreePath, "main", depCommitSha, otherBranch);
```

Using the SHA instead of the branch name makes the rebase immune to branch deletion. Estimated effort: ~10 LOC (add a `resolveRef` dep + use it).

### 8. gh.ts error handling inconsistency: apiGet throws, others return empty -- SEVERITY: low
**Tag:** SIMPLIFY

`apiGet()` (`gh.ts:256-270`) **throws** on failure:
```typescript
if (result.exitCode !== 0) {
  throw new Error(`gh api ${path} failed: ${result.stderr}`);
}
```

But `prList`, `prView`, `prChecks`, `listPrComments` **return empty** on failure. `getRepoOwner` **throws**. `prMerge`, `prComment` **return boolean**.

This inconsistency means callers must know which functions throw and which silently degrade. The `fetchTrustedPrComments` function (line 459-473) wraps `apiGet` calls in try/catch because it knows `apiGet` throws. But `checkPrStatus` in `pr-monitor.ts` (line 163-229) doesn't wrap `prList`/`prView`/`prChecks` in try/catch because they never throw.

If a future refactor changes one of the "return empty" functions to throw, callers that don't have try/catch would crash the daemon's poll loop.

**Recommendation:** Standardize error handling. Two approaches:
1. **All functions return result types** (aligned with Finding 1): `{ ok: true, data: T } | { ok: false, error: string }`. This makes the error path explicit at every call site.
2. **All functions throw** (simpler change): Convert the "return empty" pattern to throw, and wrap the poll loop in a top-level try/catch. Risk: harder to distinguish "no data" from "API failed".

Option 1 is preferred. It aligns with Finding 1's recommendation and makes error handling explicit. Estimated effort: ~60 LOC.

### 9. reconcile.ts: robust design with good dependency injection -- SEVERITY: low (positive finding)
**Tag:** KEEP

`reconcile()` (`reconcile.ts:232-418`) is well-designed:

1. **Full dependency injection** via `ReconcileDeps` interface (lines 19-50). Every external operation is injectable, enabling comprehensive testing without real git/gh calls.
2. **Collision safety** via `prTitleMatchesWorkItem` (lines 270-274). Prevents false deletion when work item IDs are reused across cycles. Cross-reference: Review 2 identified this as a reconcile-time concern; the implementation handles it correctly.
3. **Multi-phase cleanup**: merged items (step 4), orphaned worktrees (step 4.6), stale zero-commit worktrees (step 4.7). Each phase has clear criteria and is idempotent.
4. **Cross-repo awareness**: Queries both hub repo and target repos for merged PRs (lines 96-125). Uses the `.cross-repo-index` to discover target repos.

**One concern:** The `defaultPullRebase` function (lines 54-70) detects merge conflicts by string-matching stderr:
```typescript
const isConflict = result.stderr.includes("CONFLICT") ||
  result.stderr.includes("could not apply") ||
  result.stderr.includes("Merge conflict");
```
This is fragile against git localization (non-English error messages) and version changes. However, since ninthwave requires a specific developer environment (macOS/Linux), and git localization is rare in development contexts, this is low risk.

**Stale worktree cleanup** (step 4.7, lines 371-405) is a good addition: it detects worktrees with zero commits beyond main and no open PR, then cleans them. This catches worktrees left behind by aborted orchestration runs. The `worktreeHasCommits` + `branchHasOpenPR` double-check prevents cleaning active work.

**Recommendation:** Keep. The design is solid. Minor improvement: consider checking `result.exitCode === 1` in addition to stderr matching for conflict detection, as git consistently returns exit code 1 for rebase conflicts.

### 10. pr-monitor.ts: sync/async code duplication -- SEVERITY: medium
**Tag:** SIMPLIFY

`pr-monitor.ts` contains two nearly-identical implementations of core functions:

- `checkPrStatus()` (lines 157-229) and `checkPrStatusAsync()` (lines 237-305): 72 LOC and 68 LOC respectively, with identical logic differing only in sync vs async `gh` calls.
- `cmdWatchReady()` (lines 102-139) and `getWatchReadyState()` (lines 393-424): 37 LOC each, identical logic with the former printing to console and the latter returning a string.

The sync/async duplication exists because the TUI mode (`buildSnapshotAsync`) needs non-blocking gh calls to keep keyboard events responsive, while CLI commands (`nw watch-ready`) use sync calls for simplicity. The comment at lines 102-105 explains this.

**Total duplicated logic:** ~140 LOC of near-identical code. Any bug fix or behavior change must be applied to both versions. For example, the `CI_FAILURE_STATES` set (lines 148-155) is used identically in both sync and async versions -- but if a new failure state is added, both call sites must be updated.

**Recommendation:** Extract the shared logic into a generic function parameterized by sync/async:

```typescript
function processChecks(
  checks: { state: string; name: string; completedAt?: string }[],
): { ciStatus: string; eventTime: string | undefined } {
  // ... shared CI status logic ...
}
```

The sync and async functions would each call their respective `prList`/`prView`/`prChecks` and then pass results to the shared `processChecks`. This eliminates the duplicated logic while keeping the sync/async call paths separate. Estimated effort: ~30 LOC refactor, net reduction of ~60 LOC.

### 11. stack-comments.ts: clean, minimal, well-designed -- SEVERITY: low (positive finding)
**Tag:** KEEP

`stack-comments.ts` (86 LOC) is a focused module that generates git-spice-style markdown comments showing the dependency stack tree and syncs them to all PRs in a stack.

**Design strengths:**
- `GhCommentClient` interface (lines 12-16) provides clean dependency injection for testability
- `STACK_COMMENT_MARKER` (line 19) uses HTML comment for reliable identification
- `buildStackComment` (lines 29-53) is a pure function -- easy to test
- `syncStackComments` (lines 65-85) is idempotent -- creates on first call, updates on subsequent calls

**Integration:** The orchestrator calls `syncStackComments` via the `deps.syncStackComments` dependency (injected in `orchestrate.ts:3381`). It's triggered when a stacked PR is opened (line 856) and after a merge restacks dependents (line 1970). The `executeSyncStackComments` handler (line 2288) gracefully no-ops when the dep isn't wired.

**Is it adding value or noise?** Stack comments provide visual context for reviewers -- they can see where a PR sits in the dependency chain without leaving the PR page. This is the same UX that git-spice provides, which has positive user adoption. The comments are updated (not duplicated) on each change, so noise is minimal.

**Recommendation:** Keep. The module is well-scoped, well-tested via DI, and provides genuine value for stacked PR workflows.

### 12. conflicts.ts: static analysis only, no runtime conflict detection -- SEVERITY: low
**Tag:** QUESTIONABLE

`cmdConflicts()` (`conflicts.ts:8-79`) performs static file-level conflict analysis by comparing the `filePaths` fields of work items. It detects:
- **Direct conflicts**: Two items modify the same file
- **Domain overlaps**: Two items share the same domain

**Limitations:**
1. `filePaths` is extracted from the work item markdown's "Key files" field by `extractFilePaths()`. If a work item doesn't list all affected files, conflicts won't be detected.
2. No git-level conflict detection. Two items could modify different sections of the same file without a merge conflict. Conversely, two items could modify different files that affect the same code path (semantic conflict).
3. The function is called from `cmdRunItems` (`launch.ts:1202`) as a pre-launch check, but only when the user explicitly passes multiple IDs. The orchestrator (`orchestrate.ts`) does NOT call it -- concurrent launches proceed without conflict checking.

**Usage:** The function is exposed as a CLI command (`nw conflicts <ID1> <ID2>`) and as a pre-launch gate in batch mode. It's an advisory tool, not a hard gate.

**Recommendation:** The static approach is pragmatic for its current use case (manual pre-launch check). It's not a substitute for runtime conflict detection. Consider whether the orchestrator should call `cmdConflicts` before launching items from the same batch. If the file overlap is high, the daemon could serialize the launches to avoid merge conflicts. This is a feature enhancement, not a bug.

### 13. getCleanRemoteWorkItemFiles: well-designed defensive coding -- SEVERITY: low (positive finding)
**Tag:** KEEP

`getCleanRemoteWorkItemFiles()` (`git.ts:342-388`) computes the set of work item files that exist on `origin/main` and have no local modifications. This is used by the parser to filter out items that are already being worked on in other branches.

**Design strengths:**
- Injectable `ShellRunner` for testing (line 345)
- Returns `null` when `origin/main` doesn't exist (graceful degradation for first-time setup)
- Uses `git ls-tree` for the inclusion set (reliable, not affected by local state)
- Uses `git diff origin/main` for the exclusion set (captures staged, unstaged, and committed differences)
- Falls back to the full remote set if the diff command fails (safe fallback -- includes more items, doesn't exclude any)

The function correctly handles the edge case where `origin/main` exists but `.ninthwave/work/` is empty (returns empty Set), and where the diff contains files outside `.ninthwave/work/` (only processes matching paths).

**Recommendation:** Keep. This is a well-designed defensive function.

## Theme A: Feature Necessity

### Assessment

| Feature | Tag | Rationale |
|---|---|---|
| `git.ts` core operations | **KEEP** | Essential git abstraction. Every function is imported by 2+ modules. Clean error handling (throw on failure). |
| `git.ts` `daemonRebase` | **KEEP** | Required for daemon-side rebase when workers can't respond. Used by orchestrator for pre-merge and post-merge rebases. |
| `git.ts` `rebaseOnto` | **KEEP** | Required for squash-merge-safe restacking. Without it, stacked branches would have duplicate commits after dependency squash-merge. |
| `git.ts` `getCleanRemoteWorkItemFiles` | **KEEP** | Required for parser filtering. Prevents relaunching items already in progress. |
| `gh.ts` core PR operations | **KEEP** | Essential GitHub integration. Used by orchestrator, reconcile, and CLI commands. |
| `gh.ts` async variants | **KEEP** | Required for TUI responsiveness. Without them, the TUI freezes during network calls (each `gh` call blocks 1-3 seconds). |
| `gh.ts` `upsertOrchestratorComment` | **KEEP** | Provides living audit trail on PRs. The upsert pattern prevents comment spam (one table per PR, rows appended). |
| `gh.ts` `fetchTrustedPrComments` | **KEEP** | Required for comment relay. The trusted filter prevents untrusted external comments from reaching workers. |
| `gh.ts` `setCommitStatus` | **KEEP** | Required for review status integration. Shows "Ninthwave / Review" check on PRs. |
| `gh.ts` `resolveGithubToken` | **KEEP** | Required for custom auth. Enables using a different GitHub identity for ninthwave operations. |
| `cross-repo.ts` `resolveRepo` | **QUESTIONABLE** | Resolution chain (repos.conf → sibling convention) adds complexity. Sibling convention alone would be simpler but less flexible. If repos.conf has zero real users, strip it and simplify. |
| `cross-repo.ts` `bootstrapRepo` | **QUESTIONABLE** | Auto-creating GitHub repos is a powerful but dangerous feature. If stripped, cross-repo items would require manual repo setup. The 120 LOC bootstrap logic would become ~5 LOC "repo not found" error. |
| `cross-repo.ts` index operations | **KEEP** | Required for tracking cross-repo worktrees. The lock-protected read/write/remove operations are simple and correct. |
| `pr-monitor.ts` `checkPrStatus` | **KEEP** | Core polling function. Every orchestrator poll cycle calls it for each tracked item. |
| `pr-monitor.ts` `cmdAutopilotWatch` | **QUESTIONABLE** | Legacy polling command from before the daemon existed. The daemon's `orchestrateLoop` provides the same functionality. Check if `cmdAutopilotWatch` is still called anywhere outside tests. |
| `pr-monitor.ts` `cmdPrWatch` | **KEEP** | Used by the daemon to detect new activity on PRs (review feedback, comments). The polling approach is appropriate for GitHub's API (no webhooks required). |
| `pr-monitor.ts` `cmdPrActivity` | **KEEP** | Used by the daemon to check for new reviews/comments on multiple PRs in a single call. More efficient than per-PR polling. |
| `pr-monitor.ts` `scanExternalPRs` | **KEEP** | Required for external PR review feature. Discovers non-ninthwave PRs for the review workflow. |
| `stack-comments.ts` | **KEEP** | Clean, minimal module. 86 LOC with good DI. Provides genuine value for stacked workflows. |
| `conflicts.ts` | **QUESTIONABLE** | Advisory static analysis only. 80 LOC. Not integrated into the daemon's launch decisions. Could be stripped if file-level conflict analysis isn't providing real value. |
| `reconcile.ts` | **KEEP** | Critical for daemon crash recovery. Well-designed with full DI. The title-matching collision guard is important for production use. |
| `lock.ts` | **KEEP** | Only used by cross-repo index. If cross-repo is stripped, the lock goes too. But if cross-repo stays, the lock is necessary for multi-process safety. |

### Cross-repo usage assessment

`cross-repo.ts` (430 LOC) + `lock.ts` (119 LOC) = 549 LOC dedicated to cross-repo support. The key question: are real users creating cross-repo work items?

The cross-repo feature is used by the dogfooding workflow (ninthwave developing ninthwave). The `Repo:` field exists in the work item format, the orchestrator handles it throughout the lifecycle, and the `bootstrapRepo` function can auto-clone or auto-create repos. However, this is primarily foundation code for a future use case (multi-repo monorepo orchestration).

If cross-repo is stripped:
- Remove `cross-repo.ts` (430 LOC) and `lock.ts` (119 LOC) -- 549 LOC savings
- Remove `bootstrapping` state from orchestrator -- ~50 LOC savings
- Simplify `launchSingleItem` branch management -- ~30 LOC savings
- Remove cross-repo-index operations from `reconcile.ts` -- ~30 LOC savings
- **Total savings: ~660 LOC**

The system would still support single-repo orchestration, which covers the primary use case. Cross-repo could be re-added later if demand materializes.

### cmdAutopilotWatch assessment

`cmdAutopilotWatch()` (`pr-monitor.ts:311-390`) is an 80 LOC polling function. Checking its usage:

It's called from `core/help.ts` (via CLI dispatch). It's the `nw autopilot-watch` command. The daemon (`orchestrateLoop`) replaces this functionality by integrating PR status checking into the event loop. `cmdAutopilotWatch` may still be useful as a standalone CLI tool for debugging, but its polling loop duplicates logic that the daemon handles.

**Verdict:** QUESTIONABLE. Keep for debugging but consider deprecating in favor of `nw watch` (the daemon).

## Theme B: Complexity Reduction

### Can gh.ts be split?

At 615 LOC, `gh.ts` covers:
- PR CRUD: `prList`, `prView`, `prChecks`, `prMerge`, `prComment` (~180 LOC)
- Async variants: ~90 LOC
- Repo/auth: `getRepoOwner`, `resolveGithubToken`, `applyGithubToken` (~35 LOC)
- Commit CI: `checkCommitCI`, `setCommitStatus`, `prHeadSha`, `getMergeCommitSha` (~100 LOC)
- Comment CRUD: `listPrComments`, `updatePrComment`, `upsertOrchestratorComment` (~120 LOC)
- Trusted comments: `fetchTrustedPrComments`, `TRUSTED_ASSOCIATIONS` (~55 LOC)
- Branding: `NINTHWAVE_FOOTER`, `ORCHESTRATOR_LINK` (~5 LOC)

The natural split:
1. `gh-pr.ts`: PR CRUD + async variants (~270 LOC)
2. `gh-comments.ts`: Comment CRUD + orchestrator upsert + trusted comments (~175 LOC)
3. `gh-ci.ts`: Commit CI + status API (~100 LOC)
4. `gh.ts`: Repo/auth + shared types (~40 LOC)

**Verdict:** The file is manageable at 615 LOC with clear internal sections. A split would reduce per-file size but increase import complexity. **Keep as-is** unless the file grows past ~800 LOC.

### Can pr-monitor.ts be simplified?

At 676 LOC, `pr-monitor.ts` contains:
- `scanExternalPRs` (54-93) -- external PR discovery: ~40 LOC
- `checkPrStatus` / `checkPrStatusAsync` (157-305) -- core CI polling: ~148 LOC (74 each, duplicated)
- `cmdWatchReady` / `getWatchReadyState` (102-424) -- legacy polling: ~70 LOC (duplicated)
- `cmdAutopilotWatch` (311-390) -- legacy polling loop: ~80 LOC
- `findTransitions` / `findGoneItems` (426-470) -- transition detection: ~45 LOC
- `cmdPrWatch` (475-583) -- PR activity polling: ~108 LOC
- `cmdPrActivity` (589-675) -- PR activity check: ~86 LOC

**Simplification opportunities:**
1. Extract shared CI status logic from sync/async variants (Finding 10) -- saves ~60 LOC
2. Deprecate `cmdAutopilotWatch` -- saves ~80 LOC
3. Merge `cmdWatchReady` and `getWatchReadyState` into one function with optional console output -- saves ~37 LOC

**Estimated post-simplification:** ~500 LOC. Still a large file but more focused.

### Can reconcile.ts be simpler if we accept some states are unrecoverable?

`reconcile.ts` has 5 cleanup phases:
1. Pull latest main (step 1)
2. Mark merged items done (steps 2-3)
3. Clean merged worktrees (step 4)
4. Clean orphaned worktrees (step 4.6)
5. Clean stale zero-commit worktrees (step 4.7)

Phases 4 and 5 (orphaned + stale cleanup) add ~60 LOC. They handle edge cases: worktrees left behind by aborted runs, worktrees with no matching work item file. These are real failure modes from dogfooding.

**Could phases 4-5 be removed?** Without them, orphaned worktrees would accumulate until `nw clean` is run manually. With a WIP limit of 5 and 2-3GB per worktree, this could waste 10-15GB of disk. On a 256GB dev machine, this is annoying but not critical.

**Verdict:** Keep phases 4-5. The 60 LOC cost is justified by the self-healing behavior. Users shouldn't need to run `nw clean` manually after every daemon crash.

### Is conflicts.ts worth its 80 LOC?

`conflicts.ts` provides static file-level conflict analysis. It's used in two places:
1. `nw conflicts <ID1> <ID2>` CLI command
2. Pre-launch check in `cmdRunItems` when launching multiple items

The daemon does NOT use it. Items launched by the daemon may have file-level overlaps. The static analysis can't catch semantic conflicts anyway.

**Verdict:** QUESTIONABLE. The module provides advisory information but doesn't prevent conflicts. If users aren't using `nw conflicts` as a CLI tool, it could be stripped. Keep for now since it's only 80 LOC and provides a defensive check for batch launches.

### LOC Estimates for Simplification

| Action | LOC Change |
|---|---|
| Add result types to gh.ts functions (Finding 1) | +100 LOC (types + caller updates) |
| Add lock cleanup + documentation (Finding 2) | +10 LOC |
| Validate alias in cross-repo (Finding 3) | +10 LOC |
| Add branch fetch to daemonRebase (Finding 4) | +3 LOC |
| Extract shared CI status logic (Finding 10) | -60 LOC |
| Deprecate cmdAutopilotWatch (Theme B) | -80 LOC |
| Merge cmdWatchReady/getWatchReadyState (Theme B) | -37 LOC |
| Strip cross-repo (if decision is made) | -660 LOC |
| **Net change (without cross-repo strip)** | **-54 LOC** |
| **Net change (with cross-repo strip)** | **-714 LOC** |

## Recommendations

**Priority 1 (High -- correctness risk):**
1. **Add result types to gh.ts functions** (Finding 1). Silent API failures cause the orchestrator to misinterpret "no data" as "no checks" and stall indefinitely. ~100 LOC.
2. **Add branch fetch to daemonRebase** (Finding 4). Without fetching the branch before rebasing, the daemon may rebase against stale local state. ~3 LOC.
3. **Save dependency commit SHA before merge for restack** (Finding 7). Branch deletion before restack makes the old base unresolvable. ~10 LOC.

**Priority 2 (Medium -- reliability):**
4. **Validate cross-repo alias** (Finding 3). Path traversal via malformed alias could create directories outside the project. ~10 LOC.
5. **Strengthen prTitleMatchesWorkItem with branch name check** (Finding 5). Branch name is a stronger signal than title for merge detection. ~15 LOC.
6. **Extract shared CI status logic** (Finding 10). Eliminates 60 LOC of sync/async code duplication. ~30 LOC refactor.
7. **Add cleanup to lock.ts for writePid failure** (Finding 2). Prevents empty lock directories from accumulating. ~10 LOC.

**Priority 3 (Low -- simplification):**
8. **Standardize gh.ts error handling** (Finding 8). ~60 LOC. Subsumes Finding 1.
9. **Merge cmdWatchReady/getWatchReadyState** (Theme B). ~37 LOC savings.
10. **Deprecate cmdAutopilotWatch** (Theme B). ~80 LOC savings.

**Product decisions needed:**
11. **Cross-repo support**: Is it being used by real users? If not, stripping it saves ~660 LOC and removes `lock.ts` entirely.
12. **conflicts.ts**: Is the static conflict analysis providing real value, or should conflict handling be purely runtime (via git merge conflicts)?

**Cross-references to Reviews 1-3:**
- **Review 1 Finding 1** (OrchestratorItem/DaemonStateItem divergence): `resolvedRepoRoot` (not serialized) is needed by `executeMerge` to find cross-repo worktrees for restacking. After daemon restart, cross-repo items lose their target repo context. `getWorktreeInfo()` can recover it from the cross-repo index file, which is persisted on disk -- but only if the index entry wasn't cleaned up.
- **Review 1 Finding 9** (JSON.parse without validation): The `DaemonState` deserialization is upstream of reconcile -- if the state file is corrupted, reconcile never runs because the daemon fails to start. The validation guard recommended in Review 1 would prevent this cascade.
- **Review 2 Finding 6** (executeMerge non-atomicity): This review confirms the downstream impact -- `daemonRebase` and `rebaseOnto` are called from `executeMerge`'s post-merge cleanup (steps 5-8). If `fetchOrigin`/`ffMerge` fails before restack, the restack uses stale local main. The non-fatal wrapping prevents crashes but produces incorrect rebase results.
- **Review 2 Finding 9** (stuck dep → dependent rollback): This review adds Finding 7 -- when the stuck dep's branch is eventually deleted, the saved `baseBranch` ref becomes unresolvable. Using commit SHAs instead of branch names addresses both findings.
- **Review 2 Finding 11** (handleMerging only handles merged state): The `prList` returning `[]` during API outage (Finding 1) interacts with this -- `checkPrStatus` would report `no-pr` for a PR that's actually in `merging` state, causing the orchestrator to see a `merged → no-pr` transition that doesn't map to any state machine path.
- **Review 3 Finding 2** (partition allocation TOCTOU): The same class of TOCTOU race exists in `lock.ts` (Finding 2 above), though the lock's `verifyPid` guard provides better protection than partition's `existsSync` + `writeFileSync`.
- **Review 3 Finding 11** (workspace listing cache): `pr-monitor.ts` calls `prList`/`prView`/`prChecks` sequentially for each item, adding latency. The async variants help with TUI responsiveness but don't reduce the total number of API calls. Consider batching (e.g., one `gh api` call with GraphQL for all items) as a future optimization.
