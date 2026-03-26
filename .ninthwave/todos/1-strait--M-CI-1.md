# Feat: Add CI Gate branch protection rule for strait PRs (M-CI-1)

**Priority:** Medium
**Domain:** strait
**Repo:** strait
**Depends on:** H-FMT-1

## Context
The ninthwave repo has a "CI Gate" required status check on PRs. The strait repo should have the same protection so PRs can't be merged when CI is failing.

## Requirements
1. Create a branch protection rule for the `main` branch on `ninthwave-sh/strait`
2. Require the "CI" workflow's `test` job as a required status check
3. Use the GitHub CLI: `gh api repos/ninthwave-sh/strait/branches/main/protection --method PUT ...`
4. Also add a CLAUDE.md to the strait repo with Rust build/test instructions for future workers

Key files: `.github/workflows/ci.yml`, `CLAUDE.md`
