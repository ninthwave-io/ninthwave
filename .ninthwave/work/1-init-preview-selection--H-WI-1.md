# Feat: Add per-line `Will install` selection during `nw init` (H-WI-1)

**Priority:** High
**Source:** Spec `.opencode/plans/1775111913158-eager-island.md`
**Depends on:** None
**Domain:** init-preview-selection
**Lineage:** 8df437fd-df89-4ce4-9307-86cb414fd4cb

Extend the interactive `nw init` flow with a third checkbox step for actionable `Will install` entries so users can disable individual creates, refreshes, or replacements before confirming. Reuse the existing copy-plan and prompt machinery, keep all actionable entries selected by default, and preserve the current all-up-to-date fast path plus non-interactive behavior.

**Test plan:**
- Add `test/setup.test.ts` coverage proving `interactiveAgentSelection(...)` returns all actionable preview entries by default
- Add a test that unchecking one preview line removes only that `displayPath` from the returned selection while preserving the chosen tools and agents
- Verify the all-up-to-date flow still skips the final confirm path and returns the coarse selection unchanged

Acceptance: `nw init` still asks for tools first and agents second, then presents actionable `Will install` entries as a third checkbox list with all items preselected. Users can uncheck any individual line without affecting the earlier tool or agent ownership selection, and the existing up-to-date fast path remains unchanged.

Key files: `core/commands/setup.ts`, `test/setup.test.ts`
