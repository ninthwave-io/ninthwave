# Fix: Make collaboration local-first and share code helpers (H-COL-1)

**Priority:** High
**Source:** Decomposed from collaboration controls plan 2026-04-01
**Depends on:** None
**Domain:** collaboration-defaults

Make plain `nw watch` runs resolve to local collaboration by default, even if prior sessions used share/join modes, and remove stale assumptions that collaboration mode should behave like a persisted ambient preference. At the same time, extract or consolidate crew-code normalization and validation so runtime controls, startup prompts, and onboarding all use the same code-path and error rules.

**Test plan:**
- Add startup config/default-resolution coverage proving plain runs resolve to local mode while explicit share/join selections still map to the expected runtime intent
- Add shared crew-code validation coverage for normalization, uppercase formatting, and malformed code rejection through the reusable helper path
- Update interactive and onboarding tests to verify explicit share/join choices still produce the right `connectionAction` and watch arguments after the local-first cleanup

Acceptance: Collaboration mode no longer acts like a sticky default for ordinary runs. Shared crew-code validation logic is reused across startup and runtime entry points. Existing explicit share/join flows still resolve correctly after the cleanup.

Key files: `core/tui-settings.ts`, `core/config.ts`, `core/commands/crew.ts`, `core/interactive.ts`, `core/commands/onboard.ts`, `test/orchestrate.test.ts`, `test/interactive.test.ts`, `test/crew-command.test.ts`, `test/onboard.test.ts`
