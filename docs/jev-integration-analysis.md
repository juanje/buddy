# Jev Integration Analysis

Evaluation of TypeSafe AI Jev (System One classifier models) for buddy:
what they are, how they work in Pi, every use case identified, and the
projected impact on efficiency, reliability and cost.

## What Jev is

Jev is a **non-autoregressive decision model**. It does not generate text.
Given a JSON state and a set of typed questions, it returns probability
vectors over predefined answer spaces. Three primitives:

| Primitive | What it returns | Example |
|---|---|---|
| **choice** | Selected key + per-key probabilities + confidence | `{ choice: "bug", probabilities: { bug: 0.94, feature: 0.06 }, confidence: 0.94 }` |
| **score** | Weighted position on an ordinal scale + confidence | `{ score: 3.2, confidence: 0.78 }` |
| **noul** (bool) | Probability of "true" (0.0 to 1.0) | `{ probability: 0.97 }` |

Key properties:
- Sub-second latency (p50 < 250ms, often ~150ms)
- $0.042/M input tokens, $0 output tokens
- 0% schema errors by construction (no text to parse)
- 32K context per query
- Trained with RLCD (Reinforcement Learning for Calibrated Decisions)
- Confidence is calibrated: low confidence genuinely means "I don't know"

## How Jev works in Pi

### Classifier API architecture

Pi's `@earendil-works/pi-ai` package defines a uniform classifier contract:

```typescript
interface ClassifierContext {
    state: JsonObject;                              // the data to judge
    questions: Record<string, ClassifierQuestion>;  // what to decide
}

type ClassifierQuestion =
    | { type: "choice"; instructions: string; criteria: Record<string, string> }
    | { type: "score";  instructions: string; criteria: string[] }
    | { type: "bool";   instructions: string; criteria: { true: string; false: string } };

// Returns:
interface ClassifierResult {
    answers: Record<string, ClassifierAnswer>;
    usage?: Usage;
    stopReason: "stop" | "error" | "aborted";
}
```

Multiple questions in a single request share the same state and are
evaluated in one call. This is what enables the speculative fanout
pattern: 4-5 questions about the same user message cost one request.

### Three classifier APIs

| API | Service | Protocol |
|---|---|---|
| `typesafe-system-one` | TypeSafe (native) and OpenRouter | HTTP REST: `{ state, questions }` → `{ answers, usage }` |
| `cloudflare-workers-ai-system-one` | Cloudflare Workers AI | Same protocol, wrapped in Cloudflare's API envelope |
| `llama-cpp-classify` | Local llama-server | No text generation. Reads next-token log-probabilities |

### How `llama-cpp-classify` works (the local option)

The local classifier does not generate text. It works by reading the
probability distribution over the next token:

1. **Tokenize labels** (A/B/C for choice, 0-9 for score, Yes/No for bool)
   via `/tokenize`. Each label must be a single token.

2. **Render the prompt** via `/apply-template` — applies the model's own
   chat template with thinking disabled.

3. **Request one prediction** via `/completion` with `n_predict: 1` and
   `n_probs: 256+` (pre-sampling, i.e. before the sampler). This returns
   the log-probabilities of the 256+ most likely tokens.

4. **Extract label probabilities** from the top-N, apply softmax with
   temperature, and return the probability distribution.

The model never writes an answer — the classifier reads which label token
the model would emit and how confident it is.

Prompt repetition trick: the state appears twice in the prompt — once
before the questions (the model processes it without context) and once
after (it rereads it with the questions in view). The shared prefix
between questions is cached by llama-server.

### Providers that serve Jev classifiers

- **TypeSafe** (direct) — `TYPESAFE_API_KEY`, native System One protocol
- **OpenRouter** — models with `output_modalities: ["decisions"]`, System
  One via OpenRouter's API
- **Cloudflare Workers AI** — `typesafe/jev` and `@cf/cloudflare/clef`
- **llama.cpp** — any local chat model is automatically exposed as a
  classifier via `toPiClassifierModel()`

### How buddy would call it

Buddy already has `ModelRuntime` from pi-coding-agent. The `classify()`
method exists on `ModelRegistry`:

