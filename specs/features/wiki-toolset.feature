# FR-WIKI-07 — Wiki tools always registered in interactive sessions

Feature: Wiki toolset registration
  As a user
  I want wiki tools available in every session
  So that I can search and file knowledge without enabling a feature

  Scenario: wiki_search and wiki_file are in the interactive session tool list
    Given an initialized buddy git repository
    When the agent toolset is built for the buddy
    Then the toolset offers wiki_search
    And the toolset offers wiki_file
    And the toolset registers wiki_search
    And the toolset registers wiki_file
