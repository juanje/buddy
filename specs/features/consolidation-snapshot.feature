# specs/features/consolidation-snapshot.feature

Feature: Weekly diff and snapshot (FR-CONSOL-19)
  As the Buddy worker
  I want USER.md and Right now snapshots after each depth-2
  So that weekly consolidation can review structured diffs

  Background:
    Given a buddy directory prepared for consolidation depth features

  Scenario: Snapshot is saved after depth-2
    When consolidation counters advance at depth 2
    Then consolidation state contains lastDepth2Snapshot.userMdHash
    And lastDepth2Snapshot.rightNowContent matches current "Right now"

  Scenario: Weekly diff is computed before depth-2
    Given a previous depth-2 snapshot exists
    And USER.md has changed since the snapshot
    When the weekly diff block is computed
    Then the block contains a USER.md diff section
