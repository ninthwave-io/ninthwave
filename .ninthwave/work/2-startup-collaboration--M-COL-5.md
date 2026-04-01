# Fix: Align startup collaboration screens with the local-first contract (M-COL-5)

**Priority:** Medium
**Source:** Decomposed from collaboration controls plan 2026-04-01
**Depends on:** H-COL-1
**Domain:** startup-collaboration

Clean up the startup collaboration surfaces so `tui-widgets`, interactive startup, and onboarding follow the same local-first rules and shared helper behavior as the live controls work. Remove outdated assumptions like ignored connection steps or local-only shortcuts where those paths should now model explicit share/join choices consistently.

**Test plan:**
- Update `runSelectionScreen` and related widget tests so connection steps produce the expected `connectionAction` values instead of assuming the collaboration step is ignored
- Verify interactive startup and onboarding flows still emit the correct watch arguments for share and join while defaulting plain runs to local behavior
- Cover cancellation and invalid-entry paths so the startup surfaces remain predictable after the cleanup

Acceptance: Startup collaboration entry points match the same local-first contract as the rest of the feature. The startup widgets no longer encode obsolete local-only behavior, and onboarding plus interactive startup still map explicit share/join choices correctly.

Key files: `core/tui-widgets.ts`, `core/interactive.ts`, `core/commands/onboard.ts`, `test/tui-widgets.test.ts`, `test/onboard.test.ts`, `test/interactive.test.ts`
