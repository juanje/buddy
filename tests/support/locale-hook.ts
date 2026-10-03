// tests/support/locale-hook.ts — Force English locale before every BDD scenario.
// Node 21+ exposes navigator.language, which inherits the OS locale. On a
// Spanish system this causes detectSystemLocale() to pick "es", making any
// assertion on English UI strings fail. Pinning "en" here ensures tests pass
// regardless of the host locale; scenarios that need a specific language
// override it with `Given the app language is "<locale>"`.

import { Before } from "@cucumber/cucumber";
import { setLocale } from "../../src/lib/i18n";

Before(function () {
  setLocale("en");
});
