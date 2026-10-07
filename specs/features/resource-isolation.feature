@NFR-SEC-21
Feature: SDK resource discovery disabled (NFR-SEC-21)
  Buddy's system prompt must contain only what Buddy assembles.
  The Pi SDK must not inject AGENTS.md from parent directories,
  skills, extensions, prompt templates, themes, or APPEND_SYSTEM.md.

  Background:
    Given a buddy instance with SDK leak decoys in cwd, parents, and home

  Scenario: Chat session system prompt excludes SDK-discovered resources
    When the chat agent session is created
    Then the session system prompt contains the root AGENTS marker exactly once
    And the session system prompt does not contain the parent AGENTS marker
    And the session system prompt does not contain the append-system marker
    And the session system prompt does not advertise decoy skills

  Scenario: Consolidation session system prompt excludes SDK-discovered resources
    When the consolidation agent session is created
    Then the session system prompt does not contain the root AGENTS marker
    And the session system prompt does not contain the parent AGENTS marker
    And the session system prompt does not contain the append-system marker
    And the session system prompt does not advertise decoy skills

  Scenario: Wiki synthesis session system prompt excludes SDK-discovered resources
    When the wiki synthesis agent session is created
    Then the session system prompt contains the wiki synthesis instruction
    And the session system prompt does not contain the root AGENTS marker
    And the session system prompt does not advertise decoy skills

  Scenario: Reflect session system prompt excludes SDK-discovered resources
    When the reflect agent session is created
    Then the session system prompt does not contain the root AGENTS marker
    And the session system prompt does not contain the append-system marker
    And the session system prompt does not advertise decoy skills
