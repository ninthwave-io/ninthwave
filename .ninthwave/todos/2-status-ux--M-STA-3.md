# Feat: Show full queue and WIP info in status (M-STA-3)

**Priority:** Medium
**Source:** Status & daemon UX improvements (2026-03-25)
**Depends on:** H-STA-1, H-STA-2
**Domain:** status-ux

Show queued/waiting items in the status display alongside active items, with visual grouping and WIP slot usage info.

Changes to `core/commands/status.ts`:
1. Add `"queued"` to `ItemState` type union
2. `mapDaemonItemState`: map orchestrator `queued`/`ready` to display `"queued"` (currently falls to `"in-progress"`)
3. `stateColor("queued")` → `DIM`, `stateLabel("queued")` → `"Queued"`
4. Update `formatStatusTable(items, termWidth, wipLimit?)` to group items visually:
   - Active items (not merged, not queued) at top
   - Queue section with header: `"Queue (N waiting, X/Y WIP slots active)"`
   - Queued rows rendered fully dimmed
5. Add `"queued"` to `formatBatchProgress` display order
6. Thread `wipLimit` from `daemonState.wipLimit` through `renderStatus` to `formatStatusTable`

Changes to `core/daemon.ts`:
- Add `wipLimit?: number` to `DaemonState` interface (may already exist from H-STA-2 extras)

Changes to `core/commands/orchestrate.ts`:
- Thread `config.wipLimit` (or effectiveWip) through `serializeOrchestratorState` extras

**Test plan:**
- `mapDaemonItemState("queued")` returns `"queued"`, `mapDaemonItemState("ready")` returns `"queued"`
- `stateColor("queued")` returns DIM, `stateLabel("queued")` returns "Queued"
- `formatStatusTable` with mixed active + queued items shows queue section with header
- `formatStatusTable` with wipLimit shows slot usage in queue header
- `formatStatusTable` with only queued items shows queue section, no active section
- `formatBatchProgress` includes queued count
- `bun test test/` — all tests pass

Acceptance: Running `ninthwave status` during orchestration shows active items at top, queued items below with a "Queue" header, and WIP slot usage. Queued items are visually dimmed.

Key files: `core/commands/status.ts`, `core/daemon.ts`, `core/commands/orchestrate.ts`, `test/status.test.ts`
