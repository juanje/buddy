# Privacy and Permissions

## Your data stays local

All your data stays on your machine. Nothing is sent anywhere except:

1. **The AI provider** — your messages and the context needed to answer them are sent to generate responses. This includes parts of your profile, relevant memory files, and log excerpts that Buddy loads to understand your conversation. The model that writes the replies runs on their servers, not here. Buddy sends only what's needed for the current conversation — not your entire data folder.
2. **URLs you explicitly share** — Buddy fetches the page you ask it to read. It will not fetch addresses on your own machine or local network, and it re-checks every redirect: a public URL that redirects to an internal one is refused at that point.

There is no telemetry, no analytics, and no data sent to Buddy's developers. The Settings **Usage** panel tracks local API spend on your machine only — it is not shared anywhere.

## Credentials

Your AI provider credentials are stored locally with restrictive file permissions, separate from any other tool on your computer. The same applies to everything else Buddy keeps in `~/.buddy/` — including the list of folders you have granted access to, which is readable only by you.

## How file access works

Buddy organizes everything in a folder you choose during setup. Inside that folder, Buddy can read and write freely — that's your workspace and its memory.

**Your data folder (full access):** Everything inside the folder you picked at setup. Buddy reads and writes here without asking every time.

**Outside your folder (asks first):** If Buddy needs to read a file elsewhere — for example, a document in Documents — it asks you in the chat. You can allow once, allow always for that file, or allow always for the folder. "Allow always" covers reads — if Buddy wants to write to a file outside your data folder, it asks separately. Permissions are remembered across sessions.

**Shortcuts and aliases don't widen access.** What counts is where a file really is, not the path used to reach it. If you put a shortcut inside your data folder pointing somewhere else, Buddy still treats what's behind it as outside and asks. The same holds for a folder you granted access to: the grant covers that folder, not wherever a shortcut inside it leads.

**Buddy's own documentation (always allowed):** Buddy can read `~/.buddy/docs/` without asking — that's where this documentation lives.

**Never allowed:** SSH keys, GPG keys, AWS credentials, `.env` files, and authentication files. Buddy cannot access these even if you try to grant permission.

**Identity changes (explicit approval):** If Buddy wants to change its own character definition (`SOUL.md`), it always asks for your confirmation first.

## What you can inspect

Everything Buddy knows is in plain text files in your data folder. You can open them with any text editor, back them up, or copy them elsewhere. Git tracks changes invisibly in the background — if something goes wrong, history can be recovered.

You can also read them without leaving the app: ask Buddy about something and click the file it mentions. Markdown and text files open in a panel, and links between documents can be followed from there.
