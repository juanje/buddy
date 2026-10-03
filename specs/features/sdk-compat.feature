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

  @FR-SDK-04
  Scenario: Buddy runs on Pi 1.x
    Given the Pi SDK dependency declared by Buddy
    Then both the declared range and the installed version are 1.x

  @FR-SDK-04
  Scenario: Deep imports into Pi internals still resolve
    Given the Pi SDK dependency declared by Buddy
    Then every deep import Buddy makes into Pi internals resolves on disk

  @FR-SDK-04
  Scenario: Every provider Buddy maps is in the Pi catalog
    Given the Pi SDK dependency declared by Buddy
    Then the Pi catalog knows every provider Buddy maps
