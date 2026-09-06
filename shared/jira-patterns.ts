// shared/jira-patterns.ts — project prefix input → issue key regex patterns.

const REGEX_METACHAR_RE = /[\\^$.*+?()[\]{}|]/;
const AUTO_SUFFIX_RE = /-\\d\+$/;

/** Strip auto-generated `-\d+` suffix for display in Settings. */
export function patternToDisplayPrefix(pattern: string): string {
  return pattern.replace(AUTO_SUFFIX_RE, "");
}

/** Join stored patterns as user-friendly comma-separated prefixes. */
export function patternsToDisplayText(patterns: string[]): string {
  return patterns.map(patternToDisplayPrefix).join(", ");
}

/** Convert a bare prefix (e.g. PROJ) to a regex; leave explicit regex unchanged. */
export function normalizePrefixToPattern(prefix: string): string {
  if (REGEX_METACHAR_RE.test(prefix) || AUTO_SUFFIX_RE.test(prefix)) {
    return prefix;
  }
  return `${prefix}-\\d+`;
}

/** Parse comma-separated prefix input into stored regex patterns. */
export function parseProjectPrefixInput(value: string): string[] {
  return value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalizePrefixToPattern);
}
