# FR-DATA-04 — on_mention in session context

Feature: On mention data registry

  Background:
    Given an initialized buddy git repository

  @FR-DATA-04
  Scenario: Two on mention entries appear in one session context line
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"},"mode":"on_mention","instructions":"One row per episode."}
      """
    And data action "define" is invoked with json:
      """
      {"name":"incidents","kind":"series","key":"id","columns":{"id":"string","note":"string"},"mode":"on_mention","instructions":"Log each incident."}
      """
    When the session context is assembled
    Then the session context includes active on mention data
    And the session context message mentions "migranas (user/data/migranas.csv)"
    And the session context message mentions "incidents (user/data/incidents.csv)"

  @FR-DATA-04
  Scenario: Consolidation mode entry is not listed in session context
    When data action "define" is invoked with json:
      """
      {"name":"stress","kind":"series","key":"date","columns":{"date":"date","level":"number"},"mode":"consolidation"}
      """
    When the session context is assembled
    Then the session context has no active on mention data section

  @FR-DATA-04
  Scenario: Empty registry has no active on mention section
    When the session context is assembled
    Then the session context has no active on mention data section

  @FR-DATA-04
  Scenario: List on mention entry without inactive suffix
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"},"mode":"on_mention"}
      """
    When data action "list" is invoked
    Then data tool succeeded
    And data tool output mentions "migranas"
    And data tool output does not mention "inactive until sprint 6"
