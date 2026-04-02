# Test: Gate packaged orchestration smoke in CI and CD (M-PBR-3)

**Priority:** Medium
**Source:** Spec `.opencode/plans/1775140452190-tidy-falcon.md`
**Depends on:** H-PBR-2
**Domain:** ci-binary-validation
**Lineage:** 806409ed-692f-404b-af9e-001981acf3fb

Replace the current compiled-binary `version` smoke in pull-request CI and main-branch CD with the reusable orchestration startup smoke so both workflows exercise the packaged respawn path. Keep the workflow changes minimal and route both YAML files through the same smoke command instead of duplicating shell logic.

**Test plan:**
- Update `.github/workflows/ci.yml` to build the binary and run the shared packaged orchestration smoke command instead of `./dist/ninthwave version`
- Mirror the same command in `.github/workflows/cd.yml`, preserving the existing skip-tests gate behavior for manual dispatches
- Verify the workflow command shape stays shared across both files so future smoke changes happen in one place

Acceptance: PR CI and main-branch CD both run the same packaged orchestration smoke after building `dist/ninthwave`, and neither workflow relies on the old `version`-only binary smoke.

Key files: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`
