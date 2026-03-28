# Feat: Review workers opt-out by default + commit status API (H-RV-1)

**Priority:** High
**Source:** Scope reduction plan 2026-03-28
**Depends on:** None
**Domain:** review

Make review workers on by default (opt-out with `--no-review`) and post review results as GitHub commit statuses so they integrate with branch protection rules.

Part A -- Default flip: Change `reviewEnabled: false` to `true` in DEFAULT_CONFIG (`core/orchestrator.ts` line 319). Change the initial value in `core/commands/orchestrate.ts` (~line 1735) to match. Add `--no-review` flag parsing (sets `reviewEnabled = false`). Update help text in `core/help.ts` for the watch command to document `--no-review`.

Part B -- Commit Status API: Add a `setCommitStatus(repoRoot, sha, state, context, description, targetUrl?)` function to `core/gh.ts`. It calls `gh api repos/{owner}/{repo}/statuses/{sha}` with state (pending/success/failure), context ("ninthwave/review"), description (e.g. "2 nits, 0 blockers"), and optional target_url linking to the review comment. Wire this into the orchestrator: set "pending" when entering `reviewing` state, set "success" when review completes with 0 blockers, set "failure" only when blockers found AND `reviewCanApprove` is true (otherwise "success" with blocker count in description). No GitHub App needed -- standard `repo` scope from `gh auth login` is sufficient.

Update the test at `test/orchestrator.test.ts` line 5162 that asserts `DEFAULT_CONFIG.reviewEnabled === false` to assert `true`.

**Test plan:**
- Unit test: verify DEFAULT_CONFIG.reviewEnabled is true
- Unit test: `--no-review` flag sets reviewEnabled to false
- Unit test: `setCommitStatus` calls gh api with correct arguments (mock gh)
- Unit test: orchestrator sets pending status on reviewing transition, success/failure on completion
- Integration: `bun test test/` -- all existing review tests still pass with new default
- Edge case: review with blockers but reviewCanApprove=false posts success (not failure)

Acceptance: `nw watch` launches review workers without `--review` flag. `--no-review` disables them. After review completes, a commit status appears on the PR with context "ninthwave/review" showing blocker/nit counts. Status integrates with GitHub branch protection. All tests pass.

Key files: `core/orchestrator.ts:319`, `core/commands/orchestrate.ts:1735`, `core/gh.ts`, `core/help.ts`, `test/orchestrator.test.ts:5162`
