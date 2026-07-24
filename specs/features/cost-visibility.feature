# specs/features/cost-visibility.feature

Feature: Cost visibility and budget limits (FR-COST-02/03)
  As a user
  I want to see my usage in Settings and stay within a monthly budget
  So that I discover costs early without bill shock

  Background:
    Given a usage tracker with monthly budget 10.00

  Scenario: Session cost accumulates from assistant message usage
    When usage is recorded with cost 1.50 and 500 tokens
    And usage is recorded with cost 0.75 and 200 tokens
    Then the session total cost is 2.25
    And the monthly total cost is 2.25

  Scenario: Monthly cost persists across tracker instances
    Given monthly usage already recorded as 4.00
    When a new usage tracker loads the usage file
    And usage is recorded with cost 1.00 and 100 tokens
    Then the monthly total cost is 5.00

  Scenario: Budget warning fires at 80 percent
    Given monthly usage already recorded as 7.50
    When usage is recorded with cost 1.00 and 100 tokens
    Then the budget status level is "warning"

  Scenario: Budget hard limit blocks at 100 percent
    Given monthly usage already recorded as 9.50
    When usage is recorded with cost 1.00 and 100 tokens
    Then the budget status level is "exceeded"
    And sending is blocked by the budget limit

  Scenario: Disabled budget never alerts or blocks
    Given the monthly budget is disabled
    And monthly usage already recorded as 50.00
    When usage is recorded with cost 5.00 and 1000 tokens
    Then the budget status level is "disabled"
    And sending is not blocked by the budget limit

  Scenario: Settings usage panel shows session and monthly totals
    Given the app is configured with language "es"
    And the chat session is active
    And usage summary session cost 1.20 and monthly cost 3.40 with budget 10.00
    When I open settings
    Then the settings show session cost "1.20"
    And the settings show monthly cost "3.40"
    And the settings show monthly budget "10.00"

  Scenario: User changes monthly budget in settings
    Given the app is configured with language "es"
    And usage summary session cost 0.00 and monthly cost 3.40 with budget 10.00
    And the settings panel is open
    When I set the monthly budget to "25.00"
    Then the saved config monthly budget is 25
