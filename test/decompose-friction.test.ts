// Tests for decompose-friction command (core/commands/decompose-friction.ts).

import { describe, it, expect, afterEach } from "vitest";
import { join } from "path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { setupTempRepo, cleanupTempRepos } from "./helpers.ts";
import {
  parseFrictionFile,
  classifyFriction,
  decomposeFriction,
  nextFrictionTodoNumber,
  frictionAlreadyDecomposed,
  buildTodoFromFriction,
  type FrictionData,
} from "../core/commands/decompose-friction.ts";

afterEach(() => {
  cleanupTempRepos();
});

// ── parseFrictionFile ────────────────────────────────────────────────

describe("parseFrictionFile", () => {
  it("parses worker format (key-value lines)", () => {
    const content = [
      "todo: M-ADF-1",
      "date: 2026-03-27T09:20:19Z",
      "severity: medium",
      "description: The orchestrator retries even when tests pass",
    ].join("\n");

    const result = parseFrictionFile(content, "2026-03-27--M-ADF-1.md");

    expect(result.severity).toBe("medium");
    expect(result.description).toBe(
      "The orchestrator retries even when tests pass",
    );
    expect(result.todoRef).toBe("M-ADF-1");
    expect(result.date).toBe("2026-03-27T09:20:19Z");
    expect(result.fileName).toBe("2026-03-27--M-ADF-1.md");
    expect(result.title).toBe(
      "The orchestrator retries even when tests pass",
    );
  });

  it("parses rich format (markdown with sections)", () => {
    const content = [
      '# "CI Failed" state needs more granularity',
      "",
      "**Date:** 2026-03-25",
      "**Severity:** high",
      "**Component:** orchestrator",
      "",
      "**Observed:** The daemon shows CI Failed but doesn't distinguish failure modes.",
      "",
      "**Suggestion:** Add Worker Failed and PR Failed states.",
    ].join("\n");

    const result = parseFrictionFile(content, "2026-03-25-ci-failed.md");

    expect(result.title).toBe('"CI Failed" state needs more granularity');
    expect(result.severity).toBe("high");
    expect(result.component).toBe("orchestrator");
    expect(result.description).toBe(
      "The daemon shows CI Failed but doesn't distinguish failure modes.",
    );
    expect(result.suggestion).toBe(
      "Add Worker Failed and PR Failed states.",
    );
    expect(result.date).toBe("2026-03-25");
  });

  it("parses rich format with ## section headers", () => {
    const content = [
      "# Bun memory explosion",
      "",
      "**Severity:** critical",
      "",
      "## Observation",
      "Workers consume 3GB RAM each after 30 minutes.",
      "",
      "## Suggested fixes",
      "Use --smol flag on all bun invocations.",
    ].join("\n");

    const result = parseFrictionFile(content, "bun-memory.md");

    expect(result.title).toBe("Bun memory explosion");
    expect(result.severity).toBe("critical");
    expect(result.description).toBe(
      "Workers consume 3GB RAM each after 30 minutes.",
    );
    expect(result.suggestion).toBe(
      "Use --smol flag on all bun invocations.",
    );
  });

  it("defaults severity to medium when not specified", () => {
    const content = [
      "# Some friction",
      "",
      "**Observed:** Something happened.",
    ].join("\n");

    const result = parseFrictionFile(content, "some-friction.md");
    expect(result.severity).toBe("medium");
  });
});

// ── classifyFriction ─────────────────────────────────────────────────

