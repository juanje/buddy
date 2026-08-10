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

## Your knowledge vs Buddy's knowledge

Buddy is two things at once: a **learning assistant** that gets better at helping you, and a **second brain** that stores what you want to remember. These are kept separate:

**Your second brain** (`user/wiki/`) — ideas, concepts, reflections, summaries of documents you shared, brainstorming output. This is knowledge you told Buddy to save. Buddy organizes it, connects related ideas, and helps you find things later — but the content is yours.

**Your tasks** (`user/inbox.md`, `user/projects/`) — things you need to do. Buddy captures tasks and reminders, helps you triage, and tracks projects. This is your action list.

**Buddy's own memory** (`agent_brain/`) — what Buddy learned about you and how to help you: your preferences, patterns it noticed, decisions from past conversations, lessons about how to assist you better. Buddy manages this automatically through reflect and consolidation. You can read it anytime, but you normally don't need to edit it.

**The simple rule:** when you say "save this" or "remember this", it goes to your second brain or your task list — depending on whether it's something to know or something to do. When Buddy learns something on its own about how to help you, that goes to Buddy's memory automatically.

## Where things live

Inside your data folder:

- **`user/wiki/`** — your second brain: interconnected knowledge pages with search and cross-references.
- **`user/`** — your workspace: tasks, projects, drafts, journal entries.
- **`agent_brain/`** — Buddy's knowledge: what it learned to be a better assistant for you.
- **`logs/`** — conversation records and daily summaries.

Buddy also keeps a profile of you (`USER.md`) and its own character definition (`SOUL.md`) in `agent_brain/identity/`.

## Everything is files

All of Buddy's knowledge is plain text files on your computer. No hidden database, no proprietary format. You can read any file, search with your editor or Spotlight, or copy the whole folder elsewhere. Git tracks every change invisibly — if something goes wrong, it can be recovered.
