// Tests for the gh.ts helpers that make nw pr-create robust to missing
// labels, transient auth/timeouts, and merged + deleted base refs.
//
// Uses injectable runners / a plain env object instead of vi.mock so the gh
// module stays shared with the other gh test files.

import { describe, it, expect, vi } from "vitest";
import {
  isBaseRefMissingError,
  addPrLabelsViaRest,
  applyPrLabels,
  ensureLabelExists,
  preResolveGhToken,
  DEFAULT_RETRIABLE_GH_KINDS,
} from "../core/gh.ts";
import type { RunResult } from "../core/types.ts";

function ok(stdout = ""): RunResult {
  return { stdout, stderr: "", exitCode: 0 };
}
function fail(stderr = "boom"): RunResult {
  return { stdout: "", stderr, exitCode: 1 };
}

describe("isBaseRefMissingError", () => {
  it("matches the GraphQL base-ref-must-be-a-branch error", () => {
    expect(isBaseRefMissingError("GraphQL: Base ref must be a branch (createPullRequest)")).toBe(true);
  });

  it("matches the base-ref-is-not-a-branch variant", () => {
    expect(isBaseRefMissingError("Base ref is not a branch")).toBe(true);
  });

  it("matches base-ref does-not-exist / not-found variants", () => {
    expect(isBaseRefMissingError("Base ref 'ninthwave/dep' does not exist")).toBe(true);
    expect(isBaseRefMissingError("Base ref not found")).toBe(true);
  });

  it("does NOT match 'no commits between' -- a valid base with no new commits", () => {
    expect(isBaseRefMissingError(
      "GraphQL: No commits between main and ninthwave/M-PRC-1 (createPullRequest)",
    )).toBe(false);
  });

  it("does not match unrelated failures", () => {
    expect(isBaseRefMissingError("could not resolve to a repository")).toBe(false);
    expect(isBaseRefMissingError("HTTP 401: Bad credentials")).toBe(false);
  });
});

describe("addPrLabelsViaRest", () => {
  it("posts labels to the REST issues endpoint (no gh pr edit / read:project)", () => {
    const runner = vi.fn(() => ok());
    const result = addPrLabelsViaRest(
      "/repo",
      42,
      ["domain:foo", "domain:bar"],
      runner,
      () => "ninthwave-io/ninthwave",
    );
    expect(result).toBe(true);
    expect(runner).toHaveBeenCalledTimes(1);
    const [, args] = runner.mock.calls[0]!;
    expect(args[0]).toBe("api");
    expect(args).toContain("--method");
    expect(args).toContain("POST");
    expect(args).toContain("repos/ninthwave-io/ninthwave/issues/42/labels");
    expect(args).toContain("labels[]=domain:foo");
    expect(args).toContain("labels[]=domain:bar");
    // Must not shell out to `gh pr edit --add-label` (needs read:project).
    expect(args).not.toContain("edit");
    expect(args).not.toContain("--add-label");
  });

  it("returns true and makes no call for an empty label set", () => {
    const runner = vi.fn(() => ok());
    expect(addPrLabelsViaRest("/repo", 1, [], runner, () => "o/r")).toBe(true);
    expect(runner).not.toHaveBeenCalled();
  });

  it("returns false when the REST call fails", () => {
    const runner = vi.fn(() => fail());
    expect(addPrLabelsViaRest("/repo", 1, ["domain:x"], runner, () => "o/r")).toBe(false);
  });

  it("returns false when the repo owner cannot be resolved", () => {
    const runner = vi.fn(() => ok());
    const result = addPrLabelsViaRest("/repo", 1, ["domain:x"], runner, () => {
      throw new Error("no owner");
    });
    expect(result).toBe(false);
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("ensureLabelExists / applyPrLabels", () => {
  it("idempotently creates each label with --force before applying", () => {
    const calls: string[][] = [];
    const runner = vi.fn((_repo: string, args: string[]) => {
      calls.push(args);
      return ok();
    });
    const result = applyPrLabels(
      "/repo",
      7,
      ["domain:newdomain"],
      runner,
      () => "o/r",
    );
    expect(result).toBe(true);
    // First a `label create --force`, then the REST labels POST.
    const createCall = calls.find((a) => a[0] === "label");
    expect(createCall).toBeDefined();
    expect(createCall).toContain("create");
    expect(createCall).toContain("domain:newdomain");
    expect(createCall).toContain("--force");
    const apiCall = calls.find((a) => a[0] === "api");
    expect(apiCall).toContain("repos/o/r/issues/7/labels");
  });

  it("ensureLabelExists issues a single force create", () => {
    const runner = vi.fn(() => ok());
    ensureLabelExists("/repo", "domain:foo", runner);
    expect(runner).toHaveBeenCalledTimes(1);
    const [, args] = runner.mock.calls[0]!;
    expect(args).toEqual(["label", "create", "domain:foo", "--color", expect.any(String), "--force"]);
  });
});

describe("preResolveGhToken", () => {
  it("pins a resolved token into GH_TOKEN and GITHUB_TOKEN", () => {
    const env: Record<string, string | undefined> = {};
    preResolveGhToken(env, () => "ghp_resolved");
    expect(env.GH_TOKEN).toBe("ghp_resolved");
    expect(env.GITHUB_TOKEN).toBe("ghp_resolved");
  });

  it("is a no-op when GH_TOKEN is already set", () => {
    const env: Record<string, string | undefined> = { GH_TOKEN: "existing" };
    const getToken = vi.fn(() => "ghp_new");
    preResolveGhToken(env, getToken);
    expect(env.GH_TOKEN).toBe("existing");
    expect(getToken).not.toHaveBeenCalled();
  });

  it("is a no-op when GITHUB_TOKEN is already set", () => {
    const env: Record<string, string | undefined> = { GITHUB_TOKEN: "existing" };
    preResolveGhToken(env, () => "ghp_new");
    expect(env.GH_TOKEN).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBe("existing");
  });

  it("leaves the env untouched when no token can be resolved", () => {
    const env: Record<string, string | undefined> = {};
    preResolveGhToken(env, () => null);
    expect(env.GH_TOKEN).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });
});

describe("DEFAULT_RETRIABLE_GH_KINDS", () => {
  it("absorbs rate-limit, auth, and network but not repo-access", () => {
    expect(DEFAULT_RETRIABLE_GH_KINDS.has("rate-limit")).toBe(true);
    expect(DEFAULT_RETRIABLE_GH_KINDS.has("auth")).toBe(true);
    expect(DEFAULT_RETRIABLE_GH_KINDS.has("network")).toBe(true);
    expect(DEFAULT_RETRIABLE_GH_KINDS.has("repo-access")).toBe(false);
    expect(DEFAULT_RETRIABLE_GH_KINDS.has("missing-cli")).toBe(false);
  });
});
