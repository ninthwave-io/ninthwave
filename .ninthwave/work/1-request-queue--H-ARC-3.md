# Feat: Centralized request queue with token bucket and priority semaphore (H-ARC-3)

**Priority:** High
**Source:** Architecture plan -- centralized request queue
**Depends on:** None
**Domain:** request-queue
**Lineage:** 99472f8a-6d6f-4a4e-860b-39d656a80d5d

Create a new `core/request-queue.ts` module that centralizes all GitHub API request coordination. Three components:

1. **TokenBucket** -- proactive rate limiting. Refills at ~1.2 tokens/sec (targeting 85% of GitHub's 5000/hr). `acquire()` waits when empty. `updateBudget(remaining, resetAt)` syncs with `gh api rate_limit` for precise budget tracking. The `rate-limit-query` category is exempt from token consumption (GitHub exempts it from rate limits).

2. **PrioritySemaphore** -- concurrency control with priority ordering. Caps concurrent `gh` subprocess spawns at a configurable limit (default 6) to prevent fork-bombing dev laptops. When a slot opens, the highest-priority waiting request gets it. Priority levels: `critical` > `high` > `normal` > `low`.

3. **RequestQueue** -- facade combining token bucket + priority semaphore + audit logging. `enqueue<T>(opts)` accepts a category, priority, optional itemId, and execute closure. Returns a Promise<T>. `getStats()` returns `RequestQueueStats` with total requests, in-flight count, queued count, per-category metrics (count, avgLatencyMs, failureCount), and budget utilization.

The queue is pure infrastructure -- it controls timing and ordering of requests but never changes what requests are made or how results are interpreted (per ETHOS.md "deterministic core" principle).

**Test plan:**
- Unit test TokenBucket: refill rate, acquire blocks when empty, updateBudget syncs correctly
- Unit test PrioritySemaphore: concurrency limit enforced, priority ordering under contention
- Unit test RequestQueue: enqueue resolves with execute result, getStats accuracy, drain() waits for in-flight
- Edge cases: zero tokens, rapid burst, concurrent enqueue from multiple callers
- Test audit logging: verify structured log entries emitted for each request completion

Acceptance: `core/request-queue.ts` exports `RequestQueue` class with `enqueue`, `getStats`, `updateBudget`, `drain`, `isThrottled` methods. Token bucket proactively limits request rate. Priority semaphore enforces concurrency cap. Stats provide per-category metrics. All tests pass.

Key files: new `core/request-queue.ts`, new `test/request-queue.test.ts`
