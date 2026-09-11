// tests/steps/tasks.steps.ts — FR-TASK BDD steps.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { evaluateToolCall } from "../../backends/permissions";
import { buildSkillTools, skillToolNames } from "../../backends/skill-tools";
import { executeTaskAction } from "../../backends/tasks/task-actions";
import { taskResultToText } from "../../backends/tasks/task-result";
import { tasksFilePath, writeTasksFile } from "../../backends/tasks/task-file";
import { writeTaskWipLimit } from "../../backends/tasks/task-config";
import {
  migrateAgentsTasksReference,
  migrateInboxToTasksIfNeeded,
} from "../../backends/brain-migration";
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
  globalConfigDir?: string;
  skillToolNames?: string[];
  agentsBasePrompt?: string;
  consolidationPrompt?: string;
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
- [ ] Pay rent 2026-09-15 @personal
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

When("tasks action list is invoked", function (this: TasksWorld) {
  invoke.call(this, "list", { include_done: true });
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

When("tasks complete is invoked for id {int}", function (this: TasksWorld, id: number) {
  invoke.call(this, "complete", { id });
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

Then("the stale item has staleDays of {int}", function (this: TasksWorld, days: number) {
  assert.ok(this.taskResult?.ok && this.taskResult.list, "expected task list result");
  const stale = this.taskResult.list!.items.find((item) => item.staleDays !== undefined);
  assert.ok(stale, "expected a stale item");
  assert.equal(stale.staleDays, days);
});

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

Then("tasks.md on disk has next on task B only", function (this: TasksWorld) {
  const content = readFileSync(tasksFilePath(root.call(this)), "utf8");
  assert.match(content, /- \[ \] Task A @work/);
  assert.match(content, /- \[ \] >> Task B @work/);
  assert.doesNotMatch(content, />> Task A/);
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

When("session boot runs migrations", function (this: TasksWorld) {
  const dir = root.call(this);
  migrateInboxToTasksIfNeeded(dir);
  migrateAgentsTasksReference(dir);
});

Then("AGENTS.md references tasks.md instead of inbox.md", function (this: TasksWorld) {
  const content = readFileSync(join(root.call(this), "AGENTS.md"), "utf8");
  assert.match(content, /\[Tasks\]\(user\/tasks\.md\)/);
  assert.doesNotMatch(content, /\[Inbox\]\(user\/inbox\.md\)/);
});

function userDir(this: TasksWorld): string {
  return join(root.call(this), "user");
}

Given("the legacy inbox file has GTD sections but no checkbox items", function (this: TasksWorld) {
    const dir = userDir.call(this);
    mkdirSync(dir, { recursive: true });
    const tasksPath = join(dir, "tasks.md");
    if (existsSync(tasksPath)) unlinkSync(tasksPath);
    writeFileSync(
      join(dir, "inbox.md"),
      `# Inbox

## Capture
Something to remember later.

## Next Actions
Call Pedro when back at desk.
`,
      "utf8",
    );
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
