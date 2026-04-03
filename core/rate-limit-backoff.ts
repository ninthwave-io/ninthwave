// Rate limit backoff for the orchestrator poll loop.
// When GitHub returns rate-limit errors, backs off using the exact reset
// timestamp (from `gh api rate_limit`) or exponential backoff as fallback.

import type { PollSnapshot } from "./orchestrator-types.ts";

export interface BackoffState {
  active: boolean;
  intervalMs: number;
  consecutiveRateLimitCycles: number;
  resetAt: number | null; // unix timestamp (seconds)
  description: string;
}

const MAX_EXPONENTIAL_MS = 60_000;
const MAX_RESET_WAIT_MS = 120_000;
const RESET_BUFFER_MS = 5_000;

export class RateLimitBackoff {
  private consecutiveRateLimitCycles = 0;
  private resetAt: number | null = null;
  private baseIntervalMs: number;

  constructor(baseIntervalMs: number = 2_000) {
    this.baseIntervalMs = baseIntervalMs;
  }

  /** Record a poll cycle's result. Engages backoff only for rate-limit errors. */
  recordPollResult(snapshot: PollSnapshot): void {
    const hasRateLimitErrors =
      snapshot.apiErrorSummary?.primaryKind === "rate-limit" ||
      (snapshot.apiErrorSummary?.byKind?.["rate-limit"] ?? 0) > 0;

    if (hasRateLimitErrors) {
      this.consecutiveRateLimitCycles++;
    } else {
      this.reset();
    }
  }

  /** Set the exact reset timestamp from `gh api rate_limit`. */
  setResetTimestamp(resetUnix: number): void {
    this.resetAt = resetUnix;
  }

  /**
   * Get the interval to sleep before the next poll.
   * Uses the reset timestamp if known, otherwise exponential backoff.
   */
  getNextIntervalMs(nowMs: number = Date.now()): number {
    if (!this.isActive()) return this.baseIntervalMs;

    // If we have a reset timestamp and it's in the future, sleep until then + buffer
    if (this.resetAt !== null) {
      const resetMs = this.resetAt * 1000;
      const waitMs = resetMs - nowMs + RESET_BUFFER_MS;
      if (waitMs > 0) {
        return Math.min(waitMs, MAX_RESET_WAIT_MS);
      }
      // Reset time has passed -- try one more poll at base interval
      return this.baseIntervalMs;
    }

    // Exponential backoff: base * 2^(cycles-1), capped
    const backoff = this.baseIntervalMs * Math.pow(2, this.consecutiveRateLimitCycles - 1);
    return Math.min(backoff, MAX_EXPONENTIAL_MS);
  }

  /** Whether to skip the next buildSnapshot call entirely. */
  shouldSkipSnapshot(nowMs: number = Date.now()): boolean {
    if (!this.isActive()) return false;

    // If we know the reset time and it has passed, don't skip -- time to retry
    if (this.resetAt !== null) {
      return nowMs < this.resetAt * 1000;
    }

    // Without a reset time, skip on 2nd+ cycle (first cycle was already recorded)
    return this.consecutiveRateLimitCycles >= 2;
  }

  /** Get the current backoff state for logging/TUI. */
  getState(): BackoffState {
    const intervalMs = this.getNextIntervalMs();
    return {
      active: this.isActive(),
      intervalMs,
      consecutiveRateLimitCycles: this.consecutiveRateLimitCycles,
      resetAt: this.resetAt,
      description: this.formatDescription(),
    };
  }

  /** Reset backoff state to normal. */
  reset(): void {
    this.consecutiveRateLimitCycles = 0;
    this.resetAt = null;
  }

  private isActive(): boolean {
    return this.consecutiveRateLimitCycles > 0;
  }

  private formatDescription(nowMs: number = Date.now()): string {
    if (!this.isActive()) return "";

    if (this.resetAt !== null) {
      const remainingMs = this.resetAt * 1000 - nowMs + RESET_BUFFER_MS;
      if (remainingMs <= 0) return "Rate limited -- retrying now";
      return `Rate limited -- resuming in ${formatDuration(remainingMs)}`;
    }

    const intervalMs = this.getNextIntervalMs(nowMs);
    return `Rate limited -- backing off ${formatDuration(intervalMs)}`;
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}
