# Slack Connector

The Slack connector lets Buddy read your Slack conversations — threads, channel history, and DMs — so you can catch up on discussions, find what was said, or pull context into your work without switching apps.

## Setting it up

1. Open **Settings → Integrations** and expand the Slack panel.
2. You need two credentials from your Slack session:
   - **xoxc token** — your session authentication token.
   - **xoxd cookie** — your session cookie.
3. To extract these, use [slack-token-extractor](https://github.com/niclas3640/slack-token-extractor) — a browser extension that copies both values from an active Slack session.
4. Paste the values, test the connection, and save. Restart the session to activate.

**Note:** These are session credentials, not a bot token or OAuth app. They expire when your Slack session ends (browser logout, password change, or session timeout). If Buddy reports authentication errors, extract fresh credentials.

## What you can ask

### Read a thread

Share a Slack thread URL and Buddy fetches the full conversation.

- *"What does this thread say?"* + paste the URL — Buddy downloads the thread, resolves user mentions to real names, and saves it as a local file it can work with.
- *"Summarize the discussion at https://your-slack/archives/C04QLT849KN/p1788769405995369"* — fetches, reads, and summarizes.

### Catch up on a channel or DM

Ask about recent messages in a channel or DM.

- *"What did Ozan and I talk about today in Slack?"* — if Buddy knows the DM channel (from a previous lookup), it fetches today's messages directly. Otherwise, it asks you for a URL or channel ID.
- *"Show me what happened in #alerts-auto-toolchain today"* — fetches the channel's messages for the current day.
- *"What was discussed in D04SRFSJXL6 in the last 3 days?"* — you can also pass a channel ID directly, with a date range.

### Force a fresh fetch

If you know there are new messages since the last fetch:

- *"Refresh the thread at [URL]"* or add *"force refresh"* — bypasses the 1-hour cache and re-fetches from Slack.

## How it learns your contacts

The first time you ask about a conversation with someone, Buddy may not know which Slack channel or DM to look in — especially if your workspace restricts channel listing (common in Enterprise Grid). It will ask you for a URL or channel ID.

Once a channel is used successfully, Buddy remembers it. For DMs, it also records the other person's name. So the second time you ask *"What did I discuss with Avi?"*, Buddy already knows which DM to fetch.

This directory builds up naturally from use. You don't need to configure anything — just use it, and the most frequent channels and contacts accumulate automatically.

## How caching works

Buddy saves fetched conversations as local markdown files:

- **Threads and channel history** stay fresh for about 1 hour.
- After that, Buddy re-fetches automatically on the next request.
- Ask for a *force refresh* if you need the very latest before the cache expires.

When Slack is unreachable, Buddy serves the cached version and warns you that it may not be current.

## User name resolution

Slack messages contain raw user IDs like `<@U04NNGY4QQ2>`. Buddy resolves these to display names (`@Ozan Unsal`) before showing you the content. Resolved names are cached locally so repeated lookups are fast.

## Privacy

- Your Slack session credentials are stored locally with restrictive file permissions, in the same protected location as your AI provider keys.
- Fetched conversations are cached locally inside your Buddy data folder. They are not sent anywhere except to your AI provider as part of the conversation context.
- Buddy only reads from Slack. It does not post messages, react, or modify anything in your workspace.

## Limitations

- **Read-only.** Buddy can fetch and read conversations but cannot post messages, add reactions, or modify anything in Slack.
- **Session credentials.** Unlike Jira (which uses a stable API token), Slack requires session credentials that can expire. You may need to re-extract them periodically.
- **Channel listing may be restricted.** Corporate Slack workspaces (Enterprise Grid) often block the API for listing all channels. Buddy handles this gracefully — it asks you for a direct URL and remembers the channel for future use.
- **No search.** You can't search across all of Slack. Buddy works with specific threads and channels you point it to, then remembers them.
- **No file attachments.** Buddy reads message text, mentions, and reactions but cannot download files shared in Slack.
