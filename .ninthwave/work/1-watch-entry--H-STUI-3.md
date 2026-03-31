# Feat: Enter watch directly in local mode from the future-only flow (H-STUI-3)

**Priority:** High
**Source:** Decompose approved startup and status TUI flow for empty queues
**Depends on:** H-STUI-1, H-STUI-2
**Domain:** watch-entry

Teach `watch` and `orchestrate` how to start from an empty queue after the user has already confirmed setup decisions. The future-only path should enter the Ninthwave page immediately in local mode, skip the startup arming window, show an armed waiting-state empty message, and automatically launch the first new work item without another prompt round.

**Test plan:**
- Add orchestrate tests for zero initial items entering watch without rerunning interactive selection
- Add scenario coverage proving the first newly discovered item launches without extra prompts
- Verify the arming window is skipped for this path and the armed empty-state copy renders in the TUI

Acceptance: After confirming the future-only startup flow, `nw` lands directly in the active Ninthwave TUI in local mode, shows an armed waiting empty state, and starts newly added work items without asking the user the same setup questions again.

Key files: `core/commands/orchestrate.ts`, `core/commands/status.ts`, `core/status-render.ts`, `test/orchestrate.test.ts`, `test/scenario/watch-mode.test.ts`, `test/status-render.test.ts`
