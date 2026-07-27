// src/lib/local-path.ts — link classification for the chat renderer (FR-CHAT-09).
//
// Path containment lives in shared/viewable-path.ts and is enforced by the
// worker (NFR-SEC-08). This module only re-exports what the renderer needs, so
// there is no second implementation to drift.
//
// `resolveLocalPathForOpen` was removed in the H1 hardening sprint: it built an
// absolute path by string concatenation without collapsing `..`, which let an
// agent-authored link escape the buddy directory (FR-CHAT-11).

export { isExternalHref, isViewableFile } from "../../shared/viewable-path";
