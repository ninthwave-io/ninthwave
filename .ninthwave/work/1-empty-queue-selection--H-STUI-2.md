# Feat: Add an empty-queue selection flow with Future tasks and tool choice (H-STUI-2)

**Priority:** High
**Source:** Decompose approved startup and status TUI flow for empty queues
**Depends on:** H-STUI-1
**Domain:** empty-queue-selection

Extend the interactive startup flow so zero current work items still opens a real selection screen instead of returning `null`. The empty-queue screen should present a synthetic `Future tasks` option, preserve the existing AI tool selection step when multiple tools are available, and return an explicit result that means "arm future work" rather than overloading the current `allSelected` behavior.

**Test plan:**
- Add widget tests for zero-item rendering, confirming the synthetic `Future tasks` option, and preserving the AI tool step
- Add interactive-flow tests for the new result shape and cancellation behavior in the empty-queue path
- Verify non-empty selection behavior and existing `__ALL__` semantics do not regress

Acceptance: Running the interactive flow with zero items shows a usable selection screen, allows the user to confirm `Future tasks`, still asks for AI tool choice when required, and returns a stable explicit flag for future-only startup.

Key files: `core/tui-widgets.ts`, `core/interactive.ts`, `test/tui-widgets.test.ts`, `test/interactive.test.ts`
