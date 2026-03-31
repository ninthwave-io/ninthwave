# Feat: Mode change re-evaluates review-pending items (H-TI-6)

**Priority:** High
**Source:** TUI improvements plan 2026-03-31
**Depends on:** H-TI-4
**Domain:** tui-mode-reevaluate

After the debounce timer from H-TI-4 settles and the new merge strategy is applied, ensure all items currently in `review-pending` state are re-evaluated on the next poll cycle. Specifically, when switching from manual to auto, items with passed CI and approved review should transition to `merging` and trigger a merge action. When switching from auto to manual, items already in `review-pending` should remain there (this is already the natural behavior).

Implementation notes:
- Verify that the orchestrate loop's poll cycle calls `evaluateMerge()` for items already in `review-pending`, not just on initial transition
- If `evaluateMerge()` is only called on state transitions, add logic to re-trigger it for all `review-pending` items when `config.mergeStrategy` changes
- The `onStrategyChange` callback (which fires after debounce settles) can set a flag that causes the next poll to force re-evaluation
- Be careful with the bypass case: bypass should also trigger re-evaluation but with the `admin: true` merge flag

**Test plan:**
- Add test in `orchestrator-unit.test.ts`: switch manual to auto with items in `review-pending` that have CI passed + review approved -- verify they transition to `merging`
- Add test: switch auto to manual -- verify `review-pending` items stay in `review-pending`
- Add test: switch to bypass with `review-pending` items -- verify `admin: true` merge action
- Add test: switch manual to auto but item has `CHANGES_REQUESTED` review -- verify it stays in `review-pending`
- Verify no double-merge: items already in `merging` are not re-queued for merge

Acceptance: Switching from manual to auto causes eligible `review-pending` items (CI passed, review approved) to auto-merge on the next poll cycle. Switching to manual does not auto-merge anything. Items with `CHANGES_REQUESTED` review stay in `review-pending` regardless of mode. No duplicate merge actions are produced.

Key files: `core/orchestrator.ts`, `core/commands/orchestrate.ts`
