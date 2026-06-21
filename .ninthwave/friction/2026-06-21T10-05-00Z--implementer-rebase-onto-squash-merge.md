item: implementer-rebase-onto-squash-merge
date: 2026-06-21T10:05:00Z
severity: medium
description: |
  When a dependency squash-merges mid-flight, a stacked branch's plain
  `git rebase origin/<base>` replays the dependency's pre-squash commits
  against their squashed image and hits add/add conflicts on code the
  implementer never wrote. The same happens when the rebaser rebases a
  dependency onto newer base (same patches, new SHAs): plain rebase tries to
  replay old-lineage dependency commits and conflicts on refactored code.
  The recovery is non-obvious under time pressure, and the documented
  "rebase onto base" guidance does not cover it.

  Working recovery in both cases is to transplant only the item's own commits:
    git rebase --onto origin/<base> <old-dependency-tip> <branch>

  Possible improvements:
   - Add the `--onto` recipe to agents/implementer.md and agents/rebaser.md,
     with a short note on identifying the old dependency tip (the branch's
     merge-base with the now-deleted/rebased dependency branch).
   - Have `nw pr-create` recognise the "Base ref must be a branch" GraphQL
     error as "base merged + deleted -> retry against the default branch" and
     surface it as a single actionable message rather than a composite error.
