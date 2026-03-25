# Feat: Supervisor screen-level health monitoring (H-SUP-1)

**Priority:** High
**Source:** Friction log 2026-03-25 — supervisor reported "ok" while all workers were stalled
**Depends on:** C-WRK-1
**Domain:** orchestrator

The LLM supervisor ticked every 5 minutes and reported zero anomalies while all 3 workers sat at empty prompts. The supervisor needs access to worker screen content to detect the most common failure mode: workers that never started processing.

**Design:**

1. **Feed screen content to supervisor:** On each supervisor tick, capture the last N lines of each active worker's tmux pane and include them in the supervisor's context alongside the orchestrator state summary.
2. **Deterministic pre-check (daemon-level):** Before the LLM supervisor runs, the daemon itself should do a fast deterministic check: for each "implementing" worker, read the screen and check for known failure patterns:
   - Empty prompt (no tool calls, no output beyond system prompt)
   - Permission prompt waiting for user input
   - Error/crash messages
   - No output change in last 2 ticks (stalled)
3. **Anomaly escalation:** If the daemon detects a stalled worker, it should:
   - Log a friction observation automatically
   - Attempt to resend "Start" (once)
   - If still stalled after retry, mark the item as "stuck" with reason

**Implementation:**
- Use `isWorkerResponsive()` from C-WRK-1 in the daemon's main polling loop (not just at launch time).
- Add screen content to the supervisor tick payload so the LLM can catch subtler anomalies (e.g., worker stuck in a loop, repeatedly failing the same test).
- Supervisor anomaly detection should emit `supervisor_anomaly` events with the screen context that triggered it.

**Acceptance:** Supervisor detects a worker with empty input within one tick cycle (~11s polling) and either fixes it (resend Start) or flags it as stuck. Integration test: launch worker, block the Start send, verify supervisor detects and escalates within 2 ticks.

**Test plan:**
- Unit test daemon-level deterministic health check (mock screen states)
- Unit test supervisor tick payload includes screen content
- Unit test anomaly escalation flow (stalled → resend → still stalled → stuck)

Key files: `core/commands/orchestrate.ts`, `core/supervisor.ts`, `core/worker-health.ts`
