# Feat: Add Cedar policy evaluation to MITM request handler (H-PRX-5)

**Priority:** High
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** H-PRX-4
**Domain:** strait
**Repo:** strait

Integrate cedar-policy crate into the MITM request handler. Load a .cedar policy file at startup (--policy flag). Build the Cedar entity hierarchy from each request's URL path by splitting into segments (parent/child resources). Evaluate each MITM'd request against the policy set with context attributes (host, path, headers). On DENY, return HTTP 403 with a structured JSON body including error type, matched policy name, request details, and a human-readable hint. On ALLOW, forward the request. Default disposition is DENY (Cedar's native behavior).

**Test plan:**
- Load example GitHub Cedar policy from design doc
- Evaluate 6 test requests: GET /repos/org/repo (allow), POST /repos/org/repo/pulls (allow), DELETE /repos/org/repo (deny), POST /git/refs/heads/main (deny), PATCH /settings (deny), GET /unknown (deny)
- Verify 403 response body has required fields: error, message, host, method, path, policy, hint
- Verify entity hierarchy: resource `a/b/c` is descendant of `a/b` is descendant of `a`
- Invalid/missing policy file: proxy refuses to start with clear error

Acceptance: Cedar policies evaluated per-request. Allow/deny matches expected outcomes for all 6 test cases. 403 response includes structured JSON with policy name. Missing policy file is a startup error.

Key files: `src/policy.rs`, `src/mitm.rs`, `src/main.rs`
