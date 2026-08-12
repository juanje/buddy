# Git Safety Net

Every change Buddy makes to your files is tracked by git. You don't need to know git to use Buddy — it handles everything automatically. But if you do, this page explains what's happening and how to use it.

## When Buddy commits

Buddy creates a git commit after every meaningful change:

| Event | What's committed |
|---|---|
| End of session (reflect) | Daily log entry, captured tasks, updated files |
| Daily consolidation | Journal entry, inbox changes, observation updates, index refreshes |
| Weekly/monthly consolidation | Archive moves, concept updates, structural reorganization |
| During conversation | When Buddy captures something you asked it to save |

Each commit has a message describing what changed. The full history is browsable.

## What this means for you

- **Committed changes can be recovered from git history.** If Buddy's consolidation accidentally removes a detail, or if a file gets corrupted, the previous version is in the history.
- **Changes are auditable.** You can see exactly what Buddy changed, when, and in what context.

## How to use it (if you know git)

Your data folder is a git repository. You can run standard git commands from a terminal:

```bash
cd ~/your-data-folder

# See recent changes
git log --oneline -20

# See what changed in the last commit
git show HEAD

# See the history of a specific file
git log --oneline agent_brain/identity/USER.md

# Recover a file from a previous state
git checkout HEAD~3 -- agent_brain/identity/USER.md
```

## How to use it (if you don't know git)

You don't need to do anything. Git runs silently in the background. If something goes wrong and you need to recover data, the full history is preserved in your data folder. You can ask someone with git knowledge to help you restore a previous state, or use a git GUI application to browse the history yourself.

## What git doesn't protect against

- **Deletion of the entire data folder** — git history lives inside the folder. If the folder is deleted, the history goes with it. Keep backups of your data folder if it matters to you.
- **Uncommitted changes** — if Buddy crashes mid-session before reflect runs, changes made during that session might not be committed yet. This is rare — Buddy commits frequently — but it's the one gap.

## Privacy note

Git history is entirely local. It's never pushed to any remote server. The `.git` directory inside your data folder contains the full history, and it stays on your machine.
