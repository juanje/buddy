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
}

export interface TaskAreaSummary {
  area: string;
  openCount: number;
  hasNext: boolean;
}

export interface TaskListResult {
  items: TaskItem[];
  areas: TaskAreaSummary[];
  openCount: number;
}

export interface TaskConfig {
  wipLimit: number;
}

export interface TaskActionSuccess {
  ok: true;
  message: string;
  list?: TaskListResult;
  wipWarning?: string;
  nextClearedForArea?: string;
  noNextForArea?: string;
}

export interface TaskActionError {
  ok: false;
  error: string;
  suggestion?: string;
}

export type TaskActionResult = TaskActionSuccess | TaskActionError;
