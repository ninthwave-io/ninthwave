# Refactor: Slim todo-worker Phase 7 to pre-PR sanity check (H-CL-2)

**Priority:** High
**Source:** Scope reduction plan 2026-03-28
**Depends on:** None
**Domain:** cleanup

Replace the todo-worker's Phase 7 "Quality Review" section with a minimal "Pre-PR Sanity Check". The current Phase 7 (lines 202-215 of `agents/todo-worker.md`) includes skill invocations for `/review`, `/design-review`, and `/qa` that duplicate what the review-worker handles separately and burn 3-5K extra tokens per worker.

Replace the ~13-line Phase 7 with a ~3-line pre-PR check that runs `git diff origin/main` and verifies: (1) no files outside the item's scope were modified, (2) no exposed secrets or credentials, (3) no debug artifacts (console.log, TODO comments, commented-out code). Remove all `/review`, `/design-review`, and `/qa` skill references from the agent prompt.

Rename the phase from "Quality Review" to "Pre-PR Check". Renumber subsequent phases if needed to keep numbering sequential.

**Test plan:**
- Manual review: read the updated agent prompt and verify no skill invocations remain
- Verify `grep "/review\|/design-review\|/qa" agents/todo-worker.md` returns zero hits
- Run `bun test test/` to confirm no tests reference Phase 7 content

Acceptance: Phase 7 is renamed "Pre-PR Check" with only a lightweight git diff scan (scope drift, secrets, debug artifacts). Zero `/review`, `/design-review`, or `/qa` skill references in `agents/todo-worker.md`. Subsequent phase numbers are sequential.

Key files: `agents/todo-worker.md`
