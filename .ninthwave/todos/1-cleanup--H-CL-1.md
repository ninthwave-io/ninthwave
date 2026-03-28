# Refactor: Docs cleanup -- fix license, remove gstack, remove todo-preview (H-CL-1)

**Priority:** High
**Source:** Scope reduction plan 2026-03-28
**Depends on:** None
**Domain:** cleanup

Fix license mismatch (README and CONTRIBUTING say MIT but LICENSE is Apache 2.0), remove all gstack references, and remove the todo-preview skill. Three related docs/config cleanups in one pass.

License fix: README.md badge on line 9 says `license-MIT-blue` (change to `license-Apache%202.0-blue`), README.md line 109 says "MIT" (change to "Apache 2.0"), CONTRIBUTING.md line 144 says "MIT" (change to "Apache 2.0").

gstack removal: Delete the `## gstack` section from CLAUDE.md (lines 70-74, the browsing instruction and available skills list). Rewrite README.md line 92 to drop the gstack mention and "[gstack](https://github.com/garrytan/gstack) provides all four" -- keep the Agent Skills standard link.

todo-preview removal: Delete `skills/todo-preview/` directory entirely. Remove `"todo-preview"` from the SKILLS array in `core/commands/setup.ts` (line 221). Remove the `/todo-preview` row from the README.md skills table (line 90). Remove todo-preview references from CONTRIBUTING.md (lines 28 and 59). Update test expectations in `test/setup.test.ts`, `test/init.test.ts`, and `test/onboard.test.ts` that include "todo-preview" in expected skill arrays.

Do not modify CHANGELOG.md -- historical references are fine.

**Test plan:**
- Run `bun test test/` -- setup, init, and onboard tests must pass with todo-preview removed from expected arrays
- Verify `grep -r "gstack" .` returns zero hits (except CHANGELOG.md)
- Verify `grep -r "todo-preview" .` returns zero hits (except CHANGELOG.md)
- Verify `grep -r "MIT" README.md CONTRIBUTING.md` returns zero hits

Acceptance: License badge and footer say Apache 2.0 in both README and CONTRIBUTING. Zero gstack references outside CHANGELOG. Zero todo-preview references outside CHANGELOG. `skills/todo-preview/` directory deleted. All tests pass.

Key files: `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `core/commands/setup.ts:221`, `skills/todo-preview/`, `test/setup.test.ts`, `test/init.test.ts`, `test/onboard.test.ts`
