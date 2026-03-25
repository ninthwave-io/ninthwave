# Supervisor didn't detect stalled workers (empty input)

**Date:** 2026-03-25
**Severity:** high
**Component:** supervisor / worker health monitoring

## Observation

The LLM supervisor ticked every 5 minutes and reported "ok" with zero anomalies, zero friction — while all 3 workers were stalled with empty inputs waiting for manual "start" entry. The supervisor should have detected that workers in "implementing" state had no activity on their screens.

## Root cause hypothesis

The supervisor likely checks orchestrator state (item transitions, PR status) but does not read worker screens. It sees "implementing" and assumes progress. Without screen-level health checks, it can't distinguish "actively coding" from "idle at empty prompt."

## Suggested fix

1. **Deterministic screen health check:** The daemon (not just the supervisor) should periodically read worker tmux screens and parse them to determine health. Check for: empty input (stalled), error messages, permission prompts waiting for input, no output change over N minutes.
2. **Worker heartbeat:** Workers could write a heartbeat file that the daemon checks. No heartbeat update in N minutes = stalled.
3. **Supervisor screen reading:** If using the LLM supervisor, feed it actual screen content so it can detect anomalies like empty prompts.

## Impact

High — the supervisor is supposed to be the safety net for unattended runs. If it can't detect the most common failure mode (worker never started), it provides a false sense of security.
