Feature: First-open-of-the-day orientation

  @FR-ORIENT-02
  Scenario: Orientation data bundles deferred items and next tasks on first open
    Given an initialized buddy git repository for orientation
    And orientation has not been shown today
    And the orientation deferred queue has an item due on "2026-09-10"
    And tasks.md has next action "Review PR" in area dev
    When orientation data is fetched for today "2026-09-10"
    Then orientation data includes 1 deferred item
    And orientation data includes next task "Review PR"

  @FR-ORIENT-02
  Scenario: Orientation data is null when already shown today
    Given an initialized buddy git repository for orientation
    And orientation was shown on "2026-09-10"
    When orientation data is fetched for today "2026-09-10"
    Then orientation data is null

  @FR-ORIENT-02
  Scenario: Dismiss orientation persists last shown date and acknowledges deferred
    Given an initialized buddy git repository for orientation
    And the orientation deferred queue has an item due on "2026-09-10"
    When orientation is dismissed for today "2026-09-10"
    Then orientation last shown date is "2026-09-10"
    And the deferred queue is empty

  @FR-ORIENT-03
  Scenario: Agent generates where-we-left-off recap after session ready
    Given the app is running
    And the Pi SDK session is connected
    And orientation was shown this session
    When the session becomes ready
    And the one-liner is requested
    Then the worker sends a silent recap prompt to the agent
    And the frontend receives the one-liner text via onOneLiner

  @FR-ORIENT-03
  Scenario: One-liner replaces welcome greeting and hides after first message
    Given the app is running
    And the Pi SDK session is connected
    And a one-liner "Worked on orientation card" has been received
    Then the welcome greeting is not visible
    When I send the message "Hello"
    Then the one-liner is not visible

  @FR-ORIENT-04
  Scenario: One-liner does not reappear after topic change
    Given the app is running
    And the Pi SDK session is connected
    And orientation was shown this session
    And a one-liner "Worked on orientation card" has been received
    When a topic transition starts
    Then the one-liner is cleared
    And the one-liner would not be re-requested on session ready
