# Fix: cmux progress scale -- send 0.0-1.0 not 0-100 (H-SC-1)

**Priority:** High
**Source:** Dogfooding observation 2026-03-28
**Depends on:** None
**Domain:** status-cleanup

cmux expects `set-progress` values in the 0.0-1.0 range, but `syncWorkerDisplay()` multiplies
heartbeat progress by 100 before sending. This causes cmux to display raw decimal values (e.g.,
"0.1") instead of a proper progress bar. Fix by passing the heartbeat decimal through directly
and updating the "done" sentinel from 100 to 1. Update all JSDoc comments that say "0-100" to
"0.0-1.0".

**Test plan:**
- Update `test/orchestrator-unit.test.ts` syncWorkerDisplay tests: change expected progress values from 0-100 to 0.0-1.0 (e.g., 70 -> 0.7, 100 -> 1, 0 -> 0)
- Update `test/cmux-status.test.ts` setProgressImpl tests: change test values from 75/50 to 0.75/0.5
- Verify existing test assertions still validate label pass-through and error handling

Acceptance: `syncWorkerDisplay` passes raw heartbeat progress (0.0-1.0) to `mux.setProgress` without multiplying by 100. Idle/done states send 1 instead of 100. All JSDoc comments on setProgress/setProgressImpl reference "0.0-1.0" not "0-100". Tests pass.

Key files: `core/commands/orchestrate.ts:428`, `core/cmux-status.ts:39`, `core/cmux.ts:104`, `core/mux.ts:37`, `test/orchestrator-unit.test.ts`, `test/cmux-status.test.ts`
