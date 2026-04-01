import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const ciWorkflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf-8");

describe("CI workflow contract", () => {
  it("runs on pull request opens, syncs, reopens, and edits", () => {
    expect(ciWorkflow).toContain("pull_request:");
    expect(ciWorkflow).toContain("types: [opened, synchronize, reopened, edited]");
  });

  it("does not restrict CI to main-only pull request bases", () => {
    expect(ciWorkflow).not.toMatch(/^\s+branches:\s*\[main\]$/m);
  });

  it("keeps the required CI Gate job", () => {
    expect(ciWorkflow).toContain("gate:");
    expect(ciWorkflow).toContain("name: CI Gate");
  });
});
