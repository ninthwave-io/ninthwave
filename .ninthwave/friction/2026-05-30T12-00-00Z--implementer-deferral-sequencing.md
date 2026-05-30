item: process-implementer-deferral-and-sequencing
date: 2026-05-29T12:00:00Z
severity: high
description: |
  An 8-item feature decomposition (one capability: author multi-phase
  edits in the UI -> solver distributes -> apply commits N per-segment
  writes) merged green in auto mode but shipped non-functional end to
  end. The backend apply-split machinery (an apply step carrying a
  `phases:` list, consumed by the commit path) was built, and the
  frontend authoring UI was built and sends phases on the wire, but no
  builder ever emits the `phases:`-carrying step. So the split code is
  reachable only from hand-constructed tests; from a real request,
  apply silently drops all but the first phase. Every PR passed its own
  acceptance criteria and review.

  Two root causes, both process-level:

  1. Implementers defer too readily. A decision log explicitly said the
     request-side emission "was NOT wired ... that ... is a follow-up",
     and the orchestration accepted it: the work item merged, the queue
     emptied, and no follow-up item was created. The reviewer agent
     passed PRs that left a sibling's delivered code unreachable. The
     implementer instructions should be much stricter: do not defer work
     to a hypothetical follow-up wherever it can be completed within the
     item's scope; if a deferral is genuinely unavoidable, it must
     create a tracked follow-up work item before the PR can merge, and
     the reviewer must verify that item exists.

  2. Sequencing let the gap open. Frontend authoring shipped before the
     backend apply-wiring that makes it real. Either dependent FE work
     should be sequenced strictly after the BE seam it depends on, or
     the implementer should complete an item against the spec/instruction
     of the not-yet-landed dependency it can see (build to the contract,
     not to "whatever exists on main right now"), so the seam is wired
     from one side even when the other side lands later.

  Suggested ninthwave changes:
   - Strengthen agents/implementer.md: forbid silent deferral; require a
     tracked follow-up work item for any unavoidable deferral.
   - Strengthen agents/reviewer.md: when a PR's diff or decision log
     defers part of the item's spec, fail unless a follow-up work item
     exists.
   - Decompose/sequencing: when a capability spans BE+FE, either order FE
     after the BE seam, or instruct items to build to the dependency's
     spec so cross-item seams are wired regardless of merge order.
   - Consider an end-to-end gate item in decompositions that span a full
     request round trip, owned by no single feature item.
