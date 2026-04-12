---
name: friction-triage
description: |
  Interactively walk through every friction log in `.ninthwave/friction/` one at
  a time. For each log: read it, assess severity and possible duplicates, ask the
  human what to do (fix now / create work item / update doc / drop / merge / skip),
  execute the decision, and delete the log. This is the canonical way to clear
  the friction inbox: a synchronous, human-in-the-loop session.
  Use when asked to "triage friction", "review friction logs", "clear the friction
  inbox", or "walk through friction".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
user_invocable: true
---

## What this skill is

This is the canonical way to process friction logs in this repo. It is a synchronous, human-in-the-loop session: you read each log, the user decides what to do, you execute, you delete. There is no async batch / review-PR fallback. The whole point is that the human stays in the loop and the inbox actually gets to zero in one sitting.

---

## Interactive Questions (CRITICAL)

This skill is highly interactive. You MUST use your interactive question tool to ask the user questions. Do NOT print a question as text and wait for a response.

**Tool names by platform:** `AskUserQuestion` (Claude Code), `question` (OpenCode), `request_user_input` (Codex), `ask_user` (Copilot CLI, Gemini CLI). Use whichever is available in your environment.

**Every question must follow this structure:**

1. **Re-ground:** State the project, the current branch, what phase you are in, and "log M of N". Assume the user has not looked at this window in 20 minutes.
2. **Explain simply:** Paraphrase the friction in plain English. Say what hurt, not just what the log file is named.
3. **Recommend:** State which option you would pick and why, in one line.
4. **Options:** Lettered options A) through F). When an option involves effort, indicate the scale.

---

## Hard rules

- **Never batch decisions.** One log, one question, one answer. No "handle all the mediums at once."
- **Never commit.** The skill stages edits and writes new files. The human commits at the end if they want to.
- **Never touch `.ninthwave/friction/processed/`.** That directory is out of scope for this skill.
- **Work items must follow `.ninthwave/work-item-format.md`.** Read it before writing any new work item file.
- **Generate lineage tokens with `nw lineage-token`** when creating a work item, the same way `/decompose` does.
- **Duplicate detection is best-effort.** If you are not certain two logs are duplicates, surface it as an option and let the human decide. Do not auto-merge.
- **"Drop" is a valid answer.** Friction that is no longer relevant is exactly what this flow exists to clear. Do not argue with the user when they pick D.
- **ASCII only.** No em dashes, no smart quotes, no ellipsis characters. Use `--`, straight quotes, and `...`. The repo enforces a `no-em-dash` lint rule on `.md` files.

---

## Phase 1: LOAD

**Goal:** Find every friction log and prepare to walk through them.

1. List the friction inbox:
   ```bash
   ls .ninthwave/friction/*.md 2>/dev/null
   ```
   Exclude `.gitkeep` and anything under `processed/`.

2. If there are zero logs, tell the user "Friction inbox is clean. Nothing to triage." and exit.

3. Sort the logs by filename (timestamps in the filename make this FIFO by default). Oldest first.

4. Announce: "Found N friction logs. I will walk you through them one by one. You decide what happens to each."

---

## Phase 2: PER-LOG LOOP

For each friction log, in order, run this loop. Do not jump ahead. Do not batch.

### Step 1: Read

Read the friction log file in full. Friction logs have this shape (defined in `agents/implementer.md`):

```
item: <WORK_ITEM_ID>
date: <ISO-8601 timestamp>
severity: low|medium|high
[harness: <optional tool/model info>]
description: <free-form, may be multi-paragraph, may include "Recommendation:" inline>
```

### Step 2: Investigate (subagent)

Triage decisions are dramatically better when grounded in the actual codebase, git history, the rest of the friction inbox, and the open work-item queue. So **launch one Explore subagent per log** to do that investigation before asking the user. Do not try to do this analysis from your own context: you will skim, you will guess, and the recommendation will be soft. Delegate it.

**Subagent type:** in Claude Code use `subagent_type: "Explore"` with thoroughness "medium". On other platforms use the equivalent codebase-exploration agent.

**Subagent prompt template** (fill in the bracketed parts before launching):

