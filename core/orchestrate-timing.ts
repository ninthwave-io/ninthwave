// Interactive watch timing measurement, event loop lag sampling, and diagnostic reporting.
// Pure data structures and measurement logic with no side effects.

import type { Action } from "./orchestrator.ts";
import type { LogEntry } from "./types.ts";

// ── Constants ───────────────────────────────────────────────────────

export const INTERACTIVE_WATCH_STAGE_WARN_MS = {
  eventLoopLag: 150,
  poll: 250,
  actionExecution: 250,
  mainRefresh: 250,
  displaySync: 100,
  render: 100,
} as const;

export type InteractiveWatchStageName = keyof typeof INTERACTIVE_WATCH_STAGE_WARN_MS;

const INTERACTIVE_WATCH_LAG_SAMPLE_INTERVAL_MS = 50;
const INTERACTIVE_WATCH_STAGE_LOG_NAMES: Record<InteractiveWatchStageName, string> = {
  eventLoopLag: "event_loop_lag",
  poll: "poll",
  actionExecution: "action_execution",
  mainRefresh: "main_refresh",
  displaySync: "display_sync",
  render: "render",
};

// ── Interfaces ──────────────────────────────────────────────────────

export interface InteractiveWatchTimingsMs {
  eventLoopLag: number;
  poll: number;
  actionExecution: number;
  mainRefresh: number;
  displaySync: number;
  render: number;
  totalBlocking: number;
}

export interface InteractiveWatchTiming {
  iteration: number;
  actionCount: number;
  actionTypes: Action["type"][];
  timingsMs: InteractiveWatchTimingsMs;
}

export interface EventLoopLagSnapshot {
  maxLagMs: number;
  sampleCount: number;
  lastSampleAtMs?: number;
}

export interface EventLoopLagSamplerDeps {
  sampleIntervalMs?: number;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export interface EventLoopLagSampler {
  start: () => void;
  stop: () => void;
  drain: () => EventLoopLagSnapshot;
}

// ── Functions ───────────────────────────────────────────────────────

export function createInteractiveWatchTiming(iteration: number, actionTypes: Action["type"][]): InteractiveWatchTiming {
  return {
    iteration,
    actionCount: actionTypes.length,
    actionTypes,
    timingsMs: {
      eventLoopLag: 0,
      poll: 0,
      actionExecution: 0,
      mainRefresh: 0,
      displaySync: 0,
      render: 0,
      totalBlocking: 0,
    },
  };
}

export function elapsedMs(nowMs: () => number, startMs: number): number {
  return Math.max(0, nowMs() - startMs);
}

export function finalizeInteractiveWatchTiming(
  log: (entry: LogEntry) => void,
  timing: InteractiveWatchTiming,
  eventLoopLagMs: number,
): void {
  timing.timingsMs.eventLoopLag = eventLoopLagMs;
  timing.timingsMs.totalBlocking = timing.timingsMs.poll
    + timing.timingsMs.actionExecution
    + timing.timingsMs.mainRefresh
    + timing.timingsMs.displaySync
    + timing.timingsMs.render;

  log({
    ts: new Date().toISOString(),
    level: "info",
    event: "interactive_watch_timing",
    iteration: timing.iteration,
    actionCount: timing.actionCount,
    actionTypes: timing.actionTypes,
    timingsMs: timing.timingsMs,
  });

  for (const stage of Object.keys(INTERACTIVE_WATCH_STAGE_WARN_MS) as InteractiveWatchStageName[]) {
    const durationMs = timing.timingsMs[stage];
    const thresholdMs = INTERACTIVE_WATCH_STAGE_WARN_MS[stage];
    if (durationMs < thresholdMs) continue;
    log({
      ts: new Date().toISOString(),
      level: "warn",
      event: "interactive_watch_stall",
      iteration: timing.iteration,
      stage: INTERACTIVE_WATCH_STAGE_LOG_NAMES[stage],
      durationMs,
      thresholdMs,
      actionCount: timing.actionCount,
      actionTypes: timing.actionTypes,
      timingsMs: timing.timingsMs,
      message: `Interactive watch ${INTERACTIVE_WATCH_STAGE_LOG_NAMES[stage]} took ${durationMs}ms`,
    });
  }
}

export function createEventLoopLagSampler(
  deps: EventLoopLagSamplerDeps = {},
): EventLoopLagSampler {
  const now = deps.now ?? Date.now;
  const sampleIntervalMs = deps.sampleIntervalMs ?? INTERACTIVE_WATCH_LAG_SAMPLE_INTERVAL_MS;
  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let expectedAtMs = 0;
  let running = false;
  let maxLagMs = 0;
  let sampleCount = 0;
  let lastSampleAtMs: number | undefined;

  const schedule = () => {
    expectedAtMs = now() + sampleIntervalMs;
    timer = setTimeoutFn(() => {
      const sampledAtMs = now();
      const lagMs = Math.max(0, sampledAtMs - expectedAtMs);
      maxLagMs = Math.max(maxLagMs, lagMs);
      sampleCount += 1;
      lastSampleAtMs = sampledAtMs;
      if (running) schedule();
    }, sampleIntervalMs);
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      schedule();
    },
    stop: () => {
      running = false;
      if (timer) {
        clearTimeoutFn(timer);
        timer = undefined;
      }
    },
    drain: () => {
      const snapshot = { maxLagMs, sampleCount, lastSampleAtMs };
      maxLagMs = 0;
      sampleCount = 0;
      lastSampleAtMs = undefined;
      return snapshot;
    },
  };
}
