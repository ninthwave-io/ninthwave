# workflow-kit

Tool-agnostic batch TODO processing for AI coding assistants.

Decomposes features into PR-sized work items, launches parallel AI coding sessions to implement them, and orchestrates merging, rebasing, and version bumping.

## Supported AI Tools

| Tool | Status | Adapter |
|------|--------|---------|
| Claude Code | Working | `adapters/claude/` |
| OpenCode | Placeholder | `adapters/opencode/` |
| GitHub Copilot CLI | Placeholder | `adapters/copilot/` |

The tool is auto-detected from the orchestrator's environment. All workers launch with the same tool. Override with `WK_AI_TOOL=claude|opencode|copilot`.

## Quick Start

```bash
# Clone the repo
git clone git@github.com:roblambell/workflow-kit.git ~/code/workflow-kit

# Install into your project
cd /path/to/your/project
~/code/workflow-kit/install.sh

# Review and commit
git diff
git add -A && git commit -m "chore: install workflow-kit"
```

## What Gets Installed

### Core (all tools)

| File | Purpose |
|------|---------|
| `scripts/batch-todos.sh` | CLI for parsing TODOS.md, managing worktrees, launching sessions, monitoring PRs |
| `docs/guides/todos-format.md` | Format reference for TODOS.md |
| `TODOS.md` | Work item file (created if missing) |
| `.workflow-kit/config` | Project-specific settings (LOC extensions, domain mappings) |
| `.workflow-kit/domains.conf` | Custom domain slug mappings for section headers |

### Claude Code Adapter

| File | Purpose |
|------|---------|
| `.claude/skills/todos/SKILL.md` | Interactive orchestration (`/todos`) |
| `.claude/skills/decompose/SKILL.md` | Feature decomposition (`/decompose`) |
| `.claude/skills/todo-preview/SKILL.md` | Port-isolated dev servers |
| `.claude/agents/todo-worker.md` | Worker agent for implementing TODOs |

## How It Works

### 1. Decompose

Break a feature into TODO items:

```
/decompose
```

Or write them directly to `TODOS.md` following `docs/guides/todos-format.md`.

### 2. Process

Launch parallel AI sessions to implement TODOs:

```
/todos
```

This orchestrates:
- **SELECT**: Choose items, analyse dependencies, check for conflicts
- **LAUNCH**: Create worktrees, launch parallel sessions via cmux
- **MONITOR**: Watch for PR creation, CI status, review activity
- **MERGE**: Squash merge PRs, rebase dependents, handle failures
- **FINALIZE**: Version bump, clean worktrees, mark done

### 3. Standalone CLI

The script works without any AI tool:

```bash
# List ready items
scripts/batch-todos.sh list --ready

# Check dependencies
scripts/batch-todos.sh deps H-BF5-3

# Check for conflicts between items
scripts/batch-todos.sh conflicts H-BF5-1 H-BF5-2 H-BF5-3

# Launch sessions (auto-detects AI tool)
scripts/batch-todos.sh start H-BF5-1 H-BF5-2

# Check status
scripts/batch-todos.sh status

# Watch for PR readiness
scripts/batch-todos.sh watch-ready

# Bump version based on commits
scripts/batch-todos.sh version-bump
```

## Project Configuration

### `.workflow-kit/config`

```bash
# File extensions for LOC counting in version-bump
LOC_EXTENSIONS="*.ts *.tsx *.py *.go"

# Custom domain mappings file
DOMAINS_FILE=.workflow-kit/domains.conf
```

### `.workflow-kit/domains.conf`

Map TODOS.md section headers to domain slugs for filtering:

```
auth=auth
infrastructure=infra
frontend=frontend
payments=payments
```

Without this file, domains are auto-slugified from section headers.

## Updating

Re-run the install script. It overwrites core and adapter files but preserves project-specific config:

```bash
~/code/workflow-kit/install.sh --project-dir /path/to/project --adapter claude
git diff  # review changes
git commit -am "chore: update workflow-kit"
```

## Architecture

```
workflow-kit/
├── core/
│   ├── batch-todos.sh          # Universal CLI (tool-agnostic)
│   └── docs/
│       └── todos-format.md     # Format reference
├── prompts/
│   └── todo-worker-base.md     # Generic worker instructions (reference)
├── adapters/
│   ├── claude/                 # Claude Code integration
│   │   ├── skills/             # /todos, /decompose, /todo-preview
│   │   └── agents/             # todo-worker agent
│   ├── opencode/               # OpenCode (placeholder)
│   └── copilot/                # Copilot CLI (placeholder)
├── install.sh                  # Project installer
└── README.md
```

The key design principle: **project-specific context lives in the project** (CLAUDE.md, .opencode.md, etc.), not in workflow-kit. The worker reads the project's instruction file for coding conventions, test commands, and architecture docs.

## Dependencies

- **git** -- worktree management, PR checks
- **gh** -- GitHub CLI for PR operations
- **cmux** -- terminal multiplexer for parallel sessions
- An AI coding tool (Claude Code, OpenCode, or Copilot CLI)
