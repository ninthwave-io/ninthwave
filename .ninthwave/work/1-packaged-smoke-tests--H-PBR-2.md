# Test: Add compiled orchestration startup smoke coverage (H-PBR-2)

**Priority:** High
**Source:** Spec `.opencode/plans/1775140452190-tidy-falcon.md`
**Depends on:** H-PBR-1
**Domain:** packaged-smoke-tests
**Lineage:** 3d7557aa-74a5-4738-975c-a07b5ab0ef37

Add one reusable compiled-binary smoke runner that builds or consumes `dist/ninthwave`, boots orchestration far enough to hit the self-respawn path, and fails if startup disconnects with the packaged `/$bunfs/root/ninthwave` module error. Keep the existing startup-fatal smoke assertions intact so the new coverage validates the packaged launch path without weakening the current transport/fatal checks.

**Test plan:**
- Add a smoke test under `test/smoke/` that launches the compiled binary against a temp repo and asserts startup does not emit `Module not found "/$bunfs/root/ninthwave"`
- Verify the same smoke also rejects the reported startup disconnect path while still reaching the interactive-engine-child respawn seam
- Keep `test/smoke/interactive-engine-child.test.ts` passing with its current fatal transport assertions so the new runner does not change failure formatting semantics

Acceptance: A reusable smoke entrypoint exercises packaged orchestration startup through the self-respawn path, fails on the reported bunfs module-resolution regression, and leaves the existing startup-failure smoke behavior unchanged.

Key files: `test/smoke/interactive-engine-child.test.ts`, `test/smoke/`, `test/helpers.ts`, `core/commands/orchestrate.ts`
