# Feature: Stuck detection scenario test (H-TS-3)

**Priority:** High
**Source:** Testing strategy Phase 2
**Depends on:** None
**Domain:** testing-strategy

Write `test/scenario/stuck-detection.test.ts` exercising worker death and retry logic through the real orchestrateLoop. Scenarios: (1) Worker dies during implementing (FakeMux.setAlive(ref, false)), notAliveCount debounce triggers, retry succeeds and item recovers. (2) Worker dies and retry is exhausted (maxRetries reached), item goes stuck with failureReason set. (3) Worker dies during launching state, same debounce and retry logic applies.

**Test plan:**
- Assert notAliveCount increments across consecutive not-alive polls
- Assert retry action is emitted and retryCount increments
- Assert stuck state with correct failureReason when retries exhausted
- Assert debounce: single not-alive poll does NOT trigger stuck (requires NOT_ALIVE_THRESHOLD consecutive polls)
- Verify workspace-close action is emitted on stuck transition

Acceptance: All three stuck detection scenarios pass. Tests use FakeMux.setAlive(ref, false) to simulate worker death.

Key files: `test/scenario/stuck-detection.test.ts`, `test/scenario/helpers.ts`, `test/fakes/fake-mux.ts`, `core/orchestrator.ts:724` (launching state), `core/orchestrator.ts:834` (handleImplementing)
