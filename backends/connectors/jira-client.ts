// backends/connectors/jira-client.ts — Jira REST client (FR-JIRA-01/05).

import type { ConnectorConfig, ConnectorError } from "../../shared/connector-types";
import { PROVIDER_REQUEST_TIMEOUT_MS } from "../../shared/defaults";

export type JiraFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface JiraClientOptions {
  fetchImpl?: JiraFetch;
  timeoutMs?: number;
}

export class JiraClientError extends Error {
  constructor(
    message: string,
    readonly connectorError: ConnectorError,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "JiraClientError";
  }
}

export function buildJiraAuthHeader(email: string, token: string): string {
  const encoded = Buffer.from(`${email}:${token}`, "utf8").toString("base64");
  return `Basic ${encoded}`;
}

export function normalizeJiraBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function mapJiraHttpError(status: number, retryAfter?: string | null): ConnectorError {
  if (status === 401) {
    return {
      error: "Jira authentication failed",
      code: 401,
      recoverable: false,
      suggestion: "jiraError401",
    };
  }
  if (status === 403) {
    return {
      error: "Insufficient Jira permissions",
      code: 403,
      recoverable: false,
      suggestion: "jiraError403",
    };
  }
  if (status === 404) {
    return {
      error: "Jira resource not found",
      code: 404,
      recoverable: false,
      suggestion: "jiraError404",
    };
  }
  if (status === 429) {
    return {
      error: retryAfter
        ? `Jira rate limit exceeded (retry after ${retryAfter}s)`
        : "Jira rate limit exceeded",
      code: 429,
      recoverable: true,
      suggestion: "jiraError429",
    };
  }
  if (status >= 500) {
    return {
      error: `Jira server error (HTTP ${status})`,
      code: status,
      recoverable: true,
      suggestion: "jiraError5xx",
    };
  }
  return {
    error: `Jira request failed (HTTP ${status})`,
    code: status,
    recoverable: false,
    suggestion: "jiraErrorGeneric",
  };
}

export function mapNetworkError(err: unknown): ConnectorError {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return {
      error: "Jira did not respond in time",
      code: 0,
      recoverable: true,
      suggestion: "jiraErrorTimeout",
    };
  }
  return {
    error: err instanceof Error ? err.message : String(err),
    code: 0,
    recoverable: true,
    suggestion: "jiraErrorNetwork",
  };
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof JiraClientError) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return true;
  }
  return false;
}

export interface JiraUser {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
  active?: boolean;
}

export interface JiraClient {
  baseUrl: string;
  request<T>(path: string, init?: RequestInit): Promise<T>;
  searchJql(jql: string, fields: string[], maxResults?: number): Promise<JiraSearchResponse>;
  getBoardIssues(boardId: string, jql?: string): Promise<JiraSearchResponse>;
  getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue>;
  getComments(issueKey: string): Promise<JiraCommentsResponse>;
  searchUsers(query: string): Promise<JiraUser[]>;
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total?: number;
}

export interface JiraIssue {
  key: string;
  fields: Record<string, unknown>;
}

export interface JiraCommentsResponse {
  comments: Array<{ author?: { displayName?: string }; body?: unknown; created?: string }>;
}

const DEFAULT_FIELDS = [
  "summary",
  "status",
  "assignee",
  "priority",
  "duedate",
  "updated",
  "parent",
  "issuelinks",
  "description",
  "comment",
];

export function createJiraClient(config: ConnectorConfig, options?: JiraClientOptions): JiraClient {
  const baseUrl = normalizeJiraBaseUrl(config.baseUrl ?? "");
  const email = config.email ?? "";
  const token = config.token ?? "";
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? PROVIDER_REQUEST_TIMEOUT_MS;

  if (!baseUrl || !email || !token) {
    throw new JiraClientError("Jira is not configured", {
      error: "Jira integration is not configured",
      code: 0,
      recoverable: false,
      suggestion: "jiraErrorNotConfigured",
    });
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const response = await fetchImpl(url, {
        ...init,
        headers: {
          authorization: buildJiraAuthHeader(email, token),
          accept: "application/json",
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const connectorError = mapJiraHttpError(
          response.status,
          response.headers.get("retry-after"),
        );
        throw new JiraClientError(connectorError.error, connectorError);
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof JiraClientError) throw err;
      const connectorError = mapNetworkError(err);
      throw new JiraClientError(connectorError.error, connectorError, err);
    }
  }

  return {
    baseUrl,
    request,
    async searchJql(jql: string, fields: string[], maxResults = 50) {
      return request<JiraSearchResponse>("/rest/api/3/search/jql", {
        method: "POST",
        body: JSON.stringify({ jql, fields, maxResults }),
      });
    },
    async getBoardIssues(boardId: string, jql?: string) {
      const params = new URLSearchParams();
      if (jql) params.set("jql", jql);
      const query = params.toString();
      const path = `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/issue${
        query ? `?${query}` : ""
      }`;
      return request<JiraSearchResponse>(path);
    },
    async getIssue(issueKey: string, fields = DEFAULT_FIELDS) {
      const query = new URLSearchParams({ fields: fields.join(",") });
      return request<JiraIssue>(`/rest/api/3/issue/${encodeURIComponent(issueKey)}?${query}`);
    },
    async getComments(issueKey: string) {
      return request<JiraCommentsResponse>(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
      );
    },
    async searchUsers(query: string) {
      const params = new URLSearchParams({ query, maxResults: "5" });
      return request<JiraUser[]>(`/rest/api/3/user/search?${params}`);
    },
  };
}

export async function testJiraConnection(
  config: ConnectorConfig,
  options?: JiraClientOptions,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = createJiraClient(config, options);
    await client.request<{ accountId?: string }>("/rest/api/3/myself");
    return { ok: true };
  } catch (err) {
    if (err instanceof JiraClientError) {
      return { ok: false, error: err.connectorError.suggestion ?? err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
