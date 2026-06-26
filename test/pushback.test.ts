// Tests for the reviewer-pushback path: durable signal I/O (core/daemon.ts),
// pure helpers (core/pushback.ts), and the nw pushback command
// (core/commands/pushback.ts).

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  writePushbackSignal,
  readPushbackSignal,
  clearPushbackSignal,
  pushbackSignalPath,
  signalDir,
  type DaemonIO,
} from "../core/daemon.ts";
import {
  PUSHBACK_MARKER,
  formatPushbackComment,
  isPushbackComment,
  extractPushbackReason,
  parseTrustedPushbacks,
  appendPushbackRound,
  pushbackRoundsForComment,
} from "../core/pushback.ts";
import {
  cmdPushback,
  parsePushbackArgs,
  type PushbackDeps,
} from "../core/commands/pushback.ts";
import type { PrComment } from "../core/gh.ts";

// ── Helpers ──────────────────────────────────────────────────────────

function createMockIO(): DaemonIO & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    writeFileSync: vi.fn((path, content) => {
      files.set(String(path), String(content));
    }) as DaemonIO["writeFileSync"],
    readFileSync: vi.fn((path) => {
      const content = files.get(String(path));
      if (content === undefined) throw new Error(`ENOENT: ${String(path)}`);
      return content;
    }) as unknown as DaemonIO["readFileSync"],
    unlinkSync: vi.fn((path) => {
      files.delete(String(path));
    }) as DaemonIO["unlinkSync"],
    existsSync: vi.fn((path) => files.has(String(path))) as DaemonIO["existsSync"],
    mkdirSync: vi.fn() as DaemonIO["mkdirSync"],
    renameSync: vi.fn() as DaemonIO["renameSync"],
  };
}

function makeComment(overrides: Partial<PrComment>): PrComment {
  return {
    id: 1,
    body: "",
    author: "someone",
    authorAssociation: "MEMBER",
    createdAt: "2026-04-12T00:00:00Z",
    commentType: "review",
    ...overrides,
  };
}

function createDeps(
  io: DaemonIO & { files: Map<string, string> },
  branch: string | null = "ninthwave/H-FOO-1",
  postComment: PushbackDeps["postComment"] = () => true,
): PushbackDeps {
  return { io, getBranch: () => branch, postComment };
}

// ── Signal file I/O (durable, survives daemon restart) ───────────────

describe("pushback signal I/O", () => {
  it("pushbackSignalPath lives under the signals dir", () => {
    const path = pushbackSignalPath("/project", "H-1-1");
    expect(path).toContain("pushback--H-1-1.json");
    expect(path).toContain(signalDir("/project"));
  });

  it("write and read round-trips with reason and comment metadata", () => {
    const io = createMockIO();
    io.files.set(signalDir("/project"), "");

    writePushbackSignal("/project", "H-1-1", "I disagree", io, {
      commentId: 555,
      commentType: "review",
    });

    const signal = readPushbackSignal("/project", "H-1-1", io);
    expect(signal).not.toBeNull();
    expect(signal!.id).toBe("H-1-1");
    expect(signal!.reason).toBe("I disagree");
    expect(signal!.commentId).toBe(555);
    expect(signal!.commentType).toBe("review");
    expect(signal!.ts).toBeTruthy();
  });

  it("persists on disk so it survives a daemon restart (re-read from store)", () => {
    const io = createMockIO();
    io.files.set(signalDir("/project"), "");
    writePushbackSignal("/project", "H-1-1", "still disagree", io);

    // Simulate a fresh daemon process: new reader, same backing store.
    const restarted: DaemonIO = {
      ...io,
      readFileSync: io.readFileSync,
      existsSync: io.existsSync,
    };
    const signal = readPushbackSignal("/project", "H-1-1", restarted);
    expect(signal).not.toBeNull();
    expect(signal!.reason).toBe("still disagree");
  });

  it("omits comment metadata when not provided", () => {
    const io = createMockIO();
    io.files.set(signalDir("/project"), "");
    writePushbackSignal("/project", "H-1-1", "reason only", io);
    const signal = readPushbackSignal("/project", "H-1-1", io);
    expect(signal!.commentId).toBeUndefined();
    expect(signal!.commentType).toBeUndefined();
  });

  it("readPushbackSignal returns null when no file exists", () => {
    const io = createMockIO();
    expect(readPushbackSignal("/project", "H-1-1", io)).toBeNull();
  });

  it("readPushbackSignal returns null on invalid JSON", () => {
    const io = createMockIO();
    io.files.set(pushbackSignalPath("/project", "H-1-1"), "not json");
    expect(readPushbackSignal("/project", "H-1-1", io)).toBeNull();
  });

  it("readPushbackSignal returns null when reason is missing", () => {
    const io = createMockIO();
    io.files.set(pushbackSignalPath("/project", "H-1-1"), JSON.stringify({ id: "H-1-1", ts: "now" }));
    expect(readPushbackSignal("/project", "H-1-1", io)).toBeNull();
  });

  it("clearPushbackSignal deletes the signal file", () => {
    const io = createMockIO();
    io.files.set(signalDir("/project"), "");
    writePushbackSignal("/project", "H-1-1", "reason", io);
    expect(readPushbackSignal("/project", "H-1-1", io)).not.toBeNull();

    clearPushbackSignal("/project", "H-1-1", io);
    expect(readPushbackSignal("/project", "H-1-1", io)).toBeNull();
  });

  it("clearPushbackSignal is a no-op when file doesn't exist", () => {
    const io = createMockIO();
    clearPushbackSignal("/project", "H-1-1", io);
    expect(io.unlinkSync).not.toHaveBeenCalled();
  });

  it("creates the signals directory if needed", () => {
    const io = createMockIO();
    writePushbackSignal("/project", "H-1-1", "reason", io);
    expect(io.mkdirSync).toHaveBeenCalledWith(signalDir("/project"), { recursive: true });
  });
});

