# GitHub Copilot CLI Adapter

Placeholder for GitHub Copilot CLI integration with workflow-kit.

## TODO

- [ ] Research Copilot CLI's instruction/config format
- [ ] Identify env vars set by Copilot CLI (for auto-detection in `detect_ai_tool()`)
- [ ] Determine how to launch Copilot CLI non-interactively with a prompt
- [ ] Determine how to inject the worker prompt
- [ ] Test cmux integration (workspace creation, send commands)
- [ ] Create Copilot-native worker configuration
- [ ] Create Copilot-native orchestration instructions

## Detection

Check for env vars like `GITHUB_COPILOT_SESSION`, `COPILOT_CLI`, or process name matching `copilot`.

## Notes

Copilot CLI may work differently from Claude Code:
- It may not have a persistent session model
- Prompt injection may need to happen via stdin or a config file
- The `gh copilot` subcommand structure may require different invocation patterns
