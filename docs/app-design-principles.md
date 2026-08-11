---
last_accessed: 2026-07-18
access_count: 1
created: 2026-07-18
---

# buddy — Design Principles

What survives from the current buddy system, what changes with the app as harness,
and how we rethink the design with new constraints and months of validated use.

This document precedes and governs the technical spec. Decisions here determine
what the spec implements.

## Core identity

buddy is a **personal assistant with persistent memory** that learns through use.
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

Power users (developers) may continue with buddy in Cursor/Claude Code for their
code-centric workflows. The app serves the personal-assistant use case
independently of coding.

### buddy IS

- A second brain you talk to
- A system that learns and adapts with use (not with configuration)
- A personal knowledge and task management companion
- Transparent: the user can read every file, understand the structure, move it

### buddy IS NOT

- An IDE or code editor (Cursor/VS Code handle that)
- A project management tool (doesn't replace Jira/Linear)
- A multi-user system (one instance per person)
- A generic stateless chatbot
- A locked-in service (no proprietary formats, no cloud dependency)
- A code execution environment (no terminal, no shell, no scripts)

### buddy CAN

- Capture, organize, and prioritize tasks and ideas
- Maintain context across sessions (projects, people, decisions, history)
- Help write and review documents
- Remember and notify when something is due
- Learn patterns from use and adapt behavior over time
- Ingest external documents into its knowledge base
- Read files the user drops or attaches in the chat (drag & drop as the
  primary ingest gesture for non-technical users)

### buddy CANNOT / MUST NOT

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
- **Sufficiency:** all buddy operations (capture, organize, remember, consolidate)
  are file operations

**Shipped custom tools** extend the base set without adding shell access:

- `fetch_url` — web→markdown, PDF→text, image→file (FR-NET-01)
- `copy_file` — byte-for-byte copy from external paths into workspace (FR-FILE-01)
- `move_file` — rename/move within workspace, uses git mv for tracked files (FR-FILE-02)
- `delete_file` — restricted to `user/`/`downloads/`, user confirmation required (FR-DELETE-01)
- `process_conversation`, `triage_inbox` — procedural skills loaded from `~/.buddy/prompts/` (FR-SKILL)
- `relocate_brain_file` — consolidation-only, moves files with link rewriting (FR-CONSOL-07)

**Future integrations** (Gmail, Calendar, web search, etc.) are implemented as
**custom tools** registered via the Pi SDK. Each is a named, typed, scoped
capability — not arbitrary execution. The user sees "buddy can read your calendar"
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

Two owners, three destinations:

| Question | Destination | Examples |
|----------|-------------|---------|
| Will the **agent** need this to be a better assistant? | `agent_brain/` | User preferences, project decisions, patterns observed, lessons about how to assist this user |
| Will the **user** want to find and build on this? | `user/wiki/` | Ideas, concepts, reflections, document summaries, brainstorming output, reference knowledge |
| Will the **user** act on this? | `user/inbox.md` / `user/projects/` | Tasks, reminders, multi-step outcomes (GTD) |

The test is **ownership, not topic.** A concept about "complex systems" could
go either way: if the agent learned it to understand the user's writing better
→ `agent_brain/`. If the user shared it as knowledge they want to keep →
`user/wiki/`. The distinction is *who needs it and why*.

**Operational rules:**
- "Save this" from the user → `wiki_file` (when wiki is enabled), unless
  clearly a task (→ inbox) or explicitly directed elsewhere.
- Agent self-improvement → `agent_brain/`, captured during reflect and
  consolidation. The user does not direct this.
- Drafts and work-in-progress documents stay in `user/` as files — they are
  outputs in progress, not concepts.
- When the wiki is not enabled, the agent uses `user/` files as before.

The user never needs to touch `agent_brain/` directly. The agent never
reorganizes `user/` without being asked.

### 6. Observation → pattern → concept → rule → character

The promotion pipeline that makes buddy learn:
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
The user doesn't need to know the file structure to use buddy — they talk,
and the agent handles the rest. (But they CAN read the files if they want.)

When the agent links to a local file in chat (e.g. a log or note), the app
opens `.md` and `.txt` files in an inline read-only viewer, and only from
`agent_brain/`, `user/`, `downloads/` and `logs/` (FR-CHAT-11). Links inside an
open document can be followed, with a back trail (FR-CHAT-12). External links
open in the browser via `openUrl()`, restricted to `https://`.

**Buddy never hands a file to another program.** For anything it cannot render,
it points the user at the location and they open it themselves.

*Corrected 2026-07-28.* This paragraph previously described `openPath()` and an
"Open externally" action, both removed in July 2026: a click became execution —
macOS opening a `.command` file with Terminal, for instance — and the agent
chooses those link targets under the influence of pages it has fetched. The
stale text outlived the code here and in the self-docs, where the agent read it
and told users the feature still existed. **A capability withdrawn from the code
is not withdrawn until it is withdrawn from this document too**; this file
governs the spec, and the spec governs what the agent is told it can do.

---

## Design primitive: human-readable, machine-managed

A key tension in the new app: we want to move more logic to code (deterministic,
token-efficient, reliable) without losing the transparency and portability that
make buddy trustworthy.

**The rule:** every piece of state must be **human-readable** (inspectable in a
text editor or file browser) even if it's **machine-managed** (written and
maintained by code, not by the LLM).

