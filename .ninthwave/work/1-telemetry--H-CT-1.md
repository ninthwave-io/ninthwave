# Refactor: Strip cost flags from heartbeat CLI and agent instructions (H-CT-1)

**Priority:** High
**Source:** Manual review 2026-03-30
**Depends on:** None
**Domain:** telemetry

Remove `--tokens-in`, `--tokens-out`, and `--model` flags from `nw heartbeat`. These instruct AI agents to self-report token counts and model IDs, but agents cannot reliably access this data. Token counts are hallucinated, and the example model name in the implementer docs gets copied verbatim. Also remove the "Cost tracking" section from `agents/implementer.md` that documents these flags.

**Test plan:**
- Remove cost flag parsing tests from `test/heartbeat.test.ts` (~130 lines across 3 describe blocks)
- Remove cost field assertions from heartbeat write tests
- Verify `nw heartbeat --progress 0.5 --label "test"` still works without cost flags
- Run `bun test test/heartbeat.test.ts`

Acceptance: `nw heartbeat` no longer accepts `--tokens-in`, `--tokens-out`, or `--model` flags. `HeartbeatCostFields` type and `costFields` parameter removed from `writeHeartbeat()`. `WorkerProgress` no longer includes `model`, `inputTokens`, `outputTokens` fields. Implementer agent instructions no longer mention cost tracking. `bun test test/heartbeat.test.ts` passes.

Key files: `core/commands/heartbeat.ts:43`, `core/daemon.ts:476`, `agents/implementer.md:102`, `test/heartbeat.test.ts:310`
