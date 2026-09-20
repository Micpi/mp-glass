import { DASHBOARD } from './dashboard';
import { DETAIL } from './detail';
import { EDITOR } from './editor';
import { PLAN } from './plan';
import { STUDIO } from './studio';
import { ZONES } from './zones';

/** Every catalog apart, for the test that checks a French text is translated the same way wherever it appears. */
export const CATALOGS = { DASHBOARD, DETAIL, STUDIO, PLAN, EDITOR, ZONES };
export const CATALOG = { ...DASHBOARD, ...DETAIL, ...STUDIO, ...PLAN, ...EDITOR, ...ZONES };
/** A French text of the interface: `tsc` refuses one missing from the catalog. */
export type MessageKey = keyof typeof CATALOG;
