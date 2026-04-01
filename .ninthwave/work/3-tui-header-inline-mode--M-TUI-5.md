# Move fullscreen live mode indicator onto the title line only (M-TUI-5)

**Priority:** Medium
**Source:** Decomposed from approved TUI settings UX improvements plan 2026-04-01
**Depends on:** H-TUI-3
**Domain:** tui-controls

Adjust the fullscreen live orchestrate TUI header so `local · reviews off` appears inline on the top title line next to `Ninthwave` instead of as a separate second line. Keep this change tightly scoped: non-fullscreen status-table rendering and other status views should retain their existing layout unless they are explicitly part of the fullscreen live orchestrate path.

Introduce the smallest render flag or view option needed so the fullscreen live TUI can opt into the inline title treatment without mutating the shared status/table layout everywhere. Preserve existing inline connection-status behavior and session metrics formatting.

**Test plan:**
- Add render tests proving fullscreen live layout inlines the mode indicator on the title line
- Add regression tests proving non-fullscreen status/table output does not adopt the new inline mode treatment
- Verify existing title/metrics/crew inline rendering tests still pass
- Run `bun test test/`

Acceptance: In the fullscreen live orchestrate TUI, the mode indicator is inline with `Ninthwave` on the title line. Other status views remain unchanged, and existing connection-status/metrics layout still renders correctly.

Key files: `core/status-render.ts`, `core/commands/orchestrate.ts`, `test/status-render.test.ts`
