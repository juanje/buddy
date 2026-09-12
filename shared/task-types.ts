// shared/task-types.ts — Task file and tasks() tool types (FR-TASK).

export const WIP_DEFAULT = 5;

export const TASKS_REL_PATH = "user/tasks.md";

export interface TaskItem {
  /** 1-based positional id within the open+done list order in file */
  id: number;
  text: string;
  done: boolean;
  next: boolean;
  area?: string;
  dueDate?: string;
  annotation?: string;
  project?: string;
  created?: string;
  /** Computed at list time when open, not next, and age > 30 days */
  staleDays?: number;
}

export interface TaskAreaSummary {
  area: string;
  openCount: number;
  hasNext: boolean;
}

export interface ProjectSummary {
  project: string;
  openCount: number;
  hasNext: boolean;
}

export interface TaskListResult {
  items: TaskItem[];
  areas: TaskAreaSummary[];
  openCount: number;
  parkedCount: number;
  futureCount: number;
  /** Open next-action items excluding @someday and future-dated */
  activeNextCount: number;
  /** Populated when list(only_projects: true) */
  projects?: ProjectSummary[];
  /** Populated when list(only_untagged_clusters: true) */
  untaggedClusters?: Array<{ area: string; count: number }>;
}

export interface TaskConfig {
  wipLimit: number;
}

export interface TaskActionSuccess {
  ok: true;
  message: string;
  list?: TaskListResult;
  nextClearedForArea?: string;
  /** Project slug when the cleared next belonged to a project scope */
  nextClearedForProject?: string;
  noNextForArea?: string;
  /** Open non-someday, non-future items remaining in the cleared item's scope */
  remainingInArea?: number;
  /** Scope descriptor when add did not auto-mark next (project:slug or area:name) */
  noNextForScope?: string;
}

export interface TaskActionError {
  ok: false;
  error: string;
  suggestion?: string;
}

export type TaskActionResult = TaskActionSuccess | TaskActionError;
