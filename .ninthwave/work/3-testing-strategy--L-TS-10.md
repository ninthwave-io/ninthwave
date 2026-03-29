# Feature: CLI smoke tests (L-TS-10)

**Priority:** Low
**Source:** Testing strategy Phase 5
**Depends on:** None
**Domain:** testing-strategy

Write CLI smoke tests in `test/smoke/` that verify the nw binary starts, parses args, and exits cleanly for key commands. Use spawnSync("bun", ["run", "core/cli.ts", ...]) pattern from existing cli.test.ts. Tests: (1) `nw status` in a temp repo with a pre-written daemon state file renders a status table. (2) `nw init` in a fresh temp repo creates .ninthwave/ directory structure. (3) `nw list` in a temp repo with work items outputs parseable item list.

**Test plan:**
- Assert each command exits with code 0 (or expected non-zero for missing prereqs)
- Assert stdout contains expected output patterns (table headers, directory names, item IDs)
- Use setupTempRepo from test/helpers.ts for isolated temp git repos
- Verify no unhandled exceptions in stderr

Acceptance: CLI smoke tests pass for status, init, and list commands using real CLI binary in temp repos.

Key files: `test/smoke/status.test.ts`, `test/smoke/init.test.ts`, `test/smoke/list.test.ts`, `core/cli.ts`, `test/helpers.ts`
