# Docs: Stacked-PR guidance for locally-rebased worker branches (M-STACK-1)

**Priority:** Medium
**Source:** Dogfooding friction -- worker had to figure out solo that after locally rebasing onto origin/main (to pick up a sibling dependency that merged while it was waiting), `gh pr create --base $BASE_BRANCH` fails with "No commits between..." because the locally-rebased commits have different SHAs than the remote BASE_BRANCH tip. The fallback to `--base main` works but the prompt does not tell the worker when to take it.
**Depends on:** None
**Domain:** stacked-pr
**Lineage:** 35ef04f5-1f0e-40af-a04f-2e6239551652

The implementer agent's Stacked PRs section already covers the "dependency has merged" path (check `gh pr list --head $BASE_BRANCH --state merged`, fall back to no `--base`). It does not yet cover the related case where the worker has rebased its branch locally onto origin/main (e.g. to incorporate a sibling dependency that merged in the meantime). In that case the local commit SHAs diverge from the remote `BASE_BRANCH` tip and `gh pr create --base $BASE_BRANCH` fails with "No commits between $BASE_BRANCH and HEAD" -- which reads as a different error from "branch gone or stale".

Extend the Stacked PRs guidance in `agents/implementer.md` to acknowledge this case: after a local rebase onto main, drop the `--base` flag (or pass `--base main`); the sibling-dependency commits drop out of the PR diff once that dependency merges.

**Test plan:**
- No code changes; this is a documentation fix. Reviewers verify the new note is unambiguous and that it does not duplicate or contradict the existing "dependency has merged" branch.

Acceptance: `agents/implementer.md` Stacked PRs section explicitly distinguishes (a) "BASE_BRANCH still open" -> `--base $BASE_BRANCH`, (b) "BASE_BRANCH merged" -> drop `--base`, (c) "BASE_BRANCH still open but I rebased locally onto main" -> drop `--base` (or `--base main`), since local SHAs diverge from remote tip.

Key files: `agents/implementer.md` (Stacked PRs section, currently around lines 354-369)
