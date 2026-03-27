# Refactor: Progress bar ownership + fix always-full bug (M-TUI-8)

**Priority:** Medium
**Source:** Friction — TUI/cmux duplicate status; progress bars always show 100%
**Depends on:** H-TUI-7
**Domain:** tui-status

## Problem

Two related issues:

1. **TUI/cmux duplication:** The cmux sidebar status pill and progress bar both show orchestrator lifecycle state, duplicating the TUI table.

2. **Progress bars always full:** Multiple converging bugs cause progress bars to always appear at 100%:
   - Stale heartbeat on launch: old `progress: 1.0` persists until worker's first heartbeat (~30-60s)
   - No heartbeat = no update: in `implementing` without heartbeat, `setProgress()` is never called, bar retains stale value
   - 5 of 8 active states hardcode 100%: `ci-pending`, `ci-passed`, `review-pending`, `merging`
   - `pr-open` state unhandled in `syncWorkerDisplay()`: in `activeStates` set but missing from switch

## Design: Split ownership

- **Status pill** (orchestrator-owned): lifecycle state — unchanged, already correct
- **Progress bar** (worker-primary, orchestrator-fallback): worker heartbeat label + progress pass through; orchestrator provides sensible defaults when worker is silent

| State | Progress | Label | Rationale |
|-------|----------|-------|-----------|
| `implementing`, `launching` | Heartbeat or 0% | Heartbeat label or none | Worker is active |
| `ci-failed` | Heartbeat or 0% | Heartbeat label or none | Worker is fixing CI |
| `ci-pending`, `pr-open` | 100% | No label | Worker idle, status pill says "CI Pending" |
| `ci-passed`, `review-pending` | 100% | No label | Worker idle, status pill says the state |
| `merging` | 100% | No label | Worker idle, status pill says "Merging" |

## Fix

### 1. Rewrite `syncWorkerDisplay()` (`core/commands/orchestrate.ts:338-385`)

```typescript
// Worker-active states: heartbeat pass-through, default to 0%
if (state === "implementing" || state === "launching" || state === "ci-failed") {
  if (heartbeat) {
    mux.setProgress(ref, Math.round(heartbeat.progress * 100), heartbeat.label);
  } else {
    mux.setProgress(ref, 0); // No label — waiting for first heartbeat
  }
}
// Worker-idle states: 100%, no label (status pill carries the message)
else {
  mux.setProgress(ref, 100);
}
```

### 2. Reset heartbeat on launch (`core/orchestrator.ts`, `executeLaunch()`)

Write a fresh heartbeat file with `progress: 0.0, label: "Starting"` when launching a worker. This prevents stale `1.0` from a previous run showing 100% during the startup gap.

### 3. Worker prompt label guidelines (`agents/todo-worker.md`)

Add a section after the heartbeat instructions:

```markdown
### Label guidelines

Your heartbeat labels appear in the cmux sidebar progress bar. The lifecycle state
(Implementing, CI Pending, etc.) is shown separately in the status pill by the orchestrator.

**Avoid these label values** (they duplicate the status pill):
Implementing, CI Pending, CI Failed, CI Passed, In Review, Merging, Done, Stuck, Rebasing, Queued

**Good labels describe your current activity:**
"Reading code", "Writing code", "Writing tests", "Running tests", "Fixing lint",
"Reviewing diff", "Creating PR", "Fixing CI", "Addressing feedback", "Rebasing onto main"
```

## Test plan

- Unit test: `syncWorkerDisplay()` with heartbeat → progress bar shows heartbeat value + label
- Unit test: `syncWorkerDisplay()` without heartbeat in `implementing` → progress bar shows 0%
- Unit test: `syncWorkerDisplay()` in `ci-pending` → progress bar shows 100%, no label
- Unit test: `syncWorkerDisplay()` in `pr-open` → progress bar shows 100%, no label (handles missing branch)
- Unit test: `executeLaunch()` writes fresh heartbeat with progress 0.0
- Verify worker prompt includes label guidelines

**Acceptance:** Progress bars start at 0% on launch and fill as worker heartbeats arrive. Worker labels ("Writing code", "Running tests") appear in the progress bar. Lifecycle state names never appear in the progress bar. The status pill continues to show lifecycle state. No more always-full progress bars.

**Key files:** `core/commands/orchestrate.ts:338-385` (syncWorkerDisplay), `core/orchestrator.ts` (executeLaunch, heartbeat reset), `agents/todo-worker.md` (label guidelines)
