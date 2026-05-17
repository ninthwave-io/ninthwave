# Fix: nw pr-create infers current branch in worktree environments (H-PRCR-1)

**Priority:** High
**Source:** Dogfooding friction -- 5 independent worker reproductions on the same day. `nw pr-create` (forwarding to `gh pr create`) failed with "head branch 'main' is the same as base branch 'main', cannot create a pull request" even though the worker was on a feature branch with commits ahead of origin/main. Workaround: pass explicit `--head <branch>`. Pattern: the failure consistently happens when invoked from inside a worktree under `.ninthwave/.worktrees/`.
**Depends on:** None
**Domain:** pr-create
**Lineage:** f333bddc-3ce6-4f86-b291-f24fdbdb524d

`gh pr create`'s auto-resolution of the head branch appears to misbehave when run from a worktree cwd, falling back to `main` and failing the equality check against the default base. The user-visible symptom ("head branch 'main' is the same as base branch 'main'") is misleading: the actual cause is auto-detection of head, not an actual same-branch operation. Five workers in one day wasted retries chasing the wrong diagnosis.

Have `nw pr-create` resolve the current branch via `git rev-parse --abbrev-ref HEAD` (or equivalent) and always pass an explicit `--head <branch>` through to `gh pr create`, unless the caller has already specified `--head`. This removes the worktree trap entirely. Fall back to surfacing a clearer error if `git rev-parse` cannot determine the current branch (detached HEAD, etc.).

**Test plan:**
- Unit: when `nw pr-create` is invoked with no `--head` flag, the forwarded `gh pr create` args include `--head <git-rev-parse output>`.
- Unit: when `nw pr-create` is invoked with `--head <explicit>`, the explicit value is preserved (no double `--head`, no override).
- Unit: when `git rev-parse --abbrev-ref HEAD` returns `HEAD` (detached) or fails, `nw pr-create` surfaces a clear error rather than silently passing `--head HEAD`.
- Integration: run `nw pr-create` from inside a worktree under `.ninthwave/.worktrees/` and confirm it no longer hits the "head branch 'main' is the same as base branch 'main'" failure.

Acceptance: `nw pr-create` invoked without an explicit `--head` succeeds when run from a worktree on a non-default branch. The forwarded `gh pr create` invocation always carries an explicit `--head`. Detached-HEAD case fails with a clear, branch-specific error message.

Key files: `core/commands/pr-create.ts` (or equivalent), tests under `test/` covering pr-create flag forwarding
