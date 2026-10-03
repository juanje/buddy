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

  Scenario: Save dialog starts in the operating system downloads directory
    Given the operating system downloads directory is "/home/ana/Descargas"
    When a PDF save is offered for "notas.pdf"
    Then the save dialog default path is "/home/ana/Descargas/notas.pdf"
    And the save dialog default path is not a bare filename

  Scenario: Save dialog keeps the downloads folder name the operating system returned
    Given the operating system downloads directory is "/home/ana/Downloads"
    When a PDF save is offered for "notes.pdf"
    Then the save dialog default path is "/home/ana/Downloads/notes.pdf"

  Scenario: Save dialog still opens when the operating system has no downloads directory
    Given the operating system has no downloads directory
    And the home directory is "/home/ana"
    When a PDF save is offered for "notas.pdf"
    Then the save dialog default path is "/home/ana/notas.pdf"

  Scenario: Next PDF export opens in the directory the user confirmed
    Given the operating system downloads directory is "/home/ana/Descargas"
    And the next PDF save will be confirmed at "/home/ana/Documentos/notas.pdf"
    When a PDF save is offered for "notas.pdf"
    And a PDF save is offered for "otra.pdf"
    Then the save dialog default path is "/home/ana/Documentos/otra.pdf"
    And the first save dialog default path was "/home/ana/Descargas/notas.pdf"

  Scenario: Cancelling the save dialog does not change the starting directory
    Given the operating system downloads directory is "/home/ana/Descargas"
    And the next PDF save will be cancelled
    When a PDF save is offered for "notas.pdf"
    Then the save dialog default path is "/home/ana/Descargas/notas.pdf"
    And no PDF file is written
    When a PDF save is offered for "otra.pdf"
    Then the save dialog default path is "/home/ana/Descargas/otra.pdf"
