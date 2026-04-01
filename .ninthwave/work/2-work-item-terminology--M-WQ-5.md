# Refactor: Rename safe internal TODO terminology after the boundary audit (M-WQ-5)

**Priority:** Medium
**Source:** Manual request 2026-04-01 -- finish the terminology cleanup without breaking protocol surfaces
**Depends on:** M-WQ-4
**Domain:** work-item-terminology

Rename internal variable names, comments, helper text, and test descriptions from `todo` to `work item` where those names are not part of an external protocol or compatibility boundary. Keep parser, list, reconcile, and orchestration behavior unchanged; this is a safe internal cleanup pass that should follow the audit's explicit defer list.

**Test plan:**
- Update affected tests for renamed symbols or wording in parser, status, reconcile, and orchestrator-related modules
- Verify parsing, readiness, and reconciliation behavior remains unchanged by running targeted tests around work-item files, status, and orchestrator flows
- Grep the touched internal files for remaining `todo` terminology and leave only the exceptions documented by `M-WQ-4`

Acceptance: safe internal code and comments use `work item` terminology consistently, tests continue to cover the same behavior, and only the documented protocol/legacy exceptions still use `todo` wording.

Key files: `core/work-item-files.ts`, `core/parser.ts`, `core/commands/status.ts`, `core/orchestrator.ts`, `core/orchestrator-types.ts`, `core/orchestrator-actions.ts`, `test/work-item-files.test.ts`, `test/parser.test.ts`, `test/orchestrator.test.ts`
