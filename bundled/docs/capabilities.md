# What Buddy Can Do

## What Buddy is

Buddy is a personal assistant that remembers. It captures what you tell it, organizes it, and brings it back when it's relevant — across sessions, across days, across topics. Everything stays on your computer in files you can read yourself.

**Core promise:** You talk to Buddy like you'd talk to a trusted colleague. It listens, captures, and keeps track — so you don't have to.

## What Buddy does

### Remembers everything

- Close the app, come back days later — Buddy remembers your conversations, decisions, and context.
- After each session, Buddy reflects on what happened and captures the important parts: decisions made, lessons learned, open threads, ideas that came up.
- Over time, it builds a structured picture of your projects, preferences, and patterns.

### Captures and organizes

- Tell Buddy about a task, an idea, a decision, or something you learned — it writes it to the right place automatically.
- **Tasks and reminders** go to your task list and projects. **Ideas, concepts, and knowledge** go to your [personal wiki](wiki.md) (your second brain). **What Buddy learns about you** — preferences, patterns, how to help you better — stays in Buddy's own memory.
- You don't need to tell it where to put things. It routes based on what you share. If you disagree with where it put something, say so — it'll move it.
- Buddy classifies what you share — distinguishing tasks from context, projects from single steps, and knowledge from action items. Most of what you share is treated as context unless you give a clear instruction or commitment. For the full details on how Buddy decides what goes where, see [How Buddy routes what you share](memory/how-buddy-routes.md).

### Reminds you

- Say "remind me to call the bank on Friday" and Buddy captures it with the date.
- When the day comes, Buddy surfaces the reminder two ways: visually inside the app, and as a native notification from your operating system.
- **The reminder reaches you even when you're not chatting.** As long as Buddy is running — including minimized or in the background — it checks for due reminders about every half hour and sends a system notification when one comes due, so you don't have to keep the chat open or watch it. Click the notification and Buddy's window comes to the front. (This needs Buddy to be running: if you've fully quit the app, it can't notify you until you open it again.)
- Dismiss a reminder when you've seen it and it won't come back.

### Manages your tasks

- Tell Buddy what needs doing and it captures it — no manual editing needed. Say "I need to call the dentist" or "look into flights for September" and Buddy adds it to your task list with the right area and an optional due date.
- **A task is one concrete step you can do in one sitting** — not a goal, not a wish, but the actual next movement. "Call the dentist" is a task. "Sort out my health" is not — that is a project (see below).
- Tasks belong to areas like `@work` or `@personal`. Each project within an area can have its own current focus — a concrete next step. If you have three projects in `@work`, each can have its own focused task without conflicts.
- **Next action.** Among your open tasks, Buddy keeps track of which one is the **next action** for each project or area — the one step to focus on right now. A long task list is overwhelming; knowing the single next movement for each thing you are working on means you are never stuck wondering what to do. Buddy picks the first one automatically when you add tasks, and when you finish it, asks you to choose the next. You can change it anytime ("make this one the next action for work").
- When you complete or remove a focused task, Buddy tells you how many remain in that scope and suggests picking a new one.
- Ask "what should I work on?" and Buddy surfaces the next action for the context you're in.
- Tasks you are not ready for can be **parked** — they stay on your list but out of your daily view until you bring them back. Say "not now" or "maybe later" and Buddy parks it.
- Tasks with a future date stay hidden until they become relevant.
- If you send a list of things at once, each item gets classified on its own — some may become tasks, others context, others projects.
- **Active work limit.** Buddy periodically reviews how many fronts you have active in each area. If you are spreading attention beyond the limit (3 per area by default), Buddy surfaces it during its daily review — not when you add a task. Adding is never blocked. You can change the limit anytime by telling Buddy ("set the limit to 5", "remove the limit"). For more on what "active front" means, see [How Buddy routes what you share](memory/how-buddy-routes.md).
- Completed tasks are cleaned up automatically — no housekeeping needed on your part.

### Tracks projects

- **A project is something you want to achieve that needs more than one step** — "sort out my taxes", "prepare the trip", "update the work laptop". Unlike a task (one movement), a project has a defined finish line and multiple actions to get there.
- When you describe something that needs multiple steps, Buddy recognizes it as a project. It creates a project file, then captures the first concrete step as a task linked to that project.
- If you phrase an outcome as a task ("update the work laptop"), Buddy asks for the concrete first step or proposes one — rather than accepting a vague to-do.
- Ask about a project and Buddy pulls up what it knows: outcome, notes, history, and the current next action.
- During weekly review, Buddy checks that active projects still have pending tasks. If a project has gone quiet, it flags it for your attention.

### Areas of focus

- Ongoing topics or responsibilities that never "finish" — like "health", "the blog", or "open source work" — are **areas of focus**, not projects.
- Areas can hold raw materials, notes, drafts, and references in a dedicated workspace. Unlike projects, these grow and reorganize over time without a defined end.
- An area of focus can spawn projects: "the blog" is an area; "migrate the blog to a new platform" is a project within it. When the project completes, the area continues.

### Learns your preferences

- Buddy builds a profile of who you are: your name, language, interests, how you like to work.
- It updates this profile as it learns — from conversation. You're informed of changes.
- Preferences are transparent: you can read your profile file directly and correct anything.

### Keeps a journal

- Personal life updates, reflections, and daily activities are noted in a journal.
- Ask "what did I do yesterday?" or "how has the week been?" and Buddy can look it up.

### Switching topics

