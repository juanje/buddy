// backends/connectors/slack-users.ts — Slack user ID resolution with bounded cache (FR-SLACK-03).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assertCacheContainment, connectionsDir } from "./cache";
import type { SlackClient } from "./slack-client";

export const SLACK_DOMAIN = "slack";
export const SLACK_USER_CACHE_MAX = 500;

export interface SlackUserCacheEntry {
  displayName: string;
  synced_at: string;
}

export type SlackUserCache = Record<string, SlackUserCacheEntry>;

function userCachePath(rootDir: string): string {
  return join(connectionsDir(rootDir, SLACK_DOMAIN), "users.json");
}

export function readSlackUserCache(rootDir: string): SlackUserCache {
  const path = userCachePath(rootDir);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SlackUserCache;
  } catch {
    return {};
  }
}

export function writeSlackUserCache(rootDir: string, cache: SlackUserCache): void {
  const path = userCachePath(rootDir);
  assertCacheContainment(path, rootDir);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2), "utf8");
}

function pruneSlackUserCache(cache: SlackUserCache): SlackUserCache {
  const entries = Object.entries(cache);
  if (entries.length <= SLACK_USER_CACHE_MAX) return cache;
  entries.sort((a, b) => Date.parse(a[1].synced_at) - Date.parse(b[1].synced_at));
  const kept = entries.slice(entries.length - SLACK_USER_CACHE_MAX);
  return Object.fromEntries(kept);
}

const USER_MENTION_RE = /<@(U[A-Z0-9]+)>/g;
const CHANNEL_MENTION_RE = /<#(C[A-Z0-9]+)\|([^>]+)>/g;
const LINK_RE = /<((?:https?:\/\/)[^|>]+)(?:\|([^>]+))?>/g;

export class SlackUserResolver {
  private cache: SlackUserCache;

  constructor(
    private readonly client: SlackClient,
    private readonly rootDir: string,
  ) {
    this.cache = readSlackUserCache(rootDir);
  }

  async resolve(userId: string): Promise<string> {
    if (!userId || userId === "unknown") return "unknown";
    const cached = this.cache[userId];
    if (cached) return cached.displayName;

    try {
      const info = await this.client.usersInfo(userId);
      this.cache[userId] = {
        displayName: info.displayName,
        synced_at: new Date().toISOString(),
      };
      this.cache = pruneSlackUserCache(this.cache);
      writeSlackUserCache(this.rootDir, this.cache);
      return info.displayName;
    } catch {
      this.cache[userId] = { displayName: userId, synced_at: new Date().toISOString() };
      writeSlackUserCache(this.rootDir, this.cache);
      return userId;
    }
  }

  async resolveMention(userId: string): Promise<string> {
    return `@${await this.resolve(userId)}`;
  }

  async cleanText(text: string): Promise<string> {
    let result = text;
    const userIds = [...text.matchAll(USER_MENTION_RE)].map((m) => m[1]!);
    for (const userId of userIds) {
      const mention = await this.resolveMention(userId);
      result = result.replace(new RegExp(`<@${userId}>`, "g"), mention);
    }
    result = result.replace(CHANNEL_MENTION_RE, "#$2");
    result = result.replace(LINK_RE, (_m, url: string, label?: string) =>
      label ? `[${label}](${url})` : url,
    );
    return result;
  }

  getCache(): SlackUserCache {
    return this.cache;
  }
}
