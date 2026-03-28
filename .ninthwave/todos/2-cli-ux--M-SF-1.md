# Refactor: Compact status footer and use right-side space (M-SF-1)

**Priority:** Medium
**Source:** UX review of ninthwave status TUI (2026-03-28)
**Depends on:** None
**Domain:** cli-ux

The status TUI footer has 3 lines that all convey merged/active counts redundantly: `formatBatchProgress` ("Progress: 5 merged, 3 implementing"), `formatSummary` ("Total: 8 items, 5 merged, 3 active"), and `formatCompactMetrics` ("checkmark 5 merged, arrow 3 active, Lead: 7m, Thru: 20.9/hr"). Collapse these into a single unified progress line that uses icons + detailed state breakdown (like Progress) + right-aligned total count. Move Lead/Thru metrics to the header title line (right-aligned) to use the empty right-side space.

Before (footer):
```
Progress: 5 merged, 3 implementing
Total: 8 items, 5 merged, 3 active
checkmark 5 merged  arrow 3 active  Lead: 7m  Thru: 20.9/hr
q quit  m metrics  d deps  ...  Refresh: 5s
```

After (footer):
```
checkmark 5 merged  arrow 2 implementing  1 ci-pending          8 items
q quit  m metrics  d deps  ...  Refresh: 5s
```

After (header):
```
ninthwave status                              Lead: 7m  Thru: 20.9/hr
```

Implementation:
1. Add `formatUnifiedProgress(items, termWidth)` -- single line with icon-prefixed state counts left-aligned, total count right-aligned. Uses state ordering and colors from `formatBatchProgress`, icon style from `formatCompactMetrics`.
2. Add `formatTitleMetrics(items, termWidth, sessionStartedAt?)` -- returns title line with right-aligned Lead/Thru metrics (dimmed). Falls back to plain title when no metrics or terminal too narrow (< 60 chars).
3. Update `buildStatusLayout()` (~line 1146) to use `formatTitleMetrics()` for header title.
4. Update `buildStatusLayout()` footer (lines 1221-1231) to replace the 3 calls with single `formatUnifiedProgress()`.
5. Update `formatStatusTable()` legacy path (~lines 927-947) with same consolidation.
6. Keep old functions exported (used in tests). Update tests: add tests for new functions, update `buildStatusLayout` output expectations.

**Test plan:**
- Add unit tests for `formatUnifiedProgress`: empty items, all merged, mixed active states, single active state, with queued items, right-aligned total count
- Add unit tests for `formatTitleMetrics`: with metrics, without metrics, narrow terminal fallback
- Verify `buildStatusLayout` footer output has 1 progress line instead of 3
- Verify existing `formatBatchProgress`/`formatSummary`/`formatCompactMetrics` tests still pass (functions kept, just not called from layout)
- Run full test suite: `bun test test/`

Acceptance: `buildStatusLayout()` footer contains exactly 1 progress line (not 3). Title line shows right-aligned Lead/Thru when metrics are available. Footer saves 2 vertical lines. All tests pass.

Key files: `core/status-render.ts`, `test/status-render.test.ts`, `test/status.test.ts`
