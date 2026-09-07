// backends/connectors/slack-url-parser.ts — Parse Slack URLs and channel IDs (FR-SLACK-02).

export interface SlackRef {
  channelId: string;
  threadTs?: string;
}

const ARCHIVES_MSG_RE = /https?:\/\/[^/]+\/archives\/(?<channel>[A-Z0-9]+)\/p(?<ts>\d{16})/;
const ARCHIVES_CHANNEL_RE = /https?:\/\/[^/]+\/archives\/(?<channel>[A-Z0-9]+)\/?$/;
const THREAD_RE =
  /https?:\/\/[^/]+\/client\/[^/]+\/[^/]+\/thread\/(?<channel>[A-Z0-9]+)-(?<ts>\d+\.\d+)/;
const CHANNEL_ID_RE = /^[CDG][A-Z0-9]{8,}$/;

function tsFromPacked(packed: string): string {
  return `${packed.slice(0, 10)}.${packed.slice(10)}`;
}

export function parseSlackUrl(input: string): SlackRef {
  const url = input.trim();
  let match = ARCHIVES_MSG_RE.exec(url);
  if (match?.groups?.channel && match.groups.ts) {
    return {
      channelId: match.groups.channel,
      threadTs: tsFromPacked(match.groups.ts),
    };
  }

  match = THREAD_RE.exec(url);
  if (match?.groups?.channel && match.groups.ts) {
    return { channelId: match.groups.channel, threadTs: match.groups.ts };
  }

  match = ARCHIVES_CHANNEL_RE.exec(url);
  if (match?.groups?.channel) {
    return { channelId: match.groups.channel };
  }

  if (CHANNEL_ID_RE.test(url)) {
    return { channelId: url };
  }

  throw new Error(
    `Could not parse Slack URL or channel ID: ${url}. Expected a Slack URL or channel/DM ID.`,
  );
}

export function threadFileId(channelId: string, threadTs: string): string {
  return `${channelId}-${threadTs.replace(/\./g, "")}`;
}

export function channelFileId(channelId: string, dateLabel: string): string {
  const safeDate = dateLabel.replace(/[^0-9A-Za-z-]/g, "_");
  return `${channelId}-${safeDate}`;
}
