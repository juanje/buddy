// permission-persistent-options.ts — FR-PERM-06b: when to show "Allow always" on permission cards.

import type { PermissionRequest } from "../../shared/api";

/** True when the permission card should offer file/folder "Allow always" actions. */
export function shouldOfferPersistentPermission(
  request: Pick<PermissionRequest, "kind" | "op">,
): boolean {
  return request.kind === "outside" && request.op === "read";
}
