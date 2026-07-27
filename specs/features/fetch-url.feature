# FR-NET-01 — URL content fetch (web→markdown, PDF, image)
# NFR-SEC-12 — SSRF protection
# FR-NET-03 — untrusted content framing

Feature: Fetch URL content
  As a user
  I want the assistant to fetch URLs I share
  So that it can read web pages, PDFs, and images without manual download

  Background:
    Given an initialized buddy git repository
    And fetch_url is available with a mock HTTP client

  Scenario: Fetch HTML page returns markdown and saves file
    When fetch_url is called with "https://example.com/article"
    Then the fetch tool result contains "Article body text"
    And the file "downloads" contains a markdown download for "article"

  Scenario: Fetch PDF returns extracted text and saves file
    When fetch_url is called with "https://example.com/report.pdf"
    Then the fetch tool result contains "Hello from PDF"
    And the file "downloads" contains a pdf download

  Scenario: Fetch image saves file and returns vision metadata
    When fetch_url is called with "https://example.com/photo.png"
    Then the fetch tool result contains "downloads/"
    And the fetch tool result contains "photo.png"
    And the fetch details include image data

  Scenario: Fetch 404 returns a clear error
    When fetch_url is called with "https://example.com/missing"
    Then the fetch tool result contains "HTTP 404"

  Scenario: Fetch timeout returns a clear error
    When fetch_url is called with "https://example.com/slow"
    Then the fetch tool result contains "timed out"

  Scenario: Fetch oversize response returns a clear error
    When fetch_url is called with "https://example.com/huge"
    Then the fetch tool result contains "exceeds"

  Scenario: Downloads directory is created on first use
    Given the buddy downloads directory does not exist
    When fetch_url is called with "https://example.com/article"
    Then the directory "downloads" exists

  # --- NFR-SEC-12: the local network is not reachable (NFR-TEST-01) ---
  # fetch_url is the only tool that leaves the machine, and the URL comes from
  # the agent, whose context is shaped by pages it already fetched.

  Scenario Outline: Requests to the local network are refused
    When fetch_url is called with "<url>"
    Then the fetch is refused as unsafe
    And no HTTP request is made

    Examples:
      | url                                     |
      | http://localhost:8080/admin             |
      | http://127.0.0.1/                       |
      | http://[::1]/                           |
      | http://0.0.0.0/                         |
      | http://10.0.0.5/                        |
      | http://192.168.1.1/                     |
      | http://172.16.0.1/                      |
      | http://169.254.169.254/latest/meta-data |

  Scenario: A hostname resolving to a loopback address is refused
    # The denylist has to act on the resolved address, not the spelling.
    Given the host "sneaky.example.com" resolves to "127.0.0.1"
    When fetch_url is called with "https://sneaky.example.com/"
    Then the fetch is refused as unsafe

  Scenario: A non-HTTP scheme is refused
    When fetch_url is called with "file:///etc/passwd"
    Then the fetch is refused as unsafe
    And no HTTP request is made

  Scenario: A redirect into the local network is refused
    # Validating only the first URL is not enough — the check has to run again
    # on every hop.
    Given "https://example.com/redirect" redirects to "http://169.254.169.254/"
    When fetch_url is called with "https://example.com/redirect"
    Then the fetch is refused as unsafe

  Scenario: A redirect to a public address is followed
    Given "https://example.com/redirect-ok" redirects to "https://example.com/article"
    When fetch_url is called with "https://example.com/redirect-ok"
    Then the fetch tool result contains "Article body text"

  Scenario: An endless redirect chain is refused
    Given "https://example.com/loop" redirects to "https://example.com/loop"
    When fetch_url is called with "https://example.com/loop"
    Then the fetch tool result contains "redirect"

  Scenario: An endless response body is refused instead of buffered
    # The cap used to be applied after awaiting arrayBuffer(), so a server that
    # omits content-length could make the worker buffer without bound. The
    # response here never ends: this scenario can only pass if the read stops.
    When fetch_url is called with "https://example.com/endless"
    Then the fetch tool result contains "exceeds"

  # --- FR-NET-03: fetched content is data, never instructions ---

  Scenario: Fetched page content is framed as untrusted
    When fetch_url is called with "https://example.com/article"
    Then the fetch tool result marks the content as untrusted
    And the fetch tool result states the content is not instructions
