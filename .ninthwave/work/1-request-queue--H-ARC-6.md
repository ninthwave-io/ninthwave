# Refactor: Queue-routed action execution and retire RateLimitBackoff (H-ARC-6)

**Priority:** High
**Source:** Architecture plan -- centralized request queue
**Depends on:** H-ARC-4
**Domain:** request-queue
**Lineage:** e644a1c2-2dfd-4344-b330-aef70b56c6d9

Route GitHub API actions through the RequestQueue and remove the reactive `RateLimitBackoff` class, replacing it with the queue's proactive token bucket.

Changes to `core/orchestrate-event-loop.ts`:
1. Thread the `RequestQueue` instance through the event loop (created at daemon startup, passed via deps or context).
2. In the action execution loop (~line 1323-1327), route `GH_API_ACTIONS` (merge, set-commit-status, post-review, sync-stack-comments) through `queue.enqueue()` with priority: merge -> critical, others -> high. Non-API actions (launch, clean, workspace-close) execute immediately as before.
3. Replace `RateLimitBackoff` usage:
   - Remove `rateLimitBackoff.shouldSkipSnapshot()` check (~line 1111) -- the queue's token bucket handles throttling per-request instead of skipping entire cycles.
   - Remove `rateLimitBackoff.recordPollResult()` (~line 1133) -- error tracking moves to queue stats.
   - Replace `rateLimitBackoff.setResetTimestamp()` (~line 1139) with `queue.updateBudget()`.
   - Remove `GH_API_ACTIONS` deferral during backoff (~line 1303-1316) -- the queue handles this.
   - Replace backoff interval for sleep (~line 1404-1406) with queue-aware adaptive interval.
4. Update TUI display: replace `rateLimitBackoffDescription` with `queue.getStats()` data for throttle status.
5. Remove `core/rate-limit-backoff.ts` and its test file.

**Test plan:**
- Test action execution: verify GH API actions routed through queue, non-API actions bypass queue
- Test rate limit handling: simulate 429 response, verify queue throttles subsequent requests via token bucket
- Test `updateBudget()` integration: verify reset timestamp from `gh api rate_limit` updates token bucket
- Test TUI display: verify throttle status sourced from queue stats
- Verify removal: grep for `RateLimitBackoff` imports -- should find zero references
- Run full suite after removing rate-limit-backoff.ts

Acceptance: All GH API actions flow through RequestQueue. RateLimitBackoff class and its tests removed. Token bucket handles proactive rate limiting. TUI shows queue-based throttle status. Full test suite passes.

Key files: `core/orchestrate-event-loop.ts`, remove `core/rate-limit-backoff.ts`, remove `test/rate-limit-backoff.test.ts`
