# Feat: Add session CA cert generation + selective MITM for GitHub (H-PRX-4)

**Priority:** High
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** H-PRX-3
**Domain:** policy-proxy
**Repo:** policy-proxy

Add session-local CA cert generation at startup using rcgen. Implement selective MITM: when the CONNECT target is api.github.com, generate a per-host certificate signed by the session CA, terminate TLS, and expose the inner HTTP request (method, path, headers). For all other domains, continue transparent passthrough. Write the CA cert PEM to a predictable path (stdout or --ca-cert-path flag) so the caller can inject it into the sandbox. Concatenate with system CA bundle instructions in --help output.

**Test plan:**
- On startup, CA cert PEM is written to specified path
- CONNECT to api.github.com: proxy terminates TLS, inner HTTP request visible (method + path + headers logged)
- CONNECT to any other domain: transparent passthrough (no MITM, no decryption)
- curl with --cacert flag trusts the session CA and completes HTTPS to api.github.com through the proxy
- CA cert is unique per session (not reused across restarts)

Acceptance: MITM works for api.github.com (inner HTTP visible). All other HTTPS passes through untouched. Session CA cert generated and exported. curl verifies TLS trust chain.

Key files: `src/ca.rs`, `src/mitm.rs`, `src/proxy.rs`
