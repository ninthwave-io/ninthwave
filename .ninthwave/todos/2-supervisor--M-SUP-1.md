# Fix: Supervisor LLM call failing silently — log errors and add backoff (M-SUP-1)

**Priority:** Medium
**Source:** Friction log (grind cycle 1, 2026-03-25)
**Depends on:** -
**Domain:** supervisor

Every supervisor tick during grind cycle 1 batch 3 logged `"status":"llm_call_failed"` with no error details. The supervisor degrades to a no-op silently — anomaly detection and automatic friction logging don't work.

## Changes

1. **Log the actual error** — capture and include the error message/type from the failed LLM call in the supervisor tick log (timeout, auth error, rate limit, model not available, etc.).

2. **Add exponential backoff** — after N consecutive failures (e.g., 3), increase the supervisor interval (e.g., double it) up to a max. After M consecutive failures (e.g., 10), disable the supervisor for the rest of the run and log a warning.

3. **Verify API access** — check that the supervisor's LLM call uses valid credentials. It may need the same API key as the main orchestrator process, or it may be hitting a rate limit from parallel workers.

## Acceptance

- Supervisor tick logs include the error message when LLM call fails
- After 3 consecutive failures, supervisor interval doubles
- After 10 consecutive failures, supervisor disables with a warning
- Successful calls reset the backoff counter

## Test plan

- Unit test: verify backoff behavior (mock LLM call failures)
- Unit test: verify error message appears in log
- Unit test: verify supervisor disables after max consecutive failures

## Key files

- `core/commands/orchestrate.ts` — supervisor tick logic
- `core/supervisor.ts` — if separate module exists
