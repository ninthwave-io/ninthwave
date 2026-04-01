# Fix: Make rebase status display truthful (H-RRR-1)

**Priority:** High
**Source:** Spec `.opencode/plans/1775079290582-curious-sailor.md`
**Depends on:** None
**Domain:** status-rendering
**Lineage:** b737bfde-3863-4129-8792-8e3f477308f4

Stop rendering `rebaseRequested` as active `Rebasing` in the shared status table and cmux status pills. The UI should continue to show the underlying lifecycle state (`CI Pending` or `CI Failed`) and only reserve `Rebasing` for the real orchestrator `rebasing` state.

**Test plan:**
- Update `test/status-render.test.ts` to verify `mapDaemonItemState("ci-pending"|"ci-failed", { rebaseRequested: true })` no longer returns `rebasing`
- Add coverage that actual orchestrator state `rebasing` still renders as `Rebasing`
- Verify daemon-state mapping keeps the new non-active rebase-request semantics in table rows and status pills

Acceptance: Status rendering no longer claims work is actively rebasing when the daemon has only requested a rebase. Actual `rebasing` state still renders unchanged across shared status helpers.

Key files: `core/status-render.ts`, `core/orchestrator-types.ts`, `test/status-render.test.ts`, `test/cmux-status.test.ts`