```
You are investigating ONE friction log from a ninthwave repo so a human can decide what to do with it. Read whatever you need (code, git log, other friction logs, open work items) to give a grounded recommendation. Do not propose code changes; just gather facts.

Friction log path: [path]
Friction log contents (verbatim):
[paste the entire file body, including frontmatter fields]

Investigate and report back, in this exact section order:

1. WHERE A FIX WOULD LAND
   Identify specific files (with line numbers when possible) where the rectification would happen. If the friction names a tool, file, command, behavior, or doc, find it in the repo.

2. ALREADY ADDRESSED?
   Check `git log --since=[log date]` for commits that look related. Read the current state of the relevant code/docs to see whether the friction has already been fixed since the log was written. State explicitly: yes (with commit SHA) / no / unclear.

3. EXISTING WORK ITEMS
   Look in `.ninthwave/work/` for any open work items that already cover this friction. List filename and ID for each match. If none, say "none".

4. DUPLICATE FRICTION LOGS
   Look at the other files in `.ninthwave/friction/` (excluding `processed/`) for logs that overlap this one. List filename and a one-line reason for the overlap. If none, say "none".

5. SMALLEST CONCRETE FIX
   Describe the smallest change that would resolve this friction. Be specific: "edit `agents/implementer.md` around line 380 to add a step that does X" beats "improve the worker logic". If the fix is non-trivial or speculative, say so and sketch the shape instead.

6. RECOMMENDATION
   Pick exactly one tag and give a one-sentence reason:
     FIX_NOW       -- small code change, obvious, low risk
     UPDATE_DOC    -- the fix is editing a doc / skill / prompt
     CREATE_WORKITEM -- real fix is non-trivial, needs its own PR
     DROP          -- already fixed, stale, or not actionable
     MERGE_INTO    -- duplicate of another log; name which one

Cap your report at 300 words. Be concrete, not vague. No prose paragraphs, no hedging.
```

Wait for the subagent to return before proceeding. Do not run multiple per-log subagents in parallel; this loop is intentionally one-at-a-time so the human can stay in flow.

**Synthesize** the report into a structured assessment block for your own working notes:

```
Log M of N: <filename>
Item: <item id>   Severity: <low|medium|high>   Date: <date>
Friction: <one-sentence paraphrase of what hurt>
Where it would land: <file:line, file:line>
Already addressed?: <yes (commit abc123) | no | unclear>
Existing work item?: <ID + path | none>
Possible duplicate: <other log filename | none>
Smallest fix: <one-line concrete description>
Subagent rec: <FIX_NOW | UPDATE_DOC | CREATE_WORKITEM | DROP | MERGE_INTO> -- <one-line reason>
```

**Carry the full subagent report in your working context for the rest of this log's loop.** Step 3 (Decide) and Step 4 (Execute) both need it. Do not throw it away after Step 2.

### Step 3: Decide

Call your interactive question tool with the synthesized assessment AND the most relevant findings from the subagent report. The user should be able to make a real decision without going to read the friction log themselves.

Before the question, print the structured assessment block from Step 2 so the user sees the grounded context. Then ask:

**Question:** "Project: ninthwave. Branch: <current>. Phase: friction-triage, log M of N (<filename>). The friction: <paraphrase>. The investigation found: <one-line on where the fix lands> | <one-line on whether it's already addressed> | <one-line on duplicates or existing work items, if any>. Smallest concrete fix: <smallest fix from the subagent>. I would pick <X> because <reason that references the investigation, not just the log text>. What should we do with this log?"

The recommendation in the question MUST be grounded in what the subagent found, not in heuristics from reading the log. Examples:
- If the subagent says it is already addressed in commit abc123, recommend D) Drop and say so.
- If the subagent found an existing work item that already covers it, recommend D) Drop (or E) Merge if it is a duplicate friction log) and name the work item.
- If the subagent identified the exact file and line for a one-line fix, recommend A) or C).
- If the smallest fix is non-trivial, recommend B) Create work item.

**Options:**

- **A) Fix now (small code change)** -- apply the rectification directly in the codebase. Use only when the fix is small (a few lines, one or two files) and obviously correct. Skill will Edit, show the diff, then delete the log.
- **B) Create work item** -- the friction is real but the fix is non-trivial. Skill will write a new file in `.ninthwave/work/` following `.ninthwave/work-item-format.md`, then delete the log.
- **C) Update a doc / skill / prompt** -- the fix is editing `agents/implementer.md`, `CLAUDE.md`, an existing skill, or another doc. Same mechanics as A, but called out separately because it is the most common friction outcome and the user often wants to confirm where the doc edit lands before approving.
- **D) Drop** -- not worth acting on. Stale, already fixed, or the user does not agree with the original report. Skill will delete the log with no further action.
- **E) Merge into another log** -- only offer this if Step 2 found a duplicate candidate. Skill will append the current log's distinct context to the other log, then delete the current one.
- **F) Skip for now** -- leave the log in place and move to the next. Use sparingly. The whole point of this skill is to clear the inbox.

