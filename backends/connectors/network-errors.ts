// backends/connectors/network-errors.ts — transport-level error mapping shared by connector clients.

import type { ConnectorError } from "../../shared/connector-types";

export interface NetworkErrorOptions {
  /** Service name used in the timeout message ("<service> did not respond in time"). */
  service: string;
  /** i18n key for a timed-out or aborted request. */
  timeoutSuggestion: string;
  /** i18n key for any other transport failure. */
  networkSuggestion: string;
  /** The client's own HTTP error class: an HTTP response is never a network error. */
  clientErrorClass: new (...args: never[]) => Error;
}

export function createNetworkErrorHelpers(options: NetworkErrorOptions): {
  mapNetworkError: (err: unknown) => ConnectorError;
  isNetworkError: (err: unknown) => boolean;
} {
  const isTimeout = (err: unknown): boolean =>
    err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");

  return {
    mapNetworkError(err) {
      if (isTimeout(err)) {
        return {
          error: `${options.service} did not respond in time`,
          code: 0,
          recoverable: true,
          suggestion: options.timeoutSuggestion,
        };
      }
      return {
        error: err instanceof Error ? err.message : String(err),
        code: 0,
        recoverable: true,
        suggestion: options.networkSuggestion,
      };
    },
    isNetworkError(err) {
      if (err instanceof options.clientErrorClass) return false;
      if (err instanceof TypeError) return true;
      return isTimeout(err);
    },
  };
}
