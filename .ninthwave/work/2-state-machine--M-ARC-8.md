# Refactor: Group OrchestratorDeps into functional sub-interfaces (M-ARC-8)

**Priority:** Medium
**Source:** Architecture plan -- opportunistic simplifications
**Depends on:** M-ARC-7
**Domain:** state-machine
**Lineage:** 0c9bff46-5b7f-4b67-ba59-d291a0342696

Restructure the 35-field `OrchestratorDeps` interface into functional sub-interfaces grouped by concern. Currently, every action function receives the full deps interface even when using only 2-3 fields, making it hard to trace which actions depend on which capabilities.

New structure in `core/orchestrator-types.ts`:
```
OrchestratorDeps {
  git: GitDeps       // fetchOrigin, ffMerge, resolveRef, rebaseOnto, forcePush, daemonRebase
  gh: GhDeps         // prMerge, prComment, setCommitStatus, getPrBaseBranch, getPrBaseAndState,
                     // retargetPrBase, checkPrMergeable, isPrBlocked, getMergeCommitSha,
                     // checkCommitCI, getDefaultBranch, upsertOrchestratorComment
  mux: MuxDeps       // sendMessage, closeWorkspace, readScreen
  workers: WorkerDeps // launchSingleItem, launchReview, launchRebaser, launchForwardFixer,
                     // validatePickupCandidate
  cleanup: CleanupDeps // cleanSingleWorktree, cleanReview, cleanRebaser, cleanForwardFixer,
                      // cleanStaleBranch, completeMergedWorkItem
  io: IoDeps         // writeInbox, warn, syncStackComments
}
```

Changes:
1. Define the 6 sub-interfaces in `core/orchestrator-types.ts`.
2. Update `OrchestratorDeps` to compose from sub-interfaces.
3. Update all action functions in `core/orchestrator-actions.ts` (~20 functions) to access deps through the new structure (e.g., `deps.gh.prMerge` instead of `deps.prMerge`).
4. Update test mock factories in `test/orchestrator.test.ts` and `test/orchestrator-unit.test.ts` to construct deps using the new structure.
5. Update `core/orchestrate-event-loop.ts` and `core/commands/orchestrate.ts` where deps are constructed.

**Test plan:**
- Run full test suite after restructuring -- all tests must pass with updated dep access paths
- Grep for direct `deps.prMerge`, `deps.launchSingleItem`, etc. -- should find zero direct accesses
- Verify each sub-interface is self-contained (no circular references between groups)
- Verify test mock factories produce valid deps objects (TypeScript compilation check)

Acceptance: `OrchestratorDeps` composed from 6 typed sub-interfaces. All action functions access deps through sub-interface paths. Test mocks updated. Full test suite passes. No functional behavior changes.

Key files: `core/orchestrator-types.ts`, `core/orchestrator-actions.ts`, `core/orchestrate-event-loop.ts`, `core/commands/orchestrate.ts`, `test/orchestrator.test.ts`, `test/orchestrator-unit.test.ts`
