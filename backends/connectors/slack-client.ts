// backends/connectors/slack-client.ts — Slack Web API client (FR-SLACK-01/02).

import type { ConnectorConfig, ConnectorError } from "../../shared/connector-types";
import { PROVIDER_REQUEST_TIMEOUT_MS } from "../../shared/defaults";

export type SlackFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface SlackClientOptions {
  fetchImpl?: SlackFetch;
  timeoutMs?: number;
  /** Delay between paginated requests (ms). */
  pageDelayMs?: number;
  maxRetries?: number;
}

export class SlackClientError extends Error {
  constructor(
    message: string,
    readonly connectorError: ConnectorError,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SlackClientError";
  }
}

export interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  subtype?: string;
  reply_count?: number;
  reactions?: Array<{ name: string; count: number }>;
  attachments?: Array<{ title?: string; fallback?: string; text?: string }>;
  files?: Array<{ name?: string; title?: string; url_private?: string; permalink?: string }>;
}

export interface SlackChannel {
  id: string;
  name?: string;
  is_im?: boolean;
  is_private?: boolean;
  num_members?: number;
  user?: string;
}

export interface SlackClient {
  authTest(): Promise<{ ok: boolean; user?: string; team?: string }>;
  conversationsReplies(
    channel: string,
    ts: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ messages: SlackMessage[]; nextCursor?: string }>;
  conversationsHistory(
    channel: string,
    options?: { oldest?: string; latest?: string; limit?: number; cursor?: string },
  ): Promise<{ messages: SlackMessage[]; nextCursor?: string }>;
  conversationsInfo(channel: string): Promise<SlackChannel>;
  conversationsList(options?: {
    types?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ channels: SlackChannel[]; nextCursor?: string }>;
  usersInfo(user: string): Promise<{ id: string; displayName: string }>;
}

const SLACK_API_BASE = "https://slack.com/api";

export function mapSlackApiError(error: string, retryAfter?: string | null): ConnectorError {
  if (error === "invalid_auth" || error === "token_revoked" || error === "account_inactive") {
    return {
      error: "Slack authentication failed",
      code: 401,
      recoverable: false,
      suggestion: "slackError401",
    };
  }
  if (error === "missing_scope" || error === "not_authed") {
    return {
      error: "Insufficient Slack permissions",
      code: 403,
      recoverable: false,
      suggestion: "slackError403",
    };
  }
  if (error === "enterprise_is_restricted") {
    return {
      error: "Enterprise workspace restricts this API method",
      code: 403,
      recoverable: false,
      suggestion: "slackErrorEnterprise",
    };
  }
  if (error === "channel_not_found" || error === "thread_not_found" || error === "user_not_found") {
    return {
      error: "Slack resource not found",
      code: 404,
      recoverable: false,
      suggestion: "slackError404",
    };
  }
  if (error === "ratelimited") {
    return {
      error: retryAfter
        ? `Slack rate limit exceeded (retry after ${retryAfter}s)`
        : "Slack rate limit exceeded",
      code: 429,
      recoverable: true,
      suggestion: "slackError429",
    };
  }
  return {
    error: `Slack request failed (${error})`,
    code: 0,
    recoverable: false,
    suggestion: "slackErrorGeneric",
  };
}

export function mapSlackHttpError(status: number, retryAfter?: string | null): ConnectorError {
  if (status === 401) {
    return {
      error: "Slack authentication failed",
      code: 401,
      recoverable: false,
      suggestion: "slackError401",
    };
  }
  if (status === 403) {
    return {
      error: "Insufficient Slack permissions",
      code: 403,
      recoverable: false,
      suggestion: "slackError403",
    };
  }
  if (status === 404) {
    return {
      error: "Slack resource not found",
      code: 404,
      recoverable: false,
      suggestion: "slackError404",
    };
  }
  if (status === 429) {
    return {
      error: retryAfter
        ? `Slack rate limit exceeded (retry after ${retryAfter}s)`
        : "Slack rate limit exceeded",
      code: 429,
      recoverable: true,
      suggestion: "slackError429",
    };
  }
  if (status >= 500) {
    return {
      error: `Slack server error (HTTP ${status})`,
      code: status,
      recoverable: true,
      suggestion: "slackError5xx",
    };
  }
  return {
    error: `Slack request failed (HTTP ${status})`,
    code: status,
    recoverable: false,
    suggestion: "slackErrorGeneric",
  };
}

export function mapNetworkError(err: unknown): ConnectorError {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return {
      error: "Slack did not respond in time",
      code: 0,
      recoverable: true,
      suggestion: "slackErrorTimeout",
    };
  }
  return {
    error: err instanceof Error ? err.message : String(err),
    code: 0,
    recoverable: true,
    suggestion: "slackErrorNetwork",
  };
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof SlackClientError) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSlackClient(config: ConnectorConfig, options?: SlackClientOptions): SlackClient {
  const token = config.token ?? "";
  const cookie = config.cookie ?? "";
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? PROVIDER_REQUEST_TIMEOUT_MS;
  const pageDelayMs = options?.pageDelayMs ?? 0;
  const maxRetries = options?.maxRetries ?? 3;

  if (!token || !cookie) {
    throw new SlackClientError("Slack is not configured", {
      error: "Slack integration is not configured",
      code: 0,
      recoverable: false,
      suggestion: "slackErrorNotConfigured",
    });
  }

  async function apiCall<T extends { ok: boolean; error?: string }>(
    method: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) body.set(key, String(value));
    }

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        const response = await fetchImpl(`${SLACK_API_BASE}/${method}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            cookie: `d=${cookie}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const connectorError = mapSlackHttpError(
            response.status,
            response.headers.get("retry-after"),
          );
          if (connectorError.code === 429 && attempt < maxRetries) {
            const waitSec = Number.parseInt(response.headers.get("retry-after") ?? "1", 10);
            await sleep(Math.max(waitSec, 1) * 1000);
            continue;
          }
          throw new SlackClientError(connectorError.error, connectorError);
        }

        const data = (await response.json()) as T & {
          error?: string;
          response_metadata?: { next_cursor?: string };
        };
        if (!data.ok) {
          const connectorError = mapSlackApiError(
            data.error ?? "unknown_error",
            response.headers.get("retry-after"),
          );
          if (connectorError.code === 429 && attempt < maxRetries) {
            const waitSec = Number.parseInt(response.headers.get("retry-after") ?? "1", 10);
            await sleep(Math.max(waitSec, 1) * 1000);
            continue;
          }
          throw new SlackClientError(connectorError.error, connectorError);
        }
        return data;
      } catch (err) {
        if (err instanceof SlackClientError) throw err;
        const connectorError = mapNetworkError(err);
        throw new SlackClientError(connectorError.error, connectorError, err);
      }
    }
  }

  return {
    async authTest() {
      const data = await apiCall<{ ok: boolean; user?: string; team?: string; error?: string }>(
        "auth.test",
      );
      return { ok: data.ok, user: data.user, team: data.team };
    },
    async conversationsReplies(channel, ts, opts) {
      const data = await apiCall<{
        ok: boolean;
        messages?: SlackMessage[];
        response_metadata?: { next_cursor?: string };
        error?: string;
      }>("conversations.replies", {
        channel,
        ts,
        limit: opts?.limit ?? 200,
        cursor: opts?.cursor,
      });
      if (pageDelayMs > 0 && data.response_metadata?.next_cursor) {
        await sleep(pageDelayMs);
      }
      return {
        messages: data.messages ?? [],
        nextCursor: data.response_metadata?.next_cursor || undefined,
      };
    },
    async conversationsHistory(channel, opts) {
      const data = await apiCall<{
        ok: boolean;
        messages?: SlackMessage[];
        response_metadata?: { next_cursor?: string };
        error?: string;
      }>("conversations.history", {
        channel,
        oldest: opts?.oldest,
        latest: opts?.latest,
        limit: opts?.limit ?? 200,
        cursor: opts?.cursor,
      });
      if (pageDelayMs > 0 && data.response_metadata?.next_cursor) {
        await sleep(pageDelayMs);
      }
      return {
        messages: data.messages ?? [],
        nextCursor: data.response_metadata?.next_cursor || undefined,
      };
    },
    async conversationsInfo(channel) {
      const data = await apiCall<{ ok: boolean; channel?: SlackChannel; error?: string }>(
        "conversations.info",
        { channel },
      );
      return data.channel ?? { id: channel };
    },
    async conversationsList(opts) {
      const data = await apiCall<{
        ok: boolean;
        channels?: SlackChannel[];
        response_metadata?: { next_cursor?: string };
        error?: string;
      }>("conversations.list", {
        types: opts?.types ?? "public_channel,private_channel,mpim,im",
        limit: opts?.limit ?? 200,
        cursor: opts?.cursor,
      });
      if (pageDelayMs > 0 && data.response_metadata?.next_cursor) {
        await sleep(pageDelayMs);
      }
      return {
        channels: data.channels ?? [],
        nextCursor: data.response_metadata?.next_cursor || undefined,
      };
    },
    async usersInfo(user) {
      const data = await apiCall<{
        ok: boolean;
        user?: {
          id?: string;
          real_name?: string;
          profile?: { display_name?: string; real_name?: string };
        };
        error?: string;
      }>("users.info", { user });
      const u = data.user;
      const displayName =
        u?.profile?.display_name ||
        u?.profile?.real_name ||
        u?.real_name ||
        user;
      return { id: u?.id ?? user, displayName };
    },
  };
}

export async function testSlackConnection(
  config: ConnectorConfig,
  options?: SlackClientOptions,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = createSlackClient(config, options);
    const result = await client.authTest();
    return result.ok ? { ok: true } : { ok: false, error: "slackErrorGeneric" };
  } catch (err) {
    if (err instanceof SlackClientError) {
      return { ok: false, error: err.connectorError.suggestion ?? err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
