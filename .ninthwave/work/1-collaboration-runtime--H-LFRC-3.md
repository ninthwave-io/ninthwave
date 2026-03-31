# Feat: Add claim-gated arming window and ephemeral collaboration start (H-LFRC-3)

**Priority:** High
**Source:** docs/local-first-runtime-controls-spec.md
**Depends on:** H-LFRC-1
**Domain:** collaboration-runtime

Replace remote-first startup with a short arming window that shows the live status UI immediately, pauses claims for about 3-5 seconds, and lets the operator choose `Join`, `Share`, `Stay paused`, or start local immediately. Plain `nw` must stop re-activating saved sessions, must not silently reconnect on restart, and must only enter shared or joined collaboration when the user explicitly chose it at startup or via CLI intent.

**Test plan:**
- Add orchestrate tests for plain startup with no collaboration flags: claims stay gated during the arming window, then begin locally when the timer expires.
- Add tests for explicit share/join CLI paths to confirm they skip the arming window and that joined daemons do not claim before broker connection succeeds.
- Add regression coverage for session lifecycle so saved crew codes are not reused on plain restart and disconnected/shared state does not carry into the next run.

Acceptance: Plain `nw` shows a short startup banner over the live TUI, defaults to local when the timer expires, and never resumes a previous collaboration session. Explicit join/share startup intent still works, and joined runs do not claim local work before the broker connection is established.

Key files: `core/commands/orchestrate.ts`, `core/crew.ts`, `core/status-render.ts`, `core/tui-keyboard.ts`, `test/orchestrator.test.ts`
