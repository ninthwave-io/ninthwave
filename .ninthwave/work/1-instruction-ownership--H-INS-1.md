# Refactor: Stop managing user instruction files and narrow generated-artifact ownership (H-INS-1)

**Priority:** High
**Source:** Follow-up decomposition after Codex support planning and work-item creation
**Depends on:** None
**Domain:** instruction-ownership
**Lineage:** ca157fb7-3fe1-42aa-9a72-c513f9678b03

Clean up the platform's instruction-file ownership boundary so ninthwave only creates, refreshes, or prunes artifacts it clearly owns. Remove or disable the Copilot path that mirrors `CLAUDE.md` into `.github/copilot-instructions.md`, tighten init/setup/launch cleanup to operate only on ninthwave-namespaced generated outputs, and make the code, tests, docs, and worker guidance explicit that root `CLAUDE.md`, any `AGENTS.md`, and similar user instruction files are read-only inputs rather than managed outputs.

**Test plan:**
- Extend `test/setup.test.ts`, `test/init.test.ts`, and `test/seed-agent-files.test.ts` to verify init, setup, and worktree seeding never create, overwrite, or prune root instruction files such as `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md`
- Add coverage that pruning only removes ninthwave-owned generated artifacts, not unrelated user files that happen to live in tool directories
- Manually review the updated docs and agent prompts to confirm they consistently describe user instruction files as external inputs and generated tool artifacts as the only ninthwave-managed outputs

Acceptance: ninthwave no longer auto-syncs `.github/copilot-instructions.md` from `CLAUDE.md`, cleanup paths only touch ninthwave-generated artifacts, and the tests, docs, and worker prompts all agree that user instruction files are never managed by ninthwave.

Key files: `core/agent-files.ts`, `core/commands/setup.ts`, `core/commands/init.ts`, `test/seed-agent-files.test.ts`, `test/setup.test.ts`, `test/init.test.ts`, `docs/onboarding.md`, `docs/faq.md`, `docs/copilot-cli.md`, `CONTRIBUTING.md`, `agents/implementer.md`, `agents/reviewer.md`, `agents/forward-fixer.md`
