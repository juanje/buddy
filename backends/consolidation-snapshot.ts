// backends/consolidation-snapshot.ts — Weekly diff and snapshot (FR-CONSOL-19).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Depth2Snapshot } from "../shared/consolidation-state";
import { gitClient } from "./git";
import { userProfilePath } from "./brain-paths";

export type { Depth2Snapshot };

export interface WeeklyDiff {
  userMdChanged: boolean;
  userMdDiff: string;
  rightNowChanged: boolean;
  rightNowDiff: string;
  gitStat: string;
}

const RIGHT_NOW_HEADING_RE = /### Right now\b/i;
const ACTIVE_CONTEXT_RE = /## Active context\b/i;

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function readAgentsMd(rootDir: string): string {
  const path = join(rootDir, "AGENTS.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function readUserMd(rootDir: string): string {
  const path = userProfilePath(rootDir);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

export function extractRightNowSection(agentsMd: string): string {
  const activeMatch = agentsMd.match(ACTIVE_CONTEXT_RE);
  if (!activeMatch || activeMatch.index == null) return "";

  const fromActive = agentsMd.slice(activeMatch.index);
  const rightNowMatch = fromActive.match(RIGHT_NOW_HEADING_RE);
  if (!rightNowMatch || rightNowMatch.index == null) return "";

  const fromRightNow = fromActive.slice(rightNowMatch.index + rightNowMatch[0].length);
  const nextHeading = fromRightNow.search(/^### /m);
  const body = nextHeading === -1 ? fromRightNow : fromRightNow.slice(0, nextHeading);
  return body.trim();
}

function simpleLineDiff(before: string, after: string, label: string): string {
  if (before === after) return "";
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const removed = beforeLines.filter((line) => line.trim() && !afterLines.includes(line));
  const added = afterLines.filter((line) => line.trim() && !beforeLines.includes(line));
  if (removed.length === 0 && added.length === 0) return `${label}: (content changed)`;

  const lines = [`${label}:`];
  for (const line of removed.slice(0, 10)) lines.push(`- ${line}`);
  for (const line of added.slice(0, 10)) lines.push(`+ ${line}`);
  return lines.join("\n");
}

export function snapshotForDiff(rootDir: string, now: Date = new Date()): Depth2Snapshot {
  const userMd = readUserMd(rootDir);
  const agentsMd = readAgentsMd(rootDir);
  return {
    capturedAt: now.toISOString(),
    userMdHash: hashContent(userMd),
    agentsMdHash: hashContent(agentsMd),
    rightNowContent: extractRightNowSection(agentsMd),
    userMdContent: userMd,
  };
}

export async function computeWeeklyDiff(
  rootDir: string,
  previousSnapshot: Depth2Snapshot | undefined,
  sinceIso: string | null,
): Promise<WeeklyDiff> {
  const userMd = readUserMd(rootDir);
  const rightNow = extractRightNowSection(readAgentsMd(rootDir));

  let gitStat = "(no git history)";
  if (sinceIso) {
    try {
      gitStat = await gitClient(rootDir).raw([
        "log",
        "--stat",
        `--since=${sinceIso}`,
        "-n",
        "30",
      ]);
      if (!gitStat.trim()) gitStat = "(no changes since last depth-2)";
    } catch {
      gitStat = "(git history unavailable)";
    }
  }

  if (!previousSnapshot) {
    return {
      userMdChanged: false,
      userMdDiff: "",
      rightNowChanged: false,
      rightNowDiff: "",
      gitStat,
    };
  }

  return {
    userMdChanged: hashContent(userMd) !== previousSnapshot.userMdHash,
    userMdDiff: simpleLineDiff(previousSnapshot.userMdContent ?? "", userMd, "USER.md"),
    rightNowChanged: rightNow !== previousSnapshot.rightNowContent,
    rightNowDiff: simpleLineDiff(previousSnapshot.rightNowContent, rightNow, 'AGENTS.md "Right now"'),
    gitStat,
  };
}

export function formatWeeklyDiffBlock(diff: WeeklyDiff): string {
  const lines = ["Weekly diff since last depth-2:"];
  lines.push(`Git changes:\n${diff.gitStat.trim() || "(none)"}`);

  if (diff.userMdDiff) lines.push(diff.userMdDiff);
  else if (diff.userMdChanged) lines.push("USER.md: changed");
  else lines.push("USER.md: unchanged since last depth-2");

  if (diff.rightNowDiff) lines.push(diff.rightNowDiff);
  else if (diff.rightNowChanged) lines.push('AGENTS.md "Right now": changed');
  else lines.push('AGENTS.md "Right now": unchanged since last depth-2');

  return lines.join("\n\n");
}
