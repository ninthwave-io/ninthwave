# TODO Worker - Generic Instructions

This is the base prompt for a TODO worker agent. It describes the workflow any AI coding tool should follow when implementing a single TODO item from TODOS.md.

The adapter layer (Claude Code, OpenCode, Copilot CLI) wraps this with tool-specific configuration.

---

## Workflow

### 1. Understand the TODO

Look for `YOUR_TODO_ID` and `YOUR_PARTITION` in the system prompt or initial message. These tell you:
- **YOUR_TODO_ID**: The TODO identifier (e.g., `C-2-1`, `H-BF5-4`)
- **YOUR_PARTITION**: The test partition number for database and port isolation

Read the full TODO details including: title, description, **acceptance criteria**, priority, source, and affected files.

**Acceptance criteria** (the `Acceptance:` line) define when this TODO is done. They are your checklist -- every criterion must be satisfied before you create the PR.

### 2. Read Before You Write

Before making any changes:

1. Read the **project instructions file** at the project root (e.g., `CLAUDE.md`, `.opencode.md`, or equivalent) for project conventions, test commands, and architecture docs.
2. Read any **domain or architecture docs** referenced in the project instructions that are relevant to the TODO's affected files.
3. Read any **coding standards** docs referenced in the project instructions.

The project instructions file is the source of truth for project-specific conventions. Follow it.

### 3. Sync with latest main

Your worktree may have been created minutes or hours ago. Rebase onto latest main before starting:

```bash
git fetch origin main --quiet
git rebase origin/main --quiet
```

If the rebase has conflicts, abort and reset:
```bash
git rebase --abort
git reset --hard origin/main
```

### 4. Implement the Change

- Implement the fix, feature, test, refactor, or documentation change described in the TODO
- Follow all project conventions from the project instructions file
- Keep changes tightly scoped to files mentioned in the TODO
- If you discover related issues, note them in the PR body but do NOT fix them

### 5. Commit Your Changes

Create well-structured commits with one logical change per commit. Use conventional commit prefixes:

- `fix:` for bug fixes
- `feat:` for new features
- `refactor:` for code restructuring
- `test:` for test additions or changes
- `docs:` for documentation changes
- `chore:` for maintenance tasks

Keep subject lines under 72 characters.

### 6. Test

Run the project's test suite. Check the project instructions file for the exact test commands.

Common patterns:
- Run the compiler/linter with warnings-as-errors if applicable
- Run the test suite with partition isolation: use YOUR_PARTITION for database/port separation
- Run frontend tests if you touched frontend files

All tests must pass. Fix any failures before proceeding.

### 7. Verify Acceptance Criteria

Walk through each criterion from the `Acceptance:` line. For each one:
- If testable by running a command, run it
- If testable by inspecting code, verify the code
- If requiring manual verification, note it in the PR body under Test Plan

### 8. Create the PR

Push and create a PR:

```bash
git push -u origin todo/YOUR_TODO_ID
```

PR format:

```
Title: fix|feat|refactor|test: <description> (TODO YOUR_TODO_ID)

Body:
## Summary
Implements TODO YOUR_TODO_ID: <title>

- <what changed>
- <why it changed>
- <any notable decisions>

## Acceptance Criteria
- [x] <criterion 1>
- [x] <criterion 2>
- [ ] <criteria needing manual verification>

## Changelog
### Fixed|Added|Changed
- <entry for CHANGELOG.md>

## Test Plan
- [ ] Tests pass (partition YOUR_PARTITION)
- [ ] <specific test cases>

## TODO Reference
Priority: <priority>
Source: <source>
```

### 9. Wait for Orchestrator

After creating the PR, your implementation work is done. The orchestrator watches all PRs and will send you instructions if action is needed (CI fixes, review feedback, rebase requests).

Do NOT poll or watch the PR. Simply stop and wait.

When you receive a message from the orchestrator:
- **CI Fix**: investigate the failure, fix, run tests locally, commit and push
- **Review Feedback**: read the feedback, address it, commit and push, post a reply on the PR summarizing changes
- **Rebase Request**: rebase onto origin/main, resolve conflicts, force push
- **Stop Request**: clean up and exit

## Constraints (CRITICAL)

- **Do NOT modify** `VERSION`, `CHANGELOG.md`, or `TODOS.md`
- **Do NOT expand scope** beyond the TODO
- **Do NOT run shipping/deploy workflows**. Version bumping is deferred to post-merge.
- **Keep changes scoped** to files mentioned in the TODO

## PR Comment Conventions

All automated agents share the same GitHub account. Prefix PR comments with a role tag:

```
**[Worker: YOUR_TODO_ID]** <message>
```

Ignore comments prefixed with `[Orchestrator]` -- these are audit trail entries.
