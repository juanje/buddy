# specs/features/post-consolidation-validation.feature

Feature: Post-consolidation validation (FR-GUARD-03)
  As the consolidation runner
  I want deterministic filename and link repairs after maintenance
  So that consolidation output conforms to repo conventions

  Scenario: New file with spaces in name is renamed to slug
    Given a new brain file "agent_brain/concepts/My Bad Name.md" in the repo
    And a touched file "agent_brain/concepts/index.md" linking to "My Bad Name.md"
    When post-consolidation validation runs on the touched files
    Then the file is renamed to "agent_brain/concepts/my-bad-name.md"
    And "agent_brain/concepts/index.md" links to "my-bad-name.md"

  Scenario: New file with uppercase is renamed
    Given a new brain file "agent_brain/concepts/MyConcept.md" in the repo
    When post-consolidation validation runs on the touched files
    Then the file is renamed to "agent_brain/concepts/myconcept.md"

  Scenario: Valid filename is unchanged
    Given a new brain file "agent_brain/concepts/valid-name.md" in the repo
    When post-consolidation validation runs on the touched files
    Then no files are renamed

  Scenario: Broken markdown link is stripped to text
    Given a touched file "agent_brain/concepts/index.md" containing "[missing](nonexistent.md)"
    When post-consolidation validation runs on the touched files
    Then "agent_brain/concepts/index.md" contains "missing"
    And "agent_brain/concepts/index.md" does not contain "[missing](nonexistent.md)"

  Scenario: Valid link is unchanged
    Given a touched file "agent_brain/concepts/index.md" containing "[valid](valid-name.md)"
    And an existing file "agent_brain/concepts/valid-name.md"
    When post-consolidation validation runs on the touched files
    Then "agent_brain/concepts/index.md" still contains "[valid](valid-name.md)"

  Scenario: Filename rename cascades link updates in other touched files
    Given a new brain file "agent_brain/concepts/Bad Name.md" in the repo
    And a touched file "agent_brain/projects/index.md" linking to "../concepts/Bad Name.md"
    When post-consolidation validation runs on the touched files
    Then "agent_brain/projects/index.md" links to "../concepts/bad-name.md"

  Scenario: Validation only processes the supplied touched file list
    Given a touched file "agent_brain/concepts/index.md" containing "[broken](ghost.md)"
    And an untouched file "user/notes.md" containing "[also broken](ghost.md)"
    When post-consolidation validation runs on the touched files
    Then "user/notes.md" still contains "[also broken](ghost.md)"
