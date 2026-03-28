# Docs: Update README hero copy and GitHub About description (H-CL-3)

**Priority:** High
**Source:** Scope reduction plan 2026-03-28
**Depends on:** H-CL-1
**Domain:** cleanup

Update the README opening section and GitHub repo description to reflect current capabilities. The tagline stays: "From spec to merged PRs. Automatically." But the opening paragraph (line 21), bullet points (lines 24-30), and skills table (lines 86-91) need updating.

Opening paragraph/bullets should incorporate: stacked PRs, automated review (now on by default), CI failure recovery, auto-rebase, and the streamlined two-skill surface (`/decompose` and `/work`). Remove any references to todo-preview from the skills table. The skills table after H-CL-1 should only have `/decompose` and `/work` -- verify this and clean up if needed.

Update the GitHub repo "About" description using `gh repo edit --description "..."` with a one-liner that captures the product (e.g., "Parallel AI coding orchestration. From spec to merged PRs.").

Keep the README concise -- the opening section should be scannable, not a feature matrix.

**Test plan:**
- Manual review: verify README opening reads clearly and lists only current features
- Verify skills table has exactly 2 rows (`/decompose` and `/work`)
- Verify `gh repo view --json description` shows updated description

Acceptance: README opening paragraph and bullet points reflect stacked PRs, automated review, CI recovery. Skills table shows only `/decompose` and `/work`. GitHub repo About description is updated. No references to removed features (gstack, todo-preview).

Key files: `README.md`
