# specs/features/write-guard.feature

Feature: Heading-snapshot guard (FR-GUARD-01)
  As the Buddy worker
  I want writes that destroy section headings to be reverted
  So that structural damage to brain and log files is caught deterministically

  # The guard protects `agent_brain/` and `logs/` files. It captures the
  # `## ` heading set before a write/edit and restores the file if any
  # heading disappeared.

  Scenario: A write that removes a heading is reverted
    Given a brain file "agent_brain/observations.md" with headings "Patterns, One-off"
    When the agent writes the file without the "Patterns" heading
    Then the file is restored to its pre-write content
    And the tool result reports the lost heading "Patterns"

  Scenario: A write that preserves all headings is allowed
    Given a brain file "agent_brain/observations.md" with headings "Patterns, One-off"
    When the agent writes the file keeping all headings
    Then the file keeps the new content

  Scenario: An edit that removes a heading is reverted
    Given a brain file "agent_brain/identity/USER.md" with headings "Context, Preferences"
    When the agent edits the file replacing "Context" with unrelated content
    Then the file is restored to its pre-write content
    And the tool result reports the lost heading "Context"

  Scenario: Adding a new heading is allowed
    Given a brain file "agent_brain/concepts/testing.md" with headings "Summary"
    When the agent writes the file adding a "Examples" heading
    Then the file keeps the new content

  Scenario: Files outside the brain and logs are not guarded
    Given a user file "user/notes.md" with headings "Ideas, Done"
    When the agent writes the file without the "Ideas" heading
    Then the file keeps the new content

  Scenario: A failed tool call does not trigger the guard
    Given a brain file "agent_brain/deferred.md" with headings "Queue"
    When the agent edit fails with an error
    Then the file is unchanged
    And no heading check runs

  Scenario: The guard works in the maintenance session
    Given a brain file "agent_brain/observations.md" with headings "Patterns, One-off"
    When the maintenance session writes the file without the "Patterns" heading
    Then the file is restored to its pre-write content

  Scenario: Log files are also guarded
    Given a log file "logs/2026-08-01.md" with headings "Session 10:00–11:00"
    When the agent writes the file without the "Session 10:00–11:00" heading
    Then the file is restored to its pre-write content
