# specs/features/markdown-safety.feature

Feature: Markdown render safety (NFR-SEC-10)
  As a user
  I want nothing the agent writes or a file contains to become executable markup
  So that content fetched from the web cannot run code inside Buddy

  # Assistant output is attacker-influenced: the agent ingests untrusted web
  # content via fetch_url, and its replies are rendered with {@html}. This is
  # the last defense layer before the DOM.
  #
  # The property under test is "no element or attribute the content author
  # chose survives into the DOM" — checked by parsing the rendered output, not
  # by substring matching. Escaped text may still *read* like markup; that is
  # intended, so an injection attempt stays visible to the user.

  # --- Raw HTML is neutralized (NFR-TEST-01) ---

  Scenario: An image tag with an inline event handler produces no element
    When the assistant writes "<img src=x onerror=\"alert(1)\">"
    Then the rendered markup has no "img" element
    And the rendered markup has no event-handler attributes

  Scenario: A script tag produces no element
    When the assistant writes "<script>alert(1)</script>"
    Then the rendered markup has no "script" element

  Scenario: Inline HTML inside a paragraph produces no element
    When the assistant writes "text with <span onclick=\"x\">span</span>"
    Then the rendered markup has no "span" element
    And the rendered markup has no event-handler attributes

  Scenario: An iframe produces no element
    When the assistant writes "<iframe src=\"https://evil.example\"></iframe>"
    Then the rendered markup has no "iframe" element

  Scenario: An SVG event handler produces no element
    When the assistant writes "<svg onload=\"alert(1)\"></svg>"
    Then the rendered markup has no "svg" element
    And the rendered markup has no event-handler attributes

  Scenario: Neutralized HTML stays visible to the user
    # Escaped rather than dropped, so an injection attempt is something the
    # user can actually notice.
    When the assistant writes "<script>alert(1)</script>"
    Then the rendered HTML shows the escaped text "&lt;script&gt;"

  # --- Code fence language is an injection point too ---

  Scenario: A crafted code fence language produces no element
    When the assistant writes a code block with language "js\"><script>alert(1)</script>"
    Then the rendered markup has no "script" element

  Scenario: A normal code fence language still produces a language class
    When the assistant writes a code block with language "python"
    Then the rendered HTML contains "class=\"language-python\""

  # --- Ordinary markdown keeps working ---

  Scenario: Standard markdown still renders
    When the assistant writes "# Title\n\nSome **bold** text."
    Then the rendered HTML contains "<h1"
    And the rendered HTML contains "<strong>bold</strong>"

  # --- Link handling must survive sanitization (FR-CHAT-09/10 regression) ---

  Scenario: Local links keep their data-local-path marker
    When the assistant writes "[notes](agent_brain/concepts/foo.md)"
    Then the rendered HTML contains "data-local-path=\"agent_brain/concepts/foo.md\""

  Scenario: External links open in the browser with safe rel attributes
    When the assistant writes "[site](https://example.com)"
    Then the rendered HTML contains "target=\"_blank\""
    And the rendered HTML contains "rel=\"noopener noreferrer\""

  Scenario: A javascript URL never becomes a navigable href
    When the assistant writes "[click](javascript:alert(1))"
    Then the rendered markup has no dangerous URL scheme
