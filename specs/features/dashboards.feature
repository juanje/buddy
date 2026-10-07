# FR-DASH — read-only dashboards over Buddy files

Feature: Dashboard resolution

  @FR-DASH-01
  Scenario: Document order and default widget width
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      Intro text.

      ```dashboard
      - view: text
        text: Widget one
      - view: text
        text: Widget two
        width: half
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then the resolved dashboard has 3 segments
    And segment 1 is text "Intro text."
    And segment 2 is a text widget with width full
    And segment 3 is a text widget with width half

  @FR-DASH-01
  Scenario: Unknown widget key is an error for that widget only
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: text
        text: OK
      - view: text
        text: Bad
        not_a_key: 1
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a text widget without error
    And segment 2 widget result is an error mentioning "not_a_key"

  @FR-DASH-01
  Scenario: Unknown view is a widget error
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: piechart
        source: tasks
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "piechart"

  @FR-DASH-01
  Scenario: Invalid YAML marks every widget in the block as errored
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      Before

      ```dashboard
      - view: text
        text: [unclosed
      ```

      After
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is text "Before"
    And segment 2 widget result is an error
    And segment 3 is text "After"

  @FR-DASH-01
  Scenario: Unclosed dashboard fence is a widget error
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: text
        text: Orphan
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "fence"

  @FR-DASH-05
  Scenario: Tasks source exposes derived state
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, state]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget rows include states "next", "open", "scheduled", "parked"

  @FR-DASH-05
  Scenario: Tasks source includes stale_days for aged open items
    Given an initialized buddy git repository
    And tasks.md with a stale open task
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, stale_days]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget rows include stale_days at least 31

  @FR-DASH-05
  Scenario: Deferred source exposes queue fields
    Given an initialized buddy git repository
    And deferred.md with one due item
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: deferred
        columns: [type, date, source, text]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget rows include deferred type "reminder"

  @FR-DASH-05
  Scenario: Missing tasks file yields zero rows without error
    Given an initialized buddy git repository
    And tasks.md does not exist
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 0 rows and no error

  @FR-DASH-05
  Scenario: Unknown source is a widget error listing known sources
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: jira
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "jira"
    And segment 1 widget result is an error mentioning "tasks"
