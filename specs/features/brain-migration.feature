# FR-BRAIN-08/09/10 — Preference tracking, user-model consolidation, principle abstraction

Feature: Brain migration — USER.md section scaffolding
  As a buddy instance (fresh or existing)
  I want USER.md to have ## Preferences and ## Principles sections
  So that consolidation has structured places to record preferences and cross-domain principles

  Background:
    Given a temporary buddy root directory

  Scenario: Existing USER.md without Preferences gains the section
    Given a USER.md with only About and Context sections
    When ensureUserMdSections runs
    Then USER.md contains a "## Preferences" section
    And the original content is preserved

  Scenario: USER.md that already has Preferences keeps it and gains Principles
    Given a USER.md that already contains "## Preferences"
    When ensureUserMdSections runs
    Then USER.md contains exactly one "## Preferences" section
    And USER.md contains a "## Principles" section

  Scenario: Migration is idempotent
    Given a USER.md with only About and Context sections
    When ensureUserMdSections runs twice
    Then USER.md contains exactly one "## Preferences" section
    And USER.md contains exactly one "## Principles" section

  Scenario: Migration runs before session start
    Given a USER.md with only About and Context sections
    When the session boots
    Then USER.md contains a "## Preferences" section

  Scenario: Existing USER.md without Principles gains the section
    Given a USER.md with only About and Context sections
    When ensureUserMdSections runs
    Then USER.md contains a "## Principles" section
    And the original content is preserved

  Scenario: USER.md that already has Principles keeps it and gains Preferences
    Given a USER.md that already contains "## Principles"
    When ensureUserMdSections runs
    Then USER.md contains exactly one "## Principles" section
    And USER.md contains a "## Preferences" section

  Scenario: Both sections are scaffolded together
    Given a USER.md with only About and Context sections
    When ensureUserMdSections runs
    Then USER.md contains a "## Preferences" section
    And USER.md contains a "## Principles" section

  Scenario: Consolidation prompt includes user-model update step
    Given the bundled consolidation skill is deployed
    When the consolidation prompt is built for depth 1
    Then the prompt contains "Did the user reveal"

  Scenario: Weekly consolidation includes principle extraction step
    Given the bundled consolidation skill is deployed
    When the consolidation prompt is built for depth 2
    Then the prompt contains "Principles"
