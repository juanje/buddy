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

  @FR-TASK-04
  Scenario: add warns when WIP limit exceeded
    Given an initialized buddy git repository
    And tasks.md has 5 open items
    And task WIP limit is 5
    When tasks add is invoked with text "Another task"
    Then the task result contains "WIP"

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
