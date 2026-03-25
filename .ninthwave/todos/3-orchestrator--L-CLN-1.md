# Fix: Skip remote branch deletion when GitHub auto-delete is enabled (L-CLN-1)

**Priority:** Low
**Source:** Friction log 2026-03-25 — noisy warnings on every item cleanup
**Depends on:** None
**Domain:** orchestrator

After merging, the orchestrator tries `git push origin --delete todo/X` but fails because GitHub's "auto-delete head branches" setting already removed the branch. Produces a warning for every merged item.

**Design:**

1. **Pre-check:** Before attempting remote branch deletion, check if the branch still exists via `git ls-remote --heads origin todo/X`. If it's gone, skip deletion silently.
2. **Suppress known error:** If the delete attempt fails with "remote ref does not exist", treat it as success (branch already cleaned up) — don't log a warning.
3. **Optional config:** No config needed for now. The pre-check + error suppression handles both cases (auto-delete on or off) without user configuration.

**Acceptance:** No "Failed to delete remote branch" warnings when GitHub auto-delete is enabled. Branch is still deleted when auto-delete is off.

**Test plan:**
- Unit test: branch exists → delete succeeds
- Unit test: branch already gone → skip silently (no warning)
- Unit test: delete fails for other reasons → still log warning

Key files: `core/commands/orchestrate.ts` (cleanup action), `test/orchestrate.test.ts`
