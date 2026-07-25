---
last_accessed: 2026-07-18
access_count: 1
created: 2026-07-18
---

# AB App — Design Principles

What survives from the current AB system, what changes with the app as harness,
and how we rethink the design with new constraints and months of validated use.

This document precedes and governs the technical spec. Decisions here determine
what the spec implements.

## Core identity

AB is a **personal assistant with persistent memory** that learns through use.
It is conversational — the files are infrastructure, not interface. The user
talks; the agent captures, organizes, remembers, and grows.

### Target user (v1)

Non-technical people who want a personal assistant that remembers and learns.
The first user is someone who uses ChatGPT but has never used a code assistant,
an IDE, or a terminal. They want a second brain they can talk to, not a
developer tool.

**This means:**
- Git is invisible (the app manages it; the user never sees a command)
- The interface is a chat window — nothing else is required
- File structure is accessible but optional to understand
- Error messages in plain language
- No technical prerequisites beyond installing the app
- Capture includes handing files over: drag & drop onto the chat window or
  an attach button is the natural gesture (not typing file paths)

Power users (developers) may continue with AB in Cursor/Claude Code for their
code-centric workflows. The app serves the personal-assistant use case
independently of coding.

### AB IS

- A second brain you talk to
- A system that learns and adapts with use (not with configuration)
- A personal knowledge and task management companion
- Transparent: the user can read every file, understand the structure, move it

### AB IS NOT

