# Feat: Shift+Tab merge-mode cycling hint in footer (H-TI-1)

**Priority:** High
**Source:** TUI improvements plan 2026-03-31
**Depends on:** None
**Domain:** tui-footer

Add a `(shift+tab to cycle)` hint to the TUI footer, positioned after the strategy badge. The footer currently reads `> auto . c controls . ? help` -- update it to include the cycling hint so users know about the Shift+Tab shortcut without opening the help overlay.

**Test plan:**
- Add test in `status-render.test.ts` verifying footer output contains "shift+tab to cycle" text
- Verify the hint renders correctly for all three strategy modes (auto, manual, bypass)
- Verify the hint does not overflow on minimum terminal width (80 cols)

Acceptance: Footer line in the TUI shows `(shift+tab to cycle)` after the strategy badge. Help overlay still mentions Shift+Tab (already present, verify not broken). Footer fits within 80-column terminal width.

Key files: `core/status-render.ts`
