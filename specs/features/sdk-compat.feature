# specs/features/sdk-compat.feature

Feature: Pi SDK compatibility (FR-SDK-01)
  As the Buddy worker
  I want streaming to work with delta-only message_update events
  So that Pi SDK upgrades do not break the chat display

  Scenario: Assistant text streams via delta-only events
    Given a started session
    When the assistant streams "Hello world" as deltas
    Then the chat displays "Hello world"
    And no message_update event carries a cumulative message field
