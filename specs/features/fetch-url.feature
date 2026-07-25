# FR-NET-01 — URL content fetch (web→markdown, PDF, image)

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
