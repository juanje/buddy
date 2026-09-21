# Group 2a — Conversational Context Enrichment Proposals

These 6 entries currently read like log summaries. Proposed rewrites use natural conversational voice — what a user would dump to their AI assistant after a meeting.

Source material: WAB daily logs (no daily journal entries exist; only weekly summaries which lack conversational detail).

---

### ex-002

**Source log excerpt (logs/2026-09-17.md, "Pre-planning: Sprint 135 team-wide Jira review"):**

> Queried Jira (`acli jira workitem search --jql 'project = VROOM AND sprint = "Toolchain Sprint 135"'`) for the full team view in preparation for Sprint Planning. Compared with `team-state.md`.
>
> Key discrepancies found:
> - VROOM-22346 (Ozan): in Backlog within the sprint — not being worked, not mentioned in team-state. Clarified in planning.

Also referenced in "Post-planning: Sprint 136 Jira sync":
> VROOM-22346 still in Backlog within Sprint 136 — noise, not being worked.

**Journal context:** W36 weekly mentions sprint 134 prep but not this specific ticket. No daily journal exists.

**Proposed rewrite:**

- **Input:** "I did the pre-planning Jira sweep for Sprint 136 and found VROOM-22346 sitting in Ozan's sprint backlog — but nobody's working on it and it's not in our team-state doc. Brought it up in planning and we clarified it's just noise. Checked again after planning and it's still there in Sprint 136 backlog. It keeps carrying over as a phantom ticket — the kind of thing that confuses anyone doing sprint prep if they don't know it's not real work."

- **Context:** "Sprint 136 pre-planning. User runs a full-team Jira query before each sprint planning, comparing per-person tickets against team-state.md to flag discrepancies."

- **Labels change:** None — team/wiki/ is correct. The enriched input now clearly presents a reusable sprint-hygiene pattern rather than a cryptic ticket reference. The depersonalized_capture remains appropriate.

- **Reasoning:** The original one-liner ("VROOM-22346 (Ozan): in Backlog...") reads like a Jira status note, not something a person would say. The model blocked it because it looked like a ticket status ping with a name attached — potential assessment of someone. The rewrite frames it as a process observation about phantom tickets in sprint views, which is the actual generalizable lesson.

---

### ex-005

**Source log excerpt (logs/2026-09-17.md, "Grafana alert channel debate"):**

> Matt raised: Grafana Slack alerts in `wg-team-auto-toolchain-infra` are more frequent than intended (configured for 3-day warning interval + daily critical, but firing more). Group opinion:
> - Not dramatically annoying but slightly noisy.
> - Avi: whatever works for Matt and Eitan — they own the cert monitoring. If it clutters the channel, change it.
> - General preference surfaced: email may be better for non-urgent/tracking alerts (better accountability per owner). Slack or desktop for urgent only.
> - Matt to investigate switching non-critical to email.
> - Will quiet down naturally once certs are renewed.

Tasks section confirms: "[Matt] Investigate email alerts for non-urgent Grafana notifications."

**Journal context:** No daily journal. W36 doesn't mention alerts.

**Proposed rewrite:**

- **Input:** "In Sprint 136 planning, Matt brought up that the Grafana alerts in our infra channel are noisier than expected — configured for 3-day warnings plus daily critical, but firing more frequently. Avi said Matt and Eitan own the monitoring, so it's their call. The team agreed that non-urgent tracking alerts should go to email instead of Slack — better accountability per owner, and Slack stays reserved for urgent/critical. Matt's going to investigate switching the non-critical ones to email. The noise will also calm down once the cert renewals go through."

- **Context:** "Sprint 136 planning meeting. Discussion about Grafana alert routing. Team reached agreement on routing convention."

- **Labels change:** Consider changing golden destination from `team/processes/` to `team/decisions/`. This is more of a routing decision than a documented process. However, since it establishes a convention for how alerts should be routed going forward, `team/processes/` is defensible. **Keep as-is.**

- **Reasoning:** "General preference surfaced" is passive voice summary language — nobody talks like that. "Matt to investigate" sounded like WIP/tentative. The rewrite makes clear: (1) there's an agreed convention (non-urgent → email, urgent → Slack), and (2) Matt has a concrete action item to implement it. The model blocked it because the original sounded like a still-developing preference, not a settled team agreement.

---

### ex-010

**Source log excerpt (logs/2026-09-17.md, "Board review — carryovers and status"):**

> **Developer VM (VROOM-52268, Juanje → Ozan):**
> - Juanje transferred ticket to Ozan for monitoring. AIB team (Boaz building, Pablo knowing content and testing) is building and testing the image. Once done, image goes to CDN → customer portal.
> - Juanje leaves next week (Sep 23) — Ozan will own monitoring from here.

