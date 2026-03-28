# /work skill should commit+push TODOs at start of Phase 1

**When:** Starting /work after /decompose wrote 9 new TODO files
**What happened:** /work proceeded to reconcile and list without committing the new TODOs first. The TODO files existed locally but weren't committed or pushed.
**Expected:** /work should detect uncommitted changes in .ninthwave/todos/ at the very start of Phase 1 (before reconcile) and commit+push them.
**Impact:** Workers spawned in worktrees from remote won't see the TODO specs. The "Transition" step between Phase 1 and Phase 2 handles this, but it should also run at the START of Phase 1 since /decompose may have just written files.
**Fix:** Add a git status check for .ninthwave/todos/ at the top of Phase 1, before reconcile. If uncommitted changes exist, commit and push immediately.
