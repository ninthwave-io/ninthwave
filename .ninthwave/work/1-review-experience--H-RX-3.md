# Fix: Reviewer uses GitHub Review API for inline comments (H-RX-3)

**Priority:** High
**Source:** Dogfood friction 2026-03-28
**Depends on:** None
**Domain:** review-experience

The reviewer agent currently tries to post inline comments via `gh api repos/.../pulls/.../comments` (individual comment endpoint) but hits 422 errors because it doesn't supply the required `positioning` or `position` fields. It should use GitHub's Pull Request Review API instead (`POST /repos/{owner}/{repo}/pulls/{number}/reviews`) which supports inline comments as part of a single review submission.

Update the reviewer agent prompt (`agents/reviewer.md`) to:
1. Use `gh api repos/{owner}/{repo}/pulls/{number}/reviews` with a `comments` array for inline findings (each comment has `path`, `line`, `side`, and `body`)
2. Post the verdict as the review `event` field (`APPROVE` or `REQUEST_CHANGES`)
3. Use the review `body` field for the verdict summary — do NOT repeat individual findings in the body since they're already posted inline
4. Make it explicit that inline comments are the primary feedback mechanism and the verdict body is only a brief summary

**Test plan:**
- Manual test: have the reviewer review a PR and verify inline comments appear correctly on GitHub
- Verify the verdict file still works for orchestrator integration
- Verify no 422 errors in reviewer output

Acceptance: Reviewer posts inline comments that appear on specific lines in the GitHub PR UI. Verdict is posted as a GitHub review (not a standalone comment). No 422 API errors.

Key files: `agents/reviewer.md`
