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
