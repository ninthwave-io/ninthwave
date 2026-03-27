# Feat: Add setStatus and setProgress to Multiplexer interface (H-HB-2)

**Priority:** High
**Source:** Plan: Worker Heartbeat System (2026-03-27)
**Depends on:** None
**Domain:** worker-heartbeat

Add `setStatus(ref, key, text, icon, color)` and `setProgress(ref, value, label?)` methods to the `Multiplexer` interface in `core/mux.ts`. Implement them in `CmuxAdapter` by delegating to new functions in `core/cmux.ts` that shell out to `cmux set-status` and `cmux set-progress`.

The `setStatus` method wraps: `cmux set-status <key> <text> --icon <icon> --color <color> --workspace <ref>`
The `setProgress` method wraps: `cmux set-progress <value> --label <label> --workspace <ref>`

Both methods are best-effort -- return boolean success but callers should not fail on false. The workspace ref (e.g., "workspace:1") targets a specific workspace.

**Test plan:**
- Unit test: `CmuxAdapter.setStatus` calls cmux with correct args (mock shell runner)
- Unit test: `CmuxAdapter.setProgress` calls cmux with correct args, omits --label when not provided
- Unit test: both methods return false on non-zero exit code
- Verify Multiplexer interface compiles with new methods (TypeScript type check)

Acceptance: `Multiplexer` interface has `setStatus` and `setProgress` methods. `CmuxAdapter` implements them via `cmux set-status` and `cmux set-progress` CLI calls. Tests pass.

Key files: `core/mux.ts`, `core/cmux.ts`, `test/mux.test.ts`
