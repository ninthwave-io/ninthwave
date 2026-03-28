# Refactor: Drop ninthwave label from worker PRs (L-SC-4)

**Priority:** Low
**Source:** Dogfooding observation 2026-03-28
**Depends on:** None
**Domain:** status-cleanup

Workers create a "ninthwave" GitHub label and apply it to every PR. This label is not used for
any filtering logic in the codebase (only `ninthwave: skip-review` is, which is a separate label).
Remove the `gh label create "ninthwave"` lines and the `--label "ninthwave"` flags from PR creation
commands in the worker agent prompt. Keep the `domain:XXX` label which is useful for filtering.

**Test plan:**
- Manual review: verify `agents/todo-worker.md` no longer references `gh label create "ninthwave"` or `--label "ninthwave"`
- Grep the codebase for remaining `"ninthwave"` label references outside of `ninthwave: skip-review`

Acceptance: `agents/todo-worker.md` no longer creates the "ninthwave" label or applies it to PRs. The `domain:XXX` label creation and application remain intact. `ninthwave: skip-review` label logic in orchestrate.ts is unchanged.

Key files: `agents/todo-worker.md:126-128`, `agents/todo-worker.md:259-270`
