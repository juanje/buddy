# Connectors

Connectors let Buddy read information from external services you already use — like your project tracker or team chat — and bring it into the conversation. Instead of switching apps to check a ticket or catch up on what changed, you ask Buddy and it fetches what you need.

## How connectors work

Each connector talks to one service. You configure it once in **Settings → Integrations**, and from then on Buddy can query that service during your conversations.

Connectors are **read-only by default**. They fetch information so Buddy can help you think about it, cross-reference it with your own context, or summarize it — but they don't create, modify, or delete anything in the external service unless you explicitly enable write actions in a future release.

## Setup

1. Open **Settings** (gear icon or Cmd/Ctrl+,) → **Integrations** tab.
2. Enable the connector and enter your credentials.
3. Test the connection — Buddy verifies it can reach the service.
4. Save. **Restart the session** for the connector to become active.

Credentials are stored locally on your machine with restrictive file permissions, just like your AI provider keys. They are never sent anywhere except the service they authenticate to. See [Privacy](privacy.md) for more on how Buddy handles your data.

## Caching

Connectors cache what they fetch so they don't hit the service on every question. How long data stays fresh depends on the type of query — from a few minutes for rapidly changing lists to a full day for historical reports. If you need the absolute latest, just ask Buddy to refresh and it will bypass the cache.

When Buddy can't reach a service (network down, server error), it serves what it has from cache and tells you the data may be stale.

## Available connectors

- [Jira](connectors/jira.md) — project and issue tracking.
- [Slack](connectors/slack.md) — team chat, threads, and DMs.

More connectors are planned. If asked about a service that's not listed here, say so clearly.
