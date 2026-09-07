// backends/connectors/slack-actions.ts — Slack read actions (FR-SLACK-01..03).

import { join } from "node:path";

import type { ConnectorConfig, ConnectorResult } from "../../shared/connector-types";
import { CONNECTIONS_DIR } from "../../shared/defaults";
import {
  connectorResultFromCache,
  isCacheStale,
  readEntityStore,
  readThreadFile,
  writeEntityStore,
  writeThreadFile,
  type EntityStore,
} from "./cache";
import { readConnectorConfig } from "./credentials";
import {
  createSlackClient,
  isNetworkError,
  SlackClientError,
  type SlackClient,
  type SlackFetch,
  type SlackMessage,
} from "./slack-client";
import { connectorResultFromError } from "./slack-result";
import {
  channelFileId,
  parseSlackUrl,
  threadFileId,
} from "./slack-url-parser";
import { SLACK_DOMAIN, SlackUserResolver } from "./slack-users";

export { SLACK_DOMAIN };

export const FRESHNESS = {
  thread: "1h",
  channelHistory: "1h",
  channels: "1h",
} as const;

export interface SlackActionParams {
  force?: boolean;
  url?: string;
  channel?: string;
  date?: string;
  days?: number;
  limit?: number;
}

export interface ExecuteSlackActionOptions {
  fetchImpl?: SlackFetch;
  now?: () => Date;
  config?: ConnectorConfig;
}

function tsToDateTime(ts: string): string {
  return new Date(Number.parseFloat(ts) * 1000).toISOString().slice(0, 16).replace("T", " ");
}

function tsToTimeShort(ts: string): string {
  return new Date(Number.parseFloat(ts) * 1000).toISOString().slice(11, 16);
}

function renderAttachments(msg: SlackMessage): string {
  const parts: string[] = [];
  for (const att of msg.attachments ?? []) {
    const title = att.title ?? att.fallback ?? "(attachment)";
    const text = att.text ?? "";
    parts.push(text ? `> **${title}**\n> ${text}` : `> **${title}**`);
  }
  for (const file of msg.files ?? []) {
    const name = file.name ?? file.title ?? "(file)";
    const url = file.url_private ?? file.permalink ?? "";
    parts.push(url ? `📎 [${name}](${url})` : `📎 ${name}`);
  }
  return parts.join("\n");
}

function renderReactions(msg: SlackMessage): string {
  if (!msg.reactions?.length) return "";
  const parts = msg.reactions.map((r) => `:${r.name}: (${r.count})`);
  return `Reactions: ${parts.join(" ")}`;
}

async function resolveChannelName(client: SlackClient, channelId: string): Promise<string> {
  try {
    const info = await client.conversationsInfo(channelId);
    if (info.is_im) return `DM: ${channelId}`;
    return info.name ? `#${info.name}` : channelId;
  } catch {
    return channelId;
  }
}

async function renderThreadMarkdown(
  client: SlackClient,
  rootDir: string,
  channelId: string,
  messages: SlackMessage[],
): Promise<string> {
  const resolver = new SlackUserResolver(client, rootDir);
  if (!messages.length) {
    return `# Empty thread\nNo messages found in ${channelId}.`;
  }

  const root = messages[0]!;
  const rootText = await resolver.cleanText(root.text ?? "");
  const title = rootText.slice(0, 80).replace(/\n/g, " ") || "(no text)";
  const channelName = await resolveChannelName(client, channelId);

  const lines: string[] = [
    `# Thread: ${title}`,
    `Channel: ${channelName} | Date: ${tsToDateTime(root.ts)}`,
    `Messages: ${messages.length}`,
    "",
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const author = await resolver.resolve(msg.user ?? "unknown");
    const time = tsToTimeShort(msg.ts);
    const label = i === 0 ? "" : "  [reply]";
    const text = await resolver.cleanText(msg.text ?? "");
    const attachments = renderAttachments(msg);
    const reactions = renderReactions(msg);

    lines.push(`## ${author} (${time})${label}`, "");
    if (text) lines.push(text);
    if (attachments) lines.push("", attachments);
    if (reactions) lines.push("", reactions);
    lines.push("");
  }

  return lines.join("\n");
}

