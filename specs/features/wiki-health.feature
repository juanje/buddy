# FR-WIKI-05 — Wiki health check and repair

Feature: Wiki health check and repair
  As a user
  I want the wiki to stay structurally consistent
  So that links and indexes remain trustworthy after filing

  Background:
    Given an initialized buddy git repository
    And wiki_file tools are available

  Scenario: Filing leaves no orphans or broken links
    Given an existing wiki page "concepts/beta.md" titled "Beta"
    When wiki_file is called to create "Alpha" in category "concepts" with a connection to beta
    Then the wiki page "concepts/alpha.md" exists
    And the wiki health report has no orphans
    And the wiki health report has no broken links

  Scenario: A manually broken backlink is repaired after filing
    Given an existing wiki page "concepts/beta.md" with connection to alpha
    And the wiki page "concepts/beta.md" has no backlink to alpha
    When wiki_file enriches "Alpha" with a new key point "Updated point."
    Then the wiki page "concepts/beta.md" has a backlink to alpha

  Scenario: A broken connection is resolved by slug similarity
    Given an existing wiki page "concepts/beta.md" titled "Beta"
    And the wiki page "concepts/alpha.md" has a broken wiki-root connection to beta
    When wiki_file enriches "Alpha" with a new key point "Trigger health check."
    Then the wiki health report has no broken links
    And the wiki page "concepts/alpha.md" contains "beta.md"
