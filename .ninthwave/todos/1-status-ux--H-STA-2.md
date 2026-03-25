# Fix: Reuse status pane on daemon restart (H-STA-2)

**Priority:** High
**Source:** Status & daemon UX improvements (2026-03-25)
**Depends on:** none
**Domain:** status-ux

Prevent duplicate status panes when the daemon restarts by persisting the status pane ref in the daemon state file and closing the old pane before launching a new one.

Changes to `core/daemon.ts`:
1. Add `statusPaneRef?: string | null` to `DaemonState` interface
2. Add `extras?: { statusPaneRef?: string | null; wipLimit?: number }` param to `serializeOrchestratorState` and spread into the returned state

Changes to `core/commands/orchestrate.ts`:
1. Add `closeStaleStatusPane(mux, projectRoot)` — reads old state file, closes `statusPaneRef` if present
2. Call `closeStaleStatusPane` before `launchStatusPane` in daemon startup
3. Remove the dead `listWorkspaces().includes(STATUS_PANE_NAME)` check from `launchStatusPane` (it never matches)
4. Thread `statusPaneRef` through the `onPollComplete` closure so it persists in the state file each poll cycle

Changes to `test/orchestrate.test.ts`:
- Test `closeStaleStatusPane`: given mock state file with ref, verify `mux.closeWorkspace` called
- Test `closeStaleStatusPane`: no state file or missing ref → no-op
- Update/remove test for the dead `includes(STATUS_PANE_NAME)` check

**Test plan:**
- Verify old status pane is closed before new one is launched
- Verify no-op when no old state file or no statusPaneRef in state
- Verify statusPaneRef is persisted in state file after poll
- `bun test test/` — all tests pass

Acceptance: Starting the daemon when a previous status pane exists closes the old pane and opens a fresh one. No duplicate panes accumulate across daemon restarts.

Key files: `core/daemon.ts`, `core/commands/orchestrate.ts`, `test/orchestrate.test.ts`
