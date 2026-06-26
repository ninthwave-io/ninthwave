# Feat: Surface dependency decision logs to workers at startup (M-WDD-1)

**Priority:** Medium
**Source:** Friction log 2026-06-21T10-15-00Z--worker-startup-dependency-decisions
**Depends on:** None
**Domain:** worker-startup
**Lineage:** 22cb9291-8899-474c-addf-12e55af0289c

Sibling work items diverge when one logs a decision that another assumed away. Example shape: item B's spec assumes its dependency A will eliminate a module, but A's implementer logged a decision to keep that module (e.g. as a DTO). Nothing surfaces the mismatch at startup -- decision logs live in `.ninthwave/decisions/` but the launched-worker prompt does not point at them, so B only discovers the divergence mid-work and has to do codebase archaeology. A related shape is two siblings independently implementing the same planned API contract and diverging on field names/shapes, with mocked tests staying green on both until a late rebase exposes the drift.

Scope:
- Point the launched-worker prompt at the decision logs of the item's declared dependencies, so an implementer sees "pending decisions on your dependencies" at startup.
- Optionally have `/decompose` sanity-check a new item's spec assumptions against the latest decision logs of the items it depends on.
- For shared contracts, have `/decompose` make exactly one item own the contract (types first), with the other depending on it, or require a thin integration/contract test exercising the real serializer.

**Test plan:**
- Unit: the worker launch prompt for an item with dependencies includes (or references) the decision-log entries of those dependencies; an item with no dependencies gets no such section.
- Integration: a decision logged by dependency A is visible to B's worker at startup without B reading the codebase to find it.
- Edge case: a dependency with no decision logs produces no spurious "pending decisions" section.

Acceptance: An implementer working an item whose dependencies have logged decisions sees those decisions at startup rather than discovering the divergence mid-work.

Key files: `agents/implementer.md`, `core/commands/`, the worker launch / prompt-assembly path
