# Feat: Make nw pr-create robust to missing labels, transient auth/timeouts, and merged base refs (M-PRC-1)

**Priority:** Medium
**Source:** Friction logs 2026-06-21T10-00-00Z--nw-pr-create-domain-labels, 2026-06-21T10-10-00Z--nw-pr-create-token-robustness, 2026-06-21T10-05-00Z--implementer-rebase-onto-squash-merge (base-ref half)
**Depends on:** None
**Domain:** nw-pr-create
**Lineage:** a6cf8948-6054-49d4-84b5-093178e14614

`nw pr-create` has three recurring failure modes under real orchestration load, each of which forces an implementer into manual recovery:

1. **Missing domain label.** Every new domain introduced by `/decompose` lacks a matching GitHub label, so `nw pr-create --label "domain:<x>"` fails with "label not found" until someone hand-runs `gh label create`. This recurs on essentially every new domain a batch introduces. Fix: create the label on the fly when missing (idempotent create-then-add) so a missing label is never a hard failure.

2. **Transient auth / timeouts.** Under concurrent agent load the OS keychain-backed `gh` token intermittently returns HTTP 401 (the same command succeeds seconds later), and connect timeouts to the API surface as hard failures. The shared retry path covers GraphQL rate limits but not transient auth or timeouts, so PR creation fails outright or half-completes (PR created, label step 401). Fixes: pre-resolve the token into `GH_TOKEN`/`GITHUB_TOKEN` for the subprocess so keychain flakiness during the run is avoided; add transient 401 and connect-timeout to the retry-with-backoff set alongside rate limits; use the REST issues label endpoint for labelling to avoid the `read:project` scope that `gh pr edit --add-label` demands.

3. **Merged + deleted base ref.** When a dependency squash-merges and its branch is deleted, creating a stacked PR against that base fails with a GraphQL "Base ref must be a branch" error surfaced as a composite/opaque failure. Fix: recognise this error as "base merged + deleted -> retry against the default branch" and surface a single actionable message (or auto-retry against the default branch).

**Test plan:**
- Unit: a missing `domain:<x>` label triggers an idempotent create-then-add rather than a hard failure; an already-existing label is not recreated.
- Unit: transient 401 and connect-timeout responses are retried with backoff and succeed on a later attempt; the token is pre-resolved into the subprocess environment.
- Unit: labelling uses the REST issues endpoint (no `read:project` scope required).
- Unit: a "Base ref must be a branch" GraphQL error maps to a single actionable message / default-branch retry.
- Edge case: retries are bounded and a persistent failure still surfaces a clear error.

Acceptance: Under the three failure modes above, `nw pr-create` recovers automatically (or fails with one clear, actionable message) without an implementer needing to run `gh label create`, `export GH_TOKEN=...`, or hand-add labels via the REST API.

Key files: `core/commands/pr-create.ts`, `core/gh.ts`, `core/git.ts`
