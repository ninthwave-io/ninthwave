# Refactor: Strip cost tracking from orchestrator and analytics (H-CT-2)

**Priority:** High
**Source:** Manual review 2026-03-30
**Depends on:** None
**Domain:** telemetry

Remove the screen-scraping cost capture pipeline from the orchestrator and all cost-related analytics. `parseCostSummary()` regex-matches "Total tokens: X" from terminal output, which is fragile and unreliable. The `costData` map, `CostSummary` type, cost aggregation in `collectRunMetrics()`, and cost display in `nw analytics` all depend on this unreliable data. Also remove `inputTokens`/`outputTokens` from the `session_ended` crew broker report.

**Test plan:**
- Remove `parseCostSummary` test suite from `test/analytics.test.ts` (~99 lines)
- Remove cost aggregation tests from `test/analytics.test.ts`
- Remove `cost_captured` event assertions
- Remove cost display tests in `test/orchestrate.test.ts` (formatExitSummary, formatCompletionBanner)
- Run `bun test test/analytics.test.ts test/orchestrate.test.ts`

Acceptance: `parseCostSummary` function and `CostSummary` type deleted. `costData` map removed from orchestrate loop. Cost fields removed from `ItemMetric`, `RunMetrics`, `AnalyticsSummary` types. `nw analytics` no longer shows cost/token sections. `session_ended` report no longer includes `inputTokens`/`outputTokens`. Five function signatures updated to remove `costData` parameter. `bun test test/` passes.

Key files: `core/analytics.ts:126`, `core/commands/orchestrate.ts:965`, `core/commands/analytics.ts:384`, `test/analytics.test.ts:717`, `test/orchestrate.test.ts`
