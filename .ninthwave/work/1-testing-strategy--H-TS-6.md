# Feature: prChecks contract tests (H-TS-6)

**Priority:** High
**Source:** Testing strategy Phase 3
**Depends on:** None
**Domain:** testing-strategy

Write `test/contract/gh-pr-checks.test.ts` pinning the CI check state parsing logic. Verify that prChecks and the CI_FAILURE_STATES set correctly classify every state value returned by gh pr checks: SUCCESS, FAILURE, PENDING, STARTUP_FAILURE, STALE, EXPECTED, CANCELLED, SKIPPED, TIMED_OUT, ACTION_REQUIRED, ERROR. Test both the raw prChecks parsing and the downstream classification used in checkPrStatus.

**Test plan:**
- Test prChecks returns correct state/name/completedAt for each gh output state
- Verify CI_FAILURE_STATES contains all failure variants (FAILURE, ERROR, CANCELLED, TIMED_OUT, ACTION_REQUIRED, STARTUP_FAILURE)
- Test mixed check results: some pass + some fail = overall fail; all pass = overall pass; some pending + no fail = overall pending
- Verify SKIPPED checks are excluded from overall status calculation
- Use vi.spyOn on shell.run to inject canned gh pr checks output

Acceptance: Every CI state value is covered. Mixed-result scenarios are tested.

Key files: `test/contract/gh-pr-checks.test.ts`, `core/commands/pr-monitor.ts:148` (CI_FAILURE_STATES), `core/gh.ts` (prChecks)
