# Fix: Retry stale rebase requests and escalate predictably (H-RRR-3)

**Priority:** High
**Source:** Spec `.opencode/plans/1775079290582-curious-sailor.md`
**Depends on:** H-RRR-2
**Domain:** rebase-reliability
**Lineage:** 3092d9db-ab43-47b0-811e-35646da7805b

Teach the orchestrator to treat `rebaseRequested` as a bounded retry flow instead of a sticky one-shot nudge. When merge conflicts persist with no observable progress, resend a rebase request after a delay, clear retry bookkeeping on progress or resolution, and escalate to the dedicated rebaser after the configured stale intervals instead of waiting forever.

**Test plan:**
- Update `test/orchestrator.test.ts` so first conflict detection still emits exactly one initial `daemon-rebase`
- Add coverage for stale conflict resend, second stale interval escalation to rebaser, and retry bookkeeping reset on CI restart, commit activity, or mergeability recovery
- Extend `test/daemon-rebase.test.ts` for the action-layer escalation path and the existing `maxRebaseAttempts` circuit breaker

Acceptance: Persistent merge conflicts no longer leave items stuck in a long-lived requested state with no follow-up. The orchestrator resends once progress is stale, escalates to a rebaser on repeated staleness, and clears retry state when progress resumes.

Key files: `core/orchestrator.ts`, `core/orchestrator-actions.ts`, `test/orchestrator.test.ts`, `test/daemon-rebase.test.ts`
