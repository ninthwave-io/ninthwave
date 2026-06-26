// Pure helpers for the reviewer-pushback path: the comment convention a worker
// uses to register machine-actionable disagreement with review feedback, plus
// round-tracking that survives daemon restarts.
//
// The durable signal-file I/O lives in daemon.ts (alongside feedback-done). This
// module holds the format/parsing logic and the in-state round history so both
// the CLI command and the orchestrator share a single source of truth.

import type { PrComment } from "./gh.ts";

/** Marker that identifies a pushback comment on a PR thread. */
export const PUSHBACK_MARKER = "[PUSHBACK]";

/** Comment author associations the orchestrator trusts. Mirrors fetchTrustedPrComments. */
const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/** A single recorded pushback round, persisted on the OrchestratorItem. */
export interface PushbackRound {
  /** The worker's rationale for disagreeing. */
  reason: string;
  /** ISO timestamp when the pushback was registered. */
  ts: string;
  /** Optional ID of the specific review comment being disputed. */
  commentId?: number;
  /** GitHub comment endpoint type for the disputed comment. */
  commentType?: "issue" | "review";
}

/** A pushback parsed from a trusted PR comment. */
export interface ParsedPushback {
  commentId: number;
  author: string;
  reason: string;
  createdAt: string;
  commentType: "issue" | "review";
}

/**
 * Format a structured, auditable pushback comment body for a PR thread.
 * The Implementer prefix keeps it consistent with other agent comments and the
 * PUSHBACK_MARKER makes it machine-recognizable on re-scan.
 */
export function formatPushbackComment(reason: string, hubRepoNwo?: string): string {
  const link = hubRepoNwo
    ? `[Implementer](https://github.com/${hubRepoNwo}/blob/main/agents/implementer.md)`
    : "Implementer";
  return `**${link}** ${PUSHBACK_MARKER} ${reason.trim()}`;
}

/** True when a comment body carries the pushback marker. */
export function isPushbackComment(body: string): boolean {
  return typeof body === "string" && body.includes(PUSHBACK_MARKER);
}

/** Strip the agent prefix and marker, returning just the rationale text. */
export function extractPushbackReason(body: string): string {
  const markerIdx = body.indexOf(PUSHBACK_MARKER);
  if (markerIdx === -1) return body.trim();
  return body.slice(markerIdx + PUSHBACK_MARKER.length).trim();
}

/**
 * Parse pushback comments from a list of PR comments, keeping only those from
 * trusted collaborators. Comments from non-trusted authors are filtered out so a
 * drive-by `[PUSHBACK]` comment from an untrusted account cannot drive the loop.
 */
export function parseTrustedPushbacks(comments: PrComment[]): ParsedPushback[] {
  const out: ParsedPushback[] = [];
  for (const c of comments) {
    if (!isPushbackComment(c.body)) continue;
    if (!TRUSTED_ASSOCIATIONS.has(c.authorAssociation)) continue;
    out.push({
      commentId: c.id,
      author: c.author,
      reason: extractPushbackReason(c.body),
      createdAt: c.createdAt,
      commentType: c.commentType,
    });
  }
  return out;
}

/**
 * Append a pushback round to an item's history. Returns a new array so callers
 * can assign it directly. Rounds on the same comment chain are tracked
 * distinctly -- each registration is its own entry, never coalesced.
 */
export function appendPushbackRound(
  existing: PushbackRound[] | undefined,
  round: PushbackRound,
): PushbackRound[] {
  return [...(existing ?? []), round];
}

/** Count pushback rounds recorded for a specific disputed comment. */
export function pushbackRoundsForComment(
  rounds: PushbackRound[] | undefined,
  commentId: number,
): number {
  if (!rounds) return 0;
  return rounds.filter((r) => r.commentId === commentId).length;
}
