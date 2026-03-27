// Decompose friction files into TODO items.
// Scans .ninthwave/friction/*.md for unprocessed friction files,
// classifies them as actionable vs informational, generates TODO files
// for actionable items, and moves all processed files to processed/.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
} from "fs";
import { join, basename } from "path";
import { writeTodoFile } from "../todo-files.ts";
import type { TodoItem, Priority } from "../types.ts";

// ── Friction file data ───────────────────────────────────────────────

export interface FrictionData {
  title: string;
  severity: string;
  description: string;
  suggestion: string;
  date: string;
  todoRef: string;
  component: string;
  fileName: string;
}

// ── Severity → Priority mapping ──────────────────────────────────────

const SEVERITY_TO_PRIORITY: Record<string, Priority> = {
  critical: "high",
  high: "high",
  medium: "medium",
  low: "low",
};

const PRIORITY_LETTER: Record<Priority, string> = {
  critical: "C",
  high: "H",
  medium: "M",
  low: "L",
};

// ── Parsing ──────────────────────────────────────────────────────────

/**
 * Parse a friction file into structured data.
 * Handles two formats:
 * 1. Worker format: key-value lines (todo:, date:, severity:, description:)
 * 2. Rich format: Markdown with # Title, **Observed:**, **Suggestion:** sections
 */
export function parseFrictionFile(
  content: string,
  fileName: string,
): FrictionData {
  const lines = content.split("\n");

  // Detect worker format: has both severity: and description: key-value lines
  const severityKV = lines.find((l) => /^severity:\s/.test(l));
  const descKV = lines.find((l) => /^description:\s/.test(l));

  if (severityKV && descKV) {
    return parseWorkerFormat(lines, fileName);
  }

  return parseRichFormat(lines, fileName);
}

function parseWorkerFormat(lines: string[], fileName: string): FrictionData {
  const get = (key: string): string => {
    const line = lines.find((l) => new RegExp(`^${key}:\\s`).test(l));
    return line ? line.replace(new RegExp(`^${key}:\\s*`), "").trim() : "";
  };

  const description = get("description");
  return {
    title: description,
    severity: get("severity"),
    description,
    suggestion: "",
    date: get("date"),
    todoRef: get("todo"),
    component: "",
    fileName,
  };
}

