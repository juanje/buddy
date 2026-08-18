# Skill: Consolidation

## When to use

Triggered automatically when usage-based thresholds are met, or manually by
the user. This is the consolidation cycle — where the system summarizes recent
work and learns from it.

Depth 1 (daily synthesis) is the default when unspecified. Higher depths
(weekly calibration, monthly pruning) extend the same procedure with broader
input scope — follow the scheduler's depth parameter.

**Autonomous mode:** All steps run without user interaction. Act with judgment;
log all decisions and changes made. No approval gates — if anything goes wrong,
it can be corrected in the next cycle.

**Scope:** `agent_brain/`, `logs/`, `user/` (except `user/wiki/`). Do not read or
modify `user/wiki/` — it has its own maintenance cycle (health check + synthesis).

**Prerequisite:** Session reflect runs automatically at session end.
The daily log already contains `## Session` blocks from reflect. Do not re-run
reflect before consolidating — read what's already in the log.

**Automatic (handled by the runner — do not do these yourself):**
- Log rotation — when `logs/` exceeds 28 files, older logs are archived automatically after consolidation.
- Today's `logs/index.md` entry — after you write the Day summary, the runner updates today's index line from **Key themes** (do not edit `logs/index.md` yourself).

## Procedure

---

The daily consolidation has two parts: first consolidate (summarize and
organize the day), then learn (create knowledge, form connections, act on
mature observations).

---

### Part 1: Consolidate

#### 1. Replay the day

