# Feat: Add displayItemsSummary and promptMode to interactive.ts (H-NX-1)

**Priority:** High
**Source:** Dogfood friction #28 -- confusing Run selected vs Watch all UX
**Depends on:** None
**Domain:** cli-ux

Add two new functions to `core/interactive.ts` for the redesigned `nw` no-args flow:

1. `displayItemsSummary(todos: TodoItem[])` -- renders a read-only numbered list of available work items with priority coloring and dependency info. No selection prompt -- this is display-only context for the user before they choose a mode. Reuse the display logic from `promptItems()` (priority sorting, color coding, dep display) but without the input loop.

2. `promptMode(prompt: PromptFn)` -- prompts the user to choose between "Orchestrate" (default, press Enter) and "Launch subset". Returns `"orchestrate" | "launch" | "quit"`. Orchestrate is the happy path -- daemon mode with auto-merge and monitoring for all items. Launch subset is the escape hatch for targeted work. Follow the same input loop pattern as `promptAction()` in onboard.ts (validate, retry on invalid).

**Test plan:**
- Test `promptMode` returns `"orchestrate"` on input "1" and on empty input (default)
- Test `promptMode` returns `"launch"` on input "2" and text "launch"
- Test `promptMode` returns `"quit"` on "q"
- Test `promptMode` retries on invalid input
- Test `displayItemsSummary` output contains item IDs, titles, and priority labels

Acceptance: Both functions are exported from `core/interactive.ts`. `displayItemsSummary` renders items sorted by priority with color coding. `promptMode` defaults to "orchestrate" on empty input. All new tests pass. Existing interactive tests remain green.

Key files: `core/interactive.ts`, `test/interactive.test.ts`
