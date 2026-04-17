# Fix: Auto-merge gate must check PR base branch (H-ORCH-11)

**Priority:** High
**Source:** Downstream friction log 2026-04-17T14-11-19Z--H-ICDP-2-auto-merge-stacked.md
**Depends on:** None
**Domain:** orchestrator
**Lineage:** 4238dfe1-0cd8-4815-9120-34be17ec90a3

In auto mode, the orchestrator auto-merges any PR that passes CI and review, including stacked PRs whose base is another `ninthwave/*` dependency branch. Merging into the dependency branch collapses the stack prematurely and destroys the clean per-item review diff. Gate `executeMerge` so that `prMerge` is only called when the PR's base equals the repository's default branch; otherwise keep review/CI polling and wait for GitHub to retarget the PR to main after the dependency merges.

**Test plan:**
- Add orchestrator-action test: PR with `item.baseBranch` set to a `ninthwave/*` branch reaches the merge gate; the planner skips `prMerge` and holds the item in its pre-merge state with a clear skip message.
- Add test: after the dependency merges and GitHub retargets the child PR to main (`expectedBase === defaultBranch`), the merge gate fires normally.
- Verify existing merge tests (base = default branch) continue to merge without regression.

Acceptance: Stacked PRs do not auto-merge into their dependency branches. Merge step is skipped with a log message naming the current and expected base. Review and CI polling continue unchanged. Once GitHub retargets the PR to the default branch, the merge proceeds. All existing merge tests pass.

Key files: `core/orchestrator-actions.ts` (executeMerge, around line 490), `core/orchestrator-actions.ts` (resolveExpectedPrBase).
