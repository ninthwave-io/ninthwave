# Replace startup confirmation with arrow-driven settings screen (H-TUI-2)

**Priority:** High
**Source:** Decomposed from approved TUI settings UX improvements plan 2026-04-01
**Depends on:** H-TUI-1
**Domain:** tui-settings

Upgrade the startup confirmation flow in the TUI from a static summary plus yes/no confirm into an interactive settings screen. After item/tool selection, the user should land on a screen where the item summary stays visible, all setting choices are shown horizontally, `up/down` moves between rows, `left/right` changes the current row value, `Enter` confirms, and `Escape` cancels.

Thread the persisted defaults from the foundation item into this screen so merge strategy, review mode, collaboration mode, and WIP start from the user’s last saved settings instead of always showing local/manual/off defaults. Persist the chosen values on successful confirmation only. Keep the change scoped to the startup selection flow; do not yet change the live controls overlay in this item.

If collaboration values already map to later startup intent handling, preserve that path. Do not expand scope into new join-code entry UX unless the existing startup flow already has a natural handoff for it.

**Test plan:**
- Add widget tests for row navigation with `up/down` and value changes with `left/right`
- Add tests for `Enter` confirm and `Escape` / `Ctrl-C` cancel behavior on the startup settings screen
- Add tests that the selected settings values are returned from `runSelectionScreen()`
- Add tests that persisted defaults preselect the expected startup values
- Run `bun test test/`

Acceptance: The startup TUI no longer requires numeric shortcuts or a plain yes/no confirm screen. Users can review and change merge, review, collaboration, and WIP settings directly with arrows, confirm with `Enter`, cancel with `Escape`, and see persisted defaults preselected on the next run.

Key files: `core/tui-widgets.ts`, `core/interactive.ts`, `core/commands/orchestrate.ts`, `test/tui-widgets.test.ts`, `test/interactive.test.ts`
