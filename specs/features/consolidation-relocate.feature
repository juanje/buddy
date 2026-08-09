# FR-CONSOL-07 — Consolidation relocate tool for brain file grouping

Feature: FR-CONSOL-07 Consolidation relocate tool
  As a consolidation maintenance session
  I want to move brain files into subdirectories
  So that monthly grouping can reorganize flat concept directories

  Scenario: Move a concept file into a subdirectory
    Given an AB instance with "agent_brain/concepts/foo.md"
    And "agent_brain/concepts/bar.md" contains a link to "../concepts/foo.md"
    When the consolidation tool relocate_brain_file is called with source "agent_brain/concepts/foo.md" and destination "agent_brain/concepts/cluster/foo.md"
    Then "agent_brain/concepts/cluster/foo.md" exists
    And "agent_brain/concepts/foo.md" does not exist
    # NFR-PORT-07 — must rewrite on Windows too (no startsWith(root+"/"))
    And "agent_brain/concepts/bar.md" link is updated to "cluster/foo.md"

  Scenario: Reject relocation outside agent_brain
    Given an AB instance with "user/inbox.md"
    When relocate_brain_file is called with source "user/inbox.md" and destination "agent_brain/inbox.md"
    Then the tool returns an error "source must be within agent_brain/"

  Scenario: Reject missing source file
    Given an initialized buddy git repository
    When relocate_brain_file is called with source "agent_brain/nonexistent.md" and destination "agent_brain/x/y.md"
    Then the tool returns an error containing "does not exist"
