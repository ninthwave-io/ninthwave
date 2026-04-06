# Refactor: Runtime transition enforcement (H-ARC-1)

**Priority:** High
**Source:** Architecture plan -- state machine hardening
**Depends on:** None
**Domain:** state-machine
**Lineage:** 484b3640-3eec-4310-81cd-0dd6536edc1a

Add runtime validation to the `Orchestrator.transition()` method that enforces the existing `STATE_TRANSITIONS` table on every state change. Currently the table is declarative documentation validated only by tests -- handlers can transition to undeclared states silently. With enforcement, illegal transitions throw immediately at the point of error.

Steps:
1. Audit all ~50 `this.transition()` calls in `core/orchestrator.ts` against the `STATE_TRANSITIONS` table in `core/orchestrator-types.ts:578-597`. The exploration found zero violations, but verify each one and fix any table gaps discovered.
2. Add validation logic to `transition()` (at `core/orchestrator.ts:291`) that checks `STATE_TRANSITIONS[item.state].includes(state)` before allowing the transition. On violation, emit via `config.onEvent` and throw an Error.
3. Ensure `hydrateState()` (line 209) remains bypass-only for reconstruction -- it must NOT validate against the table since reconstruction sets state from external truth.
4. Update tests to verify enforcement: add a test that attempts an illegal transition and asserts the throw. Verify existing test suite still passes (no test triggers an undeclared transition).

**Test plan:**
- Add unit test in `test/orchestrator-unit.test.ts`: attempt transition from "done" to "implementing" and assert Error thrown
- Add unit test: verify `hydrateState()` does NOT throw for any state (reconstruction bypass)
- Run full suite (`bun run test`) to confirm zero existing tests trigger illegal transitions
- Verify the `onEvent` callback fires with "illegal-transition" event data

Acceptance: `transition()` throws on any state change not listed in `STATE_TRANSITIONS`. `hydrateState()` remains unconstrained. Full test suite passes. No changes to handler logic -- only the enforcement gate added.

Key files: `core/orchestrator.ts:291`, `core/orchestrator-types.ts:578-597`, `test/orchestrator-unit.test.ts`
