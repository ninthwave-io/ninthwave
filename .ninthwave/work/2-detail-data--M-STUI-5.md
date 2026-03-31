# Refactor: Carry work item description data into status detail models (M-STUI-5)

**Priority:** Medium
**Source:** Decompose approved startup and status TUI flow for empty queues
**Depends on:** H-STUI-3
**Domain:** detail-data

Plumb description text from work item markdown into the status detail model so the item detail page can show more than title and metadata. Reuse existing body-parsing helpers where possible, choose a payload shape that works for both live orchestrator rendering and daemon-backed status views, and keep the serialized state disciplined so the new field does not create avoidable runtime bloat.

**Test plan:**
- Add parser and serialization coverage for description or snippet fields in local and daemon-backed status paths
- Verify items with no body text, short bodies, and long bodies produce stable detail-model output
- Cover backward-compatible behavior when older daemon state lacks the new field

Acceptance: Status detail data includes a description snippet or body field derived from work item content in both live and daemon-backed views, and status rendering continues to work when the field is absent.

Key files: `core/types.ts`, `core/work-item-files.ts`, `core/commands/orchestrate.ts`, `core/daemon.ts`, `core/status-render.ts`, `test/work-item-files.test.ts`, `test/daemon.test.ts`, `test/status-render.test.ts`
