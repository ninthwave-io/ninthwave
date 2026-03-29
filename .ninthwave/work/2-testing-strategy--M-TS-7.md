# Feature: buildSnapshot contract tests (M-TS-7)

**Priority:** Medium
**Source:** Testing strategy Phase 3
**Depends on:** None
**Domain:** testing-strategy

Write `test/contract/build-snapshot.test.ts` testing the buildSnapshot function directly (not through the orchestrate loop) with injected checkPr, getLastCommitTime, fetchComments, and checkCommitCI functions. Verify the PollSnapshot output matches expected ItemSnapshot fields for each orchestrator state and external status combination. This tests the snapshot-building logic that is currently only exercised through scenario tests.

**Test plan:**
- Test queued items: verify readyIds computed correctly based on dependency resolution
- Test implementing items: verify workerAlive from FakeMux, lastCommitTime from injected function
- Test PR lifecycle items: verify prNumber, ciStatus, prState, isMergeable, eventTime from checkPr output
- Test verifying items: verify mergeCommitCIStatus from checkCommitCI
- Test heartbeat reading: verify lastHeartbeat populated for active states
- Edge case: checkPr returns null (no-pr) -- snapshot should have no prNumber/ciStatus

Acceptance: buildSnapshot is tested directly for every major state combination, independent of the orchestrate loop.

Key files: `test/contract/build-snapshot.test.ts`, `core/commands/orchestrate.ts:514` (buildSnapshot), `test/fakes/fake-mux.ts`, `test/fakes/fake-github.ts`
