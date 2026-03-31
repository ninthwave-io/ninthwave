# Refactor: ReviewVerdict type to blocking/non-blocking (H-CC-1)

**Priority:** High
**Source:** Conventional comments adoption (conventionalcomments.org)
**Depends on:** None
**Domain:** review-format

Replace the BLOCKER/NIT/PRE-EXISTING severity fields in the ReviewVerdict
interface with blocking/non-blocking counts to align with conventional
comments. This is the plumbing change -- rename fields and update all
consumers in the orchestrator, status renderer, and tests.

**Test plan:**
- Update all ReviewVerdict fixture objects in test/orchestrator-unit.test.ts, test/orchestrate.test.ts, test/orchestrator.test.ts, test/analytics.test.ts to use `blockingCount`/`nonBlockingCount` instead of `blockerCount`/`nitCount`/`preExistingCount`
- Verify orchestrator status descriptions render "N blocking, N non-blocking" (check statusDescription strings in orchestrator.ts around lines 882 and 902)
- Verify blockerIcon is renamed to blockingIcon in status-render.ts and all call sites updated
- Run full test suite (`bun test test/`) to confirm no regressions

Acceptance: `ReviewVerdict` interface uses `blockingCount` and `nonBlockingCount` fields. All orchestrator status messages, post-review formatting, and TUI rendering reference the new field names. All existing tests pass with updated fixtures.

Key files: `core/daemon.ts:405`, `core/orchestrator.ts:882`, `core/orchestrator-actions.ts:870`, `core/status-render.ts:271`, `test/orchestrator-unit.test.ts`, `test/orchestrate.test.ts`, `test/orchestrator.test.ts`, `test/analytics.test.ts`
