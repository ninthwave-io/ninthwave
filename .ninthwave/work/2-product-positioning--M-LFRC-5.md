# Docs: Reframe copy around local-first collaboration sessions (M-LFRC-5)

**Priority:** Medium
**Source:** docs/local-first-runtime-controls-spec.md
**Depends on:** H-LFRC-3, H-LFRC-4
**Domain:** product-positioning

Clean up the remaining remote-first wording so `ninthwave.sh` is presented as thin active-session coordination infrastructure instead of the product's primary value. Update startup copy, help text, and project docs to prefer `Collaborate`, `Share session`, `Join session`, and `Local by default`, and remove delivery-metrics-first framing from the main startup experience.

**Test plan:**
- Update TUI and help-overlay tests that currently assert `ninthwave.sh` connection-first strings so they match the new local-first wording.
- Add targeted assertions for any startup summary or arming-window copy that must mention `Share session`, `Join session`, or `Local by default`.
- Manual review of `README.md` and spec-adjacent docs to ensure `ninthwave.sh` is described as active-session coordination, not the reason to launch `nw`.

Acceptance: User-facing startup and TUI copy no longer lead with `Connect to ninthwave.sh` or delivery metrics. The product language consistently frames plain `nw` as local-first and presents hosted infrastructure as optional collaboration support.

Key files: `core/interactive.ts`, `core/tui-widgets.ts`, `core/status-render.ts`, `README.md`, `test/tui-widgets.test.ts`
