# Refactor: Simplify refresh to 2s and remove countdown display (M-SC-3)

**Priority:** Medium
**Source:** Dogfooding observation 2026-03-28
**Depends on:** H-SC-2
**Domain:** status-cleanup

The adaptive poll interval (5s/10s/15s/30s) and countdown display ("Refresh: 5s") add complexity
without much value -- a flat 2s refresh is fast enough that users never need to think about when
the next update comes. Replace `adaptivePollInterval()` with a flat 2000ms return. Remove the
1-second countdown interval that re-renders every second just to tick the countdown. Remove
`countdownText` from ViewOptions, delete `computeCountdownText()`, and strip countdown display
logic from `buildStatusLayout()` and `formatStatusTable()`. In `status --watch`, change the
default `intervalMs` from 5000 to 2000 and remove the countdown tracking.

**Test plan:**
- Update `test/status-render.test.ts`: remove all computeCountdownText tests (9 tests), remove countdownText-related assertions in buildStatusLayout/formatStatusTable tests
- Verify `adaptivePollInterval` returns flat 2000 (no existing unit tests -- add one simple test or inline the constant)
- Update `test/status.test.ts`: remove any countdown-specific assertions, verify watch mode still works with the shorter interval

Acceptance: `adaptivePollInterval()` always returns 2000. No countdown text appears in the footer. The 1-second countdown re-render interval is removed from both orchestrate.ts and status.ts. `computeCountdownText` is deleted. ViewOptions no longer has `countdownText`. `status --watch` defaults to 2s. Tests pass.

Key files: `core/commands/orchestrate.ts:443-463`, `core/commands/orchestrate.ts:2393-2408`, `core/commands/status.ts:277`, `core/commands/status.ts:294-296`, `core/commands/status.ts:383-392`, `core/status-render.ts:248-256`, `core/status-render.ts:938-940`, `core/status-render.ts:1328-1331`, `test/status-render.test.ts`, `test/status.test.ts`
