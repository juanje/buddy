# specs/features/permissions.feature

Feature: Permission zones (FR-PERM-01, FR-PERM-02, FR-PERM-03, FR-PERM-04)
  As the user of a file-capable assistant
  I want file access controlled by zones
  So that my AB is free, my identity is protected, and my system is safe

  Background:
    Given a permission layer for an AB directory

  Scenario: Zone 1 — reads and writes inside the AB are allowed silently
    When the agent reads "agent_brain/observations.md"
    And the agent writes "user/inbox.md"
    Then both operations proceed without asking the user

  Scenario: Identity file writes require confirmation (allowed)
    When the agent writes "agent_brain/identity/SOUL.md"
    Then the user is asked to confirm an identity write
    When the user confirms
    Then the operation proceeds

  Scenario: Identity file writes require confirmation (denied)
    When the agent writes "agent_brain/identity/USER.md"
    Then the user is asked to confirm an identity write
    When the user declines
    Then the operation is blocked

  Scenario: Identity file reads are silent
    When the agent reads "agent_brain/identity/SOUL.md"
    Then the operation proceeds without asking the user

  Scenario: Zone 3 — paths outside the AB prompt the user
    When the agent reads the outside path "~/Documents/notes.txt"
    Then the user is asked for outside access
    When the user declines
    Then the operation is blocked

  Scenario: Zone 3 — allow once proceeds
    When the agent reads the outside path "~/Documents/notes.txt"
    And the user allows once
    Then the operation proceeds

  Scenario: Denylist paths are blocked silently
    When the agent reads the outside path "~/.ssh/id_rsa"
    Then the operation is blocked
    And the user is never asked

  Scenario: Denylist applies inside the AB too
    When the agent reads "secrets/auth.json"
    Then the operation is blocked
    And the user is never asked

  Scenario: Tools without a path argument stay in the AB and are allowed
    When the agent lists files without a path
    Then the operation proceeds without asking the user