async function renderChannelMarkdown(
  client: SlackClient,
  rootDir: string,
  channelId: string,
  dateLabel: string,
  messages: SlackMessage[],
): Promise<string> {
  const resolver = new SlackUserResolver(client, rootDir);
  const channelName = await resolveChannelName(client, channelId);

  if (!messages.length) {
    return `# Empty channel history\nNo messages for ${channelId} on ${dateLabel}.`;
  }

  const lines: string[] = [
    `# ${channelName}`,
    `Channel: ${channelId} | Date: ${dateLabel} | Messages: ${messages.length}`,
    "",
  ];

  const skipSubtypes = new Set([
    "channel_join",
    "channel_leave",
    "channel_topic",
    "channel_purpose",
  ]);

  for (const msg of messages) {
    if (msg.subtype && skipSubtypes.has(msg.subtype)) continue;
    const author = await resolver.resolve(msg.user ?? "unknown");
    const time = tsToTimeShort(msg.ts);
    const text = await resolver.cleanText(msg.text ?? "");
    const attachments = renderAttachments(msg);
    const reactions = renderReactions(msg);
    const replyTag = msg.reply_count ? ` [${msg.reply_count} replies]` : "";

    lines.push(`## ${author} (${time})${replyTag}`, "");
    if (text) lines.push(text);
    if (attachments) lines.push("", attachments);
    if (reactions) lines.push("", reactions);
    lines.push("");
  }

  return lines.join("\n");
}

async function fetchAllReplies(
  client: SlackClient,
  channelId: string,
  threadTs: string,
): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;
  while (true) {
    const page = await client.conversationsReplies(channelId, threadTs, {
      limit: 200,
      cursor,
    });
    messages.push(...page.messages);
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  return messages;
}

async function fetchChannelHistory(
  client: SlackClient,
  channelId: string,
  oldest: string,
  latest: string,
  limit: number,
): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;
  while (messages.length < limit) {
    const page = await client.conversationsHistory(channelId, {
      oldest,
      latest,
      limit: Math.min(200, limit - messages.length),
      cursor,
    });
    messages.push(...page.messages);
    cursor = page.nextCursor;
    if (!cursor || !page.messages.length) break;
  }
  messages.sort((a, b) => Number.parseFloat(a.ts) - Number.parseFloat(b.ts));
  return messages.slice(0, limit);
}

function relThreadPath(threadId: string): string {
  return join(CONNECTIONS_DIR, SLACK_DOMAIN, "threads", `${threadId}.md`);
}

export function slackHelpText(): string {
  return `# Slack connector actions

| Action | Params | Description |
|--------|--------|-------------|
| help | — | List actions |
| thread | url (required), force? | Fetch one thread to a cache markdown file |
| channel_history | channel (required), date?, days?, limit?, force? | Fetch channel/DM window to cache file |
| channels | force? | List channels the user belongs to |

Set \`params.force: true\` to bypass cache freshness and re-fetch from Slack.`;
}

function channelEntityKey(channel: { id: string; name?: string; is_im?: boolean; is_private?: boolean; num_members?: number; user?: string; dm_peer_name?: string }) {
  return {
    synced_at: new Date().toISOString(),
    stale_after: FRESHNESS.channels,
    source: SLACK_DOMAIN,
    id: channel.id,
    name: channel.name ?? channel.id,
    is_im: channel.is_im ?? false,
    is_private: channel.is_private ?? false,
    num_members: channel.num_members ?? 0,
    ...(channel.user ? { user: channel.user } : {}),
    ...(channel.dm_peer_name ? { dm_peer_name: channel.dm_peer_name } : {}),
  };
}

/** Register a channel in the entity store so it's discoverable next time. */
async function registerChannelFromUse(
  client: SlackClient,
  rootDir: string,
  channelId: string,
): Promise<void> {
  try {
    const info = await client.conversationsInfo(channelId);
    const store = readEntityStore(rootDir, SLACK_DOMAIN);
    if (!store[channelId]) {
      let dmPeerName: string | undefined;
      if (info.is_im && info.user) {
        const resolver = new SlackUserResolver(client, rootDir);
        dmPeerName = await resolver.resolve(info.user);
      }
      store[channelId] = channelEntityKey({ ...info, dm_peer_name: dmPeerName });
      writeEntityStore(rootDir, SLACK_DOMAIN, store);
    }
  } catch {
    // Best-effort: don't fail the main action if directory update fails.
  }
}

