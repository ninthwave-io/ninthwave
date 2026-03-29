# Feature: Watch mode scenario test (M-TS-9)

**Priority:** Medium
**Source:** Testing strategy Phase 4
**Depends on:** None
**Domain:** testing-strategy

Write `test/scenario/watch-mode.test.ts` exercising the watch mode loop where all items complete, then new work items are discovered via scanWorkItems. Scenarios: (1) Initial items complete, scanWorkItems returns new items, new items are added and proceed to done. (2) scanWorkItems returns empty repeatedly, loop continues polling until maxIterations. (3) New items have dependencies on completed items -- deps are already satisfied, new items launch immediately.

**Test plan:**
- Assert watch mode enters waiting state after all items reach terminal state
- Assert scanWorkItems is called during the watch polling loop
- Assert new items are added via orch.addItem and proceed through the lifecycle
- Assert new items with deps on completed items launch immediately (deps already met)
- Verify watch_new_items log event is emitted with correct newIds

Acceptance: Watch mode scenarios pass with config.watch=true and an injected scanWorkItems function.

Key files: `test/scenario/watch-mode.test.ts`, `test/scenario/helpers.ts`, `core/commands/orchestrate.ts:1851` (watch mode loop)
