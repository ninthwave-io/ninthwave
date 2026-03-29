# Feature: Crew coordination scenario test (M-TS-8)

**Priority:** Medium
**Source:** Testing strategy Phase 4
**Depends on:** None
**Domain:** testing-strategy

Write `test/scenario/crew-coordination.test.ts` exercising multi-daemon coordination through the real orchestrateLoop with a crewBroker injected. Use the existing MockBroker from core/mock-broker.ts to simulate a crew server. Scenarios: (1) Single daemon claims and completes items via the broker. (2) Broker disconnects -- all launches are blocked while disconnected, resume when reconnected. (3) Claim returns a different item than requested -- denied launches roll back to ready state.

**Test plan:**
- Assert sync messages are sent to the broker each poll cycle with active items
- Assert claim is called before each launch action
- Assert denied launches roll items back to ready state
- Assert all launches blocked when broker.isConnected() returns false
- Assert complete notification sent after merge

Acceptance: Crew coordination scenarios pass using MockBroker with the real orchestrateLoop.

Key files: `test/scenario/crew-coordination.test.ts`, `test/scenario/helpers.ts`, `core/mock-broker.ts`, `core/commands/orchestrate.ts:2021` (crew mode launch filtering)
