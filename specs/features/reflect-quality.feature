# FR-REFLECT-10 / FR-PROMPT-09 — Reflect capture quality

Feature: Reflect prompt captures depth, observations, and session-time log writes
  As a user
  I want session reflects to keep reasoning, concrete facts, and observation signals
  So that later journal and consolidation have something to work from

  @FR-REFLECT-10
  Scenario: Process-conversation prompt includes observation exclusion criteria
    Given the bundled process-conversation.md prompt
    Then the process-conversation prompt contains "NOT a candidate"

  @FR-REFLECT-10
  Scenario: Process-conversation prompt preserves concrete facts
    Given the bundled process-conversation.md prompt
    Then the process-conversation prompt contains "Concrete facts feed"
    And the process-conversation prompt contains "Preserve concrete facts"

  @FR-REFLECT-10
  Scenario: Output-only suffix instructs reasoning depth
    Given the output-only suffix for session-end reflect
    Then the suffix instructs capturing full reasoning behind decisions
    And the suffix frames observations as the most valuable reflect output
    And the suffix does not frame output as Produce ONLY

  @FR-REFLECT-11
  Scenario: Process-conversation prompt includes Right now patch step
    Given the bundled process-conversation.md prompt
    Then the process-conversation prompt contains "Right now patches"
    And the process-conversation prompt contains "volatile state"

  @FR-REFLECT-11
  Scenario: Output-only suffix instructs Right now patching
    Given the output-only suffix for session-end reflect
    Then the suffix contains "Right now patches"

  @FR-DEFERRED-06
  Scenario: Output-only suffix instructs resolved deferred reporting
    Given the output-only suffix for session-end reflect
    Then the suffix contains "Resolved deferred"

  @FR-PROMPT-09
  Scenario: Base prompt permits log writing during sessions
    Given the bundled agents-base.md prompt
    Then the agents-base prompt does not contain "Do not write to `logs/` directly"
    And the agents-base prompt contains "You can write to `logs/"
    And the agents-base prompt contains "session-time writing"
