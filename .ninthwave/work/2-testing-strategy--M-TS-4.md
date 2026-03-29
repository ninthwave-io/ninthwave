# Feature: Stacking scenario test (M-TS-4)

**Priority:** Medium
**Source:** Testing strategy Phase 2
**Depends on:** None
**Domain:** testing-strategy

Write `test/scenario/stacking.test.ts` exercising the stacked branch launch feature through the real orchestrateLoop with enableStacking: true. Scenarios: (1) Item B depends on A; while A is in implementing/pr-open, B gets promoted from queued to ready with baseBranch set to ninthwave/A-1, and launches stacked. (2) When A goes stuck, B rolls back to queued with baseBranch cleared. (3) When A's CI recovers from ci-failed to ci-pending, stacked dependent B receives a resume/rebase message.

**Test plan:**
- Assert baseBranch is set on the stacked item when promoted from queued
- Assert launch action includes baseBranch parameter
- Assert rollback to queued when dependency goes stuck (baseBranch cleared)
- Assert rebase/resume message sent to stacked dependent on dep CI recovery
- Verify sync-stack-comments action is emitted when stacked PR opens

Acceptance: All stacking scenarios pass with enableStacking: true. Tests verify the full stacking lifecycle including promotion, rollback, and resume.

Key files: `test/scenario/stacking.test.ts`, `test/scenario/helpers.ts`, `core/orchestrator.ts:636` (canStackLaunch), `core/orchestrator.ts:796` (stuck dep handling)
