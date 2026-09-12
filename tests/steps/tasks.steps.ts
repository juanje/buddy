// tests/steps/tasks.steps.ts — FR-TASK BDD steps.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createPermissionGate, evaluateToolCall, type PermissionGate } from "../../backends/permissions";
import { buildSkillTools, skillToolNames } from "../../backends/skill-tools";
import { executeTaskAction } from "../../backends/tasks/task-actions";
import { taskResultToText } from "../../backends/tasks/task-result";
import { tasksFilePath, writeTasksFile } from "../../backends/tasks/task-file";
import { writeTaskWipLimit } from "../../backends/tasks/task-config";
import { addDays, toIsoDay } from "../../shared/dates";
import {
  cleanupPendingInboxMigration,
  migrateAgentsTasksReference,
  migrateAgentsWorkspacesReference,
  migrateInboxToTasksIfNeeded,
} from "../../backends/brain-migration";
import { getMaintenanceSessionToolNames } from "../../backends/consolidation-runner";
import { bootRefreshIfNeeded } from "../../backends/boot-refresh";
import { setupGlobalConfigDir } from "../support/global-config";
import type { BuddyWorld } from "../support/world";

interface TasksWorld extends BuddyWorld {
  buddyDir?: string;
  rootDir?: string;
  taskResultText?: string;
  taskResult?: ReturnType<typeof executeTaskAction>;
  taskListCount?: number;
  firstTaskNext?: boolean;
  firstTaskProject?: string;
  firstTaskCreated?: string;
  taskListProjectsCount?: number;
  globalConfigDir?: string;
  skillToolNames?: string[];
  agentsBasePrompt?: string;
  consolidationPrompt?: string;
  processConversationPrompt?: string;
  templateAgentsMd?: string;
  whereThingsLiveDoc?: string;
  permGate?: PermissionGate;
  permOutcome?: { block: true; reason: string } | undefined;
}

function root(this: TasksWorld): string {
  const dir = this.buddyDir ?? this.rootDir;
  assert.ok(dir, "buddyDir required");
  return dir;
}

function invoke(this: TasksWorld, action: string, params: Record<string, unknown> = {}): void {
  const result = executeTaskAction(root.call(this), action, params);
  this.taskResult = result;
  this.taskResultText = taskResultToText(result);
  if (result.ok && result.list) {
    this.taskListCount = result.list.items.length;
    this.firstTaskNext = result.list.items[0]?.next;
    this.firstTaskProject = result.list.items[0]?.project;
    this.firstTaskCreated = result.list.items[0]?.created;
    this.taskListProjectsCount = result.list.projects?.length;
  }
}

Given("a tasks.md file exists", function (this: TasksWorld) {
  writeTasksFile(root.call(this), [
    { id: 1, text: "Sample", done: false, next: true, area: "work" },
  ]);
});

Given("tasks.md with markers dates and areas", function (this: TasksWorld) {
  const content = `---
created: 2026-09-10
---

# Tasks

- [ ] >> Review PR @work
- [ ] Pay rent 2026-09-10 @personal
`;
  writeFileSync(tasksFilePath(root.call(this)), content, "utf8");
});

Given("tasks.md on disk has line {string}", function (this: TasksWorld, line: string) {
  writeFileSync(
    tasksFilePath(root.call(this)),
    `---\ncreated: 2026-09-10\n---\n\n# Tasks\n\n${line}\n`,
    "utf8",
  );
});

Given(
  'tasks.md on disk has frontmatter created {string} and line {string}',
  function (this: TasksWorld, created: string, line: string) {
    writeFileSync(
      tasksFilePath(root.call(this)),
      `---\ncreated: ${created}\n---\n\n# Tasks\n\n${line}\n`,
      "utf8",
    );
  },
);

Given("tasks.md on disk has work items A and B", function (this: TasksWorld) {
  const content = `---
created: 2026-09-10
---

# Tasks

- [ ] >> Task A @work
- [ ] Task B @work
`;
  writeFileSync(tasksFilePath(root.call(this)), content, "utf8");
});

Given(
  "a tasks.md with a >> item in @work and 2 other open @work items",
  function (this: TasksWorld) {
    writeTasksFile(root.call(this), [
      { id: 1, text: "Next work task", done: false, next: true, area: "work" },
      { id: 2, text: "Other work one", done: false, next: false, area: "work" },
      { id: 3, text: "Other work two", done: false, next: false, area: "work" },
    ]);
  },
);

Given(
  "a tasks.md with a single >> item in @health and no other @health items",
  function (this: TasksWorld) {
    writeTasksFile(root.call(this), [
      { id: 1, text: "Health next", done: false, next: true, area: "health" },
    ]);
  },
);

