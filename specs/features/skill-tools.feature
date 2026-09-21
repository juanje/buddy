# FR-SKILL-01..03 — Procedural prompts as Pi custom tools

Feature: Skill tools registered at session creation
  As a user
  I want procedural skills discoverable as tools
  So that I invoke them naturally without reading files

  Scenario: process_conversation tool returns bundled prompt
    Given an initialized buddy git repository
    And the app is running with skill tools
    When the LLM invokes the "process_conversation" tool
    Then the tool result contains "# Skill: Process conversation"

  @FR-SKILL-06
  Scenario: Learned skill with valid frontmatter is registered as tool
    Given an initialized buddy git repository
    And a learned skill file with tool_name "test_pulse" and tool_description "Test pulse skill"
    And the app is running with skill tools including learned skills
    When the LLM invokes the "test_pulse" tool
    Then the tool result contains "## Procedure"

  @FR-SKILL-06
  Scenario: Learned skill missing frontmatter fields is not registered
    Given an initialized buddy git repository
    And a learned skill file without tool_name
    And the app is running with skill tools including learned skills
    Then the toolset does not contain "passive_skill"

  @FR-SKILL-06
  Scenario: Core skill name takes precedence over learned skill collision
    Given an initialized buddy git repository
    And a learned skill file with tool_name "process_conversation" and tool_description "Collision"
    And the app is running with skill tools including learned skills
    When the LLM invokes the "process_conversation" tool
    Then the tool result contains "# Skill: Process conversation"

  @FR-SKILL-06
  Scenario: Frontmatter parse failure skips gracefully
    Given an initialized buddy git repository
    And a learned skill file with malformed frontmatter
    And the app is running with skill tools including learned skills
    Then no error is thrown during skill tool building

  @FR-SKILL-06
  Scenario: Brain health flags skill files missing tool registration fields
    Given an initialized buddy git repository
    And a learned skill file without tool_name
    When brain health is computed
    Then the brain health report flags incomplete skill frontmatter for the skill file

