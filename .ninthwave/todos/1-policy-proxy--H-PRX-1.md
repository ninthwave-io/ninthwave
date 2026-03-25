# Feat: Validate nono CONNECT forwarding + CA trust chain (H-PRX-1)

**Priority:** High
**Source:** Policy proxy design doc (2026-03-25)
**Depends on:** None
**Domain:** policy-proxy

Validate two blocking architectural assumptions before writing any Rust code. First, verify that `nono run --upstream-proxy 127.0.0.1:PORT` correctly forwards CONNECT requests to the upstream proxy by testing with mitmproxy as a stand-in. Second, verify that a session-local CA cert can be trusted by all tools inside a nono sandbox (git, gh, curl, Node) by concatenating it with the system CA bundle and setting SSL_CERT_FILE, GIT_SSL_CAINFO, and NODE_EXTRA_CA_CERTS. Do NOT use nono's --credential flag (it bypasses --upstream-proxy). Important: SSL_CERT_FILE replaces the system bundle, so concatenate session CA + system CAs into one PEM file.

**Test plan:**
- Install mitmproxy, run on port 9999
- Run `nono run --upstream-proxy 127.0.0.1:9999 -- curl https://api.github.com/zen` and verify CONNECT appears in mitmproxy
- Generate CA cert with openssl, concatenate with system CAs, set env vars, verify git/gh/curl/node all work through MITM proxy inside nono sandbox
- Document results (pass/fail for each tool) in a validation report

Acceptance: CONNECT requests from nono reach the upstream proxy. git push, gh pr create, curl, and Node HTTPS all work through a MITM proxy with a session CA cert inside a nono sandbox. Results documented.

Key files: N/A (throwaway scripts, results documented in PR description)