- A **New topic** button sits in the input bar. Click it to start a fresh conversation.
- Two paths: **start immediately** (the current session closes, reflect runs in the background, a new session begins) or **wrap up first** — Buddy summarizes what was discussed, lists decisions and open questions, and suggests a next action. You can keep chatting after the wrap-up; click **Done** when you're ready to move on.
- The wrap-up is a conversation, not a one-shot report — ask follow-ups or adjust anything before transitioning.

### Starting your day

- The first time you open Buddy each day, a short orientation card appears above the chat: due reminders and your next tasks across areas.
- Below the card, a quiet "where we left off" line tells you what the last session was about — in your language, not a raw log excerpt.
- Dismiss the card with the X and it won't come back until tomorrow. The one-liner disappears when you send your first message.
- Later opens the same day skip both — no repeated orientation on topic changes.

### Maintains itself

- Buddy periodically synthesizes and organizes its own knowledge — daily summaries, weekly patterns, monthly cleanup.
- This happens automatically in the background when you're not chatting.
- Knowledge that's frequently consulted becomes easier to find; rarely used knowledge fades into the background without disappearing.

## How you interact with Buddy

### Conversation

- Talk naturally. Buddy responds in your language.
- It has opinions and can push back on your reasoning — it's designed to help you think, not just agree.
- It's direct and concise by default. Ask for depth and it adjusts.

### Sharing files and URLs

- Drag & drop or attach files to share them with Buddy.
- It can read text files, markdown, CSV, JSON, YAML, log files, images (it can see and describe what's in them), and PDFs (extracts the text automatically).
- Spreadsheets (`.xlsx`, `.xls`, `.ods`) are not supported directly — export to CSV from your spreadsheet app and attach the CSV instead. Document formats like `.docx` or `.pptx` aren't supported either — export to text (`.md` or `.txt`).
- Share a URL and Buddy fetches the page, extracts the main content as readable text, and saves a copy in your downloads folder. Works with web pages, online PDFs, and images.
### Reading Buddy's files inside the app

- **Ask to see something and Buddy opens it for you** — "show me my profile", "show me my tasks". The panel opens by itself; you don't have to find a link and click it.
- When Buddy mentions one of your files, the link is clickable and the file opens in a panel inside Buddy — no text editor needed.
- **Only `.md` and `.txt` files open this way**, and only from `agent_brain/`, `user/`, `downloads/` and `logs/`. Anything else is shown as plain text you can't click.
- Documents that link to each other can be browsed: click a link inside an open document to follow it, and use Back to return the way you came.
- **Buddy never opens a file with another program.** There is no "open externally". For files in your personal space (`user/` and `downloads/`), a **Show in folder** button in the viewer takes you straight to the file in Finder or your file manager — so you can attach it to an email, copy it, or do whatever you need. Buddy shows you where the file is; what you do with it is up to you.
- On macOS, an **Export PDF** button lets you save the viewed markdown document as a PDF. You choose where it goes. This is not yet available on Linux.

### First-time setup

- A step-by-step wizard walks you through: language, where to store your data, connecting your AI provider, and telling Buddy a bit about yourself.
- Providers: Anthropic, OpenAI or Google.
- If you already have data from a previous setup, Buddy can import it directly. A folder left half-finished by a setup that failed is not offered for import, because adopting it produces an assistant that never works properly.

### Settings

- Change your language, AI provider, or model anytime from Settings (gear icon or Cmd/Ctrl+,).
- Add additional AI providers without going through setup again.
- Configure [external service connectors](connectors.md) in the **Integrations** tab — connect Jira and other services so Buddy can read your project data.

### Organize files

- **Copy** external files into your workspace with `copy_file` — byte-for-byte, without reading them into the conversation (saves time and tokens). Useful for PDFs, images, and reference documents.
- **Move or rename** files within `user/` or `downloads/` to keep things organized.
- **Delete** files in `user/` or `downloads/` — Buddy asks for confirmation before deleting anything. Brain memory (`agent_brain/`), logs, and identity files are never deleted.

## What Buddy can't do

- **No web search.** Buddy can fetch a specific URL you share, but it can't search the internet on its own or browse freely. It also can't fetch pages served from your own machine or local network — a development server at `http://localhost:3000` is refused, because a link Buddy follows may come from a page it read rather than from you.
- **No code execution.** It can't run scripts, commands, or programs. It works with files only.
- **No opening files in other apps.** Buddy shows `.md` and `.txt` inside the app. For other file types, or when you need the actual file, use **Show in folder** to find it in your file manager and open it yourself.
- **PDF export on Linux.** On macOS you can export a viewed markdown document as a PDF. That button is not available on Linux yet.
- **No access to sensitive files.** SSH keys, credentials, and environment files are always off-limits.
- **No Pi CLI extensions.** If you use the Pi command-line tool on this computer, its skills, tools and settings are not available here. Buddy keeps its own configuration entirely separate, so nothing you installed for another tool changes how Buddy behaves.
- **No local or self-hosted models yet.** Buddy cannot currently be pointed at Ollama, LM Studio, llama.cpp or any other OpenAI-compatible endpoint. This is planned, not available — if asked, say so plainly rather than suggesting a workaround.
- **No changes without you knowing.** If Buddy wants to read files outside your data folder, it asks first. You can grant permanent read access to a folder ("Allow always for this folder") and it won't ask again for reads inside it. Writing outside your data folder always asks separately. Changes to its own identity require your explicit approval. File deletion always requires confirmation.
