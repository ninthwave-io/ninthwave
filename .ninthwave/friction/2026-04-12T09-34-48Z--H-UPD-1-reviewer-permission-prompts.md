item: H-UPD-1
date: 2026-04-12T09:34:48Z
severity: medium
description: Reviewer workflow triggered a permission prompt when a subagent tried to inspect the repo root outside the worktree (`~/code/ninthwave`). Reviewers should stay within the assigned worktree or have repo-root access preauthorized so review does not block on directory prompts.
