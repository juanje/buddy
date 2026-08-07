# FR-INGEST-01..04 — File ingest (drag, attach, permissions, formats)

Feature: File ingest
  As a user
  I want to attach files to my message
  So that the assistant can read and discuss them

  Background:
    Given the chat is connected

  Scenario: A markdown attachment is sent with the prompt
    When I attach the file "/tmp/notes.md"
    And I type "Summarize this"
    And I press Enter
    Then the prompt includes "User attached: /tmp/notes.md"
    And the prompt includes "Summarize this"

  Scenario: An unsupported format is rejected
    When I attach the file "/tmp/report.docx"
    Then no attachment chips are shown
    And an attachment error is shown for "report.docx"

  Scenario: A CSV file is accepted as a text attachment
    When I attach the file "/tmp/data.csv"
    Then the attachment is accepted

  Scenario: A JSON file is accepted as a text attachment
    When I attach the file "/tmp/config.json"
    Then the attachment is accepted

  Scenario: A YAML file is accepted as a text attachment
    When I attach the file "/tmp/settings.yaml"
    Then the attachment is accepted

  Scenario: A log file is accepted as a text attachment
    When I attach the file "/tmp/app.log"
    Then the attachment is accepted

  Scenario: A spreadsheet file shows export-to-CSV guidance
    When I attach the file "/tmp/report.xlsx"
    Then no attachment chips are shown
    And an attachment error is shown for "report.xlsx"
    And the attachment error suggests CSV export

  Scenario: A PDF file is attached and its text is extracted into the prompt
    Given a PDF file exists at "/tmp/sample.pdf" with text "Hello from PDF"
    When I attach the file "/tmp/sample.pdf"
    Then the attachment is accepted
    And I type "Summarize this"
    And I press Enter
    Then the prompt includes "Hello from PDF"

  Scenario: Attached outside path is allowed without permission prompt
    Given a permission layer with session-allowed paths
    When the user attaches "~/Documents/draft.md"
    And the agent reads the session-attached outside path "~/Documents/draft.md"
    Then the read is allowed silently

  Scenario: Removing a chip before send excludes the file
    When I attach the file "/tmp/a.md"
    And I attach the file "/tmp/b.md"
    And I remove the attachment "/tmp/a.md"
    And I type "Compare"
    And I press Enter
    Then the prompt includes "User attached: /tmp/b.md"
    And the prompt does not include "/tmp/a.md"
