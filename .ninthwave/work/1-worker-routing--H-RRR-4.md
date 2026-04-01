# Fix: Route worker-targeted inbox messages to live worktrees (H-RRR-4)

**Priority:** High
**Source:** Spec `.opencode/plans/1775079290582-curious-sailor.md`
**Depends on:** H-RRR-2, H-RRR-3
**Domain:** worker-routing
**Lineage:** 01750c66-a0d5-4747-a8db-baf15dcb0939

Harden the shared notification path so rebase and CI-fix messages are only treated as delivered when the daemon has a safe worker target. Worker-targeted writes should consistently prefer the worker worktree root when known, and reconstructed items without a trustworthy target should relaunch or fall back instead of claiming a stale workspace can receive inbox messages.

**Test plan:**
- Add orchestrator action tests proving reconstructed items with a known `worktreePath` still write to the worktree-root slug
- Cover the no-safe-target case so CI failure handling relaunches or otherwise avoids claiming success when only stale `workspaceRef` data exists
- Verify stale `workspaceRef` alone is not treated as proof that rebase or CI-fix delivery succeeded

Acceptance: Rebase and CI-fix notifications target the correct worktree inbox when available, and reconstructed items without a safe worker target do not get marked as successfully notified based only on stale workspace metadata.

Key files: `core/orchestrator-actions.ts`, `core/reconstruct.ts`, `test/orchestrator.test.ts`, `test/daemon-integration.test.ts`