export async function executeSlackAction(
  rootDir: string,
  action: string,
  params: SlackActionParams = {},
  options?: ExecuteSlackActionOptions,
): Promise<ConnectorResult> {
  if (action === "help") {
    return { data: slackHelpText(), stale: false };
  }

  const config = options?.config ?? readConnectorConfig(SLACK_DOMAIN);
  if (!config?.token || !config.cookie) {
    return connectorResultFromError({
      error: "Slack integration is not configured",
      code: 0,
      recoverable: false,
      suggestion: "Configure Slack in Settings → Integrations.",
    });
  }

  const client = createSlackClient(config, { fetchImpl: options?.fetchImpl });
  const force = params.force === true;

  switch (action) {
    case "thread": {
      if (!params.url) {
        return connectorResultFromError({
          error: "thread requires params.url",
          code: 0,
          recoverable: false,
          suggestion: "Pass a Slack thread URL or channel ID with thread timestamp.",
        });
      }
      let ref;
      try {
        ref = parseSlackUrl(params.url);
      } catch (err) {
        return connectorResultFromError({
          error: err instanceof Error ? err.message : String(err),
          code: 0,
          recoverable: false,
          suggestion: "slackErrorGeneric",
        });
      }
      if (!ref.threadTs) {
        return connectorResultFromError({
          error: "URL does not reference a thread",
          code: 0,
          recoverable: false,
          suggestion: "Use a Slack thread URL that includes a message timestamp.",
        });
      }

      const fileId = threadFileId(ref.channelId, ref.threadTs);
      const cached = readThreadFile(rootDir, SLACK_DOMAIN, fileId);
      if (!force && cached && !isCacheStale(cached.meta, false)) {
        const relPath = relThreadPath(fileId);
        return connectorResultFromCache(
          `Cached thread at ${relPath}\nMessages: ${(cached.body.match(/^## /gm) ?? []).length}\nRead the file locally for full content.`,
          cached.meta,
          { force: false },
        );
      }

      try {
        const messages = await fetchAllReplies(client, ref.channelId, ref.threadTs);
        const body = await renderThreadMarkdown(client, rootDir, ref.channelId, messages);
        const syncedAt = new Date().toISOString();
        writeThreadFile(
          rootDir,
          SLACK_DOMAIN,
          fileId,
          { synced_at: syncedAt, stale_after: FRESHNESS.thread, source: SLACK_DOMAIN },
          body,
        );
        await registerChannelFromUse(client, rootDir, ref.channelId);
        const relPath = relThreadPath(fileId);
        return {
          data: `Thread saved to ${relPath}\nMessages: ${messages.length}\nRead the file locally for full content.`,
          stale: false,
          synced_at: syncedAt,
        };
      } catch (err) {
        if (cached && isNetworkError(err)) {
          const relPath = relThreadPath(fileId);
          return connectorResultFromCache(
            `Cached thread at ${relPath}\nRead the file locally for full content.`,
            cached.meta,
            { force: true },
          );
        }
        if (err instanceof SlackClientError) {
          return connectorResultFromError(err.connectorError);
        }
        throw err;
      }
    }
    case "channel_history": {
      const channelInput = params.channel ?? params.url;
      if (!channelInput) {
        return connectorResultFromError({
          error: "channel_history requires params.channel",
          code: 0,
          recoverable: false,
          suggestion: "Pass a channel name, ID, or Slack URL.",
        });
      }

      let channelId: string;
      try {
        channelId = parseSlackUrl(channelInput).channelId;
      } catch {
        channelId = channelInput.startsWith("#") ? channelInput.slice(1) : channelInput;
      }

      const now = options?.now?.() ?? new Date();
      let oldest: string;
      let latest: string;
      let dateLabel: string;

      if (params.date) {
        const start = new Date(`${params.date}T00:00:00.000Z`);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        oldest = String(start.getTime() / 1000);
        latest = String(end.getTime() / 1000);
        dateLabel = params.date;
      } else {
        const days = params.days ?? 1;
        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - (days - 1));
        oldest = String(start.getTime() / 1000);
        latest = String(now.getTime() / 1000);
        dateLabel =
          days === 1
            ? start.toISOString().slice(0, 10)
            : `${start.toISOString().slice(0, 10)}-${now.toISOString().slice(0, 10)}`;
      }

      const fileId = channelFileId(channelId, dateLabel);
      const cached = readThreadFile(rootDir, SLACK_DOMAIN, fileId);
      if (!force && cached && !isCacheStale(cached.meta, false)) {
        const relPath = relThreadPath(fileId);
        return connectorResultFromCache(
          `Cached channel history at ${relPath}\nRead the file locally for full content.`,
          cached.meta,
          { force: false },
        );
      }

      const limit = params.limit ?? 500;
      try {
        const messages = await fetchChannelHistory(client, channelId, oldest, latest, limit);
        const body = await renderChannelMarkdown(client, rootDir, channelId, dateLabel, messages);
        const syncedAt = new Date().toISOString();
        writeThreadFile(
          rootDir,
          SLACK_DOMAIN,
          fileId,
          { synced_at: syncedAt, stale_after: FRESHNESS.channelHistory, source: SLACK_DOMAIN },
          body,
        );
        await registerChannelFromUse(client, rootDir, channelId);
        const relPath = relThreadPath(fileId);
        return {
          data: `Channel history saved to ${relPath}\nMessages: ${messages.length}\nRead the file locally for full content.`,
          stale: false,
          synced_at: syncedAt,
        };
      } catch (err) {
        if (cached && isNetworkError(err)) {
          const relPath = relThreadPath(fileId);
          return connectorResultFromCache(
            `Cached channel history at ${relPath}\nRead the file locally for full content.`,
            cached.meta,
            { force: true },
          );
        }
        if (err instanceof SlackClientError) {
          return connectorResultFromError(err.connectorError);
        }
        throw err;
      }
    }
    case "channels": {
      const entityStore = readEntityStore(rootDir, SLACK_DOMAIN);
      const cachedMeta = entityStore.__channels_list__ as EntityStore[string] | undefined;
      if (!force && cachedMeta && !isCacheStale(cachedMeta, false)) {
        const lines = Object.values(entityStore)
          .filter((e) => e.id && e.id !== "__channels_list__")
          .map((e) => `${e.name ?? e.id} (${e.id}) — ${e.num_members ?? 0} members`);
        return connectorResultFromCache(lines.join("\n"), cachedMeta, { force: false });
      }

      try {
        const allChannels: Array<{
          id: string;
          name?: string;
          is_private?: boolean;
          num_members?: number;
        }> = [];
        let cursor: string | undefined;
        while (true) {
          const page = await client.conversationsList({ limit: 200, cursor });
          allChannels.push(...page.channels);
          cursor = page.nextCursor;
          if (!cursor) break;
        }

        const syncedAt = new Date().toISOString();
        const nextStore: EntityStore = {
          __channels_list__: {
            synced_at: syncedAt,
            stale_after: FRESHNESS.channels,
            source: SLACK_DOMAIN,
            id: "__channels_list__",
            name: "channels_list",
          },
        };
        for (const ch of allChannels) {
          nextStore[ch.id] = channelEntityKey(ch);
        }
        writeEntityStore(rootDir, SLACK_DOMAIN, nextStore);

        const lines = allChannels.map(
          (ch) => `${ch.name ? `#${ch.name}` : ch.id} (${ch.id}) — ${ch.num_members ?? 0} members`,
        );
        return {
          data: lines.join("\n") || "(no channels)",
          stale: false,
          synced_at: syncedAt,
        };
      } catch (err) {
        if (cachedMeta && isNetworkError(err)) {
          const lines = Object.values(entityStore)
            .filter((e) => e.id && e.id !== "__channels_list__")
            .map((e) => `${e.name ?? e.id} (${e.id})`);
          return connectorResultFromCache(lines.join("\n"), cachedMeta, { force: true });
        }
        if (err instanceof SlackClientError) {
          return connectorResultFromError(err.connectorError);
        }
        throw err;
      }
    }
    default:
      return connectorResultFromError({
        error: `Unknown action '${action}'`,
        code: 0,
        recoverable: false,
        suggestion: "Use action='help' to see available actions.",
      });
  }
}
