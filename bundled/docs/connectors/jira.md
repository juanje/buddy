# Jira Connector

The Jira connector lets Buddy read your issues, sprints, and project activity directly from Jira Cloud. You ask questions in natural language and Buddy fetches the data, formats it, and works with it in context — alongside your tasks, notes, and everything else it knows about you.

## Setting it up

1. Open **Settings → Integrations** and enable Jira.
2. Enter your Jira URL (e.g. `https://your-org.atlassian.net`), your email, and an API token. You can generate a token from [Atlassian account settings](https://id.atlassian.com/manage-profile/security/api-tokens).
3. Add your project prefixes — the short codes that appear before issue numbers (e.g. `PROJ`, `TEAM`). Buddy uses these to recognize issue keys in conversation.
4. Test the connection and save. Restart the session to activate.

## What you can ask

### What's on my plate?

Ask about your current work and Buddy pulls your open issues, sprint board, or assigned tasks.

- *"What issues do I have open?"* — your unresolved issues, sorted by last update.
- *"Show me the sprint board"* — issues in the current open sprint. You can also ask about someone else's board: *"What does Ozan have in the sprint?"*

### Tell me about an issue

Share an issue key or ask about one by name and Buddy fetches the full picture.

- *"Tell me about PROJ-123"* — summary, status, assignee, priority, description, comments, links, and parent.
- *"What's the status of PROJ-45 and PROJ-78?"* — quick status check on multiple issues at once.
- *"What are the children of PROJ-10?"* — all issues under an epic.

Buddy also recognizes issue keys when they appear naturally in your messages. If you mention `PROJ-123` while talking about something else, it can look it up without you explicitly asking.

### What changed recently?

Catch up on project activity without opening Jira.

- *"What changed in the last week?"* — recently updated issues across all your projects.
- *"What did the team resolve between August 1 and August 15?"* — completed work in a date range.

## How caching works

Buddy doesn't call Jira on every question. It keeps a local cache that refreshes automatically:

- **Sprint board and open issues** refresh roughly every 15 minutes.
- **Issue details** stay fresh for about 30 minutes.
- **Epic contents** refresh every hour.
- **Historical reports** (like resolved issues in a date range) refresh once a day.

If you need the very latest — say you just moved a ticket — ask Buddy to force a refresh and it will fetch fresh data immediately.

When Jira is unreachable (network issue, server down), Buddy serves what it has from cache and warns you that the data may not be current. This way you can still reference your issues even when connectivity is poor.

## Privacy

- Your Jira credentials (email + API token) are stored locally on your machine with restrictive file permissions, in the same protected location as your AI provider keys.
- Jira data is cached locally inside your Buddy data folder. It is not sent anywhere except to your AI provider as part of the conversation context — the same as any other information Buddy works with.
- Buddy reads from Jira. It does not create, modify, or delete anything in your Jira instance.

## Limitations

- **Read-only.** Buddy can look up issues but cannot create, edit, transition, or comment on them. Write actions are planned for a future release.
- **Jira Cloud only.** Self-hosted Jira Server or Data Center instances are not supported.
- **No custom JQL.** You can't write raw JQL queries. Buddy translates your natural language into the right queries automatically.
- **No attachments or images.** Buddy reads issue text, comments, and metadata but cannot fetch or display file attachments from Jira.
- **Project prefixes required.** Buddy recognizes issue keys based on the prefixes you configure in Settings. If you work with a project whose prefix isn't listed, add it in Settings → Integrations → Jira.
