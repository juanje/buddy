# FR-HEBB — Hebbian access tracking

Feature: Hebbian access tracking
  As a user
  I want the app to track which brain files the agent consults
  So that consolidation can promote frequently used knowledge

  Background:
    Given an initialized buddy git repository
    And the app is running with memory lifecycle enabled

  Scenario: Agent read updates brain file frontmatter after turn end
    Given a tracked brain file "agent_brain/concepts/hot-topic.md" with access_count 3
    When the agent reads file "agent_brain/concepts/hot-topic.md"
    And the agent turn ends
    Then "agent_brain/concepts/hot-topic.md" has access_count 4
    And "agent_brain/concepts/hot-topic.md" was accessed today

  Scenario: Same file read twice in one session counts once
    Given a tracked brain file "agent_brain/concepts/once.md" with access_count 1
    When the agent reads file "agent_brain/concepts/once.md"
    And the agent reads file "agent_brain/concepts/once.md"
    And the agent turn ends
    Then "agent_brain/concepts/once.md" has access_count 2

  Scenario: Excluded structural files are not tracked
    Given a tracked brain file "agent_brain/identity/SOUL.md" with access_count 5
    When the agent reads file "agent_brain/identity/SOUL.md"
    And the agent turn ends
    Then "agent_brain/identity/SOUL.md" has access_count 5

  Scenario: User workspace files are not tracked
    Given a tracked user file "user/inbox.md" with access_count 2
    When the agent reads file "user/inbox.md"
    And the agent turn ends
    Then "user/inbox.md" has access_count 2

  Scenario: Hebbian updates are included in lazy commits
    Given a tracked brain file "agent_brain/concepts/commit-me.md" with access_count 0
    When the agent reads file "agent_brain/concepts/commit-me.md"
    And the agent turn ends
    Then the buddy repository has a new commit
    And "agent_brain/concepts/commit-me.md" has access_count 1
