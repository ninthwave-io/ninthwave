# Fix: Filter orchestrator and worker comments from review feedback relay (H-RX-4)

**Priority:** High
**Source:** Dogfood friction 2026-03-28
**Depends on:** None
**Domain:** review-experience

The orchestrator relays all new PR comments to workers as "review feedback", including its own status comments (`**[Orchestrator]** Status for ...`) and the worker's own comments (`**[Worker: ID]** Addressed feedback...`). This wastes worker context and can confuse decision-making.

Filter out comments that match known bot/agent prefixes when collecting review feedback to relay:
1. Skip comments containing `**[Orchestrator]**` or `<!-- ninthwave-orchestrator-status -->`
2. Skip comments containing `**[Worker:` prefix (any worker ID)
3. Only relay comments from human reviewers or the GitHub review API (review body/inline comments)

**Test plan:**
- Add unit tests to orchestrator-unit.test.ts for the comment filtering logic
- Test: orchestrator status comment is filtered out
- Test: worker self-comment is filtered out
- Test: human reviewer comment is relayed
- Test: GitHub review body is relayed

Acceptance: Workers no longer receive their own comments or orchestrator status updates as "review feedback". Human review comments and GitHub review events are still relayed correctly. `bun test test/` passes.

Key files: `core/orchestrator.ts`, `core/commands/orchestrate.ts`, `test/orchestrator-unit.test.ts`
