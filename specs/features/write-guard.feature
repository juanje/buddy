# specs/features/write-guard.feature

Feature: Heading-snapshot guard (FR-GUARD-01 / FR-GUARD-01b)
  As the Buddy worker
  I want writes that destroy section headings to be reverted on protected files only
  So that structural hubs and operational queues stay intact while project docs stay editable

  # FR-GUARD-01b denylist — protected files (heading + frontmatter snapshots):
  #   AGENTS.md
  #   agent_brain/identity/USER.md, agent_brain/identity/SOUL.md
  #   agent_brain/observations.md, agent_brain/deferred.md
  #   agent_brain/concepts/index.md, agent_brain/projects/index.md, agent_brain/ideas/index.md
  #   logs/index.md, logs/YYYY-MM-DD.md (daily logs only)
  #   user/inbox.md
  #
  # Everything else (project docs, concepts, ideas, skills, archive logs) is unprotected.

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

  Scenario: Files outside the protected list are not guarded
    Given a user file "user/notes.md" with headings "Ideas, Done"
    When the agent writes the file without the "Ideas" heading
    Then the file keeps the new content

  Scenario: A write that removes headings from a project file is allowed
    Given a brain file "agent_brain/projects/buddy/bugs.md" with headings "BUG-01, BUG-02"
    When the agent writes the file without the "BUG-02" heading
    Then the file keeps the new content

  Scenario: A write that removes headings from a concept file is allowed
    Given a brain file "agent_brain/concepts/some-concept.md" with headings "Summary, Examples"
    When the agent writes the file without the "Examples" heading
    Then the file keeps the new content

  Scenario: A write that removes headings from a skill file is allowed
    Given a brain file "agent_brain/skills/process-conversation.md" with headings "Procedure, Quality"
    When the agent writes the file without the "Quality" heading
    Then the file keeps the new content

  Scenario: A write that removes headings from an idea file is allowed
    Given a brain file "agent_brain/ideas/2026-08-16_test-idea.md" with headings "Core idea, Notes"
    When the agent writes the file without the "Notes" heading
    Then the file keeps the new content

  Scenario: A write that removes headings from identity family.md is allowed
    Given a brain file "agent_brain/identity/family.md" with headings "Context, Care"
    When the agent writes the file without the "Care" heading
    Then the file keeps the new content

  Scenario: A write that removes headings from archived logs is allowed
    Given a log file "logs/archive/2026-07/2026-07-08.md" with headings "Day summary, Lessons"
    When the agent writes the file without the "Lessons" heading
    Then the file keeps the new content

  Scenario: AGENTS.md at the repo root is guarded
    Given a brain file "AGENTS.md" with headings "Active context, Where to find things"
    When the agent writes the file without the "Active context" heading
    Then the file is restored to its pre-write content
    And the tool result reports the lost heading "Active context"

  Scenario: user inbox is guarded
    Given a user file "user/inbox.md" with headings "Capture, Next Actions"
    When the agent writes the file without the "Capture" heading
    Then the file is restored to its pre-write content
    And the tool result reports the lost heading "Capture"

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

  Scenario: A write that removes an h1 heading is reverted
    Given a log file "logs/2026-08-05.md" with title "Log — 2026-08-05" and headings "Day summary"
    When the agent writes the file without the title "Log — 2026-08-05"
    Then the file is restored to its pre-write content
    And the tool result reports the lost heading "Log — 2026-08-05"

  Scenario: A write that strips frontmatter is reverted
    Given a brain file "agent_brain/deferred.md" with frontmatter and headings "Deferred Items"
    When the agent writes the file without frontmatter
    Then the file is restored to its pre-write content

  Scenario: A write that preserves frontmatter is allowed
    Given a brain file "agent_brain/deferred.md" with frontmatter and headings "Deferred Items"
    When the agent writes the file keeping frontmatter and all headings
    Then the file keeps the new content

  Scenario: A file without frontmatter does not trigger frontmatter guard
    Given a brain file "agent_brain/concepts/test.md" with headings "Summary"
    When the agent writes the file keeping all headings
    Then the file keeps the new content
