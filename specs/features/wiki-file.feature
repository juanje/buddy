# FR-WIKI-01/03/09 — Lightweight wiki capture from conversation

Feature: Wiki file lightweight capture
  As a user
  I want the assistant to file knowledge into my wiki
  So that ideas and concepts are stored as interconnected pages

  Background:
    Given an initialized buddy git repository
    And wiki_file tools are available

  Scenario: Filing from conversation creates a page with correct format and backlinks
    Given an existing wiki page "sistemas-complejos/equilibrio-dinamico.md" titled "Equilibrio dinámico"
    When wiki_file is called to create "Atractor" in category "sistemas-complejos" with a connection to equilibrio
    Then the wiki page "sistemas-complejos/atractor.md" exists
    And the wiki page "sistemas-complejos/atractor.md" contains tag "sistemas-complejos"
    And the wiki page "sistemas-complejos/equilibrio-dinamico.md" has a backlink to atractor

  Scenario: Filing bootstraps wiki structure on first use
    Given the buddy has no wiki directory
    When wiki_file is called to create "First idea" in category "ideas"
    Then the wiki directory "user/wiki" exists
    And the buddy file "user/wiki/index.md" exists
    And the buddy file "user/wiki/.meta/log.md" exists

  Scenario: Filing a concept that matches an existing title enriches the page
    Given an existing wiki page "concepts/spark.md" titled "Spark"
    When wiki_file enriches "Spark" with a new key point "Second insight"
    Then the wiki page "concepts/spark.md" contains "Second insight"
    And the wiki file result action is "enriched"

  Scenario: Enrichment respects size guard
    Given an existing wiki page "concepts/large.md" with 78 content lines
    When wiki_file enriches "Large" with enough key points to exceed the size guard
    Then a new wiki page is created instead of enriching
    And the new page links to the existing page with see also

  Scenario: Connections use set union by destination path
    Given an existing wiki page "concepts/alpha.md" with connection to beta
    When wiki_file enriches "Alpha" adding the same beta connection with a different description
    Then the wiki page "concepts/alpha.md" has exactly one connection to beta

  Scenario: Tags sources and updated date are set correctly on create
    When wiki_file is called with tags sources and summary for "Tagged concept"
    Then the wiki page frontmatter has tags "test-tag" and source "user/notes.md"
    And the wiki page frontmatter updated date is today

  Scenario: Index tags and glossary are regenerated after filing
    When wiki_file is called to create "Indexed concept" in category "ideas"
    Then the buddy file "user/wiki/index.md" lists "Indexed concept"
    And the buddy file "user/wiki/tags.md" lists tag "ideas"
    And the buddy file "user/wiki/glossary.md" lists "Indexed concept"
