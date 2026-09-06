// shared/jira-error-suggestions.ts — i18n keys for Jira ConnectorError.suggestion.

export const JIRA_ERROR_SUGGESTION_KEYS = [
  "jiraError401",
  "jiraError403",
  "jiraError404",
  "jiraError429",
  "jiraError5xx",
  "jiraErrorNetwork",
  "jiraErrorTimeout",
  "jiraErrorGeneric",
  "jiraErrorNotConfigured",
] as const;

export type JiraErrorSuggestionKey = (typeof JIRA_ERROR_SUGGESTION_KEYS)[number];

export type JiraErrorSuggestionMessages = Record<JiraErrorSuggestionKey, string>;

export function isJiraErrorSuggestionKey(value: string): value is JiraErrorSuggestionKey {
  return (JIRA_ERROR_SUGGESTION_KEYS as readonly string[]).includes(value);
}

export function resolveJiraErrorSuggestion(
  suggestion: string | undefined,
  messages: JiraErrorSuggestionMessages,
): string {
  if (!suggestion) return "";
  if (isJiraErrorSuggestionKey(suggestion)) {
    return messages[suggestion];
  }
  return suggestion;
}
