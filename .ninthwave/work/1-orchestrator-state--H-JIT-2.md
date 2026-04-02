# Refactor: Add blocked terminal state semantics (H-JIT-2)

**Priority:** High
**Source:** /decompose from `.opencode/plans/1775139451551-mighty-forest.md`
**Depends on:** H-JIT-1
**Domain:** orchestrator-state
**Lineage:** ca48f934-f430-4e00-b846-92d166b4997f

Introduce an explicit `blocked` state for items that should not launch right now. This state must be terminal for the current run, excluded from WIP, skipped by snapshot polling, persisted in daemon state, and resettable through `retry`. Land the state plumbing first so launch-time validation can use it cleanly in the next item.

**Test plan:**
- Add coverage in `test/orchestrator.test.ts` or `test/orchestrator-unit.test.ts` for `blocked` behaving as a terminal non-WIP state.
- Extend `test/retry.test.ts` to verify blocked items can be reset to `queued` and clear failure metadata correctly.
- Add snapshot coverage that blocked items are skipped like other terminal states and do not keep the run alive.
- Edge case: blocked items must be excluded from crew sync and completion accounting without changing existing `done` or `stuck` behavior.

Acceptance: `blocked` is recognized by orchestrator, daemon persistence, snapshot polling, run-complete checks, and retry flow. Blocked items do not consume WIP, do not keep the daemon running, and can be reset cleanly by operators.

Key files: `core/orchestrator-types.ts`, `core/orchestrator.ts`, `core/snapshot.ts`, `core/commands/orchestrate.ts`, `core/commands/retry.ts`, `core/daemon.ts`
