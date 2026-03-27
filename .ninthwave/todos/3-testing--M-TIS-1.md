# Fix: Investigate --bail + bun test ordering sensitivity (M-TIS-1)

**Priority:** Medium
**Source:** Friction log (supervisor observation, 2026-03-27)
**Depends on:** —
**Domain:** testing

Workers using `--bail` flag with `bun test` hit flaky test ordering issues — tests pass individually but fail under bail due to ordering sensitivity. Workers had to re-run without `--bail`, adding ~2 minutes to cycle time.

Investigate the root cause:
1. Identify which test files are ordering-sensitive (likely mock leakage between files despite DI preference)
2. Check if any test files use `vi.mock` that could leak state across files
3. If mock isolation is the cause, refactor affected tests to use dependency injection
4. If `--bail` interacts poorly with bun's parallel test runner, document the limitation in CLAUDE.md

Acceptance: All tests pass reliably with `--bail` flag across multiple runs (`bun test test/ --bail` run 5x with no failures). If `--bail` cannot be made reliable, document the limitation and update the worker agent prompt to not use `--bail` by default.

Key files: `test/`, `CLAUDE.md`, `agents/todo-worker.md`
