# FR-DELETE-01, FR-FILE-01, FR-FILE-02 — File operations tools

Feature: File operations tools
  As a user
  I want the assistant to copy, move, and delete files safely
  So that workspace files can be managed without token-wasting read/write cycles

  Background:
    Given an initialized buddy git repository
    And file tools are available

  Scenario: Delete a file in user workspace
    Given a file "user/inbox.md" with content "old task"
    When delete_file is called with path "user/inbox.md" and deletion is confirmed
    Then "user/inbox.md" does not exist
    And the delete tool result contains "Deleted"

  Scenario: Delete requires user confirmation
    Given a file "user/inbox.md" with content "keep until confirmed"
    When delete_file is called with path "user/inbox.md" and deletion is denied
    Then "user/inbox.md" exists
    And the delete tool result contains "declined"

  Scenario: Reject delete outside user workspace
    When delete_file is called with path "agent_brain/concepts/foo.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject delete in logs
    Given a file "logs/2026-07-26.md" with content "log entry"
    When delete_file is called with path "logs/2026-07-26.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject delete of identity file
    When delete_file is called with path "AGENTS.md"
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

  Scenario: Reject move from agent_brain
    Given a file "agent_brain/concepts/foo.md" with content "brain"
    When move_file is called with source "agent_brain/concepts/foo.md" and destination "user/foo.md"
    Then the file tool returns an error containing "not allowed"

  Scenario: Reject move destination outside rootDir
    Given a file "user/inbox.md" with content "stay"
    When move_file is called with source "user/inbox.md" and destination "/tmp/outside.md"
    Then the file tool returns an error containing "not allowed"
