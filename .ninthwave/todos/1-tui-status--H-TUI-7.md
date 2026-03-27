# Fix: Display "Rebasing" state in TUI and cmux when rebase is in progress (H-TUI-7)

**Priority:** High
**Source:** Friction — rebasing state displayed as "CI Pending" in TUI and cmux
**Depends on:** None
**Domain:** tui-status

## Problem

When the orchestrator triggers a rebase (daemon-side or worker-side), the item stays in `ci-pending` or `ci-failed` with `rebaseRequested=true`. The display functions `statusDisplayForState()` and `mapDaemonItemState()` only look at `item.state`, so the TUI shows "CI Pending" and cmux shows a cyan clock icon — both misleading when the actual operation is a rebase.

## Design: Composite display state (not a new state machine state)

A rebase is a transient *operation* overlaid on an existing lifecycle state, not a lifecycle state itself. The display layer computes a composite display state from `(item.state, item.flags)`.

## Fix

1. **`statusDisplayForState()`** (`core/orchestrator.ts:354-377`): Add optional second parameter `{ rebaseRequested?: boolean }`. When `rebaseRequested === true` and state is `ci-pending` or `ci-failed`, return:
   ```typescript
   { text: "Rebasing", icon: "arrow.triangle.branch", color: "#f59e0b" }
   ```

2. **`ItemState` type** (`core/status-render.ts:33-42`): Add `"rebasing"` to the union type.

3. **Icon/label/color** (`core/status-render.ts:137-185`): Add mappings:
   - `stateIcon("rebasing")` → `"⟲"` (or `"↻"`)
   - `stateLabel("rebasing")` → `"Rebasing"`
   - `stateColor("rebasing")` → YELLOW

4. **`mapDaemonItemState()`** (`core/status-render.ts:797-824`): Accept rebase flag. Return `"rebasing"` when flag is set and state is `ci-pending` or `ci-failed`.

5. **Persist `rebaseRequested`** in `serializeOrchestratorState()` (`core/daemon.ts`) — sparse, only when true. Add to `DaemonStateItem` interface. Restore in `reconstructState()`.

6. **Update callers:**
   - `syncWorkerDisplay()` (`core/commands/orchestrate.ts:358`): pass `item.rebaseRequested`
   - `daemonStateToStatusItems()` (`core/status-render.ts`): pass `rebaseRequested` from `DaemonStateItem`

## Test plan

- Unit test: `statusDisplayForState("ci-pending", { rebaseRequested: true })` returns "Rebasing" display
- Unit test: `statusDisplayForState("ci-pending")` returns "CI Pending" display (backward compat)
- Unit test: `statusDisplayForState("ci-failed", { rebaseRequested: true })` returns "Rebasing"
- Unit test: `mapDaemonItemState("ci-pending", { rebaseRequested: true })` returns `"rebasing"`
- Unit test: `rebaseRequested` round-trips through serialization
- Unit test: TUI table render shows rebasing icon/label for flagged items

**Acceptance:** When a rebase is in progress, both TUI and cmux show "Rebasing" (not "CI Pending"). When the rebase completes and CI starts (state transitions clear the flag), display reverts to "CI Pending".

**Key files:** `core/orchestrator.ts:354-377` (statusDisplayForState), `core/status-render.ts:33-42,137-185,797-824` (ItemState, icons, labels, mapDaemonItemState), `core/daemon.ts` (serialization), `core/commands/orchestrate.ts` (callers)
