# specs/features/edit-recovery.feature

Feature: Edit-failure recovery (FR-GUARD-02)
  As the Buddy worker
  I want failed edit calls to include actionable recovery hints
  So that the model retries with edit instead of falling back to destructive write

  Scenario: Edit fails with "Could not find" — hint to re-read
    When an edit tool fails with message "Could not find the exact text in agent_brain/deferred.md. The old text must match exactly including all whitespace and newlines."
    Then the enriched result includes "Re-read the file"

  Scenario: Edit fails with "Found N occurrences" — hint for unique anchor
    When an edit tool fails with message "Found 2 occurrences of the text in agent_brain/deferred.md. The text must be unique. Please provide more context to make it unique."
    Then the enriched result includes "surrounding lines"

  Scenario: Edit fails with "No changes made" — hint to check newText
    When an edit tool fails with message "No changes made to agent_brain/observations.md. The replacement produced identical content."
    Then the enriched result includes "identical"

  Scenario: Unknown edit error — no hint appended
    When an edit tool fails with message "Permission denied for agent_brain/secret.md"
    Then the enriched result is unchanged

  Scenario: Non-edit tool error — no hint appended
    When a read tool fails with message "Could not find the exact text in foo.md"
    Then the enriched result is unchanged

  Scenario: Hint works in the maintenance session hook
    Given a maintenance session with edit recovery installed
    When an edit call fails with message "Could not find edits[0] in user/inbox.md. The oldText must match exactly including all whitespace and newlines."
    Then the maintenance hook enriches the result with "Re-read the file"

  Scenario: agents-base.md instructs re-read after edit failure
    Then agents-base.md contains edit recovery guidance
