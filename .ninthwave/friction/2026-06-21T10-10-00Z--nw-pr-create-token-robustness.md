item: nw-pr-create-token-robustness
date: 2026-06-21T10:10:00Z
severity: medium
description: |
  Under concurrent agent load the OS keychain-backed `gh` token intermittently
  returns HTTP 401 (the same command succeeds seconds later), and connect
  timeouts to the API surface as hard failures. `nw pr-create`'s shared retry
  path covers GraphQL rate limits but not transient auth or timeouts, so PR
  creation fails outright or half-completes (PR created, label step 401).
  Workers have had to `export GH_TOKEN=$(gh auth token)` and add labels via the
  REST issues API by hand. Separately, `gh pr edit --add-label` is not a usable
  fallback because it demands a `read:project` scope the token may lack.

  Possible improvements:
   - Pre-resolve the token into `GH_TOKEN` (and `GITHUB_TOKEN`) for the
     subprocess so keychain flakiness during the run is avoided.
   - Add transient 401 and connect-timeout to the retry-with-backoff set
     alongside rate limits.
   - Use the REST issues label endpoint for labelling to avoid the
     `read:project` scope requirement.
