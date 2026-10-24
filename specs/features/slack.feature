# Slack read-only connector (FR-SLACK-01..03, Sprint 2b)

Feature: Slack read-only connector
  As a user with Slack configured
  I want read-only Slack actions through the connector tool
  So that Buddy can fetch threads and channels without write access

  @FR-SLACK-01
  Scenario: Slack help lists available actions
    Given a configured slack integration
    When the slack connector runs action "help"
    Then the slack result includes "thread"
    And the slack result includes "channel_history"

  @FR-SLACK-01
  Scenario: Unknown slack action returns error with help suggestion
    Given a configured slack integration
    When the slack connector runs action "not_a_real_action"
    Then the slack result suggests help

  @FR-SLACK-01
  Scenario: Slack auth test validates xoxc/xoxd credentials
    Given a buddy integrations directory
    When slack config is saved with token "xoxc-test" and cookie "xoxd-test"
    And slack auth test succeeds for user "juanje"
    When the slack connection is tested
    Then the slack test result is ok

  @FR-SLACK-02
  Scenario: Slack thread fetched to cache, agent reads locally
    Given a configured slack integration
    And slack thread in channel "C123" returns 2 messages from "Alice"
    When the slack connector runs action "thread" for url "https://team.slack.com/archives/C123/p1712345678901234"
    Then the slack result includes ".buddy/connections/slack/threads/"
    And a slack thread cache file exists for channel "C123"

  @FR-SLACK-02
  Scenario: Slack channel_history returns date-scoped messages
    Given a configured slack integration
    And slack channel "C456" history returns message "Standup notes"
    When the slack connector runs action "channel_history" for channel "C456"
    Then the slack result includes ".buddy/connections/slack/threads/"
    And the slack channel cache file for "C456" contains "Standup notes"

  @FR-SLACK-02
  Scenario: Slack channels returns user channel list
    Given a configured slack integration
    And slack conversations list returns channel "general" with id "C999"
    When the slack connector runs action "channels"
    Then the slack result includes "general"
    And the slack result includes "C999"

  @FR-SLACK-02
  Scenario: Force refresh re-fetches even when cache is fresh
    Given a configured slack integration
    And a fresh slack thread cache exists for channel "C123"
    And slack thread in channel "C123" returns message from "Bob"
    When the slack connector runs action "thread" for url "https://team.slack.com/archives/C123/p1712345678901234" with force
    Then the slack thread cache file contains "Bob"

  @FR-SLACK-03
  Scenario: User IDs resolved to names before agent sees content
    Given a configured slack integration
    And slack user "U111" resolves to "Alice Wonderland"
    And slack thread in channel "C123" returns message mentioning user "U111"
    When the slack connector runs action "thread" for url "https://team.slack.com/archives/C123/p1712345678901234"
    Then the slack thread cache file contains "@Alice Wonderland"

  @FR-SLACK-03
  Scenario: Resolved users cached in local directory
    Given a configured slack integration
    And slack user "U222" resolves to "Bob Builder"
    And slack thread in channel "C123" returns message mentioning user "U222"
    When the slack connector runs action "thread" for url "https://team.slack.com/archives/C123/p1712345678901234"
    Then the slack user directory contains "Bob Builder"

  @FR-SLACK-03
  Scenario: Channels action populates channel directory
    Given a configured slack integration
    And slack conversations list returns channel "team-updates" with id "C777"
    When the slack connector runs action "channels"
    Then the slack channel directory contains "team-updates"

  @FR-SLACK-04
  Scenario: Enterprise-restricted workspace returns actionable error
    Given a configured slack integration
    And slack conversations list returns enterprise_is_restricted error
    When the slack connector runs action "channels"
    Then the slack result includes "restricts"
    And the slack result includes "Enterprise"

  @FR-SLACK-04
  Scenario: Thread fetch auto-registers channel in entity store
    Given a configured slack integration
    And slack thread in channel "C123" returns 2 messages from "Alice"
    When the slack connector runs action "thread" for url "https://team.slack.com/archives/C123/p1712345678901234"
    Then the slack channel directory contains "C123"

  @FR-SLACK-04
  Scenario: Channel history auto-registers channel in entity store
    Given a configured slack integration
    And slack channel "C456" history returns message "Daily standup"
    When the slack connector runs action "channel_history" for channel "C456"
    Then the slack channel directory contains "C456"

  @FR-SLACK-04
  Scenario: DM thread auto-registers with peer display name
    Given a configured slack integration
    And slack channel "D123" is a DM with user "U111"
    And slack user "U111" resolves to "Avihai Efrat"
    And slack thread in channel "D123" returns 2 messages from "Avihai"
    When the slack connector runs action "thread" for url "https://team.slack.com/archives/D123/p1712345678901234"
    Then the slack channel directory contains "D123"
    And the slack entity "D123" has dm_peer_name "Avihai Efrat"

  @FR-SLACK-05
  Scenario: find_user resolves a name from the local directory without calling Slack
    Given a configured slack integration
    And the slack user directory already knows "U07OZAN" as "Ozan Yilmaz"
    When the slack connector looks up the user "ozan"
    Then the slack result includes "Ozan Yilmaz (U07OZAN)"
    And no slack user API was called

  @FR-SLACK-05
  Scenario: find_user finds a DM peer learned in the channel directory
    Given a configured slack integration
    And the slack channel directory has DM "D123" with "Ozan Yilmaz" as user "U07OZAN"
    When the slack connector looks up the user "Ozan Yilmaz"
    Then the slack result includes "Ozan Yilmaz (U07OZAN)"
    And no slack user API was called

  @FR-SLACK-05
  Scenario: find_user falls back to the Slack user list and remembers the match
    Given a configured slack integration
    And the slack user list includes "U09ANA" named "Ana García"
    When the slack connector looks up the user "ana"
    Then the slack result includes "Ana García (U09ANA)"
    And the slack user directory contains "Ana García"

  @FR-SLACK-05
  Scenario: find_user on a restricted workspace asks for a link from that person
    Given a configured slack integration
    And the slack user list returns enterprise_is_restricted error
    When the slack connector looks up the user "ana"
    Then the slack result includes "link"

  @FR-SLACK-05
  Scenario: help points to find_user for finding a person
    Given a configured slack integration
    When the slack connector runs action "help"
    Then the slack result includes "find_user"

  @FR-SLACK-05
  Scenario: Refreshing channels keeps DM peers learned from use
    Given a configured slack integration
    And the slack channel directory has DM "D123" with "Ozan Yilmaz" as user "U07OZAN"
    And slack conversations list returns channel "general" with id "C001"
    When the slack connector runs action "channels"
    Then the slack channel directory contains "general"
    And the slack entity "D123" has dm_peer_name "Ozan Yilmaz"
