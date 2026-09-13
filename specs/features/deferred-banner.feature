# specs/features/deferred-banner.feature

Feature: Deferred banner Close vs Dismiss (FR-DEFERRED-04)
  As a user
  I want to hide the deferred banner without losing reminders
  So that I can clear the chat and still be reminded later

  @FR-DEFERRED-04
  Scenario: Closing deferred banner hides it without removing items
    Given an initialized buddy git repository for orientation
    And the orientation deferred queue has an item due on "2026-09-10"
    And the app is running
    And the Pi SDK session is connected
    When I close the deferred banner
    Then the deferred dismiss RPC was not called
    And the deferred queue still has due items

  @FR-DEFERRED-04
  Scenario: Dismissing deferred banner removes due items
    Given an initialized buddy git repository for orientation
    And the orientation deferred queue has an item due on "2026-09-10"
    And the app is running
    And the Pi SDK session is connected
    When I dismiss the deferred banner
    Then the deferred dismiss RPC was called
    And the deferred queue is empty
