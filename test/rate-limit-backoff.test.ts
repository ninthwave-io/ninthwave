import { describe, it, expect } from "vitest";
import { RateLimitBackoff } from "../core/rate-limit-backoff.ts";
import type { PollSnapshot } from "../core/orchestrator-types.ts";

function makeSnapshot(overrides: Partial<PollSnapshot> = {}): PollSnapshot {
  return { items: [], readyIds: [], ...overrides };
}

function rateLimitSnapshot(count = 1): PollSnapshot {
  return makeSnapshot({
    apiErrorCount: count,
    apiErrorSummary: {
      total: count,
      byKind: { "rate-limit": count },
      primaryKind: "rate-limit",
    },
  });
}

function networkErrorSnapshot(count = 1): PollSnapshot {
  return makeSnapshot({
    apiErrorCount: count,
    apiErrorSummary: {
      total: count,
      byKind: { network: count },
      primaryKind: "network",
    },
  });
}

describe("RateLimitBackoff", () => {
  it("starts inactive", () => {
    const backoff = new RateLimitBackoff();
    const state = backoff.getState();
    expect(state.active).toBe(false);
    expect(state.consecutiveRateLimitCycles).toBe(0);
    expect(state.resetAt).toBeNull();
  });

  it("engages on rate-limit errors", () => {
    const backoff = new RateLimitBackoff();
    backoff.recordPollResult(rateLimitSnapshot());
    expect(backoff.getState().active).toBe(true);
    expect(backoff.getState().consecutiveRateLimitCycles).toBe(1);
  });

  it("does not engage on non-rate-limit errors", () => {
    const backoff = new RateLimitBackoff();
    backoff.recordPollResult(networkErrorSnapshot());
    expect(backoff.getState().active).toBe(false);
  });

  it("resets when errors clear", () => {
    const backoff = new RateLimitBackoff();
    backoff.recordPollResult(rateLimitSnapshot());
    expect(backoff.getState().active).toBe(true);

    backoff.recordPollResult(makeSnapshot());
    expect(backoff.getState().active).toBe(false);
    expect(backoff.getState().consecutiveRateLimitCycles).toBe(0);
  });

  it("increments consecutive cycles", () => {
    const backoff = new RateLimitBackoff();
    backoff.recordPollResult(rateLimitSnapshot());
    backoff.recordPollResult(rateLimitSnapshot());
    backoff.recordPollResult(rateLimitSnapshot());
    expect(backoff.getState().consecutiveRateLimitCycles).toBe(3);
  });

  describe("getNextIntervalMs", () => {
    it("returns base interval when not active", () => {
      const backoff = new RateLimitBackoff(2_000);
      expect(backoff.getNextIntervalMs()).toBe(2_000);
    });

    it("uses exponential backoff without reset time", () => {
      const backoff = new RateLimitBackoff(2_000);

      backoff.recordPollResult(rateLimitSnapshot());
      expect(backoff.getNextIntervalMs()).toBe(2_000); // 2000 * 2^0

      backoff.recordPollResult(rateLimitSnapshot());
      expect(backoff.getNextIntervalMs()).toBe(4_000); // 2000 * 2^1

      backoff.recordPollResult(rateLimitSnapshot());
      expect(backoff.getNextIntervalMs()).toBe(8_000); // 2000 * 2^2
    });

    it("caps exponential backoff at 60s", () => {
      const backoff = new RateLimitBackoff(2_000);
      // After many cycles, should cap at 60s
      for (let i = 0; i < 20; i++) {
        backoff.recordPollResult(rateLimitSnapshot());
      }
      expect(backoff.getNextIntervalMs()).toBe(60_000);
    });

    it("uses reset timestamp when available", () => {
      const backoff = new RateLimitBackoff(2_000);
      backoff.recordPollResult(rateLimitSnapshot());

      const nowMs = Date.now();
      const resetInSeconds = Math.floor(nowMs / 1000) + 30; // 30s from now
      backoff.setResetTimestamp(resetInSeconds);

      const interval = backoff.getNextIntervalMs(nowMs);
      // Should be ~35s (30s + 5s buffer)
      expect(interval).toBeGreaterThan(30_000);
      expect(interval).toBeLessThanOrEqual(36_000);
    });

    it("caps reset-based wait at 120s", () => {
      const backoff = new RateLimitBackoff(2_000);
      backoff.recordPollResult(rateLimitSnapshot());

      const nowMs = Date.now();
      const resetInSeconds = Math.floor(nowMs / 1000) + 300; // 5 min from now
      backoff.setResetTimestamp(resetInSeconds);

      expect(backoff.getNextIntervalMs(nowMs)).toBe(120_000);
    });

    it("returns base interval after reset time passes", () => {
      const backoff = new RateLimitBackoff(2_000);
      backoff.recordPollResult(rateLimitSnapshot());

      const nowMs = Date.now();
      const resetInSeconds = Math.floor(nowMs / 1000) - 10; // 10s ago
      backoff.setResetTimestamp(resetInSeconds);

      expect(backoff.getNextIntervalMs(nowMs)).toBe(2_000);
    });
  });

  describe("shouldSkipSnapshot", () => {
    it("returns false when not active", () => {
      const backoff = new RateLimitBackoff();
      expect(backoff.shouldSkipSnapshot()).toBe(false);
    });

    it("returns false on first rate-limit cycle (need to record the error)", () => {
      const backoff = new RateLimitBackoff();
      backoff.recordPollResult(rateLimitSnapshot());
      // First cycle: consecutiveRateLimitCycles === 1, no reset time
      // shouldSkipSnapshot requires >= 2 cycles without reset time
      expect(backoff.shouldSkipSnapshot()).toBe(false);
    });

    it("returns true on second cycle without reset time", () => {
      const backoff = new RateLimitBackoff();
      backoff.recordPollResult(rateLimitSnapshot());
      backoff.recordPollResult(rateLimitSnapshot());
      expect(backoff.shouldSkipSnapshot()).toBe(true);
    });

    it("returns true when reset time is in the future", () => {
      const backoff = new RateLimitBackoff();
      backoff.recordPollResult(rateLimitSnapshot());

      const nowMs = Date.now();
      const resetInSeconds = Math.floor(nowMs / 1000) + 60;
      backoff.setResetTimestamp(resetInSeconds);

      expect(backoff.shouldSkipSnapshot(nowMs)).toBe(true);
    });

    it("returns false after reset time passes", () => {
      const backoff = new RateLimitBackoff();
      backoff.recordPollResult(rateLimitSnapshot());

      const nowMs = Date.now();
      const resetInSeconds = Math.floor(nowMs / 1000) - 10; // past
      backoff.setResetTimestamp(resetInSeconds);

      expect(backoff.shouldSkipSnapshot(nowMs)).toBe(false);
    });
  });

  describe("getState().description", () => {
    it("returns empty string when not active", () => {
      const backoff = new RateLimitBackoff();
      expect(backoff.getState().description).toBe("");
    });

    it("includes duration when backing off without reset time", () => {
      const backoff = new RateLimitBackoff(2_000);
      backoff.recordPollResult(rateLimitSnapshot());
      const desc = backoff.getState().description;
      expect(desc).toContain("Rate limited");
      expect(desc).toContain("backing off");
    });

    it("includes countdown when reset time is known", () => {
      const backoff = new RateLimitBackoff(2_000);
      backoff.recordPollResult(rateLimitSnapshot());
      const nowMs = Date.now();
      backoff.setResetTimestamp(Math.floor(nowMs / 1000) + 120);
      const desc = backoff.getState().description;
      expect(desc).toContain("Rate limited");
      expect(desc).toContain("resuming in");
    });
  });

  describe("engages on byKind rate-limit even when primaryKind differs", () => {
    it("detects rate-limit in byKind when primaryKind is different", () => {
      const backoff = new RateLimitBackoff();
      backoff.recordPollResult(makeSnapshot({
        apiErrorCount: 3,
        apiErrorSummary: {
          total: 3,
          byKind: { network: 2, "rate-limit": 1 },
          primaryKind: "network",
        },
      }));
      expect(backoff.getState().active).toBe(true);
    });
  });

  it("reset clears the reset timestamp", () => {
    const backoff = new RateLimitBackoff();
    backoff.recordPollResult(rateLimitSnapshot());
    backoff.setResetTimestamp(Math.floor(Date.now() / 1000) + 60);
    expect(backoff.getState().resetAt).not.toBeNull();

    backoff.reset();
    expect(backoff.getState().resetAt).toBeNull();
    expect(backoff.getState().active).toBe(false);
  });
});
