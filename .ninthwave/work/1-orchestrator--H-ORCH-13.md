# Fix: Worktree reuse must fetch and reset to origin HEAD (H-ORCH-13)

**Priority:** High
**Source:** Downstream friction log 2026-04-16T06-24-51Z--H-DC-2.md
**Depends on:** None
**Domain:** orchestrator
**Lineage:** d0ff16a9-2057-47f1-b5e3-a9054967cbcf

When `ensureWorktreeAndBranch()` in `core/commands/launch.ts` finds an existing worktree on disk (around lines 446-450), it logs a "reusing" warning and returns immediately without fetching or resetting the branch to `origin/<branch>`. The reused worktree inherits a stale branch head, so the worker starts work against an outdated tree and the human has to stash local changes, reset to `origin/main`, and re-verify tests before committing. Mirror the pattern already used for new worktree setup (and the reset pattern in `core/commands/review-inbox.ts` around lines 388-414): fetch `origin/<branch>` and `git reset --hard origin/<branch>` before returning `{ action: "launch" }`.

**Test plan:**
- Add unit test for `ensureWorktreeAndBranch` with an existing worktree on a stale branch: after the call, HEAD points at `origin/<branch>`.
- Add test: when the fetch fails (no network / branch does not exist upstream), the function warns but still returns `{ action: "launch" }` so launch is not blocked.
- Verify new-worktree tests still pass (no regression on the creation path).

Acceptance: Reused worktrees always start on the current remote HEAD of their branch. Workers never inherit stale branches. Launch still succeeds when the fetch fails (with a warning). All existing launch/worktree tests pass.

Key files: `core/commands/launch.ts` (ensureWorktreeAndBranch, around lines 446-450 and the surrounding branch-setup block 453-475), `core/commands/review-inbox.ts` (reference reset pattern around lines 388-414).
