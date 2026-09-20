/*
 * A scoped custom element registry polyfill, loaded by some Home Assistant add-ons, replaces window.customElements
 * with a registry that ignores the elements defined before it: Home Assistant then waits in vain for the MP Nexus
 * strategy, views and cards ("Timeout waiting for strategy element"). MP Nexus elements are defined through
 * defineElement, and defined again on each registry that replaces the current one.
 */
const elements = new Map<string, CustomElementConstructor>();
let registry: CustomElementRegistry | undefined;
let watching = false;

function follow() {
  const current = window.customElements;
  if (current === registry) return;
  registry = current;
  for (const [name, element] of elements) {
    if (current.get(name)) continue;
    try { current.define(name, element); } catch { /* Defined meanwhile by another copy of MP Nexus. */ }
  }
}

/** Defines the element unless another copy of MP Nexus did, and keeps it on any later registry. */
export function defineElement(name: string, element: CustomElementConstructor) {
  // No window, no registry: the unit tests read the pure parts of the modules that define elements.
  if (typeof window === 'undefined') return;
  follow();
  if (!watching) { watching = true; setInterval(follow, 250); }
  if (customElements.get(name)) return;
  customElements.define(name, element);
  elements.set(name, element);
}
