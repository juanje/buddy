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
- Tasks and to-dos go to your workspace. Decisions and lessons go to the knowledge base. Ideas get their own space with a lifecycle (seed → developing → ready).
- You don't need to tell it where to put things. It routes based on what you share. If you disagree with where it put something, say so — it'll move it.

### Reminds you

- Say "remind me to call Pedro on Friday" and Buddy captures it with the date.
- When the day comes, Buddy surfaces the reminder — visually when you open the app and as an OS notification.
- Dismiss a reminder when you've seen it and it won't come back.

### Manages your inbox (GTD — Getting Things Done)

GTD is a productivity method by David Allen. The core idea: get everything out of your head into a trusted system, then decide what each item means and what to do with it. Buddy acts as that trusted system — it captures, organizes, and surfaces your tasks so you don't have to hold them in memory.

How it works in practice:

- You dump anything into Buddy ("I need to call the dentist", "look into flights for September") — it captures everything in your inbox.
- When you say "triage my inbox" or "what should I work on?", Buddy processes each item: is it actionable? Single step or a project? Can it be done in 2 minutes? It routes items to the right place (next actions, projects, someday/maybe) and surfaces your priorities by context.
- You always have a clear "next action" — no vague to-dos, just concrete steps you can act on right now.

### Tracks projects

- Multi-step outcomes get their own project file with outcome, next action, notes, and history.
- Ask about a project and Buddy pulls up what it knows.

### Learns your preferences

- Buddy builds a profile of who you are: your name, language, interests, how you like to work.
- It updates this profile as it learns — from conversation. You're informed of changes.
- Preferences are transparent: you can read your profile file directly and correct anything.

### Keeps a journal

- Personal life updates, reflections, and daily activities are noted in a journal.
- Ask "what did I do yesterday?" or "how has the week been?" and Buddy can look it up.

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
- It can read text files, markdown, images (it can see and describe what's in them), and PDFs (extracts the text automatically).
- Share a URL and Buddy fetches the page, extracts the main content as readable text, and saves a copy in your downloads folder. Works with web pages, online PDFs, and images.
### Reading Buddy's files inside the app

- When Buddy mentions one of your files, the link is clickable and the file opens in a panel inside Buddy — no text editor needed.
- **Only `.md` and `.txt` files open this way**, and only from `agent_brain/`, `user/`, `downloads/` and `logs/`. Anything else is shown as plain text you can't click.
- Documents that link to each other can be browsed: click a link inside an open document to follow it, and use Back to return the way you came.
- **Buddy never opens a file with another program.** There is no "open externally". For a PDF, an image, or a spreadsheet, ask Buddy where the file is and open it yourself from your file manager.

### First-time setup

- A step-by-step wizard walks you through: language, where to store your data, connecting your AI provider, and telling Buddy a bit about yourself.
- Providers: Anthropic, OpenAI or Google.
- If you already have data from a previous setup, Buddy can import it directly. A folder left half-finished by a setup that failed is not offered for import, because adopting it produces an assistant that never works properly.

### Settings

- Change your language, AI provider, or model anytime from Settings (gear icon or Cmd/Ctrl+,).
- Add additional AI providers without going through setup again.

### Organize files

- **Copy** external files into your workspace with `copy_file` — byte-for-byte, without reading them into the conversation (saves time and tokens). Useful for PDFs, images, and reference documents.
- **Move or rename** files within `user/` or `downloads/` to keep things organized.
- **Delete** files in `user/` or `downloads/` — Buddy asks for confirmation before deleting anything. Brain memory (`agent_brain/`), logs, and identity files are never deleted.

## What Buddy can't do

- **No web search.** Buddy can fetch a specific URL you share, but it can't search the internet on its own or browse freely. It also can't fetch pages served from your own machine or local network — a development server at `http://localhost:3000` is refused, because a link Buddy follows may come from a page it read rather than from you.
- **No code execution.** It can't run scripts, commands, or programs. It works with files only.
- **No opening files in other apps.** Buddy shows `.md` and `.txt` inside the app and stops there. It will tell you where a file is so you can open it yourself.
- **No access to sensitive files.** SSH keys, credentials, and environment files are always off-limits.
- **No Pi CLI extensions.** If you use the Pi command-line tool on this computer, its skills, tools and settings are not available here. Buddy keeps its own configuration entirely separate, so nothing you installed for another tool changes how Buddy behaves.
- **No local or self-hosted models yet.** Buddy cannot currently be pointed at Ollama, LM Studio, llama.cpp or any other OpenAI-compatible endpoint. This is planned, not available — if asked, say so plainly rather than suggesting a workaround.
- **No changes without you knowing.** If Buddy wants to access files outside your data folder, it asks first. You can grant permanent access to a folder ("Allow always for this folder") and it won't ask again for files inside it. Changes to its own identity require your explicit approval. File deletion always requires confirmation.
