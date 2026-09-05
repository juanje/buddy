# Service connector infrastructure (FR-CONN-01..04, Sprint 0b)

Feature: Service connector infrastructure
  As the app
  I want shared connector machinery
  So that integrations are secure, cached, and registered conditionally

  @FR-CONN-01
  Scenario: Credential file is denylisted from agent reads
    Given a jira integration credential file exists
    When the agent attempts to read the jira credential file
    Then the read is denied

  @FR-CONN-02
  Scenario: Fresh cache entry is not stale
    Given a connector cache entry synced 5 minutes ago with stale_after 15m
    When staleness is checked without force
    Then the cache entry is fresh

  @FR-CONN-02
  Scenario: Force refresh bypasses fresh cache
    Given a connector cache entry synced 5 minutes ago with stale_after 15m
    When staleness is checked with force
    Then the cache entry is stale

  @FR-CONN-02
  Scenario: Expired cache entry is stale
    Given a connector cache entry synced 20 minutes ago with stale_after 15m
    When staleness is checked without force
    Then the cache entry is stale

  @FR-CONN-03
  Scenario: Connector write to user is refused
    Given a buddy workspace
    When a connector cache write targets "user/board.md"
    Then the cache write is refused

  @FR-CONN-03
  Scenario: Unknown connector action is denied
    When a jira connector call uses action "unknown_action"
    Then the permission gate denies the call

  @FR-CONN-03
  Scenario: Connector write action requires confirmation
    When a jira connector call uses action "transition_issue"
    Then the permission gate asks for confirmation

  @FR-CONN-04
  Scenario: Connector tool not visible when not configured
    Given no connector integrations are configured
    When the agent toolset is built
    Then the jira tool is not offered

  @FR-CONN-04
  Scenario: Connector tool visible when integration is configured
    Given a jira integration is configured
    When the agent toolset is built
    Then the jira tool is offered
