# Feat: Render paused overlay and teach the shortcut model (H-TPAU-2)

**Priority:** High
**Source:** Spec `.opencode/plans/1775081194442-witty-star.md`
**Depends on:** H-TPAU-1
**Domain:** pause-ui
**Lineage:** dcb7f6b1-ac27-4cd3-a7c1-59f348f8c929

Add a dedicated paused overlay that matches the existing TUI modal style and makes the execution state obvious at a glance. Update help and footer copy so operators can discover the layered `Esc` behavior, the explicit `p` shortcut, and the quit hint without needing to guess how to leave the paused state.

**Test plan:**
- Add `test/status-render.test.ts` coverage for `renderPausedOverlay(...)`, including centered paused text and the `Esc/p resume` plus `q quit` hints
- Verify footer and help copy include the new pause-resume affordances without breaking existing width and truncation expectations
- Verify paused render precedence assumptions stay compatible with the existing full-screen overlay helpers

Acceptance: The TUI can render a paused overlay that is visually consistent with the existing boxed overlays and clearly explains resume and quit actions. Help and footer text advertise the pause-resume shortcuts in a way that fits existing layout constraints and does not regress the current overlay copy.

Key files: `core/status-render.ts`, `test/status-render.test.ts`
