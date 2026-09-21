# FR-TASKM-46 — Per-area WIP overrides

Feature: Per-area WIP limit overrides
  As a user with portfolio areas
  I want per-area WIP overrides
  So that portfolio areas do not generate false WIP alerts

  @FR-TASKM-46
  Scenario: Area with null override shows no limit in active fronts block
    Given an initialized buddy git repository with tasks
    And WIP override for area "work" is null
    When active fronts are computed and formatted with config
    Then the active fronts block contains "@work: 5 (no limit)"

  @FR-TASKM-46
  Scenario: Area with numeric override shows custom limit
    Given an initialized buddy git repository with tasks
    And WIP override for area "personal" is 5
    When active fronts are computed and formatted with config
    Then the active fronts block contains "@personal: 2 (limit: 5)"

  @FR-TASKM-46
  Scenario: Area without override uses global default
    Given an initialized buddy git repository with tasks
    When active fronts are computed and formatted with config
    Then the active fronts block contains "(limit: 3)"

  @FR-TASKM-46
  Scenario: Config action reads and writes WIP overrides
    Given an initialized buddy git repository with tasks
    When tasks config sets WIP override for "work" to null
    Then tasks config response contains "work" with "no limit"
