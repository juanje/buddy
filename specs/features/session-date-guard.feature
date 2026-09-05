# FR-SESSION-06 — Mid-session date correction (Fixes #4)

@FR-SESSION-06
Feature: Mid-session date correction
  As a user who keeps Buddy open for multiple days
  I want the agent to know today's actual date
  So that date-dependent features work correctly

  Scenario: System prompt reflects current date after day rollover
    Given a session was started on "2026-08-28"
    When the calendar date changes to "2026-08-29"
    And the before_agent_start hook fires
    Then the system prompt includes "29 August 2026"
    And the system prompt does not include "28 August 2026" as the current date

  Scenario: System prompt unchanged within the same day
    Given a session was started on "2026-08-28"
    When the before_agent_start hook fires on the same day
    Then the system prompt is unchanged
