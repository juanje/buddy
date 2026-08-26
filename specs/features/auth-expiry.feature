Feature: OAuth token expiry detection (FR-AUTH-01)
  As a user with an expired OAuth token
  I want the app to detect this and offer re-login
  So that I can continue using Buddy without manual file edits

  Scenario: Expired OAuth token is detected at boot
    Given the user has an expired OAuth token for "anthropic"
    When the OAuth health check runs at boot
    Then the auth status reports "anthropic" needs re-authentication
    And the stale credential is removed from the auth store

  Scenario: Settings shows re-login option for expired provider
    Given anthropic is marked as needing re-authentication
    When I open settings for auth expiry
    Then settings shows "Token expired" for "anthropic" with a sign-in option

  Scenario: Re-login after expiry restores the provider
    Given anthropic is marked as needing re-authentication
    When I complete OAuth login for "anthropic"
    Then the auth status reports "anthropic" is authenticated
    And models for "anthropic" are available

  Scenario: Auth failure during chat shows inline error card
    Given the chat session is active
    When I send a message and the provider returns auth error "OAuth refresh failed for anthropic"
    Then the chat shows an auth error card with message containing "expired"
    And the auth error card links to settings

  Scenario: Background auth failure surfaces at next boot
    Given a reflect failed with auth error "OAuth refresh failed for anthropic"
    When the app boots after a background auth failure
    Then the chat shows an auth error card before the first prompt
