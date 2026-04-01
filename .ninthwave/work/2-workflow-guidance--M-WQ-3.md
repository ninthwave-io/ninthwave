# Docs: Reinforce queue semantics in onboarding and agent guidance (M-WQ-3)

**Priority:** Medium
**Source:** Manual request 2026-04-01 -- make the live-queue mental model explicit in guidance surfaces
**Depends on:** None
**Domain:** workflow-guidance

Update onboarding, `/work` guidance, and human-readable agent prose so they explain that `/decompose` populates the live queue, `nw` works through it, and completed work is meant to be looked up through PRs and history surfaces rather than retained in a `done` lane. Keep protocol variable names and worker handoff mechanics stable; this is primarily a copy and guidance pass.

**Test plan:**
- Manually review onboarding, skill, and agent prose for one consistent explanation of queue population, completion, and retrospective lookup
- If any onboarding output strings change in `core/commands/onboard.ts`, update the relevant expectations in `test/onboard.test.ts`
- Verify prompt variables and worker-facing protocol names such as `YOUR_TODO_ID` remain unchanged where they are part of the launched-agent contract

Acceptance: onboarding and guidance surfaces explain the active-queue model clearly, point users at PR/history surfaces for retrospectives, and do not rename worker protocol fields or change orchestration behavior.

Key files: `docs/onboarding.md`, `skills/work/SKILL.md`, `agents/implementer.md`, `agents/reviewer.md`, `agents/rebaser.md`, `core/commands/onboard.ts`, `test/onboard.test.ts`
