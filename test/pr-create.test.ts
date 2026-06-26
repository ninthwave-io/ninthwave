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
  extractLabelArgs,
  hasBaseFlag,
  replaceBaseArg,
  extractPrNumber,
} from "../core/commands/pr-create.ts";
import type { RunResult } from "../core/types.ts";

function ok(stdout: string): RunResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(stderr: string): RunResult {
  return { stdout: "", stderr, exitCode: 1 };
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

describe("extractLabelArgs", () => {
  it("splits a separate --label value out of the args", () => {
    const { labels, rest } = extractLabelArgs(["--title", "x", "--label", "domain:foo", "--body", "y"]);
    expect(labels).toEqual(["domain:foo"]);
    expect(rest).toEqual(["--title", "x", "--body", "y"]);
  });

  it("splits the joined --label=value form", () => {
    const { labels, rest } = extractLabelArgs(["--label=domain:foo", "--title", "x"]);
    expect(labels).toEqual(["domain:foo"]);
    expect(rest).toEqual(["--title", "x"]);
  });

  it("splits the -l short alias and collects multiple labels", () => {
    const { labels, rest } = extractLabelArgs(["-l", "a", "--label", "b", "--title", "x"]);
    expect(labels).toEqual(["a", "b"]);
    expect(rest).toEqual(["--title", "x"]);
  });

  it("returns empty labels when none present", () => {
    const { labels, rest } = extractLabelArgs(["--title", "x"]);
    expect(labels).toEqual([]);
    expect(rest).toEqual(["--title", "x"]);
  });
});

describe("hasBaseFlag / replaceBaseArg", () => {
  it("detects all base flag forms", () => {
    expect(hasBaseFlag(["--base", "b"])).toBe(true);
    expect(hasBaseFlag(["--base=b"])).toBe(true);
    expect(hasBaseFlag(["-B", "b"])).toBe(true);
    expect(hasBaseFlag(["--title", "x"])).toBe(false);
  });

  it("replaces the base value in the separate form", () => {
    expect(replaceBaseArg(["--base", "old", "--title", "x"], "main"))
      .toEqual(["--base", "main", "--title", "x"]);
  });

  it("replaces the base value in the joined form", () => {
    expect(replaceBaseArg(["--base=old", "--title", "x"], "main"))
      .toEqual(["--base=main", "--title", "x"]);
  });
});

describe("extractPrNumber", () => {
  it("parses the PR number from a gh pr create URL", () => {
    expect(extractPrNumber("https://github.com/o/r/pull/42")).toBe(42);
    expect(extractPrNumber("https://github.com/o/r/pull/7\n")).toBe(7);
  });

  it("returns null when there is no PR URL", () => {
    expect(extractPrNumber("nope")).toBeNull();
  });
});

describe("cmdPrCreate -- missing label recovery", () => {
  it("strips --label from gh pr create and applies labels via the injected applier", async () => {
    const runner = vi.fn(async () => ok("https://github.com/x/y/pull/42"));
    const applyLabels = vi.fn(() => true);

    const result = await cmdPrCreate(
      ["--title", "fix: x", "--label", "domain:newdomain", "--body", "y"],
      "/repo",
      {
        getBranch: () => "ninthwave/M-PRC-1",
        runAsyncImpl: runner,
        sleepImpl: async () => {},
        queryRateLimitImpl: async () => null,
        env: {},
        resolveTokenImpl: () => null,
        applyLabelsImpl: applyLabels,
      },
    );

    expect(result).toBe(0);
    const [, args] = runner.mock.calls[0]!;
    // gh pr create must NOT carry the label flag.
    expect(args).not.toContain("--label");
    expect(args).not.toContain("domain:newdomain");
    // Labels applied post-create against the parsed PR number.
    expect(applyLabels).toHaveBeenCalledWith("/repo", 42, ["domain:newdomain"]);
  });

  it("still succeeds (exit 0) when label application fails", async () => {
    const runner = vi.fn(async () => ok("https://github.com/x/y/pull/9"));
    const result = await cmdPrCreate(
      ["--title", "fix: x", "--label", "domain:foo"],
      "/repo",
      {
        getBranch: () => "ninthwave/M-PRC-1",
        runAsyncImpl: runner,
        sleepImpl: async () => {},
        queryRateLimitImpl: async () => null,
        env: {},
        resolveTokenImpl: () => null,
        applyLabelsImpl: () => false,
      },
    );
    expect(result).toBe(0);
  });
});

describe("cmdPrCreate -- transient failure retry and token pre-resolution", () => {
  it("pins a resolved token into the environment before invoking gh", async () => {
    const env: Record<string, string | undefined> = {};
    const runner = vi.fn(async () => ok("https://github.com/x/y/pull/1"));
    await cmdPrCreate(
      ["--title", "fix: x"],
      "/repo",
      {
        getBranch: () => "ninthwave/M-PRC-1",
        runAsyncImpl: runner,
        sleepImpl: async () => {},
        queryRateLimitImpl: async () => null,
        env,
        resolveTokenImpl: () => "ghp_static_token",
      },
    );
    expect(env.GH_TOKEN).toBe("ghp_static_token");
    expect(env.GITHUB_TOKEN).toBe("ghp_static_token");
  });

  it("does not overwrite an already-pinned token", async () => {
    const env: Record<string, string | undefined> = { GH_TOKEN: "existing" };
    const runner = vi.fn(async () => ok("https://github.com/x/y/pull/1"));
    const resolveToken = vi.fn(() => "ghp_new");
    await cmdPrCreate(
      ["--title", "fix: x"],
      "/repo",
      {
        getBranch: () => "ninthwave/M-PRC-1",
        runAsyncImpl: runner,
        sleepImpl: async () => {},
        queryRateLimitImpl: async () => null,
        env,
        resolveTokenImpl: resolveToken,
      },
    );
    expect(env.GH_TOKEN).toBe("existing");
    expect(resolveToken).not.toHaveBeenCalled();
  });

  it("retries a transient 401 and succeeds on the next attempt", async () => {
    const runner = vi.fn()
      .mockResolvedValueOnce(fail("HTTP 401: Bad credentials (https://api.github.com/...)"))
      .mockResolvedValueOnce(ok("https://github.com/x/y/pull/5"));
    const sleep = vi.fn(async () => {});
    const result = await cmdPrCreate(
      ["--title", "fix: x"],
      "/repo",
      {
        getBranch: () => "ninthwave/M-PRC-1",
        runAsyncImpl: runner,
        sleepImpl: sleep,
        queryRateLimitImpl: async () => null,
        env: {},
        resolveTokenImpl: () => null,
      },
    );
    expect(result).toBe(0);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("retries a connect timeout and succeeds on the next attempt", async () => {
    const runner = vi.fn()
      .mockResolvedValueOnce(fail("dial tcp: lookup api.github.com: i/o timeout"))
      .mockResolvedValueOnce(ok("https://github.com/x/y/pull/6"));
    const sleep = vi.fn(async () => {});
    const result = await cmdPrCreate(
      ["--title", "fix: x"],
      "/repo",
      {
        getBranch: () => "ninthwave/M-PRC-1",
        runAsyncImpl: runner,
        sleepImpl: sleep,
        queryRateLimitImpl: async () => null,
        env: {},
        resolveTokenImpl: () => null,
      },
    );
    expect(result).toBe(0);
    expect(runner).toHaveBeenCalledTimes(2);
  });
});

describe("cmdPrCreate -- merged + deleted base ref recovery", () => {
  it("retries against the default branch when the base ref is gone", async () => {
    const runner = vi.fn()
      .mockResolvedValueOnce(fail("GraphQL: Base ref must be a branch (createPullRequest)"))
      .mockResolvedValueOnce(ok("https://github.com/x/y/pull/8"));
    const result = await cmdPrCreate(
      ["--base", "ninthwave/dep", "--title", "fix: x"],
      "/repo",
      {
        getBranch: () => "ninthwave/M-PRC-1",
        runAsyncImpl: runner,
        sleepImpl: async () => {},
        queryRateLimitImpl: async () => null,
        env: {},
        resolveTokenImpl: () => null,
        getDefaultBranchImpl: () => "main",
      },
    );
    expect(result).toBe(0);
    expect(runner).toHaveBeenCalledTimes(2);
    const [, retryArgs] = runner.mock.calls[1]!;
    expect(retryArgs).toContain("--base");
    expect(retryArgs[retryArgs.indexOf("--base") + 1]).toBe("main");
  });

  it("surfaces a clear error when the base is gone and the default branch is unresolved", async () => {
    const runner = vi.fn(async () => fail("GraphQL: Base ref must be a branch (createPullRequest)"));
    const writes: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;
    try {
      const result = await cmdPrCreate(
        ["--base", "ninthwave/dep", "--title", "fix: x"],
        "/repo",
        {
          getBranch: () => "ninthwave/M-PRC-1",
          runAsyncImpl: runner,
          sleepImpl: async () => {},
          queryRateLimitImpl: async () => null,
          env: {},
          resolveTokenImpl: () => null,
          getDefaultBranchImpl: () => null,
        },
      );
      expect(result).toBe(1);
      // Only the initial attempt -- no default branch to retry against.
      expect(runner).toHaveBeenCalledTimes(1);
      const combined = writes.join("");
      expect(combined).toContain("base branch is gone");
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  it("does not retry base recovery when no --base was supplied", async () => {
    const runner = vi.fn(async () => fail("GraphQL: Base ref must be a branch (createPullRequest)"));
    const getDefaultBranch = vi.fn(() => "main");
    const result = await cmdPrCreate(
      ["--title", "fix: x"],
      "/repo",
      {
        getBranch: () => "ninthwave/M-PRC-1",
        runAsyncImpl: runner,
        sleepImpl: async () => {},
        queryRateLimitImpl: async () => null,
        env: {},
        resolveTokenImpl: () => null,
        getDefaultBranchImpl: getDefaultBranch,
      },
    );
    expect(result).toBe(1);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(getDefaultBranch).not.toHaveBeenCalled();
  });
});
