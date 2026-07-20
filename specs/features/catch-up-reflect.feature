# FR-REFLECT-02 — Crash recovery spawns reflect for pending skeletons

Feature: Crash recovery spawns reflect for pending skeletons
  As a user
  I want pending reflect skeletons detected when the app starts
  So that background reflect children can enrich long-term memory

  Background:
    Given an initialized AB git repository

  Scenario: Pending reflect is detected and spawn contract is satisfied at boot
    Given a pending reflect skeleton exists
    When crash recovery runs at boot
    Then pending reflects are detected
    And a reflect child spawn is requested for each pending skeleton
