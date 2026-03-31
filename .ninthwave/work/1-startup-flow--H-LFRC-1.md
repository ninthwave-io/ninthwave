# Refactor: Make startup selection local-first by default (H-LFRC-1)

**Priority:** High
**Source:** docs/local-first-runtime-controls-spec.md
**Depends on:** None
**Domain:** startup-flow

Remove collaboration, AI review, merge strategy, and WIP decisions from the startup funnel so plain `nw` gets to a live run with only work-item and AI-tool selection. Both the readline fallback and the raw-mode selection screen should initialize `Local`, `Reviews Off`, `Manual`, and the resolved WIP limit without prompting, while still honoring explicit CLI overrides for that run.

**Test plan:**
- Update `test/tui-widgets.test.ts` to verify `runSelectionScreen()` only walks item selection, optional AI tool selection, and confirmation for plain startup.
- Add or extend `test/interactive*.test.ts` coverage for `runInteractiveFlow()` so legacy prompts no longer ask for merge strategy, WIP, review mode, or connection mode.
- Add an orchestrate-path test that confirms interactive startup still captures selected items and AI tools while leaving merge/review/collaboration at the local-first defaults when no CLI overrides are present.

Acceptance: Plain interactive `nw` no longer asks about collaboration, AI reviews, merge strategy, or WIP during startup. Default plain-run state resolves to local collaboration, reviews off, manual merge, and the precomputed WIP limit unless the user supplied explicit CLI flags.

Key files: `core/interactive.ts`, `core/tui-widgets.ts`, `core/commands/orchestrate.ts`, `test/tui-widgets.test.ts`
