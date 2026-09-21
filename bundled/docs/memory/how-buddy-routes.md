# How Buddy Routes What You Share

When you tell Buddy something, it classifies it before deciding where to put it. This page explains how that classification works. For where each type ends up on disk, see [Where things live](where-things-live.md).

## Default to context

Most of what you share is background — activity updates, status reports, thinking out loud. Buddy treats it as **context** unless you give a clear signal. Context is captured automatically in the session log; you don't need to do anything for it to be remembered.

When in doubt, context wins. An unwanted task that clutters your list erodes trust more than a task Buddy missed — you can always say "actually, capture that as a task" and Buddy will.

## What triggers capture

Signals that Buddy treats as something to capture:

- Direct instructions: "remind me to…"
- Explicit commitments with timing: "tomorrow I'll…"
- Capture requests: "put that on my list"

Present-tense activity ("I'm working on X", "today I'm focusing on Y") is context, not a task — it describes what you're doing, not what needs doing.

## Task vs project

A **task** is one concrete step you can do in one sitting — "call the dentist", "review PR #42". A **project** is an outcome that needs multiple steps — "sort out my taxes", "prepare the trip". When you describe an outcome, Buddy asks for or proposes the first concrete step, creates a project, and captures just that step as a task linked to it.

Every project always has a **next action** — the first concrete step you can take right now. That is what Buddy captures as a task, not the project title. The project file holds the outcome and the full picture; the task list holds only what you can actually do. This keeps the list short and actionable: instead of staring at "sort out my taxes" and feeling paralyzed, you see "download last year's tax return" — one clear movement.

| You say | What Buddy sees | Why |
|---|---|---|
| "Call the dentist" | Task | One step, one sitting |
| "Review PR #42" | Task | One concrete action |
| "Update the work laptop" | Project | Outcome — implies a sequence of steps |
| "Organize the application papers" | Project | Outcome, not the next physical movement |
| "I'm working from the café today" | Context | Status update, no action needed |

## When Buddy asks

If your message contains structured actionable information (document lists, deadlines, steps to follow) but you didn't explicitly ask to capture it, Buddy asks: "I see actionable items here — should I capture them as tasks, or is this just context?" This avoids creating unwanted tasks from information you were just sharing.

## Lists and brain dumps

Send multiple items at once and each gets classified individually. "Call the dentist, sort out tax filing, working from the café today" becomes: one task, one project, one piece of context.

## Areas of focus vs projects

Two tests:

- "Can this be marked done someday?" → **project**.
- "Ongoing area I work in continuously?" → **area of focus**.

"Health" and "the blog" are areas; "migrate the blog to a new platform" is a project. Areas hold materials, notes, and references in a workspace; projects have a defined outcome and get completed. When the project finishes, the area continues.

## Knowledge: wiki vs workspaces

Both store what you know, but at different stages.

- **Wiki** pages are distilled, interconnected knowledge — things you've understood and want to think with. Test: *"Does this help me understand a topic?"*
- **Workspaces** hold raw and in-progress materials — drafts, notes, references for an ongoing area. Test: *"Does this help me work on an area?"*

Content flows from workspace to wiki when it matures (a published article's key concepts get distilled into wiki pages), not the other way.

## Active fronts and the work-in-progress limit

An **active front** is an area where you have work marked as your current focus. If you have focused tasks in `@work`, `@health`, and `@family`, that is three active fronts.

Buddy checks this during its daily review — not when you add tasks. Adding is never blocked. If any single area has more active fronts than the limit (3 by default), Buddy lets you know and asks which ones you want to focus on.

The limit exists to help you notice when you are spreading attention, not to stop you from capturing. You can change it anytime by telling Buddy ("set the limit to 5", "I don't want a limit") — it is a conversation, not a setting in a menu.

**Portfolio areas.** Some areas hold many projects by design — `@work` might have eight projects where only one or two are active at any time. Tell Buddy "work is a portfolio area" and it stops checking the limit there. You can also set a custom limit per area ("set the limit for work to 8") instead of disabling it entirely.

## If Buddy gets it wrong

Tell it. Buddy moves the information to the right place. The routing is a best guess based on what you said, not a rigid rule.
