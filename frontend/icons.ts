import { html } from 'lit';

const icons = {
  home: '<path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/>',
  bulb: '<path d="M9 18h6m-5 3h4m-7.5-9.5a5.5 5.5 0 1 1 11 0c0 2.1-1.15 3.35-2.35 4.55-.58.58-.9 1.19-.98 1.95H9.83c-.08-.76-.4-1.37-.98-1.95C7.65 14.85 6.5 13.6 6.5 11.5Z"/>',
  rooms: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
  sparkle: '<path d="m12 2 1.2 4.1L17 8l-3.8 1.9L12 14l-1.2-4.1L7 8l3.8-1.9zM5 14l.8 2.7L8.5 18l-2.7 1.3L5 22l-.8-2.7L1.5 18l2.7-1.3zM19 13l.65 2.1L22 16l-2.35.9L19 19l-.65-2.1L16 16l2.35-.9z"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.5 1.5 0 0 1 0-3H15A6 6 0 0 0 21 8.5C21 5.5 17 3 12 3Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="15" cy="7" r="1"/>',
  tune: '<path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M7 14v6"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m8 0h3a1 1 0 0 0 1-1v-3"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
} as const;

export const mpIcon = (name: keyof typeof icons, size = 24) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / contain no-repeat`;
  const style = `display:inline-block;width:${size}px;height:${size}px;flex:0 0 auto;background:currentColor;-webkit-mask:${mask};mask:${mask}`;
  return html`<span class="mp-icon" aria-hidden="true" style=${style}></span>`;
};
