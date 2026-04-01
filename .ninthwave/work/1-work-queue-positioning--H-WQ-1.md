# Docs: Clarify the active queue model in top-level docs (H-WQ-1)

**Priority:** High
**Source:** Manual request 2026-04-01 -- reinforce that delete-on-complete is an intentional queue design choice
**Depends on:** None
**Domain:** work-queue-positioning

Update the top-level docs so they explain early and plainly that `.ninthwave/work/` is the live queue of open work, not a permanent tracker. The docs should also point users to PRs, git history, `nw history`, and `nw logs` for retrospective lookup so the absence of a `done/` lane reads as intentional rather than missing functionality.

**Test plan:**
- Manually review `README.md` and `docs/faq.md` for one consistent explanation of queue semantics, completion, and retrospective lookup
- Verify any referenced commands such as `nw history` and `nw logs` match current CLI help and behavior descriptions
- Grep the touched docs for contradictory wording such as tracker-style framing or stale `todo` language and rewrite or remove it

Acceptance: `README.md` and `docs/faq.md` both introduce `.ninthwave/work/` as the active queue of open work, explain why completed items disappear from that directory, and direct users to the existing history/PR surfaces for looking back.

Key files: `README.md`, `docs/faq.md`