| State | Format | Why |
|-------|--------|-----|
| Session logs | Markdown | Humans read these; they're the narrative record |
| Session index | Markdown (with structured frontmatter) | Navigable by human; parsed by code via frontmatter |
| Observations | Markdown (structured sections) | The user should see what patterns buddy is tracking |
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
- **Canonical brain file frontmatter:** `summary` (one-line progressive-disclosure hint), `created`, `last_accessed`, `access_count` — see NFR-FORMAT-01. `summary` is structural metadata for indexes and search, not a Hebbian field. **Exception:** `identity/SOUL.md` and `identity/USER.md` carry no frontmatter — they are always-injected at session start and never discovered through indexes or search.
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
| Trust file for project directory | Pi/Cursor security model | App always trusts its own buddy dir |
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
- Extract ripe observations (seen 2+) from `observations.md` and inject into prompt header
- Update `logs/index.md` entry from Day summary Key themes after depth-1 consolidation

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
- Missing required frontmatter (including `summary`) — exempts `identity/SOUL.md` and `identity/USER.md` (always-injected, no progressive disclosure)
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

**Pain point from buddy:** Core prompts, skills, and structural rules lived inside
the instance repo mixed with user/agent content. Updating them required
migrating every instance. Adopting an existing buddy directory missed new prompts.
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
- **Backward compat is free:** adopting an old buddy instance doesn't require
  copying prompts into it; they're always in `~/.buddy/`
- **Multi-instance works:** all instances share the same core behavior; only
  instance-specific content varies per rootDir
- **Ownership is unambiguous:** if it's in `~/.buddy/`, the app owns it; if
  it's in rootDir, the user/agent owns it

**System prompt layering:**
1. `~/.buddy/prompts/agents-base.md` — tools, limits, capture rules, core rules, file metadata, knowledge routing, docs self-reference
2. `rootDir/AGENTS.md` (or `CLAUDE.md`) — instance state: active context, navigation map, learned rules
3. Identity files (SOUL.md, USER.md)
4. Current date/time

Episodic content (logs index, last session, deferred items, first-run interview) is **not** in the system prompt — it is assembled separately as a session context message (FR-PROMPT-02/04).

**Skill tools:** Core procedural skills (process-conversation, triage-inbox)
are registered as custom tools on the Pi session. When the LLM calls them, the
worker returns the prompt text from `~/.buddy/prompts/`. The LLM follows it as
a procedure within the current context. This replaces the old pattern of
declaring skills in AGENTS.md and having the LLM read files with tool calls.

The base takes precedence for capability constraints. Old `CLAUDE.md` files
that mention git commands or bash are overridden by the base's explicit "No
bash, git is automatic" declaration — the LLM follows the most specific/earliest
constraint.

**Backward compatibility:** `AGENTS.md` stays in rootDir. It contains
instance-specific state (active context, navigation, learned rules) that allow
any AI editor (Cursor, Claude Code) to operate on the repo with basic
functionality. Core behavioral rules live in `agents-base.md` and are only
available when the app assembles the full system prompt.

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
  - Load bundled process-conversation.md + OUTPUT_ONLY_SUFFIX
  - Produce ONLY the ## Session HH:MM–HH:MM block (omit empty sections; synthesize, don't transcribe)
  - NO system prompt override, NO ResourceLoader, NO AGENTS.md
  - Worker persists output to logs/YYYY-MM-DD.md; commit agent file writes if any
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
  (typically 0–2 per long session). Replaces editor-buddy turn-count checkpoints
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
11. **Trusted memory** — the user stops keeping mental notes because buddy has them

