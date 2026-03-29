# Feature: checkPrStatus contract tests (H-TS-5)

**Priority:** High
**Source:** Testing strategy Phase 3
**Depends on:** None
**Domain:** testing-strategy

Write `test/contract/gh-pr-status.test.ts` pinning the format assumptions between checkPrStatus and the gh CLI. Use captured real gh output as fixtures and verify checkPrStatus produces the correct tab-separated output for every status path: no-pr, pending, failing, ci-passed, ready, merged. This tests the parsing logic in isolation -- when GitHub changes their output format, these tests break first.

**Test plan:**
- Test each status path: no-pr (no open/merged PRs), pending (CI pending), failing (CI failed), ci-passed (CI pass but not approved), ready (CI pass + approved + mergeable), merged
- Verify tab-separated format: ID\tPR_NUMBER\tSTATUS\tMERGEABLE\tEVENT_TIME
- Verify merged status includes PR title as 6th field for collision detection
- Use vi.spyOn on gh functions (prList, prView, prChecks) to inject canned responses
- Edge case: no CI checks (empty checks array returns unknown/pending)

Acceptance: Every status path of checkPrStatus is covered with fixture-based assertions.

Key files: `test/contract/gh-pr-status.test.ts`, `core/commands/pr-monitor.ts:157` (checkPrStatus), `core/gh.ts` (prList, prView, prChecks)
