# FR-DASH-12 — dashboard() authoring tool

Feature: Dashboard tool

  @FR-DASH-12
  Scenario: Help lists sources
    Given an initialized buddy git repository
    When dashboard action "help" is invoked
    Then dashboard tool output mentions "tasks"
    And dashboard tool output mentions "projects"

  @FR-DASH-12
  Scenario: Fields does not return rows
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    When dashboard action "fields" is invoked with:
      | source | tasks |
    Then dashboard tool output mentions "text:"
    And dashboard tool output does not mention "Next one"

  @FR-DASH-12
  Scenario: Check positive for sections file
    Given an initialized buddy git repository
    And a sections markdown file at "user/notes/board.md" with content:
      """
      ## Group
      - Item
      """
    When dashboard action "check" is invoked with:
      | path | user/notes/board.md |
    Then dashboard tool output mentions "fits the sections primitive"

  @FR-DASH-12
  Scenario: Check negative offers derived path
    Given an initialized buddy git repository
    And a sections markdown file at "user/notes/plain.md" with content:
      """
      Plain text only
      """
    When dashboard action "check" is invoked with:
      | path | user/notes/plain.md |
    Then dashboard tool output mentions "user/data/plain-sections.md"

  @FR-DASH-12
  Scenario: Help explains file sources and field discovery
    Given an initialized buddy git repository
    When dashboard action "help" is invoked
    Then dashboard tool output mentions "series"
    And dashboard tool output mentions "fields(source"
    And dashboard tool output mentions "do not need to read the file"

  @FR-DASH-12
  Scenario: Unknown source error lists every source
    Given an initialized buddy git repository
    When dashboard action "fields" is invoked with:
      | source | csv |
    Then dashboard tool failed
    And dashboard tool output mentions "series"
    And dashboard tool output mentions "sections"
    And dashboard tool output mentions "inline"

  @FR-DASH-12
  Scenario: Missing params error shows the params shape
    Given an initialized buddy git repository
    When dashboard action "fields" is invoked
    Then dashboard tool failed
    And dashboard tool output mentions "params={"

  @FR-DASH-12
  Scenario: Check on a dashboard file points to validate
    Given an initialized buddy git repository
    And dashboard file "board.md" with content:
      """
      ---
      type: dashboard
      title: Board
      ---
      ```dashboard
      - view: text
        text: OK
      ```
      """
    When dashboard action "check" is invoked with:
      | path | user/dashboards/board.md |
    Then dashboard tool succeeded
    And dashboard tool output mentions "validate"
    And dashboard tool output does not mention "user/data/"

  @FR-DASH-12
  Scenario: Validate reports block and widget position
    Given an initialized buddy git repository
    When dashboard action "validate" is invoked with content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: text
        text: OK
      ```

      Between blocks.

      ```dashboard
      - view: text
        text: A
      - view: table
        source: tasks
        columns: [bad_field]
      ```
      """
    Then dashboard tool failed
    And dashboard tool output mentions "block 2, widget 2"

  @FR-DASH-12
  Scenario: Validate reports schema error once
    Given an initialized buddy git repository
    When dashboard action "validate" is invoked with content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: text
        text: OK
      ```

      Some prose.

      ```dashboard
      - view: nope
      ```
      """
    Then dashboard tool failed
    And dashboard tool output mentions "Unknown view 'nope'"
    And dashboard tool output mentions "Unknown view 'nope'" once
    And dashboard tool output mentions "block 2, widget 1"

  @FR-DASH-12
  Scenario: Validate reports field errors
    Given an initialized buddy git repository
    When dashboard action "validate" is invoked with content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: table
        source: tasks
        columns: [not_a_field]
      ```
      """
    Then dashboard tool failed
    And dashboard tool output mentions "not_a_field"

  @FR-DASH-12
  Scenario: Create valid dashboard writes file
    Given an initialized buddy git repository
    When dashboard action "create" is invoked with name "demo" and content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: text
        text: Hello
      ```
      """
    Then dashboard tool succeeded
    And dashboard file "user/dashboards/demo.md" exists

  @FR-DASH-12
  Scenario: Create invalid dashboard does not write
    Given an initialized buddy git repository
    When dashboard action "create" is invoked with name "bad" and content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: table
        source: tasks
        columns: [bad_field]
      ```
      """
    Then dashboard tool failed
    And dashboard file "user/dashboards/bad.md" does not exist

  @FR-DASH-12
  Scenario: Update touches only the affected dashboard block
    Given an initialized buddy git repository
    And dashboard file "surgical.md" with content:
      """
      ---
      type: dashboard
      ---
      Free line stays.

      ```dashboard
      - view: text
        title: Keep spacing
        text: |
            indented
      # yaml comment stays
      ```

      ```dashboard
      - view: text
        title: Target
        text: Old
      ```
      """
    When dashboard action "update" is invoked for dashboard "surgical" widget "Target" with:
      """
      view: text
      title: Target
      text: New
      """
    Then dashboard tool succeeded
    And dashboard file "surgical.md" outside dashboard block 2 is unchanged
    And dashboard file "surgical.md" contains "New"
    And dashboard file "surgical.md" does not contain "Old"

  @FR-DASH-12
  Scenario: Update widget preserves free text
    Given an initialized buddy git repository
    And dashboard file "keep.md" with content:
      """
      ---
      type: dashboard
      ---
      Free paragraph.

      ```dashboard
      - view: text
        title: Greeting
        text: Old
      ```
      """
    When dashboard action "update" is invoked for dashboard "keep" widget "Greeting" with:
      """
      view: text
      title: Greeting
      text: New
      """
    Then dashboard tool succeeded
    And dashboard file "keep.md" contains "Free paragraph"
    And dashboard file "keep.md" contains "New"

  @FR-DASH-12
  Scenario: Update with ambiguous title fails
    Given an initialized buddy git repository
    And dashboard file "dup.md" with content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: text
        title: Same
        text: A
      - view: text
        title: Same
        text: B
      ```
      """
    When dashboard action "update" is invoked for dashboard "dup" widget "Same" with:
      """
      view: text
      title: Same
      text: C
      """
    Then dashboard tool failed
    And dashboard tool output mentions "Multiple widgets"

  @FR-DASH-12
  Scenario: Update title changes only the header
    Given an initialized buddy git repository
    And dashboard file "head.md" with content:
      """
      ---
      type: dashboard
      title: Old title
      ---
      Free text stays.

      ```dashboard
      - view: text
        text:   Spacing kept
      ```
      """
    When dashboard action "update" is invoked for dashboard "head" with title "Mis tareas de hoy"
    Then dashboard tool succeeded
    And dashboard file "head.md" contains "title: Mis tareas de hoy"
    And dashboard file "head.md" body is unchanged

  @FR-DASH-12
  Scenario: Update with nothing to change lists the update forms
    Given an initialized buddy git repository
    And dashboard file "head.md" with content:
      """
      ---
      type: dashboard
      title: Old title
      ---
      ```dashboard
      - view: text
        text: Body
      ```
      """
    When dashboard action "update" is invoked for dashboard "head" with no changes
    Then dashboard tool failed
    And dashboard tool output mentions "title/summary"

  @FR-DASH-19
  Scenario: Write to user dashboards is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent writes "user/dashboards/board.md" via permission gate
    Then the permission gate blocks with dashboard tool message

  @FR-DASH-19
  Scenario: Edit of user dashboards is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent edits "user/dashboards/board.md" via permission gate
    Then the permission gate blocks with dashboard tool message

  @FR-DASH-19
  Scenario: Copy into user dashboards is denied
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent copies "user/notes/a.md" to "user/dashboards/a.md" via permission gate
    Then the permission gate blocks with dashboard tool message

  @FR-DASH-19
  Scenario: Read of user dashboards is allowed
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent reads "user/dashboards/board.md" via permission gate
    Then the permission gate allows the dashboard read

  @FR-DASH-19
  Scenario: Delete of user dashboards is not blocked by the dashboard write rule
    Given an initialized buddy git repository
    And a permission layer for tasks file access
    When the agent deletes "user/dashboards/board.md" via permission gate
    Then the permission gate allows the dashboard read

  @FR-DASH-19
  Scenario: Delete of user dashboards asks for confirmation
    Given an initialized buddy git repository
    And file tools are available
    And a file "user/dashboards/board.md" with content "keep"
    When delete_file is called with path "user/dashboards/board.md" and deletion is denied
    Then "user/dashboards/board.md" exists
    And the delete tool result contains "declined"

  @FR-DASH-08
  Scenario: Fields for series returns header and types without rows
    Given an initialized buddy git repository
    And a csv file at "user/data/fields.csv" with content:
      """
      date,amount,note
      2026-10-01,10,Alpha
      """
    When dashboard action "fields" is invoked with:
      | source | series |
      | path   | user/data/fields.csv |
    Then dashboard tool output mentions "date:"
    And dashboard tool output mentions "amount:"
    And dashboard tool output does not mention "Alpha"

  @FR-DASH-08
  Scenario: Check on a CSV points to the series source
    Given an initialized buddy git repository
    And a csv file at "user/data/check.csv" with content:
      """
      x,y
      1,2
      """
    When dashboard action "check" is invoked with:
      | path | user/data/check.csv |
    Then dashboard tool output mentions "source: series"

  @FR-DASH-13
  Scenario: Create with template writes a dashboard that resolves
    Given an initialized buddy git repository
    When dashboard action "create" is invoked with name "tareas" and template "mis-tareas"
    Then dashboard tool succeeded
    And dashboard file "user/dashboards/tareas.md" exists

  @FR-DASH-13
  Scenario: Examples copies dashboards that resolve
    Given an initialized buddy git repository
    When dashboard action "examples" is invoked
    Then dashboard tool succeeded
    And dashboard file "user/dashboards/examples/tablero-inline.md" exists

  @FR-DASH-13
  Scenario: Dashboard documentation appears in the bundled docs index
    Given the bundled docs index
    Then the bundled docs index links to dashboards.md

  @FR-DASH-13
  Scenario: Dashboard docs show query and series examples
    Given the bundled docs index
    Then the bundled dashboards doc contains "where: region = Europe"
    And the bundled dashboards doc contains "where: date >= -30d"
    And the bundled dashboards doc contains "sum:"
    And the bundled dashboards doc contains "fields(source='series'"