describe("classifyFriction", () => {
  const base: FrictionData = {
    title: "",
    severity: "low",
    description: "",
    suggestion: "",
    date: "",
    todoRef: "",
    component: "",
    fileName: "test.md",
  };

  it("classifies items with suggestions as actionable", () => {
    expect(
      classifyFriction({ ...base, suggestion: "Add retry logic" }),
    ).toBe("actionable");
  });

  it("classifies high severity with description as actionable", () => {
    expect(
      classifyFriction({
        ...base,
        severity: "high",
        description: "Workers crash on startup",
      }),
    ).toBe("actionable");
  });

  it("classifies critical severity with description as actionable", () => {
    expect(
      classifyFriction({
        ...base,
        severity: "critical",
        description: "Data loss on merge",
      }),
    ).toBe("actionable");
  });

  it("classifies items with action words as actionable", () => {
    expect(
      classifyFriction({
        ...base,
        description: "The daemon should retry failed items",
      }),
    ).toBe("actionable");
  });

  it("classifies items with action words in title as actionable", () => {
    expect(
      classifyFriction({
        ...base,
        title: "Need to fix the retry logic",
      }),
    ).toBe("actionable");
  });

  it("classifies empty low-severity items as informational", () => {
    expect(
      classifyFriction({
        ...base,
        severity: "low",
        description: "Noticed the UI flickers briefly",
      }),
    ).toBe("informational");
  });
});

// ── nextFrictionTodoNumber ───────────────────────────────────────────

describe("nextFrictionTodoNumber", () => {
  it("returns 1 when no friction TODOs exist", () => {
    const repo = setupTempRepo();
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(todosDir, { recursive: true });

    expect(nextFrictionTodoNumber(todosDir)).toBe(1);
  });

  it("returns next number after existing friction TODOs", () => {
    const repo = setupTempRepo();
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(todosDir, { recursive: true });

    writeFileSync(join(todosDir, "1-friction--H-FRC-1.md"), "# test\n");
    writeFileSync(join(todosDir, "2-friction--M-FRC-2.md"), "# test\n");

    expect(nextFrictionTodoNumber(todosDir)).toBe(3);
  });

  it("returns 1 when directory does not exist", () => {
    expect(nextFrictionTodoNumber("/nonexistent")).toBe(1);
  });
});

// ── frictionAlreadyDecomposed ────────────────────────────────────────

describe("frictionAlreadyDecomposed", () => {
  it("returns false when no matching TODO exists", () => {
    const repo = setupTempRepo();
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(todosDir, { recursive: true });

    expect(frictionAlreadyDecomposed(todosDir, "test-friction.md")).toBe(
      false,
    );
  });

  it("returns true when a TODO references the friction file", () => {
    const repo = setupTempRepo();
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(todosDir, { recursive: true });

    writeFileSync(
      join(todosDir, "2-friction--M-FRC-1.md"),
      "# Fix: Something\n\nFriction source: test-friction.md\n",
    );

    expect(frictionAlreadyDecomposed(todosDir, "test-friction.md")).toBe(
      true,
    );
  });
});

// ── buildTodoFromFriction ────────────────────────────────────────────

describe("buildTodoFromFriction", () => {
  it("builds a TodoItem with correct fields", () => {
    const friction: FrictionData = {
      title: "Daemon crashes on startup",
      severity: "high",
      description: "The daemon crashes when no config file exists.",
      suggestion: "Add a default config fallback.",
      date: "2026-03-27",
      todoRef: "",
      component: "daemon",
      fileName: "2026-03-27-daemon-crash.md",
    };

    const item = buildTodoFromFriction(friction, "H-FRC-1", "high");

    expect(item.id).toBe("H-FRC-1");
    expect(item.priority).toBe("high");
    expect(item.title).toBe("Fix: Daemon crashes on startup");
    expect(item.domain).toBe("daemon");
    expect(item.repoAlias).toBe("friction");
    expect(item.rawText).toContain("Friction source: 2026-03-27-daemon-crash.md");
    expect(item.rawText).toContain("Add a default config fallback.");
    expect(item.rawText).toContain("Acceptance:");
  });

  it("uses 'friction' as domain when no component specified", () => {
    const friction: FrictionData = {
      title: "Something is slow",
      severity: "medium",
      description: "Tests take too long.",
      suggestion: "",
      date: "",
      todoRef: "",
      component: "",
      fileName: "slow.md",
    };

    const item = buildTodoFromFriction(friction, "M-FRC-1", "medium");
    expect(item.domain).toBe("friction");
  });
});

// ── decomposeFriction (integration) ─────────────────────────────────

