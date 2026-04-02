# Fix: Correct packaged CLI self-respawn argv (H-PBR-1)

**Priority:** High
**Source:** Spec `.opencode/plans/1775140452190-tidy-falcon.md`
**Depends on:** None
**Domain:** packaged-respawn
**Lineage:** 6949ddb4-ff42-445f-baa7-2d1397a623b8

Add one shared helper for re-executing the current ninthwave CLI so dev mode keeps using the script entrypoint while compiled binaries invoke the executable directly. Wire both `spawnInteractiveEngineChild(...)` and `forkDaemon(...)` through that helper without changing startup overlays, disconnect rendering, or other watch-loop behavior.

**Test plan:**
- Add focused helper tests covering dev-mode argv, packaged-mode argv, and the rule that packaged mode must not forward a non-script `process.argv[1]`
- Extend `test/orchestrate.test.ts` for `spawnInteractiveEngineChild(...)` so dev mode keeps the current argv layout and packaged mode only passes the intended child args
- Extend daemon respawn coverage for `forkDaemon(...)` so packaged mode becomes `<executable> orchestrate ...childArgs` while detached logging behavior stays intact

Acceptance: Both interactive-engine-child startup and daemon startup derive their command/argv from a shared helper, packaged binaries no longer prepend a bogus `process.argv[1]`, and targeted spawn-shape tests cover both dev and packaged execution modes.

Key files: `core/cli-spawn.ts`, `core/commands/orchestrate.ts`, `core/daemon.ts`, `test/cli-spawn.test.ts`, `test/orchestrate.test.ts`
