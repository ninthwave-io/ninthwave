# Make startup and strategy countdowns visibly reach 0s (M-TUI-4)

**Priority:** Medium
**Source:** Decomposed from approved TUI settings UX improvements plan 2026-04-01
**Depends on:** H-TUI-3
**Domain:** tui-controls

Fix both TUI countdown surfaces so they visibly hit `0s` instead of stopping early or showing a static placeholder. The startup arming banner should count down through `0s` before it resolves to local startup. The pending merge strategy footer should stop rendering `old -> new (5s...)` and instead show only the new strategy plus a live countdown suffix, e.g. `auto (5s)` down through `auto (0s)`, after which the suffix disappears once the debounce completes.

Reuse the existing rerender plumbing rather than introducing a new render architecture. Add any deadline/tick state needed for the pending strategy debounce to update once per second, and keep pause/join/share behavior intact for the startup arming window.

**Test plan:**
- Update arming banner tests to assert the countdown reaches `0s`
- Add tests for the once-per-second startup countdown tick sequence including `0s`
- Add footer render tests asserting pending strategy text uses only the new strategy label plus countdown
- Add keyboard/debounce tests proving the pending strategy countdown updates and clears after apply
- Run `bun test test/`

Acceptance: Both countdowns visibly reach `0s`, the startup arming banner still resolves correctly for pause/join/share/local behavior, and the pending merge strategy UI shows only the new strategy label with a live countdown that disappears after apply.

Key files: `core/commands/orchestrate.ts`, `core/tui-keyboard.ts`, `core/status-render.ts`, `test/orchestrate.test.ts`, `test/tui-keyboard.test.ts`, `test/status-render.test.ts`