Given("tasks.md with two projects in @work each having a next", function (this: TasksWorld) {
  writeFileSync(
    tasksFilePath(root.call(this)),
    `---
created: 2026-09-10
---

# Tasks

- [ ] >> Alpha first #alpha @work
- [ ] Alpha second #alpha @work
- [ ] >> Beta next #beta @work
`,
    "utf8",
  );
});

Given("tasks.md with one project that has no next", function (this: TasksWorld) {
  writeTasksFile(root.call(this), [
    { id: 1, text: "Alpha existing", done: false, next: false, area: "work", project: "alpha" },
  ]);
});

Given("tasks.md with project alpha having a next item", function (this: TasksWorld) {
  writeTasksFile(root.call(this), [
    { id: 1, text: "Alpha next", done: false, next: true, area: "work", project: "alpha" },
  ]);
});

Given(
  "tasks.md with project alpha having 3 items and project beta having 2 items in @work",
  function (this: TasksWorld) {
    writeFileSync(
      tasksFilePath(root.call(this)),
      `---
created: 2026-09-10
---

# Tasks

- [ ] >> Alpha next #alpha @work
- [ ] Alpha two #alpha @work
- [ ] Alpha three #alpha @work
- [ ] >> Beta one #beta @work
- [ ] Beta two #beta @work
`,
      "utf8",
    );
  },
);

Given("tasks.md on disk has project-tagged items", function (this: TasksWorld) {
  const content = `---
created: 2026-09-10
---

# Tasks

- [ ] >> Get DNI copy #ley-dep @family
- [ ] Review PR @work
- [ ] Call dentist #ley-dep @health
`;
  writeFileSync(tasksFilePath(root.call(this)), content, "utf8");
});

Given("tasks.md on disk has no health items", function (this: TasksWorld) {
  writeTasksFile(root.call(this), [
    { id: 1, text: "Other", done: false, next: true, area: "work" },
  ]);
});

Given("tasks.md has an item created 45 days ago", function (this: TasksWorld) {
  const today = new Date();
  const created = new Date(today);
  created.setDate(created.getDate() - 45);
  const createdStr = created.toISOString().slice(0, 10);
  const content = `---
created: 2026-09-10
---

# Tasks

- [ ] Old task @work <!-- c:${createdStr} -->
`;
  writeFileSync(tasksFilePath(root.call(this)), content, "utf8");
});

Given(
  "tasks.md has {int} open items and {int} someday items",
  function (this: TasksWorld, openCount: number, somedayCount: number) {
    const openItems = Array.from({ length: openCount }, (_, i) => ({
      id: i + 1,
      text: `Task ${i + 1}`,
      done: false,
      next: i === 0,
      area: "work",
    }));
    const somedayItems = Array.from({ length: somedayCount }, (_, i) => ({
      id: openCount + i + 1,
      text: `Someday ${i + 1}`,
      done: false,
      next: false,
      area: "someday",
    }));
    writeTasksFile(root.call(this), [...openItems, ...somedayItems]);
  },
);

Given("tasks.md on disk has items with someday area", function (this: TasksWorld) {
  const content = `---
created: 2026-09-10
---

# Tasks

- [ ] >> Active task @work
- [ ] Parked idea @someday
`;
  writeFileSync(tasksFilePath(root.call(this)), content, "utf8");
});

Given("tasks.md on disk has a future-dated item", function (this: TasksWorld) {
  const future = new Date();
  future.setDate(future.getDate() + 14);
  const futureStr = future.toISOString().slice(0, 10);
  const content = `---
created: 2026-09-10
---

# Tasks

- [ ] >> Current task @work
- [ ] Future task ${futureStr} @personal
`;
  writeFileSync(tasksFilePath(root.call(this)), content, "utf8");
});

Given("tasks.md has {int} open items", function (this: TasksWorld, count: number) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    text: `Task ${i + 1}`,
    done: false,
    next: i === 0,
  }));
  writeTasksFile(root.call(this), items);
});

Given("task WIP limit is {int}", function (this: TasksWorld, limit: number) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir());
  process.env.BUDDY_CONFIG_DIR = this.globalConfigDir;
  writeTaskWipLimit(limit);
});

When("tasks action help is invoked", function (this: TasksWorld) {
  invoke.call(this, "help");
});

When("tasks config is invoked without params", function (this: TasksWorld) {
  invoke.call(this, "config", {});
});

When("tasks action list is invoked", function (this: TasksWorld) {
  invoke.call(this, "list", { include_done: true });
});

When("tasks action list is invoked with defaults", function (this: TasksWorld) {
  invoke.call(this, "list", {});
});

When(
  'tasks add is invoked with text {string} and area {string}',
  function (this: TasksWorld, text: string, area: string) {
    invoke.call(this, "add", { text, area });
  },
);