```typescript
const jevModel = modelRegistry.findOfType("classifier", "typesafe", "jev-latest");
const result = await modelRuntime.classify(jevModel, {
    state: { message: userMessage, recentContext: lastThreeExchanges },
    questions: {
        category: {
            type: "choice",
            instructions: "What kind of message is this?",
            criteria: {
                context: "Passive context sharing, no action needed",
                task: "A specific task or request",
                project: "A multi-step initiative",
                chat: "Casual conversation"
            }
        },
        hasDeadline: {
            type: "bool",
            instructions: "Does the message contain an explicit date or deadline?",
            criteria: { true: "Contains a date or deadline", false: "No temporal commitment" }
        }
    }
});
```

No new dependencies beyond updating pi-coding-agent. The classifier API
is already part of `ModelRuntime`.

---

## Identified use cases

### Real-time (during conversation)

#### 1. Speculative fanout

A single Jev call (~150ms) with multiple questions before the LLM sees
the message: category (choice), has deadline? (noul), is direct capture?
(noul), is passive context? (noul).

**Today:** The LLM evaluates everything together in its long system
prompt. Every turn pays the full prompt cost.

**With Jev:** The worker knows what kind of turn it is before calling the
LLM. If it is pure context (~20-30% of turns), it can index it without
an LLM turn at all.

**Pattern:** Pre-filter. **Value:** Latency and cost.

#### 2. Confidence-gated clarification

Use Jev's confidence as a deterministic threshold for "should I ask the
user or act?"

**Today:** A verbal rule in the prompt says "if you see tasks but the
user didn't explicitly ask to capture them, ask." The LLM applies this
inconsistently.

**With Jev:** `if (taskProbability > 0.45 && taskProbability < 0.85) askUser()`.
Deterministic, auditable, identical behavior every time.

**Pattern:** Deterministic guard. **Value:** Reliability.

#### 3. Model routing

Classify the user's message as simple or complex to choose a fast/cheap
model or a slow/powerful one.

**Today:** Does not exist. Buddy always uses the same model.

**With Jev:** Simple greetings, factual questions, and passive context
go to a fast model. Complex requests go to the full model.

**Pattern:** Enrichment. **Value:** Cost.

#### 4. Connector data triage

Classify Jira/Slack items by relevance and type before the LLM processes
them.

**Today:** Everything passes through the LLM.

**With Jev:** Only relevant items reach the LLM. The eval showed $0.10
for 1,721 classifications.

**Pattern:** Pre-filter. **Value:** Cost and tokens (up to ~70% reduction
in connector token usage).

### Reflect (post-session)

#### 5. Completion guard

"Did the user explicitly confirm that this task was completed
successfully during this session?"

**Today:** A rule in `process-conversation.md` says "mentioned ≠
completed. Only mark [x] if the user explicitly confirmed the outcome."
LLMs confuse mention with resolution in long prompts.

**With Jev:** Noul with threshold ≥0.95. Only code can mark `[x]`. The
instruction that the LLM can forget becomes a check the worker always
runs.

**Pattern:** Deterministic guard. **Value:** Reliability. This prevents
the most user-visible failure mode: tasks marked done that are not done.

#### 6. Correction/rule detection

"Is this user turn a corrective instruction about the assistant's
behavior?"

**Today:** The LLM looks for evolution signals across the entire
conversation at reflect time.

**With Jev:** Pre-filter that only flags high-probability corrections.
Reduces noise in `observations.md`.

**Pattern:** Pre-filter. **Value:** Reliability (fewer false observations).

#### 7. Skill detection

"Does this procedure have 3+ sequential, reusable steps?"

**Today:** Same LLM that processes the session decides.

**With Jev:** Cheap pre-filter that only escalates to the LLM the
candidates with high probability.

**Pattern:** Pre-filter. **Value:** Cost.

### Consolidation

#### 8. Novelty test

"Does this lesson add decision power beyond its parent concept?"

**Today:** The LLM evaluates this inside a long consolidation prompt
(~4,300 words / ~5.7K tokens).

**With Jev:** An isolated noul with the parent concept + candidate in
the state. More reliable than the same question buried in a massive
prompt.

