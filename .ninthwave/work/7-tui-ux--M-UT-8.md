# Fix: Align dependency sub-line under blocker icon column (M-UT-8)

**Priority:** Medium
**Source:** Dogfood friction 2026-03-28
**Depends on:** None
**Domain:** tui-ux

The `formatBlockerSubline` function hardcodes a 4-space indent for dependency indicators (`└ H-UT-3`), placing them at column 0. They should align under the `⧗` blocker icon column of the parent row for visual consistency.

Update `formatBlockerSubline` to accept the column offset (computed from ID width + state column + duration + daemon column widths) and pad the `└` indicator to that position. Update all call sites in `formatStatusTable()` and `formatDetailedStatusLines()` to pass the computed offset.

**Test plan:**
- Update test/status-render.test.ts: add test for sub-line alignment matching `⧗` column position
- Test with varying state column widths (short states like "Queued" vs long like "CI Pending (#123)")
- Test with and without daemon column (crew mode on/off)

Acceptance: The `└` dependency indicator aligns directly under the `⧗` icon in the parent row across all display modes. `bun test test/` passes.

Key files: `core/status-render.ts`, `test/status-render.test.ts`
