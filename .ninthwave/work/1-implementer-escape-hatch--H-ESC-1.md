# Docs: Implementer escape-hatch protocol for wrong-shaped work items (H-ESC-1)

**Priority:** High
**Source:** Dogfooding friction cluster (5 reproductions) -- work items shipped with acceptance criteria that turned out to be inconsistent with the actual code: a test plan asked for solver outcomes the solver cannot produce; a refactor declared a symbol deletable that was actively used elsewhere; an acceptance line said "returns 422 unknown_field" but the parser silently drops unknown keys; a round-trip test was authored against wiring that did not exist; an acceptance criterion was superseded by a sibling PR merging while the item sat queued.
**Depends on:** None
**Domain:** implementer-escape-hatch
**Lineage:** e4d7f672-33ca-4031-8b02-cb3b8f3adfb1

Resist pushing this entirely into `/decompose`. If the decompose skill has to validate every factual claim, every call site, every behavioral contract up front, the work item collapses into "this is the implementation" -- the implementer's leverage disappears. The bigger leverage is on the implementer side: a clear protocol for what to do when a work item turns out to be wrong-shaped at implementation time.

Extend `agents/implementer.md` with an escape-hatch / scope-correction section covering the recurring patterns:

- Test plan asks for behavior the current code cannot produce. Do not write red tests against missing functionality and do not silently expand scope. Either reword the test plan as "coverage of current behavior" and record a decision log, or stop and flag the spec inconsistency.
- Acceptance line states a behavior ("returns 422", "emits PATCH X", "removes column Y") that does not match the actual parser / changeset / migration path. Read the relevant code, reword acceptance to match the observed behavior, record a decision log.
- "X is deleted" criteria. Before deleting, run `rg <symbol>` for call sites. If the symbol is actively used, rename instead of delete (e.g. `Legacy*` -> `BeforeAfter*`) and record the decision.
- Acceptance assumes wiring that is not yet in place (e.g. a host page still spreads an unsupported stub, a residual step does not fire on first paint). Ship the observable assertions live; `test.fixme` the unobservable ones with a clear forward pointer to the work item that lands the wiring.
- Acceptance criterion was superseded by a sibling PR merging while this item sat queued (decompose-freshness drift). Re-validate the criterion against `origin/main` at start of implementation; if it is unreachable as stated, narrow scope and record a decision log.

In all cases the implementer should record a short decision log under `.ninthwave/decisions/`, not silently expand scope or argue acceptance was aspirational. The decompose-side fix is narrower: only add a `rg` step or contract walk to `/decompose` when it would catch the issue cheaply, not as a blanket "decompose must research everything" rule.

**Test plan:**
- No code changes; this is a documentation addition to `agents/implementer.md`. Reviewers verify the protocol is concrete (with examples) and that it explicitly tells the implementer when to stop vs. when to ship + flag.

Acceptance: `agents/implementer.md` contains an "Escape hatch" or "Scope correction" section that names the five wrong-shape patterns above, prescribes the recovery action per pattern (reword + decision log; rename instead of delete; ship-observable + test.fixme; narrow + decision log), and explicitly defers exhaustive up-front validation away from `/decompose`.

Key files: `agents/implementer.md`, optionally a one-line cross-reference from `skills/decompose/SKILL.md`