**Pattern:** Pre-filter. **Value:** Reliability and cost.

#### 9. Functional links

"Would a reader of file A benefit from knowing about file B?"

**Today:** The LLM evaluates file pairs during consolidation.

**With Jev:** Batch noul comparisons over candidate pairs. Scales better
with large wikis.

**Pattern:** Pre-filter. **Value:** Cost (O(n²) but each pair costs
~$0.00006).

#### 10. Mature observation classification

Classify mature observations (seen 2+ times) as Skill / Rule / Concept /
Structure.

**Today:** The LLM classifies in a consolidation step.

**With Jev:** A 4-option choice is Jev's strong suit. The eval showed
0.91+ confidence with zero misclassifications over 1,721 files.

**Pattern:** Deterministic guard. **Value:** Reliability.

#### 11. Semantic deduplication

"Do these two observations say the same thing in different words?"

**Today:** The LLM reads all observations and decides.

**With Jev:** Pairwise noul comparisons. Each pair ~$0.00006.

**Pattern:** Pre-filter. **Value:** Cost and consolidation quality.

#### 12. Staleness scoring

"Is this wiki content obsolete based on its substance?"

**Today:** Only Hebbian counters (access_count, last_accessed). No
content-based evaluation.

**With Jev:** A second axis: obsolescence by content, not just by usage.
The eval showed score calibrates well for staleness (genuinely obsolete
file scored 0.36 correctly).

**Pattern:** Enrichment. **Value:** New capability.

#### 13. Orphan cluster detection

"Do these 3+ untagged tasks share a common objective?"

**Today:** The LLM evaluates during weekly review.

**With Jev:** Pre-filter noul before proposing a project to the user.

**Pattern:** Pre-filter. **Value:** Cost.

#### 14. Workspace maturity

"Is this draft ready for the wiki?"

**Today:** The LLM evaluates during weekly review.

**With Jev:** Quantitative evaluation of completeness and stability via
score + noul.

**Pattern:** Enrichment. **Value:** New capability.

### Validation / quality gate

#### 15. Post-consolidation check

"Is the consolidated result coherent with the original material?"

**Today:** Does not exist. The system trusts the LLM got it right.

**With Jev:** Cheap verification without spending another chat model
turn.

**Pattern:** Deterministic guard. **Value:** Reliability.

#### 16. Wiki ingest pre-classification

"Does this document deserve to enter the wiki?"

**Today:** Heuristics in `brain-health.ts` (structural, not semantic).

**With Jev:** Semantic content evaluation via noul + score.

**Pattern:** Pre-filter. **Value:** Reliability.

#### 17. Audience filter

"Is this personal or shareable with the team?"

**Today:** Trust zones are structural (path-based), not semantic.

**With Jev:** Post-write gate based on content analysis.

**Pattern:** Enrichment. **Value:** New capability.

---

## Three patterns

The 17 use cases group into three patterns:

**Pre-filter** (1, 4, 6, 7, 8, 9, 11, 13, 16) — Jev decides whether
something deserves the LLM's attention. Value: cost and speed.

**Deterministic guard** (2, 5, 10, 15, 17) — Jev replaces a verbal rule
in a prompt with a numeric threshold in code. Value: reliability. These
have the highest impact because they convert instructions the LLM can
forget into checks the worker always executes.

**Enrichment** (3, 12, 14) — Jev provides a signal that does not exist
today. Value: new capability.

---

## Projected impact

Estimates based on an active buddy user: ~5 sessions/day, ~8 turns/session,
1 depth-1 consolidation/day, 1 depth-2/week, 1 depth-3/month.

### Latency

| Moment | Today | With Jev | Improvement |
|---|---|---|---|
| First token of a conversational turn | 1-3s (LLM processes full ~5K token prompt + context) | Speculative fanout (~150ms) decides if the turn needs the LLM. If pure context (~20-30% of turns), it indexes without the LLM | 20-30% of turns resolved in <200ms instead of 1-3s |
| Clarification question | 1-3s (LLM generates the question) | Worker detects ambiguity in <200ms and fires the question from code | Question appears ~1s earlier |
| Reflect (post-session) | 5-15s (LLM processes entire conversation) | Completion guard + rule detection in ~300ms pre-filter. LLM receives only relevant fragments | ~30% less context for reflect to process |
| Consolidation depth-1 | 30-90s (LLM reads logs + wiki) | Novelty test + deduplication + classification pre-filter candidates. LLM processes less material | ~20-40% time reduction depending on observation volume |

