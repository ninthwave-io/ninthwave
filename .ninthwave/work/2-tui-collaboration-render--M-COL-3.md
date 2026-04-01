# Feat: Render live collaboration details in the controls overlay (M-COL-3)

**Priority:** Medium
**Source:** Decomposed from collaboration controls plan 2026-04-01
**Depends on:** H-COL-2
**Domain:** tui-collaboration-render

Teach the controls overlay to show the collaboration information users expect once runtime actions exist: active session code, join command, join input field, and inline busy/error messaging. Keep the current visual style and terminal-width constraints intact so the overlay still behaves like the rest of the TUI on narrow and full-width terminals.

**Test plan:**
- Add pure `renderControlsOverlay` assertions for shared-session code display, join prompt rendering, and inline busy/error text using `stripAnsi` where appropriate
- Verify layout invariants still hold for terminal width and row limits after the collaboration section gains extra lines
- Cover narrow-terminal truncation or wrapping behavior so session details remain readable and the overlay does not break existing controls rendering

Acceptance: The controls overlay visibly explains what happens after `Share` and `Join`. Shared and joined states surface the current code and join command, join mode shows an input field, and failure/loading text renders without breaking existing layout guarantees.

Key files: `core/status-render.ts`, `test/status-render.test.ts`
