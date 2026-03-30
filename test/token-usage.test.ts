import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  findTokenUsageInJson,
  parseTokenUsageFromText,
  readLatestTokenUsage,
} from "../core/token-usage.ts";

describe("token usage", () => {
  it("finds nested token usage in JSON metadata", () => {
    expect(findTokenUsageInJson({
      session: {
        usage: {
          input_tokens: 120,
          output_tokens: 80,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 5,
        },
      },
    })).toEqual({
      inputTokens: 120,
      outputTokens: 80,
      cacheTokens: 15,
    });
  });

  it("parses token usage from stdout text", () => {
    expect(parseTokenUsageFromText([
      "Input tokens: 1,200",
      "Output tokens: 340",
      "Cache creation input tokens: 20",
      "Cache read input tokens: 30",
    ].join("\n"))).toEqual({
      inputTokens: 1200,
      outputTokens: 340,
      cacheTokens: 50,
    });
  });

  it("reads the latest Claude usage JSON from the project session directory", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nw-token-usage-"));
    const projectRoot = join(tempRoot, "repo");
    const usageDir = join(tempRoot, ".claude", "projects", projectRoot.replace(/\//g, "-"), "session-1");

    mkdirSync(usageDir, { recursive: true });
    writeFileSync(join(usageDir, "usage.json"), JSON.stringify({
      input_tokens: 200,
      output_tokens: 100,
      cache_creation_input_tokens: 25,
      cache_read_input_tokens: 5,
    }));

    try {
      expect(readLatestTokenUsage(projectRoot, "claude", {
        since: new Date().toISOString(),
      }, {
        existsSync,
        readdirSync,
        readFileSync,
        statSync,
        homeDir: tempRoot,
      })).toEqual({
        inputTokens: 200,
        outputTokens: 100,
        cacheTokens: 30,
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
