# Refactor: Fast startup and watch discovery (H-JIT-1)

**Priority:** High
**Source:** /decompose from `.opencode/plans/1775139451551-mighty-forest.md`
**Depends on:** None
**Domain:** orchestrator-startup
**Lineage:** 41b83c05-d3bb-447c-ab66-352f20923f7a

Remove queue-wide PR pruning from the initial `cmdOrchestrate()` discovery path and from watch rescans. Opening `nw` and moving from controls to the status page should populate from local queue data immediately, without waiting on sequential GitHub checks or mandatory remote refresh before discovery. Keep tracked-item recovery and ongoing PR polling unchanged.

**Test plan:**
- Extend `test/orchestrate.test.ts` to verify startup discovery no longer depends on `loadRunnableStartupItems()` PR pruning before initial queue render.
- Add coverage for watch scan discovery avoiding mandatory `fetchOrigin` and `ffMerge` before enumerating new items.
- Verify startup logging still records discovery changes correctly after the loader swap.
- Edge case: `reconstructState()` and tracked-item polling behavior remain unchanged for in-flight items.

Acceptance: Opening `nw` and watch rescans no longer block on all-item PR pruning before queue discovery. The status page can render from local queue data immediately, and existing recovery/polling behavior for tracked work remains intact.

Key files: `core/commands/orchestrate.ts`, `core/startup-items.ts`, `test/orchestrate.test.ts`
