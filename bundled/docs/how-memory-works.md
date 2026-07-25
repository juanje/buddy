# How Buddy's Memory Works

Buddy doesn't just save chat history. It builds structured memory over time — and maintains it automatically.

## Sessions and reflect

Every time you talk to Buddy, that's a session. When the session ends (you close the app or start fresh), Buddy automatically reviews what happened and captures the important parts:

- Decisions you made
- Tasks and action items
- Ideas that came up
- Lessons or patterns worth keeping
- Open threads still pending

You don't need to ask for this — it happens in the background.

## Daily logs

Each day gets a log entry summarizing what happened across sessions. Ask "what did we talk about yesterday?" or "what's been going on this week?" and Buddy can look it up from these logs.

## Consolidation

Periodically, Buddy goes deeper — synthesizing knowledge from recent logs, updating projects, surfacing patterns, and keeping its memory organized. This runs in three levels:

- **Daily** — summarizes recent activity, processes your inbox, updates indexes.
- **Weekly** — looks for patterns across the week, writes journal summaries.
- **Monthly** — deeper reorganization: grouping related knowledge, cleaning up structure, reviewing ideas.

All of this is automatic. It runs in the background when you're not chatting. You never need to trigger it manually.

## What rises, what fades

Knowledge Buddy consults frequently becomes easier to find — it stays close at hand. Knowledge that goes unused for a long time fades into the background. It's still there and still findable, but it doesn't take up attention. This happens naturally, similar to how your own memory works.

## Your files vs Buddy's memory

Buddy keeps two kinds of content separate:

**Your workspace** — tasks, lists, drafts, documents you work on. Buddy creates and edits these for you, but they are *your* files. Buddy never auto-deletes or archives them.

**Buddy's memory** — concepts, project context, lessons, observations. Buddy manages this automatically through reflect and consolidation. You can read it anytime, but you normally don't need to edit it directly.

## Where things live

Inside your data folder:

- **`user/`** — your workspace: tasks, projects, drafts, journal entries.
- **`agent_brain/`** — Buddy's knowledge: concepts, projects, ideas, observations.
- **`logs/`** — conversation records and daily summaries.

Buddy also keeps a profile of you (`USER.md`) and its own character definition (`SOUL.md`) in `agent_brain/identity/`.

## Everything is files

All of Buddy's knowledge is plain text files on your computer. No hidden database, no proprietary format. You can read any file, search with your editor or Spotlight, or copy the whole folder elsewhere. Git tracks every change invisibly — if something goes wrong, it can be recovered.
