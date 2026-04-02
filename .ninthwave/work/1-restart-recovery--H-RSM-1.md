# Fix: Preserve restart state for inflight implementation workers (H-RSM-1)

**Priority:** High
**Source:** Spec `.opencode/plans/1775151454012-playful-planet.md`
**Depends on:** None
**Domain:** restart-recovery
**Lineage:** 560683a6-2a18-4437-ba9b-af38a4020b70

Preserve orchestrator restart metadata when `nw watch` exits cleanly so a later session can resume inflight implementation workers instead of reconstructing from scratch. Limit this item to PID/state-file lifecycle behavior and startup replacement semantics; do not change worker reattachment logic or operator prompts yet.

**Test plan:**
- Extend `test/daemon.test.ts` to verify stale PID cleanup removes only the PID file and leaves `orchestrator.state.json` intact
- Extend `test/orchestrate.test.ts` to verify clean interactive/foreground shutdown preserves restart state until the next startup overwrites it with a fresh snapshot
- Cover the edge case where an old state file exists before startup and confirm the new run replaces it rather than mixing old and new items

Acceptance: A clean `nw watch` shutdown leaves restart state available for the next session. Stale PID cleanup no longer deletes the state file. Starting a new watch session still writes a fresh state snapshot so status views converge to the new run.

Key files: `core/daemon.ts`, `core/commands/orchestrate.ts`, `test/daemon.test.ts`, `test/orchestrate.test.ts`
