# Docs: Make implementer rebase handling explicit and enforceable (H-RRR-5)

**Priority:** High
**Source:** Spec `.opencode/plans/1775079290582-curious-sailor.md`
**Depends on:** None
**Domain:** agent-prompts
**Lineage:** 7bd78594-51b2-4267-bac5-1d0fc394ffb5

Rewrite the implementer's rebase instructions so post-PR ownership is unambiguous: the daemon manages lifecycle, but a worker who receives a rebase request must act. Cover both structured orchestrator messages and plain-language inbox nudges, require rebase onto the correct base branch for stacked work, and align conflict handling with the dedicated rebaser guidance instead of telling the implementer to abort by default.

**Test plan:**
- Update prompt verification in `test/seed-agent-files.test.ts` so seeded implementer artifacts include the clarified daemon-vs-worker ownership language
- Add assertions for plain-language rebase message handling, stacked-base instructions, and stronger required-outcome wording
- Manually verify the markdown still reads clearly in `agents/implementer.md` after seeding-related tests pass

Acceptance: The seeded implementer prompt clearly states that rebase requests require action, names the correct base branch rules, and only permits abort-and-comment behavior for genuinely non-trivial conflicts.

Key files: `agents/implementer.md`, `test/seed-agent-files.test.ts`
