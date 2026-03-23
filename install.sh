#!/usr/bin/env bash
# Install workflow-kit into a project directory.
#
# Usage: ./install.sh [--project-dir /path/to/project] [--adapter claude|opencode|copilot]
#
# Copies core files and adapter-specific files into the target project.
# Files are committed to the project repo so teammates get them via git pull.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults
PROJECT_DIR=""
ADAPTER=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    --adapter)     ADAPTER="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--project-dir /path/to/project] [--adapter claude|opencode|copilot]"
      echo
      echo "Options:"
      echo "  --project-dir   Target project directory (default: current directory)"
      echo "  --adapter       AI tool adapter to install (default: auto-detect or ask)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Default to current directory
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

# Verify it's a git repo
if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  echo "Error: $PROJECT_DIR is not a git repository"
  exit 1
fi

echo "Installing workflow-kit into: $PROJECT_DIR"

# --- Core files ---

echo "Installing core files..."

# batch-todos.sh
mkdir -p "$PROJECT_DIR/scripts"
cp "$SCRIPT_DIR/core/batch-todos.sh" "$PROJECT_DIR/scripts/batch-todos.sh"
chmod +x "$PROJECT_DIR/scripts/batch-todos.sh"
echo "  scripts/batch-todos.sh"

# TODOS format guide
mkdir -p "$PROJECT_DIR/docs/guides"
cp "$SCRIPT_DIR/core/docs/todos-format.md" "$PROJECT_DIR/docs/guides/todos-format.md"
echo "  docs/guides/todos-format.md"

# TODOS.md (only if it doesn't exist)
if [[ ! -f "$PROJECT_DIR/TODOS.md" ]]; then
  cat > "$PROJECT_DIR/TODOS.md" << 'EOF'
# TODOS

<!-- Format guide: docs/guides/todos-format.md -->
EOF
  echo "  TODOS.md (created)"
else
  echo "  TODOS.md (already exists, skipped)"
fi

# .workflow-kit directory
mkdir -p "$PROJECT_DIR/.workflow-kit"

# Sample config (only if it doesn't exist)
if [[ ! -f "$PROJECT_DIR/.workflow-kit/config" ]]; then
  cat > "$PROJECT_DIR/.workflow-kit/config" << 'CONF'
# workflow-kit project configuration
# All settings are optional -- sensible defaults are used.

# File extensions for LOC counting in version-bump (space-separated glob patterns)
# LOC_EXTENSIONS="*.ts *.tsx *.js *.jsx *.py *.go"

# Path to domain mapping file (optional)
# DOMAINS_FILE=.workflow-kit/domains.conf
CONF
  echo "  .workflow-kit/config (created)"
else
  echo "  .workflow-kit/config (already exists, skipped)"
fi

# Sample domains.conf (only if it doesn't exist)
if [[ ! -f "$PROJECT_DIR/.workflow-kit/domains.conf" ]]; then
  cat > "$PROJECT_DIR/.workflow-kit/domains.conf" << 'DOMAINS'
# Domain mappings for batch-todos.sh
# Format: pattern=domain_key
# Patterns are matched case-insensitively against section headers in TODOS.md.
# Lines starting with # are comments.
#
# Examples:
# auth=auth
# infrastructure=infra
# frontend=frontend
# database=db
DOMAINS
  echo "  .workflow-kit/domains.conf (created)"
else
  echo "  .workflow-kit/domains.conf (already exists, skipped)"
fi

# --- Ensure .gitignore has worktree entries ---

if [[ -f "$PROJECT_DIR/.gitignore" ]]; then
  if ! grep -q "^\.worktrees/" "$PROJECT_DIR/.gitignore" 2>/dev/null; then
    echo "" >> "$PROJECT_DIR/.gitignore"
    echo "# workflow-kit worktrees" >> "$PROJECT_DIR/.gitignore"
    echo ".worktrees/" >> "$PROJECT_DIR/.gitignore"
    echo "  .gitignore (added .worktrees/)"
  fi
else
  cat > "$PROJECT_DIR/.gitignore" << 'GITIGNORE'
# workflow-kit worktrees
.worktrees/
GITIGNORE
  echo "  .gitignore (created with .worktrees/)"
fi

# --- Adapter files ---

if [[ -z "$ADAPTER" ]]; then
  echo
  echo "Which AI tool adapter should be installed?"
  echo "  1) claude    -- Claude Code (.claude/skills/ and .claude/agents/)"
  echo "  2) opencode  -- OpenCode (placeholder -- not yet implemented)"
  echo "  3) copilot   -- GitHub Copilot CLI (placeholder -- not yet implemented)"
  echo "  4) skip      -- Install core only, add adapter later"
  read -rp "Choice [1/2/3/4]: " choice
  case "$choice" in
    1) ADAPTER="claude" ;;
    2) ADAPTER="opencode" ;;
    3) ADAPTER="copilot" ;;
    4) ADAPTER="" ;;
    *) echo "Invalid choice"; exit 1 ;;
  esac
fi

if [[ -n "$ADAPTER" ]]; then
  echo
  echo "Installing $ADAPTER adapter..."

  case "$ADAPTER" in
    claude)
      # Skills
      mkdir -p "$PROJECT_DIR/.claude/skills/todos"
      mkdir -p "$PROJECT_DIR/.claude/skills/decompose"
      mkdir -p "$PROJECT_DIR/.claude/skills/todo-preview"
      cp "$SCRIPT_DIR/adapters/claude/skills/todos/SKILL.md" "$PROJECT_DIR/.claude/skills/todos/SKILL.md"
      cp "$SCRIPT_DIR/adapters/claude/skills/decompose/SKILL.md" "$PROJECT_DIR/.claude/skills/decompose/SKILL.md"
      cp "$SCRIPT_DIR/adapters/claude/skills/todo-preview/SKILL.md" "$PROJECT_DIR/.claude/skills/todo-preview/SKILL.md"
      echo "  .claude/skills/todos/SKILL.md"
      echo "  .claude/skills/decompose/SKILL.md"
      echo "  .claude/skills/todo-preview/SKILL.md"

      # Agent
      mkdir -p "$PROJECT_DIR/.claude/agents"
      cp "$SCRIPT_DIR/adapters/claude/agents/todo-worker.md" "$PROJECT_DIR/.claude/agents/todo-worker.md"
      echo "  .claude/agents/todo-worker.md"
      ;;

    opencode)
      echo "  OpenCode adapter is a placeholder. See adapters/opencode/README.md for TODO items."
      ;;

    copilot)
      echo "  Copilot CLI adapter is a placeholder. See adapters/copilot/README.md for TODO items."
      ;;
  esac
fi

# --- Version tracking ---

# Record which version of workflow-kit was installed
local_version="$(cd "$SCRIPT_DIR" && git describe --tags --always 2>/dev/null || echo "unknown")"
echo "$local_version" > "$PROJECT_DIR/.workflow-kit/version"
echo "  .workflow-kit/version ($local_version)"

echo
echo "Done! Next steps:"
echo "  1. Review the installed files with: git diff"
echo "  2. Commit them to your project: git add -A && git commit -m 'chore: install workflow-kit'"
echo "  3. Create a TODOS.md section and run /todos (or scripts/batch-todos.sh) to start processing"
echo
echo "To update later, re-run this install script and review the diff."
