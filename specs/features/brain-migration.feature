# FR-BRAIN-08/09 — Preference tracking and user-model consolidation step

Feature: Brain migration — USER.md section scaffolding
  As a buddy instance (fresh or existing)
  I want USER.md to have a ## Preferences section
  So that consolidation has a structured place to record user preferences

  Background:
    Given a temporary buddy root directory

  Scenario: Existing USER.md without Preferences gains the section
    Given a USER.md with only About and Context sections
    When ensureUserMdSections runs
    Then USER.md contains a "## Preferences" section
    And the original content is preserved

  Scenario: USER.md that already has Preferences is unchanged
    Given a USER.md that already contains "## Preferences"
    When ensureUserMdSections runs
    Then USER.md is unchanged

  Scenario: Migration is idempotent
    Given a USER.md with only About and Context sections
    When ensureUserMdSections runs twice
    Then USER.md contains exactly one "## Preferences" section

  Scenario: Migration runs before session start
    Given a USER.md with only About and Context sections
    When the session boots
    Then USER.md contains a "## Preferences" section

  Scenario: Consolidation prompt includes user-model update step
    Given the bundled consolidation skill is deployed
    When the consolidation prompt is built for depth 1
    Then the prompt contains "Did the user reveal"
