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

  @FR-TASKM-30
  Scenario: Inbox with non-checkbox content is preserved for LLM migration
    Given an initialized buddy git repository
    And the legacy inbox file has GTD list items but no checkboxes
    When session boot runs migrations
    Then the user tasks file exists and is empty
    And the pending inbox migration file exists
    And the legacy inbox file no longer exists

  @FR-TASKM-30
  Scenario: Truly empty inbox is removed without pending file
    Given an initialized buddy git repository
    And the legacy inbox file has only structural headings
    When session boot runs migrations
    Then the user tasks file exists and is empty
    And the pending inbox migration file does not exist
    And the legacy inbox file no longer exists

  @FR-TASKM-30
  Scenario: Boot cleanup removes pending files after LLM marker
    Given an initialized buddy git repository
    And a pending inbox migration file is on disk
    And the inbox migration done marker exists
    When session boot runs migrations
    Then the pending inbox migration file does not exist
    And the inbox migration done marker does not exist

  @FR-TASKM-30
  Scenario: Consolidation prompt includes pending inbox migration guidance
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "inbox.md.pending-migration"
    And the consolidation prompt contains ".inbox-migration-done"

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

  @FR-CONSOL-28
  Scenario: consolidation session includes tasks tool
    Then the consolidation session toolset includes tasks

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

  @FR-TASKM-29
  Scenario: agents-base prompt includes content escape hatch
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "structured actionable information"
    And the agents-base prompt contains "step 1b"
    And the agents-base prompt contains "ask the user"

  @FR-TASKM-19
  Scenario: consolidation prompt includes workspace maturity check
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "Workspace maturity check"
    And the consolidation prompt contains "wiki ingestion"
    And the consolidation prompt contains "do not ingest automatically"

  @FR-TASKM-25
  Scenario: consolidation prompt includes active fronts check
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "Active fronts check"
    And the consolidation prompt contains "activeNextCount"
    And the consolidation prompt contains "WIP limit"

  @FR-TASKM-26
  Scenario: agents-base prompt does not contain WIP awareness section
    Given the bundled agents-base.md prompt
    Then the agents-base prompt does not contain "WIP awareness"
    And the agents-base prompt does not contain "wipWarning"

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

  @FR-TASKM-24
  Scenario: list result includes activeNextCount
    Given an initialized buddy git repository
    And tasks.md on disk has work items A and B
    When tasks action list is invoked with defaults
    Then the task result contains "activeNextCount"
    And the task list summary has activeNextCount 1

  @FR-TASKM-27
  Scenario: task created date uses local time
    Given an initialized buddy git repository
    When tasks add is invoked with text "Buy milk" and area "personal"
    Then the first task has created matching local calendar day

  @FR-TASKM-28
  Scenario: boot migration creates workspaces directory
    Given an initialized buddy git repository
    And user workspaces directory does not exist
    When workspaces boot migration runs
    Then user workspaces directory exists

  @FR-TASKM-31
  Scenario: list with only_next returns next actions only
    Given an initialized buddy git repository
    And tasks.md on disk has work items A and B
    When tasks list is invoked with only_next true
    Then the task list has 1 items
    And the first task has next marker true

  @FR-TASKM-31
  Scenario: list with only_stale returns aged items only
    Given an initialized buddy git repository
    And tasks.md has an item created 45 days ago
    When tasks list is invoked with only_stale true
    Then the task list has 1 items
    And the stale item has staleDays of 45

  @FR-TASKM-31
  Scenario: list with only_due returns date-triggered items
    Given an initialized buddy git repository
    And tasks.md on disk has due today tomorrow and next week items
    When tasks list is invoked with only_due true
    Then the task list has 2 items

  @FR-TASKM-31
  Scenario: list with only_projects returns project summary
    Given an initialized buddy git repository
    And tasks.md on disk has project-tagged items
    When tasks list is invoked with only_projects true
    Then the task list projects summary has 1 projects
    And project ley-dep has openCount 2 and hasNext true

  @FR-TASKM-32
  Scenario: edit changes task text
    Given an initialized buddy git repository
    And tasks.md on disk has frontmatter created "2026-01-15" and line "- [ ] >> Buy milk @personal"
    When tasks edit is invoked for id 1 with text "Buy oat milk"
    Then tasks.md on disk contains ">> Buy oat milk @personal"
    And tasks.md on disk contains "<!-- c:2026-01-15 -->"

  @FR-TASKM-32
  Scenario: edit changes area and project
    Given an initialized buddy git repository
    And tasks.md on disk has line "- [ ] >> Get DNI copy #ley-dep @family"
    When tasks edit is invoked for id 1 with area "personal" and project "other"
    Then tasks.md on disk contains ">> Get DNI copy #other @personal"

  @FR-TASKM-33
  Scenario: consolidation prompt uses only_next for active fronts
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "only_next"

  @FR-TASKM-33
  Scenario: consolidation prompt uses only_stale for staleness review
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "only_stale"

  @FR-TASKM-33
  Scenario: consolidation prompt uses only_due for date reminders
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "only_due"

  @FR-TASKM-33
  Scenario: consolidation prompt uses only_projects for health check
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "only_projects"

  @FR-TASKM-33
  Scenario: consolidation prompt forbids unfiltered list
    Given the bundled consolidation.md prompt
    Then the consolidation prompt forbids unfiltered list

  @FR-TASKM-34
  Scenario: Completing next action hints remaining tasks in area
    Given an initialized buddy git repository
    And a tasks.md with a >> item in @work and 2 other open @work items
    When the user completes the next item via the tasks tool
    Then the tool response includes the remaining count "2"
    And the tool response includes a suggest hint

  @FR-TASKM-34
  Scenario: Removing the only next action confirms area is clear
    Given an initialized buddy git repository
    And a tasks.md with a single >> item in @health and no other @health items
    When the user removes the next item via the tasks tool
    Then the tool response includes nextClearedForArea
    And the tool response says no open tasks remain
    And the tool response does not include a suggest hint

  @FR-TASKM-35
  Scenario: agents-base prompt includes outcome-shaped language patterns
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "Outcome-shaped language"
    And the agents-base prompt contains "Update X"
    And the agents-base prompt contains "Organize Y"
    And the agents-base prompt contains "Prepare Z"

  @FR-TASKM-35
  Scenario: agents-base prompt includes ask-before-add for outcomes
    Given the bundled agents-base.md prompt
    Then the agents-base prompt contains "first concrete step"
    And the agents-base prompt contains "capture as-is"

  @FR-TASKM-36
  Scenario: list returns untagged clusters above threshold
    Given an initialized buddy git repository
    And a tasks.md with 4 open untagged tasks in @work and 2 open untagged in @health
    When tasks list is invoked with only_untagged_clusters true
    Then the task result includes untaggedClusters for @work with count 4
    And the task result does not include untaggedClusters for @health

  @FR-TASKM-36
  Scenario: cluster hint includes anti-pattern warning
    Given an initialized buddy git repository
    And a tasks.md with 3 open untagged tasks in @work
    When tasks list is invoked with only_untagged_clusters true
    Then the task result contains "not a shared outcome"

  @FR-TASKM-36
  Scenario: consolidation prompt includes cluster review step
    Given the bundled consolidation.md prompt
    Then the consolidation prompt contains "W1c"
    And the consolidation prompt contains "only_untagged_clusters"
    And the consolidation prompt contains "catch-all"

  @FR-TASKM-37
  Scenario: set_next clears previous within same project only
    Given an initialized buddy git repository
    And tasks.md with two projects in @work each having a next
    When tasks set_next is invoked for id 2
    Then project alpha has only the second item as next
    And project beta still has its original next

  @FR-TASKM-37
  Scenario: add auto-marks next in empty project scope
    Given an initialized buddy git repository
    And tasks.md with one project that has no next
    When tasks add is invoked with text "New step" area "work" and project "alpha"
    Then the new item is auto-marked as next

  @FR-TASKM-37
  Scenario: add does not auto-mark when project scope already has next
    Given an initialized buddy git repository
    And tasks.md with project alpha having a next item
    When tasks add is invoked with text "Another step" area "work" and project "alpha"
    Then the new item is not marked as next

  @FR-TASKM-38
  Scenario: Completing project next counts remaining in project only
    Given an initialized buddy git repository
    And tasks.md with project alpha having 3 items and project beta having 2 items in @work
    When the user completes the next item of project alpha
    Then the remaining count is "2" not "4"
