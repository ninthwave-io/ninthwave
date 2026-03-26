# Fix: Fail fast when multiplexer is unavailable or misconfigured (H-MFV-1)

**Priority:** High
**Source:** Dogfood friction — orchestrator ran 20+ min in stuck state with misleading errors
**Depends on:**
**Domain:** mux

## Context

When `--mux zellij` is passed but no zellij session is active, the orchestrator doesn't fail fast. Instead it launches all workers, they all fail with a misleading "cmux launch failed" error (hardcoded regardless of mux type), items go through retry → stuck cycle, and the supervisor eventually escalates — but 10+ minutes have passed with zero useful output.

Root causes:
1. No pre-flight mux availability check in `cmdOrchestrate` after `getMux()` — line ~1878 of orchestrate.ts
2. `ZellijAdapter.isAvailable()` only checks `zellij --version` (binary exists), not whether there's an active session (`ZELLIJ_SESSION_NAME` set)
3. Error message in `start.ts` hardcodes "cmux" regardless of actual mux type
4. `TmuxAdapter.isAvailable()` should similarly check `$TMUX`

## Requirements

1. Add pre-flight mux validation in `cmdOrchestrate` immediately after `getMux()`:
   - Call `mux.isAvailable()` — if false, `die()` with a clear message naming the mux type and what's missing
   - For zellij: "No active zellij session found. Run ninthwave orchestrate from inside a zellij session."
   - For tmux: similar check for `$TMUX` env var
   - For cmux: verify `cmux ping` succeeds
2. Improve `ZellijAdapter.isAvailable()` to also verify `ZELLIJ_SESSION_NAME` is set (not just binary present)
3. Fix the hardcoded "cmux" in `start.ts` — use the actual mux type name in error messages
4. Add tests proving fail-fast behavior for each mux type

Acceptance: Running `ninthwave orchestrate --mux zellij` outside a zellij session exits within 1 second with a descriptive error. Error messages reference the correct mux type. Tests prove fail-fast behavior.

**Test plan:** Unit test `ZellijAdapter.isAvailable()` returns false when `ZELLIJ_SESSION_NAME` is unset. Unit test `TmuxAdapter.isAvailable()` returns false when `$TMUX` is unset. Unit test orchestrator exits early when mux is unavailable. Test error message includes correct mux type name. Edge case: `NINTHWAVE_MUX=zellij` set but zellij binary not installed (should fail with "zellij not found" not "no session").

Key files: `core/mux.ts`, `core/commands/orchestrate.ts`, `core/commands/start.ts`
