# specs/features/file-viewer-reveal.feature

@FR-CHAT-20
Feature: Reveal file in native file manager from inline viewer
  As a user
  I want to show a viewed user file in my file manager
  So that I can attach it, copy it, or move it myself
  And Buddy never reveals agent_brain or logs that way

  Background:
    Given the buddy root directory is "/home/test/buddy"

  Scenario: Reveal button visible for user/ file
    Given a readable file "user/tasks.md" with content "# Tasks"
    When the file viewer opens "user/tasks.md"
    Then the "Show in folder" action is available

  Scenario: Reveal button hidden for agent_brain/ file
    Given a readable file "agent_brain/observations.md" with content "# Observations"
    When the file viewer opens "agent_brain/observations.md"
    Then the "Show in folder" action is not available

  Scenario: Reveal calls Tauri API with correct absolute path
    Given a readable file "user/tasks.md" with content "# Tasks"
    When the file viewer opens "user/tasks.md"
    And I activate "Show in folder"
    Then revealItemInDir is called with "/home/test/buddy/user/tasks.md"

  Scenario: Reveal rejected for path traversal
    Given a readable file "user/notes.md" with content "notes"
    When the file viewer opens "user/../../../etc/passwd"
    Then the "Show in folder" action is not available
