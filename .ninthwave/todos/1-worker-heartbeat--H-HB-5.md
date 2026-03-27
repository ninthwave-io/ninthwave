# Refactor: Update worker prompt to use nw heartbeat instead of cmux (H-HB-5)

**Priority:** High
**Source:** Plan: Worker Heartbeat System (2026-03-27)
**Depends on:** H-HB-3
**Domain:** worker-heartbeat

Replace all `cmux set-status` calls in `agents/todo-worker.md` with `nw heartbeat` calls. Workers should never call cmux directly -- the orchestrator owns sidebar display.

Also drop the "TODO" prefix from workspace names in `core/commands/start.ts` -- change the `--name` flag format from `TODO ${id}: ${safeTitle}` to `${id} ${safeTitle}`. The repo path is already shown at the bottom of each workspace tab, so no duplication.

Worker prompt changes (replace all cmux calls):
- Phase 3 (sync): `nw heartbeat --progress 0.0 --label "Starting"`
- Phase 4 (implement): `nw heartbeat --progress 0.1 --label "Reading code"`, progress 0.3 "Writing code", progress 0.5 "Writing tests"
- Phase 6 (test): `nw heartbeat --progress 0.7 --label "Tests passing"`
- Phase 7 (review): `nw heartbeat --progress 0.85 --label "Reviewed"`
- Phase 9 (PR created): `nw heartbeat --progress 1.0 --label "PR created"`
- Phase 11 CI fix: `nw heartbeat --progress 0.9 --label "Fixing CI"`
- Phase 11 feedback: `nw heartbeat --progress 0.85 --label "Addressing feedback"`
- Phase 11 rebase: `nw heartbeat --progress 0.95 --label "Rebasing"`

Remove all `cmux set-status "todo-YOUR_TODO_ID" ...` lines. Remove the "Set Status:" subsection headers. Add a brief progress update guidance section in Phase 4 explaining workers should call `nw heartbeat` at natural milestones.

**Test plan:**
- Manual review: verify no `cmux set-status` or `cmux set-progress` calls remain in `agents/todo-worker.md`
- Manual review: verify all phases have appropriate `nw heartbeat` calls
- Verify workspace name format change in `start.ts` (grep for "TODO" prefix)

Acceptance: Zero `cmux set-status` or `cmux set-progress` calls in the worker prompt. All worker phases report progress via `nw heartbeat`. Workspace names use `${id} ${safeTitle}` format (no "TODO" prefix). The orchestrator comment in `core/commands/orchestrate.ts` is updated to match the new workspace name pattern.

Key files: `agents/todo-worker.md`, `core/commands/start.ts`, `core/commands/orchestrate.ts`
