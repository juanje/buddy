# FR-DASH-16 — inline refresh in consolidation

Feature: Inline dashboard refresh

  Background:
    Given an initialized buddy git repository

  @FR-DASH-16
  Scenario: Daily refresh stale yesterday appears at depth 1
    Given dashboard file "user/dashboards/stale-daily.md" with body:
      """
      ```dashboard
      - view: counter
        title: Status
        source: inline
        updated: 2026-10-10
        basis: Test
        refresh: daily
        count: true
        rows:
          - id: 1
      ```
      """
    When the depth 1 consolidation prompt is built for "2026-10-11"
    Then the consolidation prompt mentions "stale-daily.md"
    And the consolidation prompt mentions "refresh daily updated 2026-10-10"

  @FR-DASH-16
  Scenario: Daily refresh updated today is not listed at depth 1
    Given dashboard file "user/dashboards/fresh-daily.md" with body:
      """
      ```dashboard
      - view: counter
        title: Status
        source: inline
        updated: 2026-10-11
        basis: Test
        refresh: daily
        count: true
        rows:
          - id: 1
      ```
      """
    When the depth 1 consolidation prompt is built for "2026-10-11"
    Then the consolidation prompt does not mention "fresh-daily.md"

  @FR-DASH-16
  Scenario: Weekly refresh appears at depth 2 after seven days
    Given dashboard file "user/dashboards/stale-weekly.md" with body:
      """
      ```dashboard
      - view: counter
        title: Board
        source: inline
        updated: 2026-10-01
        basis: Test
        refresh: weekly
        count: true
        rows:
          - id: 1
      ```
      """
    When the depth 1 consolidation prompt is built for "2026-10-11"
    Then the consolidation prompt does not mention "stale-weekly.md"
    When the depth 2 consolidation prompt is built for "2026-10-11"
    Then the consolidation prompt mentions "stale-weekly.md"
    And the consolidation prompt mentions "refresh weekly updated 2026-10-01"

  @FR-DASH-16
  Scenario: Refresh on tasks source is a widget error
    Given a dashboard file with body:
      """
      ```dashboard
      - view: counter
        title: Bad
        source: tasks
        refresh: daily
        count: true
      - view: counter
        title: Ok
        source: inline
        updated: 2026-10-11
        basis: Demo
        count: true
        rows:
          - id: 1
      ```
      """
    When the dashboard is resolved for today "2026-10-11"
    Then the resolved dashboard has 2 segments
    And segment 1 widget result is an error mentioning "refresh"
    And segment 2 widget result is not an error
