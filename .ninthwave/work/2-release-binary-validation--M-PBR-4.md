# Test: Validate release artifacts with packaged orchestration smoke (M-PBR-4)

**Priority:** Medium
**Source:** Spec `.opencode/plans/1775140452190-tidy-falcon.md`
**Depends on:** H-PBR-2
**Domain:** release-binary-validation
**Lineage:** 1f94b152-5964-445e-a253-3eabd2c952c4

Run the same reusable packaged orchestration smoke inside the release matrix after each platform binary is built and before it is packaged and uploaded. This keeps release validation on the real compiled artifact path and avoids shipping binaries that can print the bunfs module-resolution failure during startup.

**Test plan:**
- Update `.github/workflows/release.yml` so each matrix build runs the shared packaged orchestration smoke against its freshly built `dist/ninthwave`
- Verify the smoke runs before tarball packaging and upload, so release assets are blocked by packaged startup regressions
- Confirm the release workflow reuses the same smoke entrypoint as CI/CD rather than embedding a separate shell implementation

Acceptance: Every release-matrix binary is smoke-tested through packaged orchestration startup before packaging, and release validation uses the same reusable smoke entrypoint as CI and CD.

Key files: `.github/workflows/release.yml`, `test/smoke/`
