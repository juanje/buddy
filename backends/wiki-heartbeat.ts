// backends/wiki-heartbeat.ts — FR-WIKI-05 heartbeat wiki health audit.

import { existsSync } from "node:fs";

import { WIKI_DIR } from "../shared/brain-paths";
import { toIsoDay, toLocalIsoStamp } from "../shared/dates";
import type { WikiMaintenanceState } from "../shared/wiki-state";
import { buddyPath } from "./brain-paths";
import { commitAll, gitClient } from "./git";
import { listWikiPageRelPaths, regenerateWikiIndex } from "./wiki-index";
import { wikiCheck, wikiRepairLinks } from "./wiki-check";
import { resolveInstanceLanguage } from "./wiki-tools";
import type { WikiLanguage } from "./wiki-format";

export interface WikiHealthEvalResult {
  state: WikiMaintenanceState;
  ran: boolean;
  repairs: ReturnType<typeof wikiRepairLinks> | null;
}

/** True when git shows commits touching user/wiki/ since the given timestamp. */
export async function hasWikiChangesSince(rootDir: string, since: string | null): Promise<boolean> {
  try {
    const git = gitClient(rootDir);
    const log = since
      ? await git.log({ "--since": since, maxCount: 1, "--": [`${WIKI_DIR}/`] })
      : await git.log({ maxCount: 1, "--": [`${WIKI_DIR}/`] });
    return log.total > 0;
  } catch {
    return false;
  }
}

function wikiPageCount(rootDir: string): number {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  if (!existsSync(wikiDir)) return 0;
  return listWikiPageRelPaths(wikiDir).length;
}

export async function evaluateWikiHealth(
  rootDir: string,
  state: WikiMaintenanceState,
  language?: WikiLanguage,
  now: Date = new Date(),
  hasChangesFn: typeof hasWikiChangesSince = hasWikiChangesSince,
): Promise<WikiHealthEvalResult> {
  const lang = language ?? resolveInstanceLanguage();
  const pageCount = wikiPageCount(rootDir);

  if (pageCount === 0) {
    return {
      state: { ...state, lastHealthCheck: toLocalIsoStamp(now), pagesAtLastCheck: 0 },
      ran: false,
      repairs: null,
    };
  }

  const hasChanges = await hasChangesFn(rootDir, state.lastHealthCheck);
  if (!hasChanges && state.lastHealthCheck !== null) {
    return { state, ran: false, repairs: null };
  }

  const health = wikiCheck(rootDir);
  const repairs = wikiRepairLinks(rootDir, health, lang, now);
  if (repairs.repaired > 0) {
    regenerateWikiIndex(rootDir, now, lang);
    await commitAll(rootDir, `wiki: health repair ${toIsoDay(now)}`);
  }

  return {
    state: {
      ...state,
      lastHealthCheck: toLocalIsoStamp(now),
      pagesAtLastCheck: wikiPageCount(rootDir),
    },
    ran: true,
    repairs,
  };
}
