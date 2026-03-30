import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { TokenUsage } from "./crew.ts";

export interface TokenUsageReadOptions {
  stdoutText?: string;
  since?: string;
}

export interface TokenUsageReaderDeps {
  existsSync: typeof existsSync;
  readdirSync: typeof readdirSync;
  readFileSync: typeof readFileSync;
  statSync: typeof statSync;
  homeDir?: string;
}

const defaultDeps: TokenUsageReaderDeps = {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  homeDir: process.env.HOME,
};

type FileCandidate = {
  path: string;
  mtimeMs: number;
};

export function readLatestTokenUsage(
  projectRoot: string,
  aiTool: string,
  opts: TokenUsageReadOptions = {},
  deps: TokenUsageReaderDeps = defaultDeps,
): TokenUsage | undefined {
  const sinceMs = parseSinceMs(opts.since);

  for (const root of getUsageRoots(projectRoot, aiTool, deps.homeDir)) {
    const usage = readLatestTokenUsageFromRoot(root, sinceMs, deps);
    if (usage) return usage;
  }

  if (opts.stdoutText) {
    return parseTokenUsageFromText(opts.stdoutText);
  }

  return undefined;
}

export function parseTokenUsageFromText(text: string): TokenUsage | undefined {
  const inputTokens = readNumberFromText(text, /input(?:_| )tokens?[^\d]*(\d[\d,]*)/i);
  const outputTokens = readNumberFromText(text, /output(?:_| )tokens?[^\d]*(\d[\d,]*)/i);
  if (inputTokens == null || outputTokens == null) return undefined;

  const cacheTokens = sumDefined(
    readNumberFromText(text, /cache creation(?:_| )input(?:_| )tokens?[^\d]*(\d[\d,]*)/i),
    readNumberFromText(text, /cache read(?:_| )input(?:_| )tokens?[^\d]*(\d[\d,]*)/i),
  ) ?? readNumberFromText(text, /cache(?:_| )tokens?[^\d]*(\d[\d,]*)/i);

  return {
    inputTokens,
    outputTokens,
    ...(cacheTokens != null ? { cacheTokens } : {}),
  };
}

export function findTokenUsageInJson(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== "object") return undefined;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const usage = findTokenUsageInJson(entry);
      if (usage) return usage;
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const inputTokens = readNumber(record.input_tokens) ?? readNumber(record.inputTokens);
  const outputTokens = readNumber(record.output_tokens) ?? readNumber(record.outputTokens);
  if (inputTokens != null && outputTokens != null) {
    const cacheTokens = readNumber(record.cacheTokens)
      ?? sumDefined(
        readNumber(record.cache_creation_input_tokens) ?? readNumber(record.cacheCreationInputTokens),
        readNumber(record.cache_read_input_tokens) ?? readNumber(record.cacheReadInputTokens),
      );

    return {
      inputTokens,
      outputTokens,
      ...(cacheTokens != null ? { cacheTokens } : {}),
    };
  }

  for (const nested of Object.values(record)) {
    const usage = findTokenUsageInJson(nested);
    if (usage) return usage;
  }

  return undefined;
}

function readLatestTokenUsageFromRoot(
  root: string,
  sinceMs: number | undefined,
  deps: TokenUsageReaderDeps,
): TokenUsage | undefined {
  if (!deps.existsSync(root)) return undefined;

  const files = collectJsonFiles(root, deps)
    .filter((file) => sinceMs == null || file.mtimeMs >= sinceMs)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const file of files) {
    try {
      const parsed = JSON.parse(deps.readFileSync(file.path, "utf-8"));
      const usage = findTokenUsageInJson(parsed);
      if (usage) return usage;
    } catch {
      // Ignore malformed or unrelated JSON files.
    }
  }

  return undefined;
}

function collectJsonFiles(root: string, deps: TokenUsageReaderDeps): FileCandidate[] {
  const files: FileCandidate[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      entries = deps.readdirSync(dir, { withFileTypes: true }) as Array<{
        name: string;
        isDirectory(): boolean;
        isFile(): boolean;
      }>;
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

      try {
        files.push({ path: fullPath, mtimeMs: deps.statSync(fullPath).mtimeMs });
      } catch {
        // Ignore races while scanning active tool directories.
      }
    }
  }

  return files;
}

function getUsageRoots(projectRoot: string, aiTool: string, homeDir?: string): string[] {
  const projectSlug = projectRoot.replace(/\//g, "-");

  switch (aiTool) {
    case "claude":
      return homeDir ? [join(homeDir, ".claude", "projects", projectSlug)] : [];
    case "opencode":
      return [
        join(projectRoot, ".opencode"),
        ...(homeDir ? [join(homeDir, ".opencode", "projects", projectSlug)] : []),
      ];
    case "copilot":
      return homeDir ? [join(homeDir, ".copilot", "projects", projectSlug)] : [];
    default:
      return [];
  }
}

function parseSinceMs(since?: string): number | undefined {
  if (!since) return undefined;
  const sinceMs = new Date(since).getTime();
  if (!Number.isFinite(sinceMs)) return undefined;
  return Math.max(0, sinceMs - 60_000);
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readNumberFromText(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  return match?.[1] ? readNumber(match[1]) : undefined;
}

function sumDefined(a?: number, b?: number): number | undefined {
  if (a == null && b == null) return undefined;
  return (a ?? 0) + (b ?? 0);
}
