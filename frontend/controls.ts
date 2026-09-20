import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { mpIcon, type MPIconName } from './icons';
import { LanguageController, locale, tr } from './i18n';
import { defineElement } from './registry';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const settle = (value: number, step: number, min: number) => step > 0 ? min + Math.round((value - min) / step) * step : value;
const decimals = (step: number) => step >= 1 ? 0 : String(step).split('.')[1]?.length ?? 1;

/** Where the dial starts and how far it turns, in degrees of the screen: the gap sits at the bottom. */
export const DIAL_START = 135, DIAL_SWEEP = 270;
/** The point of the dial at `angle`, on a circle of radius `r` around (`cx`, `cy`). */
const point = (cx: number, cy: number, r: number, angle: number) => [cx + r * Math.cos(angle * Math.PI / 180), cy + r * Math.sin(angle * Math.PI / 180)] as const;
/** The arc of the dial from one angle to another, clockwise. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = point(cx, cy, r, from), [x2, y2] = point(cx, cy, r, Math.min(to, from + DIAL_SWEEP));
  if (Math.abs(to - from) < .01) return '';
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
/**
 * How far round the dial a touch is, from the centre of the dial to the finger: 0 at the start, 1 at the end. A touch
 * in the gap at the bottom takes the nearer end, so a finger sliding past it stops instead of jumping across.
 */
export function dialFraction(dx: number, dy: number) {
  const offset = (Math.atan2(dy, dx) * 180 / Math.PI - DIAL_START + 720) % 360;
  if (offset > DIAL_SWEEP) return offset > (DIAL_SWEEP + 360) / 2 ? 0 : 1;
  return offset / DIAL_SWEEP;
}

/**
 * A control dragged with a finger, which tells its page only once the finger is lifted: the value shown follows the
 * touch, and holds until Home Assistant answers with the state it really reached.
 */
abstract class MPGlassControl extends LitElement {
  value = 0;
  min = 0;
  max = 100;
  step = 1;
  label = '';
  disabled = false;
  /** The value under the finger, while it commands nothing yet. */
  protected draft?: number;
  /** Released, and Home Assistant has not answered yet: the value held on screen, dropped after a moment either way. */
  private waiting?: ReturnType<typeof setTimeout>;
  protected language = new LanguageController(this);
  protected get shown() { return clamp(this.draft ?? this.value, this.min, this.max); }
  protected get fraction() { return this.max > this.min ? (this.shown - this.min) / (this.max - this.min) : 0; }
  disconnectedCallback() { clearTimeout(this.waiting); super.disconnectedCallback(); }
  protected updated(changed: PropertyValues) { if (changed.has('value')) { clearTimeout(this.waiting); this.draft = undefined; } }
  /** Follows the finger without commanding anything. */
  protected hold(value: number) { if (!this.disabled) this.draft = settle(clamp(value, this.min, this.max), this.step, this.min); }
  /** Commands the value reached, and keeps it on screen until the state comes back. */
  protected commit(value?: number) {
    if (this.disabled) return;
    const next = settle(clamp(value ?? this.shown, this.min, this.max), this.step, this.min);
    this.draft = next;
    clearTimeout(this.waiting);
    this.waiting = setTimeout(() => { this.draft = undefined; }, 4000);
    this.dispatchEvent(new CustomEvent('mp-control-change', { detail: { value: next }, bubbles: true, composed: true }));
  }
  /** Arrows move by one step, page keys by ten, Home and End to the ends. */
  protected keys = (event: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowUp: this.step, ArrowRight: this.step, ArrowDown: -this.step, ArrowLeft: -this.step, PageUp: this.step * 10, PageDown: -this.step * 10 };
    const move = keys[event.key];
    if (move !== undefined) this.commit(this.shown + move);
    else if (event.key === 'Home') this.commit(this.min);
    else if (event.key === 'End') this.commit(this.max);
    else return;
    event.preventDefault();
  };
  protected format(value: number) { return new Intl.NumberFormat(locale(), { minimumFractionDigits: decimals(this.step), maximumFractionDigits: decimals(this.step) }).format(value); }
}

/**
 * The bar of the detail window: horizontal for a light, vertical for a shutter or fan. It follows the finger over its
 * full length and answers the keyboard like any slider.
 */
