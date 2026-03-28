# Refactor: Rewire cmdNoArgs to mode-first flow (H-NX-2)

**Priority:** High
**Source:** Dogfood friction #28 -- confusing Run selected vs Watch all UX
**Depends on:** H-NX-1
**Domain:** cli-ux

Rewrite the `cmdNoArgs()` flow in `core/commands/onboard.ts` to use the new mode-first UX:

**Current flow:** promptItems (select items) -> promptAction (run/watch) -> branch
**New flow:** displayItemsSummary (read-only) -> promptMode (orchestrate/launch) -> branch

When "orchestrate" is chosen:
- Prompt for merge strategy using existing `promptMergeStrategy()`
- Prompt for WIP limit using existing `promptWipLimit()`
- Call `cmdWatch` with `["--items", ...allItemIds, "--merge-strategy", strategy, "--wip-limit", String(wipLimit)]` so it skips `runInteractiveFlow` entirely (shouldEnterInteractive returns false when items are provided)

When "launch" is chosen:
- Call existing `promptItems()` for item selection
- Call `cmdRunItems()` with selected IDs (WIP limit enforcement already exists from commit a6276d0)

Update the `NoArgsDeps` interface:
- Replace `promptAction` with `promptMode` (new return type `"orchestrate" | "launch" | "quit"`)
- Add `displayItemsSummary` injection point
- Keep `promptItems` (still used in launch subset path)

Remove `promptAction()` function (replaced by `promptMode` in interactive.ts).

**Test plan:**
- Test orchestrate path: calls cmdWatch with all item IDs, merge strategy, and WIP limit as CLI args
- Test launch subset path: calls promptItems then cmdRunItems with selected IDs
- Test default orchestrate on empty input at mode prompt
- Test early exit at mode prompt ("q")
- Test early exit at item selection in launch subset path
- Verify no double-prompting -- orchestrate path never calls promptItems

Acceptance: `nw` (no args) shows items as read-only summary, then offers Orchestrate (default) vs Launch subset. Orchestrate passes all items + strategy + WIP limit to cmdWatch without re-prompting. Launch subset prompts for item selection then launches. All onboard tests updated and passing. `promptAction()` removed from onboard.ts.

Key files: `core/commands/onboard.ts`, `test/onboard.test.ts`
