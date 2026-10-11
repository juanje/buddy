# FR-DATA-05 — consolidation mode block

Feature: Consolidation series block

  Background:
    Given an initialized buddy git repository

  @FR-DATA-05
  Scenario: Day with log and no row is pending
    When data action "define" is invoked with json:
      """
      {"name":"stress","kind":"series","key":"date","columns":{"date":"date","level":"number"},"mode":"consolidation"}
      """
    And buddy file "logs/2026-10-10.md" exists with content "session notes"
    When the depth 1 consolidation prompt is built for "2026-10-11"
    Then the consolidation prompt mentions "pending days: 2026-10-10"

  @FR-DATA-05
  Scenario: Day without log is not pending
    When data action "define" is invoked with json:
      """
      {"name":"stress","kind":"series","key":"date","columns":{"date":"date","level":"number"},"mode":"consolidation"}
      """
    When the depth 1 consolidation prompt is built for "2026-10-11"
    Then the consolidation prompt does not mention "pending days: 2026-10-10"

  @FR-DATA-05
  Scenario: Entry without a single date key is reported
    When data action "define" is invoked with json:
      """
      {"name":"bad","kind":"series","key":["id"],"columns":{"id":"string","note":"string"},"mode":"consolidation"}
      """
    When the depth 1 consolidation prompt is built for "2026-10-11"
    Then the consolidation prompt mentions "exactly one date column"

  @FR-DATA-05
  Scenario: List consolidation entry without inactive suffix
    When data action "define" is invoked with json:
      """
      {"name":"stress","kind":"series","key":"date","columns":{"date":"date","level":"number"},"mode":"consolidation"}
      """
    When data action "list" is invoked
    Then data tool output mentions "stress"
    And data tool output does not mention "inactive until sprint 6"
