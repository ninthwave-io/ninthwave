# Fix: Status pane shows only current item, not full queue, with mangled output (M-STA-1)

**Priority:** Medium
**Source:** Friction log 2026-03-25 — status pane missing queued items and garbled rendering
**Depends on:** None
**Domain:** cli

`ninthwave status --watch` only displays the currently implementing item. Queued items are not shown. Additionally, the output formatting is mangled/garbled — columns don't align properly and text overlaps.

**Design:**

1. **Show full queue:** The status pane should display ALL items in the orchestration run with their current state (queued, launching, implementing, ci-pending, ci-passed, merging, merged, done, stuck).
2. **Fix output rendering:** Investigate and fix the column alignment and text rendering issues. Likely a terminal width calculation or ANSI escape sequence issue.
3. **State indicators:** Use clear visual indicators for each state (e.g., spinner for implementing, checkmark for done, X for stuck, clock for queued).

**Acceptance:** `ninthwave status --watch` displays all items in the current run with correct states, proper column alignment, and no garbled output.

**Test plan:**
- Unit test status output rendering with various queue sizes (1, 3, 6+ items)
- Unit test column alignment at different terminal widths
- Unit test state indicator rendering for each state
- Integration test: run status during orchestration, verify all items appear with correct states

Key files: `core/commands/status.ts`, `test/status.test.ts`
