# Fix: Parked PR must still receive rebase nudges on base advance (H-ORCH-12)

**Priority:** High
**Source:** Downstream friction log 2026-04-17T14-11-19Z--H-ICDP-2-parked-rebase.md
**Depends on:** None
**Domain:** orchestrator
**Bundle with:** H-ORCH-11
**Lineage:** 41ed1444-3068-4a66-8f41-8246896d91ca

In `core/orchestrator.ts:handleReviewPending`, the parked fast-path (`if (wasParked) return this.respawnCiFixWorker(item, "parked-ci-failure")`) returns before the `isMergeConflict` branch, so `planRebaseConflictAction()` is never reached for parked items whose base branch advanced. A parked PR that develops conflicts after its dependency merges sits idle until a human flags it manually. Reorder the logic: detect merge conflicts first and dispatch a rebase nudge regardless of parked status; the parked fast-path should only fire when no conflict is pending.

**Test plan:**
- Add daemon-integration test: stacked PR is parked after exhausting CI-fix retries; dependency merges and GitHub retargets the PR to main with conflicts; orchestrator dispatches `daemon-rebase` to the worker inbox even though `item.sessionParked === true`.
- Add test: parked PR with no merge conflict still takes the existing CI-fix fast-path (no regression).
- Verify existing `handleReviewPending` tests pass.

Acceptance: `handleReviewPending` dispatches a rebase action for items with `isMergeable === false` independent of `sessionParked`. Parked items with conflicts receive the same rebase nudge as active items. Parked items without conflicts retain the existing CI-fix-retry behavior. All existing tests pass.

Key files: `core/orchestrator.ts` (handleReviewPending, around lines 1515-1525), `core/orchestrator.ts` (handleCiPending, around lines 1311-1366, as the reference pattern), `test/daemon-integration.test.ts`.
