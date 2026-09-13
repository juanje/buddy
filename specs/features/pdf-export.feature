# specs/features/pdf-export.feature

@FR-CHAT-18
Feature: Export viewed file as PDF
  As a user
  I want to save a viewed markdown document as a PDF
  So that I can send it to someone who does not read markdown
  And Buddy never writes the file to a location I did not pick

  Background:
    Given the buddy root directory is "/home/test/buddy"
    And PDF export is available

  Scenario: Export PDF button visible for markdown file
    Given a readable file "user/notes.md" with content "# Hello"
    When the file viewer opens "user/notes.md"
    Then the "Export PDF" action is available

  Scenario: Export PDF button hidden for plain text
    Given a readable file "user/notes.txt" with content "plain notes"
    When the file viewer opens "user/notes.txt"
    Then the "Export PDF" action is not available

  Scenario: PDF HTML template is self-contained
    Given markdown content "<h1>Hello</h1><p>Body</p>"
    When the PDF HTML is assembled
    Then the PDF HTML is a complete document with charset
    And the PDF HTML has no CSS variables
    And the PDF HTML contains the rendered body
    And the PDF HTML uses pt-based padding for A4 layout
    And the PDF HTML avoids page breaks inside blocks

  Scenario: Export cancelled by user writes nothing
    Given a readable file "user/notes.md" with content "# Hello"
    And the save dialog will be cancelled
    When the file viewer opens "user/notes.md"
    And I activate "Export PDF"
    Then no PDF file is written
