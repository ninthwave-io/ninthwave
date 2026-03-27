# Refactor: Make setup command interactive with agent file selection (M-IST-1)

**Priority:** Medium
**Source:** Dogfooding observation (2026-03-27)
**Depends on:** —
**Domain:** setup

The `ninthwave setup` command currently auto-creates agent files (todo-worker, review-worker, supervisor) in tool directories (`.claude/agents/`, `.github/agents/`, `.opencode/agents/`) without user consent. This leads to unexpected untracked files and confusion about where they came from.

Refactor setup to be interactive:

1. **Auto-detect installed AI tools** — check for `.claude/`, `.github/copilot/`, `.opencode/` directories or config files to determine which tools the user has.
2. **Checkbox selection UI** — present a multi-select list of agent files to install, with detected tools pre-selected. Use an interactive checkbox UI (e.g., `@inquirer/prompts` or similar).
3. **Show what will be created** — before creating anything, display the list of symlinks that will be created and ask for confirmation.
4. **Symlink, don't copy** — all agent files should be symlinked to `agents/*.md` (the source of truth), not copied. This matches the existing `todo-worker.md` pattern.
5. **Idempotent** — if symlinks already exist and point to the right place, skip them. If a regular file exists where a symlink should be, warn and offer to replace.

Example UX:
```
Detected AI tools: Claude Code, GitHub Copilot, OpenCode

Which agent files should be set up? (space to toggle, enter to confirm)
  [x] todo-worker   — implementation agent for batch TODO processing
  [x] review-worker — PR code review agent
  [x] supervisor    — pipeline monitoring agent
  [ ] custom...     — add a custom agent file

Will create:
  .claude/agents/todo-worker.md -> ../../agents/todo-worker.md
  .claude/agents/supervisor.md -> ../../agents/supervisor.md
  ...

Proceed? (Y/n)
```

Acceptance: `ninthwave setup` presents an interactive agent selection UI. No files are created without user confirmation. All agent files are symlinks. Running setup twice is idempotent.

Key files: `core/commands/setup.ts`
