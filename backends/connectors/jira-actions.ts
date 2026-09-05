// backends/connectors/jira-actions.ts — Jira read actions (FR-JIRA-02/03/05).

import type { ConnectorConfig, ConnectorResult } from "../../shared/connector-types";
import { renderAdfToText } from "./adf-renderer";
import {
  createJiraClient,
  isNetworkError,
  JiraClientError,
  type JiraClient,
  type JiraFetch,
  type JiraIssue,
} from "./jira-client";
import {
  connectorResultFromCache,
  isCacheStale,
  readEntityStore,
  readQueryStore,
  writeEntityStore,
  writeQueryStore,
  type EntityStore,
  type QueryStore,
} from "./cache";
import { readConnectorConfig } from "./credentials";
import { connectorResultFromError } from "./jira-result";

export const JIRA_DOMAIN = "jira";

export const FRESHNESS = {
  board: "15m",
  myIssues: "15m",
  issueDetail: "30m",
  epicChildren: "1h",
  recentChanges: "15m",
  periodReport: "24h",
  issuesByKey: "15m",
} as const;

export interface JiraActionParams {
  force?: boolean;
  assignee?: string;
  days?: number;
  keys?: string[];
  key?: string;
  epicKey?: string;
  start?: string;
  end?: string;
  username?: string;
}

export interface ExecuteJiraActionOptions {
  fetchImpl?: JiraFetch;
  now?: () => Date;
  config?: ConnectorConfig;
}

function statusName(fields: Record<string, unknown>): string {
  const status = fields.status as { name?: string } | undefined;
  return status?.name ?? "Unknown";
}

function assigneeName(fields: Record<string, unknown>): string {
  const assignee = fields.assignee as { displayName?: string } | undefined;
  return assignee?.displayName ?? "Unassigned";
}

function priorityName(fields: Record<string, unknown>): string {
  const priority = fields.priority as { name?: string } | undefined;
  return priority?.name ?? "None";
}

function sprintName(fields: Record<string, unknown>): string | undefined {
  const sprint = fields.customfield_10020 as Array<{ name?: string }> | undefined;
  return sprint?.[0]?.name;
}

export function issueToCacheEntry(issue: JiraIssue, staleAfter: string): EntityStore[string] {
  const fields = issue.fields;
  return {
    synced_at: new Date().toISOString(),
    stale_after: staleAfter,
    source: JIRA_DOMAIN,
    key: issue.key,
    summary: fields.summary ?? "",
    status: statusName(fields),
    assignee: assigneeName(fields),
    priority: priorityName(fields),
    duedate: fields.duedate ?? null,
    updated: fields.updated ?? null,
    sprint: sprintName(fields),
  };
}

export function formatIssueLine(entry: EntityStore[string]): string {
  const parts = [
    entry.key,
    entry.summary,
    `Status: ${entry.status}`,
    `Assignee: ${entry.assignee}`,
  ];
  if (entry.priority) parts.push(`Priority: ${entry.priority}`);
  if (entry.duedate) parts.push(`Due: ${entry.duedate}`);
  return parts.join(" | ");
}

function queryIsFresh(store: QueryStore | undefined, force: boolean): boolean {
  if (!store) return false;
  return !isCacheStale(store, force);
}

function entitiesForKeys(
  rootDir: string,
  keys: string[],
  force: boolean,
): { lines: string[]; allFresh: boolean; syncedAt?: string } {
  const entityStore = readEntityStore(rootDir, JIRA_DOMAIN);
  const lines: string[] = [];
  let allFresh = true;
  let syncedAt: string | undefined;
  for (const key of keys) {
    const entry = entityStore[key];
    if (!entry) {
      allFresh = false;
      continue;
    }
    if (isCacheStale(entry, force)) allFresh = false;
    else syncedAt = entry.synced_at;
    lines.push(formatIssueLine(entry));
  }
  return { lines, allFresh, syncedAt };
}