Decisions section: "VROOM-52268 monitoring: Transferred to Ozan. Juanje out Sep 23."

**Journal context:** W36 weekly: "VROOM-52268 developer-vm Brew build — Doing — Urgent — Sep GA timeline; blocked on Tomas Kopecek Brew/CDN details". Confirms active handoff but no conversational detail.

**Proposed rewrite:**

- **Input:** "Developer VM status from Sprint 136 planning: I transferred VROOM-52268 to Ozan for monitoring. The AIB team has it now — Boaz is building the image and Pablo knows the content and is handling testing. Once they're done, the image goes to CDN and then customer portal. Ozan will own the monitoring going forward since I'm out starting Sep 23."

- **Context:** "Sprint 136 planning board review. Handoff of developer VM monitoring ticket from user to teammate before PTO."

- **Labels change:** The PTO mention ("I'm out starting Sep 23") is borderline for Q3 privacy, but since it was stated openly in a team planning meeting as the reason for the handoff, and the depersonalized_capture already strips it to "Ozan is the current owner", this is fine. **Keep labels as-is.**

- **Reasoning:** The original mixes third-person log notation ("Juanje transferred", "Juanje leaves") with factual status. The rewrite uses first-person voice ("I transferred", "I'm out") which is how a user would actually describe this to their assistant. The model blocked it because the mix of handoff + named PTO dates for two people looked like it might expose private scheduling info. In first-person, the PTO reference is self-disclosure (not an assessment of others), and the handoff status is clearly the primary payload.

---

### ex-011

**Source log excerpt (logs/2026-09-17.md, "PO Planning — Sep 17" → "PIT Sprint 134 metrics + Rovo (Rachel)"):**

