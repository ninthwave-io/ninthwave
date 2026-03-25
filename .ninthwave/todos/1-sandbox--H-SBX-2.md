# Fix: Create proper nono profile and re-enable sandbox as default (H-SBX-2)

**Priority:** High
**Source:** Friction log (grind cycle 1, 2026-03-25)
**Depends on:** -
**Domain:** sandbox

The nono sandbox integration (M-SBX-1) shipped with wrong CLI flags and a too-restrictive policy. Workers currently run unsandboxed (opt-in via `sandbox_enabled=true`). Fix the policy and make sandbox the default again.

## Changes

1. **Create a nono profile** (`nono-claude-worker` or similar) that grants:
   - Read-write: worktree directory, `~/.claude`, temp dirs (`/tmp`, `/var/folders` or `$TMPDIR`), `~/.config/claude`
   - Read-only: project root, `~/.bun`, `~/.npm`, system dirs (`/usr/lib`, `/usr/local`, `/opt/homebrew`)
   - Network: unrestricted (no proxy filtering — workers need full network for GitHub, npm, APIs)

2. **Use the profile** in `core/sandbox.ts` — replace the manual flag building with `nono run --profile <name>` when the profile exists, falling back to manual flags.

3. **Validate with dry-run** — add a check in `wrapWithSandbox` that runs `nono run --dry-run ...` before first use to verify the command won't fail.

4. **Re-enable as default** — remove the `sandbox_enabled` opt-in gate. Sandbox should be on when nono is installed, off when it's not.

5. **Test manually** — before merging, test the actual nono command with a single worker to verify claude starts and can do its work.

## Acceptance

- `nono run --profile nono-claude-worker -- claude ...` starts claude successfully inside the sandbox
- Workers can read the project, write to the worktree, push to GitHub, and install packages
- Sandbox is the default when nono is installed (no config needed)
- `--no-sandbox` flag still works as opt-out

## Test plan

- Unit tests for profile detection and fallback logic
- Integration test using `nono run --dry-run` to validate the generated command
- Manual test: launch a single worker with sandbox, verify it completes a TODO

## Key files

- `core/sandbox.ts` — sandbox command building
- `.nono/profiles/claude-worker.toml` — nono profile (new)
