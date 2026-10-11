# FR-DATA-01 — Data registry format and protection

Feature: Data registry

  @FR-DATA-01
  Scenario: Parse skips a broken entry and keeps valid ones
    When the data registry document is parsed:
      """
      ## alpha

      ```data
      kind: series
      key: id
      columns:
        id: string
      ```

      ## beta

      ```data
      kind: series
      key: id
      columns: [not a map]
      ```

      ## gamma

      ```data
      kind: series
      key: id
      columns:
        id: string
      ```
      """
    Then the parsed data registry has 2 entries named "alpha" and "gamma"
    And the parsed data registry errors mention "beta"

  @FR-DATA-01
  Scenario: Delete of data registry index is rejected
    Given an initialized buddy git repository
    And file tools are available
    And a file "user/data/index.md" with content "# Registry"
    When delete_file is called with path "user/data/index.md"
    Then the file tool returns an error containing "not allowed"
    And "user/data/index.md" exists

  @FR-DATA-01
  Scenario: Move of data registry index is rejected
    Given an initialized buddy git repository
    And file tools are available
    And a file "user/data/index.md" with content "# Registry"
    When move_file is called with source "user/data/index.md" and destination "user/data/registry.md"
    Then the file tool returns an error containing "not allowed"
    And "user/data/index.md" exists

  @FR-DATA-01
  Scenario: Write to data registry index is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent writes "user/data/index.md" via permission gate
    Then the permission gate blocks with data registry message

  @FR-DATA-01
  Scenario: Edit of data registry index is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent edits "user/data/index.md" via permission gate
    Then the permission gate blocks with data registry message

  @FR-DATA-01
  Scenario: Copy into data registry index is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent copies "user/notes/a.md" to "user/data/index.md" via permission gate
    Then the permission gate blocks with data registry message

  @FR-DATA-03
  Scenario: Write to registered series CSV is denied
    Given an initialized buddy git repository
    And data action "define" is invoked with json:
      """
      {"name":"migraines","kind":"series","key":["date","time"],"columns":{"date":"date","time":"string","intensity":"number"}}
      """
    And a permission layer for tasks file access
    When the agent writes "user/data/migraines.csv" via permission gate
    Then the permission gate blocks with registered data message

  @FR-DATA-03
  Scenario: Edit of registered series CSV is denied
    Given an initialized buddy git repository
    And data action "define" is invoked with json:
      """
      {"name":"migraines","kind":"series","key":["date","time"],"columns":{"date":"date","time":"string","intensity":"number"}}
      """
    And a permission layer for tasks file access
    When the agent edits "user/data/migraines.csv" via permission gate
    Then the permission gate blocks with registered data message

  @FR-DATA-03
  Scenario: Delete of registered series CSV is rejected
    Given an initialized buddy git repository
    And file tools are available
    And data action "define" is invoked with json:
      """
      {"name":"migraines","kind":"series","key":["date","time"],"columns":{"date":"date","time":"string","intensity":"number"}}
      """
    And a file "user/data/migraines.csv" with content "date,time,intensity"
    When delete_file is called with path "user/data/migraines.csv"
    Then the file tool returns an error containing "not allowed"
    And "user/data/migraines.csv" exists

  @FR-DATA-03
  Scenario: Write to unregistered CSV remains allowed
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent writes "user/data/prueba.csv" via permission gate
    Then the permission gate allows the write
