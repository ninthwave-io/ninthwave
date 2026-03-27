# Feat: Orchestrator reads heartbeats and syncs cmux sidebar display (H-HB-3)

**Priority:** High
**Source:** Plan: Worker Heartbeat System (2026-03-27)
**Depends on:** H-HB-1, H-HB-2
**Domain:** worker-heartbeat

Wire heartbeats into the orchestrator's poll loop. In `buildSnapshot`, read heartbeat files for active items and add `lastHeartbeat` to `ItemSnapshot`. After processing transitions, sync cmux display by calling `mux.setStatus()` and `mux.setProgress()` on each active worker's workspace.

Add a `statusDisplayForState(state)` function that maps orchestrator states to cmux status pill properties (text, icon, color). The mapping matches the status table rendering in `core/status-render.ts`:
- implementing -> "Implementing" / hammer.fill / #b45309
- ci-pending -> "CI Pending" / clock.fill / #06b6d4
- ci-failed -> "CI Failed" / xmark.circle / #ef4444
- ci-passed -> "CI Passed" / checkmark.circle / #22c55e
- review-pending -> "In Review" / eye.fill / #7c3aed
- merging -> "Merging" / arrow.triangle.merge / #22c55e
- done -> "Done" / checkmark.seal.fill / #22c55e
- stuck -> "Stuck" / exclamationmark.triangle / #ef4444

Progress bar: use worker-reported progress/label for implementing and ci-failed states. For post-PR states (ci-pending, ci-passed, merging), set progress to 1.0 with a contextual label ("CI running", "Awaiting review", "Merging").

Clean up heartbeat files in `executeClean` when items reach terminal states.

**Test plan:**
- Unit test: `buildSnapshot` populates `lastHeartbeat` from heartbeat file
- Unit test: `buildSnapshot` handles missing heartbeat file gracefully (null)
- Unit test: `statusDisplayForState` returns correct text/icon/color for each state
- Unit test: heartbeat file is deleted during `executeClean`
- Unit test: `syncWorkerDisplay` calls `mux.setStatus` and `mux.setProgress` with correct args

Acceptance: When a worker writes a heartbeat file, the orchestrator reads it on the next poll cycle and updates the cmux sidebar with the state pill and progress bar. Heartbeat files are cleaned up when items complete. Tests pass.

Key files: `core/commands/orchestrate.ts`, `core/orchestrator.ts`, `test/orchestrator-unit.test.ts`, `test/orchestrate.test.ts`
