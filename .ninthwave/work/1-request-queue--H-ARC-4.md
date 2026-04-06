# Refactor: Parallel snapshot building via request queue (H-ARC-4)

**Priority:** High
**Source:** Architecture plan -- centralized request queue
**Depends on:** H-ARC-3
**Domain:** request-queue
**Lineage:** 813e5a93-2c8d-496c-b00d-31dff57d1dc4

Convert `buildSnapshotAsync()` in `core/snapshot.ts` from sequential per-item polling to parallel dispatch through the RequestQueue. Currently, the function iterates all active items with `for...of`, making 2-4 sequential `gh` CLI calls per item. With 10 active items, that's 30-40 sequential subprocess spawns per poll cycle.

Changes:
1. Add a `RequestQueue` parameter to `buildSnapshotAsync()` (dependency injection, consistent with codebase testing patterns).
2. Replace the sequential `for...of` loop with `Promise.all` over items, where each item's poll is enqueued through the queue.
3. Add a `stateToPollingPriority()` helper that maps orchestrator state to request priority: merging -> critical, ci-failed -> high, ci-pending/ci-passed -> normal, implementing/launching -> low.
4. Accumulate results from all resolved promises into the existing `items: ItemSnapshot[]` array. Error handling per-item (one failed poll doesn't block others) -- preserve the existing `apiErrorByKind` tracking.
5. The sync `buildSnapshot()` variant remains unchanged (used in tests with mock `checkPr`).

**Test plan:**
- Unit test `stateToPollingPriority()` mapping for all relevant states
- Integration test: `buildSnapshotAsync` with mock queue, verify all items dispatched in parallel (not sequential)
- Test priority ordering: verify merging items enqueued as critical, implementing as low
- Test error isolation: one item's poll failure doesn't affect others' snapshots
- Run full suite to verify no regressions in snapshot building behavior

Acceptance: `buildSnapshotAsync` dispatches item polls through the queue in parallel. Priority ordering respects state. Concurrency capped by queue's semaphore. Per-item error isolation preserved. Full test suite passes.

Key files: `core/snapshot.ts` (buildSnapshotAsync, ~line 593+), new helper `stateToPollingPriority`