async function refreshIssues(
  client: JiraClient,
  rootDir: string,
  jql: string,
  queryId: string,
  staleAfter: string,
  fields: string[],
): Promise<{ keys: string[]; syncedAt: string }> {
  const response = await client.searchJql(jql, fields);
  const entityStore = readEntityStore(rootDir, JIRA_DOMAIN);
  const keys: string[] = [];
  const syncedAt = new Date().toISOString();
  for (const issue of response.issues ?? []) {
    keys.push(issue.key);
    entityStore[issue.key] = issueToCacheEntry(issue, staleAfter);
  }
  writeEntityStore(rootDir, JIRA_DOMAIN, entityStore);
  writeQueryStore(rootDir, JIRA_DOMAIN, queryId, {
    keys,
    synced_at: syncedAt,
    stale_after: staleAfter,
    source: JIRA_DOMAIN,
  });
  return { keys, syncedAt };
}

async function serveCachedOrFetch(
  rootDir: string,
  queryId: string,
  force: boolean,
  fetchFresh: () => Promise<{ keys: string[]; syncedAt: string }>,
): Promise<ConnectorResult> {
  const query = readQueryStore(rootDir, JIRA_DOMAIN, queryId);
  if (!force && queryIsFresh(query, false)) {
    const { lines } = entitiesForKeys(rootDir, query!.keys, false);
    return connectorResultFromCache(lines.join("\n"), query!, { force: false });
  }
  try {
    const { keys, syncedAt } = await fetchFresh();
    const { lines } = entitiesForKeys(rootDir, keys, false);
    return { data: lines.join("\n"), stale: false, synced_at: syncedAt };
  } catch (err) {
    if (query && (isNetworkError(err) || (err instanceof JiraClientError && err.connectorError.recoverable))) {
      const { lines } = entitiesForKeys(rootDir, query.keys, true);
      if (lines.length > 0) {
        return connectorResultFromCache(lines.join("\n"), query, { force: true });
      }
    }
    if (err instanceof JiraClientError) {
      return connectorResultFromError(err.connectorError);
    }
    throw err;
  }
}

export function jiraHelpText(): string {
  return `# Jira connector actions

| Action | Params | Description |
|--------|--------|-------------|
| help | — | List actions |
| board | assignee?, force? | Open sprint issues |
| my_issues | force? | Your open issues |
| issue_detail | key (required), force? | Full issue with description/comments |
| issues_by_key | keys[] (required), force? | Bulk status for keys |
| epic_children | epicKey or key (required), force? | Children of an epic |
| recent_changes | days? (default 7), force? | Recently updated issues |
| period_report | start, end, username?, force? | Resolved issues in date range |

Set \`params.force: true\` to bypass cache freshness.`;
}

export function extractIssueKeys(text: string, patterns: string[]): string[] {
  const keys = new Set<string>();
  for (const pattern of patterns) {
    try {
      const re = new RegExp(`\\b(${pattern})\\b`, "gi");
      for (const match of text.matchAll(re)) {
        if (match[1]) keys.add(match[1].toUpperCase());
      }
    } catch {
      // Invalid pattern — skip.
    }
  }
  return [...keys];
}

function formatIssueLinks(fields: Record<string, unknown>): string {
  const links = fields.issuelinks as
    | Array<{
        type?: { outward?: string; inward?: string };
        outwardIssue?: { key?: string };
        inwardIssue?: { key?: string };
      }>
    | undefined;
  if (!links?.length) return "";
  const lines = links.map((link) => {
    if (link.outwardIssue?.key) {
      return `- ${link.type?.outward ?? "relates"} ${link.outwardIssue.key}`;
    }
    if (link.inwardIssue?.key) {
      return `- ${link.type?.inward ?? "related by"} ${link.inwardIssue.key}`;
    }
    return "- (link)";
  });
  return `\nLinks:\n${lines.join("\n")}`;
}

