import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { finite } from '../shared/spatial-state';
import type { HAState } from '../shared/models';
import { kindOf, stateLabel, type Kind } from './entities';
import type { Hass } from './ha/client';
import { LanguageController, locale, tr } from './i18n';
import { mpIcon } from './icons';
import { defineElement } from './registry';

/** One state Home Assistant kept, whatever shape its recorder sends it in. */
export interface HistoryRow { at: number; state: string; attributes: Record<string, unknown> }
/** A reading drawn as a curve. */
export interface HistoryPoint { at: number; value: number }
/** A state held from `start` to `end`, drawn as a band of the timeline. */
export interface HistorySegment { start: number; end: number; state: string }

const time = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e11 ? value : value * 1000;
  if (typeof value === 'string') { const parsed = Date.parse(value); return Number.isNaN(parsed) ? undefined : parsed; }
  return undefined;
};
/**
 * The states of one entity, read from the answer of `history/history_during_period`: Home Assistant compresses them
 * (`s` state, `a` attributes, `lu` last updated, `lc` last changed), and older versions spell them out. Anything
 * without a readable date is left out rather than placed at an invented moment.
 */
export function historyRows(answer: unknown, entityId: string): HistoryRow[] {
  const list = (answer as Record<string, unknown> | undefined)?.[entityId];
  if (!Array.isArray(list)) return [];
  return list.flatMap(raw => {
    const row = raw as Record<string, unknown>;
    const at = time(row.lu ?? row.last_updated ?? row.lc ?? row.last_changed);
    const state = row.s ?? row.state;
    if (at === undefined || typeof state !== 'string') return [];
    const attributes = (row.a ?? row.attributes) as Record<string, unknown> | undefined;
    return [{ at, state, attributes: attributes && typeof attributes === 'object' ? attributes : {} }];
  }).sort((a, b) => a.at - b.at);
}
/** Readings drawn as a curve: the state itself, or an attribute of it such as the temperature a thermostat measures. */
export function historyPoints(rows: HistoryRow[], attribute?: string): HistoryPoint[] {
  return rows.flatMap(row => {
    const value = finite(attribute ? row.attributes[attribute] : row.state);
    return value === undefined ? [] : [{ at: row.at, value }];
  });
}
/** States held one after the other, identical neighbours merged, the last one running to `end`. */
export function historySegments(rows: HistoryRow[], start: number, end: number): HistorySegment[] {
  const segments: HistorySegment[] = [];
  for (const row of rows) {
    const at = Math.max(row.at, start);
    if (at > end) break;
    const last = segments.at(-1);
    if (last?.state === row.state) continue;
    if (last) last.end = at;
    segments.push({ start: at, end, state: row.state });
  }
  return segments.filter(segment => segment.end > segment.start);
}
/** The lowest and highest readings, with a little room above and below so a flat curve is not a line on the edge. */
export function curveRange(points: HistoryPoint[]): [low: number, high: number] {
  const values = points.map(point => point.value);
  const low = Math.min(...values), high = Math.max(...values);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [0, 1];
  const margin = high - low < 1e-6 ? Math.max(Math.abs(high) * .05, .5) : (high - low) * .15;
  return [low - margin, high + margin];
}
/** The path of the curve in a 100 × 100 box, and the same path closed under itself for the shade below it. */
export function curvePath(points: HistoryPoint[], start: number, end: number, low: number, high: number) {
  const span = Math.max(end - start, 1), height = Math.max(high - low, 1e-6);
  const x = (at: number) => (Math.min(Math.max(at, start), end) - start) / span * 100;
  const y = (value: number) => 100 - (value - low) / height * 100;
  const steps = points.map(point => `${x(point.at).toFixed(2)} ${y(point.value).toFixed(2)}`);
  if (!steps.length) return { line: '', area: '' };
  const line = `M${steps.join(' L')}`;
  return { line, area: `${line} L100 100 L0 100 Z` };
}

