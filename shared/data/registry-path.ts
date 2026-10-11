// shared/data/registry-path.ts — Registry file location (FR-DATA-01).

import { USER_DIR } from "../brain-paths";

export const DATA_REGISTRY_RELPATH = `${USER_DIR}/data/index.md`;

export const DATA_REGISTRY_TOOL_MESSAGE =
  "Use data(action='define') to change the data registry.";

export const DATA_REGISTERED_DATA_MESSAGE =
  "Use data(action='append') or data(action='correct') to change registered data.";

export function isDataRegistryPath(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, "/").replace(/\/+/g, "/");
  return norm === DATA_REGISTRY_RELPATH;
}
