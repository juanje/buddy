// shared/slack-error-suggestions.ts — i18n keys for Slack ConnectorError.suggestion.

export const SLACK_ERROR_SUGGESTION_KEYS = [
  "slackError401",
  "slackError403",
  "slackError404",
  "slackError429",
  "slackError5xx",
  "slackErrorNetwork",
  "slackErrorTimeout",
  "slackErrorGeneric",
  "slackErrorNotConfigured",
] as const;

export type SlackErrorSuggestionKey = (typeof SLACK_ERROR_SUGGESTION_KEYS)[number];

export type SlackErrorSuggestionMessages = Record<SlackErrorSuggestionKey, string>;

export function isSlackErrorSuggestionKey(value: string): value is SlackErrorSuggestionKey {
  return (SLACK_ERROR_SUGGESTION_KEYS as readonly string[]).includes(value);
}

export function resolveSlackErrorSuggestion(
  suggestion: string | undefined,
  messages: SlackErrorSuggestionMessages,
): string {
  if (!suggestion) return "";
  if (isSlackErrorSuggestionKey(suggestion)) {
    return messages[suggestion];
  }
  return suggestion;
}
