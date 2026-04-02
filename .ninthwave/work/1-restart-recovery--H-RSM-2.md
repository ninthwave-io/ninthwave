# Fix: Reattach implementation workers during reconstruction (H-RSM-2)

**Priority:** High
**Source:** Spec `.opencode/plans/1775151454012-playful-planet.md`
**Depends on:** H-RSM-1
**Domain:** restart-recovery
**Lineage:** ceadfef7-8f78-40cb-8f87-5328924bf7a5

Teach restart reconstruction to restore saved implementation `workspaceRef` values and use them as the first reattachment signal before falling back to mux rediscovery by item ID. When neither exact reattachment nor rediscovery succeeds, return an explicit unresolved result so startup code can decide what to do instead of silently leaving an unbound inflight item that later duplicates work.

**Test plan:**
- Extend `test/orchestrate.test.ts` to verify `reconstructState(...)` restores a saved implementation `workspaceRef` from daemon state
- Add coverage for exact saved-ref matches, item-ID fallback matches, and unresolved restart cases when the worktree exists but no live workspace is discoverable
- Extend restart integration coverage in `test/daemon-integration.test.ts` or adjacent recovery tests to prove an inflight worker stays attached across restart without relaunching

Acceptance: Restart reconstruction restores saved implementation worker attachment state, prefers exact saved refs when they are still live, and falls back to item-ID rediscovery when refs changed. If no live workspace can be found, reconstruction surfaces that item as unresolved instead of treating it as a normal attached implementation worker.

Key files: `core/reconstruct.ts`, `core/daemon.ts`, `test/orchestrate.test.ts`, `test/daemon-integration.test.ts`
