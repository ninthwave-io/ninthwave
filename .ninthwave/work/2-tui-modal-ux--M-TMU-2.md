# Fix: Align help overlay copy and modal render regressions (M-TMU-2)

**Priority:** Medium
**Source:** Decomposed from swift-river plan 2026-04-01
**Depends on:** H-TMU-1
**Domain:** tui-modal-ux
**Lineage:** debd69ff-b333-48e0-b50b-71498f9eea1d

Update the help overlay text and render assertions so the visible UI matches the new modal behavior. Change the help dismissal hint to advertise `Enter`, `Escape`, and `?`, add render-priority coverage for help vs controls/detail, and keep any overlay cleanup limited to tiny low-risk adjustments that support the final UX without introducing a larger modal abstraction.

**Test plan:**
- Update status-render tests to assert the new help footer copy and confirm help output still fits the terminal width and height constraints
- Add render assertions for help taking precedence over controls when both flags are set, without changing the existing controls-specific rendering behavior
- Re-run orchestrate and status-render coverage to ensure the visible overlay state matches the keyboard/modal semantics introduced in H-TMU-1

Acceptance: The help overlay copy tells operators exactly how to dismiss it, render coverage locks in the intended help-first overlay priority, and overlay output remains within terminal bounds with no regressions to controls rendering.

Key files: `core/status-render.ts`, `test/status-render.test.ts`, `test/orchestrate.test.ts`
