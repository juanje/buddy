# specs/features/setup-create.feature

Feature: Deterministic buddy directory setup (FR-SETUP-08)
  As a new user who completed the wizard
  I want my assistant's home created automatically
  So that everything is ready without me touching files

  Background:
    Given a completed wizard configuration

  Scenario: The full directory structure is created
    When setup runs
    Then the buddy directory contains "agent_brain", "user" and "logs"

  Scenario: Base templates are copied
    When setup runs
    Then the buddy directory contains the base templates

  Scenario: USER.md is populated from wizard form data
    When setup runs
    Then USER.md contains the user's name and language

  Scenario: Pi settings are written
    When setup runs
    Then ".pi/settings.json" holds the configured provider and model

  Scenario: Git is initialized with an initial commit
    When setup runs
    Then the buddy directory is a git repository with exactly one commit

  Scenario: The app is marked as configured
    When setup runs
    Then first-run detection reports the buddy as configured

  Scenario: Index hubs and scaffolding are created
    When setup runs
    Then the buddy directory contains file "agent_brain/concepts/index.md"
    And the buddy directory contains file "agent_brain/projects/index.md"
    And the buddy directory contains file "agent_brain/ideas/index.md"
    And the buddy directory contains file "agent_brain/ideas/_scratchpad.md"

  Scenario: .gitignore excludes app internals
    When setup runs
    Then ".gitignore" excludes ".buddy/"
    And ".gitignore" excludes ".pi/"
