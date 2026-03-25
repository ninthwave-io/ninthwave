# Test: E2E integration test nono + proxy + GitHub API (M-PRX-9)

**Priority:** Medium
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** H-PRX-8
**Domain:** policy-proxy

Write an end-to-end integration test that exercises the full chain: nono kernel sandbox + policy proxy + real GitHub API. The test starts the policy proxy with a test Cedar policy, launches a command inside nono with --upstream-proxy, makes GitHub API calls, and verifies: allowed calls succeed with injected credentials, denied calls return 403, and audit log contains structured events. The test suite is skipped when nono or the proxy binary is not installed (CI-friendly). Uses a separate test file to avoid interfering with the main fast test suite.

**Test plan:**
- Allowed GitHub API call (GET /zen or GET /rate_limit): succeeds, response contains expected data
- Denied GitHub API call (simulated DELETE or push to main): returns 403 with policy name in body
- Audit log file: contains JSON events for both allowed and denied requests with correct fields
- Credential injection: GitHub PAT appears in proxied request (verified via audit log credential_injected field)
- Skip gracefully: entire test suite skipped with clear message when nono or proxy not installed
- Filesystem isolation: verify agent cannot read ~/.aws/credentials or ~/.ssh/ (nono enforcement)

Acceptance: Full chain works end-to-end. Allow/deny matches policy. Audit log is complete. Tests skip cleanly when dependencies missing. No flaky behavior (deterministic policy evaluation).

Key files: `test/proxy-e2e.test.ts`
