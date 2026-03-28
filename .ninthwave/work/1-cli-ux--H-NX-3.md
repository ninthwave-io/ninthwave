# Test: Wire orchestrate passthrough in cmdOrchestrate (H-NX-3)

**Priority:** High
**Source:** Dogfood friction #28 -- confusing Run selected vs Watch all UX
**Depends on:** H-NX-1
**Domain:** cli-ux

Verify and add test coverage that `cmdOrchestrate` correctly skips `runInteractiveFlow` when items, merge strategy, and WIP limit are passed as CLI args. The mechanism already exists (`shouldEnterInteractive(itemIds.length > 0)` returns false when items are provided), but needs explicit test coverage for the passthrough path used by the redesigned `cmdNoArgs`.

Add tests to `test/orchestrate.test.ts` that verify:
- When `--items H-FOO-1 H-FOO-2 --merge-strategy asap --wip-limit 3` is passed, no interactive prompts are triggered
- Items are validated against the parsed todo map
- The orchestrator receives the correct item IDs, merge strategy, and WIP limit

If any code changes are needed to support the passthrough (e.g., `shouldEnterInteractive` edge cases), make them. The expectation is minimal code changes -- this is primarily a test coverage item.

**Test plan:**
- Test cmdOrchestrate with pre-passed --items + --merge-strategy + --wip-limit skips interactive flow
- Test items are validated (unknown ID triggers error)
- Verify no prompt function calls when all args are provided via CLI
- Test that WIP limit from CLI args is honored (not overridden by computed default)

Acceptance: Test suite in `test/orchestrate.test.ts` covers the passthrough path. Running `nw watch --items H-FOO-1 --merge-strategy asap --wip-limit 3` does not prompt for any interactive input. All tests pass.

Key files: `core/commands/orchestrate.ts`, `test/orchestrate.test.ts`