When(
  'tasks add is invoked with text {string} area {string} and project {string}',
  function (this: TasksWorld, text: string, area: string, project: string) {
    invoke.call(this, "add", { text, area, project });
  },
);

When(
  'tasks list is invoked with project {string}',
  function (this: TasksWorld, project: string) {
    invoke.call(this, "list", { project, include_done: true });
  },
);

When("tasks list is invoked with include_parked true", function (this: TasksWorld) {
  invoke.call(this, "list", { include_parked: true, include_done: true });
});

When("tasks list is invoked with include_future true", function (this: TasksWorld) {
  invoke.call(this, "list", { include_future: true, include_done: true });
});

When("tasks list is invoked with only_next true", function (this: TasksWorld) {
  invoke.call(this, "list", { only_next: true });
});

When("tasks list is invoked with only_stale true", function (this: TasksWorld) {
  invoke.call(this, "list", { only_stale: true });
});

When("tasks list is invoked with only_due true", function (this: TasksWorld) {
  invoke.call(this, "list", { only_due: true });
});

When("tasks list is invoked with only_projects true", function (this: TasksWorld) {
  invoke.call(this, "list", { only_projects: true });
});

When("tasks list is invoked with only_untagged_clusters true", function (this: TasksWorld) {
  invoke.call(this, "list", { only_untagged_clusters: true });
});

Given(
  "a tasks.md with 4 open untagged tasks in @work and 2 open untagged in @health",
  function (this: TasksWorld) {
    writeTasksFile(root.call(this), [
      { id: 1, text: "Work one", done: false, next: false, area: "work" },
      { id: 2, text: "Work two", done: false, next: false, area: "work" },
      { id: 3, text: "Work three", done: false, next: false, area: "work" },
      { id: 4, text: "Work four", done: false, next: false, area: "work" },
      { id: 5, text: "Health one", done: false, next: false, area: "health" },
      { id: 6, text: "Health two", done: false, next: false, area: "health" },
    ]);
  },
);

Given("a tasks.md with 3 open untagged tasks in @work", function (this: TasksWorld) {
  writeTasksFile(root.call(this), [
    { id: 1, text: "Work one", done: false, next: false, area: "work" },
    { id: 2, text: "Work two", done: false, next: false, area: "work" },
    { id: 3, text: "Work three", done: false, next: false, area: "work" },
  ]);
});

Then(
  "the task result includes untaggedClusters for @work with count {int}",
  function (this: TasksWorld, count: number) {
    assert.ok(this.taskResult?.ok, "expected successful task result");
    const clusters = this.taskResult!.list?.untaggedClusters ?? [];
    const work = clusters.find((entry) => entry.area === "work");
    assert.ok(work, `expected @work cluster in ${JSON.stringify(clusters)}`);
    assert.equal(work!.count, count);
  },
);

Then(
  "the task result does not include untaggedClusters for @health",
  function (this: TasksWorld) {
    assert.ok(this.taskResult?.ok, "expected successful task result");
    const clusters = this.taskResult!.list?.untaggedClusters ?? [];
    assert.ok(
      !clusters.some((entry) => entry.area === "health"),
      `unexpected @health cluster in ${JSON.stringify(clusters)}`,
    );
  },
);

Given("tasks.md on disk has due today tomorrow and next week items", function (this: TasksWorld) {
  const today = toIsoDay(new Date());
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const content = `---
created: ${today}
---

# Tasks

- [ ] >> Due today ${today} @work
- [ ] Due tomorrow ${tomorrow} @personal
- [ ] Due later ${nextWeek} @personal
`;
  writeFileSync(tasksFilePath(root.call(this)), content, "utf8");
});

When(
  "tasks edit is invoked for id {int} with text {string}",
  function (this: TasksWorld, id: number, text: string) {
    invoke.call(this, "edit", { id, text });
  },
);

When(
  "tasks edit is invoked for id {int} with area {string} and project {string}",
  function (this: TasksWorld, id: number, area: string, project: string) {
    invoke.call(this, "edit", { id, area, project });
  },
);

When("tasks complete is invoked for id {int}", function (this: TasksWorld, id: number) {
  invoke.call(this, "complete", { id });
});

When("the user completes the next item via the tasks tool", function (this: TasksWorld) {
  invoke.call(this, "complete", { id: 1 });
});

When("the user completes the next item of project alpha", function (this: TasksWorld) {
  invoke.call(this, "complete", { id: 1 });
});

When("tasks remove is invoked for id {int}", function (this: TasksWorld, id: number) {
  invoke.call(this, "remove", { id });
});

