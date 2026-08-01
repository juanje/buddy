# specs/features/setup-location.feature

Feature: Location picker (FR-SETUP-04)
  As a new user on the setup wizard
  I want to choose where my assistant will live
  So that its memory is stored where I expect

  Background:
    Given the setup wizard is on the location step

  Scenario: Accepting the default location
    Given the default location does not exist yet
    When the user accepts the proposed location
    Then the location is stored for setup
    And the wizard allows proceeding to the next step

  Scenario: Choosing a custom empty directory
    Given an empty directory chosen by the user
    When the user picks that directory as the location
    Then the location is stored for setup
    And the wizard allows proceeding to the next step

  Scenario: Rejecting a non-empty directory
    Given a directory that already contains files
    When the user picks that directory as the location
    Then the location is rejected with a reason
    And the wizard does not allow proceeding

  Scenario: Existing buddy directory is recognized for import
    Given a directory containing an existing buddy instance
    When the user picks that directory as the location
    Then the wizard offers to import the existing instance

  Scenario: The remains of a failed setup are not offered for import
    # createBuddyInstance is not atomic: a failure partway leaves agent_brain/
    # without the identity files. Adopting that produced a broken install
    # (FR-SETUP-12).
    Given a directory left behind by a failed setup
    When the user picks that directory as the location
    Then the wizard reports it as unfinished, not importable

  # Reported from real use, and the dangerous one: the verdict swaps Continue
  # for "Import this assistant", so after an existing-instance result there is
  # no button left that revalidates. Typing a different path changed the box
  # and nothing else, and Import then adopted the *previous* directory — the
  # user only noticed because their new assistant already knew things about
  # them.
  Scenario: Editing the path retires the previous verdict
    Given a directory containing an existing buddy instance
    When the user picks that directory as the location
    Then the wizard offers to import the existing instance
    When the user edits the location text
    Then the wizard no longer offers to import
    And importing is refused while no location has been validated

  # A slow validation for an earlier pick must not overwrite a faster one for
  # a pick made after it. Reported from real use: pick a directory with an
  # existing instance, then pick a fresh empty one — the "import only" state
  # stuck regardless of going back and re-picking, because validateLocation
  # has no ordering guarantee against the location it was called for.
  Scenario: A slow validation for an earlier pick does not overwrite a later one
    Given two candidate locations, one with an existing instance and one empty
    And validating the existing-instance directory is slow to resolve
    When the user picks the existing-instance directory as the location
    And the user picks the empty directory as the location before the first validation resolves
    And the slow validation for the existing-instance directory resolves
    Then the location is stored as the empty directory
    And the wizard allows proceeding to the next step
