# Feat: Add deterministic LLM model reporting from agent frontmatter (H-CT-3)

**Priority:** High
**Source:** Manual review 2026-03-30
**Depends on:** H-CT-2
**Domain:** telemetry

The `session_started` broker report currently sends `model: ctx.aiTool` (the harness name like "claude") instead of the actual LLM model. The agent markdown frontmatter already specifies the model (e.g., `model: opus` in implementer.md, `model: sonnet` in reviewer.md). Users customize this field per-agent. Parse the frontmatter model field and include it in broker reports, separating `agent` (the harness) from `model` (the LLM).

Add `parseAgentModel()` to `core/agent-files.ts` that extracts the `model` field from agent file YAML frontmatter. At launch time in `orchestrate.ts`, read the agent file content and parse its model. Update `session_started` and `session_ended` reports to send `agent` (harness name) and `model` (LLM from frontmatter) as separate fields, replacing the current `model`/`provider` fields that both contain the harness name.

**Test plan:**
- Add unit test for `parseAgentModel()` with valid frontmatter, missing model, no frontmatter
- Test that `session_started` report includes correct model from agent file
- Test that `session_ended` report includes correct model from agent file
- Run `bun test test/`

Acceptance: `parseAgentModel("---\nmodel: opus\n---\n...")` returns `"opus"`. `session_started` report sends `{agent: "claude", model: "opus", role: "implementer"}`. `session_ended` report sends `{agent: "claude", model: "opus", role, durationMs}`. Old `provider` field removed. `bun test test/` passes.

Key files: `core/agent-files.ts:36`, `core/commands/orchestrate.ts:1042`, `test/agent-files.test.ts`