- An IDE or code editor (Cursor/VS Code handle that)
- A project management tool (doesn't replace Jira/Linear)
- A multi-user system (one instance per person)
- A generic stateless chatbot
- A locked-in service (no proprietary formats, no cloud dependency)
- A code execution environment (no terminal, no shell, no scripts)

### AB CAN

- Capture, organize, and prioritize tasks and ideas
- Maintain context across sessions (projects, people, decisions, history)
- Help write and review documents
- Remember and notify when something is due
- Learn patterns from use and adapt behavior over time
- Ingest external documents into its knowledge base
- Read files the user drops or attaches in the chat (drag & drop as the
  primary ingest gesture for non-technical users)

### AB CANNOT / MUST NOT

- Execute arbitrary code or shell commands (file operations only)
- Access data outside its scope without permission
- Reorganize proactively without being asked
- Make unilateral decisions about priorities (it advises; the user decides)
- Modify its own identity without user confirmation
- Lose data (git-backed, every capture committed)

### Tool model

The agent operates exclusively through **file tools**: `read`, `write`, `edit`,
`ls`, `find`, `grep`. No `bash`. This is a deliberate security and simplicity
decision:

- **Security:** no arbitrary code execution = no prompt injection can run code
- **Simplicity:** the permission model reduces to "which files can it access?"
- **User trust:** the user understands "it reads and writes my notes" intuitively
- **Sufficiency:** all AB operations (capture, organize, remember, consolidate)
  are file operations

**Future integrations** (Gmail, Calendar, web search, etc.) are implemented as
**custom tools** registered via the Pi SDK. Each is a named, typed, scoped
capability — not arbitrary execution. The user sees "AB can read your calendar"
as a clear, authorized capability they can enable/disable.

**Procedural skills** (process-conversation, triage-inbox) are also custom
tools — zero-input tools whose result is a prompt the LLM follows. Same
mechanism, same registration, but the "capability" is cognitive rather than
external (FR-SKILL).

### Security: persistent injection threat model

The distinctive risk for a memory-writing agent is **persistence**: a document
the agent ingests could manipulate it into writing instructions into memory
files that get loaded into every future session.

**Mitigations (design-level, not just spec):**
- SOUL.md requires **user confirmation** for writes (agent's own identity);
  USER.md is Zone 1 (silent allow — the agent manages user profile freely)
- The promotion pipeline's final step (observation → identity trait) is
  **never automatic** — always proposed to the user in chat
- Consolidation runs are logged; tainted sources are traceable
- No bash = no code execution from injected content

---

## Principles that survive (harness-independent)

These are validated through months of daily use. They work regardless of
whether the harness is Cursor, Claude Code, Pi, or a custom app.

### 1. File-based memory

Plain files (markdown + frontmatter) in a git repo. This is non-negotiable:
- **Portable:** move to any system that reads files
- **Transparent:** human-readable, auditable, editable
- **Versionable:** git gives history, branching, sync
- **Independent:** no database, no cloud, no proprietary format

### 2. Biological learning cycles

Memory consolidation modeled on how brains work:
- **Encoding** — capture during experience (reflect)
- **Consolidation** — organize during rest (daily)
- **Calibration** — adjust strength over time (weekly)
- **Pruning** — forget what's no longer relevant (monthly)

The number of cycles or their names may change; the principle of
**progressive consolidation with increasing time horizons** stays.

### 3. Hebbian reinforcement

"Neurons that fire together wire together." Applied to files:
- What gets consulted becomes more prominent (promotion)
- What stops being consulted fades (demotion)
- Strength = f(access frequency, recency, connectivity)

The measurement mechanism changes (code vs LLM-tracked); the principle stays.

### 4. Progressive disclosure

Never load everything into context. Navigate by layers:
- Start with what's immediately relevant (active context)
- Drill down on demand through indexes
- Keep the context window lean and focused

### 5. Separation of concerns

Two spaces with different ownership:
- `user/` — the user's world (tasks, drafts, journal, wiki)
- `agent_brain/` — what the agent learns (concepts, skills, projects, identity)

The user never needs to touch `agent_brain/` directly. The agent never
reorganizes `user/` without being asked.

### 6. Observation → pattern → concept → rule → character

The promotion pipeline that makes AB learn:
1. Something happens once → noted in session log
2. It happens again → observation (tracked with count)
3. Pattern confirmed (2+ occurrences) → concept or skill created
4. Concept proves useful over time → elevated in visibility
5. Fundamental truths → integrated into identity (SOUL)

### 7. Write it or lose it

If the agent says "I'll remember that" — it must write it to a file
AND commit it. Memory that isn't persisted doesn't survive sessions.
In the app: the worker enforces this (post-write commit).

### 8. Usage-based triggers

Maintenance runs based on **actual use**, not wall-clock:
- "Daily" fires after enough new content, not at 23:00
- "Weekly" fires after enough dailies, not on Friday
- Vacation doesn't advance counters

This prevents empty maintenance cycles and ensures consolidation
has material to work with.

### 9. Capture over perfection

Rough capture now > lost information. Triage and refinement come later.
The system is designed to be messy at the capture layer and progressively
organized through the consolidation cycles.

### 10. The agent is conversational

The real interface is chat. Files are infrastructure the agent manages.
The user doesn't need to know the file structure to use AB — they talk,
and the agent handles the rest. (But they CAN read the files if they want.)

When the agent links to a local file in chat (e.g. a log or note), the app
opens `.md` and `.txt` files in an inline read-only viewer (FR-CHAT-10); other
file types use the system default app via `tauri-plugin-opener` `openPath()` —
not the browser and not the deprecated shell plugin `open()`, which only
accepts http/mailto/tel URLs. External links still open in the browser via
`openUrl()`. The viewer includes an optional "Open externally" action.

---

## Design primitive: human-readable, machine-managed

A key tension in the new app: we want to move more logic to code (deterministic,
token-efficient, reliable) without losing the transparency and portability that
make AB trustworthy.

**The rule:** every piece of state must be **human-readable** (inspectable in a
text editor or file browser) even if it's **machine-managed** (written and
maintained by code, not by the LLM).

| State | Format | Why |
|-------|--------|-----|
| Session logs | Markdown | Humans read these; they're the narrative record |
| Session index | Markdown (with structured frontmatter) | Navigable by human; parsed by code via frontmatter |
| Observations | Markdown (structured sections) | The user should see what patterns AB is tracking |
| Deferred items | Markdown (with parseable date markers) | User can edit/add items in any editor |
| Hebbian metadata | YAML frontmatter in each file | Visible in every file; code updates it silently |
| Brain file summaries | YAML `summary` in frontmatter | Progressive disclosure; indexes built programmatically |
| App config | JSON (`~/.buddy/config.json`) | Standard, readable, editable |
| Scheduler state | JSON | Operational; user rarely needs to inspect |

**What this means in practice:**
- No SQLite for anything the user might want to audit
- No binary formats for memory state
- Frontmatter-with-markdown is the universal format: machine-parseable header + human-readable body
- Code reads/writes the frontmatter; the LLM reads/writes the body
- **Canonical brain file frontmatter:** `summary` (one-line progressive-disclosure hint), `created`, `last_accessed`, `access_count` — see NFR-FORMAT-01. `summary` is structural metadata for indexes and search, not a Hebbian field.
- The system remains fully functional if you move it to another tool that reads markdown files

**Portability test:** "Can I take this directory, open it in Cursor with the
CLAUDE.md rules, and keep working?" — must always be YES. The app adds
convenience (scheduler, notifications, UI) but is never required.

---

## What changes with the app as harness

### Constraints that disappear

| Old constraint | Why it existed | Gone because |
|---|---|---|
| CLAUDE.md as system prompt filename | Cursor/Claude convention | We control the system prompt in code |
| .cursor/hooks/ with Python scripts | Editor hook system | Worker TS manages lifecycle directly |
| Spawning separate CLI processes for maintenance | No in-process access to agent | SDK gives direct session control |
| "Remember to run /daily" (manual triggers) | No scheduler | Heartbeat handles it |
| 18 behavioral rules in natural language | LLM needs instructions | Many become code enforcement |
| Trust file for project directory | Pi/Cursor security model | App always trusts its own AB dir |
| Platform-specific hook configs (.cursor vs .claude vs .codex) | Multi-editor support | One platform: the app |

### What moves from "instructions" to "code"

These are things currently expressed as natural language rules that the LLM
sometimes forgets or misapplies. In the app, they become **enforced behavior**:

| Behavior | Today (rule/instruction) | Tomorrow (code) |
|---|---|---|
| Track file access (Hebbian) | Rule: "increment access_count when you consult" | Worker intercepts read tool calls, updates frontmatter |
| Commit after captures | Rule: "commit regularly" | Worker auto-commits after agent write operations |
| Don't read files preemptively | Rule: "access on demand when trigger matches" | Context budget managed by code; agent gets summary, drills on request |
| Route captures correctly | Rule: "user acts → user/, agent learns → agent_brain/" | Routing validated by permission layer; agent proposes, code verifies path |
| Session indexing | Rule: "update logs/index.md" | Worker writes index entry automatically on session end and reflect complete |
| Maintenance scheduling | Hook checks thresholds on session start | Heartbeat with usage-based counters (not calendar) |
| Deferred item surfacing | Hook injects at session start | Worker checks on start + heartbeat interval |

### What stays as LLM guidance (requires judgment)

These cannot become code — they need the LLM's reasoning:

- How to summarize a conversation (reflect quality)
- What observations to extract from a session
- When to promote an observation to a concept
- How to write journal entries with appropriate tone
- What connections to make between concepts
- How to triage inbox items (urgency, context, routing)
- How to interact with the user (tone, depth, pushback)
- Whether something is a task vs context vs idea
- When to ask vs when to act

These capabilities are delivered as **procedural prompts** via skill tools
(FR-SKILL). The *when* is code (tool registration + description); the *how*
is the prompt content the LLM receives when it invokes the tool.

---

## Rethinking maintenance cycles

### Current: 4 distinct cycles

```
reflect → daily → weekly → monthly
(encode)  (consolidate) (calibrate) (prune)
```

Each is a separate skill with its own procedure, triggered independently.

### Proposed: consolidation as a single parameterized process

The app controls timing. The LLM does the thinking. Instead of 4 skills
with overlapping logic, one consolidation process with configurable **depth**:

```
depth 0 — Reflect (on session end):
  - Log the conversation (decisions, tasks, lessons, context)
  - Extract observations
  - Commit

depth 1 — Daily (after enough sessions):
  - Run depth 0 if needed (cascade)
  - Synthesize day summary
  - Journal entry
  - Surface observations with 2+ occurrences → create concepts
  - Hebbian adjustments (hot files)
  - Check deferred queue

depth 2 — Weekly (after enough depth-1 runs):
  - Run depth 1 if needed (cascade)
  - Weekly synthesis
  - Broader Hebbian calibration
  - Review ideas lifecycle
  - Link hygiene
  - Generalization pass

depth 3 — Monthly (after enough depth-2 runs):
  - Run depth 2 if needed (cascade)
  - Archive old logs
  - Monthly journal synthesis
  - Depth reorganization
  - Prune unused skills
  - Identity evolution (observation → rule → character)
```

**Key change:** the worker decides WHEN to consolidate (usage-based counters).
The LLM decides HOW (content of the consolidation). This separates timing
(deterministic, code) from thinking (LLM).

**Cascade is automatic:** if weekly is due, the worker checks if daily was
done; if not, it runs depth 1 first, then depth 2. No more "the weekly skill
checks if daily ran and does it first" — that's worker logic now.

### What the worker handles (code, no tokens)

- Count sessions since last consolidation at each depth
- Check if new content exists (git diff since last run)
- Cascade ordering
- Lock management (don't run two consolidations simultaneously)
- Session state (in-progress, completed, failed)
- Auto-commit after consolidation
- Log the run in the session index
- Prune `.buddy/logs/*.jsonl` older than retention threshold (NFR-MAINT-01)
- Brain health scan (`computeBrainHealthReport()`, FR-BRAIN-07) before consolidation

### What the LLM handles (judgment, uses tokens)

- Read recent logs and extract meaning
- Write synthesis (summaries, journal entries)
- Decide what observations to promote
- Create new concepts/skills from patterns
- Evaluate what to demote/prune
- Make connections between ideas

---

## Rethinking Hebbian tracking

### Current: LLM responsibility + honor system

Rules say "increment access_count when you consult a file." The LLM sometimes
forgets, sometimes double-counts, and the data is unreliable.

### Proposed: code-enforced, transparent via frontmatter

The worker intercepts every `read` tool call. If the file has frontmatter with
`access_count`, the worker:
1. Increments `access_count`
2. Updates `last_accessed` to today
3. Writes the updated frontmatter back
4. Passes the file content to the LLM as normal

**Exclusions** (managed by code, not by LLM judgment):
- Files opened only for editing (write tool, not read)
- Structural files (indexes, SOUL.md, USER.md — always loaded, not "consulted")
- The same file read multiple times in one turn (count once per session)

**Promotion/demotion logic** (runs during consolidation):
- Worker provides the LLM with a sorted list: "These files were consulted N
  times in the last M sessions. These files haven't been touched in P sessions."
- LLM decides what to promote/demote based on that data + semantic relevance
- Worker validates the changes (e.g., can't promote to Active context if
  access_count < threshold)

**The frontmatter stays human-visible.** Anyone can open a file and see
`access_count: 12, last_accessed: 2026-07-18` right at the top.

**`summary` is not Hebbian metadata.** The `summary` field (NFR-FORMAT-01)
describes file content for progressive disclosure and programmatic index
generation. It is written at file creation or updated during consolidation —
not by read hooks. Hebbian hooks only touch `access_count` and `last_accessed`.

### Brain health linter

Deterministic structural checks before consolidation (FR-BRAIN-07):
- Missing required frontmatter (including `summary`)
- Missing core files or malformed structure
- Directories with >1 file lacking `index.md`
- Oversized files flagged for split consideration

Worker produces a `BrainHealthReport` injected into the consolidation prompt
(like the Hebbian access report). No LLM tokens for the scan itself.

---

## Rethinking the file structure

### Naming: `agent_brain/` stays (decided)

The name `agent_brain/` is a deliberate design choice — it makes the
separation between agent space and user space immediately clear when
browsing the filesystem. Users (even non-technical ones) can understand
"this folder is the agent's brain, that folder is mine."

### Global vs instance: the separation principle

**Pain point from AB:** Core prompts, skills, and structural rules lived inside
the instance repo mixed with user/agent content. Updating them required
migrating every instance. Adopting an existing AB directory missed new prompts.
The ownership boundary was ambiguous.

**Design decision (E11):** Core app assets live in `~/.buddy/` (global,
app-managed). Instance content lives in `rootDir` (user/agent-owned).

```
~/.buddy/                  ← global, app-managed, safely updatable
  config.json              ← rootDir pointer, language, model
  auth.json                ← OAuth tokens / API keys (mode 600)
  allowed-paths.json       ← Zone 2 user-designated paths
  prompts/                 ← core prompts (updated with the app)
    agents-base.md         ← universal behavior (tools, limits, automatic ops)
    consolidation.md       ← consolidation procedure
    process-conversation.md← reflect/manual session capture
    triage-inbox.md        ← GTD inbox triage procedure

rootDir/                   ← git repo, user/agent content
  AGENTS.md                ← instance-specific: routing, active context, rules
  agent_brain/             ← agent's space
    identity/
      SOUL.md              ← character, never auto-modified
      USER.md              ← user profile, updated by agent silently (Zone 1)
    concepts/
    projects/
    skills/                ← agent-learned skills (from mature observations)
    ideas/
    observations.md        ← structured sections
    deferred.md            ← parseable date markers
  user/                    ← user's space
  logs/                    ← session records
    index.md               ← structured index
  .pi/settings.json        ← per-instance provider/model (Pi SDK cwd discovery)
  .buddy/                  ← runtime state (gitignored)
    maintenance.lock
    consolidation-state.json
    reflect-sessions/        ← forked Pi sessions for background reflect
    logs/*.jsonl           ← app events
```

**Why global prompts:**
- **Updates are safe:** app updates overwrite `~/.buddy/prompts/` — no user
  content at risk
- **Backward compat is free:** adopting an old AB instance doesn't require
  copying prompts into it; they're always in `~/.buddy/`
- **Multi-instance works:** all instances share the same core behavior; only
  instance-specific content varies per rootDir
- **Ownership is unambiguous:** if it's in `~/.buddy/`, the app owns it; if
  it's in rootDir, the user/agent owns it

**System prompt layering:**
1. `~/.buddy/prompts/agents-base.md` — tools, limits, automatic behaviors
2. `rootDir/AGENTS.md` (or `CLAUDE.md`) — instance rules, routing, active context
3. Identity files (SOUL.md, USER.md)
4. Dynamic context (date, logs/index, last session, deferred items)

**Skill tools:** Core procedural skills (process-conversation, triage-inbox)
are registered as custom tools on the Pi session. When the LLM calls them, the
worker returns the prompt text from `~/.buddy/prompts/`. The LLM follows it as
a procedure within the current context. This replaces the old pattern of
declaring skills in AGENTS.md and having the LLM read files with tool calls.

The base takes precedence for capability constraints. Old `CLAUDE.md` files
that mention git commands or bash are overridden by the base's explicit "No
bash, git is automatic" declaration — the LLM follows the most specific/earliest
constraint.

**Backward compatibility:** `AGENTS.md` stays in rootDir. It contains the
instance-specific behavioral rules that allow any AI editor (Cursor, Claude
Code) to operate on the repo with basic functionality. The app assembles a
richer system prompt from `agents-base.md` + instance file, but the repo is
self-contained if opened elsewhere.

**Platform artifacts:** `.cursor/`, `.codex/`, `.claude/` are irrelevant to
the app and ignored. They may exist in imported instances — the app doesn't
touch them.

**What stays per-instance (`.pi/settings.json`):** Pi discovers settings from
cwd. Multi-instance support (different providers per instance) requires
per-rootDir settings. Cost: one small file. Moving it would require symlinks
or Pi SDK changes — not worth the complexity.

---

## Reflect (encoding)

### Design principle: the fork IS the context

The reflect child continues the conversation — it doesn't read a cold summary.

```
Worker (code, no LLM, <100ms):
  - Fork the live session via SessionManager.forkFrom()
  - Spawn background child with session metadata args (sessionId, date, start/end times)
  - Close app window

Background child (LLM, async):
  - Open the forked session (full conversation history: all turns, tool calls, results)
  - Send a single user prompt: "Reflect on this session — Decisions, Lessons,
    Context, Open threads, Tasks captured, Ideas, System observations"
  - NO system prompt override, NO ResourceLoader, NO AGENTS.md
  - Commit agent file writes immediately after LLM call
  - Append ## Session HH:MM–HH:MM to logs/YYYY-MM-DD.md using spawn metadata
  - Rebuild logs/index.md → commit → exit
```

**Why fork-only?** The fork already has the full conversation. Session metadata
(date, header times) comes from spawn args — no intermediate pending file.

**Why not a ResourceLoader / system prompt?** The live session already had
AGENTS.md and identity in its context. The fork inherits that. Loading them
again would double-inject, and loading a *different* system prompt (e.g. a
"reflect agent" persona) would pollute the context the model is summarizing.
The reflect prompt goes as a user message — simple continuation.

**Incremental reflect** on `compaction_start` only (Jul 24 redesign — no turn-count
trigger):
- Pi emits `compaction_start` when context exceeds threshold — the signal that
  detail is about to be lost to summarization
- Worker forks the session and spawns a checkpoint child **before** Pi compacts
  (same fork-only pattern); Pi's compaction runs normally afterward
- Uses a **cheaper model** (or lower thinking level) — checkpoints are encoding,
  not deep analysis
- Session-end reflect uses the configured model at full depth
- **Cost:** zero mid-session LLM calls unless compaction actually triggers
  (typically 0–2 per long session). Replaces editor-AB turn-count checkpoints
  that existed because cold-transcript reflect had no fork capability.
- **Mid-session visibility:** checkpoint output is committed to the daily log;
  the agent can read files created or modified during the session after reflect.

**Session path persistence:** On session create, the worker writes the Pi session
file path to `.buddy/consolidation-state.json` (one disk write, no LLM). Crash
recovery on next boot forks from the persisted path. Pre-consolidation reflect
runs before the consolidation cascade when the session has unreflected activity.

**Why not custom compaction (Option C)?** Pi's compaction summary is optimized
for agent continuity post-compaction. Replacing it risks degrading in-session
behavior; fork-before-compact captures episodic detail without touching Pi's flow.

---

## Product scope for v1

Based on months of real use by multiple people, what does an MVP need to
actually feel useful? Not "what does the current system do" — what does a
user need on day one to get value?

### Day-one value (MVP must have)

1. **Conversational capture** — talk, and it remembers (tasks, decisions, ideas)
2. **Continuity** — next session starts where the last one left off
3. **Simple retrieval** — "what was that decision about X?" and it finds it
4. **Task awareness** — knows what's pending, can remind you
5. **Personalization** — learns your name, preferences, context over time

### Week-one value (validates retention)

6. **Consolidation** — the agent summarizes and organizes without being asked
7. **Pattern recognition** — starts noticing repeated themes, suggests concepts
8. **Proactive surfacing** — "you mentioned X three days ago, is that still open?"

### Month-one value (validates the learning premise)

9. **Adapted behavior** — the agent is measurably different from week 1
10. **Knowledge base** — accumulated wisdom that saves time
11. **Trusted memory** — the user stops keeping mental notes because AB has them

### Explicitly NOT in v1

- Wiki ingest (power feature, not onboarding)
- Draft review (requires style guide setup)
- Multi-instance management (one brain per user for now)
- Voice input (Phase 4+)
- Mobile access (Phase 4+)

---

## Resolved design decisions

1. **System prompt:** Hybrid — base behavioral rules in `AGENTS.md` (portable,
   versioned, works in other editors as fallback). The worker loads it and
   enriches with dynamic context (active context, deferred items, user prefs)
   at session start. NOT per-turn (too expensive). User can edit AGENTS.md
   directly for customization; the app never overwrites it.

2. **Consolidation isolation:** Separate Pi session for depth >= 1. The user's
   live session is never contaminated by consolidation output. The worker
   spawns a maintenance session via `SessionManager`, runs consolidation, then
   disposes it. If the user is streaming, consolidation defers until idle.

3. **Backward compatibility:** AGENTS.md stays in the repo. Minimal but
   functional — a user who opens the repo in Cursor/Claude Code gets basic AB
   behavior. The app adds the full experience (scheduler, notifications,
   Hebbian tracking, etc.) but the repo is self-contained.

4. **Observations format:** Keep as one flat file with structured markdown
   sections. Splitting into per-observation files adds complexity without clear
   benefit — the file is small, human-readable, and easy to parse by code.

5. **Identity files:** Keep SOUL.md + USER.md separate. SOUL defines character
   (stable, rarely changes, requires user confirmation). USER defines the person
   (updates as the agent learns, Zone 1 silent allow).

6. **LLM providers (v1):** Anthropic, Google Gemini, OpenAI only. No local
   models until we verify which ones reliably follow AB's memory procedures.

7. **Tool set:** File tools only (read, write, edit, ls, find, grep). No bash.
   Future capabilities added as custom Pi SDK tools — typed, scoped, auditable.

8. **Global/local split (E11):** Core prompts and the universal system prompt
   base (`agents-base.md`) live in `~/.buddy/prompts/`, not inside rootDir.
   App updates refresh them without touching user content. Instance-specific
   behavior stays in `rootDir/AGENTS.md`. Old instances with `CLAUDE.md` work
   without migration — the base layer overrides stale capability claims.

9. **Schema versioning (E11):** `~/.buddy/version` (integer) tracks what
   format the global config directory is in. Sequential migrations run on boot
   when the app's embedded version is higher. See below for full design.

---

## Schema versioning and migration

The global config directory (`~/.buddy/`) evolves across app releases. A version
marker enables safe, automatic migration without user interaction.

### Design

```
~/.buddy/version    ← single integer (e.g. "1")
```

- **File, not field:** Stored separately from `config.json` so the version can
  be read even when the config format has changed and can't be parsed yet.
- **Integer, not semver:** Internal schema counter. Increments only when a
  structural migration is needed. Many app releases may share the same schema
  version if nothing in `~/.buddy/` changes.
- **Absent = 0:** A fresh install or a pre-versioning install both read as
  schema 0. The first migration (0→1) bootstraps the directory to the current
  state.

### Boot sequence

```
1. Read ~/.buddy/version (default 0 if missing)
2. Compare with APP_SCHEMA_VERSION (compile-time constant)
3. If behind: run migrations sequentially (0→1, 1→2, …)
4. Write new schema version (only after all migrations succeed)
5. Compare app semver with last_app_version in ~/.buddy/config.json
6. If different: overwrite ~/.buddy/prompts/ from bundled/prompts/; update last_app_version
7. Continue normal startup (session creation, prompt assembly, etc.)
```

Steps 1–4 handle **structural** migrations (integer schema). Steps 5–6 handle
**prompt content** refresh on any app version change — orthogonal to schema
version. A release can bump semver with prompt fixes but no schema migration.

Migrations and prompt refresh run **before any session starts** — the worker
can assume `~/.buddy/` is in the expected state by the time it assembles a
system prompt or spawns a consolidation session.

### Migration contract

Each migration function must be:

- **Sequential:** runs only after all previous migrations have completed.
  Can assume the exact state left by the prior version.
- **Idempotent:** if interrupted (crash, power loss), re-running produces the
  correct end state. Use create-or-overwrite, not append.
- **Silent:** no user interaction required. If a future migration needs user
  input (e.g., breaking change in config format), it writes a marker and the
  UI surfaces a one-time explanation after boot completes.
- **Fast:** migrations should complete in <100ms under normal conditions.
  They write files and transform JSON — no network, no LLM calls.

### Scope boundary

| `~/.buddy/` (global) | `rootDir` (per-instance) |
|---|---|
| Migrated via schema versions | Adapted at runtime (backward compat) |
| App overwrites freely | App never modifies existing content |
| Examples: prompts, config format, auth format | Examples: AGENTS.md, agent_brain/, logs/ |

The app **never migrates rootDir** — it adapts to what it finds. Old instances
missing newer files (e.g., no `AGENTS.md`, only `CLAUDE.md`) are handled by
fallback logic in the worker, not by writing new files into the user's repo.
This preserves the principle that rootDir belongs to the user/agent.

### Version history (grows with each migration)

| Schema | Migration | What it does |
|--------|-----------|--------------|
| 0→1 | `migrate_0_to_1` | Create `~/.buddy/prompts/`; write `agents-base.md`, `consolidation.md`, `process-conversation.md`, `triage-inbox.md` from embedded content. |

### Why this matters for the future

- **Config format changes:** If `config.json` adds required fields or changes
  structure, a migration transforms the old format before the parser runs.
- **Auth format changes:** If the token structure in `auth.json` changes, a
  migration can re-key or restructure it.
- **New global files:** Any new file the app expects in `~/.buddy/` gets created
  by a migration — existing users get it on next boot without reinstalling.
- **Deprecation:** Old files or fields can be cleaned up by a migration, keeping
  the directory tidy over years of use.
