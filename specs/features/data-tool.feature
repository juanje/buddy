# FR-DATA-02 — data() tool

Feature: Data tool

  @FR-DATA-02
  Scenario: Help shows series define and list
    Given an initialized buddy git repository
    When data action "help" is invoked
    Then data tool output mentions "define"
    And data tool output mentions "list"
    And data tool output mentions "series"
    And data tool output mentions "sections"

  @FR-DATA-02
  Scenario: Define a series entry and list it
    Given an initialized buddy git repository
    When data action "define" is invoked with:
      | name        | migraines              |
      | kind        | series                 |
      | key         | date,time              |
      | column_date | date                   |
      | column_time | string                 |
      | column_intensity | number          |
      | mode        | on_mention             |
    Then data tool succeeded
    And data file "user/data/index.md" exists
    When data action "list" is invoked
    Then data tool output mentions "migraines"
    And data tool output mentions "user/data/migraines.csv"
    And data tool output mentions "inactive until sprint 6"

  @FR-DATA-02
  Scenario: Define sections kind is refused
    Given an initialized buddy git repository
    When data action "define" is invoked with:
      | name | notes |
      | kind | sections |
      | path | user/data/notes.md |
      | key  | id |
      | column_id | string |
    Then data tool failed
    And data tool output mentions "not supported"
    And data file "user/data/index.md" does not exist

  @FR-DATA-02
  Scenario: Define snapshot mode is refused
    Given an initialized buddy git repository
    When data action "define" is invoked with:
      | name | daily |
      | kind | series |
      | key  | date |
      | column_date | date |
      | mode | snapshot |
    Then data tool failed
    And data file "user/data/index.md" does not exist

  @FR-DATA-02
  Scenario: Define rejects reserved column origin
    Given an initialized buddy git repository
    When data action "define" is invoked with:
      | name | bad |
      | kind | series |
      | key  | origin |
      | column_origin | string |
    Then data tool failed

  @FR-DATA-02
  Scenario: Define replaces an existing entry name
    Given an initialized buddy git repository
    When data action "define" is invoked with:
      | name | episodes |
      | kind | series |
      | key  | id |
      | column_id | string |
      | instructions | First version |
    Then data tool succeeded
    When data action "define" is invoked with:
      | name | episodes |
      | kind | series |
      | key  | id |
      | column_id | string |
      | instructions | Second version |
    Then data tool succeeded
    And data file "user/data/index.md" contains "Second version"
    And data file "user/data/index.md" does not contain "First version"
    And data registry file has one section named "episodes"

  @FR-DATA-02
  Scenario: List without a registry file does not create one
    Given an initialized buddy git repository
    When data action "list" is invoked
    Then data tool succeeded
    And data tool output mentions "No entries"
    And data file "user/data/index.md" does not exist