When("the user removes the next item via the tasks tool", function (this: TasksWorld) {
  invoke.call(this, "remove", { id: 1 });
});

When("tasks set_next is invoked for id {int}", function (this: TasksWorld, id: number) {
  invoke.call(this, "set_next", { id });
});

When('tasks add is invoked with text {string}', function (this: TasksWorld, text: string) {
  invoke.call(this, "add", { text });
});

When("tasks remove permission is evaluated for id {int}", function (this: TasksWorld, id: number) {
  const rootDir = root.call(this);
  const decision = evaluateToolCall("tasks", { action: "remove", params: { id } }, rootDir);
  this.taskResultText = JSON.stringify(decision);
});

Given("a permission layer for tasks file access", function (this: TasksWorld) {
  const rootDir = root.call(this);
  this.permGate = createPermissionGate(
    rootDir,
    async () => {
      throw new Error("should not ask");
    },
    process.env.HOME,
  );
});

When(
  'the agent writes {string} via permission gate',
  async function (this: TasksWorld, relPath: string) {
    this.permOutcome = await this.permGate!.check("write", { path: relPath });
  },
);

When(
  'the agent reads {string} via permission gate',
  async function (this: TasksWorld, relPath: string) {
    this.permOutcome = await this.permGate!.check("read", { path: relPath });
  },
);

When(
  'the agent edits {string} via permission gate',
  async function (this: TasksWorld, relPath: string) {
    this.permOutcome = await this.permGate!.check("edit", { path: relPath });
  },
);

Then("the permission gate blocks with tasks tool message", function (this: TasksWorld) {
  assert.ok(this.permOutcome?.block, "expected the tool call to be blocked");
  assert.equal(
    this.permOutcome?.reason,
    "Use the tasks() tool to read and modify tasks.",
  );
});

Then("the toolset offers tasks", function (this: TasksWorld) {
  assert.ok((this as { toolNames?: string[] }).toolNames?.includes("tasks"));
});

Then("the toolset registers tasks", function (this: TasksWorld) {
  assert.ok((this as { customToolNames?: string[] }).customToolNames?.includes("tasks"));
});

Then("the task result contains {string}", function (this: TasksWorld, snippet: string) {
  assert.ok(
    this.taskResultText?.includes(snippet),
    `expected "${snippet}" in: ${this.taskResultText ?? "(empty)"}`,
  );
});

Then("the task result does not contain {string}", function (this: TasksWorld, snippet: string) {
  assert.ok(
    !this.taskResultText?.includes(snippet),
    `expected "${snippet}" not in: ${this.taskResultText ?? "(empty)"}`,
  );
});

Then(
  'the tool response includes the remaining count {string}',
  function (this: TasksWorld, count: string) {
    assert.ok(
      this.taskResultText?.includes(`${count} open tasks remain`),
      `expected remaining count ${count} in: ${this.taskResultText ?? "(empty)"}`,
    );
  },
);

Then(
  'the remaining count is {string} not {string}',
  function (this: TasksWorld, expected: string, notExpected: string) {
    const text = this.taskResultText ?? "";
    assert.ok(
      text.includes(`${expected} open tasks remain`),
      `expected remaining count ${expected} in: ${text || "(empty)"}`,
    );
    assert.ok(
      !text.includes(`${notExpected} open tasks remain`),
      `expected remaining count not ${notExpected} in: ${text}`,
    );
  },
);

Then("the tool response includes a suggest hint", function (this: TasksWorld) {
  assert.ok(
    this.taskResultText?.toLowerCase().includes("suggest"),
    `expected suggest hint in: ${this.taskResultText ?? "(empty)"}`,
  );
});

Then("the tool response includes nextClearedForArea", function (this: TasksWorld) {
  assert.ok(this.taskResult?.ok, "expected successful task result");
  assert.ok(
    (this.taskResult as { nextClearedForArea?: string }).nextClearedForArea,
    "expected nextClearedForArea on result",
  );
  assert.match(
    this.taskResultText ?? "",
    /Next action cleared for @/,
    "expected next cleared message in tool text",
  );
});

Then("the tool response says no open tasks remain", function (this: TasksWorld) {
  assert.ok(
    this.taskResultText?.includes("No open tasks remain"),
    `expected area clear message in: ${this.taskResultText ?? "(empty)"}`,
  );
});

Then("the tool response does not include a suggest hint", function (this: TasksWorld) {
  assert.ok(
    !this.taskResultText?.toLowerCase().includes("suggest"),
    `expected no suggest hint in: ${this.taskResultText ?? "(empty)"}`,
  );
});

Then("the task list has {int} items", function (this: TasksWorld, count: number) {
  assert.equal(this.taskListCount, count);
});

Then("the first task has next marker true", function (this: TasksWorld) {
  assert.equal(this.firstTaskNext, true);
});

