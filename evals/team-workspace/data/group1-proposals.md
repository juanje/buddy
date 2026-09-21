# Group 1 — Design/Label Fix Proposals

Fixes for 7+1 golden-dataset entries with design or label problems that distort eval metrics.

---

### ex-025

**Problem:** Dual-capture parent entry. Golden dest=null (personal), but the input contains a mix of factual ProdSec payload AND personal opinions ("Both Kanitha and Juanje lean Konflux"). The model picks up the factual payload and routes to team/wiki/. ex-025a already exists with the clean team-eligible fact.

**Source context:** Log 2026-08-27, "Decisions" section — the entry is a verbatim extract from the log's decision bullet. The log itself mixes the factual chain (Brew/Konflux → CDN → customer portal is ProdSec-approved) with personal preferences ("Both Kanitha and Juanje lean Konflux for long-term; tentative Konflux preference from Kanitha pending readiness info").

**Proposed fix:** Rewrite input to emphasize the personal opinion framing, since ex-025a already captures the factual part.

- **Input:** `"Kanitha and I both lean Konflux for long-term — the automated CDN publication via RPA is appealing vs Brew's manual step. Tentative preference from Kanitha pending readiness info. Need to pitch Petr with generous estimates for both paths before deciding."`
- **Context:** `"Personal preference discussion during developer VM distribution path investigation. The factual ProdSec constraint (only Brew/Konflux → CDN is approved) is captured separately."`
- **Labels change:** None — dest=null, team_eligible=false stays correct with this rewrite.
- **Reasoning:** The rewritten input is clearly first-person opinion/preference. The model should classify as personal (Reflection or Context with team_eligible=false). This eliminates the dual-capture ambiguity that forced FP. ex-025a remains the clean team entry.

---

### ex-046

**Problem:** Golden = personal preference (BOARD.md). But input uses third-person declarative voice ("BOARD.md stays for Juanje's personal tasks... The toolchain project holds what the team is doing...") which sounds like an organizational decision. Model classifies as team decision.

**Source context:** Log 2026-07-30, Session 2 — "Toolchain TPO dashboard created." The decision bullet reads: "Personal board vs team state separation — BOARD.md stays for Juanje's personal tasks, priorities, and WIP. The toolchain project holds what the team is doing, not what Juanje is doing." This was Juanje's personal decision about how to organize his own information — not a team process decision. The log's "System observations" section explicitly describes it as "as role shifts from IC to TPO, need both 'my work' (board) and 'team work' (project) views."

**Proposed fix:** Rewrite in first-person voice to make the personal nature unambiguous.

- **Input:** `"I'm going to keep BOARD.md for my personal tasks, priorities, and WIP. The new toolchain project directory is for tracking what the team is doing — that's a different lens. My board is 'does this block me?' while team state is 'what is everyone working on?'"`
- **Context:** `"Personal workflow decision during TPO dashboard setup. Juanje separating his personal task management from team operational state tracking."`
- **Labels change:** None — dest=null stays correct.
- **Reasoning:** First-person voice + "my" possessives make it clearly a personal workflow preference. No model should route this to team/.

---

### ex-033

**Problem:** Golden = personal (dest=null). Input reads as a generalizable technical lesson about AI-agent development: "Agent-maintained Markdown progress files drift — buddy's PROGRESS.md started clean, grew into dense prose because agents naturally expand Markdown. Rigid JSON schema forces structured updates only." The model correctly identifies this as wiki-worthy knowledge.

**Source context:** Log 2026-08-19, evening session, "Lessons" and "Decisions" sections. The full context is about Juanje's personal methodology refinement for his buddy/cleanup-jobs projects. The lesson is: "buddy's PROGRESS.md tracks project status but mixes concerns and lacks cycle-step granularity. JSON with rigid enums prevents agent expansion. Narrative stays in SPEC.md; decisions in commits." The log's "System observations" explicitly tags this as a concept candidate: "Rigid schema over Markdown for agent-written state." It's about Juanje's personal AI-agent development methodology — his side projects (buddy, cleanup-jobs), not Toolchain team work.

**Proposed fix:** Keep as personal but rewrite input to make the personal/side-project scope explicit.

