export function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized.startsWith("/") ? "/" : ".";
  return normalized.slice(0, idx);
}
