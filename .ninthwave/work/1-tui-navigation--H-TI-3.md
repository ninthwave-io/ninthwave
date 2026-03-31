# Feat: Allow navigation to queued items (H-TI-3)

**Priority:** High
**Source:** TUI improvements plan 2026-03-31
**Depends on:** None
**Domain:** tui-navigation

Remove the `state !== "queued"` filter from `getSelectedItemId()` and `getItemCount()` in `orchestrate.ts` so up/down arrow keys can reach queued items in the status table. Update `buildPanelLayout` in `status-render.ts` to resolve `selectedIndex` against all items, not just non-queued. The detail panel (Enter/i) should work for queued items, showing id, title, priority, and dependency information.

**Test plan:**
- Add test in `orchestrate.test.ts` verifying `getItemCount` includes queued items
- Add test verifying `getSelectedItemId` returns queued item IDs at correct indices
- Add test in `status-render.test.ts` verifying `buildPanelLayout` highlights queued items when selected
- Verify detail overlay renders correctly for a queued item (shows dependencies, no PR info)

Acceptance: Up/down navigation reaches queued items in the status table. Enter/i on a queued item opens the detail panel showing item metadata and dependencies. Selected item highlighting works for queued rows. Index bounds are correct when all items (active + queued) are included.

Key files: `core/commands/orchestrate.ts`, `core/status-render.ts`
