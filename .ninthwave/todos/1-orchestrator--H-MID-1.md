# Fix: Orchestrator falsely completes items when TODO IDs collide with old PRs (H-MID-1)

**Priority:** High
**Source:** Dogfood friction — orchestrator matched new TODOs to old merged PRs, reported false "done"
**Depends on:**
**Domain:** orchestrator

## Context

When a new TODO reuses an ID that was previously used (e.g., H-MUX-1 was used in March 24 for "extract Multiplexer interface" and again on March 26 for "fail fast when mux unavailable"), the orchestrator finds the old merged PR branch `todo/H-MUX-1` and fast-tracks the new item to "done" without launching any worker. The item appears completed in ~15 seconds with the old PR URL.

Additionally, `ninthwave reconcile` then deletes the new TODO file because it sees a merged PR matching the branch name.

This is a silent data loss bug — new work is discarded and marked done without being performed.

## Requirements

1. **Collision detection in orchestrator launch**: Before fast-tracking an item based on an existing PR/branch, verify the PR title or description matches the current TODO. If the PR is from a previous cycle (different title), treat it as a stale branch and do NOT match it.
2. **Branch name uniqueness**: When creating a worktree for a TODO, check if a remote branch `todo/<ID>` already exists with merged PRs. If so, use a suffixed branch name like `todo/<ID>-2` or fail with a clear error.
3. **Reconcile safety**: `reconcile` should compare the TODO file's title against the merged PR's title before marking it done. A title mismatch means it's a different item that happens to share the ID.
4. Add tests covering the collision scenario.

Acceptance: Creating a new TODO with an ID that matches an old merged PR does NOT result in the TODO being auto-completed. The orchestrator either creates a uniquely-named branch or errors with a clear message. Reconcile does not delete TODO files whose titles don't match the merged PR.

**Test plan:** Unit test: mock a merged PR `todo/FOO-1` with title "old work", create a new TODO FOO-1 with title "new work", verify orchestrator does not fast-track. Unit test: reconcile with a title-mismatched merged PR preserves the TODO file. Edge case: PR title is a substring of TODO title (should still be treated as mismatch unless exact).

Key files: `core/orchestrator.ts`, `core/commands/reconcile.ts`, `core/commands/start.ts`
