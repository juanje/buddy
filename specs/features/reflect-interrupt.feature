# specs/features/reflect-interrupt.feature — NFR-REL-11 (spike A9)

Feature: Portable reflect-child interrupt (NFR-REL-11)
  As a Buddy user on any OS
  I want an interrupted reflect to commit agent writes safely
  So that memory is not lost and git is not raced

  Scenario: Interrupt signals are not SIGTERM-only
    Then reflect interrupt signals on "win32" include "SIGINT", "SIGTERM" and "SIGBREAK"
    And reflect interrupt signals on "linux" include "SIGINT" and "SIGTERM"

  Scenario: Interrupt commit message does not need shell quoting
    Then the reflect interrupted message for "SIGINT" has no single quotes
