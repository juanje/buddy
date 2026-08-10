# FR-WIKI-04 — Search and retrieve from wiki (metadata only)

Feature: Wiki search
  As a user
  I want the assistant to search my wiki by keyword or tag
  So that it can find relevant knowledge without loading every page

  Background:
    Given an initialized buddy git repository

  Scenario: Search by keyword returns matching page metadata
    Given a wiki with sample pages for search
    When wiki_search is called with query "atractor" and scope "all"
    Then the wiki search result contains "Atractor"
    And the wiki search result contains "sistemas-complejos/atractor.md"

  Scenario: Search returns no page bodies
    Given a wiki with sample pages for search
    When wiki_search is called with query "atractor" and scope "all"
    Then the wiki search result does not contain "## Key points"
    And the wiki search details include summary but not body content

  Scenario: Search on empty wiki returns empty results
    Given the wiki has no pages
    When wiki_search is called with query "anything" and scope "all"
    Then the wiki search result contains "No wiki pages matched"

  Scenario: Search by tag returns pages with that tag
    Given a wiki with sample pages for search
    When wiki_search is called with query "sistemas-complejos" and scope "tags"
    Then the wiki search result contains "Atractor"
    And the wiki search result contains "Sistemas complejos"

  Scenario: Search scope tags limits to tag field only
    Given a wiki with sample pages for search
    When wiki_search is called with query "atractor" and scope "tags"
    Then the wiki search result contains "No wiki pages matched"
    When wiki_search is called with query "atractores" and scope "tags"
    Then the wiki search result contains "Atractor"
