# Feat: Add stronger status-page layout rules for active, queued, and mode details (M-STUI-4)

**Priority:** Medium
**Source:** Decompose approved startup and status TUI flow for empty queues
**Depends on:** H-STUI-3
**Domain:** status-layout

Rework the status-page layout so long active sections do not effectively bury the queue section or make the page state hard to read. Add clearer main-page visibility for local/shared/joined collaboration state and review mode, and introduce layout rules that reserve space or pin key queue and summary affordances instead of treating everything as one undifferentiated scroll stream.

**Test plan:**
- Add layout tests for long active lists, long queued lists, and narrow or short terminals
- Verify the pinned footer still remains visible while queue visibility rules hold under pressure
- Add assertions that the main page surfaces collaboration and review state without opening the controls overlay

Acceptance: The status page remains legible when many active and queued items exist, queued work is not silently lost below the fold without an affordance, and the main page visibly communicates local vs collaboration state plus review mode.

Key files: `core/status-render.ts`, `core/tui-keyboard.ts`, `test/status-render.test.ts`, `test/orchestrate.test.ts`, `test/tui-keyboard.test.ts`
