# Docs: Add a bulk mechanical lint/type refactor playbook to the implementer prompt (M-BLP-1)

**Priority:** Medium
**Source:** Friction log 2026-06-22T00-00-00Z--bulk-mechanical-lint-refactor-playbook
**Depends on:** None
**Domain:** agent-prompts
**Lineage:** 1f8fc71a-71c6-421b-8030-cb807a6a3577

Orchestrating a very large (~2200-fix across ~360 files) mechanical lint/type-burndown refactor via parallel implementer subagents surfaced a recurring set of frictions. None are project-specific; they recur on any large type-aware lint burndown fanned out across subagents. A dedicated playbook would prevent rediscovering them each time.

Add a "bulk mechanical lint/type refactor" section to `agents/implementer.md` covering:

1. **Never run whole-project typecheck in subagents.** Running several concurrent `tsc --noEmit` runs across parallel agents spikes memory enough to require human intervention. Cap concurrency (~3 agents), have edit-subagents verify ONLY with cheap single-file `eslint <file>`, and have the orchestrator run the one project-wide `tsc` centrally between waves.

2. **Type-aware lint passing does NOT imply typecheck passing.** After a wave clears all `no-unsafe-*` lint (each subagent verifying with `eslint` only), a central `tsc` can surface new errors under settings like `noUncheckedIndexedAccess` (indexed-access sites like `mock.calls[0][0]` becoming `T | undefined`). Any task that adds precise types to indexed-access sites must gate subagents on `tsc`, not just scoped lint; typing agents should grep the central `tsc` output for their own files.

3. **Shared-worktree git hygiene.** Edit-subagents that run `git stash` / `git add` on their own initiative pollute staged state and make it hard to distinguish the orchestrator's commits. Edit-subagents must be hard-blocked from any git command; the orchestrator owns all git state.

4. **Some lint rules are NOT safe to `eslint --fix`.** A blanket `--fix` of `no-unnecessary-type-assertion` strips load-bearing assertions: typescript-eslint back-infers the generic type argument from the `as` target on throwing testing-library queries (`getBy*`/`getAllBy*`/`findBy*`) and `queryClient.getQueryData`, so it reports the assertion as unnecessary while `tsc` does not -- removing it breaks the typecheck. The correct fix is the generic-call form (`query<T>(...)` instead of `query(...) as T`), excluding `querySelector`/`closest`/`queryBy*` (which return `T | null`, so their `as` is genuinely necessary).

Additionally, add a per-rule autofix-safety note to `skills/decompose/SKILL.md` so a decompose author can flag, per named lint rule, whether `--fix` is safe -- warning an implementer before they reach for `eslint --fix` on a rule like `no-unnecessary-type-assertion`.

**Test plan:**
- Docs change only; no automated test. Verify by review that the playbook section exists in `agents/implementer.md` and the autofix-safety guidance exists in `skills/decompose/SKILL.md`, and that the four points above are covered.

Acceptance: `agents/implementer.md` contains a "bulk mechanical lint/type refactor" section covering subagent verification (single-file lint vs central tsc), git ownership, and per-rule autofix safety; `skills/decompose/SKILL.md` tells decompose authors to flag per-rule autofix safety.

Key files: `agents/implementer.md`, `skills/decompose/SKILL.md`
