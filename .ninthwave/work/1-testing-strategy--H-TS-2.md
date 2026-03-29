# Feature: CI failure recovery scenario test (H-TS-2)

**Priority:** High
**Source:** Testing strategy Phase 2
**Depends on:** None
**Domain:** testing-strategy

Write `test/scenario/ci-failure-recovery.test.ts` exercising the full CI failure and recovery loop through the real orchestrateLoop. Scenarios: (1) CI fails, worker pushes a fix commit, CI re-runs and passes, item merges and reaches done. (2) CI fails repeatedly beyond maxCiRetries, item goes stuck. (3) CI fails due to merge conflicts (isMergeable=CONFLICTING), daemon-rebase action is emitted instead of generic CI notification.

**Test plan:**
- Assert state transitions: implementing -> pr-open -> ci-failed -> ci-pending -> ci-passed -> merging -> done
- Assert ciFailCount increments on each failure cycle
- Assert notify-ci-failure action is emitted on first failure
- Assert stuck state when ciFailCount exceeds maxCiRetries
- Assert daemon-rebase action when isMergeable is CONFLICTING

Acceptance: All three recovery/failure scenarios pass using FakeGitHub and FakeMux with the real orchestrateLoop.

Key files: `test/scenario/ci-failure-recovery.test.ts`, `test/scenario/helpers.ts`, `test/fakes/fake-github.ts`, `core/orchestrator.ts:959` (handlePrLifecycle)
