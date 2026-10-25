import type { AppearanceConfig } from '../shared/models';

/** Shared by the dashboard, Studio and standalone cards, including their shadow DOM children. */
export function appearanceVariables(a: Partial<AppearanceConfig> = {}): Record<string, string> {
  const accent = a.accent ?? '#69b7ff';
  const rgb = /^#([0-9a-f]{6})$/i.exec(accent)?.[1];
  const channels = rgb ? [0, 2, 4].map(i => parseInt(rgb.slice(i, i + 2), 16) / 255) : [0, 0, 0];
  const luminance = channels.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [ .2126, .7152, .0722 ][i]!, 0);
  const radius = `${a.radius ?? 22}px`, border = String(a.borderStrength ?? .2), shadow = String(a.shadowStrength ?? .35);
  return {
    '--mp-accent': accent,
    '--mp-on-accent': luminance >= .21 ? '#061421' : luminance > .179 ? '#000000' : '#ffffff',
    '--mp-secondary': a.secondaryAccent ?? '#efbd8b',
    '--mp-tint': a.glassTint ?? '#12344f',
    '--mp-opacity': String(a.glassOpacity ?? .62),
    '--mp-blur': `${a.glassBlur ?? 22}px`,
    '--mp-radius': radius, '--mp-glass-radius': radius,
    '--mp-border': border, '--mp-border-strength': border,
    '--mp-shadow': shadow, '--mp-shadow-strength': shadow,
    '--mp-control-background': 'color-mix(in srgb,var(--mp-tint) clamp(0%,calc(var(--mp-opacity) * 68%),100%),transparent)',
    '--mp-control-hover': 'color-mix(in srgb,var(--mp-accent) 12%,var(--mp-control-background))',
    '--mp-control-border': 'color-mix(in srgb,var(--mp-accent) calc(var(--mp-border) * 100%),rgba(213,234,255,.12))',
    '--mp-panel-background': 'linear-gradient(145deg,rgb(from var(--mp-tint) r g b / var(--mp-opacity)),rgba(6,20,33,.96))',
    '--mp-primary-background': 'var(--mp-accent)',
    '--mp-display-font': a.fontStyle === 'modern' ? 'Inter,system-ui,sans-serif' : a.fontStyle === 'soft' ? 'ui-rounded,system-ui,sans-serif' : 'Georgia,serif',
  };
}

export function applyAppearance(host: HTMLElement, appearance?: Partial<AppearanceConfig>) {
  for (const [name, value] of Object.entries(appearanceVariables(appearance))) host.style.setProperty(name, value);
  host.toggleAttribute('motion', appearance?.motion !== false);
}
