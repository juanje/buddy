# specs/features/grouping-candidates.feature

Feature: Grouping candidates detection (FR-CONSOL-22)
  As the Buddy worker
  I want grouping candidates pre-computed for weekly consolidation
  So that the LLM reviews clusters instead of scanning directories

  Background:
    Given a buddy directory prepared for consolidation depth features

  Scenario: Detects keyword cluster with 3 or more files
    Given 3 concept files share the keyword "memory" in their summaries
    When grouping candidates are computed
    Then a grouping candidate for "memory" is present
