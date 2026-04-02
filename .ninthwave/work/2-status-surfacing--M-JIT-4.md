# Feat: Surface blocked items and cover regression paths (M-JIT-4)

**Priority:** Medium
**Source:** /decompose from `.opencode/plans/1775139451551-mighty-forest.md`
**Depends on:** H-JIT-2, H-JIT-3
**Domain:** status-surfacing
**Lineage:** 26fc20e2-420d-43e2-b57f-e5a9576ca870

Make blocked items obvious in the status page and TUI, then add regression coverage for the new queue behavior. The operator should be able to see why an item was blocked, confirm that startup and controls-to-status stay fast, and verify that one blocked item does not prevent the next ready item from launching.

**Test plan:**
- Extend `test/status-render.test.ts` to cover blocked state mapping, labeling, and failure reason display.
- Extend `test/orchestrate.test.ts` to verify a blocked item does not prevent the next ready item from launching.
- Add regression coverage for startup and status rendering paths staying responsive while queued items are only validated at launch time.
- Edge case: blocked items should not be shown as generic failures or keep crew claim loops alive.

Acceptance: Blocked items render distinctly with their reason in status output, and regression coverage proves the queue continues past blocked items while startup and status rendering remain fast.

Key files: `core/status-render.ts`, `test/status-render.test.ts`, `test/orchestrate.test.ts`
