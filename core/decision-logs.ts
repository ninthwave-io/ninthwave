// Read and surface dependency decision logs so a launched worker sees the
// decisions its dependencies made before it starts implementing.
//
// Sibling work items diverge when one logs a decision that another assumed
// away (e.g. item A keeps a module that item B's spec assumed would be
// removed). Decision logs live flat in `.ninthwave/decisions/` as
// `<timestamp>--<itemId>.md`, but nothing pointed a worker at the logs of its
// declared dependencies, so divergence was only discovered mid-work. This
// surfaces those logs at startup.

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

/** A single dependency decision log discovered for a worker's dependencies. */
export interface DecisionLogEntry {
  /** The work item ID the decision belongs to (the dependency). */
  itemId: string;
  /** The decision log filename (e.g. `2026-06-21T10-15-00Z--A-1.md`). */
  fileName: string;
  /** Trimmed raw contents of the decision log file. */
  content: string;
}

/**
 * Extract the work item ID from a decision log filename.
 * Filenames are `<timestamp>--<itemId>.md`; the timestamp never contains the
 * `--` separator, so everything after the first `--` is the item ID.
 * Returns null for files that don't match the convention (e.g. `.gitkeep`).
 */
export function decisionItemIdFromFileName(fileName: string): string | null {
  if (!fileName.endsWith(".md")) return null;
  const base = fileName.slice(0, -".md".length);
  const sepIndex = base.indexOf("--");
  if (sepIndex === -1) return null;
  const id = base.slice(sepIndex + 2).trim();
  return id || null;
}

/**
 * Read decision logs belonging to the given dependency IDs from a decisions
 * directory. Returns an empty array when there are no dependencies, the
 * directory is missing, or no matching logs exist. Results are sorted by
 * filename so the timestamp prefix gives a stable, chronological order.
 */
export function readDependencyDecisions(
  decisionsDir: string,
  dependencyIds: string[],
): DecisionLogEntry[] {
  if (dependencyIds.length === 0) return [];
  if (!existsSync(decisionsDir)) return [];

  let files: string[];
  try {
    files = readdirSync(decisionsDir);
  } catch {
    return [];
  }

  const wanted = new Set(dependencyIds);
  const entries: DecisionLogEntry[] = [];

  for (const fileName of files.sort()) {
    const itemId = decisionItemIdFromFileName(fileName);
    if (!itemId || !wanted.has(itemId)) continue;

    let content: string;
    try {
      content = readFileSync(join(decisionsDir, fileName), "utf8").trim();
    } catch {
      continue;
    }
    if (!content) continue;

    entries.push({ itemId, fileName, content });
  }

  return entries;
}

/**
 * Format dependency decision log entries into a prompt section a launched
 * worker reads at startup. Returns an empty string when there are no entries,
 * so callers can append it unconditionally without producing a spurious
 * heading for dependencies that logged nothing.
 */
export function formatDependencyDecisionsSection(entries: DecisionLogEntry[]): string {
  if (entries.length === 0) return "";

  const blocks = entries.map(
    (entry) => `### Decision logged by ${entry.itemId} (${entry.fileName})\n${entry.content}`,
  );

  return (
    "\n## Pending decisions on your dependencies\n\n" +
    "Your dependencies logged the decisions below. Read them before you implement: " +
    "a dependency may have decided something that changes an assumption in your spec " +
    "(for example, keeping a module your spec assumed would be removed, or settling on a " +
    "field name or shape for a shared contract). Reconcile any divergence now rather than " +
    "discovering it mid-work.\n\n" +
    blocks.join("\n\n") +
    "\n"
  );
}

/**
 * Convenience helper: read the dependency decision logs for a work item and
 * return the formatted prompt section (empty string when there is nothing to
 * surface). `decisionsDir` is typically `<repoRoot>/.ninthwave/decisions`.
 */
export function buildDependencyDecisionsSection(
  decisionsDir: string,
  dependencyIds: string[],
): string {
  return formatDependencyDecisionsSection(readDependencyDecisions(decisionsDir, dependencyIds));
}
