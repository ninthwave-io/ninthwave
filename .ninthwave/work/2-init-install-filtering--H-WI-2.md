# Feat: Apply preview-line skips without pruning managed files (H-WI-2)

**Priority:** High
**Source:** Spec `.opencode/plans/1775111913158-eager-island.md`
**Depends on:** H-WI-1
**Domain:** init-install-filtering
**Lineage:** 5551d370-40d4-4d69-a4fc-0c25d71179a9

Teach `initProject` scaffolding to honor the new preview-level selection by filtering the execution copy plan while keeping pruning based on the full tool and agent ownership selection. An unchecked preview line must mean skip-only for this run: do not create, refresh, or replace that target, and do not delete it if it already exists.

**Test plan:**
- Add `test/init.test.ts` coverage proving `opts.agentSelection.installDisplayPaths` filters the executed copy plan to only selected outputs
- Add a test that a stale existing managed copy excluded from `installDisplayPaths` remains unchanged after init
- Add a test that excluded existing managed copies are not pruned or deleted, while selected entries still create or refresh normally

Acceptance: `initProject(...)` preserves current pruning behavior for deselected tools and agents, but preview-level unchecked entries are simply skipped during copy execution. Existing managed files excluded from the preview selection remain on disk untouched, and selected entries still install normally.

Key files: `core/commands/init.ts`, `core/commands/setup.ts`, `test/init.test.ts`
