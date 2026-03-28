# Status pane only shows current item, not full queue

**Date:** 2026-03-25
**Severity:** medium
**Component:** status pane / `ninthwave status --watch`

## Observation

`ninthwave status --watch` only displays the currently implementing item (e.g., M-OBS-1). Queued items (L-DOC-2, L-VIS-7) are not shown. The status pane should display the entire queue with states so the user can see overall progress at a glance.

## Expected behavior

Show all items in the orchestration run with their current state (queued, implementing, ci-pending, merged, done, stuck).

## Additional observations

- The output is also mangled/garbled -- formatting issues beyond just missing items.
- Need integration testing around the status pane functionality to catch rendering bugs and verify the full queue is displayed correctly.

## Impact

User has to check the orchestrator logs to understand overall progress. The status pane should be the single source of truth for "what's happening."
