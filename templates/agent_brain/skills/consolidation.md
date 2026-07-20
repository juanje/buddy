---
last_accessed:
access_count: 0
created:
---

# Skill: Consolidation

## When to use

Triggered by the app's maintenance scheduler when usage-based thresholds are
met (FR-CONSOL-01), or manually by the user. This is the consolidation cycle —
where the system summarizes recent work and learns from it.

Depth 1 (daily synthesis) is the default when unspecified. Higher depths
(weekly calibration, monthly pruning) extend the same procedure with broader
input scope — follow the scheduler's depth parameter.

**Autonomous mode:** All steps run without user interaction. Act with judgment;
log all decisions and changes made. No approval gates — the maintenance cycles
and git history provide the correction mechanism.

**Prerequisite:** Session reflect runs automatically at session end (FR-REFLECT-02).
The daily log already contains `## Session` blocks from reflect. Do not re-run
reflect before consolidating — read what's already in the log.

## Procedure

---

### Step -1: Resolve the subjective date

Before any file writes, determine the user's subjective "today":

1. Run `date +%H:%M` to get the current system time.
2. If the time is between **00:00 and 05:00**, the user's subjective day is
   **yesterday** (previous calendar day). Use that date for all log files,
   index entries, and journal paths created during this run.
3. Otherwise, use today's calendar date as normal.

This implements the night-owl rule from `USER.md` → Preferences. The
system-injected `currentDate` reflects the calendar date, not the user's
subjective day boundary — this step is the correction.

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

After writing the Day summary, update today's line in `logs/index.md` with
the Key themes if an entry for today exists. If no line exists yet, append:
`- YYYY-MM-DD: active — [Key themes]`.

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
4. Tone: agent's notes about the user, third person, factual but warm.
5. Exclude: system operations (reflect/consolidation runs, skill creation,
   metadata updates), task management mechanics, agent internal processes.
6. If no personal content was shared today (e.g., only technical work), write
   a minimal entry or skip.

The journal is a user artifact (like `user/inbox.md`): agent-written,
user-owned. The user can read entries directly or ask the agent questions
like "what did I do yesterday?", "how has my mother been doing?", "how have
I progressed with exercise this month?".

#### 4. Triage inbox

Read `agent_brain/skills/triage-inbox.md` and execute it. Process
`user/inbox.md` — the goal is to empty the Capture section every day.

After the inbox triage, do a quick scan of the rest of `user/`:
- Any items that need attention or follow-up?
- Any completed items in context lists that should be removed?
- Don't do a full review — that's for weekly and monthly consolidation.

