# Add shared TUI settings model and persisted defaults foundation (H-TUI-1)

**Priority:** High
**Source:** Decomposed from approved TUI settings UX improvements plan 2026-04-01
**Depends on:** None
**Domain:** tui-settings

Create the foundation that the rest of the TUI UX work will build on. Add one shared settings metadata/model layer for collaboration, reviews, merge strategy, and WIP limit so the startup settings screen and runtime controls stop duplicating row definitions and option order. Extend user config parsing/saving in `~/.ninthwave/config.json` to support persisted defaults for `merge_strategy`, `review_mode`, and `collaboration_mode` alongside the existing `wip_limit`, with strict enum validation and unknown-key preservation.

Keep this item limited to the shared model, config persistence, and the startup-default resolution path in orchestrate. Do not implement the new startup widget, new controls navigation, countdown rendering, or header layout changes here.

**Test plan:**
- Add config tests for load/save round-trips of `merge_strategy`, `review_mode`, and `collaboration_mode`
- Add tests that invalid persisted enum values are ignored safely
- Add coverage proving interactive startup default resolution prefers persisted user config over hardcoded local/manual/off fallbacks
- Run `bun test test/`

Acceptance: There is one shared source of truth for TUI settings rows/options, user config supports persisted merge/review/collaboration defaults without breaking unknown keys, and the orchestrate startup path can resolve those defaults for later UI layers without yet changing the UI behavior.

Key files: `core/tui-settings.ts`, `core/config.ts`, `core/commands/orchestrate.ts`, `core/interactive.ts`, `test/config.test.ts`, `test/orchestrate.test.ts`
