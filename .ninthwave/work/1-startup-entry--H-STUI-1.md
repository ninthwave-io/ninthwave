# Refactor: Reorder no-args startup around an armed empty state (H-STUI-1)

**Priority:** High
**Source:** Decompose approved startup and status TUI flow for empty queues
**Depends on:** None
**Domain:** startup-entry

Refactor the `nw` no-args startup path so it no longer blocks in the pre-watch `Waiting for work items...` loop before doing anything else. `cmdNoArgs()` should detect an initialized repo, handle daemon routing first, and treat the zero-item case as an explicit startup branch that can continue into setup and watch entry instead of a dead-end polling loop.

**Test plan:**
- Extend `test/onboard.test.ts` to cover zero items with a running daemon, zero items without a daemon, and non-empty startup remaining unchanged
- Verify the old wait-loop path is not the first landing point for initialized repos with no work items
- Cover help-path regressions for non-TTY and non-git invocations

Acceptance: `cmdNoArgs()` no longer blocks in the old zero-item polling loop before daemon/status routing. Initialized repos with zero work items can continue into the new empty-queue startup flow, while daemon-running repos still route straight to status.

Key files: `core/commands/onboard.ts`, `core/cli.ts`, `test/onboard.test.ts`
