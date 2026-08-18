# specs/features/skill-usage-tracking.feature

Feature: Skill invocation tracking (FR-CONSOL-18)
  As the Buddy worker
  I want skill tool invocations recorded in consolidation state
  So that weekly consolidation can surface friction for skill improvement

  Background:
    Given a buddy directory prepared for consolidation depth features

  Scenario: Skill invocation is recorded
    When the "process_conversation" skill tool is invoked
    Then consolidation state has skillUsage.process_conversation.lastInvoked set to today
    And skillUsage.process_conversation.totalInvocations is 1

  Scenario: Period counter resets after depth-2
    Given skillUsage.triage_inbox.invokedThisPeriod is 3
    When consolidation counters advance at depth 2
    Then skillUsage.triage_inbox.invokedThisPeriod should be 0
