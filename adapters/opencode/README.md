# OpenCode Adapter

Placeholder for OpenCode integration with workflow-kit.

## TODO

- [ ] Research OpenCode's config/instruction file format (equivalent of `.claude/agents/` and `.claude/skills/`)
- [ ] Identify env vars set by OpenCode (for auto-detection in `detect_ai_tool()`)
- [ ] Determine how to launch OpenCode non-interactively with a system prompt
- [ ] Determine how to inject the worker prompt (equivalent of `--append-system-prompt`)
- [ ] Test cmux integration (workspace creation, send commands)
- [ ] Create OpenCode-native worker configuration
- [ ] Create OpenCode-native orchestration instructions (equivalent of `/todos` skill)

## Detection

OpenCode uses GitHub login. Check for env vars like `OPENCODE_SESSION`, `OPENCODE`, or process name matching `opencode`.

## Notes

OpenCode may support:
- A project instruction file (similar to CLAUDE.md)
- Non-interactive mode for automated sessions
- System prompt injection for worker context
