# specs/features/inline-file-viewer.feature

Feature: Inline file viewer (FR-CHAT-10, FR-CHAT-11)
  As a user
  I want markdown and text files to open inside Buddy
  So that I can read referenced files without leaving the app
  And I want Buddy to never launch an external program on my behalf

  Background:
    Given the buddy root directory is "/home/buddy"

  # --- Allowed: viewable files inside the four scoped directories ---

  Scenario: A markdown link under agent_brain routes to the inline viewer
    When I click the local link "agent_brain/concepts/foo.md"
    Then the link opens in the viewer with relative path "agent_brain/concepts/foo.md"

  Scenario: A text link under user routes to the inline viewer
    When I click the local link "user/notes/readme.txt"
    Then the link opens in the viewer with relative path "user/notes/readme.txt"

  Scenario: A markdown link under downloads routes to the inline viewer
    When I click the local link "downloads/2026-07-26_article.md"
    Then the link opens in the viewer with relative path "downloads/2026-07-26_article.md"

  Scenario: A markdown link under logs routes to the inline viewer
    When I click the local link "logs/2026-07-26.md"
    Then the link opens in the viewer with relative path "logs/2026-07-26.md"

  # --- Rejected: non-viewable file types (NFR-TEST-01 adversarial) ---
  # Buddy never hands a file to an external program. A non-viewable target is
  # not clickable; the user locates it with their own file manager.

  Scenario: A PDF link is rejected rather than opened by the system
    When I click the local link "downloads/guide.pdf"
    Then the link is rejected

  Scenario: An image link is rejected rather than opened by the system
    When I click the local link "downloads/screenshot.png"
    Then the link is rejected

  Scenario: An executable script link is rejected
    When I click the local link "downloads/payload.command"
    Then the link is rejected

  Scenario: An application bundle path is rejected
    # On macOS a .app bundle IS a directory — an isDirectory() exception would
    # reopen the code-execution path FR-CHAT-11 exists to close.
    When I click the local link "downloads/Evil.app"
    Then the link is rejected

  # --- Rejected: outside the buddy directory (NFR-TEST-01 adversarial) ---

  Scenario: A relative traversal escaping the buddy directory is rejected
    When I click the local link "../../secret.md"
    Then the link is rejected

  Scenario: A traversal disguised inside an allowed directory is rejected
    When I click the local link "user/../../../secret.md"
    Then the link is rejected

  Scenario: An absolute path outside the buddy directory is rejected
    When I click the local link "/etc/hosts"
    Then the link is rejected

  Scenario: A file URL pointing outside the buddy directory is rejected
    When I click the local link "file:///Users/someone/.ssh/id_rsa"
    Then the link is rejected

  # --- Rejected: inside the buddy directory but outside the four allowed dirs ---

  Scenario: A viewable file at the buddy root is rejected
    When I click the local link "AGENTS.md"
    Then the link is rejected

  Scenario: A file under the runtime state directory is rejected
    When I click the local link ".buddy/consolidation-state.json"
    Then the link is rejected

  # --- Viewer behavior ---

  Scenario: Opening a markdown file loads content in the viewer
    Given a readable file "agent_brain/concepts/foo.md" with content "# Title\n\nBody"
    When the file viewer opens "agent_brain/concepts/foo.md"
    Then the file viewer is open
    And the file viewer shows path "agent_brain/concepts/foo.md"
    And the file viewer shows file name "foo.md"
    And the file viewer content is markdown
    And the file viewer shows content "# Title\n\nBody"

  Scenario: Opening a text file loads plain text in the viewer
    Given a readable file "user/notes/readme.txt" with content "Plain notes"
    When the file viewer opens "user/notes/readme.txt"
    Then the file viewer is open
    And the file viewer content is plain text
    And the file viewer shows content "Plain notes"

  Scenario: Closing the file viewer clears its state
    Given a readable file "agent_brain/concepts/foo.md" with content "# Title"
    When the file viewer opens "agent_brain/concepts/foo.md"
    And the file viewer is closed
    Then the file viewer is not open

  Scenario: Missing file shows an error in the viewer
    When the file viewer opens "agent_brain/missing.md"
    Then the file viewer is open
    And the file viewer shows an error

  # --- FR-CHAT-15: frontmatter is metadata, not content ---
  #
  # `---` under text is a setext heading in markdown, so rendering the raw file
  # turns the metadata block into an <hr> plus an H2 — the largest thing on the
  # page, above the content it describes.

  Scenario: Frontmatter is kept out of the rendered body
    Given a readable file "agent_brain/concepts/foo.md" with content "---\nsummary: What this holds\nlast_accessed: 2026-07-30\naccess_count: 4\ncreated: 2026-01-01\n---\n\n# Title\n\nBody"
    When the file viewer opens "agent_brain/concepts/foo.md"
    Then the file viewer shows content "# Title\n\nBody"
    And the file viewer shows summary "What this holds"

  Scenario: A file without frontmatter renders unchanged and has no summary
    Given a readable file "agent_brain/concepts/foo.md" with content "# Title\n\nBody"
    When the file viewer opens "agent_brain/concepts/foo.md"
    Then the file viewer shows content "# Title\n\nBody"
    And the file viewer shows no summary

  Scenario: Frontmatter without a summary field surfaces nothing in the header
    Given a readable file "agent_brain/concepts/foo.md" with content "---\naccess_count: 4\n---\n\nBody"
    When the file viewer opens "agent_brain/concepts/foo.md"
    Then the file viewer shows content "Body"
    And the file viewer shows no summary

  # A horizontal rule is not a frontmatter block: it is content, and the file
  # opens with it only when the author put it there.
  Scenario: A leading horizontal rule is not treated as frontmatter
    Given a readable file "agent_brain/concepts/foo.md" with content "---\n\n# Title"
    When the file viewer opens "agent_brain/concepts/foo.md"
    Then the file viewer shows content "---\n\n# Title"
    And the file viewer shows no summary

  # Plain text has no frontmatter convention — a .txt starting with dashes is
  # showing the user exactly what the file says.
  Scenario: Frontmatter is not stripped from a plain text file
    Given a readable file "user/notes/readme.txt" with content "---\nsummary: not metadata here\n---\n\nPlain notes"
    When the file viewer opens "user/notes/readme.txt"
    Then the file viewer shows content "---\nsummary: not metadata here\n---\n\nPlain notes"
    And the file viewer shows no summary

  Scenario: Reopening a file without frontmatter clears the previous summary
    Given a readable file "agent_brain/concepts/foo.md" with content "---\nsummary: First file\n---\n\nBody"
    And a readable file "agent_brain/concepts/bar.md" with content "# Bare\n\nBody"
    When the file viewer opens "agent_brain/concepts/foo.md"
    And the file viewer opens "agent_brain/concepts/bar.md"
    Then the file viewer shows no summary

  # --- The removed capability stays removed ---

  Scenario: The file viewer offers no external-open action
    Given a readable file "agent_brain/concepts/foo.md" with content "# Title"
    When the file viewer opens "agent_brain/concepts/foo.md"
    Then the file viewer has no external-open action
