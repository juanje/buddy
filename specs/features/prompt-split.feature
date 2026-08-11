# FR-PROMPT-08 — AGENTS.md structural migration (core instructions → agents-base.md)

Feature: AGENTS.md prompt split
  As a buddy instance
  I want core instructions in agents-base.md and instance state in AGENTS.md
  So that behavioral rules update with the app without overwriting personalization

  Background:
    Given a temporary buddy root directory

  Scenario: Fresh template AGENTS.md has no core instructions
    Given the new AGENTS.md template is deployed
    Then AGENTS.md does not contain "## Core behavior"
    And AGENTS.md contains "## Active context"
    And AGENTS.md contains "## Where to find things"
    And AGENTS.md contains "## Rules"

  Scenario: Migration detects old format and rewrites
    Given AGENTS.md in the old format with personalized active context
    When migrateAgentsMd runs
    Then AGENTS.md does not contain "## Core behavior"
    And AGENTS.md contains "## Active context"
    And AGENTS.md preserves the personalized right now bullet

  Scenario: Migration preserves instance-learned rules only
    Given AGENTS.md in the old format with two instance-learned rules
    When migrateAgentsMd runs
    Then AGENTS.md Rules section contains "Always use 24-hour time"
    And AGENTS.md Rules section contains "Never write to the journal during chat"
    And AGENTS.md Rules section does not contain "**Language:**"

  Scenario: Migration creates a backup
    Given AGENTS.md in the old format with personalized active context
    When migrateAgentsMd runs
    Then a backup exists at ".buddy/migrations/agents-md-pre-split.md"
    And the backup contains "## Core behavior"

  Scenario: Migration is idempotent
    Given AGENTS.md already in the new format
    When migrateAgentsMd runs
    Then AGENTS.md is unchanged

  Scenario: System prompt includes core rules from agents-base.md
    Given agents-base.md with capture rules and core rules is deployed
    And AGENTS.md in the new format
    When the system prompt is assembled for prompt split
    Then the assembled system prompt contains "## Capture rules"
    And the assembled system prompt contains "## Core rules"
    And the assembled system prompt contains "### Where to write"
    And the assembled system prompt contains "### Where to search"

  Scenario: Consolidation prompt distinguishes core vs instance rules
    Given the bundled consolidation skill is deployed
    When the consolidation prompt is built for depth 1
    Then the prompt contains "Core behavioral rules are already loaded"
    And the prompt contains "**instance rule** to `## Rules` in"
