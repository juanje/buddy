# specs/features/shell-menu-linux.feature — FR-SHELL-07/08/09 Linux native menu polish.

Feature: Linux native menu polish (FR-SHELL-07/08/09)
  As a Linux user
  I want a polished native menu bar
  So that About shows the app icon, empty menus are hidden, and labels match my language

  Scenario: About dialog embeds the app icon (FR-SHELL-07)
    Given the Rust shell Cargo.toml is present
    Then the Tauri image-png feature is enabled
    And main.rs embeds the About dialog icon via include_bytes

  Scenario: Window submenu is hidden on Linux (FR-SHELL-08)
    Given the Rust shell main.rs is present
    Then the Window submenu is cfg-gated for non-Linux platforms

  Scenario: Native menu labels are translated (FR-SHELL-09)
    Given the Rust shell main.rs is present
    Then main.rs defines a menu label translation table for es and en
    And main.rs detects language from config and system locale
