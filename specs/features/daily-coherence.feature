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
