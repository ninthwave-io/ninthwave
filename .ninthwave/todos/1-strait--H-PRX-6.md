# Feat: Add credential injection + TOML config + audit logging (H-PRX-6)

**Priority:** High
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** H-PRX-5
**Domain:** strait
**Repo:** strait

Add credential injection for GitHub API requests. Load a credentials.toml config file (--credentials flag) that maps services to credential sources (env vars, with keychain support planned for later). For GitHub: inject `Authorization: token <PAT>` header on allowed requests. Add structured JSON audit logging for every policy decision: timestamp, session_id, request (host, port, method, path, mitm flag), decision, matched_policy, credential_injected, eval_latency_us. Log to stderr and optionally to a file (--audit-log flag). Passthrough CONNECT events also logged with mitm:false.

**Test plan:**
- Load credentials.toml with GitHub bearer token from env var
- On policy ALLOW: Authorization header injected with correct PAT value
- On policy DENY: no credential injected, 403 returned
- Audit JSON event emitted for every request (allow and deny) with all required fields
- Passthrough CONNECT logged with mitm:false and only host/port
- Missing/invalid credentials.toml: clear startup error
- Credential source env var not set: clear error at startup (not at request time)

Acceptance: GitHub PAT injected on allow. No credential on deny. JSON audit events for every decision. credentials.toml parsed correctly. Missing env var detected at startup.

Key files: `src/credentials.rs`, `src/audit.rs`, `src/config.rs`, `src/mitm.rs`
