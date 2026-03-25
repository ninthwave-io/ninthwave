# Feat: Distribute nono profile via init and setup (M-SBX-4)

**Priority:** Medium
**Source:** Eng review (grind cycle 1, 2026-03-25)
**Depends on:** -
**Domain:** sandbox

Distribute the nono worker profile (`.nono/profiles/claude-worker.json`) to target projects during `ninthwave init` and to user-level during `ninthwave setup --global`. Use symlinks (not copies) so profiles stay in sync with ninthwave updates, matching the existing agent distribution pattern.

## Changes

### init.ts — scaffold() profile symlink
1. After the agent symlinks section in `scaffold()`, add profile symlink:
   - Source: `<bundleDir>/.nono/profiles/claude-worker.json`
   - Target: `<projectDir>/.nono/profiles/claude-worker.json`
   - Skip if target already exists or source doesn't exist in bundle
   - Use relative symlink (same pattern as agents)

### init.ts — detection
1. Add `sandbox: "nono" | null` to `DetectionResult` interface
2. Add nono detection in `detectAll()` using existing `commandExists` DI pattern
3. Show in `printSummary()`: `✓ Sandbox: nono` or `– Sandbox: none (install nono for worker isolation)`
4. Include in `generateConfig()` as informational comment: `# SANDBOX=nono`

### setup.ts — setupGlobal() profile symlink
1. After skills symlink section, add user-level profile symlink:
   - Source: `<bundleDir>/.nono/profiles/claude-worker.json`
   - Target: `~/.nono/profiles/claude-worker.json`
   - Skip if target already exists

### setup.ts — prerequisites display
1. Add nono to `checkPrerequisites()` as informational (not blocking):
   - `✓ nono (kernel-level sandbox)` or `– nono (optional — brew install nono)`

## Acceptance

- `ninthwave init` creates profile symlink at `.nono/profiles/claude-worker.json`
- `ninthwave setup --global` creates profile symlink at `~/.nono/profiles/claude-worker.json`
- `ninthwave init` shows sandbox detection in summary
- `ninthwave setup` shows nono in prerequisites (informational)
- Existing profiles are not overwritten
- Missing bundle profile → no-op (no error)

## Test plan

Unit tests in `test/init.test.ts`:
- `detectAll()` includes `sandbox` field
- `scaffold()` symlinks profile from bundle to project
- scaffold skips if profile already exists
- scaffold skips if bundle has no profile

Unit tests in `test/setup.test.ts`:
- `setupGlobal()` symlinks profile to user-level
- `checkPrerequisites()` shows nono detection

Key files: `core/commands/init.ts`, `core/commands/setup.ts`, `test/init.test.ts`, `test/setup.test.ts`