Always offer A, B, C, D, F. Only offer E when there is a real duplicate candidate.

### Step 4: Execute

Run the chosen action. **Use the subagent investigation as your starting point** for every option below. The investigation already named the file paths, the smallest concrete fix, and any related state. Do not re-explore from scratch.

**A) Fix now:**
1. Open the file(s) the subagent identified in "Where a fix would land". Read the relevant region.
2. Apply the change the subagent described in "Smallest concrete fix" with the Edit tool. If the subagent's fix is missing a detail, fill it in. If you disagree with the subagent's fix, say so out loud and propose an alternative before editing.
3. Show the user a 3-5 line summary of what changed and which file.

**B) Create work item:**
1. Read `.ninthwave/work-item-format.md` if you have not already in this session. The format is non-negotiable.
2. Draft the work item using the subagent investigation as the seed:
   - **Description** seeded from the friction's "what hurt" plus the subagent's "smallest concrete fix"
   - **Key files** seeded from the subagent's "where a fix would land"
   - **Test plan** derived from the affected files (ask the subagent's report for hints; if missing, infer from the file types)
   - **ID** in the form `[CHML]-<feature_code>-<seq>`, derived from the friction's domain
   - **Priority** mapped from severity: high -> Critical or High, medium -> High or Medium, low -> Medium or Low
   - **Domain slug** derived from the friction area
3. Generate a lineage token:
   ```bash
   nw lineage-token
   ```
4. Show the drafted work item to the user via a second AskUserQuestion with options "Looks good, write it" / "Edit before writing" / "Cancel and pick a different action". Because the draft is grounded in the subagent's investigation, "Looks good" should be the common answer.
5. On approval, write the file to `.ninthwave/work/{priority_num}-{domain_slug}--{ID}.md`.
6. On "Edit before writing", let the user steer the fields, then write.
7. On "Cancel", return to Step 3 (Decide) for this same log.

**C) Update a doc / skill / prompt:**
1. Open the doc the subagent identified (typically `agents/implementer.md`, `CLAUDE.md`, or a `skills/*/SKILL.md`). Read the surrounding section so the edit fits the existing voice.
2. Apply the change the subagent described in "Smallest concrete fix" with the Edit tool.
3. Show the user a 3-5 line summary of what changed and which file.

**D) Drop:**
1. If the subagent said the friction is already addressed (commit SHA) or already covered by an existing work item, mention that out loud in one line so the user has the receipt.
2. No file changes. Proceed to Step 5.

**E) Merge into another log:**
1. Read the target log the subagent named as the duplicate.
2. Append a `---` divider and the current log's distinct content (do not duplicate fields that match).
3. Use Edit to write the appended content.

**F) Skip:** Proceed to the next log without deleting.

### Step 5: Delete (unless F)

For decisions A, B, C, D, E, delete the friction log:

```bash
rm .ninthwave/friction/<filename>
```

For F, leave it in place.

### Step 6: Progress

Print one line: "Log M of N handled: <decision letter> -- <one-line outcome>. <N - M> remaining."

Then move to the next log.

---

## Phase 3: WRAP

When the loop finishes, summarize the session:

1. Counts: "Triaged N logs. Fixed: X. New work items: Y. Doc updates: Z. Dropped: W. Merged: V. Skipped: S."
2. List any new work items by ID.
3. List any files edited.
4. Run `git status` and show the user the staged/unstaged changes.
5. **Do NOT commit.** Tell the user the suggested commit command and let them decide:
   ```
   Suggested next step:
     git add -A && git commit -m "chore: triage friction logs"
   I will not run this for you. Commits are your call.
   ```

---

## Why this skill exists (background for the worker reading this)

Friction logs are the dogfooding signal that drives ninthwave's roadmap (see `VISION.md`: "the friction log is the roadmap"). They accumulate fast because workers and humans both write them. Clearing them is high leverage but easy to put off when the flow is async, so the design here is deliberately synchronous: a 10-minute focused session with the human at the keyboard, one log at a time, decisions made fast, inbox driven to zero.

The skill's job is to keep that loop tight: small reads, small assessments, one question per log, no batching, no commits without permission.
