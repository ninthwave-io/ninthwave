# Feat: Scaffold Rust proxy repo with CI + transparent CONNECT passthrough (H-PRX-3)

**Priority:** High
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** H-PRX-1, H-PRX-2
**Domain:** policy-proxy
**Repo:** policy-proxy

Create a new standalone Rust project for the policy proxy. Set up Cargo.toml with dependencies (hudsucker, cedar-policy, rcgen, hyper, rustls, tokio, serde, serde_json). Implement a minimal TCP listener that handles CONNECT requests by tunneling raw bytes (transparent passthrough, no MITM yet). Log each CONNECT event as a JSON line to stderr (host, port, timestamp). Set up GitHub Actions CI for linux amd64/arm64 + darwin amd64/arm64. Add a Homebrew formula stub for macOS distribution.

**Test plan:**
- Proxy starts on ephemeral port, accepts CONNECT to any host, tunnels bytes bidirectionally
- JSON log event emitted for each CONNECT with host, port, timestamp
- CI builds and tests pass on all 4 platform targets
- `cargo test` includes basic integration test: start proxy, CONNECT through it, verify tunnel works

Acceptance: `cargo run` starts a proxy that transparently tunnels CONNECT requests. JSON audit events logged to stderr. CI builds for 4 platform targets. Homebrew formula installs the binary.

Key files: `Cargo.toml`, `src/main.rs`, `src/proxy.rs`, `.github/workflows/ci.yml`, `Formula/policy-proxy.rb`