describe("decomposeFriction", () => {
  it("creates a TODO from a simple friction file", () => {
    const repo = setupTempRepo();
    const frictionDir = join(repo, ".ninthwave", "friction");
    const todosDir = join(repo, ".ninthwave", "todos");
    const processedDir = join(frictionDir, "processed");
    mkdirSync(frictionDir, { recursive: true });
    mkdirSync(processedDir, { recursive: true });
    mkdirSync(todosDir, { recursive: true });

    writeFileSync(
      join(frictionDir, "2026-03-27-test.md"),
      [
        "todo: M-ADF-1",
        "date: 2026-03-27T09:00:00Z",
        "severity: medium",
        "description: The CLI should validate input before processing",
      ].join("\n"),
    );

    const result = decomposeFriction(frictionDir, todosDir);

    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toContain("M-FRC-1");
    expect(result.skipped).toHaveLength(0);

    // Verify TODO file was created
    const todoFiles = readdirSync(todosDir).filter((f) => f.endsWith(".md"));
    expect(todoFiles).toHaveLength(1);
    expect(todoFiles[0]).toContain("M-FRC-1");

    // Verify TODO content
    const todoContent = readFileSync(join(todosDir, todoFiles[0]!), "utf-8");
    expect(todoContent).toContain("Fix:");
    expect(todoContent).toContain("M-FRC-1");
    expect(todoContent).toContain("**Priority:** Medium");
    expect(todoContent).toContain("Friction source: 2026-03-27-test.md");
  });

  it("moves friction files to processed/", () => {
    const repo = setupTempRepo();
    const frictionDir = join(repo, ".ninthwave", "friction");
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(frictionDir, { recursive: true });
    mkdirSync(todosDir, { recursive: true });

    writeFileSync(
      join(frictionDir, "test-friction.md"),
      [
        "todo: X-1-1",
        "date: 2026-03-27T09:00:00Z",
        "severity: high",
        "description: Something needs fixing",
      ].join("\n"),
    );

    decomposeFriction(frictionDir, todosDir);

    // Original file should be gone
    expect(existsSync(join(frictionDir, "test-friction.md"))).toBe(false);

    // Should be in processed/
    expect(
      existsSync(join(frictionDir, "processed", "test-friction.md")),
    ).toBe(true);
  });

  it("is idempotent — running twice does not create duplicates", () => {
    const repo = setupTempRepo();
    const frictionDir = join(repo, ".ninthwave", "friction");
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(frictionDir, { recursive: true });
    mkdirSync(todosDir, { recursive: true });

    const frictionContent = [
      "todo: X-1-1",
      "date: 2026-03-27T09:00:00Z",
      "severity: medium",
      "description: The CLI should validate input before processing",
    ].join("\n");

    // First run
    writeFileSync(join(frictionDir, "friction-a.md"), frictionContent);
    const result1 = decomposeFriction(frictionDir, todosDir);
    expect(result1.created).toHaveLength(1);

    // Second run: friction file was moved, so nothing to process
    const result2 = decomposeFriction(frictionDir, todosDir);
    expect(result2.created).toHaveLength(0);

    // Verify only one TODO exists
    const todoFiles = readdirSync(todosDir).filter((f) => f.endsWith(".md"));
    expect(todoFiles).toHaveLength(1);
  });

  it("handles crash recovery — detects already-decomposed friction files", () => {
    const repo = setupTempRepo();
    const frictionDir = join(repo, ".ninthwave", "friction");
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(frictionDir, { recursive: true });
    mkdirSync(todosDir, { recursive: true });

    // Simulate crash: friction file still in root, but TODO already exists
    writeFileSync(
      join(frictionDir, "friction-b.md"),
      [
        "todo: X-1-1",
        "date: 2026-03-27T09:00:00Z",
        "severity: medium",
        "description: Some friction",
      ].join("\n"),
    );
    writeFileSync(
      join(todosDir, "2-friction--M-FRC-1.md"),
      "# Fix: Some friction (M-FRC-1)\n\nFriction source: friction-b.md\n",
    );

    const result = decomposeFriction(frictionDir, todosDir);

    expect(result.created).toHaveLength(0);
    expect(result.alreadyProcessed).toHaveLength(1);
    expect(result.alreadyProcessed[0]).toBe("friction-b.md");

    // Still only one TODO
    const todoFiles = readdirSync(todosDir).filter((f) => f.endsWith(".md"));
    expect(todoFiles).toHaveLength(1);

    // Friction file moved to processed
    expect(existsSync(join(frictionDir, "friction-b.md"))).toBe(false);
    expect(
      existsSync(join(frictionDir, "processed", "friction-b.md")),
    ).toBe(true);
  });

  it("skips informational friction files (no suggestion, low severity)", () => {
    const repo = setupTempRepo();
    const frictionDir = join(repo, ".ninthwave", "friction");
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(frictionDir, { recursive: true });
    mkdirSync(todosDir, { recursive: true });

    writeFileSync(
      join(frictionDir, "informational.md"),
      [
        "# Noticed a brief UI flicker",
        "",
        "**Severity:** low",
        "",
        "**Observed:** The TUI flickers when refreshing status.",
      ].join("\n"),
    );

    const result = decomposeFriction(frictionDir, todosDir);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);

    // File moved to processed even though no TODO was created
    expect(existsSync(join(frictionDir, "informational.md"))).toBe(false);
    expect(
      existsSync(join(frictionDir, "processed", "informational.md")),
    ).toBe(true);
  });

  it("handles empty friction directory", () => {
    const repo = setupTempRepo();
    const frictionDir = join(repo, ".ninthwave", "friction");
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(frictionDir, { recursive: true });
    mkdirSync(todosDir, { recursive: true });

    const result = decomposeFriction(frictionDir, todosDir);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.alreadyProcessed).toHaveLength(0);
  });

  it("handles nonexistent friction directory", () => {
    const result = decomposeFriction("/nonexistent", "/also-nonexistent");

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("processes multiple friction files with correct numbering", () => {
    const repo = setupTempRepo();
    const frictionDir = join(repo, ".ninthwave", "friction");
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(frictionDir, { recursive: true });
    mkdirSync(todosDir, { recursive: true });

    writeFileSync(
      join(frictionDir, "friction-1.md"),
      [
        "# Workers crash on startup",
        "",
        "**Severity:** high",
        "",
        "**Observed:** Workers fail to start.",
        "",
        "**Suggestion:** Add startup validation.",
      ].join("\n"),
    );

    writeFileSync(
      join(frictionDir, "friction-2.md"),
      [
        "todo: X-1-1",
        "date: 2026-03-27T09:00:00Z",
        "severity: medium",
        "description: The CLI should provide better error messages",
      ].join("\n"),
    );

    const result = decomposeFriction(frictionDir, todosDir);

    expect(result.created).toHaveLength(2);

    const todoFiles = readdirSync(todosDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    expect(todoFiles).toHaveLength(2);

    // Verify both have unique IDs
    const ids = todoFiles.map((f) => {
      const match = f.match(/--([A-Z]-FRC-\d+)\.md$/);
      return match?.[1];
    });
    expect(new Set(ids).size).toBe(2);
  });

  it("maps severity to priority correctly", () => {
    const repo = setupTempRepo();
    const frictionDir = join(repo, ".ninthwave", "friction");
    const todosDir = join(repo, ".ninthwave", "todos");
    mkdirSync(frictionDir, { recursive: true });
    mkdirSync(todosDir, { recursive: true });

    writeFileSync(
      join(frictionDir, "high-sev.md"),
      [
        "# Critical failure",
        "",
        "**Severity:** high",
        "",
        "**Observed:** System is broken.",
        "",
        "**Suggestion:** Fix it.",
      ].join("\n"),
    );

    decomposeFriction(frictionDir, todosDir);

    const todoFiles = readdirSync(todosDir).filter((f) => f.endsWith(".md"));
    expect(todoFiles).toHaveLength(1);

    const content = readFileSync(join(todosDir, todoFiles[0]!), "utf-8");
    expect(content).toContain("**Priority:** High");
    // High severity → H- prefix in ID
    expect(todoFiles[0]).toMatch(/--H-FRC-/);
  });
});