Then("the first task has project {string}", function (this: TasksWorld, project: string) {
  assert.equal(this.firstTaskProject, project);
});

Then("the first task has created {string}", function (this: TasksWorld, created: string) {
  assert.equal(this.firstTaskCreated, created);
});

Then("the first task has created matching local calendar day", function (this: TasksWorld) {
  const result = executeTaskAction(root.call(this), "list", {});
  assert.ok(result.ok && result.list, "expected task list result");
  const created = result.list!.items[0]?.created;
  assert.equal(created, toIsoDay(new Date()));
});

Then("the stale item has staleDays of {int}", function (this: TasksWorld, days: number) {
  assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
  const stale = this.taskResult.list!.items.find((item) => item.staleDays !== undefined);
  assert.ok(stale, "expected a stale item");
  assert.equal(stale.staleDays, days);
});

Then("the task list does not contain someday items", function (this: TasksWorld) {
  assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
  assert.ok(
    !this.taskResult.list!.items.some((item) => item.area === "someday"),
    "expected no someday items",
  );
});

Then("the task list contains someday items", function (this: TasksWorld) {
  assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
  assert.ok(
    this.taskResult.list!.items.some((item) => item.area === "someday"),
    "expected someday items",
  );
});

Then("the task list does not contain future-dated items", function (this: TasksWorld) {
  assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(
    !this.taskResult.list!.items.some((item) => item.dueDate && item.dueDate > today),
    "expected no future-dated items",
  );
});

Then("the task list contains future-dated items", function (this: TasksWorld) {
  assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(
    this.taskResult.list!.items.some((item) => item.dueDate && item.dueDate > today),
    "expected future-dated items",
  );
});

Then(
  "the task list summary has parkedCount {int}",
  function (this: TasksWorld, count: number) {
    assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
    assert.equal(this.taskResult.list!.parkedCount, count);
  },
);

Then(
  "the task list summary has futureCount {int}",
  function (this: TasksWorld, count: number) {
    assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
    assert.equal(this.taskResult.list!.futureCount, count);
  },
);

Then(
  "the task list summary has activeNextCount {int}",
  function (this: TasksWorld, count: number) {
    assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
    assert.equal(this.taskResult.list!.activeNextCount, count);
  },
);

Then(
  'the task list contains only items with project {string}',
  function (this: TasksWorld, project: string) {
    assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
    const items = this.taskResult.list!.items;
    assert.ok(items.length > 0, "expected at least one item");
    assert.ok(
      items.every((item) => item.project === project),
      `expected all items to have project ${project}`,
    );
  },
);

Then("tasks.md on disk contains {string}", function (this: TasksWorld, snippet: string) {
  const content = readFileSync(tasksFilePath(root.call(this)), "utf8");
  assert.ok(content.includes(snippet), content);
});

Then("tasks.md on disk contains today's date as created comment", function (this: TasksWorld) {
  const today = new Date().toISOString().slice(0, 10);
  const content = readFileSync(tasksFilePath(root.call(this)), "utf8");
  assert.ok(
    content.includes(`<!-- c:${today} -->`),
    `expected <!-- c:${today} --> in:\n${content}`,
  );
});

Then("tasks.md on disk has next on task B only", function (this: TasksWorld) {
  const content = readFileSync(tasksFilePath(root.call(this)), "utf8");
  assert.match(content, /- \[ \] Task A @work/);
  assert.match(content, /- \[ \] >> Task B @work/);
  assert.doesNotMatch(content, />> Task A/);
});

