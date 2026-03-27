# Refactor: Replace screen-scraping health detection with heartbeat-based detection (H-HB-4)

**Priority:** High
**Source:** Plan: Worker Heartbeat System (2026-03-27)
**Depends on:** H-HB-3
**Domain:** worker-heartbeat

Replace the fragile screen-scraping health detection in `handleImplementing` with heartbeat-based detection. Currently the orchestrator reads cmux screen content, regex-matches spinner characters and keywords (PROCESSING_INDICATORS, PROMPT_INDICATORS, ERROR_INDICATORS) to guess if a worker is alive. This is brittle and produces false positives/negatives.

Clean cut: remove `workerHealth` from `ItemSnapshot` and all screen-scraping health logic from the orchestrator's implementing handler. Replace with heartbeat recency check -- a heartbeat within 5 minutes means the worker is healthy. Keep `workerAlive` (cmux workspace listing check) as a lightweight binary alive signal, but remove `getWorkerHealthStatus` screen parsing from the snapshot path.

The `worker-health.ts` module stays for launch readiness detection (`waitForInputPrompt`, `sendWithReadyWait`) which is still needed for initial message delivery. Only remove the health-polling usage in `buildSnapshot` and `handleImplementing`.

Update stuck detection in `handleImplementing`:
- Old: `notAliveCount` + screen health + commit timeouts
- New: heartbeat recency (< 5 min = healthy) + `workerAlive` (workspace exists) + commit timeouts as final backstop

**Test plan:**
- Unit test: worker with recent heartbeat (< 5 min) is not marked stuck even with no commits
- Unit test: worker with stale heartbeat (> 5 min) and no recent commits transitions to stuck
- Unit test: worker with no heartbeat file falls back to commit-based timeout detection
- Unit test: `workerHealth` field no longer appears in ItemSnapshot
- Verify existing stuck detection tests are updated to use heartbeat-based logic

Acceptance: The orchestrator uses heartbeat recency as the primary health signal for implementing workers. Screen-scraping (`getWorkerHealthStatus`) is no longer called during the poll loop. `workerHealth` is removed from `ItemSnapshot`. Workers that heartbeat regularly are never falsely marked stuck. Tests pass.

Key files: `core/orchestrator.ts`, `core/commands/orchestrate.ts`, `core/worker-health.ts`, `test/orchestrator-unit.test.ts`
