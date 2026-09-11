# FR-TASK-01..08 — tasks() tool and task management

Feature: Task management

  @FR-TASK-01
  Scenario: tasks tool is registered in every session
    Given an initialized buddy git repository
    When the agent toolset is built for the buddy
    Then the toolset offers tasks
    And the toolset registers tasks

  @FR-TASK-01
  Scenario: help action lists available actions
    Given an initialized buddy git repository
    And a tasks.md file exists
    When tasks action help is invoked
    Then the task result contains "add"
    And the task result contains "complete"
    And the task result contains "set_next"
    And the task result contains "config"

  @FR-TASK-01
  Scenario: task file format is parsed correctly
    Given an initialized buddy git repository
    And tasks.md with markers dates and areas
    When tasks action list is invoked
    Then the task list has 2 items
    And the first task has next marker true

  @FR-TASK-02
  Scenario: add creates a new task item
    Given an initialized buddy git repository
    When tasks add is invoked with text "Buy milk" and area "personal"
    Then tasks.md on disk contains "Buy milk @personal"

  @FR-TASK-02
  Scenario: complete marks item as done
    Given an initialized buddy git repository
    And tasks.md on disk has line "- [ ] Buy milk @personal"
    When tasks complete is invoked for id 1
    Then tasks.md on disk contains "- [x] Buy milk @personal"

  @FR-TASK-02
  Scenario: remove requires user confirmation
    Given an initialized buddy git repository
    When tasks remove permission is evaluated for id 1
    Then the task remove permission gate asks for confirmation

  @FR-TASK-03
  Scenario: set_next marks item and clears previous in same area
    Given an initialized buddy git repository
    And tasks.md on disk has work items A and B
    When tasks set_next is invoked for id 2
    Then tasks.md on disk has next on task B only

  @FR-TASK-03
  Scenario: first item in area is auto-marked as next
    Given an initialized buddy git repository
    And tasks.md on disk has no health items
    When tasks add is invoked with text "Call dentist" and area "health"
    Then tasks.md on disk contains ">> Call dentist @health"

  @FR-TASK-04 @FR-TASKM-23
  Scenario: add does not warn when WIP limit exceeded
    Given an initialized buddy git repository
    And tasks.md has 5 open items
    And task WIP limit is 5
    When tasks add is invoked with text "Another task"
    Then the task result does not contain "WIP"

  @FR-TASK-05
  Scenario: agents-base prompt includes capture classification
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Capture classification"
    And the agents-base prompt references tasks action add
    And the agents-base prompt does not reference inbox.md
    And the agents-base prompt does not reference triage_inbox

  @FR-TASK-07
  Scenario: AGENTS.md inbox reference migrated to tasks on session boot
    Given an initialized buddy git repository
    And AGENTS.md has an inbox reference in Where to find things
    When session boot runs migrations
    Then AGENTS.md references tasks.md instead of inbox.md

  @FR-TASK-07
  Scenario: Inbox without checkbox items produces empty tasks.md
    Given an initialized buddy git repository
    And the legacy inbox file has GTD sections but no checkbox items
    When session boot runs migrations
    Then the user tasks file exists and is empty
    And the legacy inbox file no longer exists

  @FR-TASK-07
  Scenario: Inbox with checkbox items is deleted after migration
    Given an initialized buddy git repository
    And the legacy inbox file has checkbox items
    When session boot runs migrations
    Then the user tasks file exists with migrated items
    And the legacy inbox file no longer exists

  @FR-TASK-07
  Scenario: Bare inbox.md references in AGENTS.md are replaced
    Given an initialized buddy git repository
    And AGENTS.md has a bare inbox.md reference outside the nav line
    When session boot runs migrations
    Then AGENTS.md contains no inbox.md references

  @FR-TASK-08
  Scenario: triage_inbox tool is not registered
    Then triage_inbox is not in the skill tool list

  @FR-TASK-08
  Scenario: consolidation prompt references tasks tool
    Given the bundled consolidation.md prompt
    Then the consolidation prompt step 4 references tasks list
    And the consolidation prompt does not reference triage_inbox

  @FR-TASKM-01
  Scenario: task with project tag is parsed and serialized
    Given an initialized buddy git repository
    And tasks.md on disk has line "- [ ] >> Call dentist #ley-dep @health"
    When tasks action list is invoked
    Then the first task has project "ley-dep"

  @FR-TASKM-02
  Scenario: add with project param writes project tag
    Given an initialized buddy git repository
    When tasks add is invoked with text "Get DNI copy" area "family" and project "ley-dep"
    Then tasks.md on disk contains "#ley-dep @family"

  @FR-TASKM-03
  Scenario: list filters by project
    Given an initialized buddy git repository
    And tasks.md on disk has project-tagged items
    When tasks list is invoked with project "ley-dep"
    Then the task list contains only items with project "ley-dep"

  @FR-TASKM-04
  Scenario: agents-base prompt includes GTD project classification
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "GTD next action"
    And the agents-base prompt contains "GTD project"
    And the agents-base prompt references project param in add

  @FR-TASKM-05
  Scenario: consolidation prompt includes project health check
    Given the bundled consolidation.md prompt
    Then the consolidation prompt references project health check

  @FR-TASKM-06
  Scenario: add sets created date on new task
    Given an initialized buddy git repository
    When tasks add is invoked with text "Buy milk" and area "personal"
    Then tasks.md on disk contains today's date as created comment

  @FR-TASKM-06
  Scenario: items without created comment inherit file frontmatter date
    Given an initialized buddy git repository
    And tasks.md on disk has frontmatter created "2026-01-15" and line "- [ ] Old task @work"
    When tasks action list is invoked
    Then the first task has created "2026-01-15"

  @FR-TASKM-06
  Scenario: created date is parsed from task line
    Given an initialized buddy git repository
    And tasks.md on disk has line "- [ ] Buy milk @personal <!-- c:2026-01-01 -->"
    When tasks action list is invoked
    Then the first task has created "2026-01-01"

  @FR-TASKM-09
  Scenario: stale items have staleDays in list result
    Given an initialized buddy git repository
    And tasks.md has an item created 45 days ago
    When tasks action list is invoked
    Then the stale item has staleDays of 45

  @FR-TASKM-07
  Scenario: list excludes someday items by default
    Given an initialized buddy git repository
    And tasks.md on disk has items with someday area
    When tasks action list is invoked with defaults
    Then the task list does not contain someday items
    And the task list summary has parkedCount 1

  @FR-TASKM-07
  Scenario: list includes someday items when include_parked is true
    Given an initialized buddy git repository
    And tasks.md on disk has items with someday area
    When tasks list is invoked with include_parked true
    Then the task list contains someday items

  @FR-TASKM-07
  Scenario: WIP count excludes someday items
    Given an initialized buddy git repository
    And tasks.md has 4 open items and 2 someday items
    And task WIP limit is 5
    When tasks add is invoked with text "One more"
    Then the task result does not contain "WIP"

  @FR-TASKM-08
  Scenario: list excludes future-dated items by default
    Given an initialized buddy git repository
    And tasks.md on disk has a future-dated item
    When tasks action list is invoked with defaults
    Then the task list does not contain future-dated items
    And the task list summary has futureCount 1

  @FR-TASKM-08
  Scenario: list includes future items when include_future is true
    Given an initialized buddy git repository
    And tasks.md on disk has a future-dated item
    When tasks list is invoked with include_future true
    Then the task list contains future-dated items

  @FR-TASKM-10
  Scenario: agents-base prompt includes parking and visibility guidance
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Parking and visibility"
    And the agents-base prompt contains "@someday"
    And the agents-base prompt contains "include_parked"
    And the agents-base prompt contains "parkedCount"
    And the agents-base prompt contains "futureCount"
    And the agents-base prompt contains "due > today"

  @FR-TASKM-10
  Scenario: consolidation prompt includes weekly staleness review
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "Staleness review"
    And the consolidation prompt contains "staleDays"
    And the consolidation prompt contains "@someday"
    And the consolidation prompt contains "parkedCount"

  @FR-TASKM-14
  Scenario: agents-base prompt enforces first-person voice
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "first person"
    And the agents-base prompt contains "I captured"
    And the agents-base prompt contains "never"
    And the agents-base prompt contains "Buddy has"

  @FR-TASKM-13
  Scenario: agents-base prompt includes batch capture guidance
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Batch capture"
    And the agents-base prompt contains "classify each one individually"
    And the agents-base prompt contains "project requires a file"

  @FR-TASKM-13
  Scenario: consolidation prompt verifies project tag parity
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "#project"
    And the consolidation prompt contains "corresponding file"
    And the consolidation prompt contains "missing project files"

  @FR-TASKM-11
  Scenario: write to tasks.md is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent writes "user/tasks.md" via permission gate
    Then the permission gate blocks with tasks tool message

  @FR-TASKM-11
  Scenario: read of tasks.md is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent reads "user/tasks.md" via permission gate
    Then the permission gate blocks with tasks tool message

  @FR-TASKM-11
  Scenario: edit of tasks.md is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent edits "user/tasks.md" via permission gate
    Then the permission gate blocks with tasks tool message

  @FR-TASKM-15
  Scenario: agents-base prompt includes default-context heuristic
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Default to context"
    And the agents-base prompt contains "explicit commitment"
    And the agents-base prompt contains "first filter"
    And the agents-base prompt contains "Signals of NO commitment"

  @FR-TASKM-16
  Scenario: agents-base prompt includes Area of Focus in classification
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Area of Focus"
    And the agents-base prompt contains "area of responsibility"
    And the agents-base prompt contains "user/workspaces/"

  @FR-TASKM-16
  Scenario: agents-base prompt includes area routing criteria
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Area of Focus routing"
    And the agents-base prompt contains "agent_brain/projects/area/"
    And the agents-base prompt contains "Ambiguity default"

  @FR-TASKM-17
  Scenario: agents-base prompt includes dual-lookup instruction
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Dual lookup"
    And the agents-base prompt contains "agent_brain/projects/{area}/"
    And the agents-base prompt contains "user/workspaces/{area}/"

  @FR-TASKM-17
  Scenario: process-conversation prompt includes area-of-focus routing
    Given the bundled process-conversation.md prompt
    Then the process-conversation prompt contains "Areas of focus"
    And the process-conversation prompt contains "agent_brain/projects/area/"

  @FR-TASKM-18
  Scenario: agents-base prompt includes wiki vs workspace distinction
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Wiki vs workspaces"
    And the agents-base prompt contains "distilled, interconnected"
    And the agents-base prompt contains "raw/in-progress"
    And the agents-base prompt contains "stages, not copies"

  @FR-TASKM-19
  Scenario: consolidation prompt includes workspace maturity check
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "Workspace maturity check"
    And the consolidation prompt contains "wiki ingestion"
    And the consolidation prompt contains "do not ingest automatically"

  @FR-TASKM-20
  Scenario: new buddy instance includes workspaces directory
    Given an initialized buddy git repository
    Then the buddy instance has a workspaces directory

  @FR-TASKM-20
  Scenario: template AGENTS.md includes workspaces navigation
    Given the template AGENTS.md
    Then the template AGENTS.md contains "user/workspaces/"
    And the template AGENTS.md contains "areas of focus"

  @FR-TASKM-21
  Scenario: boot migration adds workspaces nav to AGENTS.md
    Given an initialized buddy git repository
    And AGENTS.md has tasks nav without workspaces
    When session boot runs migrations
    Then AGENTS.md contains workspaces navigation

  @FR-TASKM-21
  Scenario: boot migration is idempotent for workspaces nav
    Given an initialized buddy git repository
    When session boot runs migrations
    And session boot runs migrations again
    Then AGENTS.md contains workspaces navigation

  @FR-TASKM-22
  Scenario: where-things-live docs include workspaces
    Given the bundled where-things-live.md doc
    Then the where-things-live doc contains "user/workspaces/"
    And the where-things-live doc contains "areas of focus"
    And the where-things-live doc contains "no defined end"

  @FR-TASKM-23
  Scenario: add does not produce WIP warning
    Given an initialized buddy git repository
    And tasks.md has 5 open items
    And task WIP limit is 5
    When tasks add is invoked with text "Overflow task"
    Then the task result does not contain "WIP"
