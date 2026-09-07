// backends/connectors/slack-result.ts — ConnectorResult → tool/agent text.

import type { ConnectorError, ConnectorResult } from "../../shared/connector-types";
import {
  resolveSlackErrorSuggestion,
  type SlackErrorSuggestionMessages,
} from "../../shared/slack-error-suggestions";
import { en } from "../../src/lib/i18n/en";
import type { LocaleStrings } from "../../src/lib/i18n/es";

export function slackErrorMessagesFromLocale(locale: LocaleStrings): SlackErrorSuggestionMessages {
  return {
    slackError401: locale.slackError401,
    slackError403: locale.slackError403,
    slackError404: locale.slackError404,
    slackError429: locale.slackError429,
    slackError5xx: locale.slackError5xx,
    slackErrorNetwork: locale.slackErrorNetwork,
    slackErrorTimeout: locale.slackErrorTimeout,
    slackErrorEnterprise: locale.slackErrorEnterprise,
    slackErrorGeneric: locale.slackErrorGeneric,
    slackErrorNotConfigured: locale.slackErrorNotConfigured,
  };
}

export function connectorErrorMessage(
  error: ConnectorError,
  messages: SlackErrorSuggestionMessages = slackErrorMessagesFromLocale(en),
): string {
  const suggestion = resolveSlackErrorSuggestion(error.suggestion, messages);
  return suggestion ? `${error.error}. ${suggestion}` : error.error;
}

export function connectorResultToText(
  result: ConnectorResult,
  messages: SlackErrorSuggestionMessages = slackErrorMessagesFromLocale(en),
): string {
  if (result.error) {
    return connectorErrorMessage(result.error, messages);
  }
  if (result.stale && result.synced_at) {
    return `[STALE — last synced ${result.synced_at}]\n${result.data}`;
  }
  return result.data;
}

export function connectorResultFromError(error: ConnectorError): ConnectorResult {
  return { data: "", stale: false, error };
}
