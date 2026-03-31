# Feat: Replace split screen with two-page layout (H-TI-5)

**Priority:** High
**Source:** TUI improvements plan 2026-03-31
**Depends on:** None
**Domain:** tui-pages

Remove the `"split"` panel mode from the TUI, leaving only `"status-only"` and `"logs-only"` as two full-screen pages. Tab toggles between them. Make up/down arrow keys context-aware: on the status page they navigate items, on the logs page they scroll logs (replacing the current j/k-only log scrolling). Keep j/k as aliases on the logs page for backward compatibility. Remove the `MIN_SPLIT_ROWS` and `STATUS_SPLIT_RATIO` constants and all split-panel rendering logic.

Implementation notes:
- Update `PanelMode` type to remove `"split"`
- In `tui-keyboard.ts`, Tab cycles between two modes instead of three
- In up/down handlers, check `tuiState.panelMode` -- if `"logs-only"`, scroll logs; if `"status-only"`, navigate items
- Remove `renderPanelFrame` split layout code path in `status-render.ts`
- Remove `MIN_SPLIT_ROWS` (35 rows threshold) and `STATUS_SPLIT_RATIO` (0.6)
- Update help overlay text to reflect new controls (up/down works on both pages)
- Default panel mode should be `"status-only"` (was `"split"` for large terminals)

**Test plan:**
- Update `tui-keyboard.test.ts` panel mode cycling tests: verify Tab toggles between exactly two modes
- Add test verifying up/down scrolls logs when `panelMode === "logs-only"`
- Add test verifying up/down navigates items when `panelMode === "status-only"`
- Update `status-render.test.ts` to remove split-panel rendering tests, add full-screen log page tests
- Verify j/k still work as log scroll aliases on logs page
- Verify help overlay text no longer mentions split view

Acceptance: Tab toggles between full-screen status and full-screen logs pages (no split). Up/down navigates items on status page and scrolls logs on logs page. j/k still scroll logs on the logs page. `"split"` panel mode no longer exists in the codebase. Help overlay reflects the new two-page layout. Default panel mode is `"status-only"`.

Key files: `core/tui-keyboard.ts`, `core/status-render.ts`, `core/commands/orchestrate.ts`