If anything needs user attention (stale items, ambiguous classifications,
items that can't be routed without input), write to `agent_brain/deferred.md`:
`- **decision** (YYYY-MM-DD, daily): [description].` If purely informational
findings, note them in today's log under Decisions. Don't wait for user
interaction — act or defer.

#### 4b. Surface reminders

Scan for deadlines and events the user should see at the next interactive
session (within 24h from the subjective date resolved in Step -1):

1. Read `user/inbox.md` — items with a date marker matching **tomorrow**
   (or **today** if the daily runs during the night-owl window, 00:00–05:00).
2. Read AGENTS.md **Active context → Right now** — deadlines or events
   within 24h.
3. For each match, write to `agent_brain/deferred.md`:
   `- **reminder** (YYYY-MM-DD, daily): [description].`
4. Remove date-triggered items from inbox once written to deferred — inbox
   was storage; deferred is the surfacing mechanism for session start.

---

### Part 2: Learn

#### 5. Create new concepts

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
   consider creating a Phase 1 general (general file + "Specific instances"
   linking to specifics; specifics stay as individual files at root). See
   Rule 6 (retention by memory type).
4. If standalone (domain-specific, no cluster) → leave at root; listed in
   `concepts/index.md` thematic section when the index exists.

#### 6. Form associations

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

#### 7. Act on mature observations

Read `agent_brain/observations.md`. For each observation with **2 or more
occurrences** (seen across different conversations or days):

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
   - Contextual operational rule → add to AGENTS.md Rules, with WHY.
   - If unclear, default to AGENTS.md — it can be promoted later.
2. Formulate the rule with its reasoning: `[rule]. [why — what it prevents,
   enables, or protects]`.
3. Add directly to the appropriate file. Log what was added and why.
4. Mark the observation as resolved.

**Concept candidates (seen 2+):**
1. Create the concept file if not already created in step 5 above.
2. Mark the observation as resolved in the journal.

**Structure candidates (seen 2+):**
1. Execute the structural change: create the directory, move relevant files,
   update "Where to find things" in AGENTS.md.
2. Log what was moved and why.
3. Mark the observation as resolved.

Observations with only 1 occurrence stay in the journal — they need more
data before acting.

#### 8. Update Active context

Active context has two subsections: **Right now** (ephemeral state) and
**Files** (pointers to semantic memory).

**### Right now** — current state the agent should know at every session
start, without opening any file. Volatile facts that change every few days:

- Current situation (vacation, sick, deadline week, travel)
- Most immediate next actions (1-3 items, with dates if known)
- Health or personal context affecting daily activity
- Constraints or blockers

Keep it to 3-5 bullet points. This is the scratchpad of working memory —
not a task list, not a log. Replace the full contents each time; don't
append.

**### Files** — pointers to brain files worth keeping in the agent's
peripheral awareness. Updated based on today's activity:

Promotion and demotion are **gradual** — one level at a time, not jumps.
The visibility levels are:

| Level | Where | Signal to promote |
|---|---|---|
| 0 | File in subdirectory, basic one-liner in its `index.md` | default state |
| 1 | Prominent in its `index.md` (richer description, moved higher) | used this week |
| 2 | Parent directory's `index.md` highlights the subdir/project | used across weeks |
| 3 | "Where to find things" gets a specific entry with trigger | sustained high use |
| 4 | Active context "Files" | hot — needed in most sessions |

**Staleness is measured in active sessions, not calendar days.** Read
`logs/index.md`. Count only lines marked `active` — maintenance-only days
don't count as opportunities to access a file.

Steps:

1. Scan files in `agent_brain/` (excluding `identity/`, `skills/`, `archive/`).
2. Read metadata (`access_count`, `last_accessed`). Identify files whose
   access has grown since last consolidation.
3. For each growing file, **promote one level** — not to Active context
   directly. A file accessed once today becomes more prominent in its
   subdir index. A file accessed repeatedly across sessions over multiple
   days earns a higher level. Only files at level 3 that continue to be
   accessed in most sessions graduate to Active context (level 4).
4. For each file in Active context whose `access_count` hasn't grown,
   count the number of `active` sessions in `logs/index.md` with a date
   after the file's `last_accessed`. **Demote one level** if ≥ 3 active
   sessions have elapsed without access. Don't remove from the system —
   just move it one step further from working memory. Gradual cooling,
   not deletion.
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

#### 9. Log rotation

Keep the `logs/` root at a manageable size. Older logs are archived but
remain findable in `logs/archive/YYYY-MM/`.

1. Count `*.md` files in `logs/` (excluding `index.md` and any
   `monthly_*.md` files).
2. If the count exceeds **28**, for each file to archive (oldest first):
   a. Move the file to `logs/archive/YYYY-MM/` (based on the file's
      date). Create the directory with `mkdir -p` if needed.
   b. **Remove** the corresponding line from `logs/index.md`.
   c. **Append** the line to `logs/archive/YYYY-MM/index.md`. If the
      month index doesn't exist, create it with:
      ```
      # Sessions — YYYY-MM

      Log files: `YYYY-MM-DD.md` (in this directory).
      ```
   Repeat until exactly 28 remain.
3. Note what was archived in today's log under Decisions.

Why 28: provides a comfortable window of recent history regardless of
usage frequency. Weekly review always has enough recent logs; monthly
review may need the archive. Count-based (not date-based) rotation
ensures the root always has the same depth of history regardless of
how sessions are spread across the calendar.

---

### Finalize

#### 10. Git commit

```bash
git add AGENTS.md agent_brain/ logs/ user/ && git commit -m "daily: YYYY-MM-DD" 2>/dev/null || true
```
