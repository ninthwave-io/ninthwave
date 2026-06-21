item: worker-startup-dependency-decisions
date: 2026-06-21T10:15:00Z
severity: medium
description: |
  Sibling work items can diverge when one logs a decision that another assumed
  away. Example shape: item B's spec assumes its dependency A will eliminate a
  module, but A's implementer logged a decision to keep that module (e.g. as a
  DTO). Nothing surfaces the mismatch at startup: decision logs live in
  `.ninthwave/decisions/` but the launched-worker prompt does not point at them,
  so B only discovers the divergence mid-work and has to do codebase
  archaeology. A related shape is two siblings independently implementing the
  same planned API contract and diverging on field names/shapes, with mocked
  tests staying green on both until a late rebase exposes the drift.

  Possible improvements:
   - Point the worker prompt at the decision logs of its declared dependencies,
     so an implementer sees "pending decisions on your dependencies" at startup.
   - Have `/decompose` sanity-check a new item's spec assumptions against the
     latest decision logs of the items it depends on.
   - For shared contracts, have `/decompose` make exactly one item own the
     contract (types first), with the other depending on it, or require a thin
     integration/contract test exercising the real serializer.
