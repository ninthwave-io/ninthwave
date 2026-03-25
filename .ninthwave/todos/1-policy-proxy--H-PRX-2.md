# Feat: Validate Cedar entity hierarchy for URL path matching (H-PRX-2)

**Priority:** High
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** None
**Domain:** policy-proxy

Validate that Cedar's entity hierarchy model can express URL path-based policies. Create a throwaway Rust project with cedar-policy crate. Build the entity hierarchy by splitting URL paths into parent/child resources (e.g., `api.github.com/repos/our-org/ninthwave/pulls` is a child of `api.github.com/repos/our-org/ninthwave`). Write the example policies from the design doc and verify they compile and evaluate correctly for 6 test requests: GET repos (allow), POST pulls (allow), DELETE repo (deny), POST git/refs/heads/main (deny), PATCH settings (deny), GET unknown path (deny by default).

**Test plan:**
- Create throwaway Rust project with cedar-policy crate
- Define Cedar schema with Agent, Action (http verbs + connect), Resource (URL path hierarchy)
- Write 4 permit/forbid rules from the design doc's GitHub policy example
- Evaluate against 6 test request scenarios and assert correct allow/deny
- Document any Cedar syntax issues (e.g., `like` operator behavior, entity hierarchy construction)

Acceptance: All 6 test scenarios evaluate correctly. Cedar policy syntax validated against actual Cedar spec. Any deviations from design doc examples documented with fixes.

Key files: N/A (throwaway Rust project, results documented in PR description)
