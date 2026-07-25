# FR-BRAIN-07 — Brain health linter (NFR-FORMAT-01)

Feature: Brain health linter
  As a maintainer
  I want deterministic structural checks on agent_brain content
  So that consolidation receives pre-computed health issues to fix

  Background:
    Given a temporary buddy root directory

  Scenario: Missing frontmatter is detected
    Given a brain file "agent_brain/concepts/stale.md" without required frontmatter
    When the brain health report is computed
    Then the report lists missing frontmatter for "agent_brain/concepts/stale.md"

  Scenario: Missing core file is detected
    Given the brain is missing "agent_brain/identity/SOUL.md"
    When the brain health report is computed
    Then the report lists missing core file "agent_brain/identity/SOUL.md"

  Scenario: Missing index.md is detected
    Given a brain directory "agent_brain/concepts" with files "alpha.md" and "beta.md" and no index
    When the brain health report is computed
    Then the report lists missing index for "agent_brain/concepts"

  Scenario: Oversized file is detected
    Given a brain file "agent_brain/projects/big.md" exceeding the size threshold
    When the brain health report is computed
    Then the report lists oversized file "agent_brain/projects/big.md"

  Scenario: Healthy brain produces no health block
    Given a healthy brain structure
    When the brain health report is computed
    Then the report has no issues
    And the formatted health block is empty

  Scenario: Health report is injected into consolidation prompt
    Given a brain file "agent_brain/concepts/stale.md" without required frontmatter
    And the global consolidation skill is available
    When the consolidation prompt is built for depth 1
    Then the prompt contains "Brain health (pre-computed):"