/** What a state says at a glance on the timeline: warm for what is on, accent for what is open, grey for the rest. */
export function stateTone(kind: Kind, state: string): string {
  if (['unavailable', 'unknown'].includes(state)) return 'rgba(190,210,230,.16)';
  if (kind === 'climate') return ({ heat: '#ff9a5c', cool: '#5cd8ff', dry: '#b08cff', fan_only: '#71d7c0', heat_cool: '#ffd45c', auto: '#ffd45c' } as Record<string, string>)[state] ?? 'rgba(190,210,230,.22)';
  if (kind === 'media') return ['playing', 'on', 'buffering'].includes(state) ? '#c3a6ff' : state === 'paused' ? 'rgba(195,166,255,.45)' : 'rgba(190,210,230,.22)';
  if (kind === 'cover' || kind === 'opening') return ['open', 'opening'].includes(state) || state === 'on' ? '#8ff0c8' : 'rgba(190,210,230,.22)';
  if (kind === 'light') return state === 'on' ? '#ffc540' : 'rgba(190,210,230,.22)';
  return state === 'on' || state === 'locked' || state === 'home' ? 'var(--accent,#69b7ff)' : 'rgba(190,210,230,.22)';
}

/** Periods the window offers, in hours. */
const PERIODS = [12, 24, 24 * 7] as const;

/**
 * The history of one device, read from the Home Assistant recorder: a curve for what it measures, a band of its states
 * otherwise. It reads and draws, and commands nothing. Without a recorder, it says so instead of showing an empty box.
 */