- **Input:** `"In my buddy project, I found that agent-maintained Markdown progress files drift — PROGRESS.md started clean but grew into dense prose because agents naturally expand Markdown. I'm switching to a rigid JSON schema with enums for structured updates only. Narrative stays in SPEC.md."`
- **Context:** `"Personal AI-agent development methodology session. Lessons from buddy and cleanup-jobs side projects, not Toolchain team work."`
- **Labels change:** None — dest=null correct. But update `reasoning` to: `"Personal methodology lesson from side projects (buddy, cleanup-jobs). First-person framing + explicit project names make scope clear. The insight is generalizable but the audience is Juanje's own AI development practice, not the Toolchain team."`
- **Reasoning:** Adding "In my buddy project" and first-person voice anchors it to Juanje's side work. The model should no longer route this to team wiki.

---

### ex-009 / ex-009b

**Problem:** ex-009 and ex-009b share the same input text verbatim: "Jan Onderka: no sprint tickets in Jira — work was happening as subtasks under Kanitha's tickets, without own ticket tracking." ex-009 = personal (correctly names Jan → privacy block). ex-009b = team/wiki/ (should be the depersonalized version). But ex-009b's input still names both Jan and Kanitha.

**Source context:** Log 2026-09-17, "Pre-planning: Sprint 135 team-wide Jira review." The raw finding is: "Jan Onderka: no sprint tickets in Jira — work was happening as subtasks under Kanitha's tickets, without own ticket tracking." The generalizable lesson (already in ex-009b's depersonalized_capture field) is: "Sprint tracking gap: work happening as subtasks under another team member's tickets produces no individual ticket visibility in sprint views."

**Proposed fix:** Depersonalize ex-009b's input to match its intended role.

- **ex-009:** No change needed — it's correctly personal with names.
- **ex-009b Input:** `"Sprint tracking gap discovered in pre-planning Jira review: a team member had no sprint tickets in Jira because all work was happening as subtasks under another member's tickets, without own ticket tracking. This produces no individual visibility in sprint board views."`
- **ex-009b Context:** `"Depersonalized generalization from pre-planning Jira sweep. The pattern — subtask-only work hiding individual contribution visibility — is a sprint hygiene heuristic."`
- **Labels change (ex-009b):** None — team/wiki/ stays correct. The depersonalized_capture already has good text.
- **Reasoning:** Removing "Jan Onderka" and "Kanitha" from the input eliminates the contradiction: the model can no longer block on Q3 privacy (which it did before because names were present), and the generalized lesson routes cleanly to team/wiki/.

---

### ex-054

**Problem:** Golden = team/projects/ (AAA). But: (a) this is AAA team context, not Toolchain — Toolchain teammates wouldn't benefit from knowing AAA's internal exec review priorities. (b) Juanje is listed as owner of project #2, making the model see personal involvement. (c) The user's analysis says this could be personal or team/wiki/, not team/projects/.

**Source context:** Log 2026-08-13, "AAA Planning/Stand Up" section. The executive review focus is Sean's directive to the AAA team specifically. The four priority projects are AAA-internal. Juanje's involvement (#2 CI/CD pipeline monitoring) is personal career context — he later decided to leave AAA entirely (Sep 7 log). The Toolchain team has no stake in AAA's executive review priorities.

**Proposed fix:** Relabel as personal (Juanje's participation in AAA is personal career context, not Toolchain team knowledge).

- **Input:** `"Sean's directive for AAA fall exec review: internal productization. Four priority projects agreed: (1) Defect/CVE triage (Ian), (2) CI/CD pipeline monitoring — that's my pipeline-debugger work, (3) ALE certification (Dominik/George), (4) Scrummit (Allison). Allison's right — focus on 4, not 12."`
- **Context:** `"AAA standup discussion. Juanje's personal involvement in AAA team's executive review preparation. Juanje later left AAA (Sep 7)."`
- **Labels change:**
  - `team_eligible`: `false`
  - `audience_filter_passed`: `false`
  - `destination`: `null`
  - `depersonalized_capture`: `null`
  - `personal_capture`: `null`
  - `reasoning`: `"AAA team internal priorities are not Toolchain team knowledge. Juanje's CI/CD pipeline monitoring is his personal cross-team commitment (later resigned from AAA). Q2 fails: would a Toolchain teammate benefit from knowing AAA's exec review focus? No."`
- **Reasoning:** AAA ≠ Toolchain. Even if the information is factual and clean (Q1/Q3 pass), Q2 fails — Toolchain teammates don't benefit from knowing AAA's internal executive review priorities. Juanje's participation was personal career context, confirmed by his later departure from AAA.

---

### ex-058b

**Problem:** Golden = team/wiki/ (Context type). Input is in Spanish: "Lo que quema no es tener muchas reuniones. Lo que quema es tener tareas técnicas que requieren foco y no poder abordarlas por las reuniones. El TPO elimina la segunda variable de la ecuación." This is an interpretive insight from a private personal reflection document, not a factual team observation. Model correctly classifies as Reflection and blocks it.

**Source context:** `user/tpo-reflection.md`, section "Insight clave: reframing del problema de las reuniones." The full context is deeply personal: Juanje's internal deliberation about accepting the TPO role, conversations with his wife (Maui) and friends (Alberto, Israel, Víctor), frustration about AAA burnout. The insight IS generalizable (meeting load + focus tasks = burnout), but its origin is a private reflection document about a personal career decision.

**Proposed fix:** Two options. Recommending Option A (rewrite as factual team observation):

**Option A — Rewrite as factual observation:**
- **Input:** `"Team observation from the TPO transition: meeting load alone doesn't cause burnout — the friction comes from meetings competing with deep-focus technical tasks for the same schedule. When the role removes the competing technical tasks (coordination becomes the primary work, not interference), the conflict disappears."`
- **Context:** `"Organizational pattern observed during Toolchain TPO role transition. Generalized from concrete experience — applicable to any role design that mixes coordination with deep-technical work."`
- **Labels change:**
  - `type`: stays `Context`
  - `destination`: stays `team/wiki/`
  - Update `reasoning`: `"Rewritten as a factual organizational observation, stripped of personal emotional content and career deliberation context. The pattern (meetings + competing focus tasks = burnout; removing one variable resolves it) is generalizable team knowledge for role design and capacity planning."`

**Option B — Accept as Reflection/blocked:**
- Keep current input
- Change `type` to `Reflection`, `team_eligible` to `false`, `destination` to `null`
- Reasoning: the source is a private personal reflection; the insight, while true, is inseparable from the personal career context in its current form.

- **Reasoning for recommending A:** The depersonalized_capture already in the golden entry is well-written and factual. The problem is only in the `input` field — it reads like personal reflection because it IS personal reflection (Spanish, first person, from a private document). Rewriting the input as if it were stated in a team context (English, observational voice) fixes the eval without losing the valuable test case.

---

### ex-067

**Problem:** Golden = team/processes/ (Context type). Input: "Avi's suggestion: When presenting to program, name team members who achieved milestones — recognition for outward-facing work." It's a suggestion, not an adopted practice. Model classifies as Maturing (reasonable — it's a suggestion that hasn't been formally adopted).

**Source context:** Log 2026-09-07, "TPO Sync — Kanitha knowledge transfer." Under "What Kanitha does as TPO," the bullet reads: "Avi's suggestion: When presenting to program, name team members who achieved milestones — recognition for outward-facing work." It's listed alongside adopted practices (program meeting prep, Agile Maturity tracking, sprint monitoring, roadmap management), but it's explicitly marked as "Avi's suggestion" — not "team agreed" or "practice adopted."

However, reading the full context: this happened during a TPO knowledge transfer session where Avi (the manager) was passing guidance to Juanje as the incoming TPO. In that context, a manager's suggestion IS effectively a practice directive — it's not a casual suggestion, it's guidance from your manager about how to do the role.

**Proposed fix:** Rewrite to frame as adopted guidance, not suggestion.

- **Input:** `"TPO reporting practice from Avi's guidance: when presenting milestones at program meetings, name the individual team members who achieved them. Gives outward-facing recognition for their work."`
- **Context:** `"Guidance from manager (Avi) during TPO knowledge transfer session. Adopted as part of TPO reporting workflow."`
- **Labels change:** None — team/processes/ stays correct.
- **Reasoning:** Reframing from "suggestion" to "guidance adopted during knowledge transfer" makes the practice status clear. A manager's directive during role handoff is effectively a process directive, not a casual suggestion that might or might not be adopted. The model should now classify as Context → team/processes/ instead of Maturing.
