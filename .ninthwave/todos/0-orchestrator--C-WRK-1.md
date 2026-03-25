# Fix: Worker launch race condition — "Start" not submitted (C-WRK-1)

**Priority:** Critical
**Source:** Friction log 2026-03-25 — all 3 workers launched with empty input
**Depends on:** None
**Domain:** orchestrator

The orchestrator launches Claude Code worker sessions via tmux but the initial "Start" message is not reliably delivered. All 3 workers in the 2026-03-25 run (M-OBS-1, L-DOC-2, L-VIS-7) opened with an empty input prompt, requiring manual intervention to type "start" and press enter. L-VIS-7 went unnoticed for 23 minutes.

**Root cause hypothesis:** Race condition in `cmux send` — the "Start" input is sent before Claude Code's input prompt is ready to receive keystrokes. The tmux session exists but Claude Code hasn't fully initialized yet.

**Design:**

1. **Ready detection:** After spawning the Claude Code process, poll the tmux pane content (via `cmux capture` or `tmux capture-pane`) until the input prompt indicator is visible (e.g., the `❯` prompt character or "bypass permissions" text).
2. **Retry with backoff:** If the prompt isn't detected within 2s, retry the ready check every 500ms up to a 30s timeout. Only send "Start" once readiness is confirmed.
3. **Post-send verification:** After sending "Start", verify within 5s that Claude Code is processing (screen content changed from the empty prompt state). If not, retry the send.
4. **Health check integration:** Add a `isWorkerResponsive(itemId)` function that reads the worker's tmux screen and returns a health status. This will be used by both the launch code and the polling loop.

**Implementation:**
- Modify `core/commands/orchestrate.ts` (or the worker launch function) to add ready-wait before `cmux send`.
- Add `core/worker-health.ts` with screen-parsing utilities for detecting worker state.
- The polling loop should also call `isWorkerResponsive()` on each tick for workers in "implementing" state — if a worker hasn't produced new output in N minutes, flag it.

**Acceptance:** Workers reliably start without manual intervention. A new integration test launches a mock worker, verifies "Start" is delivered, and confirms health-check detection of stalled workers.

**Test plan:**
- Unit test ready-detection parsing (mock tmux capture output for various states: loading, prompt visible, already processing)
- Unit test retry/backoff logic with timeout
- Unit test `isWorkerResponsive()` with mock screen content (active, stalled, error states)
- Integration test: launch → verify start → confirm processing (if feasible in test env)

Key files: `core/commands/orchestrate.ts`, `core/worker-health.ts`, `test/worker-health.test.ts`
