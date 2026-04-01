# Feat: Add pause runtime and keyboard control plumbing (H-TPAU-1)

**Priority:** High
**Source:** Spec `.opencode/plans/1775081194442-witty-star.md`
**Depends on:** None
**Domain:** pause-runtime
**Lineage:** c07c64cc-c0b8-498c-8229-4653912c1dd7

Add the canonical paused state and the control path that toggles it from the interactive watch TUI. Extend the watch engine runner control protocol and runtime snapshots so pause state round-trips cleanly, and update `setupKeyboardShortcuts(...)` so `Escape` still dismisses existing overlays first but pauses from the base dashboard and resumes from the paused overlay. Keep `p` as an explicit pause-resume shortcut and preserve existing quit behavior.

**Test plan:**
- Add `test/tui-keyboard.test.ts` coverage for root-level `Escape` pause, paused-overlay `Escape` resume, `p` toggle, and dismiss-first precedence when help, controls, or detail are open
- Add runtime control coverage that pause state is emitted in snapshots and stays in sync between keyboard handlers and the engine-side control path
- Verify `q` and double `Ctrl+C` still quit while paused or while the new pause key path is active

Acceptance: The interactive watch runtime has a canonical paused flag that can be toggled through the existing control path. `Escape` continues to close help, controls, detail, and join input first, but pauses when the operator is on the base dashboard and resumes from the paused overlay. `p` also pauses and resumes, and quit behavior remains unchanged.

Key files: `core/watch-engine-runner.ts`, `core/tui-keyboard.ts`, `test/tui-keyboard.test.ts`, `test/orchestrate.test.ts`
