item: nw-pr-create-domain-labels
date: 2026-06-21T10:00:00Z
severity: low
description: |
  Every new domain introduced by `/decompose` lacks a matching GitHub label,
  so `nw pr-create --label "domain:<x>"` fails with "label not found" until an
  implementer hand-creates it with `gh label create` and retries. This recurs
  on essentially every new domain a decompose batch introduces and interrupts
  otherwise-clean PR creation. The implementer template assumes the
  `--label domain:<your-domain>` label already exists.

  Possible improvements:
   - Have `nw pr-create` create the label on the fly when it is missing
     (idempotent create-then-add), so a missing label is never a hard failure.
   - Or have `/decompose` ensure a label exists for every domain it emits, so
     labels are provisioned before any implementer runs.
   - Either removes the manual `gh label create` step entirely.
