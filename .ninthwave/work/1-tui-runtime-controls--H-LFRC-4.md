# Feat: Add live controls for collaboration, reviews, merge, and WIP (H-LFRC-4)

**Priority:** High
**Source:** docs/local-first-runtime-controls-spec.md
**Depends on:** H-LFRC-2, H-LFRC-3
**Domain:** tui-runtime-controls

Add a lightweight runtime controls surface to the live status UI so operators can change collaboration mode, AI review mode, merge strategy, and WIP after startup. Reuse existing runtime setters where possible, add missing collaboration and WIP hooks, document the controls in the help overlay, and wire direct `+` and `-` shortcuts to adjust WIP without opening a separate startup screen.

**Test plan:**
- Extend `test/tui-keyboard.test.ts` or add focused coverage for the new shortcuts, including `+` and `-` WIP changes and opening/dismissing the controls surface.
- Extend `test/status-render.test.ts` to verify the main status view and help overlay advertise the runtime controls and local/share/join terminology.
- Add integration coverage in orchestrate/TUI tests that runtime changes call `setMergeStrategy()`, toggle review gating, update collaboration state, and persist WIP changes through the user-config path.

Acceptance: The live status page exposes discoverable controls for collaboration, reviews, and merge policy, plus direct `+` and `-` WIP adjustment. Changing any control updates the running daemon immediately, and WIP changes persist while review/merge/collaboration choices remain per-run.

Key files: `core/tui-keyboard.ts`, `core/status-render.ts`, `core/commands/orchestrate.ts`, `core/orchestrator.ts`, `test/status-render.test.ts`
