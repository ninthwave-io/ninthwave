# Feat: Persist operator WIP preference and runtime WIP updates (H-LFRC-2)

**Priority:** High
**Source:** docs/local-first-runtime-controls-spec.md
**Depends on:** H-LFRC-1
**Domain:** runtime-controls

Teach the runtime to resolve WIP from three sources in order: explicit `--wip-limit`, user-level persisted preference, then computed default. Add a user-config field for WIP, expose an orchestrator/runtime setter that can change the active limit without restart, and persist user-driven `+` or `-` adjustments so the next plain run reuses the operator's preferred value without turning WIP into a startup question.

**Test plan:**
- Extend `test/config*.test.ts` or add focused coverage for `loadUserConfig()` to parse and ignore malformed persisted WIP values in `~/.ninthwave/config.json`.
- Add orchestrator tests for changing the effective/configured WIP limit at runtime and verifying slot calculations update immediately.
- Add orchestrate tests covering precedence: CLI `--wip-limit` wins for the current run, persisted user WIP wins over computed default, and runtime `+`/`-` writes back to user config.

Acceptance: Plain `nw` never prompts for WIP. Startup uses CLI override first, then persisted user WIP, then computed default. Runtime WIP changes take effect immediately in the current daemon and persist to user-level config for future plain runs.

Key files: `core/config.ts`, `core/orchestrator.ts`, `core/commands/orchestrate.ts`, `core/tui-keyboard.ts`, `test/orchestrator.test.ts`
