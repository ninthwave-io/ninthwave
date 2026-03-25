// Global test safety net. Loaded via bunfig.toml preload.
// Kills the test process if it runs longer than 90 seconds total.
// This catches runaway servers, infinite loops, and leaked resources
// that individual test timeouts cannot catch.

const GLOBAL_TIMEOUT_MS = 90_000;

const timer = setTimeout(() => {
  console.error(
    `\n[FATAL] Test suite exceeded ${GLOBAL_TIMEOUT_MS / 1000}s wall-clock limit. ` +
      `Likely a leaked server or infinite loop. Killing process.\n`,
  );
  process.exit(124); // 124 = same exit code as GNU timeout
}, GLOBAL_TIMEOUT_MS);

// .unref() so the timer doesn't keep the process alive if tests finish normally
timer.unref();

// Sentinel for lint-tests.test.ts to verify preload is active
(globalThis as any).__nw_test_safety_loaded = true;
