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
  Scenario: Tasks source omits due date from row text
    Given an initialized buddy git repository
    And tasks.md with a due date embedded in line text
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, due]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 first widget row text is "Actualizar el portátil del trabajo."
    And segment 1 first widget row due is "2026-09-22"

  @FR-DASH-05
  Scenario: Tasks source exposes overdue_days for past due dates
    Given an initialized buddy git repository
    And tasks.md with an overdue open task
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, overdue_days]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 first widget row overdue_days is 15

  @FR-DASH-05
  Scenario: Tasks source omits overdue_days when not overdue
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, overdue_days]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget rows have no overdue_days field

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

  @FR-DASH-18
  Scenario: Projects source exposes computed task fields
    Given an initialized buddy git repository
    And a project file "alpha.md" with summary "Alpha outcome"
    And tasks.md with open tasks for project "alpha"
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: projects
        columns: [name, summary, open_tasks, next_action]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 1 rows and no error
    And segment 1 first widget row name is "alpha"
    And segment 1 first widget row summary is "Alpha outcome"
    And segment 1 first widget row open_tasks is 2
    And segment 1 first widget row next_action is "Next alpha step"

  @FR-DASH-18
  Scenario: Logs source accepts index line without summary
    Given an initialized buddy git repository
    And logs index with lines:
      """
      - 2026-10-03: active
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: logs
        columns: [date, status, summary]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 1 rows and no error
    And segment 1 first widget row date is "2026-10-03"
    And segment 1 first widget row status is "active"
    And segment 1 first widget row summary is ""

  @FR-DASH-18
  Scenario: Logs source accepts hyphen separator
    Given an initialized buddy git repository
    And logs index with lines:
      """
      - 2026-10-04: active - Hyphen summary
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: logs
        columns: [date, status, summary]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 1 rows and no error
    And segment 1 first widget row status is "active"
    And segment 1 first widget row summary is "Hyphen summary"

  @FR-DASH-18
  Scenario: Logs source parses logs index lines
    Given an initialized buddy git repository
    And logs index with lines:
      """
      - 2026-10-01: active — First day
      - 2026-10-02: maintenance — Weekly run
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: logs
        columns: [date, status, summary]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 2 rows and no error
    And segment 1 first widget row status is "active"

  @FR-DASH-18
  Scenario: Journal source lists entry dates
    Given an initialized buddy git repository
    And a journal entry at "2026/10/01.md"
    And a journal entry at "2026/10/05.md"
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: journal
        columns: [date]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 2 rows and no error
    And segment 1 first widget row date is "2026-10-01"

  @FR-DASH-18
  Scenario: Missing journal directory yields zero rows
    Given an initialized buddy git repository
    And user journal directory does not exist
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: journal
        count: true
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget value is 0

  @FR-DASH-18
  Scenario: Logs source respects range filter
    Given an initialized buddy git repository
    And logs index with lines:
      """
      - 2026-09-20: active — Old entry
      - 2026-10-05: active — Recent entry
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: logs
        range: -14d..today
        columns: [date, summary]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 1 rows and no error
    And segment 1 first widget row summary is "Recent entry"

  @FR-DASH-20
  Scenario: Wip source flags an area over its limit
    Given an initialized buddy git repository
    And a global WIP limit of 3
    And tasks.md with 4 projects in area "work" and 1 project in area "home"
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: wip
        where: over_by > 0
        columns: [area, fronts, limit, over_by]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 1 rows and no error
    And segment 1 first widget row area is "work"
    And segment 1 first widget row over_by is 1

  @FR-DASH-20
  Scenario: Wip source renders as status cards
    Given an initialized buddy git repository
    And a global WIP limit of 3
    And tasks.md with 4 projects in area "work" and 1 project in area "home"
    And a dashboard file with body:
      """
      ```dashboard
      - view: status
        source: wip
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget rows count is 2
    And segment 1 first widget row state is "bad"

  @FR-DASH-04
  Scenario: Where filters overdue tasks by overdue_days
    Given an initialized buddy git repository
    And tasks.md with one overdue and other open tasks
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        where: overdue_days >= 1
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget row count is 1

  @FR-DASH-04
  Scenario: Where rejects non-numeric value on numeric field
    Given an initialized buddy git repository
    And tasks.md with a stale open task
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        where: stale_days > abc
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "not a number"

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

  @FR-DASH-10
  Scenario: Kanban without group is a widget error
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: kanban
        source: tasks
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "group"

  @FR-DASH-10
  Scenario: Table columns with unknown field is a widget error
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, not_a_column]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "not_a_column"

  @FR-DASH-10
  Scenario: Counter delta without range is a widget error
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: tasks
        count: true
        delta: true
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "range"

  @FR-DASH-10
  Scenario: Counter delta compares to the previous period
    Given an initialized buddy git repository
    And deferred.md with one due item
    And deferred.md with a far future item
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: deferred
        count: true
        range: -7d..today
        delta: true
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget value is 1 with delta 1

  @FR-DASH-10
  Scenario: Text widget script tags are not raw HTML in resolved text
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: text
        text: "Hello <script>alert(1)</script>"
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 text widget markdown contains "<script>"

  @FR-DASH-03
  Scenario: Broken widget between good ones still leaves neighbors resolved
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, state]
      - view: kanban
        source: tasks
      - view: table
        source: tasks
        columns: [text, state]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 4 rows and no error
    And segment 2 widget result is an error mentioning "group"
    And segment 3 is a table widget with 4 rows and no error

  @FR-DASH-03
  Scenario: Empty tasks source is not a widget error
    Given an initialized buddy git repository
    And tasks.md does not exist
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, state]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 0 rows and no error

  @FR-DASH-03
  Scenario: All widgets broken but free text remains
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      Still readable.

      ```dashboard
      - view: kanban
        source: tasks
      ```

      ```dashboard
      - view: counter
        source: tasks
        delta: true
        count: true
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is text "Still readable."
    And segment 2 widget result is an error
    And segment 3 widget result is an error

  @FR-DASH-09
  Scenario: Inline source requires updated and basis
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: status
        source: inline
        updated: 2026-09-28
        basis: Weekly review
        rows:
          - label: Release
            state: ok
            reason: On track
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget has provenance age days 9
    And segment 1 widget rows count is 1

  @FR-DASH-09
  Scenario: Inline missing basis is a widget error
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: status
        source: inline
        updated: 2026-10-01
        rows:
          - label: X
            state: ok
            reason: Y
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "basis"

  @FR-DASH-09
  Scenario: Text widget without source has no provenance
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: text
        text: Free note
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a text widget without error
    And segment 1 widget has no provenance

  @FR-DASH-10
  Scenario: Dashboard assigns unique keys to widgets without titles
    Given an initialized buddy git repository
    And deferred.md with one due item
    And tasks.md does not exist
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: deferred
        count: true
      - view: counter
        source: tasks
        count: true
      ```
      """
    When the dashboard view model is built for locale "es"
    Then the dashboard widget keys are distinct

  @FR-DASH-10
  Scenario: Task areas and projects render as in tasks.md
    Given an initialized buddy git repository
    And tasks.md with area and project tags for dashboard display
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: tasks
        count: true
        group: area
      - view: kanban
        source: tasks
        group: state
        fields: [area, project]
      ```
      """
    When the dashboard view model is built for locale "es"
    Then the grouped counter label for personal is "@personal"
    And a kanban card has chips "@personal" and "#alpha"

  @FR-DASH-10
  Scenario: Counter with group shows one value per area
    Given an initialized buddy git repository
    And tasks.md with one overdue and other open tasks
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: tasks
        count: true
        group: area
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget group value for personal is 2

  @FR-DASH-10
  Scenario: Kanban card shows overdue marker in view model
    Given an initialized buddy git repository
    And tasks.md with an overdue open task
    And a dashboard file with body:
      """
      ```dashboard
      - view: kanban
        source: tasks
        group: state
      ```
      """
    When the dashboard view model is built for locale "en"
    Then the first kanban card has overdue days 15

  @FR-DASH-10
  Scenario: Kanban order includes empty workflow columns
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: kanban
        source: inline
        updated: 2026-10-01
        basis: Test
        group: status
        order: [new, in_progress, blocked, done]
        rows:
          - text: One
            status: in_progress
      ```
      """
    When the dashboard view model is built for locale "en"
    Then the kanban workflow columns are ordered

  @FR-DASH-10
  Scenario: List does not repeat the primary field
    Given an initialized buddy git repository
    And a csv file at "user/data/list-dedup.csv" with content:
      """
      name,region
      Fiji,Oceania
      Spain,Europe
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: list
        source: series
        path: user/data/list-dedup.csv
        fields: [name, region]
      ```
      """
    When the dashboard view model is built for locale "en"
    Then segment 1 first list item fields are "Oceania"

  @FR-DASH-10
  Scenario: Table show-more counts the remaining rows
    Given an initialized buddy git repository
    And a csv file at "user/data/show-more-51.csv" with 51 numbered rows and columns "date, note"
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: series
        path: user/data/show-more-51.csv
        columns: [date, note]
      ```
      """
    When the dashboard view model is built for locale "en"
    And table pagination is at the default for segment 1
    Then segment 1 table next page size is 1

  @FR-DASH-10
  Scenario: Long table shows 50 rows and offers more
    Given an initialized buddy git repository
    And a csv file at "user/data/long-table.csv" with 120 numbered rows and columns "date, note"
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: series
        path: user/data/long-table.csv
        columns: [date, note]
      ```
      """
    When the dashboard view model is built for locale "en"
    And table pagination is at the default for segment 1
    Then segment 1 table visible row count is 50
    And segment 1 table pagination has more
    When table pagination shows more for segment 1
    Then segment 1 table visible row count is 100
    When table pagination shows more for segment 1
    Then segment 1 table visible row count is 120
    And segment 1 table pagination has no more

  @FR-DASH-10
  Scenario: Count on a row view is a widget error pointing at counter
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        group: area
        count: true
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "view: counter"

  @FR-DASH-10
  Scenario: Kanban order must be a list
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: kanban
        source: tasks
        group: state
        order: new
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "order"

  @FR-DASH-10
  Scenario: Table headers are localized for tasks source
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: tasks
        columns: [text, due]
      ```
      """
    When the dashboard view model is built for locale "es"
    Then the table header for text is "Tarea"
    And the table header for due is "Vence"

  @FR-DASH-10
  Scenario: Widget without title renders no heading
    Given an initialized buddy git repository
    And tasks.md with mixed states for dashboard resolution
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: tasks
        count: true
      ```
      """
    When the dashboard view model is built for locale "es"
    Then the first widget has no display title

  @FR-DASH-10
  Scenario: Table headers humanize inline field names
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: inline
        updated: 2026-10-01
        basis: Test
        columns: [paso]
        rows:
          - paso: Uno
      ```
      """
    When the dashboard view model is built for locale "es"
    Then the table header for paso is "Paso"

  @FR-DASH-02
  Scenario: Dashboard title appears in the header only once
    Given a filesystem buddy root at "/tmp/buddy-dash-view-9"
    And a readable file "user/dashboards/prueba.md" with content:
      """
      ---
      type: dashboard
      title: Prueba
      summary: Resumen corto
      ---
      ```dashboard
      - view: text
        text: Cuerpo
      ```
      """
    When the dashboard test viewer opens "user/dashboards/prueba.md"
    Then the file viewer header title is "Prueba"
    And the dashboard view model has no document title

  @FR-DASH-02
  Scenario: Dashboard viewer uses full window layout
    Given a filesystem buddy root at "/tmp/buddy-dash-view-7"
    And a readable file "user/dashboards/board.md" with content:
      """
      ---
      type: dashboard
      ---
      ```dashboard
      - view: text
        text: Hi
      ```
      """
    When the dashboard test viewer opens "user/dashboards/board.md"
    Then the file viewer is in wide mode
    And the file viewer layout is fullWindow

  @FR-DASH-02
  Scenario: Full window dashboard hides header close button
    Given a filesystem buddy root at "/tmp/buddy-dash-view-10"
    And a readable file "user/dashboards/board.md" with content:
      """
      ---
      type: dashboard
      title: Board
      ---
      ```dashboard
      - view: text
        text: Hi
      ```
      """
    When the dashboard test viewer opens "user/dashboards/board.md"
    Then the file viewer layout is fullWindow
    And the file viewer has no header close button

  @FR-DASH-02
  Scenario: Ordinary markdown uses modal layout
    Given a filesystem buddy root at "/tmp/buddy-dash-view-8"
    And a readable file "user/notes/doc.md" with content:
      """
      # Hello
      """
    When the dashboard test viewer opens "user/notes/doc.md"
    Then the file viewer is not in wide mode
    And the file viewer layout is modal
    And the file viewer has a header close button

  @FR-DASH-06
  Scenario: Sections source groups rows by heading
    Given an initialized buddy git repository
    And a sections markdown file at "user/notes/board.md" with content:
      """
      ## Doing
      - First
      ## Next
      - Second
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: sections
        path: user/notes/board.md
        columns: [text, group]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 2 rows and no error
    And segment 1 first widget row text is "First"
    And segment 1 first widget row group is "Doing"

  @FR-DASH-06
  Scenario: Sections checkbox rows include done
    Given an initialized buddy git repository
    And a sections markdown file at "user/notes/checks.md" with content:
      """
      ## Tasks
      - [x] Finished
      - [ ] Open
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: sections
        path: user/notes/checks.md
        columns: [text, done]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 2 rows and no error
    And segment 1 first widget row done is "true"

  @FR-DASH-06
  Scenario: Sections key value sub-bullets become fields
    Given an initialized buddy git repository
    And a sections markdown file at "user/notes/meta.md" with content:
      """
      ## Items
      - Ship release
        - owner: Ana
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: sections
        path: user/notes/meta.md
        columns: [text, owner]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 first widget row owner is "Ana"

  @FR-DASH-06
  Scenario: Sections file that does not fit is a widget error
    Given an initialized buddy git repository
    And a sections markdown file at "user/notes/plain.md" with content:
      """
      Just prose, no headings with lists.
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: list
        source: sections
        path: user/notes/plain.md
        fields: [text]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "sections primitive"

  @FR-DASH-06
  Scenario: Sections path outside buddy root is a widget error
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: list
        source: sections
        path: ../../../etc/passwd
        fields: [text]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "cannot be opened"

  @FR-DASH-08
  Scenario: Series source reads CSV rows with header fields
    Given an initialized buddy git repository
    And a csv file at "user/data/readings.csv" with content:
      """
      amount,label
      10,Alpha
      20,Beta
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: series
        path: user/data/readings.csv
        columns: [amount, label]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 is a table widget with 2 rows and no error
    And segment 1 first widget row label is "Alpha"

  @FR-DASH-08
  Scenario: Series numeric column supports sum and numeric where
    Given an initialized buddy git repository
    And a csv file at "user/data/amounts.csv" with content:
      """
      amount,tag
      5,low
      15,high
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: counter
        source: series
        path: user/data/amounts.csv
        where: amount >= 10
        sum: amount
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget value is 15

  @FR-DASH-08
  Scenario: Series date column supports relative date filter
    Given an initialized buddy git repository
    And a csv file at "user/data/dated.csv" with content:
      """
      date,note
      2026-01-01,old
      2026-09-20,recent
      2026-10-07,today
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: series
        path: user/data/dated.csv
        where: date >= -30d
        columns: [date, note]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget row count is 2

  @FR-DASH-08
  Scenario: Series unknown column is a widget error
    Given an initialized buddy git repository
    And a csv file at "user/data/simple.csv" with content:
      """
      a,b
      1,2
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: series
        path: user/data/simple.csv
        columns: [a, missing]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "missing"

  @FR-DASH-08
  Scenario: Series malformed CSV is a widget error
    Given an initialized buddy git repository
    And a csv file at "user/data/broken.csv" with content:
      """
      a,b
      "unclosed,2
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: series
        path: user/data/broken.csv
        columns: [a, b]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "line"

  @FR-DASH-08
  Scenario: Series path outside buddy root is a widget error
    Given an initialized buddy git repository
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: series
        path: ../../../etc/passwd.csv
        columns: [a]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 widget result is an error mentioning "cannot be opened"

  @FR-DASH-08
  Scenario: Series column with leading zeros stays text
    Given an initialized buddy git repository
    And a csv file at "user/data/codes.csv" with content:
      """
      code,label
      004,A
      012,B
      """
    And a dashboard file with body:
      """
      ```dashboard
      - view: table
        source: series
        path: user/data/codes.csv
        columns: [code, label]
      ```
      """
    When the dashboard is resolved for today "2026-10-07"
    Then segment 1 first widget row code is "004"

  @FR-CHAT-22
  Scenario: CSV link opens as a table in full window
    Given a filesystem buddy root at "/tmp/buddy-dash-csv-1"
    And a readable file "user/data/sample.csv" with content:
      """
      amount,label
      10,Alpha
      20,Beta
      """
    When the dashboard test viewer opens "user/data/sample.csv"
    Then the file viewer layout is fullWindow
    And the file viewer header title is "sample.csv"
    And the file viewer has a resolved dashboard
    And the file viewer does not offer export PDF

  @FR-CHAT-22
  Scenario: Malformed CSV shows a widget error in the viewer
    Given a filesystem buddy root at "/tmp/buddy-dash-csv-bad"
    And a readable file "user/data/broken.csv" with content:
      """
      a,b
      "open,2
      """
    When the dashboard test viewer opens "user/data/broken.csv"
    Then the file viewer layout is fullWindow
    And the file viewer has a resolved dashboard
    And the dashboard widget mentions "line"

  @FR-DASH-02
  Scenario: Ordinary markdown still offers export PDF when supported
    Given a filesystem buddy root at "/tmp/buddy-dash-view-6"
    And a readable file "user/notes/doc.md" with content:
      """
      # Hello
      """
    When the dashboard test viewer opens "user/notes/doc.md"
    Then the file viewer offers export PDF
