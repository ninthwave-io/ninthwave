# Refactor: Remove metrics panel and help option, add session duration to title (H-SC-2)

**Priority:** High
**Source:** Dogfooding observation 2026-03-28
**Depends on:** None
**Domain:** status-cleanup

The metrics panel (`m` key) duplicates the Lead/Thru already shown in the top right, and the help
option (`?` key) just repeats the shortcut labels visible in the footer. Remove both toggles and
their associated rendering. Add session duration to the top-right title metrics as `Session: Xm`
alongside the existing Lead and Thru values. Update the footer shortcuts string from
`q quit  m metrics  d deps  up/down scroll  ? help` to `q quit  d deps  up/down scroll`. Remove
`showMetrics` and `showHelp` from ViewOptions, delete `formatMetricsPanel()` and
`formatHelpFooter()` as dead code.

**Test plan:**
- Update `test/status-render.test.ts`: remove tests for formatMetricsPanel (6 tests), formatHelpFooter (1 test), showMetrics toggle (2 tests), showHelp toggle (2 tests)
- Add/update tests for `formatTitleMetrics` to verify session duration appears in the right-aligned metrics string (e.g., "Lead: 45s  Thru: 8.2/hr  Session: 12m")
- Verify buildStatusLayout and formatStatusTable no longer reference showMetrics or showHelp
- Update `test/status.test.ts` non-TTY test that checks "Session Metrics" is absent -- remove that assertion since the panel no longer exists at all

Acceptance: Pressing `m` or `?` in the TUI does nothing. Footer shows `q quit  d deps  up/down scroll` only. Top-right title line includes `Session: Xm` when session duration is available. `formatMetricsPanel` and `formatHelpFooter` are deleted. ViewOptions no longer has `showMetrics` or `showHelp` fields. Tests pass.

Key files: `core/status-render.ts:29-31`, `core/status-render.ts:707-742`, `core/status-render.ts:1148`, `core/status-render.ts:1321-1337`, `core/commands/orchestrate.ts:1642-1649`, `core/commands/status.ts:339-346`, `test/status-render.test.ts`, `test/status.test.ts`