export class MPGlassBar extends MPGlassControl {
  static properties = { value:{type:Number}, min:{type:Number}, max:{type:Number}, step:{type:Number}, label:{type:String}, unit:{type:String}, icon:{type:String}, tone:{type:String,reflect:true}, horizontal:{type:Boolean,reflect:true}, disabled:{type:Boolean,reflect:true}, draft:{state:true} };
  static styles = css`
    :host{display:block;--tone:var(--mp-accent,#69b7ff);--face:#0a2338}
    :host([tone=warm]){--tone:#ffc540}
    :host([tone=cool]){--tone:var(--mp-accent,#69b7ff)}
    :host([disabled]){opacity:.5}
    .bar{position:relative;display:block;width:100%;height:100%;min-height:180px;border-radius:26px;border:1px solid rgba(206,230,255,.18);background:rgba(4,20,35,.55);overflow:hidden;cursor:ns-resize;touch-action:none;user-select:none;-webkit-user-select:none}
    :host([horizontal]) .bar{min-height:0;cursor:ew-resize}
    :host([disabled]) .bar{cursor:default}
    .bar:focus-visible{outline:3px solid var(--tone);outline-offset:3px}
    .fill{position:absolute;inset:auto 0 0;background:linear-gradient(180deg,color-mix(in srgb,var(--tone) 92%,white),var(--tone));box-shadow:0 -6px 26px color-mix(in srgb,var(--tone) 45%,transparent);transition:height .18s ease}
    :host([horizontal]) .fill{inset:0 auto 0 0;background:linear-gradient(90deg,color-mix(in srgb,var(--tone) 92%,white),var(--tone));box-shadow:6px 0 26px color-mix(in srgb,var(--tone) 45%,transparent);transition:width .18s ease}
    .face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:16px 10px;pointer-events:none}
    :host([horizontal]) .face{flex-direction:row;padding:10px 20px}
    .face .mp-icon{color:#eaf4ff;filter:drop-shadow(0 1px 3px rgba(0,8,18,.6))}
    .face b{font:19px/1 var(--mp-display-font,Georgia,serif);font-weight:400;color:#fff;text-shadow:0 1px 6px rgba(0,8,18,.7)}
    /* Over the filled part, ink instead of white: the reading stays legible on a bright bar. */
    .face.ink b{color:var(--face);text-shadow:none}
    .face.ink-top .mp-icon{color:var(--face);filter:none}
    @media (prefers-reduced-motion:reduce){.fill{transition:none}}
  `;
  unit = '%';
  icon: MPIconName = 'sun';
  tone: 'warm'|'cool' = 'cool';
  horizontal = false;
  private from = (event: PointerEvent) => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (this.horizontal) return box.width ? this.min + clamp((event.clientX - box.left) / box.width, 0, 1) * (this.max - this.min) : this.shown;
    if (!box.height) return this.shown;
    return this.min + (1 - clamp((event.clientY - box.top) / box.height, 0, 1)) * (this.max - this.min);
  };
  private down = (event: PointerEvent) => {
    if (this.disabled) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.hold(this.from(event));
  };
  private move = (event: PointerEvent) => { if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) this.hold(this.from(event)); };
  private up = (event: PointerEvent) => {
    const bar = event.currentTarget as HTMLElement;
    if (!bar.hasPointerCapture(event.pointerId)) return;
    bar.releasePointerCapture(event.pointerId);
    this.commit(this.from(event));
  };
  protected render() {
    const text = `${this.format(this.shown)}${this.unit ? ` ${this.unit}` : ''}`;
    return html`<div class="bar" role="slider" tabindex=${this.disabled ? -1 : 0} aria-label=${this.label} aria-orientation=${this.horizontal?'horizontal':'vertical'}
      aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${this.shown} aria-valuetext=${text} aria-disabled=${String(this.disabled)}
      @pointerdown=${this.down} @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${this.up} @keydown=${this.keys}>
      <div class="fill" style=${`${this.horizontal?'width':'height'}:${(this.fraction * 100).toFixed(1)}%`}></div>
      <div class=${`face ${this.fraction > (this.horizontal ? .88 : .12) ? 'ink' : ''} ${this.fraction > (this.horizontal ? .12 : .88) ? 'ink-top' : ''}`}>${mpIcon(this.icon, 20)}<b>${text}</b></div>
    </div>`;
  }
}

