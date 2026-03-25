# Feat: Expand findProfile() with user-level fallback (M-SBX-3)

**Priority:** Medium
**Source:** Eng review (grind cycle 1, 2026-03-25)
**Depends on:** -
**Domain:** sandbox

Expand `findProfile()` in `core/sandbox.ts` to check user-level `~/.nono/profiles/claude-worker.json` as a fallback when no project-level profile exists. This enables cross-repo sandboxing without requiring each project to have the profile.

## Changes

1. In `findProfile()` (`core/sandbox.ts:195-207`), after checking `<projectRoot>/.nono/profiles/claude-worker.json`, add fallback to `~/.nono/profiles/claude-worker.json`.
2. Add optional `home` parameter (default `homedir()`) for dependency injection / testability.
3. Search order: project-level first (preferred), then user-level.

## Acceptance

- `findProfile("/project")` returns project-level path when it exists
- `findProfile("/project")` returns user-level path when only user-level exists
- `findProfile("/project")` returns null when neither exists
- Project-level always preferred over user-level

## Test plan

Unit tests in `test/sandbox.test.ts`:
- Project-level profile found → returns project path
- No project profile, user-level found → returns user path (via injected `home` param)
- Neither found → returns null
- Both exist → project-level preferred

Key files: `core/sandbox.ts`, `test/sandbox.test.ts`
