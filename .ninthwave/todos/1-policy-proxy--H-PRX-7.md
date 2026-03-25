# Feat: ninthwave proxy-launcher: detection, spawn, health check (H-PRX-7)

**Priority:** High
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** H-PRX-6
**Domain:** policy-proxy

Create core/proxy-launcher.ts as a new module following the sandbox.ts binary detection pattern. Implement: isProxyAvailable() using dependency-injected ShellRunner (same pattern as isNonoAvailable), startProxy(config) that spawns the proxy binary as a subprocess on an ephemeral port and returns { port, stop() }, healthCheck() that TCP-connects to the proxy port every 30s and auto-restarts on failure, and stopProxy() for clean shutdown. Graceful degradation: if proxy binary not installed, log a one-time warning and continue without proxy (same pattern as nono).

**Test plan:**
- isProxyAvailable: returns true when binary found, false when missing (inject ShellRunner mock)
- startProxy: happy path spawns subprocess, returns port and stop function
- startProxy: missing policy file returns error
- startProxy: missing credentials config returns error
- startProxy: binary crashes on startup returns error
- healthCheck: proxy responsive, no action
- healthCheck: proxy unresponsive, triggers restart
- stopProxy: clean shutdown, process exits
- stopProxy: process already exited, no-op (no throw)

Acceptance: Proxy binary detected via `which`. Subprocess spawned on ephemeral port. Health check restarts on crash. Clean shutdown on stop(). All 8+ tests pass with dependency-injected mocks (no real binary needed).

Key files: `core/proxy-launcher.ts`, `test/proxy-launcher.test.ts`