/**
 * The dial of a thermostat: the setpoint round the circle, what the room really measures in its middle, and a finger
 * turning it. Its two buttons stay the sure way to change the setpoint by one step.
 */
export class MPGlassDial extends MPGlassControl {
  static properties = { value:{type:Number}, min:{type:Number}, max:{type:Number}, step:{type:Number}, label:{type:String}, unit:{type:String}, tone:{type:String}, caption:{type:String}, reading:{type:String}, disabled:{type:Boolean,reflect:true}, draft:{state:true} };
  static styles = css`
    :host{display:block}
    :host([disabled]){opacity:.55}
    .dial{position:relative;width:min(246px,100%);margin:0 auto;aspect-ratio:1;touch-action:none;user-select:none;-webkit-user-select:none}
    svg{display:block;width:100%;height:100%;overflow:visible;cursor:grab}
    :host([disabled]) svg{cursor:default}
    svg:focus-visible{outline:3px solid var(--tone,#69b7ff);outline-offset:6px;border-radius:50%}
    .track{fill:none;stroke:rgba(206,230,255,.14);stroke-width:15;stroke-linecap:round}
    .live{fill:none;stroke:var(--tone,#69b7ff);stroke-width:15;stroke-linecap:round;filter:drop-shadow(0 0 10px color-mix(in srgb,var(--tone,#69b7ff) 55%,transparent))}
    .knob{fill:#fff;stroke:var(--tone,#69b7ff);stroke-width:5}
    .middle{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;pointer-events:none;text-align:center}
    .middle b{font:52px/1 var(--mp-display-font,Georgia,serif);font-weight:400;color:#fff}
    .middle small{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a9bdd0}
    .middle em{font-style:normal;font-size:12px;color:#cfe0ef}
    @media (prefers-reduced-motion:reduce){*{transition:none!important}}
  `;
  unit = '°';
  /** Colour of the arc: the mode the thermostat is in. */
  tone = '#69b7ff';
  /** What the middle says under the setpoint. */
  caption = '';
  /** What the room measures, said under the setpoint. */
  reading = '';
  private turn = (event: PointerEvent) => {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const fraction = dialFraction(event.clientX - (box.left + box.width / 2), event.clientY - (box.top + box.height / 2));
    return this.min + fraction * (this.max - this.min);
  };
  private down = (event: PointerEvent) => {
    if (this.disabled) return;
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
    this.hold(this.turn(event));
  };
  private move = (event: PointerEvent) => { if ((event.currentTarget as SVGElement).hasPointerCapture(event.pointerId)) this.hold(this.turn(event)); };
  private up = (event: PointerEvent) => {
    const dial = event.currentTarget as SVGElement;
    if (!dial.hasPointerCapture(event.pointerId)) return;
    dial.releasePointerCapture(event.pointerId);
    this.commit(this.turn(event));
  };
  protected render() {
    const angle = DIAL_START + this.fraction * DIAL_SWEEP;
    const [kx, ky] = point(100, 100, 84, angle);
    const text = `${this.format(this.shown)} ${this.unit}`;
    return html`<div class="dial" style=${`--tone:${this.tone}`}>
      <svg viewBox="0 0 200 200" role="slider" tabindex=${this.disabled ? -1 : 0} aria-label=${this.label}
        aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${this.shown} aria-valuetext=${text} aria-disabled=${String(this.disabled)}
        @pointerdown=${this.down} @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${this.up} @keydown=${this.keys}>
        <path class="track" d=${arcPath(100, 100, 84, DIAL_START, DIAL_START + DIAL_SWEEP)}></path>
        ${this.fraction > .002 ? svg`<path class="live" d=${arcPath(100, 100, 84, DIAL_START, angle)}></path>` : nothing}
        <circle class="knob" cx=${kx.toFixed(2)} cy=${ky.toFixed(2)} r="9"></circle>
      </svg>
      <div class="middle">
        <b>${this.format(this.shown)}<small style="font-size:22px;letter-spacing:0;text-transform:none">${this.unit}</small></b>
        <small>${this.caption || tr('Consigne')}</small>
        ${this.reading ? html`<em>${this.reading}</em>` : nothing}
      </div>
    </div>`;
  }
}
defineElement('mp-glass-bar', MPGlassBar);
defineElement('mp-glass-dial', MPGlassDial);
