# FR-WIKI-06 — Wiki synthesis (emergent concepts)

Feature: Wiki synthesis
  As a user
  I want the wiki to discover implicit concepts
  So that related pages develop emergent structure over time

  Background:
    Given an initialized buddy git repository
    And wiki_file tools are available

  Scenario: Candidate detection finds an orphan-dense tag
    Given wiki pages tagged with "emergence" on 3 pages without an Emergence page
    When synthesis candidates are scanned
    Then an orphan-tag candidate for "emergence" is found

  Scenario: A tag with a matching page title is not a candidate
    Given wiki pages tagged with "concepts" and a page titled "Concepts"
    When synthesis candidates are scanned
    Then no orphan-tag candidate for "concepts" is found

  Scenario: Co-occurring tag pair on 3+ pages is a candidate
    Given 3 wiki pages each tagged with both "feedback" and "systems"
    When synthesis candidates are scanned
    Then a co-occurrence candidate for tags "feedback" and "systems" is found

  Scenario: Disconnected pages sharing tags are candidates
    Given wiki pages "alpha" and "beta" sharing tags "complex-systems" and "attractors" with no connection between them
    When synthesis candidates are scanned
    Then a disconnected-cluster candidate linking those pages is found

  Scenario: Synthesis creates a page for an orphan-dense tag
    Given wiki pages tagged with "emergence" on 3 pages without an Emergence page
    And wiki synthesis is triggered with a mock session
    When the mock session approves the orphan-tag candidate
    Then a wiki page for "Emergence" exists with origin synthesis

  Scenario: Synthesis respects the 3-page cap
    Given wiki synthesis is triggered with a mock session and 4 approved candidates
    When the mock session attempts to create all pages
    Then only 3 synthesis pages were created
    And the 4th wiki_file call was rejected by the cap

  Scenario: Synthesis skips when page growth is below threshold
    Given wiki-state with synthesis last run at 15 pages and current page count 20
    When wiki synthesis is evaluated on heartbeat
    Then wiki synthesis did not run

  Scenario: Synthesis respects cooldown period
    Given wiki-state with synthesis last run 2 days ago and cooldown 7 days
    When wiki synthesis is evaluated on heartbeat
    Then wiki synthesis did not run
