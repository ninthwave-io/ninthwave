# Refactor: Rewrite reviewer agent for conventional comments (H-CC-2)

**Priority:** High
**Source:** Conventional comments adoption (conventionalcomments.org)
**Depends on:** H-CC-1
**Domain:** review-format

Rewrite the reviewer agent prompt to use conventional comment labels and
decorations instead of the BLOCKER/NIT/PRE-EXISTING severity tiers. The
agent should produce inline comments in the format
`**label (decorations):** subject` and use blocking/non-blocking as
decorations rather than standalone severity levels.

**Test plan:**
- Manual review: verify all inline comment examples in the prompt use `**label (decorations):** subject` format (e.g., `**issue (blocking):** ...`, `**suggestion (non-blocking):** ...`)
- Verify verdict JSON example uses `blockingCount`/`nonBlockingCount` fields (matching the updated ReviewVerdict type from H-CC-1)
- Verify the label list covers the conventional comments standard: issue, suggestion, nitpick, praise, question, todo, thought, note (plus optional: chore, typo, polish)
- Verify decorations guidance includes: blocking, non-blocking, pre-existing, security, if-minor
- Verify the two-pass review framework (Pass 1 CRITICAL, Pass 2 INFORMATIONAL) is preserved as the discovery mechanism, with conventional labels as the output format
- Verify ASCII-only constraint is maintained (no em dashes, smart quotes, or ellipsis characters)

Acceptance: agents/reviewer.md uses conventional comment labels throughout. Section 4 (Severity Tiers) is replaced with a conventional comment labels and decorations section. Section 6 (Review Output) shows inline comments using the new format. The verdict file example JSON matches the ReviewVerdict type from H-CC-1. The two-pass review framework is preserved for discovering findings -- only the output labeling changes.

Key files: `agents/reviewer.md`
