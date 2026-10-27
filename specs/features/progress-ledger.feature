# NFR-TEST-03 — What is built is recorded only by a check that verified it

Feature: The progress record holds only verified work
  As the person who owns Buddy's contract
  I want what is built to be recorded only after a check has verified it
  So that "built" always means the work was tested first and passes

  Background:
    Given a project with a contract commit for FR-DEMO-01 and its scenario "A greeting is shown"

  @NFR-TEST-03
  Scenario: Work done Outside-In is recorded as built
    Given FR-DEMO-01's step definitions committed alone, failing on an assertion
    And a unit test committed alone, failing on an assertion
    And the code committed after them, making the scenario and the gate pass
    When I check FR-DEMO-01
    Then the check succeeds
    And the status shows FR-DEMO-01 as built at the current commit

  @NFR-TEST-03
  Scenario: An FR whose contract is committed and not verified is in progress
    When I ask for the status
    Then the status shows FR-DEMO-01 as in progress

  @NFR-TEST-03
  Scenario: A contract change after verification shows the FR as changed
    Given FR-DEMO-01 was verified as built
    And a later contract commit for FR-DEMO-01
    When I ask for the status
    Then the status shows FR-DEMO-01 as changed since its verification

  @NFR-TEST-03
  Scenario Outline: Work not done Outside-In is refused and nothing is recorded
    Given FR-DEMO-01's work where <situation>
    When I check FR-DEMO-01
    Then the check fails with an error that says <what is missing>
    And the error names <the commit>
    And the error says how to make it hold
    And the status still shows FR-DEMO-01 as in progress

    Examples:
      | situation                                     | what is missing                          | the commit                  |
      | the code was committed before any test        | the code came before its test            | the code commit             |
      | a unit test passed at its own commit          | the test passed before its code          | the test commit             |
      | the scenario passed before the first code     | the scenario passed before its code      | the commit before the code  |
      | a test commit also changes production code    | the test commit changes production code  | the test commit             |
      | no test was committed                         | there is no test commit                  | the contract commit         |
      | a step was undefined before the first code    | the scenario never ran before its code   | the commit before the code  |
      | a test passed at its commit and its message mentions mutants without a Mutant trailer naming it | the test passed before its code | the test commit |

  @NFR-TEST-03
  Scenario Outline: A test that fails because its code does not exist yet counts as failing first
    Given FR-DEMO-01's work where the unit test failed at its commit because <missing>
    And the code committed after it, making the scenario and the gate pass
    When I check FR-DEMO-01
    Then the check succeeds

    Examples:
      | missing                                  |
      | the function it calls did not exist yet  |
      | the module it imports did not exist yet  |

  @NFR-TEST-03
  Scenario: A test that a later commit replaces still counts once it passed with its code
    Given FR-DEMO-01's work done Outside-In
    And a later test commit that replaces its unit test with one for new code
    And the code for the new test committed after it
    When I check FR-DEMO-01
    Then the check succeeds

  @NFR-TEST-03
  Scenario: A row added to an outline must fail before its code
    Given FR-DEMO-01 was verified as built with an outline of one row
    And a later contract commit adds a second row to that outline
    And the second row passed before any code for it
    When I check FR-DEMO-01
    Then the check fails with an error that names the added row and says it passed before its code
    And the status still shows FR-DEMO-01 as changed since its verification

  @NFR-TEST-03
  Scenario: A scenario that a later contract commit removes still verifies
    Given FR-DEMO-01's work done Outside-In
    And a later contract commit removes one of its scenarios
    When I check FR-DEMO-01
    Then the check succeeds

  @NFR-TEST-03
  Scenario: A test proved by a mutant counts as failing first
    Given FR-DEMO-01's work where the scenario passed before the first code
    And its test commit has a Mutant trailer naming the scenario
    And the scenario and the gate pass now
    When I check FR-DEMO-01
    Then the check succeeds

  @NFR-TEST-03
  Scenario: Work that breaks anything else in the project is refused
    Given FR-DEMO-01's work done Outside-In
    But a scenario of another FR fails now
    When I check FR-DEMO-01
    Then the check fails with an error that shows the failing lines of the quality gate
    And the status still shows FR-DEMO-01 as in progress

  @NFR-TEST-03
  Scenario: An FR with no contract commit is refused
    When I check FR-DEMO-02
    Then the check fails with an error that says FR-DEMO-02 has no contract commit
    And the error says to ask the person for its approved contract

  @NFR-TEST-03
  Scenario Outline: An argument that is not an FR id is refused before anything runs
    When I check "<argument>"
    Then the check fails with an error that says the argument is not an FR id
    And no test or command was run

    Examples:
      | argument          |
      | ../specs          |
      | FR-DEMO-01; ls    |
      | --upload-pack=x   |

  @NFR-TEST-03
  Scenario: A contract commit older than the record is history, not open work
    Given a contract commit for FR-OLD-02 made before the record started
    And FR-OLD-01 recorded as built before the checks existed
    And a contract commit for FR-NEW-01 after that
    When I ask for the status
    Then the status does not show FR-OLD-02
    And the status shows FR-NEW-01 as in progress

  @NFR-TEST-03
  Scenario: FRs built before the check are shown as recorded before the checks
    Given FR-OLD-01 recorded as built before the checks existed
    When I ask for the status
    Then the status shows FR-OLD-01 as built, recorded before the checks

  @NFR-TEST-03
  Scenario: Reading the status changes nothing
    When I ask for the status
    And I show FR-DEMO-01
    Then the progress record is unchanged
    And no test or command was run

  @NFR-TEST-03
  Scenario: Help names the commands as they are typed
    When I ask the progress command for help
    Then it lists status, show and check, each as "npm run progress -- <command>"
