# Feat: Debounced mode switching with visual indicator (H-TI-4)

**Priority:** High
**Source:** TUI improvements plan 2026-03-31
**Depends on:** None
**Domain:** tui-debounce

Add a 5-second debounce to merge strategy changes. When the user cycles the strategy via Shift+Tab or number keys (7/8/9), do not immediately call `orch.setMergeStrategy()`. Instead, store a `pendingStrategy` in `TuiState` and start/reset a debounce timer. Show a visual indicator in the footer during the debounce window (e.g. the strategy badge shows `auto -> manual (5s...)`). When the timer fires without further changes, apply the strategy via `orch.setMergeStrategy()` and clear the pending state. If the user presses Shift+Tab again during the window, reset the timer with the new selection.

Implementation notes:
- Add `pendingStrategy?: MergeStrategy` and `pendingStrategyTimer?: ReturnType<typeof setTimeout>` to `TuiState`
- In the Shift+Tab and number key handlers, set `pendingStrategy` and reset the timer instead of immediately applying
- Update `strategyIndicator()` or footer rendering to show the pending transition
- The `onStrategyChange` callback should only fire when the debounce timer completes
- Timer cleanup in the keyboard cleanup function

**Test plan:**
- Add test in `tui-keyboard.test.ts` verifying Shift+Tab sets `pendingStrategy` but does NOT call `onStrategyChange` immediately
- Add test verifying rapid Shift+Tab resets the timer (only final strategy is applied)
- Add test verifying `onStrategyChange` fires after debounce period
- Add test in `status-render.test.ts` verifying footer shows pending transition indicator
- Verify timer is cleared on cleanup

Acceptance: Merge strategy changes via Shift+Tab and number keys are debounced by 5 seconds. Rapid cycling only applies the final selection. Footer shows a visual indicator during the debounce window. `orch.setMergeStrategy()` is called once after the debounce settles. Timer is cleaned up when TUI exits.

Key files: `core/tui-keyboard.ts`, `core/status-render.ts`, `core/commands/orchestrate.ts`
