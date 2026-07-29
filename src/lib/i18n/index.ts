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

// Not `locale === "en" ? … : …`. The strings table above is a Record keyed by
// AppLocale, so adding a language fails to compile until its file exists — but
// a ternary has no such gap to fall into: it would compile and quietly serve
// Spanish, which is the opposite of what NFR-I18N-03 promises.
const tierDescriptions: Record<AppLocale, (tier: ModelTierName) => string> = {
  es: tierDescriptionEs,
  en: tierDescriptionEn,
};

const gitInstructions: Record<AppLocale, (platform: string) => string> = {
  es: gitInstallInstructionsEs,
  en: gitInstallInstructionsEn,
};

type ModelTierName = "fast" | "balanced" | "powerful";

export function tierDescription(tier: ModelTierName): string {
  return tierDescriptions[get(locale)](tier);
}

export function gitInstallInstructions(platform: string): string {
  return gitInstructions[get(locale)](platform);
}

export type { LocaleStrings };
