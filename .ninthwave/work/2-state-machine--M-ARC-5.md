# Refactor: Consolidate grace period and timeout constants (M-ARC-5)

**Priority:** Medium
**Source:** Architecture plan -- opportunistic simplifications
**Depends on:** H-ARC-2
**Domain:** state-machine
**Lineage:** ea82f55a-cdb9-44df-a79e-c17a6a701b31

Group the 8+ scattered timeout and grace period constants into a documented structure in `core/orchestrator-types.ts`. Currently these values are defined in multiple locations with no documentation of their rationale or how they interact:

- `MERGE_CI_GRACE_MS` (60s) -- orchestrator.ts:65
- `NO_CI_MERGE_GRACE_MS` (15s) -- orchestrator.ts:68
- `HEARTBEAT_TIMEOUT_MS` (5min) -- orchestrator-types.ts:524
- `CI_PENDING_FAIL_GRACE_MS` (60s) -- orchestrator-types.ts:534
- `CI_FIX_ACK_TIMEOUT_MS` (2min) -- orchestrator-types.ts:530
- `LAUNCHING_TIMEOUT_MS` (5min) -- orchestrator-types.ts:537
- `config.gracePeriodMs` (5min) -- orchestrator-types.ts:171
- `config.rebaseRetryStaleMs` (15min) -- orchestrator-types.ts:158

Create a `TIMEOUTS` namespace or const object that groups these by concern (worker liveness, CI verification, merge pipeline, rebase) with JSDoc explaining why each value was chosen and which guards (from H-ARC-2's orchestrator-guards.ts) consume them. Update all references across orchestrator.ts, orchestrator-types.ts, and orchestrator-guards.ts.

**Test plan:**
- Run full suite (`bun run test`) to verify all constant references updated correctly
- Verify no hardcoded timeout values remain outside the consolidated structure (grep for the old constant names)
- Verify guard functions in orchestrator-guards.ts reference the new grouped constants

Acceptance: All timeout/grace period constants grouped into a single documented structure. JSDoc explains rationale and interactions. All references updated. No orphaned constants. Full test suite passes.

Key files: `core/orchestrator-types.ts`, `core/orchestrator.ts`, `core/orchestrator-guards.ts`
