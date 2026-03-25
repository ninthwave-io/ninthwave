# Workers start with empty input — "Start" not submitted

**Date:** 2026-03-25
**Severity:** critical
**Component:** worker launch / `cmux send`

## Observation

All three workers (M-OBS-1, L-DOC-2, L-VIS-7) launched Claude Code sessions but the initial "Start" message was not typed and submitted. Claude Code opened with the system prompt loaded but an empty input — the user had to manually type "start" and press enter each time.

Likely a race condition: the session is launched and the orchestrator sends "Start" via `cmux send` before the Claude Code input is ready to receive it.

## Expected behavior

Workers should reliably receive and process the "Start" input without manual intervention. The daemon should verify that the worker actually started processing (not just that the tmux session exists).

## Suggested fix

1. Add a ready-check: after launching, poll the worker screen to confirm Claude Code's input prompt is visible before sending "Start."
2. Daemon should deterministically parse worker screens more frequently to detect health issues (empty input = worker stalled).
3. The supervisor should have caught this — it ticked "ok" with no anomalies while all 3 workers were stalled waiting for manual input.

## Impact

Critical — without manual intervention, workers sit idle indefinitely. This defeats the purpose of autonomous orchestration. The L-VIS-7 worker went unnoticed for 23 minutes.
