# Feat: ninthwave sandbox.ts --upstream-proxy flag + config keys (H-PRX-8)

**Priority:** High
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** H-PRX-7
**Domain:** strait

Extend sandbox.ts to accept an optional upstreamProxyPort parameter in wrapWithSandbox(). When provided, add --upstream-proxy 127.0.0.1:<port> to the nono command in both buildProfileCommand() and buildSandboxCommand(). Add proxy_policy and proxy_credentials to SANDBOX_CONFIG_KEYS and register in config.ts KNOWN_CONFIG_KEYS. In start.ts, wire up: if proxy is available and proxy_policy config is set, start proxy via proxy-launcher before launching workers, inject CA cert env vars (NODE_EXTRA_CA_CERTS, GIT_SSL_CAINFO, SSL_CERT_FILE with concatenated system CAs), pass port to wrapWithSandbox, and stop proxy after workers finish.

**Test plan:**
- wrapWithSandbox with upstreamProxyPort: --upstream-proxy flag present in nono command
- wrapWithSandbox without upstreamProxyPort: no --upstream-proxy flag (existing behavior preserved)
- Config parsing: proxy_policy and proxy_credentials keys recognized (no typo warning)
- CA cert env vars: NODE_EXTRA_CA_CERTS points to session CA, GIT_SSL_CAINFO points to session CA, SSL_CERT_FILE points to concatenated bundle
- Existing sandbox.test.ts tests still pass (no regressions)
- Graceful degradation: proxy not available but proxy_policy configured logs warning and continues

Acceptance: --upstream-proxy flag added to nono command when proxy port provided. Config keys parsed without warnings. CA cert env vars set correctly. Existing tests pass. Graceful degradation works.

Key files: `core/sandbox.ts`, `core/config.ts`, `core/commands/start.ts`, `test/sandbox.test.ts`
