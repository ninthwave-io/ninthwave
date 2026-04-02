# Refactor: Validate one queued item at launch time (H-JIT-3)

**Priority:** High
**Source:** /decompose from `.opencode/plans/1775139451551-mighty-forest.md`
**Depends on:** H-JIT-2
**Domain:** queue-admission
**Lineage:** b6433383-f996-482f-8e46-02869bd01b0e

Add a shared `validatePickupCandidate()` helper at the launch boundary and use it from both orchestrator launches and direct `nw <ID>` or `nw start` paths. The validator should inspect only the single item about to launch, reuse existing PR metadata matching logic, and transition failures to `blocked` with actionable `failureReason` text instead of retrying or marking the item stuck.

**Test plan:**
- Add `test/launch.test.ts` coverage for merged, stale, and unlaunchable validation outcomes returned by the shared helper.
- Extend `test/orchestrator-unit.test.ts` to verify `executeLaunch()` transitions to `blocked` without incrementing `retryCount` or creating launch side effects.
- Add direct-launch coverage for `cmdRunItems()` or `cmdStart()` skipping a blocked item and continuing to a later valid item.
- Edge case: validation failure before launch must not create a worktree, workspace, or partition allocation.

Acceptance: Orchestrator launches and direct launch commands validate only the selected item at launch time. Invalid candidates become `blocked` with a clear reason, do not consume WIP, and do not leave partial launch artifacts behind.

Key files: `core/commands/launch.ts`, `core/orchestrator-actions.ts`, `core/commands/run-items.ts`, `test/launch.test.ts`, `test/orchestrator-unit.test.ts`
