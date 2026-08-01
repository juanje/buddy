# specs/features/show-file.feature

Feature: show_file — the agent opens a file in the viewer (FR-CHAT-17)
  As a user who came here from a chat assistant
  I want "show me my profile" to show me the file
  So that seeing a file does not depend on knowing that a link is an offer

  # Reading a link as an invitation to click is expert knowledge about how Buddy
  # works. `show_file` lets the agent do the opening, so the panel is the answer
  # rather than a step the user has to discover.

  Background:
    Given a buddy repository with show_file available

  Scenario: Showing a file in the agent's memory opens the viewer on it
    Given a readable repository file "agent_brain/identity/USER.md" with content "# Profile"
    When the agent shows the file "agent_brain/identity/USER.md"
    Then the viewer is asked to open "agent_brain/identity/USER.md"
    And show_file reports success

  Scenario: Showing a file in the user workspace opens the viewer on it
    Given a readable repository file "user/inbox.md" with content "# Inbox"
    When the agent shows the file "user/inbox.md"
    Then the viewer is asked to open "user/inbox.md"

  Scenario: A plain text file is viewable too
    Given a readable repository file "user/notes.txt" with content "Notes"
    When the agent shows the file "user/notes.txt"
    Then the viewer is asked to open "user/notes.txt"

  # --- Refused, exactly as a clicked link is (FR-CHAT-11, NFR-SEC-09) ---
  #
  # The panel must not open on a refusal, and the agent must get something it can
  # say out loud rather than a stack trace.

  Scenario: A file outside the four user-facing directories is refused
    Given a readable repository file "AGENTS.md" with content "# Rules"
    When the agent shows the file "AGENTS.md"
    Then show_file is refused
    And the viewer is not asked to open anything

  Scenario: A file type Buddy cannot render inline is refused
    Given a readable repository file "downloads/guide.pdf" with content "%PDF"
    When the agent shows the file "downloads/guide.pdf"
    Then show_file is refused
    And the viewer is not asked to open anything

  Scenario: A traversal escaping the buddy directory is refused
    When the agent shows the file "user/../../secret.md"
    Then show_file is refused
    And the viewer is not asked to open anything

  Scenario: An absolute path outside the buddy directory is refused
    When the agent shows the file "/etc/hosts"
    Then show_file is refused
    And the viewer is not asked to open anything

  Scenario: The runtime state directory is refused
    When the agent shows the file ".buddy/consolidation-state.json"
    Then show_file is refused
    And the viewer is not asked to open anything

  # A path whose spelling is beyond reproach can still point outside the
  # directory. That question is answered against the filesystem, not the string
  # (NFR-SEC-15, NFR-SEC-16).
  Scenario: A symlink pointing outside the buddy directory is refused
    Given "user/escape.md" is a symlink to a file outside the buddy directory
    When the agent shows the file "user/escape.md"
    Then show_file is refused
    And the viewer is not asked to open anything

  Scenario: A file that does not exist is refused in plain language
    When the agent shows the file "user/nope.md"
    Then show_file is refused
    And the refusal mentions "user/nope.md"
    And the viewer is not asked to open anything

  Scenario: A directory is not a file to show
    Given a readable repository file "user/notes/readme.md" with content "Notes"
    When the agent shows the file "user/notes"
    Then show_file is refused
    And the viewer is not asked to open anything