### Explicitly NOT in v1

- Wiki ingest (power feature, not onboarding)
- Draft review (requires style guide setup)
- Multi-instance management (one brain per user for now)
- Voice input (Phase 4+)
- Mobile access (Phase 4+)

---

## Resolved design decisions

1. **System prompt:** Hybrid — core behavioral rules in `agents-base.md`
   (app-managed, updated on every version). Instance state in `AGENTS.md`
   (active context, navigation map, learned rules). The worker assembles both
   at session start. NOT per-turn (too expensive). User customizations in
   AGENTS.md are preserved; structural migration may strip core instructions
   that moved to agents-base.md (FR-PROMPT-08).

2. **Consolidation isolation:** Separate Pi session for depth >= 1. The user's
   live session is never contaminated by consolidation output. The worker
   spawns a maintenance session via `SessionManager`, runs consolidation, then
   disposes it. If the user is streaming, consolidation defers until idle.

3. **Backward compatibility:** AGENTS.md stays in the repo. Minimal but
   functional — a user who opens the repo in Cursor/Claude Code gets basic buddy
behavior. The app adds the full experience (scheduler, notifications,
   Hebbian tracking, etc.) but the repo is self-contained.

4. **Observations format:** Keep as one flat file with structured markdown
   sections. Splitting into per-observation files adds complexity without clear
   benefit — the file is small, human-readable, and easy to parse by code.

5. **Identity files:** Keep SOUL.md + USER.md separate. SOUL defines character
   (stable, rarely changes, requires user confirmation). USER defines the person
   (updates as the agent learns, Zone 1 silent allow).

6. **LLM providers (v1):** Anthropic, Google Gemini, OpenAI only. No local
   models until we verify which ones reliably follow buddy's memory procedures.

   **Upheld, and the implementation was corrected to match it (2026-07-28).**
   The setup wizard had been offering an "OpenAI-compatible" provider,
   contradicting this decision — and it did not work anyway: the base URL was
   collected and validated but never persisted, so the session ended up with a
   credential and no address. The entry point was removed. This principle is
   why FR-PROVIDER stays deferred rather than being treated as a bug to patch:
   the blocker was never only the missing persistence, it is the open question
   stated here. A local model that cannot reliably follow the consolidation and
   reflect procedures does not fail loudly — it quietly degrades the memory,
   which is the one thing buddy exists to keep. Making the plumbing work is the
   easy half; verifying the procedures is the decision.

   **Evaluated 2026-07-28/29, and the decision stands — now on evidence.** Two
   models were run end to end against a real instance (gemma-4 12B and 26B via
   oMLX). What was learned:

   - **Conversation and retrieval were genuinely good.** Wiki search, link
     rendering and answer quality were close to a commercial model, and decode
     speed (~17 tok/s) is comfortably readable.
   - **File editing was not.** The 12B failed 8 of 8 `edit` calls by dropping
     Markdown bold markers when reconstructing `oldText`; the 26B reproduced
     ~900 characters verbatim but still duplicated a section it had just read.
   - **The disqualifying behaviour is confabulated completion.** Across runs the
     models repeatedly stated a file had been written when no tool call had been
     made — including immediately after apologising for the previous instance of
     it. For an assistant whose value is remembering, "I wrote that down" when it
     did not is the worst available failure, and it is silent.
   - **Disabling reasoning improved editing and worsened confabulation.** The
     leaked reasoning trace, ugly as it was, contained an accurate self-audit of
     which tool calls had succeeded. That is what disappeared.

   **The honest summary: it works well enough to be tempting and not well enough
   to be trusted with memory.** FR-PROVIDER stays deferred, and the question to
   answer before revisiting is not "can we send the requests" — that is solved
   and documented — but whether any local model completes a depth-1
   consolidation without corrupting the brain.

   **A separate finding, and the more valuable one:** the evaluation surfaced
   eight defects in Buddy itself, every one of which affected the commercial
   path identically. A slow, imprecise model is an excellent instrument for
   finding failures that report success.

7. **Tool set:** File tools (read, write, edit, ls, find, grep) + shipped custom
   tools (fetch_url, copy_file, move_file, delete_file, skill tools). No bash.
   All capabilities are Pi SDK custom tools — typed, scoped, auditable.

