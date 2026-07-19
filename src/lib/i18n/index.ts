// src/lib/i18n/index.ts — reactive locale module (NFR-I18N).
// Components import { t } from "./i18n"; setLocale() switches the store.

import { derived, get, writable } from "svelte/store";
import { en, gitInstallInstructionsEn, tierDescriptionEn } from "./en";
import { es, gitInstallInstructionsEs, tierDescriptionEs, type LocaleStrings } from "./es";

export type AppLocale = "es" | "en";

const locales: Record<AppLocale, LocaleStrings> = { es, en };

const locale = writable<AppLocale>("es");

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
