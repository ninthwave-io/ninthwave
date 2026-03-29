// Project configuration loading and saving for the ninthwave CLI.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

/** Project config shape. */
export interface ProjectConfig {
  review_external: boolean;
  schedule_enabled: boolean;
  ai_tool?: string;
}

/**
 * Load project config from .ninthwave/config.json (JSON format).
 * Returns defaults when the file is missing or malformed.
 * Unknown keys are silently ignored.
 */
export function loadConfig(projectRoot: string): ProjectConfig {
  const defaults: ProjectConfig = {
    review_external: false,
    schedule_enabled: false,
  };

  const configPath = join(projectRoot, ".ninthwave", "config.json");
  if (!existsSync(configPath)) return defaults;

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return defaults;
    }
    return {
      review_external: parsed.review_external === true,
      schedule_enabled: parsed.schedule_enabled === true,
      ai_tool: typeof parsed.ai_tool === "string" ? parsed.ai_tool : undefined,
    };
  } catch {
    return defaults;
  }
}

/**
 * Save partial config updates to .ninthwave/config.json.
 * Reads the existing file, merges updates, and writes back.
 * Preserves unknown keys that other tools may have written.
 */
export function saveConfig(
  projectRoot: string,
  updates: Partial<ProjectConfig>,
): void {
  const configPath = join(projectRoot, ".ninthwave", "config.json");

  // Read existing raw JSON to preserve unknown keys
  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        existing = parsed;
      }
    } catch {
      // Malformed file -- start fresh
    }
  }

  // Merge updates (only defined values)
  const merged = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(merged, null, 2) + "\n");
}
