# Refactor: Extract guard registry for temporal safety predicates (H-ARC-2)

**Priority:** High
**Source:** Architecture plan -- state machine hardening
**Depends on:** None
**Domain:** state-machine
**Lineage:** 55c59b63-1cc0-4f04-a674-87f4c01dc4c4

Extract the ~10 inline temporal/freshness guard conditions scattered across orchestrator handler methods into named, pure predicate functions in a new `core/orchestrator-guards.ts` module. These guards are timestamp comparisons that determine whether a signal (CI status, heartbeat, event time) can be trusted given the item's current state epoch. 3 of 11 recent bugs were caused by missing or incorrect inline guards.

Guards to extract (file: `core/orchestrator.ts`):
- `isCiFailTrustworthy()` -- CI pending grace period check (line ~940-941 in handleCiPending)
- `isHeartbeatActive()` -- heartbeat freshness check (used in multiple handlers, ~line 706-707)
- `isEventFresherThan()` -- snapshot event vs baseline timestamp (used in handleRebasing ~line 1245)
- `shouldRenotifyCiFailure()` -- new commit since last CI failure notification (handleCiFailed)
- `isActivityTimedOut()` -- commit staleness timeout (handleImplementing ~line 738-757)
- `isLaunchTimedOut()` -- no-commit launch timeout (handleImplementing ~line 743-750)
- `isCiFixAckTimedOut()` -- CI fix acknowledgment timeout (handleCiFailed ~line 915-919)
- `isMergeCiGracePeriodExpired()` -- post-merge CI grace (handleForwardFixPending ~line 1314-1316)
- `isRebaseStale()` -- rebase retry cooldown (planRebaseConflictAction ~line 362-364)

Each guard is a pure function of (item, snapshot, config, now) -- no side effects, trivially testable. Replace inline logic in handlers with calls to named guards.

**Test plan:**
- Add `test/orchestrator-guards.test.ts` with unit tests for each guard function
- Test each guard at boundary conditions (exactly at threshold, 1ms before, 1ms after)
- Test with undefined/null inputs (e.g., missing heartbeat, missing ciPendingSince)
- Run full suite to verify handler behavior unchanged after extraction

Acceptance: New `core/orchestrator-guards.ts` exports all guard predicates. All inline timestamp comparisons in orchestrator handlers replaced with named guard calls. Guard tests pass. Full test suite passes with no behavior changes.

Key files: new `core/orchestrator-guards.ts`, `core/orchestrator.ts` (handler methods), new `test/orchestrator-guards.test.ts`
