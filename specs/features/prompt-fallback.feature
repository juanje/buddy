# NFR-PORT-02 — CLAUDE.md fallback for imported instances

Feature: System prompt falls back to CLAUDE.md
  As a user with an existing AB created in Cursor
  I want the app to read CLAUDE.md when AGENTS.md is absent
  So that my agent keeps its rules regardless of which tool created it

  Background:
    Given an AB directory with identity files

  Scenario: AGENTS.md is used when present
    When the system prompt is assembled
    Then it contains the AGENTS.md rules

  Scenario: CLAUDE.md is used when AGENTS.md is absent
    Given the AB directory has CLAUDE.md instead of AGENTS.md
    When the system prompt is assembled
    Then it contains the CLAUDE.md rules

  Scenario: Neither file results in no rules section
    Given the AB directory has neither AGENTS.md nor CLAUDE.md
    When the system prompt is assembled
    Then the prompt has no rules section
