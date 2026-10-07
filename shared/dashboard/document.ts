// shared/dashboard/document.ts — Which files render as dashboards (FR-DASH-02).

import { USER_DIR } from "../brain-paths";

/** Buddy-root-relative prefix for dashboard definition files. */
export const DASHBOARDS_DIR_PREFIX = `${USER_DIR}/dashboards/`;

export function isDashboardPath(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (norm === `${USER_DIR}/dashboards`) return true;
  return norm.startsWith(DASHBOARDS_DIR_PREFIX);
}

/**
 * True when the file lives under `user/dashboards/` and declares `type: dashboard`.
 * Location and type both matter: the same content elsewhere renders as markdown.
 */
export function isDashboardDocument(
  relPath: string,
  fields: Record<string, string>,
): boolean {
  if (!isDashboardPath(relPath)) return false;
  return fields.type?.trim() === "dashboard";
}