export class MPGlassHistory extends LitElement {
  static properties = { hass:{attribute:false}, entity:{attribute:false}, hours:{state:true}, rows:{state:true}, status:{state:true}, cursor:{state:true} };
  static styles = css`
    :host{display:block;--line:rgba(206,230,255,.18)}
    *{box-sizing:border-box}
    .head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .head p{margin:0;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#bed4e8}
    .periods{display:flex;gap:4px;margin-left:auto;padding:3px;border-radius:12px;border:1px solid var(--line);background:rgba(4,20,35,.4)}
    .periods button{min-height:28px;padding:0 10px;border:0;border-radius:9px;background:transparent;color:#bed4e8;font:inherit;font-size:11px;cursor:pointer;transition:background .18s ease,color .18s ease}
    .periods button[aria-pressed=true]{color:#fff;background:color-mix(in srgb,var(--accent,#69b7ff) 32%,transparent)}
    .periods button:focus-visible{outline:2px solid var(--accent,#69b7ff);outline-offset:2px}
    .plot{position:relative;height:118px;border-radius:16px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));overflow:hidden;touch-action:pan-y}
    .plot.band{height:64px}
    svg{display:block;width:100%;height:100%}
    .grid{stroke:rgba(206,230,255,.12);stroke-width:1;vector-effect:non-scaling-stroke}
    .curve{fill:none;stroke:var(--accent,#69b7ff);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--accent,#69b7ff) 45%,transparent))}
    .curve.target{stroke:#ffc540;stroke-dasharray:3 3;filter:none;opacity:.85}
    .area{fill:url(#mp-history-fill);stroke:none}
    .cursor-line{stroke:#ffffff88;stroke-width:1;vector-effect:non-scaling-stroke}
    .dot{fill:#fff;stroke:var(--accent,#69b7ff);stroke-width:2.5}
    .bounds{position:absolute;inset:8px 10px auto auto;text-align:right;font-size:10px;color:#8fa5b9;text-shadow:0 1px 5px rgba(2,10,20,.95);pointer-events:none}
    .bounds b{display:block;color:#cfe0ef;font-weight:600}
    .read{position:absolute;top:8px;left:10px;font-size:11px;color:#eef6ff;text-shadow:0 1px 5px rgba(2,10,20,.95);pointer-events:none}
    .read small{display:block;color:#8fa5b9;font-size:10px}
    .band-row{display:flex;height:100%;width:100%;padding:14px 10px}
    .band-row>span{height:100%;min-width:1px}
    .band-row>span:first-child{border-radius:7px 0 0 7px}
    .band-row>span:last-child{border-radius:0 7px 7px 0}
    .band-row>span:only-child{border-radius:7px}
    .axis{display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:#8fa5b9}
    .legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:9px;font-size:11px;color:#cfe0ef}
    .legend span{display:inline-flex;align-items:center;gap:6px}
    .legend i{width:9px;height:9px;border-radius:3px;flex:0 0 auto}
    .legend small{color:#8fa5b9}
    .note{margin:0;padding:18px 12px;text-align:center;font-size:12px;color:#8fa5b9}
    .note .mp-icon{display:block;margin:0 auto 8px;color:#6f8599}
    @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;
  hass?: Hass;
  entity = '';
  private hours: number = PERIODS[1];
  private rows: HistoryRow[] = [];
  private status: 'loading'|'ready'|'error' = 'loading';
  /** Moment the pointer rests on, read on the curve; none when it is away. */
  private cursor?: number;
  /** Start of the period drawn, kept still while the answer is read so the curve and its axis agree. */
  private from = 0;
  private until = 0;
  /** The request being answered: a later period, or another device, drops the one before it. */
  private asked = 0;
  private language = new LanguageController(this);

  protected updated(changed: PropertyValues) {
    if (changed.has('entity') || changed.has('hours')) void this.read();
  }
  /** The states Home Assistant kept over the period; a recorder that is off or refuses says so in one line. */
  private async read() {
    const hass = this.hass, entity = this.entity;
    if (!hass || !entity) return;
    const asked = ++this.asked;
    this.status = 'loading'; this.rows = []; this.cursor = undefined;
    const until = Date.now(), from = until - this.hours * 3_600_000;
    this.from = from; this.until = until;
    try {
      const answer = await hass.callWS<unknown>({
        type: 'history/history_during_period',
        start_time: new Date(from).toISOString(), end_time: new Date(until).toISOString(),
        entity_ids: [entity], include_start_time_state: true, minimal_response: true,
        no_attributes: !this.attribute, significant_changes_only: false,
      });
      if (asked !== this.asked) return;
      this.rows = historyRows(answer, entity);
      this.status = 'ready';
    } catch {
      if (asked === this.asked) this.status = 'error';
    }
  }
  /** The attribute drawn instead of the state, for a thermostat whose state is a mode and whose reading is a temperature. */
  private get attribute() { return kindOf(this.entity, this.hass?.states[this.entity]) === 'climate' ? 'current_temperature' : undefined; }
  private format(value: number, digits = 1) { return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(value); }
  private clock(at: number) {
    // A period of a day or more says which day it is: its two ends would otherwise read the same hour.
    const day = this.hours >= 20;
    return new Intl.DateTimeFormat(locale(), day ? { weekday:'short', hour:'2-digit', minute:'2-digit' } : { hour:'2-digit', minute:'2-digit' }).format(at);
  }
  /** The states of the moment, kept live: the period ends on what Home Assistant reports right now. */
  private get live(): HAState | undefined { return this.hass?.states[this.entity]; }
  private get period() { return { from: this.from, until: this.until }; }
  /** Rows of the period, with the state of this instant at its right edge. */
  private get history(): HistoryRow[] {
    const live = this.live, rows = this.rows;
    if (!live) return rows;
    const last = rows.at(-1);
    return last?.state === live.state && !this.attribute ? rows : [...rows, { at: this.until, state: live.state, attributes: live.attributes }];
  }

  private move = (event: PointerEvent) => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!box.width) return;
    const fraction = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    this.cursor = this.from + fraction * (this.until - this.from);
  };
  private leave = () => { this.cursor = undefined; };

  /** A reading over time: its curve, the setpoint of a thermostat above it, and the value under the finger. */
  private curve(points: HistoryPoint[], target: HistoryPoint[]) {
    const { from, until } = this.period;
    const [low, high] = curveRange([...points, ...target]);
    const path = curvePath(points, from, until, low, high), aim = curvePath(target, from, until, low, high);
    const unit = String(this.live?.attributes.unit_of_measurement ?? (this.attribute ? '°' : ''));
    const at = this.cursor, near = at === undefined ? undefined : points.reduce((best, point) => Math.abs(point.at - at) < Math.abs(best.at - at) ? point : best, points[0]!);
    const x = near === undefined ? 0 : (Math.min(Math.max(near.at, from), until) - from) / Math.max(until - from, 1) * 100;
    const y = near === undefined ? 0 : 100 - (near.value - low) / Math.max(high - low, 1e-6) * 100;
    return html`<div class="plot" @pointermove=${this.move} @pointerleave=${this.leave} @pointercancel=${this.leave}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="mp-history-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent,#69b7ff)" stop-opacity=".34"></stop>
          <stop offset="100%" stop-color="var(--accent,#69b7ff)" stop-opacity="0"></stop>
        </linearGradient></defs>
        <line class="grid" x1="0" y1="50" x2="100" y2="50"></line>
        ${path.area ? svg`<path class="area" d=${path.area}></path>` : nothing}
        ${aim.line ? svg`<path class="curve target" d=${aim.line}></path>` : nothing}
        ${path.line ? svg`<path class="curve" d=${path.line}></path>` : nothing}
        ${near ? svg`<line class="cursor-line" x1=${x} y1="0" x2=${x} y2="100"></line>` : nothing}
      </svg>
      <div class="bounds"><b>${this.format(high)}${unit ? ` ${unit}` : ''}</b>${this.format(low)}${unit ? ` ${unit}` : ''}</div>
      ${near ? html`<div class="read"><b>${this.format(near.value)}${unit ? ` ${unit}` : ''}</b><small>${this.clock(near.at)}</small></div>` : nothing}
      ${near ? html`<span class="point" style=${`position:absolute;left:${x}%;top:${y}%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:#fff;box-shadow:0 0 0 2.5px var(--accent,#69b7ff)`}></span>` : nothing}
    </div>`;
  }

  /** States one after the other: a band of colours, and under it what each colour lasted. */
  private band(segments: HistorySegment[], kind: Kind) {
    const { from, until } = this.period, span = Math.max(until - from, 1);
    const held = new Map<string, number>();
    for (const segment of segments) held.set(segment.state, (held.get(segment.state) ?? 0) + (segment.end - segment.start));
    const order = [...held.entries()].sort((a, b) => b[1] - a[1]);
    return html`<div class="plot band">
      <div class="band-row" role="img" aria-label=${tr('Historique des états')}>
        ${segments.map(segment => html`<span style=${`flex:${(segment.end - segment.start) / span};background:${stateTone(kind, segment.state)}`}
          title=${`${stateLabel(this.entity, { entity_id:this.entity, state:segment.state, attributes:this.live?.attributes ?? {} })} · ${this.clock(segment.start)}`}></span>`)}
      </div>
    </div>
    <div class="legend">${order.map(([state, held_]) => html`<span><i style=${`background:${stateTone(kind, state)}`}></i>${stateLabel(this.entity, { entity_id:this.entity, state, attributes:this.live?.attributes ?? {} })}<small>${this.duration(held_)}</small></span>`)}</div>`;
  }
  /** How long a state was held, in hours and minutes. */
  private duration(span: number) {
    const minutes = Math.round(span / 60_000);
    if (minutes < 60) return tr('{n} min', { n: minutes });
    const hours = Math.floor(minutes / 60);
    return minutes % 60 ? tr('{h} h {m}', { h: hours, m: String(minutes % 60).padStart(2, '0') }) : tr('{n} h', { n: hours });
  }

  protected render() {
    if (!this.entity) return nothing;
    const rows = this.history, kind = kindOf(this.entity, this.live);
    const points = historyPoints(rows, this.attribute);
    const target = this.attribute ? historyPoints(rows, 'temperature') : [];
    const drawable = points.length > 1;
    const segments = historySegments(rows, this.from, this.until);
    return html`
      <div class="head">
        <p>${tr('Historique')}</p>
        <div class="periods" role="group" aria-label=${tr('Période de l’historique')}>
          ${PERIODS.map(hours => html`<button type="button" aria-pressed=${String(hours === this.hours)} @click=${() => { this.hours = hours; }}>${hours < 48 ? tr('{n} h', { n: hours }) : tr('{n} j', { n: hours / 24 })}</button>`)}
        </div>
      </div>
      ${this.status === 'error' ? html`<p class="note">${mpIcon('info', 20)}${tr('Historique indisponible : Home Assistant n’enregistre pas cet équipement.')}</p>`
        : this.status === 'loading' ? html`<p class="note">${tr('Lecture de l’historique…')}</p>`
        : drawable ? this.curve(points, target)
        : segments.length ? this.band(segments, kind)
        : html`<p class="note">${mpIcon('info', 20)}${tr('Rien d’enregistré sur cette période.')}</p>`}
      ${this.status === 'ready' && (drawable || segments.length) ? html`<div class="axis"><span>${this.clock(this.from)}</span><span>${this.clock(this.until)}</span></div>` : nothing}`;
  }
}
defineElement('mp-glass-history', MPGlassHistory);
