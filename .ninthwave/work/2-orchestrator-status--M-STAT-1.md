# Feat: Status pill distinguishes "conflicts -- rebase needed" from "CI pending" (M-STAT-1)

**Priority:** Medium
**Source:** Dogfooding friction -- after a dependency PR squash-merged into main, GitHub retargeted a downstream PR and flagged "Checks awaiting conflict resolution"; the daemon surfaced this as a `Rebase Request` but the status pill still read "CI Pending" because the underlying CI Gate check was the GitHub-required check waiting on conflict resolution.
**Depends on:** None
**Domain:** orchestrator-status
**Lineage:** 2bbc7bee-363d-4784-8b76-4a6291640594

The daemon already detects merge-state conflicts: `snap.isMergeable = false` when `mergeableStr === "CONFLICTING"`, and `orchestrator.ts` sets `item.rebaseRequested = true` accordingly. However, `statusDisplayForState()` in `core/orchestrator-types.ts` does not consult `rebaseRequested` when rendering the pill for `ci-pending` / `ci-failed` states, so the user sees "CI Pending" while the real blocker is conflict resolution. This delays diagnosis because the user has to inspect the underlying PR state manually.

When `rebaseRequested === true`, return a distinct status pill ("Conflicts -- rebase needed", warning-tinted, branch icon) for `ci-pending` and `ci-failed` states. Keep the existing pill for the non-rebase case.

**Test plan:**
- Unit: `statusDisplayForState("ci-pending", { rebaseRequested: true })` returns the conflict pill (text, icon, color).
- Unit: `statusDisplayForState("ci-failed", { rebaseRequested: true })` returns the conflict pill.
- Regression: existing tests for `ci-pending` / `ci-failed` without the flag stay unchanged.

Acceptance: Status pill clearly distinguishes "checks pending" from "checks blocked on conflict" in `statusDisplayForState()`. New unit tests cover both the conflict and the non-conflict paths for `ci-pending` and `ci-failed`.

Key files: `core/orchestrator-types.ts` (statusDisplayForState), `test/cmux-status.test.ts`, `test/orchestrator-unit.test.ts`
