# Convert runtime controls overlay to row-based arrow navigation (H-TUI-3)

**Priority:** High
**Source:** Decomposed from approved TUI settings UX improvements plan 2026-04-01
**Depends on:** H-TUI-1
**Domain:** tui-controls

Refactor the live runtime controls overlay so it uses the same row-based interaction model as the new startup settings screen. Remove the current number-key selection behavior entirely. While controls are open, `up/down` should move between setting rows, `left/right` should change the selected row value, `Enter` should dismiss the overlay, and `Escape` should dismiss it as well. Keep all choices visible horizontally in the overlay.

Back the overlay renderer and keyboard handler from the shared settings metadata introduced in the foundation item. Add row-cursor state to `TuiState`, highlight the active row distinctly from the active value, and persist user-driven setting changes to user config as they are applied. Preserve current scope for collaboration changes in the live overlay: update the displayed/persisted default only, without inventing new live broker-connect semantics.

**Test plan:**
- Replace numeric-shortcut keyboard tests with row-navigation tests for `up/down`, `left/right`, `Enter`, and `Escape`
- Add render tests proving the controls overlay shows horizontal choices and an active row highlight
- Add tests that setting changes call the existing callbacks and persist the updated defaults
- Run `bun test test/`

Acceptance: The runtime controls overlay is fully arrow-driven, numeric shortcuts are gone, dismissal works with `Enter` and `Escape`, the active row is visible in the renderer, and merge/review/collaboration/WIP changes update both the live state and the persisted user defaults within the current scope.

Key files: `core/tui-keyboard.ts`, `core/status-render.ts`, `core/commands/orchestrate.ts`, `core/config.ts`, `test/tui-keyboard.test.ts`, `test/status-render.test.ts`
