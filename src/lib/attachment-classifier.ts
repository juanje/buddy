// src/lib/attachment-classifier.ts — which dropped paths become attachment
// chips (FR-INGEST-04).
//
// Extracted out of chat-controller.ts's `addAttachments`: this is the only
// part of that function that decides anything. The rest is store plumbing
// (updating `attachments`, `attachmentErrors`, arming the error-dismiss
// timer). A pure function of `paths` and the attachments already pending is
// safe to pull out on its own, and it is what FR-INGEST-04's rejection rule
// and the dedup rule are actually about — neither needs a controller, a
// worker fake, or Svelte to be exercised.

import { isSupportedIngestFormat, rejectionReasonForPath, type RejectionReason } from "../../shared/ingest-formats";
import { basename } from "../utils/path";
import type { Attachment } from "./chat-controller";

export interface RejectedAttachment {
  name: string;
  reason: RejectionReason;
}

export interface ClassifiedAttachments {
  /** New attachments to add, in the order they were given. */
  accepted: Attachment[];
  /** Rejected files with structured reasons. */
  rejected: RejectedAttachment[];
}

/**
 * Split dropped paths into what becomes a new attachment chip and what gets
 * rejected. A path already in `existing` is silently dropped — neither
 * accepted again nor reported as rejected.
 *
 * Only checked against `existing`, matching the original inline behaviour
 * exactly: a duplicate *within* the same `paths` call is not caught here and
 * is added twice. Preserved rather than fixed during extraction — a
 * behavioural change belongs in its own change, not hidden inside a move.
 */
export function classifyAttachments(
  paths: string[],
  existing: readonly Attachment[],
): ClassifiedAttachments {
  const rejected: RejectedAttachment[] = [];
  const accepted: Attachment[] = [];

  for (const path of paths) {
    const name = basename(path);
    if (!isSupportedIngestFormat(path)) {
      rejected.push({ name, reason: rejectionReasonForPath(path) });
      continue;
    }
    if (existing.some((a) => a.path === path)) continue;
    accepted.push({ path, name });
  }

  return { accepted, rejected };
}
