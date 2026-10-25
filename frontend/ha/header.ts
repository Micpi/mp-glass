/*
 * Home Assistant draws its bar above every view, opaque, with a back arrow and the view title on a subview: on
 * MP Nexus pages, all subviews but home, it made a dark band above the backdrop. While an MP Nexus view is on
 * screen the bar is hidden but for its actions (search, Assist, edit) and its sidebar button, as on the home
 * page; the MP Nexus header names the page and navigates. Edit mode keeps the Home Assistant bar.
 * Hidden rather than transparent: a theme may paint the bar, its toolbar or a pseudo-element, even with !important.
 * hui-root is Home Assistant internals: elsewhere, or if its structure changes, the bar stays as it is.
 *
 * Kiosk: while an MP Nexus view is on screen, the bar goes entirely and so does the sidebar, through Home
 * Assistant's own kiosk mode, as the browser_mod and kiosk-mode cards ask for it. An administrator can leave it for
 * this tab from the Plus page; everyone else is kept on MP Nexus by frontend/ha/kiosk.ts.
 */
const ATTRIBUTE = 'mp-glass';
const BAR = `:host([${ATTRIBUTE}]) div:not(.edit-mode)>.header`;
const KIOSK = 'mp-glass-kiosk';
// In kiosk mode the room the bar keeps above the view goes too: left empty, it showed as a black band.
const STYLE = `:host([${KIOSK}]) div:not(.edit-mode)>hui-view-container{padding-top:var(--safe-area-inset-top,0px)!important}${BAR}{visibility:hidden!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}:host([${ATTRIBUTE}]:not([${KIOSK}])) div:not(.edit-mode)>.header :is(.action-items,ha-menu-button){visibility:visible}`;
/** For a frontend that ignores the kiosk event: the sidebar and the room it keeps go all the same. */
const MAIN_STYLE = `:host([${KIOSK}]){--ha-sidebar-width:0px!important;--ha-top-app-bar-width:100%!important;--mdc-drawer-width:0px!important}:host([${KIOSK}]) ha-sidebar{display:none!important}`;
const LEFT = 'mp-glass.kiosk';
/** MP Nexus views on screen in each hui-root. */
const views = new WeakMap<Element, Set<Element>>();

/** The shadow root of the hui-root around the view, across the shadow roots in between. */
function huiRoot(view: Element) {
  for (let root = view.getRootNode(); root instanceof ShadowRoot; root = root.host.getRootNode()) {
    if (root.host.localName === 'hui-root') return root;
  }
  return undefined;
}

/** Whether an administrator left the kiosk in this tab. */
export function kioskLeft() {
  try { return sessionStorage.getItem(LEFT) === 'left'; } catch { return false; }
}
function main() {
  return document.querySelector('home-assistant')?.shadowRoot?.querySelector('home-assistant-main') ?? undefined;
}
let kioskOn = false;
/**
 * On a touch screen, the browser goes full screen at the first touch, and again after each way out: browsers allow
 * it only from a touch. Never on a computer, nor in an app or a page added to the home screen, already full screen.
 */
function fullScreen() {
  if (!kioskOn || document.fullscreenElement || !document.fullscreenEnabled) return;
  if (!matchMedia('(pointer: coarse)').matches || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) return;
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
}
function kiosk(enable: boolean, host?: Element) {
  if (enable && !kioskOn) addEventListener('pointerup', fullScreen, { passive: true });
  if (!enable && kioskOn) {
    removeEventListener('pointerup', fullScreen);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
  }
  kioskOn = enable;
  window.dispatchEvent(new CustomEvent('hass-kiosk-mode', { detail: { enable } }));
  const shell = main();
  if (shell?.shadowRoot) {
    let style = shell.shadowRoot.querySelector('style[data-mp-glass-kiosk]');
    if (!style) {
      style = document.createElement('style');
      style.setAttribute('data-mp-glass-kiosk', '');
      shell.shadowRoot.append(style);
    }
    if (style.textContent !== MAIN_STYLE) style.textContent = MAIN_STYLE;
  }
  shell?.toggleAttribute(KIOSK, enable);
  host?.toggleAttribute(KIOSK, enable);
  // The views measure the room left to them on resize.
  window.dispatchEvent(new Event('resize'));
}
/** Leaves the kiosk in this tab, or comes back to it. Administrators only: the others are kept in it. */
export function leaveKiosk(left: boolean) {
  try { if (left) sessionStorage.setItem(LEFT, 'left'); else sessionStorage.removeItem(LEFT); } catch { /* Storage blocked: for this page only. */ }
  for (const host of claimed) if (views.get(host)?.size) kiosk(!left, host);
}
/** hui-roots holding MP Nexus views, to switch the kiosk on all of them. */
const claimed = new Set<Element>();

/** Makes the bar transparent while the view is on screen; returns the hui-root to release. */
export function claimHeader(view: Element) {
  const root = huiRoot(view);
  if (!root) return undefined;
  let style = root.querySelector('style[data-mp-glass-header]');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('data-mp-glass-header', '');
    // Before the content Lit renders there, which it never clears.
    root.prepend(style);
  }
  // Rewritten even when found: an older copy of MP Nexus loaded as a Lovelace resource may have put its own rules there.
  if (style.textContent !== STYLE) style.textContent = STYLE;
  views.set(root.host, (views.get(root.host) ?? new Set()).add(view));
  root.host.setAttribute(ATTRIBUTE, '');
  claimed.add(root.host);
  kiosk(!kioskLeft(), root.host);
  return root.host;
}

export function releaseHeader(host: Element, view: Element) {
  const shown = views.get(host);
  shown?.delete(view);
  if (shown?.size) return;
  host.removeAttribute(ATTRIBUTE);
  claimed.delete(host);
  // Another MP Nexus view takes over at once when the dashboard changes page: the kiosk ends only if none does.
  setTimeout(() => { if (![...claimed].some(h => views.get(h)?.size)) kiosk(false, host); }, 500);
}
