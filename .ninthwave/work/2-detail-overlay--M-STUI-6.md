# Feat: Make the item detail overlay a scrollable inspection surface (M-STUI-6)

**Priority:** Medium
**Source:** Decompose approved startup and status TUI flow for empty queues
**Depends on:** M-STUI-5
**Domain:** detail-overlay

Upgrade the item detail overlay so it can show a description snippet or full body inside a wrapped, scrollable region instead of only fixed metadata rows. While the overlay is open, keyboard handling should scroll detail content rather than moving the underlying list selection, and the overlay should still preserve the existing metadata, escape-to-close behavior, and tmux/worktree hints.

**Test plan:**
- Add detail-overlay rendering tests for wrapped description text, empty descriptions, and long bodies that exceed terminal height
- Add keyboard tests proving arrow or paging keys scroll detail content while the overlay is active
- Verify closing the overlay restores normal list navigation and does not corrupt selection state

Acceptance: Opening item detail shows description content in a readable scrollable region, long content can be navigated inside the overlay, and closing the overlay returns the user to the underlying status list without losing state.

Key files: `core/status-render.ts`, `core/tui-keyboard.ts`, `test/status-render.test.ts`, `test/tui-keyboard.test.ts`
