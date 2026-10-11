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
      | mode        | consolidation          |
    Then data tool succeeded
    And data file "user/data/index.md" exists
    When data action "list" is invoked
    Then data tool output mentions "migraines"
    And data tool output mentions "user/data/migraines.csv"
    And data tool output mentions "inactive until sprint 6"

  @FR-DATA-02
  Scenario: Define accepts a columns map and a key list
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"}}
      """
    Then data tool succeeded
    And data file "user/data/index.md" exists
    And data file "user/data/migranas.csv" does not exist
    When data action "list" is invoked
    Then data tool output mentions "migranas"
    And data tool output mentions "user/data/migranas.csv"

  @FR-DATA-02
  Scenario: Help shows the columns map and that define does not create the csv
    Given an initialized buddy git repository
    When data action "help" is invoked
    Then data tool output mentions "columns:"
    And data tool output mentions "does not create the CSV"

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

  @FR-DATA-03
  Scenario: Append creates CSV with header and a second append adds a row
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"}}
      """
    Then data tool succeeded
    When data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":7}}
      """
    Then data tool succeeded
    And data file "user/data/migranas.csv" exists
    And data file "user/data/migranas.csv" contains "fecha,hora,intensidad"
    And data file "user/data/migranas.csv" contains "2026-10-11,09:00,7"
    When data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-12","hora":"10:00","intensidad":5}}
      """
    Then data tool succeeded
    And data file "user/data/migranas.csv" contains "2026-10-12,10:00,5"

  @FR-DATA-03
  Scenario: Append with duplicate key does not change the file
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"}}
      """
    And data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":7}}
      """
    When data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":9}}
      """
    Then data tool failed
    And data file "user/data/migranas.csv" contains "2026-10-11,09:00,7"
    And data file "user/data/migranas.csv" does not contain ",9"

  @FR-DATA-03
  Scenario: Append with non-numeric intensity does not create the file
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"}}
      """
    When data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":"alta"}}
      """
    Then data tool failed
    And data file "user/data/migranas.csv" does not exist

  @FR-DATA-03
  Scenario: Correct with set updates intensity and correct remove leaves header only
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"}}
      """
    And data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":7}}
      """
    When data action "correct" is invoked with json:
      """
      {"name":"migranas","key":{"fecha":"2026-10-11","hora":"09:00"},"set":{"intensidad":8}}
      """
    Then data tool succeeded
    And data file "user/data/migranas.csv" contains "2026-10-11,09:00,8"
    When data action "correct" is invoked with json:
      """
      {"name":"migranas","key":{"fecha":"2026-10-11","hora":"09:00"},"remove":true}
      """
    Then data tool succeeded
    And data file "user/data/migranas.csv" contains "fecha,hora,intensidad"
    And data file "user/data/migranas.csv" does not contain "2026-10-11"

  @FR-DATA-03
  Scenario: Correct with unknown key does not write
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"}}
      """
    And data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":7}}
      """
    When data action "correct" is invoked with json:
      """
      {"name":"migranas","key":{"fecha":"2026-10-99","hora":"09:00"},"set":{"intensidad":8}}
      """
    Then data tool succeeded
    And data file "user/data/migranas.csv" contains "2026-10-11,09:00,7"
    And data file "user/data/migranas.csv" does not contain ",8"

  @FR-DATA-03
  Scenario: Help mentions values map and append
    Given an initialized buddy git repository
    When data action "help" is invoked
    Then data tool output mentions "values:{"
    And data tool output mentions "append"

  @FR-DATA-07
  Scenario: Inferred define append without origin fails and does not create CSV
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"},"inferred":true}
      """
    Then data tool succeeded
    When data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":6}}
      """
    Then data tool failed
    And data file "user/data/migranas.csv" does not exist

  @FR-DATA-07
  Scenario: Inferred append writes origin and basis columns at end
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"},"inferred":true}
      """
    When data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":6,"origin":"inferred","basis":"deducido del chat"}}
      """
    Then data tool succeeded
    And data file "user/data/migranas.csv" contains "fecha,hora,intensidad,origin,basis"
    And data file "user/data/migranas.csv" contains "inferred,deducido del chat"

  @FR-DATA-07
  Scenario: Explicit origin append writes origin and empty basis
    Given an initialized buddy git repository
    When data action "define" is invoked with json:
      """
      {"name":"migranas","kind":"series","key":["fecha","hora"],"columns":{"fecha":"date","hora":"string","intensidad":"number"},"inferred":true}
      """
    When data action "append" is invoked with json:
      """
      {"name":"migranas","values":{"fecha":"2026-10-11","hora":"09:00","intensidad":6,"origin":"explicit"}}
      """
    Then data tool succeeded
    And data file "user/data/migranas.csv" contains "explicit,"
