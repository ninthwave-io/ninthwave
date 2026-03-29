# Feature: Golden file tests for TUI output (L-TS-11)

**Priority:** Low
**Source:** Testing strategy Phase 5
**Depends on:** None
**Domain:** testing-strategy

Write golden file tests in `test/golden/` that snapshot TUI output for visual regression detection. Build a set of representative orchestrator states (empty, all-queued, mixed-states, all-done, stuck-items) and capture the rendered output from renderStatusTable and renderTuiPanelFrame. Compare against .expected files stored alongside the tests. Use the existing injectable write functions in status-render.ts to capture output to strings.

**Test plan:**
- Capture renderStatusTable output for 4-5 representative orchestrator states
- Compare against golden .expected files (fail on diff)
- Test with different terminal widths (80, 120 columns)
- Include a test that intentionally updates golden files when run with an env flag (e.g., UPDATE_GOLDEN=1)
- Edge case: items with long titles or many dependencies should not break formatting

Acceptance: Golden file tests pass for all representative states. Running with UPDATE_GOLDEN=1 regenerates .expected files.

Key files: `test/golden/status-table.test.ts`, `test/golden/*.expected`, `core/status-render.ts`, `core/commands/orchestrate.ts`
