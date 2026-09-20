import { html } from 'lit';

const icons = {
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.5"/>',
  home: '<path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/>',
  bulb: '<path d="M9 18h6m-5 3h4m-7.5-9.5a5.5 5.5 0 1 1 11 0c0 2.1-1.15 3.35-2.35 4.55-.58.58-.9 1.19-.98 1.95H9.83c-.08-.76-.4-1.37-.98-1.95C7.65 14.85 6.5 13.6 6.5 11.5Z"/>',
  rooms: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
  layers: '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
  sparkle: '<path d="m12 2 1.2 4.1L17 8l-3.8 1.9L12 14l-1.2-4.1L7 8l3.8-1.9zM5 14l.8 2.7L8.5 18l-2.7 1.3L5 22l-.8-2.7L1.5 18l2.7-1.3zM19 13l.65 2.1L22 16l-2.35.9L19 19l-.65-2.1L16 16l2.35-.9z"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.5 1.5 0 0 1 0-3H15A6 6 0 0 0 21 8.5C21 5.5 17 3 12 3Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="15" cy="7" r="1"/>',
  tune: '<path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M7 14v6"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m8 0h3a1 1 0 0 0 1-1v-3"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  power: '<path d="M12 2v10M6.35 5.65a8 8 0 1 0 11.3 0"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  sliders: '<path d="M4 6h7m4 0h5M4 12h3m4 0h9M4 18h9m4 0h3"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  shield: '<path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6z"/><path d="m9 12 2 2 4-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon: '<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  target: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  plan: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 11H11V3.5M11 11v4.5M15 11h5.5"/>',
  walls: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>',
  sofa: '<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM6 18v2M18 18v2"/>',
  bed: '<path d="M3 6v14M3 16h18M21 20v-7a3 3 0 0 0-3-3h-8v6"/><circle cx="6.5" cy="12.2" r="1.7"/>',
  kitchen: '<path d="M4 10h16v6.5a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5zM2 10h20M9 7c0-1.2.9-1.6.9-3M13.5 7c0-1.2.9-1.6.9-3"/>',
  bath: '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V5.5A2.5 2.5 0 0 1 8.5 3c1.2 0 2.1.8 2.4 1.9M7 20l-1 2M17 20l1 2"/>',
  desk: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="14.5" cy="12" r=".9"/>',
  car: '<path d="M4 17v-5l2.2-5.2A1.2 1.2 0 0 1 7.3 6h9.4a1.2 1.2 0 0 1 1.1.8L20 12v5M3 12h18v5H3zM6 17v2M18 17v2"/><circle cx="7.5" cy="14.5" r=".8"/><circle cx="16.5" cy="14.5" r=".8"/>',
  leaf: '<path d="M5 19C5 11 10 5 20 5c0 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/>',
  thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
  drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  motion: '<circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-6.5L14 17v4M8.5 11l3-3 3 2 2.5 3M11.5 8l-1 6.5"/>',
  gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="m12 13 4-4"/><circle cx="12" cy="13" r="1.2"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.3 1.2-3.9 2.5-5 .2 1.8 1 2.8 2 3.2C11 8.8 11 6 12 3z"/>',
  snow: '<path d="M12 2.5v19M3.77 7.25l16.46 9.5M20.23 7.25 3.77 16.75"/><path d="M9.58 3.9 12 2.5l2.42 1.4M9.58 20.1 12 21.5l2.42-1.4M3.77 10.05V7.25l2.42-1.4M20.23 13.95v2.8l-2.42 1.4M20.23 10.05V7.25l-2.42-1.4M3.77 13.95v2.8l2.42 1.4"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-3.2.4-6.5 2.9-6.5 2.2 0 2.4 3.9-.2 5.1zM14 12c3.2 0 6.5.4 6.5 2.9 0 2.2-3.9 2.4-5.1-.2zM12 14c0 3.2-.4 6.5-2.9 6.5-2.2 0-2.4-3.9.2-5.1zM10 12c-3.2 0-6.5-.4-6.5-2.9 0-2.2 3.9-2.4 5.1.2z"/>',
  window: '<rect x="5" y="3" width="14" height="18" rx="1.2"/><path d="M12 3v18M5 12h14"/>',
  french: '<rect x="4.5" y="2.5" width="15" height="19" rx="1"/><path d="M12 2.5v19M3 21.5h18M9.6 11.5v2M14.4 11.5v2"/>',
  shutter: '<rect x="3.5" y="3" width="17" height="4" rx="1"/><path d="M5 7h14v12H5zM5 10h14M5 13h14M5 16h14"/>',
  curtain: '<path d="M3 3.5h18M5.5 3.5V20.5M18.5 3.5V20.5M5.5 3.5c.8 6 2.5 11 4.5 15.5M18.5 3.5c-.8 6-2.5 11-4.5 15.5"/>',
  tv: '<rect x="2.5" y="5" width="19" height="12.5" rx="1.5"/><path d="M8 21h8M8 1.8l4 3.2 4-3.2"/>',
  speaker: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="14.5" r="3.2"/><circle cx="12" cy="7" r="1.1"/>',
  play: '<path d="M7.5 4.8v14.4L19 12z"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  next: '<path d="M5.5 5.5v13l9.5-6.5zM18.5 5.5v13"/>',
  previous: '<path d="M18.5 5.5v13L9 12zM5.5 5.5v13"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  pin: '<path d="M12 21s6.5-6.2 6.5-11.5a6.5 6.5 0 0 0-13 0C5.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
} as const;

export type MPIconName = keyof typeof icons;
export const mpIcon = (name: MPIconName, size = 24) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / contain no-repeat`;
  const style = `display:inline-block;width:${size}px;height:${size}px;flex:0 0 auto;background:currentColor;-webkit-mask:${mask};mask:${mask}`;
  return html`<span class="mp-icon" data-icon=${name} aria-hidden="true" style=${style}></span>`;
};
