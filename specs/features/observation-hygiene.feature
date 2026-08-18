# specs/features/observation-hygiene.feature

Feature: Observation hygiene (FR-CONSOL-17)
  As the Buddy worker
  I want stale observations pre-computed before weekly consolidation
  So that the LLM reviews filtered lists instead of parsing observations.md

  Background:
    Given a buddy directory prepared for consolidation depth features

  Scenario: Auto-removes entries with non-existent paths
    Given observations.md contains an entry referencing "skills/missing-skill.md"
    And "skills/missing-skill.md" does not exist in the instance
    When observation hygiene runs
    Then the entry is removed from observations.md
    And removed count is 1

  Scenario: Identifies resolved entries older than 60 days
    Given observations.md contains a resolved entry dated 80 days ago
    When stale observations are computed
    Then the entry appears in the "resolvedOlderThan60d" list

  Scenario: Does not remove entries with existing paths
    Given observations.md contains an entry referencing "concepts/index.md"
    And "concepts/index.md" exists in the instance
    When observation hygiene runs
    Then the entry is not removed
