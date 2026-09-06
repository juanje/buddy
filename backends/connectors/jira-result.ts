// backends/connectors/jira-result.ts — ConnectorResult → tool/agent text.

import type { ConnectorError, ConnectorResult } from "../../shared/connector-types";
import {
  resolveJiraErrorSuggestion,
  type JiraErrorSuggestionMessages,
} from "../../shared/jira-error-suggestions";
import { en } from "../../src/lib/i18n/en";
import type { LocaleStrings } from "../../src/lib/i18n/es";

const TITLE_DISPLAY_HINT =
  "\n\n[Display hint: always show issue summaries in full — they are short and the user needs them for recognition.]";

export function jiraErrorMessagesFromLocale(locale: LocaleStrings): JiraErrorSuggestionMessages {
  return {
    jiraError401: locale.jiraError401,
    jiraError403: locale.jiraError403,
    jiraError404: locale.jiraError404,
    jiraError429: locale.jiraError429,
    jiraError5xx: locale.jiraError5xx,
    jiraErrorNetwork: locale.jiraErrorNetwork,
    jiraErrorTimeout: locale.jiraErrorTimeout,
    jiraErrorGeneric: locale.jiraErrorGeneric,
    jiraErrorNotConfigured: locale.jiraErrorNotConfigured,
  };
}

export function connectorErrorMessage(
  error: ConnectorError,
  messages: JiraErrorSuggestionMessages = jiraErrorMessagesFromLocale(en),
): string {
  const suggestion = resolveJiraErrorSuggestion(error.suggestion, messages);
  return suggestion ? `${error.error}. ${suggestion}` : error.error;
}

export function connectorResultToText(
  result: ConnectorResult,
  messages: JiraErrorSuggestionMessages = jiraErrorMessagesFromLocale(en),
): string {
  if (result.error) {
    return connectorErrorMessage(result.error, messages);
  }
  if (result.stale && result.synced_at) {
    const body = `[STALE — last synced ${result.synced_at}]\n${result.data}`;
    return result.data ? `${body}${TITLE_DISPLAY_HINT}` : body;
  }
  if (result.data) {
    return `${result.data}${TITLE_DISPLAY_HINT}`;
  }
  return result.data;
}

export function connectorResultFromError(error: ConnectorError): ConnectorResult {
  return { data: "", stale: false, error };
}
