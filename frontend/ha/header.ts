/*
 * Home Assistant draws its bar above every view, opaque, with a back arrow and the view title on a subview: on
 * MP Nexus pages, all subviews but home, it made a dark band above the backdrop. While an MP Nexus view is on
 * screen the bar is hidden but for its actions (search, Assist, edit) and its sidebar button, as on the home
 * page; the MP Nexus header names the page and navigates. Edit mode keeps the Home Assistant bar.
 * Hidden rather than transparent: a theme may paint the bar, its toolbar or a pseudo-element, even with !important.
 * hui-root is Home Assistant internals: elsewhere, or if its structure changes, the bar stays as it is.
 */
const ATTRIBUTE = 'mp-glass';
const BAR = `:host([${ATTRIBUTE}]) div:not(.edit-mode)>.header`;
const STYLE = `${BAR}{visibility:hidden!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}${BAR} :is(.action-items,ha-menu-button){visibility:visible}`;
/** MP Nexus views on screen in each hui-root. */
const views = new WeakMap<Element, Set<Element>>();

/** The shadow root of the hui-root around the view, across the shadow roots in between. */
function huiRoot(view: Element) {
  for (let root = view.getRootNode(); root instanceof ShadowRoot; root = root.host.getRootNode()) {
    if (root.host.localName === 'hui-root') return root;
  }
  return undefined;
}

/** Makes the bar transparent while the view is on screen; returns the hui-root to release. */
export function claimHeader(view: Element) {
  const root = huiRoot(view);
  if (!root) return undefined;
  if (!root.querySelector('style[data-mp-glass-header]')) {
    const style = document.createElement('style');
    style.setAttribute('data-mp-glass-header', '');
    style.textContent = STYLE;
    // Before the content Lit renders there, which it never clears.
    root.prepend(style);
  }
  views.set(root.host, (views.get(root.host) ?? new Set()).add(view));
  root.host.setAttribute(ATTRIBUTE, '');
  return root.host;
}

export function releaseHeader(host: Element, view: Element) {
  const shown = views.get(host);
  shown?.delete(view);
  if (!shown?.size) host.removeAttribute(ATTRIBUTE);
}