8. **Cost is reported globally, and the Usage panel answers exactly one
   question (2026-07-28):** spend is aggregated across every provider into a
   single monthly figure — `usage.json` has no provider dimension and must not
   grow one. The user's question is "what is this app costing me", and
   answering it per provider would send them to three billing dashboards to add
   up themselves, which is the work the panel exists to remove. Each provider's
   own console remains the place to reconcile an invoice.

   **The panel answers "what will I be charged" and nothing else.** A proposal
   to show token and message counts beside the currency was rejected the day it
   was written. The argument for it — that `$0.00 / $10.00` after a day on a
   local model "looks broken" — was wrong: that is the accurate answer and, for
   someone paying nothing, the good one. Token counts serve whoever builds the
   app, not the person using it, and a second number the user cannot act on
   competes with the one that matters. Per the target user above: for her it is
   noise.

   **The general rule:** that a datum is already computed and one line from
   being rendered is an argument about implementation cost, not about whether it
   belongs on screen. Anything that does not serve "what will I be charged"
   stays out of the Usage panel.

9. **Global/local split (E11):** Core prompts and the universal system prompt
   base (`agents-base.md`) live in `~/.buddy/prompts/`, not inside rootDir.
   App updates refresh them without touching user content. Instance-specific
   behavior stays in `rootDir/AGENTS.md`. Old instances with `CLAUDE.md` work
   without migration — the base layer overrides stale capability claims.

10. **Boot refresh (E11):** On app version change, bundled global content
   (`~/.buddy/prompts/`, `~/.buddy/docs/`) is redeployed from embedded sources.
   Tracked via `last_app_version` in `config.json`. See below.

11. **The wiki is always on, and it stores plain markdown links (2026-08-02,
   revised 2026-08-10):** the personal knowledge base is the default
   destination for user knowledge (principle 5, NFR-ROUTE-01). It is always
   active — no opt-in toggle, no setup step. The wiki tools (`wiki_search`,
   `wiki_file`) are registered on every interactive session; the structure
   (`user/wiki/`) is bootstrapped on first use, not at setup.

   **The wiki is what makes Buddy's dual role operationally clear:** "save
   this" from the user goes to the wiki; the agent's own learning goes to
   `agent_brain/` during reflect and consolidation. Without the wiki, this
   routing has no structured destination and falls back to loose files.

   **Cost is managed per path, not per feature.** Conversational captures
   ("save this idea") are code-only — no child session, no extra LLM cost.
   Document ingestion (PDFs, articles) spawns a child extraction session on
   the fast tier and shows progress phases (FR-WIKI-08). The original opt-in
   decision (2026-08-02) was reversed because a feature that is off by default
   cannot be the default destination for anything.

   **Storage is relative markdown links, not `[[wikilinks]]`.** The viewer
   (`marked`), the chat autolinker and the relocate-and-rewrite path all
   already understand markdown links and none understands `[[...]]`.

   **Enabling it applies to the next conversation, and the UI says so.** The
   toolset is fixed at `createAgentSession` and Buddy runs one session per
   process, so a setting that silently waits for the next launch reads as
   broken. The setting is offered during setup, where it is free, and in
   Settings with an explicit notice plus a Restart action. What is *not*
   acceptable is registering the tools always and having them refuse when the
   feature is off: a registered tool is an offered tool, and the model will
   reach for it.

   **Storage is relative markdown links, not `[[wikilinks]]`.** The viewer
   (`marked`), the chat autolinker and the relocate-and-rewrite path all
   already understand markdown links and none understands `[[…]]`; supporting
   them on disk would mean a renderer extension plus a second implementation of
   link rewriting, which is how NFR-SEC-16 was earned. Obsidian reads relative
   markdown links natively, so the portability argument does not survive
   either. Wikilinks, if ever wanted, belong in the renderer.

   Acceptance criteria: `specs/SPEC.md` §3.18. Design rationale and rejected
   alternatives are covered in this section; tool specifications are in the
   SPEC.

---

## Boot refresh and migration

The global config directory (`~/.buddy/`) evolves across app releases. A single
semver comparison on boot keeps bundled content current without user interaction.

### Sidecar embedded assets (E12)

At build time, `scripts/generate-embedded-assets.ts` snapshots into a single
TypeScript module (`backends/embedded-assets.generated.ts`):

