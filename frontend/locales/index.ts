import { DASHBOARD } from './dashboard';
import { DETAIL } from './detail';
import { EDITOR } from './editor';
import { PLAN } from './plan';
import { STUDIO } from './studio';
import { ZONES } from './zones';
import { LAUNDRY } from './laundry';
import { DE } from './de';
import { IT } from './it';

/** Every French-keyed catalog, for tests that check consistent English and Russian translations. */
export const CATALOGS = { DASHBOARD, DETAIL, STUDIO, PLAN, EDITOR, ZONES, LAUNDRY };
export const CATALOG = { ...DASHBOARD, ...DETAIL, ...STUDIO, ...PLAN, ...EDITOR, ...ZONES, ...LAUNDRY };
/** German and Italian translations for the dashboard, device detail and core plan controls; untranslated messages fall back to English. */
type ExtraMessages = Partial<Record<keyof typeof CATALOG, string>>;
export const EXTRA_CATALOGS: Record<'de' | 'it', ExtraMessages> = { de: DE, it: IT };
/** A French text of the interface: `tsc` refuses one missing from the catalog. */
export type MessageKey = keyof typeof CATALOG;
