// Tests for project config and user config loading (JSON format).

import { describe, it, expect, afterEach, vi } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { loadConfig, saveConfig, loadUserConfig } from "../core/config.ts";
import { setupTempRepo, cleanupTempRepos } from "./helpers.ts";

afterEach(() => {
  cleanupTempRepos();
});

describe("loadConfig", () => {
  it("returns defaults when config file is missing", () => {
    const repo = setupTempRepo();
    const config = loadConfig(repo);
    expect(config.review_external).toBe(false);
    expect(config.schedule_enabled).toBe(false);
  });

  it("parses valid JSON with both keys", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ review_external: true, schedule_enabled: true }),
    );

    const config = loadConfig(repo);
    expect(config.review_external).toBe(true);
    expect(config.schedule_enabled).toBe(true);
  });

  it("defaults schedule_enabled when only review_external is set", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ review_external: true }),
    );

    const config = loadConfig(repo);
    expect(config.review_external).toBe(true);
    expect(config.schedule_enabled).toBe(false);
  });

  it("returns defaults for malformed JSON", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), "not valid json {{{");

    const config = loadConfig(repo);
    expect(config.review_external).toBe(false);
    expect(config.schedule_enabled).toBe(false);
  });

  it("returns defaults when JSON is an array", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), "[1, 2, 3]");

    const config = loadConfig(repo);
    expect(config.review_external).toBe(false);
    expect(config.schedule_enabled).toBe(false);
  });

  it("returns defaults when JSON is null", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), "null");

    const config = loadConfig(repo);
    expect(config.review_external).toBe(false);
    expect(config.schedule_enabled).toBe(false);
  });

  it("ignores unknown keys", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        review_external: true,
        schedule_enabled: false,
        unknown_key: "ignored",
        another_unknown: 42,
      }),
    );

    const config = loadConfig(repo);
    expect(config.review_external).toBe(true);
    expect(config.schedule_enabled).toBe(false);
    // Only known keys in the result
    expect(Object.keys(config)).toEqual(["review_external", "schedule_enabled", "ai_tools", "telemetry"]);
  });

  it("treats non-boolean review_external as false", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ review_external: "true" }),
    );

    const config = loadConfig(repo);
    // String "true" is not boolean true
    expect(config.review_external).toBe(false);
  });

  it("treats non-boolean schedule_enabled as false", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ schedule_enabled: 1 }),
    );

    const config = loadConfig(repo);
    expect(config.schedule_enabled).toBe(false);
  });

  it("reads ai_tools field", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ ai_tools: ["opencode", "claude"] }),
    );

    const config = loadConfig(repo);
    expect(config.ai_tools).toEqual(["opencode", "claude"]);
  });

  it("ignores legacy ai_tool field", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ ai_tool: "opencode" }),
    );

    const config = loadConfig(repo);
    expect(config.ai_tools).toBeUndefined();
  });
});

describe("saveConfig", () => {
  it("creates config file when missing", () => {
    const repo = setupTempRepo();
    saveConfig(repo, { ai_tools: ["claude"] });

    const configPath = join(repo, ".ninthwave", "config.json");
    expect(existsSync(configPath)).toBe(true);
    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.ai_tools).toEqual(["claude"]);
  });

  it("merges ai_tools into existing config without clobbering", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ review_external: true }),
    );

    saveConfig(repo, { ai_tools: ["opencode"] });

    const content = JSON.parse(readFileSync(join(configDir, "config.json"), "utf-8"));
    expect(content.review_external).toBe(true);
    expect(content.ai_tools).toEqual(["opencode"]);
  });

  it("preserves unknown keys in config file", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ custom_key: "hello", review_external: false }),
    );

    saveConfig(repo, { ai_tools: ["copilot"] });

    const content = JSON.parse(readFileSync(join(configDir, "config.json"), "utf-8"));
    expect(content.custom_key).toBe("hello");
    expect(content.ai_tools).toEqual(["copilot"]);
  });

  it("overwrites existing ai_tools value", () => {
    const repo = setupTempRepo();
    const configDir = join(repo, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ ai_tools: ["claude"] }),
    );

    saveConfig(repo, { ai_tools: ["opencode"] });

    const content = JSON.parse(readFileSync(join(configDir, "config.json"), "utf-8"));
    expect(content.ai_tools).toEqual(["opencode"]);
  });

  it("round-trips with loadConfig", () => {
    const repo = setupTempRepo();
    saveConfig(repo, { ai_tools: ["copilot"] });

    const config = loadConfig(repo);
    expect(config.ai_tools).toEqual(["copilot"]);
  });
});

describe("loadUserConfig", () => {
  it("returns {} when config file is missing", () => {
    const tmpHome = setupTempRepo(); // use temp dir as fake home
    const config = loadUserConfig(tmpHome);
    expect(config).toEqual({});
  });

  it("returns ai_tools from valid JSON", () => {
    const tmpHome = setupTempRepo();
    const configDir = join(tmpHome, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ ai_tools: ["opencode"] }),
    );

    const config = loadUserConfig(tmpHome);
    expect(config.ai_tools).toEqual(["opencode"]);
  });

  it("returns {} for malformed JSON and warns", () => {
    const tmpHome = setupTempRepo();
    const configDir = join(tmpHome, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), "not valid json {{{");

    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = loadUserConfig(tmpHome);
    expect(config).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("malformed JSON"),
    );
    warnSpy.mockRestore();
  });

  it("returns {} when JSON is an array and warns", () => {
    const tmpHome = setupTempRepo();
    const configDir = join(tmpHome, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), "[1, 2, 3]");

    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = loadUserConfig(tmpHome);
    expect(config).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("not a JSON object"),
    );
    warnSpy.mockRestore();
  });

  it("ignores legacy ai_tool field", () => {
    const tmpHome = setupTempRepo();
    const configDir = join(tmpHome, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ ai_tool: "opencode" }),
    );

    const config = loadUserConfig(tmpHome);
    expect(config.ai_tools).toBeUndefined();
  });

  it("ignores unknown keys", () => {
    const tmpHome = setupTempRepo();
    const configDir = join(tmpHome, ".ninthwave");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ ai_tools: ["claude"], some_other_key: "ignored" }),
    );

    const config = loadUserConfig(tmpHome);
    expect(config.ai_tools).toEqual(["claude"]);
    expect(Object.keys(config)).toEqual(["ai_tools"]);
  });
});
