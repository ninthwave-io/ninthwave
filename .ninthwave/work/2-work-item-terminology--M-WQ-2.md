# Refactor: Sweep user-facing CLI and TUI copy from TODO to work item (M-WQ-2)

**Priority:** Medium
**Source:** Manual request 2026-04-01 -- align outward-facing product language with the work-item queue model
**Depends on:** None
**Domain:** work-item-terminology

Update user-facing copy in help text, CLI errors, status output, and interactive selection flows so the product consistently says `work item` and `queue` instead of leaking older `todo` wording. Keep behavior unchanged; this item is about the user-visible language and the test coverage that locks it in.

**Test plan:**
- Update `test/cli.test.ts` and `test/cli-flags.test.ts` for any help-text changes in `core/help.ts` or `core/cli.ts`
- Verify edited status or interactive strings still describe the actual behavior of `nw`, `nw list`, and related flows
- Grep the touched user-facing files for remaining `TODO`, `TODOs`, or `Todos directory` strings and either update them or leave them for the protocol audit item

Acceptance: touched CLI and TUI surfaces use `work item` terminology consistently, the help output still matches product behavior, and the related help tests pass without changing runtime behavior.

Key files: `core/help.ts`, `core/cli.ts`, `core/status-render.ts`, `core/interactive.ts`, `test/cli.test.ts`, `test/cli-flags.test.ts`
