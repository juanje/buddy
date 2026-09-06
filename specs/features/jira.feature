# Jira read-only connector (FR-JIRA-01..05, Sprint 1)

Feature: Jira read-only connector
  As a user with Jira configured
  I want read-only Jira actions through the connector tool
  So that Buddy can query issues without write access

  @FR-JIRA-01
  Scenario: Jira help lists available actions
    Given a configured jira integration
    When the jira connector runs action "help"
    Then the jira result includes "board"
    And the jira result includes "issue_detail"

  @FR-JIRA-01
  Scenario: Unknown jira action returns error with help suggestion
    Given a configured jira integration
    When the jira connector runs action "not_a_real_action"
    Then the jira result suggests help

  @FR-JIRA-02
  Scenario: Jira board returns current sprint issues
    Given a configured jira integration
    And jira search returns issue "PROJ-1" titled "Sprint task"
    When the jira connector runs action "board"
    Then the jira result includes "PROJ-1"
    And the jira result includes "Sprint task"

  @FR-JIRA-02
  Scenario: Force refresh bypasses fresh cache
    Given a configured jira integration
    And a fresh jira board cache exists
    And jira search returns issue "PROJ-2" titled "Fresh task"
    When the jira connector runs action "board" with force
    Then the jira result includes "PROJ-2"

  @FR-JIRA-03
  Scenario: Issue detail includes description text
    Given a configured jira integration
    And jira issue "PROJ-1" has description "Login fails on Safari"
    When the jira connector runs action "issue_detail" for key "PROJ-1"
    Then the jira result includes "Login fails on Safari"

  @FR-JIRA-05
  Scenario: Offline jira read serves stale cache with warning
    Given a configured jira integration
    And a stale jira board cache exists for "PROJ-9"
    And jira network is unavailable
    When the jira connector runs action "board"
    Then the jira result is stale
    And the jira result includes "PROJ-9"

  @FR-JIRA-04
  Scenario: Saving Jira config persists to credential file
    Given a buddy integrations directory
    When jira config is saved with base URL "https://jira.example.com"
    Then the jira credential file contains that base URL

  @FR-JIRA-06
  Scenario: Board resolves assignee name to accountId
    Given a configured jira integration
    And jira user search for "Ozan" returns "Ozan Unsal" with accountId "abc123"
    And jira search returns issue "PROJ-5" titled "Ozan task"
    When the jira connector runs action "board" for assignee "Ozan"
    Then the jira result includes "PROJ-5"
    And the JQL sent to Jira contains "abc123"
    And the JQL sent to Jira does not contain "Ozan Unsal"

  @FR-JIRA-06
  Scenario: Unknown assignee returns clear error
    Given a configured jira integration
    And jira user search for "nobody" returns no results
    When the jira connector runs action "board" for assignee "nobody"
    Then the jira result has error matching "No Jira user found"

  @FR-JIRA-06
  Scenario: Multiple user matches lists disambiguation options
    Given a configured jira integration
    And jira user search for "Ozan" returns multiple users
    When the jira connector runs action "board" for assignee "Ozan"
    Then the jira result has error matching "Multiple users match"

  @FR-JIRA-06
  Scenario: my_issues accepts assignee for cross-user queries
    Given a configured jira integration
    And jira user search for "Ozan" returns "Ozan Unsal" with accountId "abc123"
    And jira search returns issue "PROJ-8" titled "Ozan open issue"
    When the jira connector runs action "my_issues" for assignee "Ozan"
    Then the jira result includes "PROJ-8"
    And the JQL sent to Jira contains "abc123"

  @FR-JIRA-07
  Scenario: Resolved users are cached in the local directory
    Given a configured jira integration
    And jira user search for "Ozan" returns "Ozan Unsal" with accountId "abc123"
    And jira search returns issue "PROJ-5" titled "Cached task"
    When the jira connector runs action "board" for assignee "Ozan"
    Then the jira user directory contains "Ozan Unsal"

  @FR-JIRA-07
  Scenario: Second lookup resolves from local directory without API call
    Given a configured jira integration
    And the jira user directory already has "Ozan Unsal" with accountId "abc123"
    And jira search returns issue "PROJ-6" titled "Cached lookup"
    When the jira connector runs action "board" for assignee "Ozan Unsal"
    Then the jira result includes "PROJ-6"
    And jira user search API was not called

  @FR-JIRA-07
  Scenario: Issue assignees are passively learned into the directory
    Given a configured jira integration
    And jira search returns issues with assignee "Alice Wonderland" having accountId "alice-id"
    When the jira connector runs action "my_issues"
    Then the jira user directory contains "Alice Wonderland"