function parseRichFormat(lines: string[], fileName: string): FrictionData {
  let title = "";
  let severity = "";
  let date = "";
  let component = "";
  let currentSection = "";
  const sectionContent: Record<string, string[]> = {};

  for (const line of lines) {
    // Title from first # heading
    if (line.startsWith("# ") && !title) {
      title = line.slice(2).trim();
      continue;
    }

    // Metadata fields
    const dateMatch = line.match(/^\*\*Date:\*\*\s+(.+)/);
    if (dateMatch) {
      date = dateMatch[1]!.trim();
      continue;
    }
    const sevMatch = line.match(/^\*\*Severity:\*\*\s+(.+)/);
    if (sevMatch) {
      severity = sevMatch[1]!.trim().toLowerCase();
      continue;
    }
    const compMatch = line.match(/^\*\*Component:\*\*\s+(.+)/);
    if (compMatch) {
      component = compMatch[1]!.trim();
      continue;
    }

    // Bold section headers: **Observed:** text...
    const boldMatch = line.match(/^\*\*(\w[\w\s/]*?):\*\*\s*(.*)/);
    if (boldMatch) {
      const name = boldMatch[1]!.toLowerCase().trim();
      const KNOWN_SECTIONS = [
        "observed",
        "observation",
        "impact",
        "suggestion",
        "suggested fixes",
        "hypotheses",
        "root cause",
        "context",
      ];
      if (KNOWN_SECTIONS.some((s) => name.includes(s))) {
        currentSection = name;
        const inline = boldMatch[2]!.trim();
        sectionContent[currentSection] = inline ? [inline] : [];
        continue;
      }
    }

    // Markdown ## section headers
    const mdMatch = line.match(/^##\s+(\w[\w\s/]*)/);
    if (mdMatch) {
      currentSection = mdMatch[1]!.toLowerCase().trim();
      sectionContent[currentSection] = [];
      continue;
    }

    if (currentSection && sectionContent[currentSection]) {
      sectionContent[currentSection]!.push(line);
    }
  }

  // Extract description from observed/observation sections
  let description = "";
  for (const key of Object.keys(sectionContent)) {
    if (key.includes("observed") || key.includes("observation")) {
      description = sectionContent[key]!.join("\n").trim();
      break;
    }
  }
  if (!description) {
    const all = Object.values(sectionContent).flat();
    description = all.join("\n").trim();
  }

  // Extract suggestion
  let suggestion = "";
  for (const key of Object.keys(sectionContent)) {
    if (key.includes("suggest")) {
      suggestion = sectionContent[key]!.join("\n").trim();
      break;
    }
  }

  if (!severity) severity = "medium";

  return {
    title,
    severity,
    description,
    suggestion,
    date,
    todoRef: "",
    component,
    fileName,
  };
}

// ── Classification ───────────────────────────────────────────────────

const ACTION_WORDS =
  /\b(should|needs?\s+to|fix|add|change|implement|create|update|remove|replace|refactor)\b/i;

/**
 * Classify a friction item as actionable or informational.
 * Actionable items have a suggestion, high severity, or action-oriented language.
 */
export function classifyFriction(
  item: FrictionData,
): "actionable" | "informational" {
  if (item.suggestion.trim().length > 0) return "actionable";

  if (
    (item.severity === "high" || item.severity === "critical") &&
    item.description.trim().length > 0
  ) {
    return "actionable";
  }

  if (ACTION_WORDS.test(item.description) || ACTION_WORDS.test(item.title)) {
    return "actionable";
  }

  return "informational";
}

// ── ID generation ────────────────────────────────────────────────────

/**
 * Find the next available friction TODO number by scanning existing TODOs
 * for *-FRC-N IDs and returning max(N) + 1.
 */
export function nextFrictionTodoNumber(todosDir: string): number {
  if (!existsSync(todosDir)) return 1;

  const entries = readdirSync(todosDir).filter((f) => f.endsWith(".md"));
  let maxN = 0;

  for (const entry of entries) {
    const match = entry.match(/--[A-Z]-FRC-(\d+)\.md$/);
    if (match) {
      const n = parseInt(match[1]!, 10);
      if (n > maxN) maxN = n;
    }
  }

  return maxN + 1;
}

// ── Idempotency check ────────────────────────────────────────────────

/**
 * Check if a TODO already exists that references a specific friction file.
 * Prevents duplicate TODO creation on re-runs.
 */
export function frictionAlreadyDecomposed(
  todosDir: string,
  frictionFileName: string,
): boolean {
  if (!existsSync(todosDir)) return false;

  const entries = readdirSync(todosDir).filter((f) => f.endsWith(".md"));
  const marker = `Friction source: ${frictionFileName}`;

  for (const entry of entries) {
    const content = readFileSync(join(todosDir, entry), "utf-8");
    if (content.includes(marker)) return true;
  }

  return false;
}

// ── TODO generation ──────────────────────────────────────────────────

/**
 * Build a TodoItem from a friction data object.
 */
export function buildTodoFromFriction(
  friction: FrictionData,
  todoId: string,
  priority: Priority,
): TodoItem {
  const domain = friction.component
    ? friction.component.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    : "friction";

  // Build title with Fix: prefix
  const todoTitle = `Fix: ${friction.title}`;

  // Build acceptance criteria from suggestion or description
  let acceptance: string;
  if (friction.suggestion) {
    const suggestionSummary = friction.suggestion.split("\n")[0]!.trim();
    acceptance = `Acceptance: ${suggestionSummary}`;
  } else {
    acceptance = `Acceptance: Address the reported friction — ${friction.title}`;
  }

  // Construct rawText that extractBody can parse
  const rawLines = [
    `# ${todoTitle} (${todoId})`,
    "",
    `**Priority:** ${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
    `**Source:** friction`,
    `**Depends on:** None`,
    `**Domain:** ${domain}`,
    "",
  ];

  if (friction.description) {
    rawLines.push(friction.description, "");
  }

  if (friction.suggestion) {
    rawLines.push(`**Suggestion:** ${friction.suggestion}`, "");
  }

  rawLines.push(acceptance, "");
  rawLines.push(`Friction source: ${friction.fileName}`);

  return {
    id: todoId,
    priority,
    title: todoTitle,
    domain,
    dependencies: [],
    bundleWith: [],
    status: "open",
    filePath: "",
    repoAlias: "friction",
    rawText: rawLines.join("\n"),
    filePaths: [],
    testPlan: "",
    bootstrap: false,
  };
}

// ── Result type ──────────────────────────────────────────────────────

export interface DecomposeResult {
  created: string[];
  skipped: string[];
  alreadyProcessed: string[];
}

// ── Core logic ───────────────────────────────────────────────────────

/**
 * Decompose friction files into TODOs.
 * Pure function that takes directory paths — easy to test.
 *
 * Returns a summary of what was created, skipped, or already processed.
 */
export function decomposeFriction(
  frictionDir: string,
  todosDir: string,
): DecomposeResult {
  const result: DecomposeResult = {
    created: [],
    skipped: [],
    alreadyProcessed: [],
  };

  if (!existsSync(frictionDir)) return result;

  const processedDir = join(frictionDir, "processed");
  mkdirSync(processedDir, { recursive: true });
  mkdirSync(todosDir, { recursive: true });

  // Only process .md files in the root friction dir (not in processed/)
  const entries = readdirSync(frictionDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("."),
  );

  if (entries.length === 0) return result;

  let nextNum = nextFrictionTodoNumber(todosDir);

  for (const entry of entries) {
    const filePath = join(frictionDir, entry);

    // Idempotency: skip if already decomposed into a TODO
    if (frictionAlreadyDecomposed(todosDir, entry)) {
      result.alreadyProcessed.push(entry);
      // Still move to processed/ to clean up
      renameSync(filePath, join(processedDir, entry));
      continue;
    }

    const content = readFileSync(filePath, "utf-8");
    const friction = parseFrictionFile(content, entry);
    const classification = classifyFriction(friction);

    if (classification === "informational") {
      result.skipped.push(entry);
      renameSync(filePath, join(processedDir, entry));
      continue;
    }

    // Generate TODO
    const priority = SEVERITY_TO_PRIORITY[friction.severity] ?? "medium";
    const letter = PRIORITY_LETTER[priority];
    const todoId = `${letter}-FRC-${nextNum}`;
    nextNum++;

    const todoItem = buildTodoFromFriction(friction, todoId, priority);
    writeTodoFile(todosDir, todoItem);

    result.created.push(`${todoId} (from ${entry})`);

    // Move to processed
    renameSync(filePath, join(processedDir, entry));
  }

  return result;
}

// ── CLI command ──────────────────────────────────────────────────────

export function cmdDecomposeFriction(projectRoot: string): void {
  const frictionDir = join(projectRoot, ".ninthwave", "friction");
  const todosDir = join(projectRoot, ".ninthwave", "todos");

  if (!existsSync(frictionDir)) {
    console.log("No friction directory found at .ninthwave/friction/");
    return;
  }

  const entries = readdirSync(frictionDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("."),
  );

  if (entries.length === 0) {
    console.log("No unprocessed friction files found.");
    return;
  }

  console.log(`Found ${entries.length} unprocessed friction file(s).`);

  const result = decomposeFriction(frictionDir, todosDir);

  if (result.created.length > 0) {
    console.log(`\nCreated ${result.created.length} TODO(s):`);
    for (const id of result.created) {
      console.log(`  ✓ ${id}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log(`\nSkipped ${result.skipped.length} informational item(s):`);
    for (const name of result.skipped) {
      console.log(`  - ${name}`);
    }
  }

  if (result.alreadyProcessed.length > 0) {
    console.log(
      `\nAlready processed ${result.alreadyProcessed.length} item(s):`,
    );
    for (const name of result.alreadyProcessed) {
      console.log(`  · ${name}`);
    }
  }

  console.log("\nAll friction files moved to processed/.");
}
