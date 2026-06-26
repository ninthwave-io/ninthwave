// Tests for reading and surfacing dependency decision logs at worker startup.

import { describe, it, expect, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import {
  decisionItemIdFromFileName,
  readDependencyDecisions,
  formatDependencyDecisionsSection,
  buildDependencyDecisionsSection,
} from "../core/decision-logs.ts";

const createdDirs: string[] = [];

function makeDecisionsDir(): string {
  // Deterministic unique path without Date.now()/Math.random() (both banned in
  // this repo's test environment): derive from a monotonically growing counter.
  const dir = join(tmpdir(), `nw-decisions-test-${createdDirs.length}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  createdDirs.push(dir);
  return dir;
}

function writeDecision(dir: string, fileName: string, body: string): void {
  writeFileSync(join(dir, fileName), body);
}

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("decisionItemIdFromFileName", () => {
  it("extracts the item ID after the timestamp separator", () => {
    expect(decisionItemIdFromFileName("2026-06-21T10-15-00Z--A-1.md")).toBe("A-1");
  });

  it("preserves hyphenated item IDs", () => {
    expect(decisionItemIdFromFileName("2026-06-21T10-15-00Z--M-WDD-1.md")).toBe("M-WDD-1");
  });

  it("returns null for files without the separator", () => {
    expect(decisionItemIdFromFileName(".gitkeep")).toBeNull();
    expect(decisionItemIdFromFileName("notes.md")).toBeNull();
  });

  it("returns null for non-markdown files", () => {
    expect(decisionItemIdFromFileName("2026-06-21T10-15-00Z--A-1.txt")).toBeNull();
  });
});

describe("readDependencyDecisions", () => {
  it("returns an empty array when there are no dependencies", () => {
    const dir = makeDecisionsDir();
    writeDecision(dir, "2026-06-21T10-15-00Z--A-1.md", "item: A-1\ndecision: keep the DTO");
    expect(readDependencyDecisions(dir, [])).toEqual([]);
  });

  it("returns an empty array when the decisions directory is missing", () => {
    expect(readDependencyDecisions(join(tmpdir(), "nw-does-not-exist-xyz"), ["A-1"])).toEqual([]);
  });

  it("returns only the logs belonging to the given dependencies", () => {
    const dir = makeDecisionsDir();
    writeDecision(dir, "2026-06-21T10-15-00Z--A-1.md", "item: A-1\ndecision: keep the DTO");
    writeDecision(dir, "2026-06-22T11-00-00Z--B-2.md", "item: B-2\ndecision: unrelated");

    const entries = readDependencyDecisions(dir, ["A-1"]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.itemId).toBe("A-1");
    expect(entries[0]!.content).toContain("keep the DTO");
  });

  it("returns logs sorted chronologically by timestamp prefix", () => {
    const dir = makeDecisionsDir();
    writeDecision(dir, "2026-06-22T11-00-00Z--A-1.md", "second");
    writeDecision(dir, "2026-06-21T10-15-00Z--A-1.md", "first");

    const entries = readDependencyDecisions(dir, ["A-1"]);
    expect(entries.map((e) => e.content)).toEqual(["first", "second"]);
  });

  it("skips empty decision files", () => {
    const dir = makeDecisionsDir();
    writeDecision(dir, "2026-06-21T10-15-00Z--A-1.md", "   \n  ");
    expect(readDependencyDecisions(dir, ["A-1"])).toEqual([]);
  });

  it("ignores the .gitkeep placeholder", () => {
    const dir = makeDecisionsDir();
    writeDecision(dir, ".gitkeep", "");
    expect(readDependencyDecisions(dir, ["A-1"])).toEqual([]);
  });
});

describe("formatDependencyDecisionsSection", () => {
  it("returns an empty string when there are no entries", () => {
    expect(formatDependencyDecisionsSection([])).toBe("");
  });

  it("renders a heading and one block per decision", () => {
    const section = formatDependencyDecisionsSection([
      { itemId: "A-1", fileName: "2026-06-21T10-15-00Z--A-1.md", content: "decision: keep the DTO" },
    ]);
    expect(section).toContain("## Pending decisions on your dependencies");
    expect(section).toContain("### Decision logged by A-1 (2026-06-21T10-15-00Z--A-1.md)");
    expect(section).toContain("decision: keep the DTO");
  });
});

describe("buildDependencyDecisionsSection", () => {
  it("surfaces a dependency's logged decision", () => {
    const dir = makeDecisionsDir();
    writeDecision(
      dir,
      "2026-06-21T10-15-00Z--A-1.md",
      "item: A-1\ndecision: keep PaymentDTO as a serialization boundary",
    );
    const section = buildDependencyDecisionsSection(dir, ["A-1"]);
    expect(section).toContain("## Pending decisions on your dependencies");
    expect(section).toContain("keep PaymentDTO as a serialization boundary");
  });

  it("produces no section for an item with no dependencies", () => {
    const dir = makeDecisionsDir();
    writeDecision(dir, "2026-06-21T10-15-00Z--A-1.md", "decision: x");
    expect(buildDependencyDecisionsSection(dir, [])).toBe("");
  });

  it("produces no spurious section when a dependency has no decision logs", () => {
    const dir = makeDecisionsDir();
    writeDecision(dir, "2026-06-22T11-00-00Z--B-2.md", "decision: unrelated");
    expect(buildDependencyDecisionsSection(dir, ["A-1"])).toBe("");
  });
});
