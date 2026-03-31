# Feat: Hide bypass in controls overlay when unavailable (H-TI-2)

**Priority:** High
**Source:** TUI improvements plan 2026-03-31
**Depends on:** None
**Domain:** tui-controls

In the controls overlay (opened with `c`), the `[9] Bypass` merge strategy option is currently rendered dimmed when `--dangerously-bypass` was not passed. Instead, do not render it at all when `bypassEnabled` is false. The Shift+Tab cycle already excludes bypass when not enabled -- this makes the controls overlay consistent with that behavior.

**Test plan:**
- Update test in `status-render.test.ts` for `renderControlsOverlay` verifying bypass line is absent when `bypassEnabled` is false
- Add test verifying bypass line IS present when `bypassEnabled` is true
- Verify number key `9` in `tui-keyboard.test.ts` is a no-op when bypass is hidden

Acceptance: Controls overlay does not show `[9] Bypass` when `bypassEnabled` is false. When `bypassEnabled` is true, `[9] Bypass` renders normally. No behavioral change to Shift+Tab cycling (already correct).

Key files: `core/status-render.ts`
