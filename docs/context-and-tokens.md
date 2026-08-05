---
created: 2026-08-03
---

# Context, Tokens, and Determinism

How Buddy's design decisions reduce token usage, delay context-window
exhaustion, cut cost, and make agent behavior more reliable — especially on
small or local models.

Companion to [app-design-principles.md](app-design-principles.md), which
records *what* was decided and why. This document traces the *consequences* of
those decisions on tokens, context space, and reliability.

Every number is labeled **measured** or **modeled**. Modeled figures are
order-of-magnitude estimates from stated assumptions, not benchmarks.

---

## Two impacts of every token

Every token that enters the context window has two costs:

1. **Money (or compute).** You pay for every token the model processes. Prompt
   caching and smart prompt layout can reduce this — cached input is ~10× cheaper
   to re-process.
2. **Context space.** The context window is finite. Every token in it — cached or
   not — takes up room. When it fills, **compaction** fires: an extra LLM call
   that loses detail. On a small window (32k) this happens fast; on a large one
   (200k–1M) it rarely matters.

The design decisions below reduce both: fewer tokens means lower cost *and* more
room in the window. The gains are proportionally larger on small windows, where
space is the binding constraint.

---

## Owning the harness

agentic-buddy ran inside Cursor or Claude Code — tools built for *programming*.
A coding harness loads its own infrastructure before your task begins: system
prompt, tool schemas, MCP servers, user skills, auto-loaded memory, custom
agents. You do not opt into this; it is the cost of being a guest.

