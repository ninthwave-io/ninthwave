# Fix: Make help a true modal and centralize modal transitions (H-TMU-1)

**Priority:** High
**Source:** Decomposed from swift-river plan 2026-04-01
**Depends on:** None
**Domain:** tui-modal-ux
**Lineage:** 46158a01-35f0-45bd-8410-913ab25d316b

Make the help overlay behave like a real modal in the TUI so background shortcuts stop mutating app state while help is visible. Add a dedicated help-capture path in `setupKeyboardShortcuts(...)`, allow only `Enter`, `Escape`, or `?` to dismiss help, and route help/controls open-close rules through shared local helpers instead of scattered flag mutations. Keep global quit behavior intact and keep controls as a separate interactive modal.

**Test plan:**
- Add keyboard tests covering help dismissal via `Enter`, `Escape`, and `?`, plus swallowed keys for navigation, detail-open, blocker detail, timeout extension, panel mode, and WIP changes while help is open
- Verify `q` and double `Ctrl+C` still quit when help is visible, and that controls still behave normally after leaving help
- Add orchestrate-level coverage that opening help blocks underlying selection/detail changes and that modal precedence still prefers help over controls/detail

Acceptance: Opening help prevents background keybindings from changing selection, scrolling, panel mode, blocker detail, WIP, timeout state, or detail panels. While help is open, only `Enter`, `Escape`, and `?` dismiss it, and quit behavior still works globally. Controls remain interactive and one-overlay-at-a-time rules still hold.

Key files: `core/tui-keyboard.ts`, `core/commands/orchestrate.ts`, `test/tui-keyboard.test.ts`, `test/orchestrate.test.ts`
