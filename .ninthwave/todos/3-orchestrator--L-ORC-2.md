# Fix: readScreen output mislabeled as "Permanently stuck" for merged items (L-ORC-2)

**Priority:** Low
**Source:** Friction log (grind cycle 1, 2026-03-25)
**Depends on:** -
**Domain:** orchestrator

The `executeClean` method in `core/orchestrator.ts` reads the screen and logs "Permanently stuck. Screen output: ..." for all items being cleaned, including successfully merged ones. This is misleading — the log should only use the "stuck" label when the item is actually stuck.

## Changes

1. In `executeClean`, check `item.state` before logging. Only use "Permanently stuck" for items in `stuck` state.
2. For merged/done items, either skip screen reading entirely or use a neutral label like "Worker finished".

## Acceptance

- Merged items don't get "Permanently stuck" in the log
- Stuck items still get the diagnostic readScreen output
- Tests pass

## Key files

- `core/orchestrator.ts` — executeClean method