**Measured — a real Claude Code session** (this document's session; 1M window):

| Component | Tokens | Notes |
|---|---|---|
| System tools | 8.5k | bash, edit, read… schemas |
| MCP tools | 8.3k | loaded subset of **74** MCP tools |
| Skills | 4.5k | user's registered skills |
| System prompt | 3.8k | harness prompt, coding-oriented |
| Memory files | 2.8k | harness's own auto-loaded memory |
| Custom agents | 0.4k | subagent definitions |
| **Total loaded** | **~28.3k** | **before a single message** |
| *(deferred, available)* | *+35.8k* | tool schemas held back to protect context |

Buddy owns the entire prompt via the Pi SDK
(`DefaultResourceLoader({ systemPromptOverride })`) and the entire toolset
(`excludeTools: ["bash"]` plus typed custom tools). Like-for-like:

| Category | Claude Code (measured) | Buddy (modeled) |
|---|---|---|
| System prompt | 3.8k | ~5k (agents-base + AGENTS + SOUL + USER) |
| Tool schemas | 16.8k (system + MCP) | ~2.5k (~13 typed tools) |
| MCP / skills / harness memory | 15.6k | **0** |
| **Structural total** | **~28.3k** | **~7.5k** |

Adding task payload (episodic memory injection, ~8k in both):

| | Structural | + episodic | **Startup total** |
|---|---|---|---|
| agentic-buddy (Claude Code) | ~28.3k | ~8k | **~36k** |
| Buddy (Pi SDK) | ~7.5k | ~8k | **~15.5k** |

### What this means per window size

| Window | agentic-buddy (~36k) | Buddy (~15.5k) |
|---|---|---|
| **1M** (cloud) | 3.6% — invisible | 1.5% |
| **200k** (cloud) | 18% | 7.8% |
| **32k** (local) | **113% — does not fit** | **48%, ~16.5k free** |

On a million-token window, nobody notices. On 32k, agentic-buddy's harness
stack overflows the window before a single message. Owning the harness is the
precondition for local models, not an optimization on top.

---

## Where the tokens go, mechanism by mechanism

Each mechanism moves work out of the model and into code, reducing tokens and
window usage.

### Code-side scans instead of model reads

Promotion/demotion, index building, and brain-health checks need per-file
metadata. The old approach had the model read frontmatter from dozens of files
iteratively. The worker now precomputes a digest and injects it.

- **Modeled:** 100 headers × ~60 tok = ~6k input (spread over ~100 reads) → a
  ~1.5k digest delivered once. Saves ~4.5k per consolidation cycle.
- On 32k that is ~20% of the window spent *gathering metadata* before thinking.

### copy/move via code, not read-then-write

Without bash, the only way for a model to "move this file there" is to read the
whole file into context, then write it back out. This is the normal pattern for
text files — notes, markdown, code — which a coding assistant handles via
read + write, not shell commands. `copy_file` / `move_file` do it at the
filesystem level — zero tokens.

- **Modeled — a long note (~3k words):** read ≈ 4k input + write ≈ 4k output =
  ~8k tokens. With copy_file: **0 tokens**. A longer document (12k+) doubles
  the impact.
- On 32k with a ~15.5k startup, a single large file move can consume half the
  remaining runway or overflow the window entirely.
- At ~14–17 tok/s local decode (measured; varies by model/quantization), 4k
  output = ~4–5 minutes of waiting just to copy a file.

### Markdown conversion of URLs and PDFs

`fetch_url` converts web pages to markdown; PDFs are extracted to text locally.

**Web pages:**
- **Modeled:** raw HTML (nav, scripts, styles, ads) ≈ 30–80k tokens; markdown
  extract ≈ 2–5k — a **10–20× reduction**.
- On 32k, raw HTML overflows on its own; markdown fits with room to spare.

**PDFs:** most coding assistants send PDFs directly to the model as images
(one image per page), relying on vision. Buddy extracts the text to markdown
instead.

- **Per page (from provider docs):** PDF-as-image costs 500–3,000 tokens/page
  depending on the provider (Claude ~1.5–3k, GPT-4o ~1–2k, Gemini ~0.5–1.2k).
  Markdown extraction costs ~300–800 tokens/page — a **~3–5× reduction**.
- **A 10-page report:** PDF direct ≈ 15–30k tokens; markdown ≈ 5–8k.
- On 32k, a 10-page PDF sent as images can consume the entire window. As
  markdown it fits comfortably.
- Local models typically have **no vision**, so text extraction is what makes
  PDFs processable at all, not merely cheaper.

### Session fork instead of transcript analysis

The reflect child forks the live session ("the fork IS the context") — no
transcript reload, no system prompt re-injection. Fires only on compaction
(0–2 per session), not every N turns.

- **Modeled:** periodic checkpoint approach ≈ 4 calls × ~20k ≈ 80k tokens per
  long session. Fork: near-zero additional tokens.

### Skills as tools, not files the model reads

Core skills are registered as zero-input custom tools. The worker returns the
prompt text only when invoked — the skill body is never resident otherwise.

- Previously: the model issued a read call to load a skill file (~3–4k tokens
  each), and was told not to read them preemptively (a rule it sometimes broke).

### No git / mkdir / date tool calls

Commits, directory creation, and the current date are handled by the worker.
The model no longer emits these.

- **Modeled:** ~1–2k of tool I/O saved per session. On local, each avoided call
  is also one fewer round-trip at 17 tok/s. Removes a variance source too: the
  model can no longer compose git commands wrong and retry.

### Maintenance in a separate session

Consolidation runs in its own Pi session — **zero tokens of the conversation
window**. In agentic-buddy, `/daily` ran in the same chat, competing with the
conversation for window space.

---

## Time-to-compaction

How many turns before a 32k window fills and compaction fires?

**Assumptions (modeled):** window 32k, compaction at ~28k, startup equal at ~13k
(conservative — agentic-buddy's real startup is ~36k). Runway ≈ 15k.

| Turn type | Buddy | agentic-buddy |
|---|---|---|
| Capture | ~0.4k | ~0.7k (+git-commit turn) |
| Retrieval | ~1.0k (digest + 1 file) | ~3.0k (multi-file reads) |
| Summarize a URL | ~3.4k (markdown) | ~15k+ (raw HTML) |
| Ingest a 10-page PDF | ~5–8k (text extraction) | ~15–30k (vision, images) |
| Move a text file | ~0.2k (copy_file) | ~8k (read+write a ~3k-word note) |
| Maintenance cycle | 0 (separate session) | ~4–8k (same session) |

| Scenario | Buddy | agentic-buddy | Factor |
|---|---|---|---|
| Light (capture + retrieval) | ~21 turns | ~8 turns | ~2.5× |
| Mixed (includes URL + file move) | ~17 turns | ~5–6 turns | ~3× |
| Move a long document | fits (0.2k) | ~8–24k (scales with length) | n/a |

Each compaction event on a local model means: an extra LLM call at ~14–17 tok/s,
lost detail, and a small model that starts to lose track of the session.

---

## Reliability and determinism

Fewer tokens and reliable behavior are the same design decision from two angles:
**work the model never does is work it cannot do wrong.**

### Deterministic tasks moved to code

Each of these was a natural-language rule in agentic-buddy that failed silently:

- **Hebbian tracking** never recorded a single access because the event carried
  no path. The rule to "count accesses" was inert if nothing counts.
- **Whole-file rewrite corruption:** a local model that failed 8 `edit` calls
  rewrote a file whole, resetting `access_count` 7→1. The worker now captures
  metadata before and restores after, model-independently.
- **Phantom consolidation:** a 401 surfaced as an empty success in 22 ms,
  advanced the maintenance clock, and wrote "cycle completed" into a file
  re-injected every session. The worker now verifies duration and artifacts
  instead of trusting reported success.
- **Commits, indexing, dates, directory creation:** all in the worker. They
  happen every time regardless of what the model remembers.

### Fewer tools, better choices

~90 tools in a coding harness (74 MCP + system) is not just token cost — it is
decision surface. A model offered ~90 mostly-irrelevant tools picks wrong more
often than one offered ~13 scoped, typed tools. Fewer tools = higher
tool-choice accuracy.

### No cross-contamination

A coding harness auto-loads its own memory and user skills — content for
*other projects* that bleeds into the memory assistant's behavior. Buddy's
context contains only Buddy's data.

### No competing frame

A coding harness primes "you are a coding agent." Buddy's task is the opposite.
In agentic-buddy the base prompt had to override stale capability claims — an
overlay fighting the dominant frame. Small models drift toward the dominant
frame more than frontier models, so this matters most where it is hardest.

---

## Why this matters most for small and local models

Every improvement above bends the same way, steepest where the margin is
thinnest:

- **Small window (32k):** the harness stack that is 2.8% of 1M is 113% of 32k.
- **Slow decode (~14–17 tok/s measured):** output tokens avoided = wall-clock time
  returned to the user.
- **Weaker instruction-following:** a 12B model told "be a coding agent" in the
  system prompt and "actually be a memory assistant" in an overlay drifts toward
  the dominant frame. An owned, clean prompt helps the small model
  disproportionately.
- **Confabulated completion:** the disqualifying local failure is claiming a
  write happened when no tool ran (measured). The design answers it by moving
  exactly what the model confabulates — commits, metadata, completion records —
  into code that cannot lie.

The result: **harness efficiency substitutes for model size.** A lean context
and owned prompt let a small model do work that would otherwise demand a larger
model or cloud window.

---

## The upward effect: optimizing for the smallest model improves all models

Designing for local/small models is not a concession — it is a quality lever.

**Larger models get the same gains for free.** Every token saved, every
deterministic task moved to code, every tool removed from the decision surface
benefits a frontier model too: lower cost, faster responses, fewer
hallucinations. The optimizations are not "compatibility hacks" for weak
models — they are good design that small models *demand* and large models
silently reward.

**Small models expose problems that large models hide.** A frontier model will
work around a bloated context, a competing frame, or a 90-tool decision surface
— it just costs more and occasionally drifts. A 12B model fails visibly: it
confabulates completions, picks the wrong tool, loses the session mid-task.
Every defect in the "Reliability and determinism" section above was discovered
*because* a local model made it obvious. The Hebbian tracking that never
recorded, the phantom consolidation, the whole-file rewrite — a frontier model
masked these with graceful degradation. The local model turned silent
degradation into loud failure, and the fixes improved every model.

**The small model is the canary.** If the design works on 32k at ~14–17 tok/s with
a 12–27B model, it works everywhere — and every inefficiency found at that scale
is an inefficiency that was also present, just invisible, on the cloud path.

---

## Measured vs modeled

**Measured:**
- Claude Code structural overhead: ~28.3k loaded (+35.8k deferred), 74 MCP
  tools, 1M window — live session breakdown.
- Episodic context injection: ~17.7k tokens (FR-CHAT-13).
- Local decode: ~17 tok/s (Gemma 12B, 8-bit); ~14 tok/s (Qwen 27B, 4-bit).
  Confabulated-completion failure mode (app-design-principles.md §"LLM
  providers").
- Local context window: 32,768 (SPEC §3.23).
- Buddy structural overhead: ~7.5k (modeled) confirmed at ~9.2k startup on
  fresh instance (structural + minimal episodic).
- Tool choice accuracy: 18/18 correct (Qwen 27B session, 13 available tools).
- Reliability defects: FR-HEBB-06/07, FR-CONSOL-12 — dated incidents.

**Modeled:**
- Per-turn token costs and time-to-compaction turn counts.
- HTML→markdown (10–20×) and PDF-per-page token ratios.
- copy/move savings (~24k/document), per-session tool-call savings.
- Buddy structural overhead (~7.5k) — estimated, not instrumented.

**What would make these real:** adding input/output/cached splits and a
conversation-vs-maintenance dimension to `usage.json` would turn modeled
figures into measured per-instance profiles.
