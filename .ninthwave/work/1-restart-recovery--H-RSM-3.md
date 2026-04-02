# Fix: Prompt before relaunching unresolved restarted workers (H-RSM-3)

**Priority:** High
**Source:** Spec `.opencode/plans/1775151454012-playful-planet.md`
**Depends on:** H-RSM-2
**Domain:** restart-recovery
**Lineage:** 508a74a2-e2a7-4cfc-be07-a60b6fd07440

Handle unresolved restarted implementation workers before the main orchestration loop can spawn duplicates. Interactive mode should prompt the operator to relaunch or hold the item, while non-interactive mode should hold and log instead of silently respawning. Include status rendering coverage so held restart items are obvious in operator views.

**Test plan:**
- Extend `test/orchestrate.test.ts` or `test/orchestrator-unit.test.ts` to cover unresolved restart items choosing relaunch vs hold and the resulting state transitions
- Extend `test/status-render.test.ts` to verify held restart items show a clear restart-specific reason in status output
- Add `test/system/watch-recovery.test.ts` coverage proving restart reattaches live workers and prompts instead of duplicating when the workspace is gone

Acceptance: On restart, unresolved implementation workers are handled before duplicate launches can occur. Interactive operators can choose to relaunch or hold each unresolved item, non-interactive startup does not silently respawn it, and status output clearly indicates when a restarted item is being held for operator action.

Key files: `core/commands/orchestrate.ts`, `core/status-render.ts`, `core/prompt.ts`, `test/orchestrate.test.ts`, `test/orchestrator-unit.test.ts`, `test/status-render.test.ts`, `test/system/watch-recovery.test.ts`