// ── Pure helpers ─────────────────────────────────────────────────────

describe("pushback comment convention", () => {
  it("formatPushbackComment embeds the marker and rationale", () => {
    const body = formatPushbackComment("the abstraction is intentional");
    expect(body).toContain(PUSHBACK_MARKER);
    expect(body).toContain("the abstraction is intentional");
    expect(body).toContain("**Implementer**");
  });

  it("formatPushbackComment links the agent doc when given a repo slug", () => {
    const body = formatPushbackComment("reason", "ninthwave-io/ninthwave");
    expect(body).toContain("https://github.com/ninthwave-io/ninthwave/blob/main/agents/implementer.md");
  });

  it("isPushbackComment recognizes the marker", () => {
    expect(isPushbackComment("**Implementer** [PUSHBACK] nope")).toBe(true);
    expect(isPushbackComment("just a normal comment")).toBe(false);
  });

  it("extractPushbackReason strips the prefix and marker", () => {
    expect(extractPushbackReason("**Implementer** [PUSHBACK] my reason")).toBe("my reason");
    expect(extractPushbackReason("no marker here")).toBe("no marker here");
  });

  it("appendPushbackRound tracks rounds distinctly (never coalesces)", () => {
    const r1 = appendPushbackRound(undefined, { reason: "first", ts: "t1", commentId: 1 });
    const r2 = appendPushbackRound(r1, { reason: "second", ts: "t2", commentId: 1 });
    expect(r2).toHaveLength(2);
    expect(r2[0].reason).toBe("first");
    expect(r2[1].reason).toBe("second");
    // Original array is not mutated.
    expect(r1).toHaveLength(1);
  });

  it("pushbackRoundsForComment counts rounds per disputed comment chain", () => {
    const rounds = [
      { reason: "a", ts: "t1", commentId: 10 },
      { reason: "b", ts: "t2", commentId: 10 },
      { reason: "c", ts: "t3", commentId: 20 },
    ];
    expect(pushbackRoundsForComment(rounds, 10)).toBe(2);
    expect(pushbackRoundsForComment(rounds, 20)).toBe(1);
    expect(pushbackRoundsForComment(rounds, 99)).toBe(0);
    expect(pushbackRoundsForComment(undefined, 10)).toBe(0);
  });
});

