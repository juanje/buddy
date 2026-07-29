// src/lib/i18n/index.ts — reactive locale module (NFR-I18N).
// Components import { t } from "./i18n"; setLocale() switches the store.

import { derived, get, writable } from "svelte/store";

import type { SetupConfig } from "../../../shared/api";
import { en, gitInstallInstructionsEn, tierDescriptionEn } from "./en";
import { es, gitInstallInstructionsEs, tierDescriptionEs, type LocaleStrings } from "./es";

/**
 * Derived from the config field rather than restated (NFR-I18N-03).
 *
 * It used to be written out here *and* derived in setup-controller.ts — two
 * declarations of one fact, agreeing by coincidence. Deriving it means adding a
 * language to SetupConfig makes the `locales` record below fail to compile
 * until its locale file exists, which is the requirement.
 */
export type AppLocale = NonNullable<SetupConfig["language"]>;

const locales: Record<AppLocale, LocaleStrings> = { es, en };

function detectSystemLocale(): AppLocale {
  try {
    const lang = (typeof navigator !== "undefined" && navigator.language) || "en";
    return lang.startsWith("es") ? "es" : "en";
  } catch {
    return "en";
  }
}

const locale = writable<AppLocale>(detectSystemLocale());

export const t = derived(locale, ($locale) => locales[$locale]);

export function setLocale(lang: AppLocale): void {
  locale.set(lang);
}

export function getLocale(): AppLocale {
  return get(locale);
}

export function tierDescription(tier: "fast" | "balanced" | "powerful"): string {
  return get(locale) === "en" ? tierDescriptionEn(tier) : tierDescriptionEs(tier);
}

export function gitInstallInstructions(platform: string): string {
  return get(locale) === "en"
    ? gitInstallInstructionsEn(platform)
    : gitInstallInstructionsEs(platform);
}

export type { LocaleStrings };