Read `logs/YYYY-MM-DD.md` (today's date). The log contains session blocks
appended by reflect at session end — one or more `## Session HH:MM–HH:MM`
sections with Decisions, Lessons, Context, and related sections. Read it as
a whole — understand the day's arc, not isolated conversations.

If no log exists for today, check yesterday's. If neither exists, note it
and skip to Part 2 (the observation journal may still have actionable items).

#### 2. Day summary

Add a summary section at the top of the daily log (after the frontmatter),
or update it if one already exists:

```markdown
## Day summary
- **Key themes:** [2-3 main topics or threads of the day]
- **Moved forward:** [what progressed]
- **Learned:** [new knowledge acquired, if any]
- **Open:** [unresolved threads to pick up next session]
```

Keep it brief — this makes the weekly review's job easier.

#### 3. Write journal entry

Write the daily journal entry in `user/journal/YYYY/MM/DD.md`. This is the
agent's notes about the user's personal life — what they did, how they felt,
what they mentioned about people, life events, and personal reflections.

1. Re-read the **full** day's log from top to bottom — not just the latest
   session block. If multiple sessions contributed to the log, each one
   may contain personal content worth narrating. The journal should cover
   the **day's arc**, not just the last conversation.
2. Extract personal content: activities, feelings, mentions of people, life
   events, reflections, notable moments, creative or intellectual work
   (articles written, projects worked on, ideas explored).
3. Write `user/journal/YYYY/MM/DD.md` — no frontmatter, just a date heading
   and narrative prose.
4. **Language:** Write in the user's language (from the `User language:` line in the prompt header).
   The journal is a user artifact — it lives in `user/` and the user reads it
   directly.
5. Tone: agent's notes about the user, third person, factual but warm.
6. Exclude: system operations (reflect/consolidation runs, skill creation,
   metadata updates), task management mechanics, agent internal processes.
7. If no personal content was shared today (e.g., only technical work), write
   a minimal entry or skip.

The journal is a user artifact (like `user/inbox.md`): agent-written,
user-owned. The user can read entries directly or ask the agent questions
like "what did I do yesterday?", "how has my mother been doing?", "how have
I progressed with exercise this month?".

#### 3b. Update user model

Review today's interactions. Did the user reveal:

(a) new preferences or opinions?
(b) changes to existing preferences?
(c) personal facts not yet in USER.md?
(d) corrections to previously stored information?

If yes, update USER.md accordingly. Look for both explicit signals ("I stopped doing X") and implicit ones (wording choices, corrections, repeated behaviors mentioned in passing). This step runs even when the day had no dramatic events.

When a preference changes, update `## Preferences` with the current state — don't keep history in USER.md; the change is already in the daily log.

**USER.md size discipline:** This file is always loaded into every session. It must stay dense and short — aim for under 60 lines. When a section grows beyond a few lines of essential facts, extract the detail to a satellite file in `identity/` (e.g. `health.md`, `people.md`, `background.md`) and leave a one-line summary with a link:

```markdown
> For full health details → [health.md](health.md)
```

The satellite file carries the depth; USER.md carries the working summary. This pattern applies to all sections — About, Context, Preferences, and any new ones that emerge.

#### 4. Triage inbox

Invoke the `triage_inbox` tool and follow its procedure. Process
`user/inbox.md` — the goal is to empty the Capture section every day.

After the inbox triage, act on items flagged in the "Daily coherence data"
block (inbox items matched against today's log):
- If the log confirms an item is **done** → remove it from inbox.
- If the log says it is **parked or deferred** → remove from inbox (the log
  already documents the decision; do not duplicate it to `deferred.md`).
- If an item is **stale and irrelevant to this instance** → remove it. Not
  everything that leaves the inbox needs a decision trail.

If purely informational findings, note them in today's log under Decisions.

#### 5. Write deferred items

Two sources feed the deferred queue. Write **all** deferred items in the
user's language (from the `User language:` line in the prompt header) — they
are user-facing messages (banner, OS notifications), not agent knowledge.

**5a. Items needing user attention** (from triage above):

If anything from step 4 needs user input (ambiguous classifications, items
that genuinely can't be routed without input), write to
`agent_brain/deferred.md`:
`- **decision** (YYYY-MM-DD, daily): [description].`

**Do not move inbox items to deferred in bulk.** Deferred is for items that
genuinely need a user decision at the next session start — not a holding pen
for everything removed from inbox. If an item is stale and irrelevant, remove
it silently. If it was resolved or parked in the log, it's already documented
there — do not create a deferred item for it.

**Important:** If you removed or resolved an item from inbox in step 4, it is
done — do not re-create it as a deferred. Your context may still show the old
inbox content from before your edit; trust your edits, not stale read results.

Don't wait for user interaction — act or defer.

**5b. Date-triggered reminders** (from prompt header):

The prompt header includes an "Upcoming items" block listing inbox items
and Active context deadlines within 24h. If items are listed:

1. For each item, write to `agent_brain/deferred.md`:
   `- **reminder** (YYYY-MM-DD, daily): [description].`
2. Remove the date-triggered item from inbox — inbox was storage; deferred
   is the surfacing mechanism for session start.

If the block says "No dated items due within 24h" — skip 5b.

Do not scan files yourself — the runner has already done the date matching.

---

### Part 2: Learn

#### 6. Create new concepts

Review the day's log (especially the Lessons, Decisions, and System
observations sections). Look for knowledge worth retaining:

- Patterns that apply beyond the specific situation discussed.
- Lessons that would be useful if the same situation arises again.
- Principles or heuristics the user articulated.

For each candidate, apply the **novelty test** before creating a file:
*"Does this add decision-making power beyond its parent concept?"*
If not, it's an instance — note it in the parent concept's file, don't
create a new one. Naming a specific case doesn't make it a generalization.

If it passes, check if it's already captured in `agent_brain/concepts/`
or `agent_brain/projects/`. If not, create a new file:

```
agent_brain/concepts/short-descriptive-name.md
```

With standard frontmatter and enough context to be useful without the
original conversation. Link to the daily log as source.

**Check cluster membership** (hierarchical depth model — semantic memory
never archived, depth is cooling):

1. Read `agent_brain/concepts/index.md` and scan existing general concepts
   (files with a `## Specific instances` section, or cluster entries in
   the index).
2. If the new concept fits under an existing general → add it to that
   general's `## Specific instances` section with a short explanation of
   how it relates. Add a functional link from the specific to the general
   only if it serves the reader of the specific file.
3. If no general exists but 2+ related concepts now share a pattern →
   consider creating a general concept file (general file + "Specific instances"
   linking to specifics; specifics stay as individual files at root). See
   Rule 6 (retention by memory type).
4. If standalone (domain-specific, no cluster) → leave at root; listed in
   `concepts/index.md` thematic section when the index exists.

#### 7. Form associations

Look for connections between today's work and existing brain files:

- Does a concept discussed today relate to an existing concept?
- Did a project decision connect to a known pattern?
- Is there a link between an idea and a lesson learned?

Add a link **only if it serves the reader of that file** — if following it
would genuinely amplify, deepen, or contextualize what they're reading.
Don't add links to establish bidirectional relationships between files.
Each link must answer: "Why would someone reading *this* file want to go
*there*?"

```markdown
> Related: [other-file](path/to/other-file.md) — brief explanation of
> what is on the other side and how it extends the current topic.
```

A well-connected concept doesn't need explicit backlinks to be important.
If it genuinely amplifies many topics, many files will link to it naturally
— creating implicit connectivity through use, not through enforced
bidirectionality.

When you create or significantly extend a **concept or project file**, ask
for each potential link:

- "Does this file build on, clarify, or exemplify the other one?"
- "Would a reader of *that* file benefit from knowing about *this* one?"

Add every link where both answers are yes. Don't cap the number — if there
are five genuine functional connections, create five links. The quality
criterion is the only filter. Don't force connections either; if nothing
connects naturally today, skip this step.

#### 8. Act on mature observations

The prompt header may include a "Ripe observations" block listing items at
**seen 2+** that need action. If present, act on **each** item listed — do not
skip because the full `observations.md` file is long.

If no ripe block is present, read `agent_brain/observations.md` and act on
each observation with **2 or more occurrences** (seen across different
conversations or days):

**Skill candidates (seen 2+):**
1. Create the skill in `agent_brain/skills/verb-object.md`.
2. Include: frontmatter, "When to use" with clear triggers, "Procedure"
   with numbered steps. For each step, include its **purpose** when not
   obvious — an agent that understands WHY a step exists can adapt when the
   exact procedure doesn't fit. Distinguish fixed steps (must always happen)
   from judgment calls (adapt based on context).
3. Add it to the Skills section of AGENTS.md with a trigger description.
4. Mark the observation as resolved in the journal.

**Rule candidates (seen 2+):**
1. Evaluate where it sits on the spectrum:
   - Universal trait describing who the agent IS → add to SOUL.md Character.
   - Contextual operational rule → add to `## Rules` in AGENTS.md, with WHY.
   - If unclear, default to AGENTS.md — it can be promoted later.
2. Formulate the rule with its reasoning: `[rule]. [why — what it prevents,
   enables, or protects]`.
3. Add directly to the appropriate file. Log what was added and why.
4. Mark the observation as resolved.

**Core vs instance rules:** Core behavioral rules are already loaded in your
system prompt context — do not duplicate or modify them. If a pattern worth
codifying is not already covered, add a new **instance rule** to `## Rules` in
AGENTS.md only.

**Concept candidates (seen 2+):**
1. Create the concept file if not already created in step 6 above.
2. Mark the observation as resolved in the journal.

**Structure candidates (seen 2+):**
1. Execute the structural change: create the directory, move relevant files,
   update "Where to find things" in AGENTS.md.
2. Log what was moved and why.
3. Mark the observation as resolved.

Observations with only 1 occurrence stay in the journal — they need more
data before acting.

#### 9a. Update "Right now"

Update the `### Right now` section of Active context in AGENTS.md. This
step always runs — it derives from today's logs, not from Hebbian data.

Read the day's log and the current "Right now" content.

**Daily (depth 1): add and update only — never remove.**
- If today's log **updates the status** of an existing item → rewrite that bullet.
- If today's log introduces a **new volatile fact** → add a bullet.
- Do not remove items even if today's log does not mention them — a single
  day of silence is not evidence that a project ended.

**Weekly (depth 2): full review — may remove.**
- Review the week's logs. Items not referenced in any log this week may be
  removed — a full week of silence is sufficient evidence.

Content for bullets — volatile facts that change every few days:
- Current situation (vacation, sick, deadline week, travel)
- Most immediate next actions (1-3 items, with dates if known)
- Health or personal context affecting daily activity
- Constraints or blockers

Keep it to 3-7 bullet points. This is the scratchpad of working memory —
not a task list, not a log.

#### 9b. Hebbian file promotions

Update the `### Files` section of Active context in AGENTS.md based on
Hebbian data. If the prompt header says "No tracked brain files with
access metadata", skip this step entirely.

The prompt header includes a "Hebbian promotion data" block with
pre-computed access counts and active session counts. Use this data
directly — do not read frontmatter yourself. Your job is to apply judgment
on which files to promote or demote based on the data provided.

Promotion and demotion are **gradual** — one level at a time, not jumps.
The visibility levels are:

| Level | Where | Signal to promote |
|---|---|---|
| 0 | File in subdirectory, basic one-liner in its `index.md` | default state |
| 1 | Prominent in its `index.md` (richer description, moved higher) | used this week |
| 2 | Parent directory's `index.md` highlights the subdir/project | used across weeks |
| 3 | "Where to find things" gets a specific entry with trigger | sustained high use |
| 4 | Active context "Files" | hot — needed in most sessions |

**Staleness is measured in active sessions, not calendar days.** The
Hebbian block includes active session totals and per-file counts since
`last_accessed`. Maintenance-only days don't count as opportunities to
access a file.

Steps:

1. Use the pre-computed file list from the Hebbian block — do not scan
   `agent_brain/` or read frontmatter yourself.
2. Identify files whose access has grown since last consolidation.
   **Important:** You read metadata for promotion decisions, but you never
   write `access_count` or `last_accessed` fields. The worker updates those
   automatically, and creates them the first time a file is read — manual
   edits would corrupt the signal.

   A file with no counters has simply not been read since it was written.
   That is an absence of evidence, not evidence of disuse: **do not demote a
   file for having no metadata.** A recently created file has had no chance to
   accumulate any.
3. For each growing file, **promote one level** — not to Active context
   directly. A file accessed once today becomes more prominent in its
   subdir index. A file accessed repeatedly across sessions over multiple
   days earns a higher level. Only files at level 3 that continue to be
   accessed in most sessions graduate to Active context (level 4).
4. For each file in Active context whose access hasn't grown, use the
   "active sessions since last access" count from the Hebbian block.
   **Demote one level** if ≥ 3 active sessions have elapsed without access.
   Don't remove from the system — just move it one step further from working
   memory. Gradual cooling, not deletion.
5. **Promotion signal:** a file accessed in at least 2 of the last 3
   active sessions is a candidate for promotion to the next level.
6. Skip files linked from `USER.md` as structural context (team, primary
   project) — they're always accessible through identity, not subject to
   Hebbian dynamics.
7. Keep Active context "Files" at 5-7 entries.

Each file entry has two layers — **hot data** inline and a **read trigger**:

```
- [Short name](path/to/file.md) — key fact or core principle (useful
  without opening the file). Read when [clear trigger for when to open it].
```

Avoid: accumulated history, internal scores, operational detail that only
matters during maintenance.

#### 9c. Brain health issues

If the prompt header includes a "Brain health" block, address the reported
issues:
- **Incomplete frontmatter:** each entry names the file and the keys to add.
  Fix **every file listed** in this pass — the list is already budgeted to a
  handful, and the rest arrive in later consolidations. Read the file, then
  use `edit` targeting the `---` frontmatter block to add the missing fields
  — never rewrite the whole file for a metadata repair. Write a one-line
  `summary` describing what it contains. If `created` is absent, use
  `git log --follow --diff-filter=A -- <path>` to find the commit that added
  the file and use that date; if git gives no result, leave `created` empty.
  **Merge into the existing block. Never add a second `---` block** — that
  corrupts the file and the run will be recorded as failed.
- **Missing indexes:** Create `index.md` for flagged directories using file
  summaries.
- **Oversized files:** Add an observation noting the file may benefit from
  splitting.

If no health block is present, the brain structure is healthy — skip this step.

Do not report on this step. Repairing metadata is maintenance, not something
learned; it belongs in the files you fixed and nowhere else.

#### 10. Coherence reconciliation

Review the "Daily coherence data" block in the prompt header. For each flagged item:
- If today's log confirms a stale "Right now" item is superseded → update the source.
- If a deferred item appears resolved in today's log → remove it from `deferred.md`.
- If an inbox item appears resolved or parked in today's log → remove or update it in `user/inbox.md` (move from Waiting For to done, remove from Next Actions if completed, etc.).
- If ambiguous → write a `decision` item to `deferred.md`.
- Log each reconciliation in today's log under `### Reconciled`.

Do not scan files yourself for contradictions — the worker already did.

---

### Depth extensions

The steps above run at every depth. The following steps run ONLY at the
specified depth. **Use the pre-computed blocks in the prompt header** — do not
re-scan `observations.md`, git history, or directory roots yourself.

#### Depth 2 — Weekly calibration (run after all daily steps)

**W1. Weekly journal** — write or update `user/journal/YYYY/weekly/WNN.md` from
this week's logs. If the file already exists (from a previous depth-2 run this
week), **extend it** with new days — do not rewrite or discard content already
covering earlier days. Cover the week's arc, patterns, personal note, and
looking ahead.

**W2. Weekly themes and concept evolution** — review "Weekly diff since last
depth-2" and file-change activity:
1. Themes appearing across multiple days but not captured anywhere → note as observation seed.
2. Hot concepts referenced this week: read each; update if the week evolved the concept.
3. Projects referenced this week: does status match reality?

**W3. Cross-domain principles** — review `## Preferences` in USER.md. When three
or more preferences share an underlying pattern, distill a one-line principle in
`## Principles` citing supporting preferences. Remove principles that lost support.

**W4. Observation hygiene** — review the "Stale observations" block:
1. **Resolved >60d:** remove from active sections (worker listed them).
2. **Seen:1 >90d:** compress to a count note (worker listed them).
3. **Non-existent paths:** already auto-removed by the runner; verify no false positives remain.
4. **Semantic dedup (LLM):** merge remaining entries describing the same pattern.

**W5. Coherence check (inter-day)** — review weekly diff and coherence-related flags:
1. For each USER.md change since last depth-2 → verify it still reflects reality.
2. For inbox items flagged as completed → remove or archive.
3. **Right now pruning:** review each bullet — if it was not referenced in any
   log this week, remove it. This is where items leave working memory.
4. Log reconciliations in the weekly journal under "Reconciled this week."

**W6. Skill improvement** — review "Skill usage this week":
1. For skills invoked this period → check logs for corrections or friction; read and enrich the skill if needed.
2. **Do not change AGENTS.md skill listing** — skills stay permanently visible (append-only when new skills are created).

**W7. Grouping** — review "Grouping candidates":
1. When 3+ files share a domain → create subdirectory + `index.md` hub.
2. Use `relocate_brain_file` once per file.

#### Depth 3 — Monthly review (run after weekly steps)

**M1. Monthly journal** — write `user/journal/YYYY/MM.md` synthesizing the month.

**M2. Structural review** — review brain metrics and directory shape:
1. Concept hierarchy — are subdirectories coherent? Should any split?
2. Project lifecycle — projects with no log references in 30+ days: completed, paused, or abandoned?
3. Oversized files — propose splits only when discoverability would improve.

**M3. Coherence check (inter-period)** — review "Monthly coherence flags":
1. Principles vs behavior — flag for user input when journals contradict USER.md principles.
2. Stale "Right now" items → verify and update or remove.
3. Stuck ideas → note as needs attention or advance status.
4. Sample 3–5 concepts across domains; verify claims match recent experience.

**M4. Brain health synthesis** — review the monthly metrics block. Add a brief
status note to the monthly journal (not a separate file): growth trajectory,
observation turnover, and cooling vs neglected knowledge areas.

---

### Finalize

#### 11. Done

All file changes are committed automatically when the consolidation cycle ends.
No manual action needed — just finish writing and the system persists everything.
Log rotation runs automatically after you finish — do not archive logs yourself.

**Never record the consolidation's own activity as memory.** Not in the daily
log, not in `observations.md`, not in the journal. "Reviewed the ripe
observations and no changes were needed", "completed the maintenance cycle",
"followed the process-conversation skill" — none of that is something the agent
learned about the user or the work. It is the machinery describing itself, and
because these files are injected into future sessions, every such line is
permanent noise competing with real memory. If a step produced no change, it
produces no writing.

**Do not write a consolidation report or summary block to the daily log.** The
artifacts you created (Day summary, journal entry, concepts, index updates) are
self-documenting. A "Consolidation complete" block adds tokens to every future
log read without decision-making value.
