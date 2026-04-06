# Refactor: Discriminated union pilot for state-specific data (M-ARC-7)

**Priority:** Medium
**Source:** Architecture plan -- state machine hardening
**Depends on:** H-ARC-1, M-ARC-5
**Domain:** state-machine
**Lineage:** f212dced-7bde-4f2e-b8d7-48edcf277363

Introduce a `StateDataMap` type in `core/orchestrator-types.ts` that defines state-specific field contracts for the 4 highest-bug-density states: `implementing`, `ci-pending`, `ci-failed`, and `rebasing`. Add a `getStateData<S>()` typed accessor that returns the state-specific fields with correct types (non-optional where guaranteed).

This does NOT change the `OrchestratorItem` interface or storage format. It adds a typed lens over the existing flat structure. Handlers opt-in by calling `getStateData(item, "ci-failed")` to get compile-time proof that `ciFailureNotified` is a `boolean`, not `boolean | undefined`.

Types to define:
- `ImplementingStateData`: workspaceRef (string), worktreePath (string), startedAt (string), lastAliveAt (string?), notAliveCount (number)
- `CiPendingStateData`: ciPendingSince (string?), workspaceRef (string?), worktreePath (string?)
- `CiFailedStateData`: ciFailureNotified (boolean), ciFailureNotifiedAt (string | null), ciNotifyWallAt (string?), failureReason (string), needsCiFix (boolean?)
- `RebasingStateData`: rebaserWorkspaceRef (string?), rebaseAttemptCount (number), rebaseRequested (boolean)

The `getStateData()` function:
- Returns `StateDataMap[S] | undefined`
- Returns undefined if `item.state !== state` (runtime guard)
- Projects the relevant fields from the flat OrchestratorItem with correct types

Update the 4 corresponding handlers in `core/orchestrator.ts` to use `getStateData()` where it improves clarity. This is opt-in -- not every field access needs to go through the accessor.

**Test plan:**
- Unit test `getStateData()`: returns typed data when state matches, returns undefined when state mismatches
- Unit test: verify each StateData interface matches the fields actually set by transition side-effects and handlers
- Verify compile-time: handlers using getStateData get type errors when accessing wrong fields (manual check)
- Run full suite to verify no behavior changes

Acceptance: `StateDataMap` and `getStateData()` exported from `core/orchestrator-types.ts`. 4 state data interfaces defined. At least the 4 corresponding handlers updated to use typed accessor. Full test suite passes with no behavior changes.

Key files: `core/orchestrator-types.ts`, `core/orchestrator.ts` (handleImplementing, handleCiPending, handleCiFailed, handleRebasing)