- `templates/` — initial brain/identity file templates
- `bundled/prompts/` — core skill prompts (agents-base, process-conversation, triage-inbox, consolidation)
- `bundled/docs/` — self-documentation pages (capabilities, privacy, etc.)
- `package.json` version — app semver for boot refresh
- `pdfjs-dist` worker source — `pdf.worker.min.mjs` for PDF extraction in compiled binary

`sidecar-entry.ts` calls `registerEmbeddedAssets()` before booting. At runtime:
- Prompts, docs, and templates deploy to `~/.buddy/` via boot refresh (written to disk).
- The pdfjs worker stays in-process and is materialized to `$TMPDIR/buddy-pdf-worker.mjs` on first PDF extraction (not deployed to user-visible paths).

### Design

```
~/.buddy/config.json  →  last_app_version: "0.4.2"  (app semver last deployed)
```

- **Semver, not integer:** One field tracks what version of bundled content is
  installed. Any app version bump (patch, minor, major) triggers redeploy.
- **Absent = fresh:** No `config.json` or missing `last_app_version` triggers
  deploy on first boot.
- **Future migrations:** One-shot structural changes (e.g. config format rename)
  run inside the same boot refresh by comparing `last_app_version` to a threshold.

### Boot sequence

```
1. Compare app semver with last_app_version in ~/.buddy/config.json
2. If absent or different: deploy bundled prompts/ and docs/; update last_app_version
3. pruneSessionLogs() — NFR-MAINT-01
4. createAgentSession + permission hooks
5. Silent context injection (if message && !skipInjection) — before worker core
6. Warm handoff (first session only) — before worker core
7. createWorkerCore — subscribes for user turns
```

Steps 5–6 must run **before** step 7 to prevent duplicate event forwarding.
First sessions skip step 5 when `personalizationPending` (warm handoff owns greeting).

### Session prompt assembly (two layers)

At session start the worker builds **two separate layers** — not one monolithic system prompt:

```
System prompt (identity + rules — stable for the session):
  1. ~/.buddy/prompts/agents-base.md  (capture rules, core rules, metadata, routing)
  2. rootDir/AGENTS.md (or CLAUDE.md fallback)  (instance state overlay)
  3. rootDir/agent_brain/identity/SOUL.md
  4. rootDir/agent_brain/identity/USER.md
  5. Current date/time

Session context (episodic — hidden first user message, FR-PROMPT-02/04):
  6. logs/index.md
  7. Last session log
  8. Due/overdue deferred items
  9. First-run interview (when USER.md is placeholder)
```

The system prompt defines *who the agent is and how it behaves*. Session context
is *what is happening now* — injected silently before the user's first turn so
it does not compete with identity for model attention.

**Two injection modes (distinct):**
- **`injectSessionContext`:** Fully silent — no-op subscriber, nothing reaches UI. Model response discarded; context sits in history.
- **`injectHiddenPrompt`:** Used for warm handoff — user prompt hidden, assistant events forwarded to UI.

First session with `personalizationPending`: skip context injection; warm handoff only.

Boot refresh runs **before any session starts** — the worker can assume
`~/.buddy/prompts/` and `~/.buddy/docs/` are current before assembling a system
prompt or spawning a consolidation session.

### Deploy contract

The deploy function must be:

- **Idempotent:** re-running produces the correct end state (create-or-overwrite).
- **Silent:** no user interaction required.
- **Fast:** file writes only — no network, no LLM calls.

### Scope boundary

| `~/.buddy/` (global) | `rootDir` (per-instance) |
|---|---|
| Redeployed on semver bump | User/agent content preserved |
| App overwrites bundled content freely | Structural migrations only (with backup) |
| Examples: prompts, docs, config format | Examples: AGENTS.md, agent_brain/, logs/ |

The app does not overwrite user/agent content in rootDir. It may perform
**structural migrations** on specific files when the format changes between
app versions — with backup to `.buddy/migrations/`. `brain-migration.ts` already
does this for USER.md (scaffold missing sections) and AGENTS.md (strip core
instructions that moved to agents-base.md, FR-PROMPT-08). Old instances missing
newer files (e.g., no `AGENTS.md`, only `CLAUDE.md`) are handled by fallback
logic in the worker.

### Why this matters for the future

- **Config format changes:** Compare `last_app_version` and transform old
  `config.json` before the parser runs.
- **New global files:** Any new bundled directory gets created on next version bump.
- **Deprecation:** Old files can be removed by the deploy step on a major bump.
