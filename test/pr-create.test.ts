// Tests for core/commands/pr-create.ts.
//
// Covers the head-injection contract: when `nw pr-create` is invoked
// without an explicit `--head`, the forwarded `gh pr create` invocation
// must always carry an explicit `--head <branch>` resolved from
// `git rev-parse --abbrev-ref HEAD`. This avoids gh's worktree
// auto-resolution misbehavior, where head can fall back to the default
// branch and produce a misleading "head branch 'main' is the same as
// base branch 'main'" failure.
//
// Uses dependency injection (getBranch, runAsyncImpl, sleepImpl,
// queryRateLimitImpl) instead of vi.mock so the underlying gh and
// pr-create modules stay shared with other test files.

import { describe, it, expect, vi } from "vitest";
import {
  cmdPrCreate,
  hasHeadFlag,
  resolveHeadArgs,
} from "../core/commands/pr-create.ts";
import type { RunResult } from "../core/types.ts";

function ok(stdout: string): RunResult {
  return { stdout, stderr: "", exitCode: 0 };
}

describe("hasHeadFlag", () => {
  it("returns false when no head flag is present", () => {
    expect(hasHeadFlag(["--title", "fix: x", "--body", "y"])).toBe(false);
  });

  it("recognises the separate --head value form", () => {
    expect(hasHeadFlag(["--head", "feature-branch"])).toBe(true);
  });

  it("recognises the joined --head=value form", () => {
    expect(hasHeadFlag(["--head=feature-branch"])).toBe(true);
  });

  it("recognises the short -H alias", () => {
    expect(hasHeadFlag(["-H", "feature-branch"])).toBe(true);
  });

  it("does not trigger on unrelated flags that share a prefix", () => {
    expect(hasHeadFlag(["--header", "x"])).toBe(false);
  });
});

describe("resolveHeadArgs", () => {
  it("injects --head <branch> at the front when no head flag is present", () => {
    const result = resolveHeadArgs(
      ["--title", "fix: x", "--body", "y"],
      () => "ninthwave/H-PRCR-1",
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.args).toEqual(["--head", "ninthwave/H-PRCR-1", "--title", "fix: x", "--body", "y"]);
  });

  it("preserves an explicit --head and does not call the branch resolver", () => {
    const getBranch = vi.fn(() => "should-not-be-used");
    const result = resolveHeadArgs(
      ["--head", "explicit-branch", "--title", "fix: x"],
      getBranch,
    );
    expect(getBranch).not.toHaveBeenCalled();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.args).toEqual(["--head", "explicit-branch", "--title", "fix: x"]);
    // No double --head injected.
    expect(result.args.filter((a) => a === "--head")).toHaveLength(1);
  });

  it("preserves the joined --head=value form without injecting another --head", () => {
    const result = resolveHeadArgs(
      ["--head=explicit-branch", "--title", "fix: x"],
      () => "should-not-be-used",
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.args).toEqual(["--head=explicit-branch", "--title", "fix: x"]);
    expect(result.args.some((a) => a === "--head")).toBe(false);
  });

  it("returns a clear error when the branch resolver returns null (detached HEAD)", () => {
    const result = resolveHeadArgs(["--title", "fix: x"], () => null);
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.message).toContain("could not determine the current branch");
    expect(result.message).toContain("--head <branch>");
  });
});

describe("cmdPrCreate", () => {
  it("forwards --head <git-rev-parse output> when no --head flag is supplied", async () => {
    const runner = vi.fn(async () => ok("https://github.com/x/y/pull/42"));
    const result = await cmdPrCreate(
      ["--title", "fix: x", "--body", "y"],
      "/repo",
      {
        getBranch: () => "ninthwave/H-PRCR-1",
        runAsyncImpl: runner,
        sleepImpl: async () => {},
        queryRateLimitImpl: async () => null,
      },
    );

    expect(result).toBe(0);
    expect(runner).toHaveBeenCalledTimes(1);
    const [cmd, args] = runner.mock.calls[0]!;
    expect(cmd).toBe("gh");
    expect(args).toEqual([
      "pr",
      "create",
      "--head",
      "ninthwave/H-PRCR-1",
      "--title",
      "fix: x",
      "--body",
      "y",
    ]);
  });

  it("preserves an explicit --head and does not override it", async () => {
    const runner = vi.fn(async () => ok("https://github.com/x/y/pull/7"));
    const result = await cmdPrCreate(
      ["--head", "explicit-branch", "--title", "fix: x"],
      "/repo",
      {
        getBranch: () => "should-not-be-used",
        runAsyncImpl: runner,
        sleepImpl: async () => {},
        queryRateLimitImpl: async () => null,
      },
    );

    expect(result).toBe(0);
    const [, args] = runner.mock.calls[0]!;
    // The forwarded args should contain exactly one --head, with the explicit value.
    const headIndex = args.indexOf("--head");
    expect(headIndex).toBeGreaterThanOrEqual(0);
    expect(args[headIndex + 1]).toBe("explicit-branch");
    expect(args.filter((a: string) => a === "--head")).toHaveLength(1);
  });

  it("exits with code 1 and a clear error when the current branch cannot be resolved", async () => {
    const runner = vi.fn(async () => ok(""));
    const writes: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;

    try {
      const result = await cmdPrCreate(
        ["--title", "fix: x"],
        "/repo",
        {
          getBranch: () => null,
          runAsyncImpl: runner,
          sleepImpl: async () => {},
          queryRateLimitImpl: async () => null,
        },
      );

      expect(result).toBe(1);
      expect(runner).not.toHaveBeenCalled();
      const combined = writes.join("");
      expect(combined).toContain("could not determine the current branch");
      expect(combined).toContain("--head <branch>");
    } finally {
      process.stderr.write = originalWrite;
    }
  });
});
