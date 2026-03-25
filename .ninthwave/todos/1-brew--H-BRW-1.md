# Feat: Add nono as brew dependency for secure-by-default sandboxing (H-BRW-1)

**Priority:** High
**Source:** Eng review (grind cycle 1, 2026-03-25)
**Depends on:** -
**Domain:** brew

Add nono as a Homebrew dependency of ninthwave so `brew install ninthwave` automatically installs nono. This makes worker sandboxing work out of the box with zero user configuration.

## Changes

1. Add `depends_on "nono"` to `homebrew/ninthwave.rb` (the in-repo reference formula).
2. Update CLAUDE.md to note nono as the one external dependency. Clarify that ninthwave gracefully degrades without it — workers run unsandboxed but functional.

## Context

- nono is in Homebrew core (not a custom tap), making it a clean dependency
- Cross-package brew deps are standard (git depends on gettext+pcre2, ffmpeg depends on 10+ packages)
- The canonical formula lives in `ninthwave-sh/homebrew-tap` — the in-repo formula is a reference that the release workflow uses as a template

## Acceptance

- `homebrew/ninthwave.rb` includes `depends_on "nono"`
- CLAUDE.md convention section updated to reflect nono dep
- No test changes needed (formula is declarative)

Key files: `homebrew/ninthwave.rb`, `CLAUDE.md`
