# FR-REFLECT-02 — Catch-up reflect on start

Feature: Catch-up reflect on start
  As a user
  I want pending session logs processed when the app starts
  So that long-term memory is enriched without manual work

  Background:
    Given an initialized AB git repository

  Scenario: Pending reflect is marked complete on catch-up
    Given a pending session log exists
    When catch-up reflect runs
    Then the session log status is "complete"
    And the session log contains "Reflect summary"
