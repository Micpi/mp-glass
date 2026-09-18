import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { CATALOG, type MessageKey } from './locales';

/**
 * Languages of the MP Glass interface. The French text is the key of every message: the code reads as the interface
 * does, and `tsc` refuses a text missing from the catalog. A key may end with `#context` when one French text has two
 * meanings («Annuler» cancels a window or undoes an edit). `a|b` gives the singular and plural forms, chosen by the
 * `n` parameter: two forms in French and English, three in Russian (1, 2-4, 5 and more).
 */
export type Language = 'fr' | 'en' | 'ru';
/** `auto` follows the language of the user's Home Assistant profile. */
export type LanguageChoice = Language | 'auto';
export const LANGUAGES: Language[] = ['fr', 'en', 'ru'];
/** Each language named in itself, as a language menu shows it. */
export const LANGUAGE_NAMES: Record<Language, string> = { fr: 'Français', en: 'English', ru: 'Русский' };
/** Fired on window when the interface changes language: every MP Glass element draws itself again. */
export const LANGUAGE_EVENT = 'mp-glass-language';
/** This browser's copy of the choice, read before Home Assistant answers. */
const STORAGE_KEY = 'mp-glass.language';
/** The choice kept by Home Assistant for the user, so that all their devices follow it. */
const USER_DATA_KEY = 'mp_glass_language';

interface HassLike {
  language?: string;
  locale?: { language: string };
  connection?: object;
  callWS?<T>(message: Record<string, unknown>): Promise<T>;
}

const isChoice = (value: unknown): value is LanguageChoice => value === 'auto' || LANGUAGES.includes(value as Language);
function storedChoice(): LanguageChoice {
  try { const value = localStorage.getItem(STORAGE_KEY); return isChoice(value) ? value : 'auto'; }
  catch { return 'auto'; }
}

let choice: LanguageChoice = storedChoice();
/** Language tag of the Home Assistant profile, `fr` or `en-GB` for instance. */
let haTag: string | undefined;
let current: Language = resolve();
/** Connection whose saved choice has been read. */
let synced: object | undefined;

/** The language MP Glass speaks for a Home Assistant language: French and Russian as they are, English for the others. */
export function interfaceLanguage(tag?: string): Language {
  const value = (tag ?? '').toLowerCase();
  return !value || value.startsWith('fr') ? 'fr' : value.startsWith('ru') ? 'ru' : 'en';
}
function resolve(): Language { return choice === 'auto' ? interfaceLanguage(haTag) : choice; }
export const language = () => current;
export const languageChoice = () => choice;
/** What `auto` gives now, to show beside it in the menu. */
export const automaticLanguage = () => interfaceLanguage(haTag);
/** Locale of numbers and dates: that of Home Assistant when it speaks the same language (en-GB keeps its dates), else the language. */
export function locale(): string { return haTag?.toLowerCase().startsWith(current) ? haTag : current; }

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LANGUAGE_EVENT));
}
function refresh(force = false) {
  const next = resolve();
  if (next === current && !force) return;
  current = next;
  announce();
}
function keep(value: LanguageChoice) {
  choice = value;
  try { if (value === 'auto') localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, value); }
  catch { /* Storage blocked: the choice holds for this page, and in Home Assistant. */ }
  refresh(true);
}

/** Takes the language of the user's profile, and once per connection the choice Home Assistant keeps for them. */
export function followHass(hass?: HassLike) {
  if (!hass) return;
  const tag = hass.locale?.language ?? hass.language;
  if (tag && tag !== haTag) { haTag = tag; refresh(); }
  if (hass.callWS && hass.connection && synced !== hass.connection) {
    synced = hass.connection;
    void hass.callWS<{ value?: unknown } | null>({ type: 'frontend/get_user_data', key: USER_DATA_KEY })
      .then(answer => { const value = answer?.value; if (isChoice(value) && value !== choice) keep(value); })
      .catch(() => { /* Older Home Assistant, or offline: this browser's choice stands. */ });
  }
}

/** The language chosen in the Studio: at once in this browser, then on the user's other devices through Home Assistant. */
export function chooseLanguage(value: LanguageChoice, hass?: HassLike) {
  keep(value);
  void hass?.callWS?.({ type: 'frontend/set_user_data', key: USER_DATA_KEY, value }).catch(() => { /* Kept in this browser only. */ });
}

/** Draws its element again when the language changes, and hands it the Home Assistant language it receives. */
export class LanguageController implements ReactiveController {
  constructor(private host: ReactiveControllerHost & { hass?: HassLike }) { host.addController(this); }
  private changed = () => this.host.requestUpdate();
  hostConnected() { window.addEventListener(LANGUAGE_EVENT, this.changed); }
  hostDisconnected() { window.removeEventListener(LANGUAGE_EVENT, this.changed); }
  hostUpdate() { followHass(this.host.hass); }
}

type Params = Record<string, string | number>;
const CONTEXT = /#[a-z-]+$/;
const rules = new Map<Language, Intl.PluralRules>();
/** Index of the form of `a|b|c` for `n`: one, then other (French, English), or one, few, many (Russian). */
function form(n: number, forms: number) {
  let rule = rules.get(current);
  if (!rule) { rule = new Intl.PluralRules(current); rules.set(current, rule); }
  const kind = rule.select(n);
  const index = kind === 'one' ? 0 : current === 'ru' && kind === 'many' ? 2 : 1;
  return Math.min(index, forms - 1);
}
function format(text: string, params?: Params) {
  let out = text;
  if (out.includes('|')) { const forms = out.split('|'); out = forms[form(Number(params?.n ?? 0), forms.length)]!; }
  return params ? out.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match) : out;
}
/** The message in the interface language, its `{name}` parameters filled in. */
export function tr(key: MessageKey, params?: Params): string {
  return format(current === 'fr' ? key.replace(CONTEXT, '') : CATALOG[key][current === 'en' ? 0 : 1], params);
}
/** A text that may be a message (a name MP Glass gave, a note of Home Assistant); any other text stays as it is. */
export function trText(text: string, params?: Params): string {
  return text in CATALOG ? tr(text as MessageKey, params) : format(text, params);
}
interface PlanNames { floors: { name: string; rooms: { name: string }[] }[] }
/**
 * A plan MP Glass drew itself, in the interface language: every name of its example; in the plan of the Home Assistant
 * areas, only the names MP Glass gave (a main floor, a room without a name), the areas and floors keeping theirs.
 */
export function trPlan<P extends PlanNames>(plan: P, example = false): P {
  const name = (text: string, own: boolean) => example || own ? trText(text) : text;
  return { ...plan, floors: plan.floors.map(floor => ({ ...floor, name: name(floor.name, floor.name === 'Niveau principal'),
    rooms: floor.rooms.map(room => ({ ...room, name: name(room.name, room.name === 'Pièce') })) })) };
}
/** A default text of the project shown in the interface language, until it is changed; the user's own text as it is. */
export function trDefault(value: string | undefined, fallback: MessageKey): string {
  return value === undefined || value === fallback ? tr(fallback) : value;
}