Then("project alpha has only the second item as next", function (this: TasksWorld) {
  const content = readFileSync(tasksFilePath(root.call(this)), "utf8");
  assert.match(content, /- \[ \] Alpha first #alpha @work/);
  assert.match(content, /- \[ \] >> Alpha second #alpha @work/);
  assert.doesNotMatch(content, />> Alpha first/);
});

Then("project beta still has its original next", function (this: TasksWorld) {
  const content = readFileSync(tasksFilePath(root.call(this)), "utf8");
  assert.match(content, /- \[ \] >> Beta next #beta @work/);
});

Then("the new item is auto-marked as next", function (this: TasksWorld) {
  const listed = executeTaskAction(root.call(this), "list", { include_done: true });
  assert.ok(listed.ok && listed.list);
  const added = listed.list.items.find((item) => item.text === "New step");
  assert.ok(added, "expected added item New step");
  assert.equal(added.next, true);
});

Then("the new item is not marked as next", function (this: TasksWorld) {
  const listed = executeTaskAction(root.call(this), "list", { include_done: true });
  assert.ok(listed.ok && listed.list);
  const added = listed.list.items.find((item) => item.text === "Another step");
  assert.ok(added, "expected added item Another step");
  assert.equal(added.next, false);
});

Then("the task remove permission gate asks for confirmation", function (this: TasksWorld) {
  const decision = JSON.parse(this.taskResultText ?? "{}");
  assert.equal(decision.action, "ask");
  assert.equal(decision.kind, "task-remove");
});

Given("the bundled agents-base.md prompt", function (this: TasksWorld) {
  this.agentsBasePrompt = readFileSync(
    join(process.cwd(), "bundled", "prompts", "agents-base.md"),
    "utf8",
  );
});

Then("the agents-base prompt contains {string}", function (this: TasksWorld, text: string) {
  assert.ok(this.agentsBasePrompt?.includes(text), `missing: ${text}`);
});

Then("the agents-base prompt does not contain {string}", function (this: TasksWorld, text: string) {
  assert.ok(
    !this.agentsBasePrompt?.includes(text),
    `unexpected: ${text} in agents-base prompt`,
  );
});

Then("the agents-base prompt references tasks action add", function (this: TasksWorld) {
  assert.match(this.agentsBasePrompt ?? "", /tasks\(action=['"]add['"]/);
});

Then("the agents-base prompt references project param in add", function (this: TasksWorld) {
  assert.match(this.agentsBasePrompt ?? "", /project:\s*['"]/);
});

Then("the agents-base prompt does not reference inbox.md", function (this: TasksWorld) {
  assert.doesNotMatch(this.agentsBasePrompt ?? "", /user\/inbox\.md/);
});

Then("the agents-base prompt does not reference triage_inbox", function (this: TasksWorld) {
  assert.doesNotMatch(this.agentsBasePrompt ?? "", /triage_inbox/);
});

Then("triage_inbox is not in the skill tool list", function (this: TasksWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir());
  bootRefreshIfNeeded(this.globalConfigDir!, "0.0.0-test");
  const promptsDir = join(this.globalConfigDir!, "prompts");
  const names = skillToolNames(buildSkillTools(promptsDir));
  assert.ok(!names.includes("triage_inbox"));
});

Given("the bundled consolidation.md prompt", function (this: TasksWorld) {
  this.consolidationPrompt = readFileSync(
    join(process.cwd(), "bundled", "prompts", "consolidation.md"),
    "utf8",
  );
});

Then("the consolidation prompt step 4 references tasks list", function (this: TasksWorld) {
  assert.match(this.consolidationPrompt ?? "", /tasks\(action=['"]list['"]\)/);
});

Then("the consolidation prompt does not reference triage_inbox", function (this: TasksWorld) {
  assert.doesNotMatch(this.consolidationPrompt ?? "", /triage_inbox/);
});

Then("the consolidation prompt references project health check", function (this: TasksWorld) {
  assert.match(this.consolidationPrompt ?? "", /project health/i);
  assert.match(this.consolidationPrompt ?? "", /#project/);
});

Then("the consolidation prompt contains {string}", function (this: TasksWorld, text: string) {
  assert.ok(this.consolidationPrompt?.includes(text), `missing: ${text}`);
});

Then("the consolidation prompt does not contain {string}", function (this: TasksWorld, text: string) {
  assert.ok(
    !this.consolidationPrompt?.includes(text),
    `expected not to contain "${text}" in: ${this.consolidationPrompt ?? "(empty)"}`,
  );
});

Then(
  "the task list projects summary has {int} projects",
  function (this: TasksWorld, count: number) {
    assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
    assert.equal(this.taskResult.list!.projects?.length, count);
  },
);

Then(
  "project {word} has openCount {int} and hasNext {word}",
  function (this: TasksWorld, project: string, openCount: number, hasNext: string) {
    assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
    const summary = this.taskResult.list!.projects?.find((entry) => entry.project === project);
    assert.ok(summary, `expected project ${project}`);
    assert.equal(summary.openCount, openCount);
    assert.equal(summary.hasNext, hasNext === "true");
  },
);

Then("the consolidation prompt forbids unfiltered list", function (this: TasksWorld) {
  assert.match(
    this.consolidationPrompt ?? "",
    /Do not call `tasks\(action='list'\)` without filters during consolidation/i,
  );
});

Then("the consolidation session toolset includes tasks", function (this: TasksWorld) {
  setupGlobalConfigDir();
  const names = getMaintenanceSessionToolNames(process.cwd());
  assert.ok(names.includes("tasks"), `expected tasks in toolset: ${names.join(", ")}`);
});

Given("the bundled process-conversation.md prompt", function (this: TasksWorld) {
  this.processConversationPrompt = readFileSync(
    join(process.cwd(), "bundled", "prompts", "process-conversation.md"),
    "utf8",
  );
});

Then("the process-conversation prompt contains {string}", function (this: TasksWorld, text: string) {
  assert.ok(this.processConversationPrompt?.includes(text), `missing: ${text}`);
});

Given("AGENTS.md has an inbox reference in Where to find things", function (this: TasksWorld) {
  const agentsPath = join(root.call(this), "AGENTS.md");
  let content = readFileSync(agentsPath, "utf8");
  const inboxLine =
    "  - [Inbox](user/inbox.md) — GTD inbox: Capture, Next Actions, @context lists.";
  if (content.includes("[Inbox](user/inbox.md)")) return;

  const tasksNavRe = /^\s*-\s*\[Tasks\]\(user\/tasks\.md\).*$/m;
  if (tasksNavRe.test(content)) {
    content = content.replace(tasksNavRe, inboxLine);
  } else {
    const marker = "## Where to find things";
    const idx = content.indexOf(marker);
    assert.ok(idx !== -1, "AGENTS.md missing Where to find things");
    const insertAt = content.indexOf("\n", idx) + 1;
    content = content.slice(0, insertAt) + "\n" + inboxLine + "\n" + content.slice(insertAt);
  }
  writeFileSync(agentsPath, content, "utf8");
});

function runSessionBootMigrations(this: TasksWorld): void {
  const dir = root.call(this);
  cleanupPendingInboxMigration(dir);
  migrateInboxToTasksIfNeeded(dir);
  migrateAgentsTasksReference(dir);
  migrateAgentsWorkspacesReference(dir);
}

When("session boot runs migrations", function (this: TasksWorld) {
  runSessionBootMigrations.call(this);
});

When("session boot runs migrations again", function (this: TasksWorld) {
  runSessionBootMigrations.call(this);
});

Then("AGENTS.md references tasks.md instead of inbox.md", function (this: TasksWorld) {
  const content = readFileSync(join(root.call(this), "AGENTS.md"), "utf8");
  assert.match(content, /\[Tasks\]\(user\/tasks\.md\)/);
  assert.doesNotMatch(content, /\[Inbox\]\(user\/inbox\.md\)/);
});

function userDir(this: TasksWorld): string {
  return join(root.call(this), "user");
}

Given("the legacy inbox file has GTD list items but no checkboxes", function (this: TasksWorld) {
  const dir = userDir.call(this);
  mkdirSync(dir, { recursive: true });
  const tasksPath = join(dir, "tasks.md");
  if (existsSync(tasksPath)) unlinkSync(tasksPath);
  writeFileSync(
    join(dir, "inbox.md"),
    `# Inbox

## Next Actions
- **Review and refine the 14 new/updated concept notes**
- [Implement Jira connectors](projects/buddy-work-coordination.md).
`,
    "utf8",
  );
});

Given("the legacy inbox file has only structural headings", function (this: TasksWorld) {
  const dir = userDir.call(this);
  mkdirSync(dir, { recursive: true });
  const tasksPath = join(dir, "tasks.md");
  if (existsSync(tasksPath)) unlinkSync(tasksPath);
  writeFileSync(
    join(dir, "inbox.md"),
    `# Inbox

## Capture

## Next Actions
`,
    "utf8",
  );
});

Given("a pending inbox migration file is on disk", function (this: TasksWorld) {
  const dir = userDir.call(this);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "inbox.md.pending-migration"),
    `# Inbox

## Next Actions
- **Legacy task pending migration**
`,
    "utf8",
  );
  writeFileSync(join(dir, "tasks.md"), "---\ncreated: 2026-09-11\n---\n\n# Tasks\n", "utf8");
});

Given("the inbox migration done marker exists", function (this: TasksWorld) {
  const dir = userDir.call(this);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".inbox-migration-done"), "2026-09-12\n", "utf8");
});

Given("the legacy inbox file has checkbox items", function (this: TasksWorld) {
  const dir = userDir.call(this);
  mkdirSync(dir, { recursive: true });
  const tasksPath = join(dir, "tasks.md");
  if (existsSync(tasksPath)) unlinkSync(tasksPath);
  writeFileSync(
    join(dir, "inbox.md"),
    `# Inbox

## Next Actions
- [ ] Buy milk @personal
- [ ] Ship fix @work
`,
    "utf8",
  );
});

Then("the user tasks file exists and is empty", function (this: TasksWorld) {
  const path = join(userDir.call(this), "tasks.md");
  assert.ok(existsSync(path), "expected user/tasks.md");
  const content = readFileSync(path, "utf8");
  assert.match(content, /^#\s+Tasks/m);
  assert.doesNotMatch(content, /^- \[[ x]\]/m);
});

Then("the legacy inbox file no longer exists", function (this: TasksWorld) {
  const inbox = join(userDir.call(this), "inbox.md");
  const migrated = join(userDir.call(this), "inbox.md.migrated");
  assert.ok(!existsSync(inbox), "inbox.md should be deleted");
  assert.ok(!existsSync(migrated), "inbox.md.migrated should not exist");
});

Then("the pending inbox migration file exists", function (this: TasksWorld) {
  const path = join(userDir.call(this), "inbox.md.pending-migration");
  assert.ok(existsSync(path), "expected user/inbox.md.pending-migration");
});

Then("the pending inbox migration file does not exist", function (this: TasksWorld) {
  const path = join(userDir.call(this), "inbox.md.pending-migration");
  assert.ok(!existsSync(path), "user/inbox.md.pending-migration should not exist");
});

Then("the inbox migration done marker does not exist", function (this: TasksWorld) {
  const path = join(userDir.call(this), ".inbox-migration-done");
  assert.ok(!existsSync(path), "user/.inbox-migration-done should not exist");
});

Then("the user tasks file exists with migrated items", function (this: TasksWorld) {
  const path = join(userDir.call(this), "tasks.md");
  assert.ok(existsSync(path));
  const content = readFileSync(path, "utf8");
  assert.match(content, /Buy milk @personal/);
  assert.match(content, /Ship fix @work/);
});

Given("AGENTS.md has a bare inbox.md reference outside the nav line", function (this: TasksWorld) {
  const agentsPath = join(root.call(this), "AGENTS.md");
  let content = readFileSync(agentsPath, "utf8");
  const projectsLine =
    "  - [Projects](user/projects/index.md) — next actions mirrored in `inbox.md` @context lists.";
  if (content.includes("mirrored in `inbox.md`")) return;
  const marker = "## Where to find things";
  const idx = content.indexOf(marker);
  assert.ok(idx !== -1);
  const insertAt = content.indexOf("\n", idx) + 1;
  content = content.slice(0, insertAt) + "\n" + projectsLine + "\n" + content.slice(insertAt);
  writeFileSync(agentsPath, content, "utf8");
});

Then("AGENTS.md contains no inbox.md references", function (this: TasksWorld) {
  const content = readFileSync(join(root.call(this), "AGENTS.md"), "utf8");
  assert.doesNotMatch(content, /\binbox\.md\b/);
});

Given("the template AGENTS.md", function (this: TasksWorld) {
  this.templateAgentsMd = readFileSync(join(process.cwd(), "templates", "AGENTS.md"), "utf8");
});

Then("the template AGENTS.md contains {string}", function (this: TasksWorld, text: string) {
  assert.ok(this.templateAgentsMd?.includes(text), `missing: ${text}`);
});

Then("the buddy instance has a workspaces directory", function (this: TasksWorld) {
  assert.ok(
    existsSync(join(root.call(this), "user", "workspaces")),
    "expected user/workspaces directory",
  );
});

Given("user workspaces directory does not exist", function (this: TasksWorld) {
  const wsDir = join(root.call(this), "user", "workspaces");
  if (existsSync(wsDir)) {
    rmSync(wsDir, { recursive: true, force: true });
  }
  assert.ok(!existsSync(wsDir), "workspaces dir should be absent");
});

When("workspaces boot migration runs", function (this: TasksWorld) {
  migrateAgentsWorkspacesReference(root.call(this));
});

Then("user workspaces directory exists", function (this: TasksWorld) {
  assert.ok(
    existsSync(join(root.call(this), "user", "workspaces")),
    "expected user/workspaces directory",
  );
});

Given("AGENTS.md has tasks nav without workspaces", function (this: TasksWorld) {
  const agentsPath = join(root.call(this), "AGENTS.md");
  let content = readFileSync(agentsPath, "utf8");
  content = content.replace(/\n\s*-\s*\[Workspaces\]\(user\/workspaces\/\).*/g, "");
  writeFileSync(agentsPath, content, "utf8");
  assert.doesNotMatch(content, /user\/workspaces\//);
});

Then("AGENTS.md contains workspaces navigation", function (this: TasksWorld) {
  const content = readFileSync(join(root.call(this), "AGENTS.md"), "utf8");
  assert.match(content, /\[Workspaces\]\(user\/workspaces\/\)/);
});

Given("the bundled where-things-live.md doc", function (this: TasksWorld) {
  this.whereThingsLiveDoc = readFileSync(
    join(process.cwd(), "bundled", "docs", "memory", "where-things-live.md"),
    "utf8",
  );
});

Then("the where-things-live doc contains {string}", function (this: TasksWorld, text: string) {
  assert.ok(this.whereThingsLiveDoc?.includes(text), `missing: ${text}`);
});
