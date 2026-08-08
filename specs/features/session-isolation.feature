Feature: Session file isolation (NFR-SEC-19)
  Pi session transcripts must live under the buddy instance,
  not in the Pi CLI directory.

  Scenario: Live session files are stored under .buddy/sessions/
    Given a configured buddy instance
    When a new session is created
    Then the session directory is inside the buddy root
    And the session directory is not under the Pi CLI agent directory

  Scenario: Old session files are pruned after retention period
    Given a buddy instance with session files older than 7 days
    When session artifact pruning runs
    Then the expired session files are removed
    And recent session files are kept
