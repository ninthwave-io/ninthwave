import type { RunResult } from "./types.ts";

/** Recommended timeout for git commands (30 seconds). */
export const GIT_TIMEOUT = 30_000;

/** Recommended timeout for gh CLI commands (60 seconds). */
export const GH_TIMEOUT = 60_000;

export function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; input?: string; timeout?: number },
): RunResult {
  const start = opts?.timeout !== undefined ? Date.now() : 0;
  const result = Bun.spawnSync([cmd, ...args], {
    cwd: opts?.cwd,
    stdin: opts?.input ? new TextEncoder().encode(opts.input) : undefined,
    timeout: opts?.timeout,
  });
  // Bun returns exitCode: null when a process is killed by signal (e.g., timeout).
  // Normalize to a number for callers.
  const exitCode = result.exitCode ?? 124;
  const timedOut =
    opts?.timeout !== undefined && Date.now() - start >= opts.timeout;
  if (timedOut) {
    return {
      stdout: result.stdout.toString().trim(),
      stderr: `TIMEOUT: command timed out after ${opts!.timeout}ms: ${cmd} ${args.join(" ")}`,
      exitCode: exitCode === 0 ? 124 : exitCode,
      timedOut: true,
    };
  }
  return {
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
    exitCode,
  };
}
