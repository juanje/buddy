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

  @FR-DASH-04
  Scenario: Where filters tasks by area
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        where: area = @personal
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget row count is 3

  @FR-DASH-04
  Scenario: Where compares deferred dates with a relative bound
    Given an initialized buddy git repository
    And deferred.md with one due item
    And deferred.md with a far future item
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: deferred
        where: date <= +7d
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget row count is 1

  @FR-DASH-04
  Scenario: Range limits rows by the source date field
    Given an initialized buddy git repository
    And deferred.md with one due item
    And deferred.md with a far future item
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: deferred
        range: -30d..today
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget row count is 1

  @FR-DASH-04
  Scenario: Group and count follow enum order
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: tasks
        group: state
        count: true
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget group value keys are "next", "open", "scheduled", "parked"

  @FR-DASH-04
  Scenario: Sort and limit apply before grouping
    Given an initialized buddy git repository
    And tasks.md with many open tasks for sort limit
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        where: state = open
        sort: text desc
        limit: 2
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget row count is 2
    And segment 1 first widget row text is "Zulu task"

  @FR-DASH-04
  Scenario: Sum requires a numeric field
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: tasks
        sum: text
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "numeric"

  @FR-DASH-04
  Scenario: Unknown query field names available fields
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        where: not_a_field = x
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "not_a_field"
    And segment 1 widget result is an error mentioning "state"

  @FR-DASH-04
  Scenario: Empty filter value suggests quoting hash values
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        where: 'project = '
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "quote"

  @FR-DASH-02
  Scenario: Dashboard under user/dashboards opens wide with a resolved model
    Given a filesystem buddy root at "/tmp/buddy-dash-view-1"
    And a readable file "user/dashboards/board.md" with content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: table
        source: tasks
      ```
      """
    And tasks.md exists at buddy root with one open task
    When the dashboard test viewer opens "user/dashboards/board.md"
    Then the file viewer is in wide mode
    And the file viewer has a resolved dashboard
    And the file viewer does not offer export PDF

  @FR-DASH-02
  Scenario: Same content outside user/dashboards renders as markdown
    Given a filesystem buddy root at "/tmp/buddy-dash-view-2"
    And a readable file "user/wiki/board.md" with content:
      """
      ---
      type: dashboard
      ---
      Body only
      """
    When the dashboard test viewer opens "user/wiki/board.md"
    Then the file viewer is not in wide mode
    And the file viewer has no resolved dashboard

  @FR-DASH-02
  Scenario: File in dashboards without type stays markdown
    Given a filesystem buddy root at "/tmp/buddy-dash-view-3"
    And a readable file "user/dashboards/notes.md" with content:
      """
      ---
      summary: Notes
      ---
      Plain
      """
    When the dashboard test viewer opens "user/dashboards/notes.md"
    Then the file viewer is not in wide mode
    And the file viewer has no resolved dashboard

  @FR-DASH-02
  Scenario: resolveDashboard rejects files outside user/dashboards
    Given a filesystem buddy root at "/tmp/buddy-dash-view-4"
    And a readable file "user/wiki/board.md" with content:
      """
      ---
      type: dashboard
      ---
      """
    When resolveDashboard is called for "user/wiki/board.md"
    Then resolveDashboard fails

  @FR-DASH-02
  Scenario: Tasks source through an escaping symlink is a widget error
    Given a filesystem buddy root at "/tmp/buddy-dash-view-5"
    And the user tasks file is a symlink outside the buddy root
    And a readable file "user/dashboards/board.md" with content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: table
        source: tasks
      ```
      """
    When the dashboard test viewer opens "user/dashboards/board.md"
    Then the file viewer has a resolved dashboard
    And the dashboard widget mentions escaping

  @FR-DASH-02
  Scenario: Ordinary markdown still offers export PDF when supported
    Given a filesystem buddy root at "/tmp/buddy-dash-view-6"
    And a readable file "user/notes/doc.md" with content:
      """
      # Hello
      """
    When the dashboard test viewer opens "user/notes/doc.md"
    Then the file viewer offers export PDF
