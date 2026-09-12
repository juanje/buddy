# specs/features/daily-coherence.feature

Feature: Daily coherence detection (FR-CONSOL-20)
  As the Buddy worker
  I want daily coherence flags pre-computed in the prompt header
  So that the LLM reconciles only flagged divergences

  Background:
    Given a buddy directory prepared for consolidation depth features

  Scenario: Detects stale Right now item when log mentions completion
    Given AGENTS.md Right now mentions "Project Alpha Phase 1 next"
    And today's log mentions Project Alpha Phase 1 complete
    When daily coherence is computed
    Then a staleness flag is present

  Scenario: Detects resolved deferred item
    Given deferred.md contains "investigate native menu rendering"
    And today's log mentions native menu rendering resolved
    When daily coherence is computed
    Then a resolved deferred flag is present

  Scenario: Produces empty block when no divergence found
    Given no coherence divergence fixtures
    When the daily coherence block is formatted
    Then the block reports no divergence detected

  @FR-CONSOL-29
  Scenario: task with only created-date comment is not upcoming
    Given tasks.md has a line "- [ ] >> Buy milk @personal <!-- c:2026-08-17 -->"
    When upcoming reminders are computed for "2026-08-17"
    Then no upcoming task reminders are found

  @FR-CONSOL-29
  Scenario: task with real due date is still upcoming
    Given tasks.md has a line "- [ ] Pay rent 2026-08-18 @personal <!-- c:2026-08-01 -->"
    When upcoming reminders are computed for "2026-08-17"
    Then 1 upcoming task reminder is found

  @FR-CONSOL-30
  Scenario: area-only word overlap does not produce coherence flag
    Given tasks.md has a line "- [ ] >> Confirm docs with Ana @family <!-- c:2026-08-17 -->"
    And today's log mentions "family visit completed"
    When daily coherence is computed
    Then no task coherence flags are present

  @FR-CONSOL-30
  Scenario: completion keyword in unrelated paragraph does not flag distant task
    Given tasks.md has a line "- [ ] >> Buy travel insurance @travel <!-- c:2026-08-17 -->"
    And today's log has completion language about a different topic
    When daily coherence is computed
    Then no task coherence flags are present

  @FR-CONSOL-30
  Scenario: genuine task completion still flagged
    Given tasks.md has a line "- [ ] Apply corrections and run tests on the feature PR @work"
    And today's log mentions "Feature PR corrections completed and merged"
    When daily coherence is computed
    Then a task coherence flag is present
