// Tests for core/gh.ts — prMerge and prComment functions.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock shell.ts so no real `gh` commands are executed
vi.mock("../core/shell.ts", () => ({
  run: vi.fn(),
}));

import { run } from "../core/shell.ts";
import type { Mock } from "vitest";
import { prMerge, prComment } from "../core/gh.ts";

const mockRun = run as Mock;

describe("prMerge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when gh pr merge succeeds", () => {
    mockRun.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });

    const result = prMerge("/repo", 42);

    expect(result).toBe(true);
    expect(mockRun).toHaveBeenCalledWith(
      "gh",
      ["pr", "merge", "42", "--squash", "--delete-branch"],
      { cwd: "/repo" },
    );
  });

  it("returns false when gh pr merge fails", () => {
    mockRun.mockReturnValue({
      stdout: "",
      stderr: "not mergeable",
      exitCode: 1,
    });

    const result = prMerge("/repo", 99);

    expect(result).toBe(false);
  });

  it("defaults to squash merge method", () => {
    mockRun.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });

    prMerge("/repo", 10);

    expect(mockRun).toHaveBeenCalledWith(
      "gh",
      ["pr", "merge", "10", "--squash", "--delete-branch"],
      { cwd: "/repo" },
    );
  });

  it("supports merge method", () => {
    mockRun.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });

    prMerge("/repo", 10, "merge");

    expect(mockRun).toHaveBeenCalledWith(
      "gh",
      ["pr", "merge", "10", "--merge", "--delete-branch"],
      { cwd: "/repo" },
    );
  });

  it("supports rebase method", () => {
    mockRun.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });

    prMerge("/repo", 10, "rebase");

    expect(mockRun).toHaveBeenCalledWith(
      "gh",
      ["pr", "merge", "10", "--rebase", "--delete-branch"],
      { cwd: "/repo" },
    );
  });
});

describe("prComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when gh pr comment succeeds", () => {
    mockRun.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });

    const result = prComment("/repo", 42, "LGTM!");

    expect(result).toBe(true);
    expect(mockRun).toHaveBeenCalledWith(
      "gh",
      ["pr", "comment", "42", "--body", "LGTM!"],
      { cwd: "/repo" },
    );
  });

  it("returns false when gh pr comment fails", () => {
    mockRun.mockReturnValue({
      stdout: "",
      stderr: "GraphQL error",
      exitCode: 1,
    });

    const result = prComment("/repo", 7, "Nice work");

    expect(result).toBe(false);
  });

  it("passes multi-line body correctly", () => {
    mockRun.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });

    const body = "Line 1\nLine 2\nLine 3";
    prComment("/repo", 5, body);

    expect(mockRun).toHaveBeenCalledWith(
      "gh",
      ["pr", "comment", "5", "--body", body],
      { cwd: "/repo" },
    );
  });
});
