# Feat: nw heartbeat CLI command and file I/O helpers (H-HB-1)

**Priority:** High
**Source:** Plan: Worker Heartbeat System (2026-03-27)
**Depends on:** None
**Domain:** worker-heartbeat

Add a new `nw heartbeat` CLI command that workers call to report progress. The command auto-detects the TODO ID from the current git branch (`todo/{ID}`), writes a JSON heartbeat file to `~/.ninthwave/projects/{slug}/heartbeats/{id}.json`, and exits immediately. No network calls, no cmux calls -- just a fast file write.

Add path helpers to `core/daemon.ts`: `heartbeatDir(projectRoot)` and `heartbeatFilePath(projectRoot, itemId)`. Add a `WorkerProgress` interface: `{ id: string; progress: number; label: string; ts: string }`. Add `readHeartbeat(projectRoot, itemId)` and `writeHeartbeat(projectRoot, id, progress, label)` functions.

Register the command in `core/cli.ts`: add to COMMANDS array, add `"heartbeat"` to the needsTodos exclusion list, add the switch case.

CLI usage: `nw heartbeat --progress 0.3 --label "Writing tests"`

**Test plan:**
- Unit test: `writeHeartbeat` creates the file with correct JSON structure
- Unit test: `readHeartbeat` returns parsed data, returns null for missing file
- Unit test: `cmdHeartbeat` parses --progress and --label flags correctly
- Unit test: progress value validation (reject < 0.0 or > 1.0)
- Unit test: branch detection extracts ID from `todo/H-FOO-1` branch name, errors on non-todo branch

Acceptance: `nw heartbeat --progress 0.5 --label "test"` writes a valid JSON file to `~/.ninthwave/projects/{slug}/heartbeats/{id}.json` when run inside a todo worktree. Command exits with code 0 on success, non-zero on invalid args or non-todo branch. Tests pass.

Key files: `core/cli.ts`, `core/commands/heartbeat.ts` (new), `core/daemon.ts`, `test/heartbeat.test.ts` (new)
