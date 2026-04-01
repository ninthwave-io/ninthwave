# Feat: Add live controls collaboration input state (H-COL-2)

**Priority:** High
**Source:** Decomposed from collaboration controls plan 2026-04-01
**Depends on:** H-COL-1
**Domain:** tui-collaboration-input

Extend the live controls overlay state so `Share`, `Join`, and `Local` are real runtime intents instead of label-only mode flips. This item should add the `TuiState` fields and keyboard behavior needed for join-input mode, inline busy/error state, submit/cancel handling, and callback hooks, but it should not own broker or network behavior.

**Test plan:**
- Add `setupKeyboardShortcuts` coverage for entering collaboration join mode from the controls overlay and for mirroring the new state onto `viewOptions` where needed
- Cover printable input, backspace, Enter submit, and Escape cancel precedence while the controls overlay is in join-input mode
- Verify `Share`, `Join`, and `Local` selections invoke the right callback paths without regressing existing review, merge, or WIP controls behavior

Acceptance: The controls overlay can enter and exit a join-input sub-state entirely inside the TUI. Keyboard editing and submit/cancel behavior are deterministic and covered by tests. The runtime callback contract is ready for orchestration work without mixing in broker side effects here.

Key files: `core/tui-keyboard.ts`, `test/tui-keyboard.test.ts`
