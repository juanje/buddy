# FR-SKILL-01..03 — Procedural prompts as Pi custom tools

Feature: Skill tools registered at session creation
  As a user
  I want procedural skills discoverable as tools
  So that I invoke them naturally without reading files

  Scenario: process_conversation tool returns bundled prompt
    Given an initialized AB git repository
    And the app is running with skill tools
    When the LLM invokes the "process_conversation" tool
    Then the tool result contains "# Skill: Process conversation"

  Scenario: triage_inbox tool returns bundled prompt
    Given an initialized AB git repository
    And the app is running with skill tools
    When the LLM invokes the "triage_inbox" tool
    Then the tool result contains "# Skill: Triage inbox"