In a session of 8 turns, 2-3 would resolve without waiting for the LLM.
The user perceives buddy as faster on simple interactions.

### Token usage

| Flow | Tokens/day today (est.) | With Jev | Saving |
|---|---|---|---|
| Conversation (5 sessions × 8 turns) | ~200K input + ~50K output | ~160K input + ~40K output | ~20% |
| Reflect (5 sessions) | ~75K input + ~15K output | ~55K input + ~12K output | ~25% |
| Consolidation depth-1 (1/day) | ~100K input + ~20K output | ~65K input + ~15K output | ~30% |
| Consolidation depth-2 (1/week, prorated) | ~30K/day input | ~20K/day input | ~30% |
| Connector triage (if using Jira/Slack) | ~50K input | ~15K input | ~70% |
| Jev itself | 0 | ~30-50K input/day | Added |

**Daily balance:**
- Today: ~455K input tokens/day to the LLM
- With Jev: ~315K input to LLM + ~40K input to Jev
- **Net saving: ~100K LLM tokens/day (~22%)**

### Reliability

This is the most important impact. It is not measured in percentages but
in **classes of failure that stop happening**:

| Failure | Frequency today | With Jev |
|---|---|---|
| Task marked completed without explicit confirmation | Sporadic but destructive | **Eliminated.** Completion guard with threshold ≥0.95 is deterministic |
| Noisy observations in observations.md | Frequent | **Reduced ~50%.** Noul pre-filter discards ambiguous corrections before writing |
| Inconsistent clarification questions — sometimes asks, sometimes acts | Frequent | **Eliminated.** Numeric threshold in code: `confidence < 0.75 → ask`. Predictable and auditable |
| Duplicate concept in the wiki | Occasional | **Reduced.** Isolated novelty test + pairwise deduplication before the LLM drafts |
| Tasks created without user intent | Occasional | **Reduced.** Speculative fanout detects "context without action demand" |
| Consolidation processing irrelevant material | Always | **Reduced.** Pre-filters send only high-probability candidates |