function formatParent(fields: Record<string, unknown>): string {
  const parent = fields.parent as { key?: string; fields?: { summary?: string } } | undefined;
  if (!parent?.key) return "";
  const summary = parent.fields?.summary ? ` — ${parent.fields.summary}` : "";
  return `\nParent: ${parent.key}${summary}`;
}

export async function executeJiraAction(
  rootDir: string,
  action: string,
  params: JiraActionParams = {},
  options?: ExecuteJiraActionOptions,
): Promise<ConnectorResult> {
  if (action === "help") {
    return { data: jiraHelpText(), stale: false };
  }

  const config = options?.config ?? readConnectorConfig(JIRA_DOMAIN);
  if (!config?.baseUrl || !config.email || !config.token) {
    return connectorResultFromError({
      error: "Jira integration is not configured",
      code: 0,
      recoverable: false,
      suggestion: "Configure Jira in Settings → Integrations.",
    });
  }

  const client = createJiraClient(config, { fetchImpl: options?.fetchImpl });
  const force = params.force === true;

  switch (action) {
    case "board": {
      const assignee = params.assignee ?? "currentUser()";
      const jql = `sprint in openSprints() AND assignee = ${assignee} ORDER BY rank`;
      return serveCachedOrFetch(rootDir, "board", force, () =>
        refreshIssues(client, rootDir, jql, "board", FRESHNESS.board, [
          "summary",
          "status",
          "assignee",
          "priority",
          "duedate",
          "updated",
        ]),
      );
    }
    case "my_issues": {
      const jql = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
      return serveCachedOrFetch(rootDir, "my_issues", force, () =>
        refreshIssues(client, rootDir, jql, "my_issues", FRESHNESS.myIssues, [
          "summary",
          "status",
          "assignee",
          "priority",
          "duedate",
          "updated",
        ]),
      );
    }
    case "recent_changes": {
      const days = params.days ?? 7;
      const jql = `updated >= -${days}d ORDER BY updated DESC`;
      return serveCachedOrFetch(rootDir, `recent_${days}d`, force, () =>
        refreshIssues(client, rootDir, jql, `recent_${days}d`, FRESHNESS.recentChanges, [
          "summary",
          "status",
          "assignee",
          "updated",
        ]),
      );
    }
    case "period_report": {
      if (!params.start || !params.end) {
        return connectorResultFromError({
          error: "period_report requires start and end dates",
          code: 0,
          recoverable: false,
          suggestion: "Use params.start and params.end (YYYY-MM-DD).",
        });
      }
      const userClause = params.username ? ` AND assignee = "${params.username}"` : "";
      const jql = `resolutiondate >= "${params.start}" AND resolutiondate <= "${params.end}"${userClause} ORDER BY resolutiondate DESC`;
      const queryId = `period_${params.start}_${params.end}_${params.username ?? "all"}`;
      return serveCachedOrFetch(rootDir, queryId, force, () =>
        refreshIssues(client, rootDir, jql, queryId, FRESHNESS.periodReport, [
          "summary",
          "status",
          "assignee",
          "updated",
          "resolutiondate",
        ]),
      );
    }
    case "issues_by_key": {
      const keys = (params.keys ?? []).map((k) => k.toUpperCase());
      if (keys.length === 0) {
        return connectorResultFromError({
          error: "issues_by_key requires params.keys",
          code: 0,
          recoverable: false,
          suggestion: "Pass an array of issue keys, e.g. ['PROJ-1'].",
        });
      }
      const queryId = `keys_${keys.sort().join("_")}`;
      const query = readQueryStore(rootDir, JIRA_DOMAIN, queryId);
      if (!force && query && queryIsFresh(query, false)) {
        const { lines } = entitiesForKeys(rootDir, query.keys, false);
        return connectorResultFromCache(lines.join("\n"), query, { force: false });
      }
      try {
        const jql = `key in (${keys.join(",")})`;
        const { keys: fetched, syncedAt } = await refreshIssues(
          client,
          rootDir,
          jql,
          queryId,
          FRESHNESS.issuesByKey,
          ["summary", "status", "assignee", "priority", "updated"],
        );
        const { lines } = entitiesForKeys(rootDir, fetched, false);
        return { data: lines.join("\n"), stale: false, synced_at: syncedAt };
      } catch (err) {
        if (query && isNetworkError(err)) {
          const { lines } = entitiesForKeys(rootDir, query.keys, true);
          if (lines.length > 0) {
            return connectorResultFromCache(lines.join("\n"), query, { force: true });
          }
        }
        if (err instanceof JiraClientError) {
          return connectorResultFromError(err.connectorError);
        }
        throw err;
      }
    }
    case "epic_children": {
      const epicKey = (params.epicKey ?? params.key)?.toUpperCase();
      if (!epicKey) {
        return connectorResultFromError({
          error: "epic_children requires params.epicKey or params.key",
          code: 0,
          recoverable: false,
          suggestion: "Pass the epic issue key.",
        });
      }
      const jql = `parent = ${epicKey} ORDER BY status`;
      return serveCachedOrFetch(rootDir, `epic_${epicKey}`, force, () =>
        refreshIssues(client, rootDir, jql, `epic_${epicKey}`, FRESHNESS.epicChildren, [
          "summary",
          "status",
          "assignee",
          "priority",
          "updated",
        ]),
      );
    }
    case "issue_detail": {
      const issueKey = params.key?.toUpperCase();
      if (!issueKey) {
        return connectorResultFromError({
          error: "issue_detail requires params.key",
          code: 0,
          recoverable: false,
          suggestion: "Pass the issue key, e.g. PROJ-123.",
        });
      }
      const entityStore = readEntityStore(rootDir, JIRA_DOMAIN);
      const cached = entityStore[issueKey];
      const useCache = !force && cached && !isCacheStale(cached, false);
      try {
        let issue: JiraIssue;
        if (useCache) {
          issue = {
            key: issueKey,
            fields: {
              summary: cached.summary,
              status: { name: cached.status },
              assignee: { displayName: cached.assignee },
              priority: { name: cached.priority },
              updated: cached.updated,
            },
          };
        } else {
          issue = await client.getIssue(issueKey, [
            "summary",
            "status",
            "assignee",
            "priority",
            "duedate",
            "updated",
            "description",
            "issuelinks",
            "parent",
          ]);
          entityStore[issueKey] = issueToCacheEntry(issue, FRESHNESS.issueDetail);
          writeEntityStore(rootDir, JIRA_DOMAIN, entityStore);
        }

        const liveIssue = useCache
          ? await client.getIssue(issueKey, ["description", "issuelinks", "parent"])
          : issue;

        const fields = { ...issue.fields, ...liveIssue.fields };
        const description = renderAdfToText(fields.description);
        const commentsResp = await client.getComments(issueKey);
        const comments = (commentsResp.comments ?? [])
          .map(
            (c) =>
              `- ${c.author?.displayName ?? "Unknown"} (${c.created ?? "?"}): ${renderAdfToText(c.body)}`,
          )
          .join("\n");

        const header = [
          `# ${issueKey}: ${fields.summary ?? ""}`,
          `Status: ${statusName(fields)}`,
          `Assignee: ${assigneeName(fields)}`,
          `Priority: ${priorityName(fields)}`,
          formatParent(fields),
          formatIssueLinks(fields),
          description ? `\nDescription:\n${description}` : "",
          comments ? `\nComments:\n${comments}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        return {
          data: header,
          stale: useCache,
          synced_at: cached?.synced_at ?? new Date().toISOString(),
        };
      } catch (err) {
        if (cached && isNetworkError(err)) {
          return connectorResultFromCache(formatIssueLine(cached), cached, { force: true });
        }
        if (err instanceof JiraClientError) {
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
