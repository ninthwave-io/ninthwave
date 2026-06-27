// Tests for the no-new-info path: durable signal I/O (core/daemon.ts) and the
// nw no-new-info command (core/commands/no-new-info.ts), which records a spurious
// worker wake and logs friction.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "path";
import {
  writeNoNewInfoSignal,
  readNoNewInfoSignal,
  clearNoNewInfoSignal,
  noNewInfoSignalPath,
  signalDir,
  type DaemonIO,
} from "../core/daemon.ts";
import {
  cmdNoNewInfo,
  parseNoNewInfoArgs,
  type NoNewInfoDeps,
} from "../core/commands/no-new-info.ts";

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

function createDeps(
  io: DaemonIO & { files: Map<string, string> },
  branch: string | null = "ninthwave/H-FOO-1",
): NoNewInfoDeps {
  return {
    io,
    getBranch: () => branch,
    now: () => new Date("2026-06-27T01:23:45.000Z"),
  };
}

// ── Signal file I/O (durable, survives daemon restart) ───────────────

describe("no-new-info signal I/O", () => {
  it("writes and reads back a signal with the reason", () => {
    const io = createMockIO();
    writeNoNewInfoSignal("/project", "H-1-1", "reviewer echoed its own approval", io);
    const signal = readNoNewInfoSignal("/project", "H-1-1", io);
    expect(signal).not.toBeNull();
    expect(signal!.id).toBe("H-1-1");
    expect(signal!.reason).toBe("reviewer echoed its own approval");
    expect(typeof signal!.ts).toBe("string");
  });

  it("survives a fresh DaemonIO (durable on disk)", () => {
    const io = createMockIO();
    writeNoNewInfoSignal("/project", "H-1-1", "stale comment", io);
    const restarted: DaemonIO & { files: Map<string, string> } = { ...createMockIO(), files: io.files };
    restarted.readFileSync = io.readFileSync;
    restarted.existsSync = io.existsSync;
    const signal = readNoNewInfoSignal("/project", "H-1-1", restarted);
    expect(signal!.reason).toBe("stale comment");
  });

  it("returns null when no file exists", () => {
    const io = createMockIO();
    expect(readNoNewInfoSignal("/project", "H-1-1", io)).toBeNull();
  });

  it("returns null on invalid JSON", () => {
    const io = createMockIO();
    io.files.set(noNewInfoSignalPath("/project", "H-1-1"), "not json");
    expect(readNoNewInfoSignal("/project", "H-1-1", io)).toBeNull();
  });

  it("returns null when reason is missing", () => {
    const io = createMockIO();
    io.files.set(noNewInfoSignalPath("/project", "H-1-1"), JSON.stringify({ id: "H-1-1", ts: "x" }));
    expect(readNoNewInfoSignal("/project", "H-1-1", io)).toBeNull();
  });

  it("clear deletes the signal", () => {
    const io = createMockIO();
    writeNoNewInfoSignal("/project", "H-1-1", "reason", io);
    expect(readNoNewInfoSignal("/project", "H-1-1", io)).not.toBeNull();
    clearNoNewInfoSignal("/project", "H-1-1", io);
    expect(readNoNewInfoSignal("/project", "H-1-1", io)).toBeNull();
  });
});

// ── Argument parsing ─────────────────────────────────────────────────

describe("parseNoNewInfoArgs", () => {
  it("parses -m / --message", () => {
    expect(parseNoNewInfoArgs(["-m", "spurious"]).reason).toBe("spurious");
    expect(parseNoNewInfoArgs(["--message", "spurious"]).reason).toBe("spurious");
  });

  it("accepts a bare positional reason", () => {
    expect(parseNoNewInfoArgs(["just a reason"]).reason).toBe("just a reason");
  });

  it("returns null reason when none given", () => {
    expect(parseNoNewInfoArgs([]).reason).toBeNull();
  });
});

// ── Command ──────────────────────────────────────────────────────────

describe("cmdNoNewInfo", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("writes the signal and logs a friction entry for the current branch", () => {
    const io = createMockIO();
    const deps = createDeps(io, "ninthwave/H-FOO-1");

    const msg = cmdNoNewInfo(["-m", "reviewer's own approval echoed back"], "/project", deps);

    expect(msg).toContain("H-FOO-1");

    const signal = readNoNewInfoSignal("/project", "H-FOO-1", io);
    expect(signal).not.toBeNull();
    expect(signal!.reason).toBe("reviewer's own approval echoed back");

    // A friction entry lands in the project friction inbox (not the PR branch).
    const frictionDir = join("/project", ".ninthwave", "friction");
    const frictionEntries = [...io.files.entries()].filter(([path]) => path.startsWith(frictionDir) && path.endsWith(".md"));
    expect(frictionEntries.length).toBe(1);
    expect(frictionEntries[0][1]).toContain("reviewer's own approval echoed back");
    expect(frictionEntries[0][1]).toContain("H-FOO-1");
  });

  it("dies when no reason is provided (no signal written)", () => {
    const io = createMockIO();
    const deps = createDeps(io, "ninthwave/H-FOO-1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => { throw new Error("exit"); }) as never);
    try {
      expect(() => cmdNoNewInfo([], "/project", deps)).toThrow();
      expect(readNoNewInfoSignal("/project", "H-FOO-1", io)).toBeNull();
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
      expect(() => cmdNoNewInfo(["-m", "reason"], "/project", deps)).toThrow();
    } finally {
      exitSpy.mockRestore();
    }
  });
});