The deterministic guard cases (#2, #5, #10) eliminate LLM variability
in binary decisions. This is a qualitative change: buddy goes from
"probably gets it right" to "always behaves the same way."

### Cost

| Item | Today | With Jev | Difference |
|---|---|---|---|
| Chat LLM (e.g. Sonnet at $3/M in, $15/M out) | $0.61 + $0.75 = **$1.36/day** | $0.47 + $0.60 = **$1.07/day** | **-$0.29/day** |
| Jev ($0.042/M in, $0 out) | $0 | ~40K tokens × $0.042/M = **$0.002/day** | +$0.002/day |
| **Balance** | **$1.36/day** | **$1.07/day** | **-$0.29/day (-21%)** |
| **Monthly** | **~$41/month** | **~$32/month** | **-$9/month** |

Jev's cost is negligible ($0.06/month). The saving comes from sending
fewer tokens to the expensive LLM. If buddy uses a cheaper model for
some turns via routing (#3), the saving increases further.

### Summary

| Dimension | Impact | Most valuable case |
|---|---|---|
| Latency | 20-30% of turns resolved in <200ms | Speculative fanout — the user feels buddy "thinks less" |
| Tokens | ~22% fewer LLM tokens/day | Connector triage and consolidation pre-filters |
| Reliability | 3 failure classes eliminated, 3 reduced | Completion guard and confidence-gated clarification — replace variability with determinism |
| Cost | ~21% less (~$9/month for active use) | Byproduct of token savings; Jev itself is nearly free |

The dominant benefit is **reliability**, not cost. $9/month is pleasant
but not transformative. Buddy no longer marking tasks as done without
confirmation, or always asking the user with the same criteria — that
changes the experience.

---

## Integration path

### Option 1: Jev cloud via Pi providers (recommended start)

**Effort:** 2-3 days.

Buddy already has `ModelRuntime` from pi-coding-agent. After updating to
v1.0.0, `classify()` is available. Steps:

1. Update `pi-coding-agent` to `^1.0.0`
2. Configure TypeSafe or OpenRouter authentication in buddy's provider
   setup
3. Add a `ClassifierService` module in `backends/` that wraps the
   `classify()` call with buddy's question templates
4. Wire the service into the points where decisions happen (worker event
   handling, reflect, consolidation)

**Pros:** No new infrastructure. Sub-second. Nearly free.
**Cons:** Requires internet. Adds a cloud dependency.

### Option 2: Local llama-cpp-classify

**Effort:** 1-2 weeks.

Pi already includes `createLlamaProvider()` which automatically exposes
every chat model on a local llama-server as a classifier. Steps:

1. Register the `llama.cpp` provider in buddy's `ModelRuntime`
2. User configures `LLAMA_BASE_URL` pointing to their llama-server
3. Any loaded model (Qwen3-8B, Llama-3.3-8B, etc.) works as a classifier

**Pros:** Offline. Free. 50-200ms latency. User controls their data.
**Cons:** Requires user to run llama-server. GPU needed for good
performance. UX of "configure your local server" is complex for
non-technical users.

### Option 3: Bundled llama-server

**Effort:** 3-4 weeks.

Buddy launches and manages a llama-server process as a sidecar,
including model download and lifecycle.

**Pros:** Fully self-contained. Best UX.
**Cons:** Binary size increase. GPU detection. Model download UX.
Platform-specific builds (CPU/GPU/Metal).

### Recommended approach

Start with **Option 1** (Jev cloud) to validate the use cases with real
users. If latency, cost, or privacy concerns arise, add **Option 2** as
an alternative backend — the `ClassifierService` abstraction makes the
switch transparent. Option 3 only if buddy targets offline-first users.

---

## Design lessons from the eval

An eval of Jev over 1,721 real files (Sep 2026) produced these lessons
that apply to any integration:

1. **Do not ask what the model cannot know.** The eval's
   `correctDestination` question asked "is this the right directory?"
   without providing buddy's directory conventions. Jev classified
   content accurately but could not validate conventions it had never
   seen. Every Jev question in buddy must include the necessary context
   in the state.

2. **Choice is excellent for categorization.** Zero misclassifications
   over 1,721 files, 0.91-1.0 confidence. Use it for content type,
   observation category, message routing.

3. **Score needs enough levels.** 3 levels are too few — most files
   clustered at 1.3-1.8. Use 5+ levels for meaningful discrimination.

4. **Noul is reliable when the question is self-contained.** The
   completion guard ("did the user explicitly confirm?") is a well-posed
   noul: all the evidence is in the state.

5. **Confidence calibration is real.** Jev says "I don't know"
   (0.17-0.55) instead of guessing confidently. This makes the
   confidence-gated pattern viable: low confidence → fall back to the
   LLM or ask the user.

6. **Convention-based routing is orthogonal to content classification.**
   If the decision depends on where something is (path-based), Jev adds
   nothing. If it depends on what something says (content-based), Jev
   adds a lot. All 17 use cases above are content-dependent by design.

---

## Priority order for implementation

Ranked by effort-to-impact ratio:

1. **Completion guard** (#5) — prevents the most user-visible failure
2. **Speculative fanout** (#1) — improves every session's perceived speed
3. **Confidence-gated clarification** (#2) — most annoying UX inconsistency
4. **Mature observation classification** (#10) — Jev's proven strong suit
5. **Connector triage** (#4) — biggest token saving for Jira/Slack users
6. **Novelty test** (#8) — improves consolidation quality
7. **Correction/rule detection** (#6) — reduces observation noise
8. **Semantic deduplication** (#11) — cleaner wiki over time
9. **Model routing** (#3) — cost saving, less impactful than reliability
10. **Staleness scoring** (#12) — new capability, lower urgency
11-17. Remaining cases — valuable but lower priority