describe("parseTrustedPushbacks", () => {
  it("keeps pushback comments from trusted collaborators", () => {
    const comments = [
      makeComment({ id: 1, body: `${PUSHBACK_MARKER} disagree`, authorAssociation: "OWNER" }),
      makeComment({ id: 2, body: `${PUSHBACK_MARKER} also disagree`, authorAssociation: "COLLABORATOR" }),
    ];
    const parsed = parseTrustedPushbacks(comments);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].reason).toBe("disagree");
    expect(parsed[0].commentId).toBe(1);
  });

  it("filters out pushback from non-trusted sources", () => {
    const comments = [
      makeComment({ id: 1, body: `${PUSHBACK_MARKER} drive-by`, authorAssociation: "NONE" }),
      makeComment({ id: 2, body: `${PUSHBACK_MARKER} contributor`, authorAssociation: "CONTRIBUTOR" }),
      makeComment({ id: 3, body: `${PUSHBACK_MARKER} trusted`, authorAssociation: "MEMBER" }),
    ];
    const parsed = parseTrustedPushbacks(comments);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].commentId).toBe(3);
  });

  it("ignores comments without the marker", () => {
    const comments = [makeComment({ id: 1, body: "regular feedback", authorAssociation: "OWNER" })];
    expect(parseTrustedPushbacks(comments)).toHaveLength(0);
  });
});

// ── Argument parsing ─────────────────────────────────────────────────

describe("parsePushbackArgs", () => {
  it("parses -m message", () => {
    expect(parsePushbackArgs(["-m", "my reason"]).reason).toBe("my reason");
    expect(parsePushbackArgs(["--message", "my reason"]).reason).toBe("my reason");
  });

  it("parses comment metadata", () => {
    const parsed = parsePushbackArgs(["-m", "r", "--comment-id", "42", "--comment-type", "review"]);
    expect(parsed.commentId).toBe(42);
    expect(parsed.commentType).toBe("review");
  });

  it("accepts a bare positional reason", () => {
    expect(parsePushbackArgs(["just a reason"]).reason).toBe("just a reason");
  });

  it("rejects an invalid comment type", () => {
    expect(parsePushbackArgs(["-m", "r", "--comment-type", "bogus"]).commentType).toBeUndefined();
  });

  it("returns null reason when none given", () => {
    expect(parsePushbackArgs(["--comment-id", "1"]).reason).toBeNull();
  });
});

// ── Command ──────────────────────────────────────────────────────────

describe("cmdPushback", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("writes signal and posts comment for the current branch", () => {
    const io = createMockIO();
    io.files.set(signalDir("/project"), "");
    const postComment = vi.fn(() => true);
    const deps = createDeps(io, "ninthwave/H-FOO-1", postComment);

    const msg = cmdPushback(["-m", "I disagree with this"], "/project", deps);

    expect(msg).toContain("H-FOO-1");
    const signal = readPushbackSignal("/project", "H-FOO-1", io);
    expect(signal).not.toBeNull();
    expect(signal!.reason).toBe("I disagree with this");
    expect(postComment).toHaveBeenCalledWith("/project", "ninthwave/H-FOO-1", "I disagree with this");
  });

  it("still writes the durable signal when the PR comment fails to post", () => {
    const io = createMockIO();
    io.files.set(signalDir("/project"), "");
    const deps = createDeps(io, "ninthwave/H-FOO-1", () => false);

    const msg = cmdPushback(["-m", "reason"], "/project", deps);

    expect(msg).toContain("not posted");
    expect(readPushbackSignal("/project", "H-FOO-1", io)).not.toBeNull();
  });

  it("dies when no reason is provided", () => {
    const io = createMockIO();
    const deps = createDeps(io, "ninthwave/H-FOO-1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => { throw new Error("exit"); }) as never);
    try {
      expect(() => cmdPushback([], "/project", deps)).toThrow();
      // No durable signal written when the command rejects the input.
      expect(readPushbackSignal("/project", "H-FOO-1", io)).toBeNull();
    } finally {
      exitSpy.mockRestore();
    }
  });

  it("dies when on a non-item branch", () => {
    const io = createMockIO();
    const deps = createDeps(io, "main");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => { throw new Error("exit"); }) as never);
    try {
      expect(() => cmdPushback(["-m", "reason"], "/project", deps)).toThrow();
    } finally {
      exitSpy.mockRestore();
    }
  });
});
