# Privacy and Permissions

## Your data stays local

All your data stays on your machine. Nothing is sent anywhere except:

1. **The AI provider** — your messages and context are sent to generate responses.
2. **URLs you explicitly share** — Buddy fetches the page you ask it to read.

There is no telemetry, no analytics, and no data sent to Buddy's developers. The Settings **Usage** panel tracks local API spend on your machine only — it is not shared anywhere.

## Credentials

Your AI provider credentials are stored locally with restrictive file permissions, separate from any other tool on your computer.

## How file access works

Buddy organizes everything in a folder you choose during setup. Inside that folder, Buddy can read and write freely — that's your workspace and its memory.

**Your data folder (full access):** Everything inside the folder you picked at setup. Buddy reads and writes here without asking every time.

**Outside your folder (asks first):** If Buddy needs to read a file elsewhere — for example, a document in Documents — it asks you in the chat. You can allow once, allow always for that file, or allow always for the folder. "Allow always" is remembered across sessions.

**Buddy's own documentation (always allowed):** Buddy can read `~/.buddy/docs/` without asking — that's where this documentation lives.

**Never allowed:** SSH keys, GPG keys, AWS credentials, `.env` files, and authentication files. Buddy cannot access these even if you try to grant permission.

**Identity changes (explicit approval):** If Buddy wants to change its own character definition (`SOUL.md`), it always asks for your confirmation first.

## What you can inspect

Everything Buddy knows is in plain text files in your data folder. You can open them with any text editor, back them up, or copy them elsewhere. Git tracks changes invisibly in the background — if something goes wrong, history can be recovered.
