# Feat: Add blockerIcon and formatBlockerSubline helper functions (H-DS-1)

**Priority:** High
**Source:** Status table UX redesign -- replace DEPS column with inline indicator + sub-lines
**Depends on:** None
**Domain:** status-ux

Add two new exported functions to `core/status-render.ts`. `blockerIcon(blockerCount)` returns a color-coded hourglass icon: RED for 2+ unresolved blockers, YELLOW for 1, and a plain space for 0 (preserving alignment). `formatBlockerSubline(blockerIds, titleWidth, isQueued)` renders a dimmed sub-line like `    └ H-CA-1, H-CA-3` indented 4 chars to align under the ID column, with truncation and `...` when the list exceeds available width. These are additive-only -- no existing code changes.

**Test plan:**
- Unit test `blockerIcon`: verify RED output for count >= 2, YELLOW for count === 1, single space for count === 0
- Unit test `formatBlockerSubline`: verify 4-char indent + `└ ` prefix, comma-separated IDs, truncation with `...` when IDs exceed titleWidth, DIM wrapping for both normal and queued modes
- Verify title alignment: `blockerIcon` output is always 1 visible char wide (icon or space)

Acceptance: Both functions exported from `core/status-render.ts`. `blockerIcon` returns ANSI-colored `⧗` for counts 1+ and a space for 0. `formatBlockerSubline` renders a dimmed `└`-prefixed line with proper indentation and truncation. All new tests pass. Existing tests unaffected.

Key files: `core/status-render.ts`, `test/status-render.test.ts`
