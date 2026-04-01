# Docs: Audit protocol and legacy TODO terminology boundaries (M-WQ-4)

**Priority:** Medium
**Source:** Manual request 2026-04-01 -- separate safe terminology cleanup from compatibility-sensitive surfaces
**Depends on:** M-WQ-2, M-WQ-3
**Domain:** work-item-terminology

Audit the remaining `todo` terminology and document what must stay for now because it is part of a protocol, serialized field, compatibility layer, or historical record. The output of this item should give later cleanup work a clear keep-list for names such as `YOUR_TODO_ID`, broker payload fields, `reviewType: "todo"`, and legacy `.ninthwave/todos/` migration references.

**Test plan:**
- Inspect launch, broker, mux, and review-type code paths to confirm which `todo` names are externally consumed or serialized
- Verify legacy migration and historical references are still needed and should be preserved rather than renamed
- Manually review the resulting audit/defer list to ensure a later cleanup worker could use it without re-discovering the same boundaries

Acceptance: the repo contains a clear documented boundary between `todo` terms that are safe to rename and `todo` terms that must remain for protocol, compatibility, or historical reasons.

Key files: `ARCHITECTURE.md`, `core/commands/launch.ts`, `core/crew.ts`, `core/mux.ts`, `core/commands/init.ts`, `docs/onboarding.md`
