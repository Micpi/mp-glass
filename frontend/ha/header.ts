/*
 * Home Assistant draws its bar above every view, opaque, with a back arrow and the view title on a subview: on
 * MP Glass pages, all subviews but home, it made a dark band above the backdrop. While an MP Glass view is on
 * screen the bar lets the backdrop through and keeps only its actions (search, Assist, edit), as on the home
 * page; the MP Glass header names the page and navigates. Edit mode keeps the Home Assistant bar.
 * hui-root is Home Assistant internals: elsewhere, or if its structure changes, the bar stays as it is.
 */
const ATTRIBUTE = 'mp-glass';
const BAR = `:host([${ATTRIBUTE}]) div:not(.edit-mode)>.header`;
const STYLE = `${BAR}{background:transparent;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}${BAR} .toolbar{border-bottom:none}${BAR} :is(ha-icon-button-arrow-prev,.main-title){visibility:hidden}`;
/** MP Glass views on screen in each hui-root. */
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
