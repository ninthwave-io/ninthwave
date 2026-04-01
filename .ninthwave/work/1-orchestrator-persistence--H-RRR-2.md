# Refactor: Persist rebase retry and worktree targeting state (H-RRR-2)

**Priority:** High
**Source:** Spec `.opencode/plans/1775079290582-curious-sailor.md`
**Depends on:** None
**Domain:** orchestrator-persistence
**Lineage:** d305d39d-646a-4e89-ac4c-6a816f40a561

Add the small tracking fields needed for bounded rebase retries and persist them through daemon save/restore. Reconstruction must also restore enough worker-targeting state, including `worktreePath`, so later action-layer notifications can address the correct worktree after a daemon restart.

**Test plan:**
- Add serialization coverage for `lastRebaseNudgeAt`, `rebaseNudgeCount`, and `worktreePath` in daemon state
- Extend reconstruction tests so persisted items restore those fields onto `OrchestratorItem`
- Cover backward-compatible behavior for older daemon state that does not contain the new fields

Acceptance: Daemon persistence and reconstruction round-trip the new rebase bookkeeping fields plus `worktreePath`, and reconstructed items have the worker-targeting data needed for later rebase or CI-notification actions.

Key files: `core/orchestrator-types.ts`, `core/daemon.ts`, `core/reconstruct.ts`, `test/daemon.test.ts`, `test/orchestrate.test.ts`
