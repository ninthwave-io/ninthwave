# Feat: Add nono sandbox awareness step to onboarding (M-ONB-2)

**Priority:** Medium
**Source:** Eng review (grind cycle 1, 2026-03-25)
**Depends on:** M-SBX-3
**Domain:** onboarding

Add Step 3.5 to the interactive onboarding flow (`core/commands/onboard.ts`) between AI tool detection (Step 3) and setup (Step 4). This step makes users aware of sandboxing status and offers installation if nono is missing.

## Changes

1. Import `isNonoAvailable()` from `core/sandbox.ts` (DRY — reuse existing detection, don't duplicate with `commandExists`).
2. Insert Step 3.5 after Step 3 (AI tool), before Step 4 (setup):
   - If nono installed: green checkmark, "Workers sandboxed by default. Disable with --no-sandbox."
   - If NOT installed: show as recommended, offer `brew install nono` (Y/n).
     - Y → run `brew install nono` inline. Handle failure gracefully (catch error, continue unsandboxed).
     - n → continue without sandboxing.
3. Follow existing pattern from `detectInstalledMuxes()`/`detectInstalledAITools()` for consistency.

## Why this matters

Workers launched by the daemon are invisible to the user — a one-liner at spawn time won't be seen. The onboarding flow is the user's first (and often only) touch point to learn about sandboxing. It also gives users the opportunity to opt out if they need to.

## Acceptance

- Running `ninthwave` in a new project shows sandbox status in onboarding
- If nono is installed: shows "✓ Workers sandboxed by default"
- If nono is missing: offers installation with Y/n prompt
- Flow continues regardless of nono status (non-blocking)
- Brew install failure is handled gracefully

## Test plan

Unit tests in `test/onboard.test.ts`:
- nono detected → shows checkmark message
- nono NOT detected → shows install suggestion
- User says Y to install → runs brew install
- User says n → continues without
- brew install fails → continues without (graceful degradation)

Key files: `core/commands/onboard.ts`, `core/sandbox.ts` (import), `test/onboard.test.ts`
