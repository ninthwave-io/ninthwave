# Fix: Persist CI notification dedup flags + living PR comment (H-NTF-1)

**Priority:** High
**Source:** Friction — orchestrator posts duplicate CI failure comments on PR
**Depends on:** None
**Domain:** notify

## Problem

The orchestrator posts duplicate CI failure comments on PRs. Root cause: `ciFailureNotified` and `ciFailureNotifiedAt` dedup flags on `OrchestratorItem` are not persisted in `serializeOrchestratorState()` (`core/daemon.ts`). When state is written to disk and reloaded, the dedup flags are lost and the same comment is posted again.

Beyond the persistence bug, the current model of appending discrete comments per event creates noise on PRs.

## Fix — Two parts

### Part 1: Persist dedup flags (defense-in-depth)

Add the two fields to serialization in `serializeOrchestratorState()` (`core/daemon.ts:392-409`):
```typescript
...(item.ciFailureNotified ? { ciFailureNotified: item.ciFailureNotified } : {}),
...(item.ciFailureNotifiedAt ? { ciFailureNotifiedAt: item.ciFailureNotifiedAt } : {}),
```

Add to `DaemonStateItem` interface. Add restoration in `reconstructState()` (`core/commands/orchestrate.ts`).

### Part 2: Living PR comment (upsert pattern)

Replace discrete `**[Orchestrator]** CI failure detected...` comments with a single living comment per PR, updated in place. Reuse the `GhCommentClient` interface from `core/stack-comments.ts` and its marker-based find-and-update pattern.

**Marker:** `<!-- ninthwave-orchestrator-status -->`

**Comment format:** Timestamped table with rows appended for each event:
```markdown
<!-- ninthwave-orchestrator-status -->
**[Orchestrator]** Status for H-FOO-1

| Time | Event |
|------|-------|
| 14:02 | CI failure detected. Worker notified. |
| 14:15 | Rebase triggered (merge conflicts). |
| 14:16 | Rebase succeeded. CI re-running. |
| 15:01 | CI passed. Auto-merged. |
```

**Implementation:**
- Add `listPrComments()` and `updatePrComment()` wrappers to `core/gh.ts` (or reuse `GhCommentClient` interface)
- Create `upsertOrchestratorComment(repoRoot, prNumber, itemId, eventLine)` utility that: lists comments → finds marker → appends row → updates (or creates if first event)
- Replace `deps.prComment()` calls in `executeNotifyCiFailure()`, `executeDaemonRebase()`, and `executeMerge()` with `upsertOrchestratorComment()` calls
- Add `prCommentClient` to `OrchestratorDeps` (optional, for testability)

## Test plan

- Unit test: serialize/deserialize round-trip of `ciFailureNotified` and `ciFailureNotifiedAt`
- Unit test: `upsertOrchestratorComment` creates comment when none exists
- Unit test: `upsertOrchestratorComment` finds existing marker comment and appends row
- Unit test: `upsertOrchestratorComment` handles deleted marker comment (creates new)
- Integration: CI failure → comment created → state reloaded → CI still failing → verify single comment updated (no duplicate)

**Acceptance:** CI failure comments are never duplicated. All orchestrator events on a PR appear as rows in a single living comment. The `ciFailureNotified` flag survives daemon restarts.

**Key files:** `core/daemon.ts` (serialization, DaemonStateItem), `core/commands/orchestrate.ts` (reconstructState), `core/orchestrator.ts` (executeNotifyCiFailure, executeDaemonRebase, executeMerge), `core/gh.ts` (GitHub API wrappers), `core/stack-comments.ts` (reusable GhCommentClient pattern)
