# Feature: FakeWorker scenario driver (H-TS-1)

**Priority:** High
**Source:** Testing strategy Phase 2
**Depends on:** None
**Domain:** testing-strategy

Build `test/fakes/fake-worker.ts` -- a script-driven worker simulator that advances FakeMux screen content and FakeGitHub PR state on a per-cycle schedule. Given a sequence of events (e.g., "cycle 2: show spinner, cycle 4: create PR on branch ninthwave/X"), it hooks into the orchestrateLoop sleep function to drive the simulation automatically. This replaces the manual per-test sleep overrides used in Phase 1 tests.

**Test plan:**
- Unit test FakeWorker independently: given a script, verify it calls FakeMux.setScreen and FakeGitHub.createPR at the correct cycles
- Verify FakeWorker integrates with the existing scenario helpers (buildLoopDeps)
- Edge case: script with no events should be a no-op

Acceptance: FakeWorker can be instantiated with a script of timed events and drives FakeMux + FakeGitHub state changes per poll cycle. At least one existing scenario test is refactored to use it as proof of integration.

Key files: `test/fakes/fake-worker.ts`, `test/fakes/fake-github.ts`, `test/fakes/fake-mux.ts`, `test/scenario/helpers.ts`
