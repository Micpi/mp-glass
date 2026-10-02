/** Messages keyed by their French text: the English, then the Russian translation. See frontend/i18n.ts. */
/** Existing full catalogs pair English and Russian; German and Italian are layered in locales/de.ts and locales/it.ts. */
export type Messages = Record<string, readonly [en: string, ru: string]>;
