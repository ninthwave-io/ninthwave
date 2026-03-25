# Fix: Flicker-free status watch refresh (H-STA-1)

**Priority:** High
**Source:** Status & daemon UX improvements (2026-03-25)
**Depends on:** none
**Domain:** status-ux

Eliminate the visible screen flicker in `ninthwave status --watch` by replacing the full-screen-clear approach with cursor-home + clear-trailing.

Changes to `core/commands/status.ts`:
1. Extract `renderStatus(worktreeDir, projectRoot): string` from `cmdStatus` — same logic, returns string instead of console.log-ing
2. `cmdStatus` becomes `console.log(renderStatus(...))`
3. `cmdStatusWatch` uses cursor-home-only refresh:
   - `\x1B[H` (cursor home, no clear)
   - Write rendered output via `process.stdout.write`
   - `\x1B[J` (clear from cursor to end of screen — removes stale lines)
4. Remove the `\x1B[2J` (clear entire screen) call

Changes to `test/status.test.ts`:
- Update `cmdStatusWatch` tests: verify `\x1B[2J` is NOT emitted, `\x1B[H` and `\x1B[J` are used
- Add test for `renderStatus` returning a string with expected content

**Test plan:**
- Verify `cmdStatusWatch` writes `\x1B[H` (not `\x1B[2J\x1B[H`) to stdout
- Verify `\x1B[J` is written after status output to clear trailing lines
- Verify `renderStatus` returns the same content that `cmdStatus` would print
- `bun test test/` — all tests pass

Acceptance: Status watch no longer flickers. Screen updates in place with no blank frame. Existing `cmdStatus` (non-watch) behavior unchanged.

Key files: `core/commands/status.ts`, `test/status.test.ts`
