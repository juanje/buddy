# specs/features/inline-file-viewer.feature

Feature: Inline file viewer (FR-CHAT-10)
  As a user
  I want markdown and text files to open inside Buddy
  So that I can read referenced files without leaving the app

  Background:
    Given the AB root directory is "/home/buddy"

  Scenario: Clicking a markdown link routes to the inline viewer
    When I click the local link "agent_brain/concepts/foo.md"
    Then the link action is "view"
    And the resolved path is "/home/buddy/agent_brain/concepts/foo.md"

  Scenario: Clicking a text link routes to the inline viewer
    When I click the local link "notes/readme.txt"
    Then the link action is "view"
    And the resolved path is "/home/buddy/notes/readme.txt"

  Scenario: Clicking a PDF link falls back to the system app
    When I click the local link "docs/guide.pdf"
    Then the link action is "open"
    And the resolved path is "/home/buddy/docs/guide.pdf"

  Scenario: Opening a markdown file loads content in the viewer
    Given a readable file "/home/buddy/agent_brain/concepts/foo.md" with content "# Title\n\nBody"
    When the file viewer opens "/home/buddy/agent_brain/concepts/foo.md"
    Then the file viewer is open
    And the file viewer shows path "/home/buddy/agent_brain/concepts/foo.md"
    And the file viewer shows file name "foo.md"
    And the file viewer content is markdown
    And the file viewer shows content "# Title\n\nBody"

  Scenario: Opening a text file loads plain text in the viewer
    Given a readable file "/home/buddy/notes/readme.txt" with content "Plain notes"
    When the file viewer opens "/home/buddy/notes/readme.txt"
    Then the file viewer is open
    And the file viewer content is plain text
    And the file viewer shows content "Plain notes"

  Scenario: Closing the file viewer clears its state
    Given a readable file "/home/buddy/agent_brain/concepts/foo.md" with content "# Title"
    When the file viewer opens "/home/buddy/agent_brain/concepts/foo.md"
    And the file viewer is closed
    Then the file viewer is not open

  Scenario: Open externally uses the system opener
    Given a readable file "/home/buddy/agent_brain/concepts/foo.md" with content "# Title"
    When the file viewer opens "/home/buddy/agent_brain/concepts/foo.md"
    And the file viewer opens externally
    Then the system opener was called for "/home/buddy/agent_brain/concepts/foo.md"

  Scenario: Missing file shows an error in the viewer
    When the file viewer opens "/home/buddy/missing.md"
    Then the file viewer is open
    And the file viewer shows an error
