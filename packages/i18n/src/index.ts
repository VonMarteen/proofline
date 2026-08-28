export const SUPPORTED_LOCALES = ["es", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export function isLocale(value: string): value is Locale { return (SUPPORTED_LOCALES as readonly string[]).includes(value); }
export function normalizeLocale(value?: string): Locale { return value && isLocale(value) ? value : "es"; }
export function alternateLocale(locale: Locale): Locale { return locale === "es" ? "en" : "es"; }
export function localeName(locale: Locale): string { return locale === "es" ? "Español" : "English"; }
