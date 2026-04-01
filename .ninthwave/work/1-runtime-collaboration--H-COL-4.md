# Feat: Wire live controls to runtime collaboration actions (H-COL-4)

**Priority:** High
**Source:** Decomposed from collaboration controls plan 2026-04-01
**Depends on:** H-COL-1, H-COL-2
**Domain:** runtime-collaboration

Extract small reusable helpers from the existing startup share/join flow so the live controls overlay can create sessions, join by code, reuse an already-shared session, and disconnect back to local mode during a running watch session. Keep startup arming behavior intact, push failures back into the new overlay state instead of dropping out of TUI mode, and avoid clearing saved crew code when returning to local mode.

**Test plan:**
- Add orchestrate coverage for live `Share` creating a crew, connecting the broker, updating session state, and reusing the same code on repeated share selections
- Add live `Join` tests for valid and invalid codes, including failure surfacing without crashing the TUI and without tearing down the previous session on a rejected join
- Add live `Local` tests proving the current broker disconnects cleanly, runtime crew state clears, and startup arming/share behavior still passes after helper extraction

Acceptance: Selecting `Share`, `Join`, or `Local` from the running controls overlay performs the real collaboration action for that run. Runtime collaboration updates the broker and TUI state immediately, repeated share reuses the active code, invalid joins stay in-TUI, and startup behavior remains unchanged.

Key files: `core/commands/orchestrate.ts`, `core/crew.ts`, `test/orchestrate.test.ts`
