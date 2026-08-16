# FR-DELETE-01/02, FR-FILE-01/02/03 — File operations tools

Feature: File operations tools
  As a user
  I want the assistant to copy, move, and delete files safely
  So that workspace files can be managed without token-wasting read/write cycles

  # Protected files (denylist, same as FR-GUARD-01b): AGENTS.md, USER.md, SOUL.md,
  # observations, deferred, indexes, inbox, daily logs. logs/ fully blocked for delete/move.
  # Non-protected agent_brain/ files may be deleted, moved, and reorganized freely.

  Background:
    Given an initialized buddy git repository
    And file tools are available

  Scenario: Delete a file in user workspace
    Given a file "user/notes.md" with content "old task"
    When delete_file is called with path "user/notes.md" and deletion is confirmed
    Then "user/notes.md" does not exist
    And the delete tool result contains "Deleted"

  Scenario: Delete requires user confirmation
    Given a file "user/notes.md" with content "keep until confirmed"
    When delete_file is called with path "user/notes.md" and deletion is denied
    Then "user/notes.md" exists
    And the delete tool result contains "declined"

  Scenario: Delete a brain concept file is allowed
    Given a file "agent_brain/concepts/old-concept.md" with content "obsolete"
    When delete_file is called with path "agent_brain/concepts/old-concept.md" and deletion is confirmed
    Then "agent_brain/concepts/old-concept.md" does not exist
    And the delete tool result contains "Deleted"

  Scenario: Delete a brain project file is allowed
    Given a file "agent_brain/projects/foo/notes.md" with content "notes"
    When delete_file is called with path "agent_brain/projects/foo/notes.md" and deletion is confirmed
    Then "agent_brain/projects/foo/notes.md" does not exist

  Scenario: Delete a brain skill file is allowed
    Given a file "agent_brain/skills/custom-skill.md" with content "skill"
    When delete_file is called with path "agent_brain/skills/custom-skill.md" and deletion is confirmed
    Then "agent_brain/skills/custom-skill.md" does not exist

  Scenario: Reject delete of protected brain file
    Given a file "agent_brain/observations.md" with content "## Active\n\nStuff."
    When delete_file is called with path "agent_brain/observations.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject delete in logs
    Given a file "logs/2026-07-26.md" with content "log entry"
    When delete_file is called with path "logs/2026-07-26.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject delete of identity file
    When delete_file is called with path "AGENTS.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject delete of protected inbox
    Given a file "user/inbox.md" with content "## Capture\n\nItems."
    When delete_file is called with path "user/inbox.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject delete of missing file
    When delete_file is called with path "user/missing.md"
    Then the file tool returns an error containing "does not exist"

  Scenario: Copy external file into user workspace
    Given an external file "/tmp/buddy-external.txt" with content "external content"
    When copy_file is called with source "/tmp/buddy-external.txt" and destination "user/external.txt"
    Then "user/external.txt" exists
    And the file "user/external.txt" contains "external content"
    And the copy tool result contains "Copied"

  Scenario: Reject copy destination outside user workspace
    Given an external file "/tmp/buddy-external.txt" with content "external content"
    When copy_file is called with source "/tmp/buddy-external.txt" and destination "agent_brain/stolen.txt"
    Then the file tool returns an error containing "not allowed"

  Scenario: Move file within user workspace
    Given a file "user/old-name.md" with content "move me"
    When move_file is called with source "user/old-name.md" and destination "user/projects/new-name.md"
    Then "user/old-name.md" does not exist
    And "user/projects/new-name.md" exists
    And the file "user/projects/new-name.md" contains "move me"
    And the move tool result contains "Moved"

  Scenario: Move brain file to deeper directory and rewrite links
    Given a file "agent_brain/concepts/x.md" with content "concept"
    And a file "agent_brain/concepts/index.md" with content "See [X](x.md) for details."
    When move_file is called with source "agent_brain/concepts/x.md" and destination "agent_brain/concepts/cluster/x.md"
    Then "agent_brain/concepts/x.md" does not exist
    And "agent_brain/concepts/cluster/x.md" exists
    And the file "agent_brain/concepts/index.md" contains "cluster/x.md"
    And the move tool result contains "Updated links in"

  Scenario: Move brain file reports when no links need updating
    Given a file "agent_brain/ideas/seed.md" with content "idea"
    When move_file is called with source "agent_brain/ideas/seed.md" and destination "agent_brain/ideas/2026-08-16_seed.md"
    Then "agent_brain/ideas/2026-08-16_seed.md" exists
    And the move tool result contains "No links to update"

  Scenario: Reject move of protected brain file
    Given a file "agent_brain/deferred.md" with content "## Queue\n\nItems."
    When move_file is called with source "agent_brain/deferred.md" and destination "agent_brain/archive/deferred.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject move from logs
    Given a file "logs/2026-08-01.md" with content "## Day summary\n\nContent."
    When move_file is called with source "logs/2026-08-01.md" and destination "logs/archive/2026-08-01.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject move destination outside rootDir
    Given a file "user/notes.md" with content "stay"
    When move_file is called with source "user/notes.md" and destination "/tmp/outside.md"
    Then the file tool returns an error containing "not allowed"
