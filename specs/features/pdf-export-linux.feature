# specs/features/pdf-export-linux.feature

@FR-CHAT-21
Feature: PDF export platform availability
  As a user on macOS or Linux
  I want the Export PDF action when my platform supports it
  So that I can save markdown without using Windows-only gaps

  Scenario: Export PDF available on Linux for markdown
    Given the buddy root directory is "/home/test/buddy"
    And the browser user agent is "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    And a readable file "user/notes.md" with content "# Hello"
    When the file viewer opens "user/notes.md" with native PDF platform detection
    Then the "Export PDF" action is available

  Scenario: Export PDF hidden on Linux for plain text
    Given the buddy root directory is "/home/test/buddy"
    And the browser user agent is "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    And a readable file "user/notes.txt" with content "plain"
    When the file viewer opens "user/notes.txt" with native PDF platform detection
    Then the "Export PDF" action is not available

  Scenario: Export PDF hidden on Windows for markdown
    Given the buddy root directory is "/home/test/buddy"
    And the browser user agent is "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    And a readable file "user/notes.md" with content "# Hello"
    When the file viewer opens "user/notes.md" with native PDF platform detection
    Then the "Export PDF" action is not available

  Scenario: Export PDF still available on macOS for markdown
    Given the buddy root directory is "/home/test/buddy"
    And the browser user agent is "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15"
    And a readable file "user/notes.md" with content "# Hello"
    When the file viewer opens "user/notes.md" with native PDF platform detection
    Then the "Export PDF" action is available