> - **Rachel uses Jira Rovo prompts to automate sprint summaries** — generates status bars, goal status, flags tickets with high sprint age. Hands-off for her.
> - Rovo is **free** (doesn't count toward AI budget). Gemini also free.
> - Sprint reports stored on **Google Drive** for program visibility (Shawn's requirement).
> - Whitney: sprint reports must go to Drive. Slack summary nice for team-internal sharing but not the official record.
> - Julia Williams authored the Rovo prompt. Rachel sharing it in meeting notes/sidebar.
> - → **TPO action:** grab Rachel's Rovo prompt. Set up Toolchain sprint report on Drive. Clarify what Kanitha was doing before.

**Journal context:** No daily journal. W36 doesn't mention Rovo.

**Proposed rewrite:**

- **Input:** "Useful thing from PO Planning today: Rachel automates her sprint reports using Jira Rovo prompts — it generates status bars, goal status, and flags tickets with high sprint age. Totally hands-off for her. Important detail: Rovo is free, doesn't count against the AI token budget. The official requirement from Shawn is that sprint reports go on Google Drive for program visibility. Whitney reinforced that — Slack is fine for team sharing but Drive is the canonical location. Julia Williams wrote the Rovo prompt that Rachel uses. I need to grab that prompt and set up Toolchain's sprint reporting on Drive."

- **Context:** "PO Planning meeting. User is onboarding as TPO and learning the sprint reporting workflow from other POs."

- **Labels change:** None — `team/processes/` is correct. This is a documented team process for sprint reporting (where reports go, what tool to use, who requires what). The depersonalized_capture correctly strips "Rachel uses" to the process itself.

- **Reasoning:** The original reads like structured meeting notes. The rewrite conveys the same information as a natural debrief — "here's what I learned that's useful for our team." The model routed to wiki instead of processes because "Rachel uses Rovo" reads like a tool tip about an individual's workflow. The rewrite makes clear this is a program-wide process requirement (Drive for reports, Rovo as the accepted tool, Shawn's mandate).

---

### ex-019

**Source log excerpt (logs/2026-09-01.md, "Decisions"):**

> - **Konflux blocked for developer VM (post-meeting Slack).** Bootc = immutable, even after QCOW2 conversion. Developer VM needs mutable (RPM install, RHSM, data storage). **Brew is the only viable path.** Konflux work (source repo skeleton, KRD config planning) may still be useful long-term but is not the path for this image.

Context section adds:
> **Path decision clarified:** Konflux produces bootc images that are immutable even in QCOW2 form. The developer VM requires mutability (RPM install, RHSM, data storage). This rules out Konflux. Brew is the path forward.

Post-meeting Slack (same log):
> **Juanje declared Konflux blocked:** "Konflux can only build bootc images (even if they are converted to VM/qcow2, internally it still is an immutable image), but the Developer VM image needs to be mutable. So, this kind of set the debate about Brew vs Konflux. We can only use Brew option for this image."

**Journal context:** W36 weekly confirms: "Sep 1 blocker: bootc images immutable even as QCOW2 — developer VM requires mutability. Decision: Brew only."

**Proposed rewrite:**

- **Input:** "The Brew vs Konflux debate for the developer VM is settled. After the Open Sync today and the Slack thread that followed, the conclusion is clear: Konflux can only build bootc images, and bootc is immutable — even when you convert to QCOW2 via BIB, internally it's still an immutable image. But the developer VM needs to be mutable: developers need RPM install, RHSM registration, and persistent data storage. So Konflux is out for this image type. Brew is the only viable path. The Konflux prep work we did — source repo skeleton, KRD config planning — isn't wasted, it'll be useful for other images long-term. But for this specific developer VM, it's Brew."

- **Context:** "Post-Toolchain Open Sync. A multi-week Slack thread debating Brew vs Konflux was resolved when the bootc immutability constraint was confirmed in the meeting and subsequent Slack discussion."

- **Labels change:** None — `team/decisions/` is correct. This is a clear architectural decision with technical rationale.

- **Reasoning:** The original reads like a structured decision log entry — "Konflux blocked for developer VM (post-meeting Slack)." That's a section header, not natural speech. The model routed to wiki because the summary reads like a technical constraint fact (bootc = immutable), not a decision. The rewrite frames it as a resolved debate with a conclusion ("the debate is settled", "Brew is the only viable path"), making the decision nature unmistakable. The technical rationale supports the decision rather than standing alone as wiki-style reference material.

---

### ex-036

**Source log excerpt (logs/2026-08-17.md, "PDR Staff Meeting"):**

Full AWS cost reduction section:
> **Cloud cost reduction (AWS, 20% target CY26H2):**
> - Not tracked at program level (no AUTOBU epic). Best effort — don't disrupt workflows.
> - Immediate: cleanup obvious waste (Toolchain already doing some).
> - Longer term: retention policies for all artifacts.
> - **Juanje raised:** RHIVOS 1.0 artifacts — can we clean them up? Petr: probably yes for most, but need FuSa (Steve/Bruce) confirmation on what's needed as certification evidence. AutoSD 9 can likely be pruned completely.
> - **Petr asked:** why S3 instead of internal storage? Juanje explained: need same system upstream/downstream, staging→promoted workflow, flexibility to build+validate+promote. Pulp (internal) intended as replacement but currently slower → pipeline bottleneck. Moving to Pulp is on hold for now.
> - Luigi: Jumpstarter team also reviewing retention (RAS infra + S3 dual storage = waste).

Decisions section confirms:
> AWS cost reduction — best effort, no AUTOBU epic; cleanup waste first, retention policies longer term. Snapshot cleanup + RHIVOS-1 artifact pruning may suffice for 20% target with minimal extra work (Avi, post-PDR).

**Journal context:** W33 weekly doesn't cover Aug 17 (it ends Aug 13). W36 mentions: "AWS 20% H2 mandate program context; S3 cleanup email sent Aug 26 (deadline Sep 5)."

**Proposed rewrite:**

- **Input:** "From PDR Staff today: AWS cost reduction target is 20% for CY26H2. It's best effort — not tracked at program level, no AUTOBU epic, just don't disrupt workflows. The approach is: clean up obvious waste now, then work on retention policies longer term. I raised whether we can clean up RHIVOS 1.0 artifacts — Petr said probably yes for most, but we need Steve or Bruce from FuSa to confirm which artifacts are needed as certification evidence before we delete anything. AutoSD 9 artifacts can likely be pruned completely. Petr also asked why we use S3 instead of internal storage — the answer is we need the same system for upstream/downstream, staging-to-promoted workflows. Pulp is the intended replacement but it's too slow right now, so that move is on hold."

- **Context:** "PDR Staff meeting. User attended as TPO transition onboarding. AWS cost reduction directive from engineering leadership."

- **Labels change:** Consider changing from `team/processes/` to `team/decisions/` — the 20% target, best-effort approach, and cleanup-before-retention-policies framing are decisions from program leadership. However, the artifact retention guidance (check with FuSa before deleting RHIVOS 1.0) is process/constraint knowledge. **Keep `team/processes/`** — the retention rules are the lasting value, not the one-time decision.

- **Reasoning:** The original reads as a dialogue transcript ("Juanje raised... Petr: probably yes..."). The model blocked it because "probably yes" + "need confirmation" sounds tentative — not a decided process. The rewrite preserves the constraint (must check with FuSa) while making clear that the overall approach (cleanup waste now, retention policies later) is agreed, and the FuSa check is a required step in the cleanup process, not an unresolved question about whether to do it.
