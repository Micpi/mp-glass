const It = globalThis, fr = It.ShadowRoot && (It.ShadyCSS === void 0 || It.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, hr = /* @__PURE__ */ Symbol(), Pr = /* @__PURE__ */ new WeakMap();
let Zs = class {
  constructor(e, i, s) {
    if (this._$cssResult$ = !0, s !== hr) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = i;
  }
  get styleSheet() {
    let e = this.o;
    const i = this.t;
    if (fr && e === void 0) {
      const s = i !== void 0 && i.length === 1;
      s && (e = Pr.get(i)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), s && Pr.set(i, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const mn = (t) => new Zs(typeof t == "string" ? t : t + "", void 0, hr), pr = (t, ...e) => {
  const i = t.length === 1 ? t[0] : e.reduce((s, c, r) => s + ((a) => {
    if (a._$cssResult$ === !0) return a.cssText;
    if (typeof a == "number") return a;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + a + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(c) + t[r + 1], t[0]);
  return new Zs(i, t, hr);
}, gn = (t, e) => {
  if (fr) t.adoptedStyleSheets = e.map((i) => i instanceof CSSStyleSheet ? i : i.styleSheet);
  else for (const i of e) {
    const s = document.createElement("style"), c = It.litNonce;
    c !== void 0 && s.setAttribute("nonce", c), s.textContent = i.cssText, t.appendChild(s);
  }
}, Rr = fr ? (t) => t : (t) => t instanceof CSSStyleSheet ? ((e) => {
  let i = "";
  for (const s of e.cssRules) i += s.cssText;
  return mn(i);
})(t) : t;
const { is: yn, defineProperty: vn, getOwnPropertyDescriptor: _n, getOwnPropertyNames: $n, getOwnPropertySymbols: bn, getPrototypeOf: wn } = Object, Vt = globalThis, Or = Vt.trustedTypes, En = Or ? Or.emptyScript : "", Sn = Vt.reactiveElementPolyfillSupport, ze = (t, e) => t, or = { toAttribute(t, e) {
  switch (e) {
    case Boolean:
      t = t ? En : null;
      break;
    case Object:
    case Array:
      t = t == null ? t : JSON.stringify(t);
  }
  return t;
}, fromAttribute(t, e) {
  let i = t;
  switch (e) {
    case Boolean:
      i = t !== null;
      break;
    case Number:
      i = t === null ? null : Number(t);
      break;
    case Object:
    case Array:
      try {
        i = JSON.parse(t);
      } catch {
        i = null;
      }
  }
  return i;
} }, Qs = (t, e) => !yn(t, e), Ar = { attribute: !0, type: String, converter: or, reflect: !1, useDefault: !1, hasChanged: Qs };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), Vt.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let Ce = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, i = Ar) {
    if (i.state && (i.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((i = Object.create(i)).wrapped = !0), this.elementProperties.set(e, i), !i.noAccessor) {
      const s = /* @__PURE__ */ Symbol(), c = this.getPropertyDescriptor(e, s, i);
      c !== void 0 && vn(this.prototype, e, c);
    }
  }
  static getPropertyDescriptor(e, i, s) {
    const { get: c, set: r } = _n(this.prototype, e) ?? { get() {
      return this[i];
    }, set(a) {
      this[i] = a;
    } };
    return { get: c, set(a) {
      const f = c?.call(this);
      r?.call(this, a), this.requestUpdate(e, f, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? Ar;
  }
  static _$Ei() {
    if (this.hasOwnProperty(ze("elementProperties"))) return;
    const e = wn(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(ze("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(ze("properties"))) {
      const i = this.properties, s = [...$n(i), ...bn(i)];
      for (const c of s) this.createProperty(c, i[c]);
    }
    const e = this[Symbol.metadata];
    if (e !== null) {
      const i = litPropertyMetadata.get(e);
      if (i !== void 0) for (const [s, c] of i) this.elementProperties.set(s, c);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [i, s] of this.elementProperties) {
      const c = this._$Eu(i, s);
      c !== void 0 && this._$Eh.set(c, i);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    const i = [];
    if (Array.isArray(e)) {
      const s = new Set(e.flat(1 / 0).reverse());
      for (const c of s) i.unshift(Rr(c));
    } else e !== void 0 && i.push(Rr(e));
    return i;
  }
  static _$Eu(e, i) {
    const s = i.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof e == "string" ? e.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
  }
  addController(e) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
  }
  removeController(e) {
    this._$EO?.delete(e);
  }
  _$E_() {
    const e = /* @__PURE__ */ new Map(), i = this.constructor.elementProperties;
    for (const s of i.keys()) this.hasOwnProperty(s) && (e.set(s, this[s]), delete this[s]);
    e.size > 0 && (this._$Ep = e);
  }
  createRenderRoot() {
    const e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return gn(e, this.constructor.elementStyles), e;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
  }
  enableUpdating(e) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((e) => e.hostDisconnected?.());
  }
  attributeChangedCallback(e, i, s) {
    this._$AK(e, s);
  }
  _$ET(e, i) {
    const s = this.constructor.elementProperties.get(e), c = this.constructor._$Eu(e, s);
    if (c !== void 0 && s.reflect === !0) {
      const r = (s.converter?.toAttribute !== void 0 ? s.converter : or).toAttribute(i, s.type);
      this._$Em = e, r == null ? this.removeAttribute(c) : this.setAttribute(c, r), this._$Em = null;
    }
  }
  _$AK(e, i) {
    const s = this.constructor, c = s._$Eh.get(e);
    if (c !== void 0 && this._$Em !== c) {
      const r = s.getPropertyOptions(c), a = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : or;
      this._$Em = c;
      const f = a.fromAttribute(i, r.type);
      this[c] = f ?? this._$Ej?.get(c) ?? f, this._$Em = null;
    }
  }
  requestUpdate(e, i, s, c = !1, r) {
    if (e !== void 0) {
      const a = this.constructor;
      if (c === !1 && (r = this[e]), s ??= a.getPropertyOptions(e), !((s.hasChanged ?? Qs)(r, i) || s.useDefault && s.reflect && r === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, s)))) return;
      this.C(e, i, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, i, { useDefault: s, reflect: c, wrapped: r }, a) {
    s && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? i ?? this[e]), r !== !0 || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || s || (i = void 0), this._$AL.set(e, i)), c === !0 && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (i) {
      Promise.reject(i);
    }
    const e = this.scheduleUpdate();
    return e != null && await e, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [c, r] of this._$Ep) this[c] = r;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [c, r] of s) {
        const { wrapped: a } = r, f = this[c];
        a !== !0 || this._$AL.has(c) || f === void 0 || this.C(c, void 0, r, f);
      }
    }
    let e = !1;
    const i = this._$AL;
    try {
      e = this.shouldUpdate(i), e ? (this.willUpdate(i), this._$EO?.forEach((s) => s.hostUpdate?.()), this.update(i)) : this._$EM();
    } catch (s) {
      throw e = !1, this._$EM(), s;
    }
    e && this._$AE(i);
  }
  willUpdate(e) {
  }
  _$AE(e) {
    this._$EO?.forEach((i) => i.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(e) {
    return !0;
  }
  update(e) {
    this._$Eq &&= this._$Eq.forEach((i) => this._$ET(i, this[i])), this._$EM();
  }
  updated(e) {
  }
  firstUpdated(e) {
  }
};
Ce.elementStyles = [], Ce.shadowRootOptions = { mode: "open" }, Ce[ze("elementProperties")] = /* @__PURE__ */ new Map(), Ce[ze("finalized")] = /* @__PURE__ */ new Map(), Sn?.({ ReactiveElement: Ce }), (Vt.reactiveElementVersions ??= []).push("2.1.2");
const mr = globalThis, Nr = (t) => t, Ct = mr.trustedTypes, kr = Ct ? Ct.createPolicy("lit-html", { createHTML: (t) => t }) : void 0, Xs = "$lit$", be = `lit$${Math.random().toFixed(9).slice(2)}$`, Ys = "?" + be, Pn = `<${Ys}>`, Ne = document, He = () => Ne.createComment(""), Le = (t) => t === null || typeof t != "object" && typeof t != "function", gr = Array.isArray, Rn = (t) => gr(t) || typeof t?.[Symbol.iterator] == "function", Zt = `[ 	
\f\r]`, De = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, jr = /-->/g, Ir = />/g, Se = RegExp(`>|${Zt}(?:([^\\s"'>=/]+)(${Zt}*=${Zt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Cr = /'/g, Tr = /"/g, en = /^(?:script|style|textarea|title)$/i, On = (t) => (e, ...i) => ({ _$litType$: t, strings: e, values: i }), ie = On(1), Te = /* @__PURE__ */ Symbol.for("lit-noChange"), ee = /* @__PURE__ */ Symbol.for("lit-nothing"), qr = /* @__PURE__ */ new WeakMap(), Ae = Ne.createTreeWalker(Ne, 129);
function tn(t, e) {
  if (!gr(t) || !t.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return kr !== void 0 ? kr.createHTML(e) : e;
}
const An = (t, e) => {
  const i = t.length - 1, s = [];
  let c, r = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", a = De;
  for (let f = 0; f < i; f++) {
    const l = t[f];
    let v, _, E = -1, k = 0;
    for (; k < l.length && (a.lastIndex = k, _ = a.exec(l), _ !== null); ) k = a.lastIndex, a === De ? _[1] === "!--" ? a = jr : _[1] !== void 0 ? a = Ir : _[2] !== void 0 ? (en.test(_[2]) && (c = RegExp("</" + _[2], "g")), a = Se) : _[3] !== void 0 && (a = Se) : a === Se ? _[0] === ">" ? (a = c ?? De, E = -1) : _[1] === void 0 ? E = -2 : (E = a.lastIndex - _[2].length, v = _[1], a = _[3] === void 0 ? Se : _[3] === '"' ? Tr : Cr) : a === Tr || a === Cr ? a = Se : a === jr || a === Ir ? a = De : (a = Se, c = void 0);
    const R = a === Se && t[f + 1].startsWith("/>") ? " " : "";
    r += a === De ? l + Pn : E >= 0 ? (s.push(v), l.slice(0, E) + Xs + l.slice(E) + be + R) : l + be + (E === -2 ? f : R);
  }
  return [tn(t, r + (t[i] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), s];
};
class Ke {
  constructor({ strings: e, _$litType$: i }, s) {
    let c;
    this.parts = [];
    let r = 0, a = 0;
    const f = e.length - 1, l = this.parts, [v, _] = An(e, i);
    if (this.el = Ke.createElement(v, s), Ae.currentNode = this.el.content, i === 2 || i === 3) {
      const E = this.el.content.firstChild;
      E.replaceWith(...E.childNodes);
    }
    for (; (c = Ae.nextNode()) !== null && l.length < f; ) {
      if (c.nodeType === 1) {
        if (c.hasAttributes()) for (const E of c.getAttributeNames()) if (E.endsWith(Xs)) {
          const k = _[a++], R = c.getAttribute(E).split(be), O = /([.?@])?(.*)/.exec(k);
          l.push({ type: 1, index: r, name: O[2], strings: R, ctor: O[1] === "." ? kn : O[1] === "?" ? jn : O[1] === "@" ? In : zt }), c.removeAttribute(E);
        } else E.startsWith(be) && (l.push({ type: 6, index: r }), c.removeAttribute(E));
        if (en.test(c.tagName)) {
          const E = c.textContent.split(be), k = E.length - 1;
          if (k > 0) {
            c.textContent = Ct ? Ct.emptyScript : "";
            for (let R = 0; R < k; R++) c.append(E[R], He()), Ae.nextNode(), l.push({ type: 2, index: ++r });
            c.append(E[k], He());
          }
        }
      } else if (c.nodeType === 8) if (c.data === Ys) l.push({ type: 2, index: r });
      else {
        let E = -1;
        for (; (E = c.data.indexOf(be, E + 1)) !== -1; ) l.push({ type: 7, index: r }), E += be.length - 1;
      }
      r++;
    }
  }
  static createElement(e, i) {
    const s = Ne.createElement("template");
    return s.innerHTML = e, s;
  }
}
function qe(t, e, i = t, s) {
  if (e === Te) return e;
  let c = s !== void 0 ? i._$Co?.[s] : i._$Cl;
  const r = Le(e) ? void 0 : e._$litDirective$;
  return c?.constructor !== r && (c?._$AO?.(!1), r === void 0 ? c = void 0 : (c = new r(t), c._$AT(t, i, s)), s !== void 0 ? (i._$Co ??= [])[s] = c : i._$Cl = c), c !== void 0 && (e = qe(t, c._$AS(t, e.values), c, s)), e;
}
class Nn {
  constructor(e, i) {
    this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = i;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(e) {
    const { el: { content: i }, parts: s } = this._$AD, c = (e?.creationScope ?? Ne).importNode(i, !0);
    Ae.currentNode = c;
    let r = Ae.nextNode(), a = 0, f = 0, l = s[0];
    for (; l !== void 0; ) {
      if (a === l.index) {
        let v;
        l.type === 2 ? v = new Ge(r, r.nextSibling, this, e) : l.type === 1 ? v = new l.ctor(r, l.name, l.strings, this, e) : l.type === 6 && (v = new Cn(r, this, e)), this._$AV.push(v), l = s[++f];
      }
      a !== l?.index && (r = Ae.nextNode(), a++);
    }
    return Ae.currentNode = Ne, c;
  }
  p(e) {
    let i = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(e, s, i), i += s.strings.length - 2) : s._$AI(e[i])), i++;
  }
}
class Ge {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, i, s, c) {
    this.type = 2, this._$AH = ee, this._$AN = void 0, this._$AA = e, this._$AB = i, this._$AM = s, this.options = c, this._$Cv = c?.isConnected ?? !0;
  }
  get parentNode() {
    let e = this._$AA.parentNode;
    const i = this._$AM;
    return i !== void 0 && e?.nodeType === 11 && (e = i.parentNode), e;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(e, i = this) {
    e = qe(this, e, i), Le(e) ? e === ee || e == null || e === "" ? (this._$AH !== ee && this._$AR(), this._$AH = ee) : e !== this._$AH && e !== Te && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : Rn(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== ee && Le(this._$AH) ? this._$AA.nextSibling.data = e : this.T(Ne.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: i, _$litType$: s } = e, c = typeof s == "number" ? this._$AC(e) : (s.el === void 0 && (s.el = Ke.createElement(tn(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === c) this._$AH.p(i);
    else {
      const r = new Nn(c, this), a = r.u(this.options);
      r.p(i), this.T(a), this._$AH = r;
    }
  }
  _$AC(e) {
    let i = qr.get(e.strings);
    return i === void 0 && qr.set(e.strings, i = new Ke(e)), i;
  }
  k(e) {
    gr(this._$AH) || (this._$AH = [], this._$AR());
    const i = this._$AH;
    let s, c = 0;
    for (const r of e) c === i.length ? i.push(s = new Ge(this.O(He()), this.O(He()), this, this.options)) : s = i[c], s._$AI(r), c++;
    c < i.length && (this._$AR(s && s._$AB.nextSibling, c), i.length = c);
  }
  _$AR(e = this._$AA.nextSibling, i) {
    for (this._$AP?.(!1, !0, i); e !== this._$AB; ) {
      const s = Nr(e).nextSibling;
      Nr(e).remove(), e = s;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class zt {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, i, s, c, r) {
    this.type = 1, this._$AH = ee, this._$AN = void 0, this.element = e, this.name = i, this._$AM = c, this.options = r, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = ee;
  }
  _$AI(e, i = this, s, c) {
    const r = this.strings;
    let a = !1;
    if (r === void 0) e = qe(this, e, i, 0), a = !Le(e) || e !== this._$AH && e !== Te, a && (this._$AH = e);
    else {
      const f = e;
      let l, v;
      for (e = r[0], l = 0; l < r.length - 1; l++) v = qe(this, f[s + l], i, l), v === Te && (v = this._$AH[l]), a ||= !Le(v) || v !== this._$AH[l], v === ee ? e = ee : e !== ee && (e += (v ?? "") + r[l + 1]), this._$AH[l] = v;
    }
    a && !c && this.j(e);
  }
  j(e) {
    e === ee ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class kn extends zt {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === ee ? void 0 : e;
  }
}
class jn extends zt {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== ee);
  }
}
class In extends zt {
  constructor(e, i, s, c, r) {
    super(e, i, s, c, r), this.type = 5;
  }
  _$AI(e, i = this) {
    if ((e = qe(this, e, i, 0) ?? ee) === Te) return;
    const s = this._$AH, c = e === ee && s !== ee || e.capture !== s.capture || e.once !== s.once || e.passive !== s.passive, r = e !== ee && (s === ee || c);
    c && this.element.removeEventListener(this.name, this, s), r && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class Cn {
  constructor(e, i, s) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    qe(this, e);
  }
}
const Tn = mr.litHtmlPolyfillSupport;
Tn?.(Ke, Ge), (mr.litHtmlVersions ??= []).push("3.3.3");
const qn = (t, e, i) => {
  const s = i?.renderBefore ?? e;
  let c = s._$litPart$;
  if (c === void 0) {
    const r = i?.renderBefore ?? null;
    s._$litPart$ = c = new Ge(e.insertBefore(He(), r), r, void 0, i ?? {});
  }
  return c._$AI(t), c;
};
const yr = globalThis;
class we extends Ce {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    const i = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = qn(i, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return Te;
  }
}
we._$litElement$ = !0, we.finalized = !0, yr.litElementHydrateSupport?.({ LitElement: we });
const Mn = yr.litElementPolyfillSupport;
Mn?.({ LitElement: we });
(yr.litElementVersions ??= []).push("4.2.2");
const Dn = /* @__PURE__ */ new Set(["brightness", "color_temp", "hs", "xy", "rgb", "rgbw", "rgbww", "white"]);
class cr {
  static detect(e, i) {
    if (e.split(".")[0] !== "light") return [];
    const s = [{ capability: "POWER", entityId: e, evidence: "domain:light" }], c = Array.isArray(i?.attributes.supported_color_modes) ? i.attributes.supported_color_modes.filter((f) => typeof f == "string") : [], r = (f, l) => s.push({ capability: f, entityId: e, evidence: l });
    c.some((f) => Dn.has(f)) && r("DIM", "supported_color_modes"), c.includes("color_temp") && r("COLOR_TEMP", "supported_color_modes:color_temp"), c.some((f) => ["rgb", "hs", "xy"].includes(f)) && r("RGB", "supported_color_modes:color"), c.includes("rgbw") && r("RGBW", "supported_color_modes:rgbw"), c.includes("rgbww") && r("RGBWW", "supported_color_modes:rgbww");
    const a = i?.attributes.supported_features;
    return typeof a == "number" && (a & 4) !== 0 && r("EFFECT", "supported_features:4"), s;
  }
}
const Mr = (t) => !!t && !["unavailable", "unknown"].includes(t.state);
function xn(t) {
  return typeof t == "number" && Number.isFinite(t) ? Math.round(Math.min(255, Math.max(0, t)) / 255 * 100) : void 0;
}
const Fn = {
  on: "Allumée",
  off: "Éteinte",
  unavailable: "Indisponible",
  turnOn: "Allumer",
  turnOff: "Éteindre",
  brightness: "Luminosité",
  details: "Détails",
  error: "Action impossible. Vérifiez la connexion et vos droits.",
  setup: "Configuration MP Glass",
  intro: "Configurez votre installation, puis créez votre dashboard.",
  name: "Nom de la maison",
  scan: "Analyser l’installation",
  save: "Enregistrer",
  saved: "Configuration enregistrée",
  review: "À vérifier",
  devices: "Équipements",
  auto: "Classés automatiquement",
  noArea: "Sans pièce",
  hidden: "Masquer",
  preset: "Apparence",
  generate: "Créer le dashboard",
  generateHelp: "Dans Tableaux de bord, ajoutez MP Glass Dashboard depuis les dashboards communautaires.",
  failed: "Impossible de charger ou enregistrer. Vérifiez vos droits, la connexion et la version MP Glass.",
  why: "Pourquoi cette carte ?",
  entity: "Entité",
  reload: "Recharger",
  unsupported: "Non classé",
  export: "Exporter le projet",
  area: "Pièce",
  empty: "Aucun équipement visible.",
  lights: "Lumières",
  settings: "Réglages",
  pending: "En cours…",
  preview: "Aperçu"
}, Un = {
  on: "On",
  off: "Off",
  unavailable: "Unavailable",
  turnOn: "Turn on",
  turnOff: "Turn off",
  brightness: "Brightness",
  details: "Details",
  error: "Action failed. Check your connection and permissions.",
  setup: "MP Glass Setup",
  intro: "Configure your installation, then create your dashboard.",
  name: "Home name",
  scan: "Scan installation",
  save: "Save",
  saved: "Configuration saved",
  review: "Needs review",
  devices: "Devices",
  auto: "Automatically classified",
  noArea: "No room",
  hidden: "Hide",
  preset: "Appearance",
  generate: "Create dashboard",
  generateHelp: "In Dashboards, add MP Glass Dashboard from the community dashboards.",
  failed: "Unable to load or save. Check permissions, connection and MP Glass version.",
  why: "Why this card?",
  entity: "Entity",
  reload: "Reload",
  unsupported: "Unclassified",
  export: "Export project",
  area: "Room",
  empty: "No visible devices.",
  lights: "Lights",
  settings: "Settings",
  pending: "Working…",
  preview: "Preview"
}, Z = (t, e) => (t?.startsWith("fr") ? Fn : Un)[e], vr = pr`
  :host{--mp-background:#0c1423;--mp-glass-background:rgba(23,35,54,.94);--mp-glass-border:rgba(196,218,247,.2);--mp-accent:#85baff;--mp-text-primary:#f5f7fc;--mp-text-secondary:#b8c5d9;--mp-glass-radius:24px;--mp-warning:#ffd674;--mp-danger:#ffb4b4;display:block;color:var(--mp-text-primary);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif)}
  :host([preset=glass-warm]){--mp-accent:#f8c59b;--mp-glass-background:rgba(49,35,30,.96)}
  :host([preset=glass-dark]){--mp-accent:#c4c8db;--mp-glass-background:#171a23}
  :host([preset=glass-light]){--mp-text-primary:#13223a;--mp-text-secondary:#40516c;--mp-glass-background:#f3f6fc;--mp-accent:#1557a8;--mp-glass-border:#a6b4c9;--mp-warning:#795500}
  :host([preset=glass-oled]){--mp-background:#000;--mp-glass-background:#050505;--mp-accent:#d2e4ff}
  :host([preset=glass-neutral]){--mp-accent:#d4d8df;--mp-glass-background:#26282c}
  *{box-sizing:border-box}article,.surface{background:var(--mp-glass-background);border:1px solid var(--mp-glass-border);border-radius:var(--mp-glass-radius);padding:24px;box-shadow:0 12px 36px #0002;min-width:0}
  @supports(backdrop-filter:blur(8px)){article,.surface{backdrop-filter:blur(8px) saturate(115%)}}
  h1,h2,h3,p{margin:0 0 12px}h2{font-size:1.2rem;overflow-wrap:anywhere}p,small{color:var(--mp-text-secondary)}
  button,input,select,a{font:inherit}button,input,select{min-height:44px;border:1px solid var(--mp-glass-border);border-radius:12px;background:transparent;color:inherit;padding:8px 12px;max-width:100%}
  button{cursor:pointer}button.primary{background:var(--mp-accent);color:var(--mp-background);font-weight:650}button:disabled,input:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid var(--mp-accent);outline-offset:3px}
  input[type=range]{width:100%;accent-color:var(--mp-accent);padding:0}input[type=checkbox]{width:22px;min-height:22px;accent-color:var(--mp-accent)}select option{background:var(--mp-background);color:#fff}
  label{display:grid;gap:8px;margin:12px 0}a{color:var(--mp-accent)}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.error{color:var(--mp-danger)}.active{color:var(--mp-warning)}details{margin-top:16px;overflow-wrap:anywhere}summary{cursor:pointer;min-height:44px}pre{white-space:pre-wrap;font-size:12px}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`, Dt = class Dt extends we {
  constructor() {
    super(...arguments), this.busy = !1, this.failure = !1;
  }
  set hass(e) {
    const i = this.currentHass;
    this.currentHass = e, (!i || i.states[this.config?.entity ?? ""] !== e.states[this.config?.entity ?? ""] || i.language !== e.language || i.locale?.language !== e.locale?.language) && this.requestUpdate();
  }
  get hass() {
    return this.currentHass;
  }
  setConfig(e) {
    if (typeof e.entity != "string" || !e.entity.includes(".")) throw new Error("invalid_entity");
    this.config = { ...e }, this.setAttribute("preset", e.preset ?? "glass-blue");
  }
  static getConfigElement() {
    return document.createElement("mp-glass-card-editor");
  }
  static getStubConfig(e) {
    return { entity: Object.keys(e.states).find((i) => i.startsWith("light.")) };
  }
  getCardSize() {
    return 3;
  }
  getGridOptions() {
    return { columns: 6, min_columns: 6 };
  }
  moreInfo() {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this.config?.entity }, bubbles: !0, composed: !0 }));
  }
  async act(e, i = {}) {
    const s = this.config?.entity;
    if (!(!s || !s.startsWith("light.") || this.busy || !Mr(this.hass?.states[s])) && !("brightness_pct" in i && !cr.detect(s, this.hass.states[s]).some((c) => c.capability === "DIM"))) {
      this.busy = !0, this.failure = !1;
      try {
        await this.hass.callService("light", e, { ...i, entity_id: s });
      } catch {
        this.failure = !0;
      } finally {
        this.busy = !1;
      }
    }
  }
  render() {
    if (!this.config || !this.currentHass) return ee;
    const e = this.hass.locale?.language ?? this.hass.language, i = this.hass.states[this.config.entity], s = Mr(i), c = i?.state === "on", r = cr.detect(this.config.entity, i), a = this.config.type !== "custom:mp-glass-generic" && r.some((v) => v.capability === "POWER"), f = xn(i?.attributes.brightness), l = this.config.name ?? i?.attributes.friendly_name ?? this.config.entity;
    return ie`<article aria-busy=${this.busy}>
      <div class="row"><h2>${String(l)}</h2><span class=${c && a ? "active" : ""}>${s ? a ? Z(e, c ? "on" : "off") : i?.state : Z(e, "unavailable")}</span></div>
      <div class="row">${a ? ie`<button class="primary" ?disabled=${!s || this.busy} @click=${() => this.act(c ? "turn_off" : "turn_on")}>${Z(e, c ? "turnOff" : "turnOn")}</button>` : ee}
      <button @click=${this.moreInfo}>${Z(e, "details")}</button></div>
      ${a && r.some((v) => v.capability === "DIM") ? ie`<label>${Z(e, "brightness")} ${f === void 0 ? "" : new Intl.NumberFormat(e).format(f) + " %"}<input aria-label=${Z(e, "brightness")} type="range" min="0" max="100" .value=${String(f ?? 0)} ?disabled=${!s || this.busy} @change=${(v) => this.act("turn_on", { brightness_pct: Number(v.target.value) })}></label>` : ee}
      ${this.failure ? ie`<p class="error" role="alert">${Z(e, "error")}</p>` : ee}
      ${this.config.debug ? ie`<details><summary>${Z(e, "why")}</summary><pre>${JSON.stringify({ entity: this.config.entity, evidence: a ? "domain:light" : "fallback", capabilities: r, presentation: this.config.type }, null, 2)}</pre></details>` : ee}
    </article>`;
  }
};
Dt.styles = vr, Dt.properties = { config: { state: !0 }, busy: { state: !0 }, failure: { state: !0 } };
let Tt = Dt;
class Vn extends Tt {
}
const xt = class xt extends we {
  setConfig(e) {
    this.config = e;
  }
  change(e) {
    this.config = { ...this.config, entity: e }, this.dispatchEvent(new CustomEvent("config-changed", { bubbles: !0, composed: !0, detail: { config: this.config } }));
  }
  render() {
    const e = this.hass?.language, i = this.config?.type === "custom:mp-glass-light";
    return customElements.get("ha-selector") ? ie`<ha-selector .hass=${this.hass} .selector=${{ entity: i ? { domain: "light" } : {} }} .value=${this.config?.entity} .label=${Z(e, "entity")} @value-changed=${(s) => this.change(s.detail.value)}></ha-selector>` : ie`<label>${Z(e, "entity")}<select .value=${this.config?.entity ?? ""} @change=${(s) => this.change(s.target.value)}><option value=""></option>${Object.keys(this.hass?.states ?? {}).filter((s) => !i || s.startsWith("light.")).sort().map((s) => ie`<option .value=${s}>${String(this.hass?.states[s]?.attributes.friendly_name ?? s)}</option>`)}</select></label>`;
  }
};
xt.styles = vr, xt.properties = { hass: { attribute: !1 }, config: { state: !0 } };
let lr = xt;
const Ft = class Ft extends we {
  constructor() {
    super(...arguments), this.cards = [], this.badges = [];
  }
  setConfig(e) {
  }
  render() {
    return ie`<div class="badges">${this.badges}</div><div class="grid">${this.cards.map((e) => ie`<div>${e}</div>`)}</div>`;
  }
};
Ft.properties = { cards: { attribute: !1 }, badges: { attribute: !1 } }, Ft.styles = pr`
    :host{display:block;container-type:inline-size;padding:16px;box-sizing:border-box;max-width:1800px;margin:auto}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px}.grid>div{min-width:0}.badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    @container(max-width:600px){.grid{grid-template-columns:1fr}}
    @media(orientation:landscape) and (max-height:500px){:host{padding:8px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}}
  `;
let ur = Ft;
const Be = (t, e) => t.id < e.id ? -1 : t.id > e.id ? 1 : 0;
class rn {
  static discover(e, i) {
    const s = new Map(e.devices.map((l) => [l.id, l])), c = new Map(e.areas.map((l) => [l.area_id, l])), r = new Map(e.entities.map((l) => [l.entity_id, l]));
    for (const l of Object.keys(e.states)) r.has(l) || r.set(l, { entity_id: l });
    const a = [...e.warnings], f = [...r.values()].map((l) => {
      const v = e.states[l.entity_id], _ = l.id ?? `state:${l.entity_id}`, E = i.overrides[_], k = l.device_id ? s.get(l.device_id) : void 0, R = E?.areaId ?? l.area_id ?? k?.area_id ?? void 0, O = l.entity_id.split(".")[0] === "light" ? "light" : "generic", A = [O === "light" ? "domain:light" : "fallback:unknown"];
      R ? c.has(R) || a.push(`missing_area:${_}`) : a.push(`no_area:${_}`), l.id || A.push("identity:provisional");
      let $ = E?.presentation;
      return $ === "light" && O !== "light" && (a.push(`incompatible_override:${_}`), $ = void 0), {
        id: `logical:${_}`,
        entityKey: _,
        entityId: l.entity_id,
        name: E?.name ?? l.name ?? (typeof v?.attributes.friendly_name == "string" ? v.attributes.friendly_name : l.original_name) ?? l.entity_id,
        sourceDeviceIds: l.device_id ? [l.device_id] : [],
        areaId: R,
        floorId: R ? c.get(R)?.floor_id ?? void 0 : void 0,
        category: O,
        presentation: $,
        confidence: O === "light" ? 0.99 : 0,
        evidence: A,
        capabilities: cr.detect(l.entity_id, v),
        hidden: E?.hidden ?? !!l.hidden_by,
        disabled: !!l.disabled_by
      };
    }).sort(Be);
    return { floors: [...e.floors].sort((l, v) => Be({ id: l.floor_id }, { id: v.floor_id })), areas: [...e.areas].sort((l, v) => Be({ id: l.area_id }, { id: v.area_id })), sourceDevices: [...e.devices].sort(Be), devices: f, warnings: [...new Set(a)].sort() };
  }
}
class zn {
  constructor() {
    this.definitions = [];
  }
  register(e) {
    if (this.definitions.some((i) => i.type === e.type)) throw new Error("duplicate_card");
    this.definitions.push(e);
  }
  resolve(e) {
    const i = e.presentation ?? e.category, c = this.definitions.filter((a) => a.categories.includes(i) && a.requires.every((f) => e.capabilities.some((l) => l.capability === f))).sort((a, f) => f.priority - a.priority || (a.type < f.type ? -1 : 1))[0], r = this.definitions.find((a) => a.type === "custom:mp-glass-generic");
    if (!c && !r) throw new Error("missing_fallback");
    return c ?? r;
  }
}
const _r = new zn();
_r.register({ type: "custom:mp-glass-light", categories: ["light"], requires: ["POWER"], priority: 100, variants: ["standard"] });
_r.register({ type: "custom:mp-glass-generic", categories: ["generic"], requires: [], priority: 0, variants: ["standard"] });
class Hn {
  static compose(e, i, s = !1) {
    const c = e.devices.filter((a) => !a.hidden && !a.disabled), r = (a) => a.map((f) => ({ type: _r.resolve(f).type, entity: f.entityId, name: f.name, preset: i.appearance.preset, debug: s }));
    return {
      title: i.project.name,
      views: [
        { title: i.project.name, path: "home", icon: "mdi:home", type: "custom:mp-glass-view", cards: r(c) },
        ...e.areas.filter((a) => c.some((f) => f.areaId === a.area_id)).map((a) => ({ title: a.name, path: `area-${a.area_id}`, icon: a.icon ?? "mdi:floor-plan", type: "custom:mp-glass-view", cards: r(c.filter((f) => f.areaId === a.area_id)) }))
      ]
    };
  }
}
function Ln(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var We = { exports: {} }, Qt = {}, ye = {}, Pe = {}, Xt = {}, Yt = {}, er = {}, Dr;
function qt() {
  return Dr || (Dr = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.regexpCode = t.getEsmExportName = t.getProperty = t.safeStringify = t.stringify = t.strConcat = t.addCodeArg = t.str = t._ = t.nil = t._Code = t.Name = t.IDENTIFIER = t._CodeOrName = void 0;
    class e {
    }
    t._CodeOrName = e, t.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    class i extends e {
      constructor(p) {
        if (super(), !t.IDENTIFIER.test(p))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = p;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return !1;
      }
      get names() {
        return { [this.str]: 1 };
      }
    }
    t.Name = i;
    class s extends e {
      constructor(p) {
        super(), this._items = typeof p == "string" ? [p] : p;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return !1;
        const p = this._items[0];
        return p === "" || p === '""';
      }
      get str() {
        var p;
        return (p = this._str) !== null && p !== void 0 ? p : this._str = this._items.reduce((w, P) => `${w}${P}`, "");
      }
      get names() {
        var p;
        return (p = this._names) !== null && p !== void 0 ? p : this._names = this._items.reduce((w, P) => (P instanceof i && (w[P.str] = (w[P.str] || 0) + 1), w), {});
      }
    }
    t._Code = s, t.nil = new s("");
    function c(b, ...p) {
      const w = [b[0]];
      let P = 0;
      for (; P < p.length; )
        f(w, p[P]), w.push(b[++P]);
      return new s(w);
    }
    t._ = c;
    const r = new s("+");
    function a(b, ...p) {
      const w = [R(b[0])];
      let P = 0;
      for (; P < p.length; )
        w.push(r), f(w, p[P]), w.push(r, R(b[++P]));
      return l(w), new s(w);
    }
    t.str = a;
    function f(b, p) {
      p instanceof s ? b.push(...p._items) : p instanceof i ? b.push(p) : b.push(E(p));
    }
    t.addCodeArg = f;
    function l(b) {
      let p = 1;
      for (; p < b.length - 1; ) {
        if (b[p] === r) {
          const w = v(b[p - 1], b[p + 1]);
          if (w !== void 0) {
            b.splice(p - 1, 3, w);
            continue;
          }
          b[p++] = "+";
        }
        p++;
      }
    }
    function v(b, p) {
      if (p === '""')
        return b;
      if (b === '""')
        return p;
      if (typeof b == "string")
        return p instanceof i || b[b.length - 1] !== '"' ? void 0 : typeof p != "string" ? `${b.slice(0, -1)}${p}"` : p[0] === '"' ? b.slice(0, -1) + p.slice(1) : void 0;
      if (typeof p == "string" && p[0] === '"' && !(b instanceof i))
        return `"${b}${p.slice(1)}`;
    }
    function _(b, p) {
      return p.emptyStr() ? b : b.emptyStr() ? p : a`${b}${p}`;
    }
    t.strConcat = _;
    function E(b) {
      return typeof b == "number" || typeof b == "boolean" || b === null ? b : R(Array.isArray(b) ? b.join(",") : b);
    }
    function k(b) {
      return new s(R(b));
    }
    t.stringify = k;
    function R(b) {
      return JSON.stringify(b).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    t.safeStringify = R;
    function O(b) {
      return typeof b == "string" && t.IDENTIFIER.test(b) ? new s(`.${b}`) : c`[${b}]`;
    }
    t.getProperty = O;
    function A(b) {
      if (typeof b == "string" && t.IDENTIFIER.test(b))
        return new s(`${b}`);
      throw new Error(`CodeGen: invalid export name: ${b}, use explicit $id name mapping`);
    }
    t.getEsmExportName = A;
    function $(b) {
      return new s(b.toString());
    }
    t.regexpCode = $;
  })(er)), er;
}
var tr = {}, xr;
function Fr() {
  return xr || (xr = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.ValueScope = t.ValueScopeName = t.Scope = t.varKinds = t.UsedValueState = void 0;
    const e = /* @__PURE__ */ qt();
    class i extends Error {
      constructor(v) {
        super(`CodeGen: "code" for ${v} not defined`), this.value = v.value;
      }
    }
    var s;
    (function(l) {
      l[l.Started = 0] = "Started", l[l.Completed = 1] = "Completed";
    })(s || (t.UsedValueState = s = {})), t.varKinds = {
      const: new e.Name("const"),
      let: new e.Name("let"),
      var: new e.Name("var")
    };
    class c {
      constructor({ prefixes: v, parent: _ } = {}) {
        this._names = {}, this._prefixes = v, this._parent = _;
      }
      toName(v) {
        return v instanceof e.Name ? v : this.name(v);
      }
      name(v) {
        return new e.Name(this._newName(v));
      }
      _newName(v) {
        const _ = this._names[v] || this._nameGroup(v);
        return `${v}${_.index++}`;
      }
      _nameGroup(v) {
        var _, E;
        if (!((E = (_ = this._parent) === null || _ === void 0 ? void 0 : _._prefixes) === null || E === void 0) && E.has(v) || this._prefixes && !this._prefixes.has(v))
          throw new Error(`CodeGen: prefix "${v}" is not allowed in this scope`);
        return this._names[v] = { prefix: v, index: 0 };
      }
    }
    t.Scope = c;
    class r extends e.Name {
      constructor(v, _) {
        super(_), this.prefix = v;
      }
      setValue(v, { property: _, itemIndex: E }) {
        this.value = v, this.scopePath = (0, e._)`.${new e.Name(_)}[${E}]`;
      }
    }
    t.ValueScopeName = r;
    const a = (0, e._)`\n`;
    class f extends c {
      constructor(v) {
        super(v), this._values = {}, this._scope = v.scope, this.opts = { ...v, _n: v.lines ? a : e.nil };
      }
      get() {
        return this._scope;
      }
      name(v) {
        return new r(v, this._newName(v));
      }
      value(v, _) {
        var E;
        if (_.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const k = this.toName(v), { prefix: R } = k, O = (E = _.key) !== null && E !== void 0 ? E : _.ref;
        let A = this._values[R];
        if (A) {
          const p = A.get(O);
          if (p)
            return p;
        } else
          A = this._values[R] = /* @__PURE__ */ new Map();
        A.set(O, k);
        const $ = this._scope[R] || (this._scope[R] = []), b = $.length;
        return $[b] = _.ref, k.setValue(_, { property: R, itemIndex: b }), k;
      }
      getValue(v, _) {
        const E = this._values[v];
        if (E)
          return E.get(_);
      }
      scopeRefs(v, _ = this._values) {
        return this._reduceValues(_, (E) => {
          if (E.scopePath === void 0)
            throw new Error(`CodeGen: name "${E}" has no value`);
          return (0, e._)`${v}${E.scopePath}`;
        });
      }
      scopeCode(v = this._values, _, E) {
        return this._reduceValues(v, (k) => {
          if (k.value === void 0)
            throw new Error(`CodeGen: name "${k}" has no value`);
          return k.value.code;
        }, _, E);
      }
      _reduceValues(v, _, E = {}, k) {
        let R = e.nil;
        for (const O in v) {
          const A = v[O];
          if (!A)
            continue;
          const $ = E[O] = E[O] || /* @__PURE__ */ new Map();
          A.forEach((b) => {
            if ($.has(b))
              return;
            $.set(b, s.Started);
            let p = _(b);
            if (p) {
              const w = this.opts.es5 ? t.varKinds.var : t.varKinds.const;
              R = (0, e._)`${R}${w} ${b} = ${p};${this.opts._n}`;
            } else if (p = k?.(b))
              R = (0, e._)`${R}${p}${this.opts._n}`;
            else
              throw new i(b);
            $.set(b, s.Completed);
          });
        }
        return R;
      }
    }
    t.ValueScope = f;
  })(tr)), tr;
}
var Ur;
function J() {
  return Ur || (Ur = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.or = t.and = t.not = t.CodeGen = t.operators = t.varKinds = t.ValueScopeName = t.ValueScope = t.Scope = t.Name = t.regexpCode = t.stringify = t.getProperty = t.nil = t.strConcat = t.str = t._ = void 0;
    const e = /* @__PURE__ */ qt(), i = /* @__PURE__ */ Fr();
    var s = /* @__PURE__ */ qt();
    Object.defineProperty(t, "_", { enumerable: !0, get: function() {
      return s._;
    } }), Object.defineProperty(t, "str", { enumerable: !0, get: function() {
      return s.str;
    } }), Object.defineProperty(t, "strConcat", { enumerable: !0, get: function() {
      return s.strConcat;
    } }), Object.defineProperty(t, "nil", { enumerable: !0, get: function() {
      return s.nil;
    } }), Object.defineProperty(t, "getProperty", { enumerable: !0, get: function() {
      return s.getProperty;
    } }), Object.defineProperty(t, "stringify", { enumerable: !0, get: function() {
      return s.stringify;
    } }), Object.defineProperty(t, "regexpCode", { enumerable: !0, get: function() {
      return s.regexpCode;
    } }), Object.defineProperty(t, "Name", { enumerable: !0, get: function() {
      return s.Name;
    } });
    var c = /* @__PURE__ */ Fr();
    Object.defineProperty(t, "Scope", { enumerable: !0, get: function() {
      return c.Scope;
    } }), Object.defineProperty(t, "ValueScope", { enumerable: !0, get: function() {
      return c.ValueScope;
    } }), Object.defineProperty(t, "ValueScopeName", { enumerable: !0, get: function() {
      return c.ValueScopeName;
    } }), Object.defineProperty(t, "varKinds", { enumerable: !0, get: function() {
      return c.varKinds;
    } }), t.operators = {
      GT: new e._Code(">"),
      GTE: new e._Code(">="),
      LT: new e._Code("<"),
      LTE: new e._Code("<="),
      EQ: new e._Code("==="),
      NEQ: new e._Code("!=="),
      NOT: new e._Code("!"),
      OR: new e._Code("||"),
      AND: new e._Code("&&"),
      ADD: new e._Code("+")
    };
    class r {
      optimizeNodes() {
        return this;
      }
      optimizeNames(n, g) {
        return this;
      }
    }
    class a extends r {
      constructor(n, g, j) {
        super(), this.varKind = n, this.name = g, this.rhs = j;
      }
      render({ es5: n, _n: g }) {
        const j = n ? i.varKinds.var : this.varKind, q = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${j} ${this.name}${q};` + g;
      }
      optimizeNames(n, g) {
        if (n[this.name.str])
          return this.rhs && (this.rhs = B(this.rhs, n, g)), this;
      }
      get names() {
        return this.rhs instanceof e._CodeOrName ? this.rhs.names : {};
      }
    }
    class f extends r {
      constructor(n, g, j) {
        super(), this.lhs = n, this.rhs = g, this.sideEffects = j;
      }
      render({ _n: n }) {
        return `${this.lhs} = ${this.rhs};` + n;
      }
      optimizeNames(n, g) {
        if (!(this.lhs instanceof e.Name && !n[this.lhs.str] && !this.sideEffects))
          return this.rhs = B(this.rhs, n, g), this;
      }
      get names() {
        const n = this.lhs instanceof e.Name ? {} : { ...this.lhs.names };
        return z(n, this.rhs);
      }
    }
    class l extends f {
      constructor(n, g, j, q) {
        super(n, j, q), this.op = g;
      }
      render({ _n: n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + n;
      }
    }
    class v extends r {
      constructor(n) {
        super(), this.label = n, this.names = {};
      }
      render({ _n: n }) {
        return `${this.label}:` + n;
      }
    }
    class _ extends r {
      constructor(n) {
        super(), this.label = n, this.names = {};
      }
      render({ _n: n }) {
        return `break${this.label ? ` ${this.label}` : ""};` + n;
      }
    }
    class E extends r {
      constructor(n) {
        super(), this.error = n;
      }
      render({ _n: n }) {
        return `throw ${this.error};` + n;
      }
      get names() {
        return this.error.names;
      }
    }
    class k extends r {
      constructor(n) {
        super(), this.code = n;
      }
      render({ _n: n }) {
        return `${this.code};` + n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(n, g) {
        return this.code = B(this.code, n, g), this;
      }
      get names() {
        return this.code instanceof e._CodeOrName ? this.code.names : {};
      }
    }
    class R extends r {
      constructor(n = []) {
        super(), this.nodes = n;
      }
      render(n) {
        return this.nodes.reduce((g, j) => g + j.render(n), "");
      }
      optimizeNodes() {
        const { nodes: n } = this;
        let g = n.length;
        for (; g--; ) {
          const j = n[g].optimizeNodes();
          Array.isArray(j) ? n.splice(g, 1, ...j) : j ? n[g] = j : n.splice(g, 1);
        }
        return n.length > 0 ? this : void 0;
      }
      optimizeNames(n, g) {
        const { nodes: j } = this;
        let q = j.length;
        for (; q--; ) {
          const F = j[q];
          F.optimizeNames(n, g) || (te(n, F.names), j.splice(q, 1));
        }
        return j.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((n, g) => H(n, g.names), {});
      }
    }
    class O extends R {
      render(n) {
        return "{" + n._n + super.render(n) + "}" + n._n;
      }
    }
    class A extends R {
    }
    class $ extends O {
    }
    $.kind = "else";
    class b extends O {
      constructor(n, g) {
        super(g), this.condition = n;
      }
      render(n) {
        let g = `if(${this.condition})` + super.render(n);
        return this.else && (g += "else " + this.else.render(n)), g;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const n = this.condition;
        if (n === !0)
          return this.nodes;
        let g = this.else;
        if (g) {
          const j = g.optimizeNodes();
          g = this.else = Array.isArray(j) ? new $(j) : j;
        }
        if (g)
          return n === !1 ? g instanceof b ? g : g.nodes : this.nodes.length ? this : new b(le(n), g instanceof b ? [g] : g.nodes);
        if (!(n === !1 || !this.nodes.length))
          return this;
      }
      optimizeNames(n, g) {
        var j;
        if (this.else = (j = this.else) === null || j === void 0 ? void 0 : j.optimizeNames(n, g), !!(super.optimizeNames(n, g) || this.else))
          return this.condition = B(this.condition, n, g), this;
      }
      get names() {
        const n = super.names;
        return z(n, this.condition), this.else && H(n, this.else.names), n;
      }
    }
    b.kind = "if";
    class p extends O {
    }
    p.kind = "for";
    class w extends p {
      constructor(n) {
        super(), this.iteration = n;
      }
      render(n) {
        return `for(${this.iteration})` + super.render(n);
      }
      optimizeNames(n, g) {
        if (super.optimizeNames(n, g))
          return this.iteration = B(this.iteration, n, g), this;
      }
      get names() {
        return H(super.names, this.iteration.names);
      }
    }
    class P extends p {
      constructor(n, g, j, q) {
        super(), this.varKind = n, this.name = g, this.from = j, this.to = q;
      }
      render(n) {
        const g = n.es5 ? i.varKinds.var : this.varKind, { name: j, from: q, to: F } = this;
        return `for(${g} ${j}=${q}; ${j}<${F}; ${j}++)` + super.render(n);
      }
      get names() {
        const n = z(super.names, this.from);
        return z(n, this.to);
      }
    }
    class d extends p {
      constructor(n, g, j, q) {
        super(), this.loop = n, this.varKind = g, this.name = j, this.iterable = q;
      }
      render(n) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(n);
      }
      optimizeNames(n, g) {
        if (super.optimizeNames(n, g))
          return this.iterable = B(this.iterable, n, g), this;
      }
      get names() {
        return H(super.names, this.iterable.names);
      }
    }
    class y extends O {
      constructor(n, g, j) {
        super(), this.name = n, this.args = g, this.async = j;
      }
      render(n) {
        return `${this.async ? "async " : ""}function ${this.name}(${this.args})` + super.render(n);
      }
    }
    y.kind = "func";
    class S extends R {
      render(n) {
        return "return " + super.render(n);
      }
    }
    S.kind = "return";
    class C extends O {
      render(n) {
        let g = "try" + super.render(n);
        return this.catch && (g += this.catch.render(n)), this.finally && (g += this.finally.render(n)), g;
      }
      optimizeNodes() {
        var n, g;
        return super.optimizeNodes(), (n = this.catch) === null || n === void 0 || n.optimizeNodes(), (g = this.finally) === null || g === void 0 || g.optimizeNodes(), this;
      }
      optimizeNames(n, g) {
        var j, q;
        return super.optimizeNames(n, g), (j = this.catch) === null || j === void 0 || j.optimizeNames(n, g), (q = this.finally) === null || q === void 0 || q.optimizeNames(n, g), this;
      }
      get names() {
        const n = super.names;
        return this.catch && H(n, this.catch.names), this.finally && H(n, this.finally.names), n;
      }
    }
    class M extends O {
      constructor(n) {
        super(), this.error = n;
      }
      render(n) {
        return `catch(${this.error})` + super.render(n);
      }
    }
    M.kind = "catch";
    class x extends O {
      render(n) {
        return "finally" + super.render(n);
      }
    }
    x.kind = "finally";
    class V {
      constructor(n, g = {}) {
        this._values = {}, this._blockStarts = [], this._constants = {}, this.opts = { ...g, _n: g.lines ? `
` : "" }, this._extScope = n, this._scope = new i.Scope({ parent: n }), this._nodes = [new A()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(n) {
        return this._scope.name(n);
      }
      // reserves unique name in the external scope
      scopeName(n) {
        return this._extScope.name(n);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(n, g) {
        const j = this._extScope.value(n, g);
        return (this._values[j.prefix] || (this._values[j.prefix] = /* @__PURE__ */ new Set())).add(j), j;
      }
      getScopeValue(n, g) {
        return this._extScope.getValue(n, g);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(n) {
        return this._extScope.scopeRefs(n, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(n, g, j, q) {
        const F = this._scope.toName(g);
        return j !== void 0 && q && (this._constants[F.str] = j), this._leafNode(new a(n, F, j)), F;
      }
      // `const` declaration (`var` in es5 mode)
      const(n, g, j) {
        return this._def(i.varKinds.const, n, g, j);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(n, g, j) {
        return this._def(i.varKinds.let, n, g, j);
      }
      // `var` declaration with optional assignment
      var(n, g, j) {
        return this._def(i.varKinds.var, n, g, j);
      }
      // assignment code
      assign(n, g, j) {
        return this._leafNode(new f(n, g, j));
      }
      // `+=` code
      add(n, g) {
        return this._leafNode(new l(n, t.operators.ADD, g));
      }
      // appends passed SafeExpr to code or executes Block
      code(n) {
        return typeof n == "function" ? n() : n !== e.nil && this._leafNode(new k(n)), this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...n) {
        const g = ["{"];
        for (const [j, q] of n)
          g.length > 1 && g.push(","), g.push(j), (j !== q || this.opts.es5) && (g.push(":"), (0, e.addCodeArg)(g, q));
        return g.push("}"), new e._Code(g);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(n, g, j) {
        if (this._blockNode(new b(n)), g && j)
          this.code(g).else().code(j).endIf();
        else if (g)
          this.code(g).endIf();
        else if (j)
          throw new Error('CodeGen: "else" body without "then" body');
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(n) {
        return this._elseNode(new b(n));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new $());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(b, $);
      }
      _for(n, g) {
        return this._blockNode(n), g && this.code(g).endFor(), this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(n, g) {
        return this._for(new w(n), g);
      }
      // `for` statement for a range of values
      forRange(n, g, j, q, F = this.opts.es5 ? i.varKinds.var : i.varKinds.let) {
        const K = this._scope.toName(n);
        return this._for(new P(F, K, g, j), () => q(K));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(n, g, j, q = i.varKinds.const) {
        const F = this._scope.toName(n);
        if (this.opts.es5) {
          const K = g instanceof e.Name ? g : this.var("_arr", g);
          return this.forRange("_i", 0, (0, e._)`${K}.length`, (G) => {
            this.var(F, (0, e._)`${K}[${G}]`), j(F);
          });
        }
        return this._for(new d("of", q, F, g), () => j(F));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(n, g, j, q = this.opts.es5 ? i.varKinds.var : i.varKinds.const) {
        if (this.opts.ownProperties)
          return this.forOf(n, (0, e._)`Object.keys(${g})`, j);
        const F = this._scope.toName(n);
        return this._for(new d("in", q, F, g), () => j(F));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(p);
      }
      // `label` statement
      label(n) {
        return this._leafNode(new v(n));
      }
      // `break` statement
      break(n) {
        return this._leafNode(new _(n));
      }
      // `return` statement
      return(n) {
        const g = new S();
        if (this._blockNode(g), this.code(n), g.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(S);
      }
      // `try` statement
      try(n, g, j) {
        if (!g && !j)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const q = new C();
        if (this._blockNode(q), this.code(n), g) {
          const F = this.name("e");
          this._currNode = q.catch = new M(F), g(F);
        }
        return j && (this._currNode = q.finally = new x(), this.code(j)), this._endBlockNode(M, x);
      }
      // `throw` statement
      throw(n) {
        return this._leafNode(new E(n));
      }
      // start self-balancing block
      block(n, g) {
        return this._blockStarts.push(this._nodes.length), n && this.code(n).endBlock(g), this;
      }
      // end the current self-balancing block
      endBlock(n) {
        const g = this._blockStarts.pop();
        if (g === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const j = this._nodes.length - g;
        if (j < 0 || n !== void 0 && j !== n)
          throw new Error(`CodeGen: wrong number of nodes: ${j} vs ${n} expected`);
        return this._nodes.length = g, this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(n, g = e.nil, j, q) {
        return this._blockNode(new y(n, g, j)), q && this.code(q).endFunc(), this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(y);
      }
      optimize(n = 1) {
        for (; n-- > 0; )
          this._root.optimizeNodes(), this._root.optimizeNames(this._root.names, this._constants);
      }
      _leafNode(n) {
        return this._currNode.nodes.push(n), this;
      }
      _blockNode(n) {
        this._currNode.nodes.push(n), this._nodes.push(n);
      }
      _endBlockNode(n, g) {
        const j = this._currNode;
        if (j instanceof n || g && j instanceof g)
          return this._nodes.pop(), this;
        throw new Error(`CodeGen: not in block "${g ? `${n.kind}/${g.kind}` : n.kind}"`);
      }
      _elseNode(n) {
        const g = this._currNode;
        if (!(g instanceof b))
          throw new Error('CodeGen: "else" without "if"');
        return this._currNode = g.else = n, this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const n = this._nodes;
        return n[n.length - 1];
      }
      set _currNode(n) {
        const g = this._nodes;
        g[g.length - 1] = n;
      }
    }
    t.CodeGen = V;
    function H(u, n) {
      for (const g in n)
        u[g] = (u[g] || 0) + (n[g] || 0);
      return u;
    }
    function z(u, n) {
      return n instanceof e._CodeOrName ? H(u, n.names) : u;
    }
    function B(u, n, g) {
      if (u instanceof e.Name)
        return j(u);
      if (!q(u))
        return u;
      return new e._Code(u._items.reduce((F, K) => (K instanceof e.Name && (K = j(K)), K instanceof e._Code ? F.push(...K._items) : F.push(K), F), []));
      function j(F) {
        const K = g[F.str];
        return K === void 0 || n[F.str] !== 1 ? F : (delete n[F.str], K);
      }
      function q(F) {
        return F instanceof e._Code && F._items.some((K) => K instanceof e.Name && n[K.str] === 1 && g[K.str] !== void 0);
      }
    }
    function te(u, n) {
      for (const g in n)
        u[g] = (u[g] || 0) - (n[g] || 0);
    }
    function le(u) {
      return typeof u == "boolean" || typeof u == "number" || u === null ? !u : (0, e._)`!${m(u)}`;
    }
    t.not = le;
    const de = o(t.operators.AND);
    function X(...u) {
      return u.reduce(de);
    }
    t.and = X;
    const fe = o(t.operators.OR);
    function h(...u) {
      return u.reduce(fe);
    }
    t.or = h;
    function o(u) {
      return (n, g) => n === e.nil ? g : g === e.nil ? n : (0, e._)`${m(n)} ${u} ${m(g)}`;
    }
    function m(u) {
      return u instanceof e.Name ? u : (0, e._)`(${u})`;
    }
  })(Yt)), Yt;
}
var W = {}, Vr;
function Q() {
  if (Vr) return W;
  Vr = 1, Object.defineProperty(W, "__esModule", { value: !0 }), W.checkStrictMode = W.getErrorPath = W.Type = W.useFunc = W.setEvaluated = W.evaluatedPropsToName = W.mergeEvaluated = W.eachItem = W.unescapeJsonPointer = W.escapeJsonPointer = W.escapeFragment = W.unescapeFragment = W.schemaRefOrVal = W.schemaHasRulesButRef = W.schemaHasRules = W.checkUnknownRules = W.alwaysValidSchema = W.toHash = void 0;
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ qt();
  function i(d) {
    const y = {};
    for (const S of d)
      y[S] = !0;
    return y;
  }
  W.toHash = i;
  function s(d, y) {
    return typeof y == "boolean" ? y : Object.keys(y).length === 0 ? !0 : (c(d, y), !r(y, d.self.RULES.all));
  }
  W.alwaysValidSchema = s;
  function c(d, y = d.schema) {
    const { opts: S, self: C } = d;
    if (!S.strictSchema || typeof y == "boolean")
      return;
    const M = C.RULES.keywords;
    for (const x in y)
      M[x] || P(d, `unknown keyword: "${x}"`);
  }
  W.checkUnknownRules = c;
  function r(d, y) {
    if (typeof d == "boolean")
      return !d;
    for (const S in d)
      if (y[S])
        return !0;
    return !1;
  }
  W.schemaHasRules = r;
  function a(d, y) {
    if (typeof d == "boolean")
      return !d;
    for (const S in d)
      if (S !== "$ref" && y.all[S])
        return !0;
    return !1;
  }
  W.schemaHasRulesButRef = a;
  function f({ topSchemaRef: d, schemaPath: y }, S, C, M) {
    if (!M) {
      if (typeof S == "number" || typeof S == "boolean")
        return S;
      if (typeof S == "string")
        return (0, t._)`${S}`;
    }
    return (0, t._)`${d}${y}${(0, t.getProperty)(C)}`;
  }
  W.schemaRefOrVal = f;
  function l(d) {
    return E(decodeURIComponent(d));
  }
  W.unescapeFragment = l;
  function v(d) {
    return encodeURIComponent(_(d));
  }
  W.escapeFragment = v;
  function _(d) {
    return typeof d == "number" ? `${d}` : d.replace(/~/g, "~0").replace(/\//g, "~1");
  }
  W.escapeJsonPointer = _;
  function E(d) {
    return d.replace(/~1/g, "/").replace(/~0/g, "~");
  }
  W.unescapeJsonPointer = E;
  function k(d, y) {
    if (Array.isArray(d))
      for (const S of d)
        y(S);
    else
      y(d);
  }
  W.eachItem = k;
  function R({ mergeNames: d, mergeToName: y, mergeValues: S, resultToName: C }) {
    return (M, x, V, H) => {
      const z = V === void 0 ? x : V instanceof t.Name ? (x instanceof t.Name ? d(M, x, V) : y(M, x, V), V) : x instanceof t.Name ? (y(M, V, x), x) : S(x, V);
      return H === t.Name && !(z instanceof t.Name) ? C(M, z) : z;
    };
  }
  W.mergeEvaluated = {
    props: R({
      mergeNames: (d, y, S) => d.if((0, t._)`${S} !== true && ${y} !== undefined`, () => {
        d.if((0, t._)`${y} === true`, () => d.assign(S, !0), () => d.assign(S, (0, t._)`${S} || {}`).code((0, t._)`Object.assign(${S}, ${y})`));
      }),
      mergeToName: (d, y, S) => d.if((0, t._)`${S} !== true`, () => {
        y === !0 ? d.assign(S, !0) : (d.assign(S, (0, t._)`${S} || {}`), A(d, S, y));
      }),
      mergeValues: (d, y) => d === !0 ? !0 : { ...d, ...y },
      resultToName: O
    }),
    items: R({
      mergeNames: (d, y, S) => d.if((0, t._)`${S} !== true && ${y} !== undefined`, () => d.assign(S, (0, t._)`${y} === true ? true : ${S} > ${y} ? ${S} : ${y}`)),
      mergeToName: (d, y, S) => d.if((0, t._)`${S} !== true`, () => d.assign(S, y === !0 ? !0 : (0, t._)`${S} > ${y} ? ${S} : ${y}`)),
      mergeValues: (d, y) => d === !0 ? !0 : Math.max(d, y),
      resultToName: (d, y) => d.var("items", y)
    })
  };
  function O(d, y) {
    if (y === !0)
      return d.var("props", !0);
    const S = d.var("props", (0, t._)`{}`);
    return y !== void 0 && A(d, S, y), S;
  }
  W.evaluatedPropsToName = O;
  function A(d, y, S) {
    Object.keys(S).forEach((C) => d.assign((0, t._)`${y}${(0, t.getProperty)(C)}`, !0));
  }
  W.setEvaluated = A;
  const $ = {};
  function b(d, y) {
    return d.scopeValue("func", {
      ref: y,
      code: $[y.code] || ($[y.code] = new e._Code(y.code))
    });
  }
  W.useFunc = b;
  var p;
  (function(d) {
    d[d.Num = 0] = "Num", d[d.Str = 1] = "Str";
  })(p || (W.Type = p = {}));
  function w(d, y, S) {
    if (d instanceof t.Name) {
      const C = y === p.Num;
      return S ? C ? (0, t._)`"[" + ${d} + "]"` : (0, t._)`"['" + ${d} + "']"` : C ? (0, t._)`"/" + ${d}` : (0, t._)`"/" + ${d}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
    }
    return S ? (0, t.getProperty)(d).toString() : "/" + _(d);
  }
  W.getErrorPath = w;
  function P(d, y, S = d.opts.strictSchema) {
    if (S) {
      if (y = `strict mode: ${y}`, S === !0)
        throw new Error(y);
      d.self.logger.warn(y);
    }
  }
  return W.checkStrictMode = P, W;
}
var Je = {}, zr;
function Ee() {
  if (zr) return Je;
  zr = 1, Object.defineProperty(Je, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = {
    // validation function arguments
    data: new t.Name("data"),
    // data passed to validation function
    // args passed from referencing schema
    valCxt: new t.Name("valCxt"),
    // validation/data context - should not be used directly, it is destructured to the names below
    instancePath: new t.Name("instancePath"),
    parentData: new t.Name("parentData"),
    parentDataProperty: new t.Name("parentDataProperty"),
    rootData: new t.Name("rootData"),
    // root data - same as the data passed to the first/top validation function
    dynamicAnchors: new t.Name("dynamicAnchors"),
    // used to support recursiveRef and dynamicRef
    // function scoped variables
    vErrors: new t.Name("vErrors"),
    // null or array of validation errors
    errors: new t.Name("errors"),
    // counter of validation errors
    this: new t.Name("this"),
    // "globals"
    self: new t.Name("self"),
    scope: new t.Name("scope"),
    // JTD serialize/parse name for JSON string and position
    json: new t.Name("json"),
    jsonPos: new t.Name("jsonPos"),
    jsonLen: new t.Name("jsonLen"),
    jsonPart: new t.Name("jsonPart")
  };
  return Je.default = e, Je;
}
var Hr;
function Ht() {
  return Hr || (Hr = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.extendErrors = t.resetErrorsCount = t.reportExtraError = t.reportError = t.keyword$DataError = t.keywordError = void 0;
    const e = /* @__PURE__ */ J(), i = /* @__PURE__ */ Q(), s = /* @__PURE__ */ Ee();
    t.keywordError = {
      message: ({ keyword: $ }) => (0, e.str)`must pass "${$}" keyword validation`
    }, t.keyword$DataError = {
      message: ({ keyword: $, schemaType: b }) => b ? (0, e.str)`"${$}" keyword must be ${b} ($data)` : (0, e.str)`"${$}" keyword is invalid ($data)`
    };
    function c($, b = t.keywordError, p, w) {
      const { it: P } = $, { gen: d, compositeRule: y, allErrors: S } = P, C = E($, b, p);
      w ?? (y || S) ? l(d, C) : v(P, (0, e._)`[${C}]`);
    }
    t.reportError = c;
    function r($, b = t.keywordError, p) {
      const { it: w } = $, { gen: P, compositeRule: d, allErrors: y } = w, S = E($, b, p);
      l(P, S), d || y || v(w, s.default.vErrors);
    }
    t.reportExtraError = r;
    function a($, b) {
      $.assign(s.default.errors, b), $.if((0, e._)`${s.default.vErrors} !== null`, () => $.if(b, () => $.assign((0, e._)`${s.default.vErrors}.length`, b), () => $.assign(s.default.vErrors, null)));
    }
    t.resetErrorsCount = a;
    function f({ gen: $, keyword: b, schemaValue: p, data: w, errsCount: P, it: d }) {
      if (P === void 0)
        throw new Error("ajv implementation error");
      const y = $.name("err");
      $.forRange("i", P, s.default.errors, (S) => {
        $.const(y, (0, e._)`${s.default.vErrors}[${S}]`), $.if((0, e._)`${y}.instancePath === undefined`, () => $.assign((0, e._)`${y}.instancePath`, (0, e.strConcat)(s.default.instancePath, d.errorPath))), $.assign((0, e._)`${y}.schemaPath`, (0, e.str)`${d.errSchemaPath}/${b}`), d.opts.verbose && ($.assign((0, e._)`${y}.schema`, p), $.assign((0, e._)`${y}.data`, w));
      });
    }
    t.extendErrors = f;
    function l($, b) {
      const p = $.const("err", b);
      $.if((0, e._)`${s.default.vErrors} === null`, () => $.assign(s.default.vErrors, (0, e._)`[${p}]`), (0, e._)`${s.default.vErrors}.push(${p})`), $.code((0, e._)`${s.default.errors}++`);
    }
    function v($, b) {
      const { gen: p, validateName: w, schemaEnv: P } = $;
      P.$async ? p.throw((0, e._)`new ${$.ValidationError}(${b})`) : (p.assign((0, e._)`${w}.errors`, b), p.return(!1));
    }
    const _ = {
      keyword: new e.Name("keyword"),
      schemaPath: new e.Name("schemaPath"),
      // also used in JTD errors
      params: new e.Name("params"),
      propertyName: new e.Name("propertyName"),
      message: new e.Name("message"),
      schema: new e.Name("schema"),
      parentSchema: new e.Name("parentSchema")
    };
    function E($, b, p) {
      const { createErrors: w } = $.it;
      return w === !1 ? (0, e._)`{}` : k($, b, p);
    }
    function k($, b, p = {}) {
      const { gen: w, it: P } = $, d = [
        R(P, p),
        O($, p)
      ];
      return A($, b, d), w.object(...d);
    }
    function R({ errorPath: $ }, { instancePath: b }) {
      const p = b ? (0, e.str)`${$}${(0, i.getErrorPath)(b, i.Type.Str)}` : $;
      return [s.default.instancePath, (0, e.strConcat)(s.default.instancePath, p)];
    }
    function O({ keyword: $, it: { errSchemaPath: b } }, { schemaPath: p, parentSchema: w }) {
      let P = w ? b : (0, e.str)`${b}/${$}`;
      return p && (P = (0, e.str)`${P}${(0, i.getErrorPath)(p, i.Type.Str)}`), [_.schemaPath, P];
    }
    function A($, { params: b, message: p }, w) {
      const { keyword: P, data: d, schemaValue: y, it: S } = $, { opts: C, propertyName: M, topSchemaRef: x, schemaPath: V } = S;
      w.push([_.keyword, P], [_.params, typeof b == "function" ? b($) : b || (0, e._)`{}`]), C.messages && w.push([_.message, typeof p == "function" ? p($) : p]), C.verbose && w.push([_.schema, y], [_.parentSchema, (0, e._)`${x}${V}`], [s.default.data, d]), M && w.push([_.propertyName, M]);
    }
  })(Xt)), Xt;
}
var Lr;
function Kn() {
  if (Lr) return Pe;
  Lr = 1, Object.defineProperty(Pe, "__esModule", { value: !0 }), Pe.boolOrEmptySchema = Pe.topBoolOrEmptySchema = void 0;
  const t = /* @__PURE__ */ Ht(), e = /* @__PURE__ */ J(), i = /* @__PURE__ */ Ee(), s = {
    message: "boolean schema is false"
  };
  function c(f) {
    const { gen: l, schema: v, validateName: _ } = f;
    v === !1 ? a(f, !1) : typeof v == "object" && v.$async === !0 ? l.return(i.default.data) : (l.assign((0, e._)`${_}.errors`, null), l.return(!0));
  }
  Pe.topBoolOrEmptySchema = c;
  function r(f, l) {
    const { gen: v, schema: _ } = f;
    _ === !1 ? (v.var(l, !1), a(f)) : v.var(l, !0);
  }
  Pe.boolOrEmptySchema = r;
  function a(f, l) {
    const { gen: v, data: _ } = f, E = {
      gen: v,
      keyword: "false schema",
      data: _,
      schema: !1,
      schemaCode: !1,
      schemaValue: !1,
      params: {},
      it: f
    };
    (0, t.reportError)(E, s, void 0, l);
  }
  return Pe;
}
var oe = {}, Re = {}, Kr;
function sn() {
  if (Kr) return Re;
  Kr = 1, Object.defineProperty(Re, "__esModule", { value: !0 }), Re.getRules = Re.isJSONType = void 0;
  const t = ["string", "number", "integer", "boolean", "null", "object", "array"], e = new Set(t);
  function i(c) {
    return typeof c == "string" && e.has(c);
  }
  Re.isJSONType = i;
  function s() {
    const c = {
      number: { type: "number", rules: [] },
      string: { type: "string", rules: [] },
      array: { type: "array", rules: [] },
      object: { type: "object", rules: [] }
    };
    return {
      types: { ...c, integer: !0, boolean: !0, null: !0 },
      rules: [{ rules: [] }, c.number, c.string, c.array, c.object],
      post: { rules: [] },
      all: {},
      keywords: {}
    };
  }
  return Re.getRules = s, Re;
}
var ve = {}, Gr;
function nn() {
  if (Gr) return ve;
  Gr = 1, Object.defineProperty(ve, "__esModule", { value: !0 }), ve.shouldUseRule = ve.shouldUseGroup = ve.schemaHasRulesForType = void 0;
  function t({ schema: s, self: c }, r) {
    const a = c.RULES.types[r];
    return a && a !== !0 && e(s, a);
  }
  ve.schemaHasRulesForType = t;
  function e(s, c) {
    return c.rules.some((r) => i(s, r));
  }
  ve.shouldUseGroup = e;
  function i(s, c) {
    var r;
    return s[c.keyword] !== void 0 || ((r = c.definition.implements) === null || r === void 0 ? void 0 : r.some((a) => s[a] !== void 0));
  }
  return ve.shouldUseRule = i, ve;
}
var Br;
function Mt() {
  if (Br) return oe;
  Br = 1, Object.defineProperty(oe, "__esModule", { value: !0 }), oe.reportTypeError = oe.checkDataTypes = oe.checkDataType = oe.coerceAndCheckDataType = oe.getJSONTypes = oe.getSchemaTypes = oe.DataType = void 0;
  const t = /* @__PURE__ */ sn(), e = /* @__PURE__ */ nn(), i = /* @__PURE__ */ Ht(), s = /* @__PURE__ */ J(), c = /* @__PURE__ */ Q();
  var r;
  (function(p) {
    p[p.Correct = 0] = "Correct", p[p.Wrong = 1] = "Wrong";
  })(r || (oe.DataType = r = {}));
  function a(p) {
    const w = f(p.type);
    if (w.includes("null")) {
      if (p.nullable === !1)
        throw new Error("type: null contradicts nullable: false");
    } else {
      if (!w.length && p.nullable !== void 0)
        throw new Error('"nullable" cannot be used without "type"');
      p.nullable === !0 && w.push("null");
    }
    return w;
  }
  oe.getSchemaTypes = a;
  function f(p) {
    const w = Array.isArray(p) ? p : p ? [p] : [];
    if (w.every(t.isJSONType))
      return w;
    throw new Error("type must be JSONType or JSONType[]: " + w.join(","));
  }
  oe.getJSONTypes = f;
  function l(p, w) {
    const { gen: P, data: d, opts: y } = p, S = _(w, y.coerceTypes), C = w.length > 0 && !(S.length === 0 && w.length === 1 && (0, e.schemaHasRulesForType)(p, w[0]));
    if (C) {
      const M = O(w, d, y.strictNumbers, r.Wrong);
      P.if(M, () => {
        S.length ? E(p, w, S) : $(p);
      });
    }
    return C;
  }
  oe.coerceAndCheckDataType = l;
  const v = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
  function _(p, w) {
    return w ? p.filter((P) => v.has(P) || w === "array" && P === "array") : [];
  }
  function E(p, w, P) {
    const { gen: d, data: y, opts: S } = p, C = d.let("dataType", (0, s._)`typeof ${y}`), M = d.let("coerced", (0, s._)`undefined`);
    S.coerceTypes === "array" && d.if((0, s._)`${C} == 'object' && Array.isArray(${y}) && ${y}.length == 1`, () => d.assign(y, (0, s._)`${y}[0]`).assign(C, (0, s._)`typeof ${y}`).if(O(w, y, S.strictNumbers), () => d.assign(M, y))), d.if((0, s._)`${M} !== undefined`);
    for (const V of P)
      (v.has(V) || V === "array" && S.coerceTypes === "array") && x(V);
    d.else(), $(p), d.endIf(), d.if((0, s._)`${M} !== undefined`, () => {
      d.assign(y, M), k(p, M);
    });
    function x(V) {
      switch (V) {
        case "string":
          d.elseIf((0, s._)`${C} == "number" || ${C} == "boolean"`).assign(M, (0, s._)`"" + ${y}`).elseIf((0, s._)`${y} === null`).assign(M, (0, s._)`""`);
          return;
        case "number":
          d.elseIf((0, s._)`${C} == "boolean" || ${y} === null
              || (${C} == "string" && ${y} && ${y} == +${y})`).assign(M, (0, s._)`+${y}`);
          return;
        case "integer":
          d.elseIf((0, s._)`${C} === "boolean" || ${y} === null
              || (${C} === "string" && ${y} && ${y} == +${y} && !(${y} % 1))`).assign(M, (0, s._)`+${y}`);
          return;
        case "boolean":
          d.elseIf((0, s._)`${y} === "false" || ${y} === 0 || ${y} === null`).assign(M, !1).elseIf((0, s._)`${y} === "true" || ${y} === 1`).assign(M, !0);
          return;
        case "null":
          d.elseIf((0, s._)`${y} === "" || ${y} === 0 || ${y} === false`), d.assign(M, null);
          return;
        case "array":
          d.elseIf((0, s._)`${C} === "string" || ${C} === "number"
              || ${C} === "boolean" || ${y} === null`).assign(M, (0, s._)`[${y}]`);
      }
    }
  }
  function k({ gen: p, parentData: w, parentDataProperty: P }, d) {
    p.if((0, s._)`${w} !== undefined`, () => p.assign((0, s._)`${w}[${P}]`, d));
  }
  function R(p, w, P, d = r.Correct) {
    const y = d === r.Correct ? s.operators.EQ : s.operators.NEQ;
    let S;
    switch (p) {
      case "null":
        return (0, s._)`${w} ${y} null`;
      case "array":
        S = (0, s._)`Array.isArray(${w})`;
        break;
      case "object":
        S = (0, s._)`${w} && typeof ${w} == "object" && !Array.isArray(${w})`;
        break;
      case "integer":
        S = C((0, s._)`!(${w} % 1) && !isNaN(${w})`);
        break;
      case "number":
        S = C();
        break;
      default:
        return (0, s._)`typeof ${w} ${y} ${p}`;
    }
    return d === r.Correct ? S : (0, s.not)(S);
    function C(M = s.nil) {
      return (0, s.and)((0, s._)`typeof ${w} == "number"`, M, P ? (0, s._)`isFinite(${w})` : s.nil);
    }
  }
  oe.checkDataType = R;
  function O(p, w, P, d) {
    if (p.length === 1)
      return R(p[0], w, P, d);
    let y;
    const S = (0, c.toHash)(p);
    if (S.array && S.object) {
      const C = (0, s._)`typeof ${w} != "object"`;
      y = S.null ? C : (0, s._)`!${w} || ${C}`, delete S.null, delete S.array, delete S.object;
    } else
      y = s.nil;
    S.number && delete S.integer;
    for (const C in S)
      y = (0, s.and)(y, R(C, w, P, d));
    return y;
  }
  oe.checkDataTypes = O;
  const A = {
    message: ({ schema: p }) => `must be ${p}`,
    params: ({ schema: p, schemaValue: w }) => typeof p == "string" ? (0, s._)`{type: ${p}}` : (0, s._)`{type: ${w}}`
  };
  function $(p) {
    const w = b(p);
    (0, i.reportError)(w, A);
  }
  oe.reportTypeError = $;
  function b(p) {
    const { gen: w, data: P, schema: d } = p, y = (0, c.schemaRefOrVal)(p, d, "type");
    return {
      gen: w,
      keyword: "type",
      data: P,
      schema: d.type,
      schemaCode: y,
      schemaValue: y,
      parentSchema: d,
      params: {},
      it: p
    };
  }
  return oe;
}
var xe = {}, Wr;
function Gn() {
  if (Wr) return xe;
  Wr = 1, Object.defineProperty(xe, "__esModule", { value: !0 }), xe.assignDefaults = void 0;
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q();
  function i(c, r) {
    const { properties: a, items: f } = c.schema;
    if (r === "object" && a)
      for (const l in a)
        s(c, l, a[l].default);
    else r === "array" && Array.isArray(f) && f.forEach((l, v) => s(c, v, l.default));
  }
  xe.assignDefaults = i;
  function s(c, r, a) {
    const { gen: f, compositeRule: l, data: v, opts: _ } = c;
    if (a === void 0)
      return;
    const E = (0, t._)`${v}${(0, t.getProperty)(r)}`;
    if (l) {
      (0, e.checkStrictMode)(c, `default is ignored for: ${E}`);
      return;
    }
    let k = (0, t._)`${E} === undefined`;
    _.useDefaults === "empty" && (k = (0, t._)`${k} || ${E} === null || ${E} === ""`), f.if(k, (0, t._)`${E} = ${(0, t.stringify)(a)}`);
  }
  return xe;
}
var me = {}, Y = {}, Jr;
function ge() {
  if (Jr) return Y;
  Jr = 1, Object.defineProperty(Y, "__esModule", { value: !0 }), Y.validateUnion = Y.validateArray = Y.usePattern = Y.callValidateCode = Y.schemaProperties = Y.allSchemaProperties = Y.noPropertyInData = Y.propertyInData = Y.isOwnProperty = Y.hasPropFunc = Y.reportMissingProp = Y.checkMissingProp = Y.checkReportMissingProp = void 0;
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), i = /* @__PURE__ */ Ee(), s = /* @__PURE__ */ Q();
  function c(p, w) {
    const { gen: P, data: d, it: y } = p;
    P.if(_(P, d, w, y.opts.ownProperties), () => {
      p.setParams({ missingProperty: (0, t._)`${w}` }, !0), p.error();
    });
  }
  Y.checkReportMissingProp = c;
  function r({ gen: p, data: w, it: { opts: P } }, d, y) {
    return (0, t.or)(...d.map((S) => (0, t.and)(_(p, w, S, P.ownProperties), (0, t._)`${y} = ${S}`)));
  }
  Y.checkMissingProp = r;
  function a(p, w) {
    p.setParams({ missingProperty: w }, !0), p.error();
  }
  Y.reportMissingProp = a;
  function f(p) {
    return p.scopeValue("func", {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ref: Object.prototype.hasOwnProperty,
      code: (0, t._)`Object.prototype.hasOwnProperty`
    });
  }
  Y.hasPropFunc = f;
  function l(p, w, P) {
    return (0, t._)`${f(p)}.call(${w}, ${P})`;
  }
  Y.isOwnProperty = l;
  function v(p, w, P, d) {
    const y = (0, t._)`${w}${(0, t.getProperty)(P)} !== undefined`;
    return d ? (0, t._)`${y} && ${l(p, w, P)}` : y;
  }
  Y.propertyInData = v;
  function _(p, w, P, d) {
    const y = (0, t._)`${w}${(0, t.getProperty)(P)} === undefined`;
    return d ? (0, t.or)(y, (0, t.not)(l(p, w, P))) : y;
  }
  Y.noPropertyInData = _;
  function E(p) {
    return p ? Object.keys(p).filter((w) => w !== "__proto__") : [];
  }
  Y.allSchemaProperties = E;
  function k(p, w) {
    return E(w).filter((P) => !(0, e.alwaysValidSchema)(p, w[P]));
  }
  Y.schemaProperties = k;
  function R({ schemaCode: p, data: w, it: { gen: P, topSchemaRef: d, schemaPath: y, errorPath: S }, it: C }, M, x, V) {
    const H = V ? (0, t._)`${p}, ${w}, ${d}${y}` : w, z = [
      [i.default.instancePath, (0, t.strConcat)(i.default.instancePath, S)],
      [i.default.parentData, C.parentData],
      [i.default.parentDataProperty, C.parentDataProperty],
      [i.default.rootData, i.default.rootData]
    ];
    C.opts.dynamicRef && z.push([i.default.dynamicAnchors, i.default.dynamicAnchors]);
    const B = (0, t._)`${H}, ${P.object(...z)}`;
    return x !== t.nil ? (0, t._)`${M}.call(${x}, ${B})` : (0, t._)`${M}(${B})`;
  }
  Y.callValidateCode = R;
  const O = (0, t._)`new RegExp`;
  function A({ gen: p, it: { opts: w } }, P) {
    const d = w.unicodeRegExp ? "u" : "", { regExp: y } = w.code, S = y(P, d);
    return p.scopeValue("pattern", {
      key: S.toString(),
      ref: S,
      code: (0, t._)`${y.code === "new RegExp" ? O : (0, s.useFunc)(p, y)}(${P}, ${d})`
    });
  }
  Y.usePattern = A;
  function $(p) {
    const { gen: w, data: P, keyword: d, it: y } = p, S = w.name("valid");
    if (y.allErrors) {
      const M = w.let("valid", !0);
      return C(() => w.assign(M, !1)), M;
    }
    return w.var(S, !0), C(() => w.break()), S;
    function C(M) {
      const x = w.const("len", (0, t._)`${P}.length`);
      w.forRange("i", 0, x, (V) => {
        p.subschema({
          keyword: d,
          dataProp: V,
          dataPropType: e.Type.Num
        }, S), w.if((0, t.not)(S), M);
      });
    }
  }
  Y.validateArray = $;
  function b(p) {
    const { gen: w, schema: P, keyword: d, it: y } = p;
    if (!Array.isArray(P))
      throw new Error("ajv implementation error");
    if (P.some((x) => (0, e.alwaysValidSchema)(y, x)) && !y.opts.unevaluated)
      return;
    const C = w.let("valid", !1), M = w.name("_valid");
    w.block(() => P.forEach((x, V) => {
      const H = p.subschema({
        keyword: d,
        schemaProp: V,
        compositeRule: !0
      }, M);
      w.assign(C, (0, t._)`${C} || ${M}`), p.mergeValidEvaluated(H, M) || w.if((0, t.not)(C));
    })), p.result(C, () => p.reset(), () => p.error(!0));
  }
  return Y.validateUnion = b, Y;
}
var Zr;
function Bn() {
  if (Zr) return me;
  Zr = 1, Object.defineProperty(me, "__esModule", { value: !0 }), me.validateKeywordUsage = me.validSchemaType = me.funcKeywordCode = me.macroKeywordCode = void 0;
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Ee(), i = /* @__PURE__ */ ge(), s = /* @__PURE__ */ Ht();
  function c(k, R) {
    const { gen: O, keyword: A, schema: $, parentSchema: b, it: p } = k, w = R.macro.call(p.self, $, b, p), P = v(O, A, w);
    p.opts.validateSchema !== !1 && p.self.validateSchema(w, !0);
    const d = O.name("valid");
    k.subschema({
      schema: w,
      schemaPath: t.nil,
      errSchemaPath: `${p.errSchemaPath}/${A}`,
      topSchemaRef: P,
      compositeRule: !0
    }, d), k.pass(d, () => k.error(!0));
  }
  me.macroKeywordCode = c;
  function r(k, R) {
    var O;
    const { gen: A, keyword: $, schema: b, parentSchema: p, $data: w, it: P } = k;
    l(P, R);
    const d = !w && R.compile ? R.compile.call(P.self, b, p, P) : R.validate, y = v(A, $, d), S = A.let("valid");
    k.block$data(S, C), k.ok((O = R.valid) !== null && O !== void 0 ? O : S);
    function C() {
      if (R.errors === !1)
        V(), R.modifying && a(k), H(() => k.error());
      else {
        const z = R.async ? M() : x();
        R.modifying && a(k), H(() => f(k, z));
      }
    }
    function M() {
      const z = A.let("ruleErrs", null);
      return A.try(() => V((0, t._)`await `), (B) => A.assign(S, !1).if((0, t._)`${B} instanceof ${P.ValidationError}`, () => A.assign(z, (0, t._)`${B}.errors`), () => A.throw(B))), z;
    }
    function x() {
      const z = (0, t._)`${y}.errors`;
      return A.assign(z, null), V(t.nil), z;
    }
    function V(z = R.async ? (0, t._)`await ` : t.nil) {
      const B = P.opts.passContext ? e.default.this : e.default.self, te = !("compile" in R && !w || R.schema === !1);
      A.assign(S, (0, t._)`${z}${(0, i.callValidateCode)(k, y, B, te)}`, R.modifying);
    }
    function H(z) {
      var B;
      A.if((0, t.not)((B = R.valid) !== null && B !== void 0 ? B : S), z);
    }
  }
  me.funcKeywordCode = r;
  function a(k) {
    const { gen: R, data: O, it: A } = k;
    R.if(A.parentData, () => R.assign(O, (0, t._)`${A.parentData}[${A.parentDataProperty}]`));
  }
  function f(k, R) {
    const { gen: O } = k;
    O.if((0, t._)`Array.isArray(${R})`, () => {
      O.assign(e.default.vErrors, (0, t._)`${e.default.vErrors} === null ? ${R} : ${e.default.vErrors}.concat(${R})`).assign(e.default.errors, (0, t._)`${e.default.vErrors}.length`), (0, s.extendErrors)(k);
    }, () => k.error());
  }
  function l({ schemaEnv: k }, R) {
    if (R.async && !k.$async)
      throw new Error("async keyword in sync schema");
  }
  function v(k, R, O) {
    if (O === void 0)
      throw new Error(`keyword "${R}" failed to compile`);
    return k.scopeValue("keyword", typeof O == "function" ? { ref: O } : { ref: O, code: (0, t.stringify)(O) });
  }
  function _(k, R, O = !1) {
    return !R.length || R.some((A) => A === "array" ? Array.isArray(k) : A === "object" ? k && typeof k == "object" && !Array.isArray(k) : typeof k == A || O && typeof k > "u");
  }
  me.validSchemaType = _;
  function E({ schema: k, opts: R, self: O, errSchemaPath: A }, $, b) {
    if (Array.isArray($.keyword) ? !$.keyword.includes(b) : $.keyword !== b)
      throw new Error("ajv implementation error");
    const p = $.dependencies;
    if (p?.some((w) => !Object.prototype.hasOwnProperty.call(k, w)))
      throw new Error(`parent schema must have dependencies of ${b}: ${p.join(",")}`);
    if ($.validateSchema && !$.validateSchema(k[b])) {
      const P = `keyword "${b}" value is invalid at path "${A}": ` + O.errorsText($.validateSchema.errors);
      if (R.validateSchema === "log")
        O.logger.error(P);
      else
        throw new Error(P);
    }
  }
  return me.validateKeywordUsage = E, me;
}
var _e = {}, Qr;
function Wn() {
  if (Qr) return _e;
  Qr = 1, Object.defineProperty(_e, "__esModule", { value: !0 }), _e.extendSubschemaMode = _e.extendSubschemaData = _e.getSubschema = void 0;
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q();
  function i(r, { keyword: a, schemaProp: f, schema: l, schemaPath: v, errSchemaPath: _, topSchemaRef: E }) {
    if (a !== void 0 && l !== void 0)
      throw new Error('both "keyword" and "schema" passed, only one allowed');
    if (a !== void 0) {
      const k = r.schema[a];
      return f === void 0 ? {
        schema: k,
        schemaPath: (0, t._)`${r.schemaPath}${(0, t.getProperty)(a)}`,
        errSchemaPath: `${r.errSchemaPath}/${a}`
      } : {
        schema: k[f],
        schemaPath: (0, t._)`${r.schemaPath}${(0, t.getProperty)(a)}${(0, t.getProperty)(f)}`,
        errSchemaPath: `${r.errSchemaPath}/${a}/${(0, e.escapeFragment)(f)}`
      };
    }
    if (l !== void 0) {
      if (v === void 0 || _ === void 0 || E === void 0)
        throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
      return {
        schema: l,
        schemaPath: v,
        topSchemaRef: E,
        errSchemaPath: _
      };
    }
    throw new Error('either "keyword" or "schema" must be passed');
  }
  _e.getSubschema = i;
  function s(r, a, { dataProp: f, dataPropType: l, data: v, dataTypes: _, propertyName: E }) {
    if (v !== void 0 && f !== void 0)
      throw new Error('both "data" and "dataProp" passed, only one allowed');
    const { gen: k } = a;
    if (f !== void 0) {
      const { errorPath: O, dataPathArr: A, opts: $ } = a, b = k.let("data", (0, t._)`${a.data}${(0, t.getProperty)(f)}`, !0);
      R(b), r.errorPath = (0, t.str)`${O}${(0, e.getErrorPath)(f, l, $.jsPropertySyntax)}`, r.parentDataProperty = (0, t._)`${f}`, r.dataPathArr = [...A, r.parentDataProperty];
    }
    if (v !== void 0) {
      const O = v instanceof t.Name ? v : k.let("data", v, !0);
      R(O), E !== void 0 && (r.propertyName = E);
    }
    _ && (r.dataTypes = _);
    function R(O) {
      r.data = O, r.dataLevel = a.dataLevel + 1, r.dataTypes = [], a.definedProperties = /* @__PURE__ */ new Set(), r.parentData = a.data, r.dataNames = [...a.dataNames, O];
    }
  }
  _e.extendSubschemaData = s;
  function c(r, { jtdDiscriminator: a, jtdMetadata: f, compositeRule: l, createErrors: v, allErrors: _ }) {
    l !== void 0 && (r.compositeRule = l), v !== void 0 && (r.createErrors = v), _ !== void 0 && (r.allErrors = _), r.jtdDiscriminator = a, r.jtdMetadata = f;
  }
  return _e.extendSubschemaMode = c, _e;
}
var ue = {}, rr, Xr;
function an() {
  return Xr || (Xr = 1, rr = function t(e, i) {
    if (e === i) return !0;
    if (e && i && typeof e == "object" && typeof i == "object") {
      if (e.constructor !== i.constructor) return !1;
      var s, c, r;
      if (Array.isArray(e)) {
        if (s = e.length, s != i.length) return !1;
        for (c = s; c-- !== 0; )
          if (!t(e[c], i[c])) return !1;
        return !0;
      }
      if (e.constructor === RegExp) return e.source === i.source && e.flags === i.flags;
      if (e.valueOf !== Object.prototype.valueOf) return e.valueOf() === i.valueOf();
      if (e.toString !== Object.prototype.toString) return e.toString() === i.toString();
      if (r = Object.keys(e), s = r.length, s !== Object.keys(i).length) return !1;
      for (c = s; c-- !== 0; )
        if (!Object.prototype.hasOwnProperty.call(i, r[c])) return !1;
      for (c = s; c-- !== 0; ) {
        var a = r[c];
        if (!t(e[a], i[a])) return !1;
      }
      return !0;
    }
    return e !== e && i !== i;
  }), rr;
}
var sr = { exports: {} }, Yr;
function Jn() {
  if (Yr) return sr.exports;
  Yr = 1;
  var t = sr.exports = function(s, c, r) {
    typeof c == "function" && (r = c, c = {}), r = c.cb || r;
    var a = typeof r == "function" ? r : r.pre || function() {
    }, f = r.post || function() {
    };
    e(c, a, f, s, "", s);
  };
  t.keywords = {
    additionalItems: !0,
    items: !0,
    contains: !0,
    additionalProperties: !0,
    propertyNames: !0,
    not: !0,
    if: !0,
    then: !0,
    else: !0
  }, t.arrayKeywords = {
    items: !0,
    allOf: !0,
    anyOf: !0,
    oneOf: !0
  }, t.propsKeywords = {
    $defs: !0,
    definitions: !0,
    properties: !0,
    patternProperties: !0,
    dependencies: !0
  }, t.skipKeywords = {
    default: !0,
    enum: !0,
    const: !0,
    required: !0,
    maximum: !0,
    minimum: !0,
    exclusiveMaximum: !0,
    exclusiveMinimum: !0,
    multipleOf: !0,
    maxLength: !0,
    minLength: !0,
    pattern: !0,
    format: !0,
    maxItems: !0,
    minItems: !0,
    uniqueItems: !0,
    maxProperties: !0,
    minProperties: !0
  };
  function e(s, c, r, a, f, l, v, _, E, k) {
    if (a && typeof a == "object" && !Array.isArray(a)) {
      c(a, f, l, v, _, E, k);
      for (var R in a) {
        var O = a[R];
        if (Array.isArray(O)) {
          if (R in t.arrayKeywords)
            for (var A = 0; A < O.length; A++)
              e(s, c, r, O[A], f + "/" + R + "/" + A, l, f, R, a, A);
        } else if (R in t.propsKeywords) {
          if (O && typeof O == "object")
            for (var $ in O)
              e(s, c, r, O[$], f + "/" + R + "/" + i($), l, f, R, a, $);
        } else (R in t.keywords || s.allKeys && !(R in t.skipKeywords)) && e(s, c, r, O, f + "/" + R, l, f, R, a);
      }
      r(a, f, l, v, _, E, k);
    }
  }
  function i(s) {
    return s.replace(/~/g, "~0").replace(/\//g, "~1");
  }
  return sr.exports;
}
var es;
function Lt() {
  if (es) return ue;
  es = 1, Object.defineProperty(ue, "__esModule", { value: !0 }), ue.getSchemaRefs = ue.resolveUrl = ue.normalizeId = ue._getFullPath = ue.getFullPath = ue.inlineRef = void 0;
  const t = /* @__PURE__ */ Q(), e = an(), i = Jn(), s = /* @__PURE__ */ new Set([
    "type",
    "format",
    "pattern",
    "maxLength",
    "minLength",
    "maxProperties",
    "minProperties",
    "maxItems",
    "minItems",
    "maximum",
    "minimum",
    "uniqueItems",
    "multipleOf",
    "required",
    "enum",
    "const"
  ]);
  function c(A, $ = !0) {
    return typeof A == "boolean" ? !0 : $ === !0 ? !a(A) : $ ? f(A) <= $ : !1;
  }
  ue.inlineRef = c;
  const r = /* @__PURE__ */ new Set([
    "$ref",
    "$recursiveRef",
    "$recursiveAnchor",
    "$dynamicRef",
    "$dynamicAnchor"
  ]);
  function a(A) {
    for (const $ in A) {
      if (r.has($))
        return !0;
      const b = A[$];
      if (Array.isArray(b) && b.some(a) || typeof b == "object" && a(b))
        return !0;
    }
    return !1;
  }
  function f(A) {
    let $ = 0;
    for (const b in A) {
      if (b === "$ref")
        return 1 / 0;
      if ($++, !s.has(b) && (typeof A[b] == "object" && (0, t.eachItem)(A[b], (p) => $ += f(p)), $ === 1 / 0))
        return 1 / 0;
    }
    return $;
  }
  function l(A, $ = "", b) {
    b !== !1 && ($ = E($));
    const p = A.parse($);
    return v(A, p);
  }
  ue.getFullPath = l;
  function v(A, $) {
    return A.serialize($).split("#")[0] + "#";
  }
  ue._getFullPath = v;
  const _ = /#\/?$/;
  function E(A) {
    return A ? A.replace(_, "") : "";
  }
  ue.normalizeId = E;
  function k(A, $, b) {
    return b = E(b), A.resolve($, b);
  }
  ue.resolveUrl = k;
  const R = /^[a-z_][-a-z0-9._]*$/i;
  function O(A, $) {
    if (typeof A == "boolean")
      return {};
    const { schemaId: b, uriResolver: p } = this.opts, w = E(A[b] || $), P = { "": w }, d = l(p, w, !1), y = {}, S = /* @__PURE__ */ new Set();
    return i(A, { allKeys: !0 }, (x, V, H, z) => {
      if (z === void 0)
        return;
      const B = d + V;
      let te = P[z];
      typeof x[b] == "string" && (te = le.call(this, x[b])), de.call(this, x.$anchor), de.call(this, x.$dynamicAnchor), P[V] = te;
      function le(X) {
        const fe = this.opts.uriResolver.resolve;
        if (X = E(te ? fe(te, X) : X), S.has(X))
          throw M(X);
        S.add(X);
        let h = this.refs[X];
        return typeof h == "string" && (h = this.refs[h]), typeof h == "object" ? C(x, h.schema, X) : X !== E(B) && (X[0] === "#" ? (C(x, y[X], X), y[X] = x) : this.refs[X] = B), X;
      }
      function de(X) {
        if (typeof X == "string") {
          if (!R.test(X))
            throw new Error(`invalid anchor "${X}"`);
          le.call(this, `#${X}`);
        }
      }
    }), y;
    function C(x, V, H) {
      if (V !== void 0 && !e(x, V))
        throw M(H);
    }
    function M(x) {
      return new Error(`reference "${x}" resolves to more than one schema`);
    }
  }
  return ue.getSchemaRefs = O, ue;
}
var ts;
function Kt() {
  if (ts) return ye;
  ts = 1, Object.defineProperty(ye, "__esModule", { value: !0 }), ye.getData = ye.KeywordCxt = ye.validateFunctionCode = void 0;
  const t = /* @__PURE__ */ Kn(), e = /* @__PURE__ */ Mt(), i = /* @__PURE__ */ nn(), s = /* @__PURE__ */ Mt(), c = /* @__PURE__ */ Gn(), r = /* @__PURE__ */ Bn(), a = /* @__PURE__ */ Wn(), f = /* @__PURE__ */ J(), l = /* @__PURE__ */ Ee(), v = /* @__PURE__ */ Lt(), _ = /* @__PURE__ */ Q(), E = /* @__PURE__ */ Ht();
  function k(N) {
    if (d(N) && (S(N), P(N))) {
      $(N);
      return;
    }
    R(N, () => (0, t.topBoolOrEmptySchema)(N));
  }
  ye.validateFunctionCode = k;
  function R({ gen: N, validateName: I, schema: T, schemaEnv: D, opts: U }, L) {
    U.code.es5 ? N.func(I, (0, f._)`${l.default.data}, ${l.default.valCxt}`, D.$async, () => {
      N.code((0, f._)`"use strict"; ${p(T, U)}`), A(N, U), N.code(L);
    }) : N.func(I, (0, f._)`${l.default.data}, ${O(U)}`, D.$async, () => N.code(p(T, U)).code(L));
  }
  function O(N) {
    return (0, f._)`{${l.default.instancePath}="", ${l.default.parentData}, ${l.default.parentDataProperty}, ${l.default.rootData}=${l.default.data}${N.dynamicRef ? (0, f._)`, ${l.default.dynamicAnchors}={}` : f.nil}}={}`;
  }
  function A(N, I) {
    N.if(l.default.valCxt, () => {
      N.var(l.default.instancePath, (0, f._)`${l.default.valCxt}.${l.default.instancePath}`), N.var(l.default.parentData, (0, f._)`${l.default.valCxt}.${l.default.parentData}`), N.var(l.default.parentDataProperty, (0, f._)`${l.default.valCxt}.${l.default.parentDataProperty}`), N.var(l.default.rootData, (0, f._)`${l.default.valCxt}.${l.default.rootData}`), I.dynamicRef && N.var(l.default.dynamicAnchors, (0, f._)`${l.default.valCxt}.${l.default.dynamicAnchors}`);
    }, () => {
      N.var(l.default.instancePath, (0, f._)`""`), N.var(l.default.parentData, (0, f._)`undefined`), N.var(l.default.parentDataProperty, (0, f._)`undefined`), N.var(l.default.rootData, l.default.data), I.dynamicRef && N.var(l.default.dynamicAnchors, (0, f._)`{}`);
    });
  }
  function $(N) {
    const { schema: I, opts: T, gen: D } = N;
    R(N, () => {
      T.$comment && I.$comment && z(N), x(N), D.let(l.default.vErrors, null), D.let(l.default.errors, 0), T.unevaluated && b(N), C(N), B(N);
    });
  }
  function b(N) {
    const { gen: I, validateName: T } = N;
    N.evaluated = I.const("evaluated", (0, f._)`${T}.evaluated`), I.if((0, f._)`${N.evaluated}.dynamicProps`, () => I.assign((0, f._)`${N.evaluated}.props`, (0, f._)`undefined`)), I.if((0, f._)`${N.evaluated}.dynamicItems`, () => I.assign((0, f._)`${N.evaluated}.items`, (0, f._)`undefined`));
  }
  function p(N, I) {
    const T = typeof N == "object" && N[I.schemaId];
    return T && (I.code.source || I.code.process) ? (0, f._)`/*# sourceURL=${T} */` : f.nil;
  }
  function w(N, I) {
    if (d(N) && (S(N), P(N))) {
      y(N, I);
      return;
    }
    (0, t.boolOrEmptySchema)(N, I);
  }
  function P({ schema: N, self: I }) {
    if (typeof N == "boolean")
      return !N;
    for (const T in N)
      if (I.RULES.all[T])
        return !0;
    return !1;
  }
  function d(N) {
    return typeof N.schema != "boolean";
  }
  function y(N, I) {
    const { schema: T, gen: D, opts: U } = N;
    U.$comment && T.$comment && z(N), V(N), H(N);
    const L = D.const("_errs", l.default.errors);
    C(N, L), D.var(I, (0, f._)`${L} === ${l.default.errors}`);
  }
  function S(N) {
    (0, _.checkUnknownRules)(N), M(N);
  }
  function C(N, I) {
    if (N.opts.jtd)
      return le(N, [], !1, I);
    const T = (0, e.getSchemaTypes)(N.schema), D = (0, e.coerceAndCheckDataType)(N, T);
    le(N, T, !D, I);
  }
  function M(N) {
    const { schema: I, errSchemaPath: T, opts: D, self: U } = N;
    I.$ref && D.ignoreKeywordsWithRef && (0, _.schemaHasRulesButRef)(I, U.RULES) && U.logger.warn(`$ref: keywords ignored in schema at path "${T}"`);
  }
  function x(N) {
    const { schema: I, opts: T } = N;
    I.default !== void 0 && T.useDefaults && T.strictSchema && (0, _.checkStrictMode)(N, "default is ignored in the schema root");
  }
  function V(N) {
    const I = N.schema[N.opts.schemaId];
    I && (N.baseId = (0, v.resolveUrl)(N.opts.uriResolver, N.baseId, I));
  }
  function H(N) {
    if (N.schema.$async && !N.schemaEnv.$async)
      throw new Error("async schema in sync schema");
  }
  function z({ gen: N, schemaEnv: I, schema: T, errSchemaPath: D, opts: U }) {
    const L = T.$comment;
    if (U.$comment === !0)
      N.code((0, f._)`${l.default.self}.logger.log(${L})`);
    else if (typeof U.$comment == "function") {
      const se = (0, f.str)`${D}/$comment`, ne = N.scopeValue("root", { ref: I.root });
      N.code((0, f._)`${l.default.self}.opts.$comment(${L}, ${se}, ${ne}.schema)`);
    }
  }
  function B(N) {
    const { gen: I, schemaEnv: T, validateName: D, ValidationError: U, opts: L } = N;
    T.$async ? I.if((0, f._)`${l.default.errors} === 0`, () => I.return(l.default.data), () => I.throw((0, f._)`new ${U}(${l.default.vErrors})`)) : (I.assign((0, f._)`${D}.errors`, l.default.vErrors), L.unevaluated && te(N), I.return((0, f._)`${l.default.errors} === 0`));
  }
  function te({ gen: N, evaluated: I, props: T, items: D }) {
    T instanceof f.Name && N.assign((0, f._)`${I}.props`, T), D instanceof f.Name && N.assign((0, f._)`${I}.items`, D);
  }
  function le(N, I, T, D) {
    const { gen: U, schema: L, data: se, allErrors: ne, opts: re, self: ce } = N, { RULES: ae } = ce;
    if (L.$ref && (re.ignoreKeywordsWithRef || !(0, _.schemaHasRulesButRef)(L, ae))) {
      U.block(() => q(N, "$ref", ae.all.$ref.definition));
      return;
    }
    re.jtd || X(N, I), U.block(() => {
      for (const pe of ae.rules)
        ke(pe);
      ke(ae.post);
    });
    function ke(pe) {
      (0, i.shouldUseGroup)(L, pe) && (pe.type ? (U.if((0, s.checkDataType)(pe.type, se, re.strictNumbers)), de(N, pe), I.length === 1 && I[0] === pe.type && T && (U.else(), (0, s.reportTypeError)(N)), U.endIf()) : de(N, pe), ne || U.if((0, f._)`${l.default.errors} === ${D || 0}`));
    }
  }
  function de(N, I) {
    const { gen: T, schema: D, opts: { useDefaults: U } } = N;
    U && (0, c.assignDefaults)(N, I.type), T.block(() => {
      for (const L of I.rules)
        (0, i.shouldUseRule)(D, L) && q(N, L.keyword, L.definition, I.type);
    });
  }
  function X(N, I) {
    N.schemaEnv.meta || !N.opts.strictTypes || (fe(N, I), N.opts.allowUnionTypes || h(N, I), o(N, N.dataTypes));
  }
  function fe(N, I) {
    if (I.length) {
      if (!N.dataTypes.length) {
        N.dataTypes = I;
        return;
      }
      I.forEach((T) => {
        u(N.dataTypes, T) || g(N, `type "${T}" not allowed by context "${N.dataTypes.join(",")}"`);
      }), n(N, I);
    }
  }
  function h(N, I) {
    I.length > 1 && !(I.length === 2 && I.includes("null")) && g(N, "use allowUnionTypes to allow union type keyword");
  }
  function o(N, I) {
    const T = N.self.RULES.all;
    for (const D in T) {
      const U = T[D];
      if (typeof U == "object" && (0, i.shouldUseRule)(N.schema, U)) {
        const { type: L } = U.definition;
        L.length && !L.some((se) => m(I, se)) && g(N, `missing type "${L.join(",")}" for keyword "${D}"`);
      }
    }
  }
  function m(N, I) {
    return N.includes(I) || I === "number" && N.includes("integer");
  }
  function u(N, I) {
    return N.includes(I) || I === "integer" && N.includes("number");
  }
  function n(N, I) {
    const T = [];
    for (const D of N.dataTypes)
      u(I, D) ? T.push(D) : I.includes("integer") && D === "number" && T.push("integer");
    N.dataTypes = T;
  }
  function g(N, I) {
    const T = N.schemaEnv.baseId + N.errSchemaPath;
    I += ` at "${T}" (strictTypes)`, (0, _.checkStrictMode)(N, I, N.opts.strictTypes);
  }
  class j {
    constructor(I, T, D) {
      if ((0, r.validateKeywordUsage)(I, T, D), this.gen = I.gen, this.allErrors = I.allErrors, this.keyword = D, this.data = I.data, this.schema = I.schema[D], this.$data = T.$data && I.opts.$data && this.schema && this.schema.$data, this.schemaValue = (0, _.schemaRefOrVal)(I, this.schema, D, this.$data), this.schemaType = T.schemaType, this.parentSchema = I.schema, this.params = {}, this.it = I, this.def = T, this.$data)
        this.schemaCode = I.gen.const("vSchema", G(this.$data, I));
      else if (this.schemaCode = this.schemaValue, !(0, r.validSchemaType)(this.schema, T.schemaType, T.allowUndefined))
        throw new Error(`${D} value must be ${JSON.stringify(T.schemaType)}`);
      ("code" in T ? T.trackErrors : T.errors !== !1) && (this.errsCount = I.gen.const("_errs", l.default.errors));
    }
    result(I, T, D) {
      this.failResult((0, f.not)(I), T, D);
    }
    failResult(I, T, D) {
      this.gen.if(I), D ? D() : this.error(), T ? (this.gen.else(), T(), this.allErrors && this.gen.endIf()) : this.allErrors ? this.gen.endIf() : this.gen.else();
    }
    pass(I, T) {
      this.failResult((0, f.not)(I), void 0, T);
    }
    fail(I) {
      if (I === void 0) {
        this.error(), this.allErrors || this.gen.if(!1);
        return;
      }
      this.gen.if(I), this.error(), this.allErrors ? this.gen.endIf() : this.gen.else();
    }
    fail$data(I) {
      if (!this.$data)
        return this.fail(I);
      const { schemaCode: T } = this;
      this.fail((0, f._)`${T} !== undefined && (${(0, f.or)(this.invalid$data(), I)})`);
    }
    error(I, T, D) {
      if (T) {
        this.setParams(T), this._error(I, D), this.setParams({});
        return;
      }
      this._error(I, D);
    }
    _error(I, T) {
      (I ? E.reportExtraError : E.reportError)(this, this.def.error, T);
    }
    $dataError() {
      (0, E.reportError)(this, this.def.$dataError || E.keyword$DataError);
    }
    reset() {
      if (this.errsCount === void 0)
        throw new Error('add "trackErrors" to keyword definition');
      (0, E.resetErrorsCount)(this.gen, this.errsCount);
    }
    ok(I) {
      this.allErrors || this.gen.if(I);
    }
    setParams(I, T) {
      T ? Object.assign(this.params, I) : this.params = I;
    }
    block$data(I, T, D = f.nil) {
      this.gen.block(() => {
        this.check$data(I, D), T();
      });
    }
    check$data(I = f.nil, T = f.nil) {
      if (!this.$data)
        return;
      const { gen: D, schemaCode: U, schemaType: L, def: se } = this;
      D.if((0, f.or)((0, f._)`${U} === undefined`, T)), I !== f.nil && D.assign(I, !0), (L.length || se.validateSchema) && (D.elseIf(this.invalid$data()), this.$dataError(), I !== f.nil && D.assign(I, !1)), D.else();
    }
    invalid$data() {
      const { gen: I, schemaCode: T, schemaType: D, def: U, it: L } = this;
      return (0, f.or)(se(), ne());
      function se() {
        if (D.length) {
          if (!(T instanceof f.Name))
            throw new Error("ajv implementation error");
          const re = Array.isArray(D) ? D : [D];
          return (0, f._)`${(0, s.checkDataTypes)(re, T, L.opts.strictNumbers, s.DataType.Wrong)}`;
        }
        return f.nil;
      }
      function ne() {
        if (U.validateSchema) {
          const re = I.scopeValue("validate$data", { ref: U.validateSchema });
          return (0, f._)`!${re}(${T})`;
        }
        return f.nil;
      }
    }
    subschema(I, T) {
      const D = (0, a.getSubschema)(this.it, I);
      (0, a.extendSubschemaData)(D, this.it, I), (0, a.extendSubschemaMode)(D, I);
      const U = { ...this.it, ...D, items: void 0, props: void 0 };
      return w(U, T), U;
    }
    mergeEvaluated(I, T) {
      const { it: D, gen: U } = this;
      D.opts.unevaluated && (D.props !== !0 && I.props !== void 0 && (D.props = _.mergeEvaluated.props(U, I.props, D.props, T)), D.items !== !0 && I.items !== void 0 && (D.items = _.mergeEvaluated.items(U, I.items, D.items, T)));
    }
    mergeValidEvaluated(I, T) {
      const { it: D, gen: U } = this;
      if (D.opts.unevaluated && (D.props !== !0 || D.items !== !0))
        return U.if(T, () => this.mergeEvaluated(I, f.Name)), !0;
    }
  }
  ye.KeywordCxt = j;
  function q(N, I, T, D) {
    const U = new j(N, T, I);
    "code" in T ? T.code(U, D) : U.$data && T.validate ? (0, r.funcKeywordCode)(U, T) : "macro" in T ? (0, r.macroKeywordCode)(U, T) : (T.compile || T.validate) && (0, r.funcKeywordCode)(U, T);
  }
  const F = /^\/(?:[^~]|~0|~1)*$/, K = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
  function G(N, { dataLevel: I, dataNames: T, dataPathArr: D }) {
    let U, L;
    if (N === "")
      return l.default.rootData;
    if (N[0] === "/") {
      if (!F.test(N))
        throw new Error(`Invalid JSON-pointer: ${N}`);
      U = N, L = l.default.rootData;
    } else {
      const ce = K.exec(N);
      if (!ce)
        throw new Error(`Invalid JSON-pointer: ${N}`);
      const ae = +ce[1];
      if (U = ce[2], U === "#") {
        if (ae >= I)
          throw new Error(re("property/index", ae));
        return D[I - ae];
      }
      if (ae > I)
        throw new Error(re("data", ae));
      if (L = T[I - ae], !U)
        return L;
    }
    let se = L;
    const ne = U.split("/");
    for (const ce of ne)
      ce && (L = (0, f._)`${L}${(0, f.getProperty)((0, _.unescapeJsonPointer)(ce))}`, se = (0, f._)`${se} && ${L}`);
    return se;
    function re(ce, ae) {
      return `Cannot access ${ce} ${ae} levels up, current level is ${I}`;
    }
  }
  return ye.getData = G, ye;
}
var Ze = {}, rs;
function $r() {
  if (rs) return Ze;
  rs = 1, Object.defineProperty(Ze, "__esModule", { value: !0 });
  class t extends Error {
    constructor(i) {
      super("validation failed"), this.errors = i, this.ajv = this.validation = !0;
    }
  }
  return Ze.default = t, Ze;
}
var Qe = {}, ss;
function Gt() {
  if (ss) return Qe;
  ss = 1, Object.defineProperty(Qe, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ Lt();
  class e extends Error {
    constructor(s, c, r, a) {
      super(a || `can't resolve reference ${r} from id ${c}`), this.missingRef = (0, t.resolveUrl)(s, c, r), this.missingSchema = (0, t.normalizeId)((0, t.getFullPath)(s, this.missingRef));
    }
  }
  return Qe.default = e, Qe;
}
var he = {}, ns;
function br() {
  if (ns) return he;
  ns = 1, Object.defineProperty(he, "__esModule", { value: !0 }), he.resolveSchema = he.getCompilingSchema = he.resolveRef = he.compileSchema = he.SchemaEnv = void 0;
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ $r(), i = /* @__PURE__ */ Ee(), s = /* @__PURE__ */ Lt(), c = /* @__PURE__ */ Q(), r = /* @__PURE__ */ Kt();
  class a {
    constructor(b) {
      var p;
      this.refs = {}, this.dynamicAnchors = {};
      let w;
      typeof b.schema == "object" && (w = b.schema), this.schema = b.schema, this.schemaId = b.schemaId, this.root = b.root || this, this.baseId = (p = b.baseId) !== null && p !== void 0 ? p : (0, s.normalizeId)(w?.[b.schemaId || "$id"]), this.schemaPath = b.schemaPath, this.localRefs = b.localRefs, this.meta = b.meta, this.$async = w?.$async, this.refs = {};
    }
  }
  he.SchemaEnv = a;
  function f($) {
    const b = _.call(this, $);
    if (b)
      return b;
    const p = (0, s.getFullPath)(this.opts.uriResolver, $.root.baseId), { es5: w, lines: P } = this.opts.code, { ownProperties: d } = this.opts, y = new t.CodeGen(this.scope, { es5: w, lines: P, ownProperties: d });
    let S;
    $.$async && (S = y.scopeValue("Error", {
      ref: e.default,
      code: (0, t._)`require("ajv/dist/runtime/validation_error").default`
    }));
    const C = y.scopeName("validate");
    $.validateName = C;
    const M = {
      gen: y,
      allErrors: this.opts.allErrors,
      data: i.default.data,
      parentData: i.default.parentData,
      parentDataProperty: i.default.parentDataProperty,
      dataNames: [i.default.data],
      dataPathArr: [t.nil],
      // TODO can its length be used as dataLevel if nil is removed?
      dataLevel: 0,
      dataTypes: [],
      definedProperties: /* @__PURE__ */ new Set(),
      topSchemaRef: y.scopeValue("schema", this.opts.code.source === !0 ? { ref: $.schema, code: (0, t.stringify)($.schema) } : { ref: $.schema }),
      validateName: C,
      ValidationError: S,
      schema: $.schema,
      schemaEnv: $,
      rootId: p,
      baseId: $.baseId || p,
      schemaPath: t.nil,
      errSchemaPath: $.schemaPath || (this.opts.jtd ? "" : "#"),
      errorPath: (0, t._)`""`,
      opts: this.opts,
      self: this
    };
    let x;
    try {
      this._compilations.add($), (0, r.validateFunctionCode)(M), y.optimize(this.opts.code.optimize);
      const V = y.toString();
      x = `${y.scopeRefs(i.default.scope)}return ${V}`, this.opts.code.process && (x = this.opts.code.process(x, $));
      const z = new Function(`${i.default.self}`, `${i.default.scope}`, x)(this, this.scope.get());
      if (this.scope.value(C, { ref: z }), z.errors = null, z.schema = $.schema, z.schemaEnv = $, $.$async && (z.$async = !0), this.opts.code.source === !0 && (z.source = { validateName: C, validateCode: V, scopeValues: y._values }), this.opts.unevaluated) {
        const { props: B, items: te } = M;
        z.evaluated = {
          props: B instanceof t.Name ? void 0 : B,
          items: te instanceof t.Name ? void 0 : te,
          dynamicProps: B instanceof t.Name,
          dynamicItems: te instanceof t.Name
        }, z.source && (z.source.evaluated = (0, t.stringify)(z.evaluated));
      }
      return $.validate = z, $;
    } catch (V) {
      throw delete $.validate, delete $.validateName, x && this.logger.error("Error compiling schema, function code:", x), V;
    } finally {
      this._compilations.delete($);
    }
  }
  he.compileSchema = f;
  function l($, b, p) {
    var w;
    p = (0, s.resolveUrl)(this.opts.uriResolver, b, p);
    const P = $.refs[p];
    if (P)
      return P;
    let d = k.call(this, $, p);
    if (d === void 0) {
      const y = (w = $.localRefs) === null || w === void 0 ? void 0 : w[p], { schemaId: S } = this.opts;
      y && (d = new a({ schema: y, schemaId: S, root: $, baseId: b }));
    }
    if (d !== void 0)
      return $.refs[p] = v.call(this, d);
  }
  he.resolveRef = l;
  function v($) {
    return (0, s.inlineRef)($.schema, this.opts.inlineRefs) ? $.schema : $.validate ? $ : f.call(this, $);
  }
  function _($) {
    for (const b of this._compilations)
      if (E(b, $))
        return b;
  }
  he.getCompilingSchema = _;
  function E($, b) {
    return $.schema === b.schema && $.root === b.root && $.baseId === b.baseId;
  }
  function k($, b) {
    let p;
    for (; typeof (p = this.refs[b]) == "string"; )
      b = p;
    return p || this.schemas[b] || R.call(this, $, b);
  }
  function R($, b) {
    const p = this.opts.uriResolver.parse(b), w = (0, s._getFullPath)(this.opts.uriResolver, p);
    let P = (0, s.getFullPath)(this.opts.uriResolver, $.baseId, void 0);
    if (Object.keys($.schema).length > 0 && w === P)
      return A.call(this, p, $);
    const d = (0, s.normalizeId)(w), y = this.refs[d] || this.schemas[d];
    if (typeof y == "string") {
      const S = R.call(this, $, y);
      return typeof S?.schema != "object" ? void 0 : A.call(this, p, S);
    }
    if (typeof y?.schema == "object") {
      if (y.validate || f.call(this, y), d === (0, s.normalizeId)(b)) {
        const { schema: S } = y, { schemaId: C } = this.opts, M = S[C];
        return M && (P = (0, s.resolveUrl)(this.opts.uriResolver, P, M)), new a({ schema: S, schemaId: C, root: $, baseId: P });
      }
      return A.call(this, p, y);
    }
  }
  he.resolveSchema = R;
  const O = /* @__PURE__ */ new Set([
    "properties",
    "patternProperties",
    "enum",
    "dependencies",
    "definitions"
  ]);
  function A($, { baseId: b, schema: p, root: w }) {
    var P;
    if (((P = $.fragment) === null || P === void 0 ? void 0 : P[0]) !== "/")
      return;
    for (const S of $.fragment.slice(1).split("/")) {
      if (typeof p == "boolean")
        return;
      const C = p[(0, c.unescapeFragment)(S)];
      if (C === void 0)
        return;
      p = C;
      const M = typeof p == "object" && p[this.opts.schemaId];
      !O.has(S) && M && (b = (0, s.resolveUrl)(this.opts.uriResolver, b, M));
    }
    let d;
    if (typeof p != "boolean" && p.$ref && !(0, c.schemaHasRulesButRef)(p, this.RULES)) {
      const S = (0, s.resolveUrl)(this.opts.uriResolver, b, p.$ref);
      d = R.call(this, w, S);
    }
    const { schemaId: y } = this.opts;
    if (d = d || new a({ schema: p, schemaId: y, root: w, baseId: b }), d.schema !== d.root.schema)
      return d;
  }
  return he;
}
const Zn = "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#", Qn = "Meta-schema for $data reference (JSON AnySchema extension proposal)", Xn = "object", Yn = ["$data"], ei = { $data: { type: "string", anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }] } }, ti = !1, ri = {
  $id: Zn,
  description: Qn,
  type: Xn,
  required: Yn,
  properties: ei,
  additionalProperties: ti
};
var Xe = {}, Fe = { exports: {} }, nr, is;
function on() {
  if (is) return nr;
  is = 1;
  const t = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu), e = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u), i = RegExp.prototype.test.bind(/^\d*$/u), s = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu), c = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu), r = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/]$/u), a = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/?]$/u), f = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:]$/u), l = new Array(256);
  {
    const h = "0123456789ABCDEF";
    for (let o = 0; o < 256; o++)
      l[o] = "%" + h[o >> 4] + h[o & 15];
  }
  function v(h) {
    return h < 2048 ? l[192 | h >> 6] + l[128 | h & 63] : h < 65536 ? l[224 | h >> 12] + l[128 | h >> 6 & 63] + l[128 | h & 63] : l[240 | h >> 18] + l[128 | h >> 12 & 63] + l[128 | h >> 6 & 63] + l[128 | h & 63];
  }
  function _(h) {
    let o = "", m = 0, u = 0;
    for (u = 0; u < h.length; u++)
      if (m = h[u].charCodeAt(0), m !== 48) {
        if (!(m >= 48 && m <= 57 || m >= 65 && m <= 70 || m >= 97 && m <= 102))
          return "";
        o += h[u];
        break;
      }
    for (u += 1; u < h.length; u++) {
      if (m = h[u].charCodeAt(0), !(m >= 48 && m <= 57 || m >= 65 && m <= 70 || m >= 97 && m <= 102))
        return "";
      o += h[u];
    }
    return o;
  }
  const E = RegExp.prototype.test.bind(/^[\dA-Fa-f]{1,4}$/), k = RegExp.prototype.test.bind(/^[vV][\dA-Fa-f]+\.[A-Za-z\d\-._~!$&'()*+,;=:]+$/), R = RegExp.prototype.test.bind(/^[A-Za-z\d\-._~]$/), O = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
  function A(h) {
    if (h.length === 0) return !1;
    for (let o = 0; o < h.length; o++)
      if (!R(h[o])) {
        if (h[o] === "%" && o + 2 < h.length && s(h.slice(o + 1, o + 3))) {
          o += 2;
          continue;
        }
        return !1;
      }
    return !0;
  }
  function $(h) {
    let o = -1, m = 0, u = -1, n = 0;
    for (let q = 0; q < h.length; q++)
      h[q] === "0" ? (u === -1 && (u = q), n++, n > m && (m = n, o = u)) : (u = -1, n = 0);
    if (m < 2) return h.join(":");
    const g = h.slice(0, o).join(":"), j = h.slice(o + m).join(":");
    return g + "::" + j;
  }
  function b(h) {
    const o = h.indexOf("::");
    if (o !== -1 && h.indexOf("::", o + 1) !== -1) return;
    const m = o === -1 ? h.split(":") : h.slice(0, o).split(":"), u = o === -1 ? [] : h.slice(o + 2).split(":");
    o !== -1 && (m.length === 1 && m[0] === "" && (m.length = 0), u.length === 1 && u[0] === "" && (u.length = 0));
    const n = m.concat(u);
    let g = 0;
    for (let q = 0; q < n.length; q++) {
      const F = n[q];
      if (F === "") return;
      if (F.indexOf(".") !== -1) {
        if (q !== n.length - 1 || o !== -1 && u.length === 0 || !e(F)) return;
        g += 2;
        continue;
      }
      if (!E(F)) return;
      n[q] = parseInt(F, 16).toString(16), g++;
    }
    if (o === -1)
      return g !== 8 ? void 0 : $(n);
    if (g >= 8) return;
    const j = n.slice(0, m.length);
    for (let q = g; q < 8; q++) j.push("0");
    for (let q = m.length; q < n.length; q++) j.push(n[q]);
    return $(j);
  }
  function p(h) {
    const o = h[0] === "[" && h[h.length - 1] === "]";
    if ((h[0] === "[" || h[h.length - 1] === "]") && !o) return { host: h, isIPV6: !1, error: !0 };
    let u = o ? h.slice(1, -1) : h;
    if (o && k(u))
      return u = u.toLowerCase(), { host: `[${u}]`, escapedHost: u, isIPV6: !1, isIPVFuture: !0 };
    if (w(u, ":") < 2)
      return { host: h, isIPV6: !1, error: o };
    let n = "";
    const g = u.indexOf("%");
    if (g !== -1) {
      const q = u.slice(g, g + 3).toLowerCase() === "%25" ? 3 : 1;
      if (n = u.slice(g + q), !A(n)) return { host: h, isIPV6: !1, error: !0 };
      u = u.slice(0, g);
    }
    const j = b(u);
    return j === void 0 ? { host: h, isIPV6: !1, error: !0 } : {
      host: j + (n ? "%" + n : ""),
      escapedHost: j + (n ? "%25" + n : ""),
      isIPV6: !0
    };
  }
  function w(h, o) {
    let m = 0;
    for (let u = 0; u < h.length; u++)
      h[u] === o && m++;
    return m;
  }
  function P(h) {
    let o = h;
    const m = [];
    let u = -1, n = 0;
    for (; n = o.length; ) {
      if (n === 1) {
        if (o === ".")
          break;
        if (o === "/") {
          m.push("/");
          break;
        } else {
          m.push(o);
          break;
        }
      } else if (n === 2) {
        if (o[0] === ".") {
          if (o[1] === ".")
            break;
          if (o[1] === "/") {
            o = o.slice(2);
            continue;
          }
        } else if (o[0] === "/" && (o[1] === "." || o[1] === "/")) {
          m.push("/");
          break;
        }
      } else if (n === 3 && o === "/..") {
        m.length !== 0 && m.pop(), m.push("/");
        break;
      }
      if (o[0] === ".") {
        if (o[1] === ".") {
          if (o[2] === "/") {
            o = o.slice(3);
            continue;
          }
        } else if (o[1] === "/") {
          o = o.slice(2);
          continue;
        }
      } else if (o[0] === "/" && o[1] === ".") {
        if (o[2] === "/") {
          o = o.slice(2);
          continue;
        } else if (o[2] === "." && o[3] === "/") {
          o = o.slice(3), m.length !== 0 && m.pop();
          continue;
        }
      }
      if ((u = o.indexOf("/", 1)) === -1) {
        m.push(o);
        break;
      } else
        m.push(o.slice(0, u)), o = o.slice(u);
    }
    return m.join("");
  }
  const d = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" }, y = /[@/?#:]/g, S = /[@/?#]/g;
  function C(h, o) {
    const m = o ? S : y;
    return m.lastIndex = 0, h.replace(m, (u) => d[u]);
  }
  function M(h, o = !1) {
    if (h.indexOf("%") === -1)
      return h;
    let m = "";
    for (let u = 0; u < h.length; u++) {
      if (h[u] === "%" && u + 2 < h.length) {
        const n = h.slice(u + 1, u + 3);
        if (s(n)) {
          const g = n.toUpperCase(), j = String.fromCharCode(parseInt(g, 16));
          o && c(j) ? m += j : m += "%" + g, u += 2;
          continue;
        }
      }
      m += h[u];
    }
    return m;
  }
  function x(h) {
    let o = "";
    for (let m = 0; m < h.length; m++) {
      const u = h[m];
      if (u === "%" && m + 2 < h.length) {
        const n = h.slice(m + 1, m + 3);
        if (s(n)) {
          const g = n.toUpperCase(), j = String.fromCharCode(parseInt(g, 16));
          j !== "." && c(j) ? o += j : o += "%" + g, m += 2;
          continue;
        }
      }
      if (r(u))
        o += u;
      else {
        const n = h.charCodeAt(m);
        if (n < 128)
          o += le(n) ? u : l[n];
        else if (n < 55296 || n > 57343)
          o += v(n);
        else if (n <= 56319 && m + 1 < h.length) {
          const g = h.charCodeAt(m + 1);
          g >= 56320 && g <= 57343 ? (o += v(65536 + (n - 55296 << 10) + (g - 56320)), m++) : o += v(65533);
        } else
          o += v(65533);
      }
    }
    return o;
  }
  function V(h, o = !1) {
    let m = "", u = o && h[0] !== "/";
    for (let n = 0; n < h.length; n++) {
      const g = h[n];
      if (g === "%" && n + 2 < h.length) {
        const j = h.slice(n + 1, n + 3);
        if (s(j)) {
          m += "%" + j.toUpperCase(), n += 2;
          continue;
        }
      }
      if (g === "/" && (u = !1), r(g) && (g !== ":" || !u))
        m += g;
      else {
        const j = h.charCodeAt(n);
        if (j < 128)
          m += l[j];
        else if (j < 55296 || j > 57343)
          m += v(j);
        else if (j <= 56319 && n + 1 < h.length) {
          const q = h.charCodeAt(n + 1);
          q >= 56320 && q <= 57343 ? (m += v(65536 + (j - 55296 << 10) + (q - 56320)), n++) : m += v(65533);
        } else
          m += v(65533);
      }
    }
    return m;
  }
  function H(h, o) {
    let m = "";
    for (let u = 0; u < h.length; u++) {
      const n = h[u];
      if (n === "%" && u + 2 < h.length) {
        const g = h.slice(u + 1, u + 3);
        if (s(g)) {
          m += "%" + g.toUpperCase(), u += 2;
          continue;
        }
      }
      if (o(n))
        m += n;
      else {
        const g = h.charCodeAt(u);
        if (g < 128)
          m += l[g];
        else if (g < 55296 || g > 57343)
          m += v(g);
        else if (g <= 56319 && u + 1 < h.length) {
          const j = h.charCodeAt(u + 1);
          j >= 56320 && j <= 57343 ? (m += v(65536 + (g - 55296 << 10) + (j - 56320)), u++) : m += v(65533);
        } else
          m += v(65533);
      }
    }
    return m;
  }
  function z(h) {
    return H(h, f);
  }
  function B(h) {
    return H(h, a);
  }
  function te(h) {
    return H(h, a);
  }
  function le(h) {
    return h >= 48 && h <= 57 || h >= 65 && h <= 90 || h >= 97 && h <= 122 || h === 42 || h === 43 || h === 45 || h === 46 || h === 47 || h === 64 || h === 95;
  }
  function de(h) {
    let o = "";
    for (let m = 0; m < h.length; m++) {
      const u = h[m];
      if (u === "%" && m + 2 < h.length) {
        const n = h.slice(m + 1, m + 3);
        if (s(n)) {
          const g = n.toUpperCase(), j = String.fromCharCode(parseInt(g, 16));
          c(j) ? o += j : o += "%" + g, m += 2;
          continue;
        }
      }
      if (a(u))
        o += u;
      else {
        const n = h.charCodeAt(m);
        if (n < 128)
          o += le(n) ? u : l[n];
        else if (n < 55296 || n > 57343)
          o += v(n);
        else if (n <= 56319 && m + 1 < h.length) {
          const g = h.charCodeAt(m + 1);
          g >= 56320 && g <= 57343 ? (o += v(65536 + (n - 55296 << 10) + (g - 56320)), m++) : o += v(65533);
        } else
          o += v(65533);
      }
    }
    return o;
  }
  function X(h) {
    let o = "";
    for (let m = 0; m < h.length; m++) {
      if (h[m] === "%" && m + 2 < h.length) {
        const u = h.slice(m + 1, m + 3);
        if (s(u)) {
          o += "%" + u.toUpperCase(), m += 2;
          continue;
        }
      }
      o += escape(h[m]);
    }
    return o;
  }
  function fe(h) {
    const o = [];
    if (h.userinfo !== void 0 && (o.push(z(h.userinfo)), o.push("@")), h.host !== void 0) {
      let m = h.host;
      if (!e(m)) {
        let u = p(m);
        u.isIPV6 !== !0 && u.isIPVFuture !== !0 && (m = M(m, !0), u = p(m)), u.isIPV6 === !0 || u.isIPVFuture === !0 ? m = `[${u.escapedHost}]` : m = C(m, !1);
      }
      o.push(m);
    }
    if (typeof h.port == "number" || typeof h.port == "string") {
      const m = String(h.port);
      if (!i(m))
        throw new TypeError("URI port is malformed.");
      o.push(":"), o.push(m);
    }
    return o.length ? o.join("") : void 0;
  }
  return nr = {
    nonSimpleDomain: O,
    recomposeAuthority: fe,
    reescapeHostDelimiters: C,
    normalizePercentEncoding: M,
    normalizePathEncoding: x,
    serializePathEncoding: V,
    normalizeQueryFragmentEncoding: de,
    encodeUserinfo: z,
    encodeQuery: B,
    encodeFragment: te,
    escapePreservingEscapes: X,
    removeDotSegments: P,
    isIPv4: e,
    isUUID: t,
    normalizeIPv6: p,
    stringArrayToHexStripped: _
  }, nr;
}
var ir, as;
function si() {
  if (as) return ir;
  as = 1;
  const { isUUID: t } = on(), e = /^([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-./:;=@]|%[\da-f]{2})+)$/iu, i = (
    /** @type {const} */
    [
      "http",
      "https",
      "ws",
      "wss",
      "urn",
      "urn:uuid"
    ]
  );
  function s(d) {
    return i.indexOf(
      /** @type {*} */
      d
    ) !== -1;
  }
  function c(d) {
    return d.secure === !0 ? !0 : d.secure === !1 ? !1 : d.scheme ? d.scheme.length === 3 && (d.scheme[0] === "w" || d.scheme[0] === "W") && (d.scheme[1] === "s" || d.scheme[1] === "S") && (d.scheme[2] === "s" || d.scheme[2] === "S") : !1;
  }
  function r(d) {
    return d.host || (d.error = d.error || "HTTP URIs must have a host."), d;
  }
  function a(d) {
    const y = String(d.scheme).toLowerCase() === "https";
    return (d.port === (y ? 443 : 80) || d.port === "") && (d.port = void 0), d.path || (d.path = "/"), d;
  }
  function f(d) {
    return d.secure = c(d), d.resourceName = (d.path || "/") + (d.query ? "?" + d.query : ""), d.path = void 0, d.query = void 0, d;
  }
  function l(d) {
    if ((d.port === (c(d) ? 443 : 80) || d.port === "") && (d.port = void 0), typeof d.secure == "boolean" && (d.scheme = d.secure ? "wss" : "ws", d.secure = void 0), d.resourceName) {
      const y = d.resourceName.indexOf("?"), S = y === -1 ? d.resourceName : d.resourceName.slice(0, y);
      d.path = S && S !== "/" ? S : void 0, d.query = y === -1 ? void 0 : d.resourceName.slice(y + 1), d.resourceName = void 0;
    }
    return d.fragment = void 0, d;
  }
  function v(d, y) {
    if (!d.path)
      return d.error = "URN can not be parsed", d;
    const S = d.path.match(e);
    if (S && S[0] === d.path) {
      const C = y.scheme || d.scheme || "urn";
      d.nid = S[1].toLowerCase(), d.nss = S[2];
      const M = `${C}:${y.nid || d.nid}`, x = P(M);
      d.path = void 0, x && (d = x.parse(d, y));
    } else
      d.error = d.error || "URN can not be parsed.";
    return d;
  }
  function _(d, y) {
    if (d.nid === void 0)
      throw new Error("URN without nid cannot be serialized");
    const S = y.scheme || d.scheme || "urn", C = d.nid.toLowerCase(), M = `${S}:${y.nid || C}`, x = P(M);
    x && (d = x.serialize(d, y));
    const V = d, H = d.nss;
    return V.path = `${C || y.nid}:${H}`, y.skipEscape = !0, V;
  }
  function E(d, y) {
    const S = d;
    return S.uuid = S.nss, S.nss = void 0, !y.tolerant && (!S.uuid || !t(S.uuid)) && (S.error = S.error || "UUID is not valid."), S;
  }
  function k(d) {
    const y = d;
    return y.nss = (d.uuid || "").toLowerCase(), y;
  }
  const R = (
    /** @type {SchemeHandler} */
    {
      scheme: "http",
      domainHost: !0,
      parse: r,
      serialize: a
    }
  ), O = (
    /** @type {SchemeHandler} */
    {
      scheme: "https",
      domainHost: R.domainHost,
      parse: r,
      serialize: a
    }
  ), A = (
    /** @type {SchemeHandler} */
    {
      scheme: "ws",
      domainHost: !0,
      parse: f,
      serialize: l
    }
  ), $ = (
    /** @type {SchemeHandler} */
    {
      scheme: "wss",
      domainHost: A.domainHost,
      parse: A.parse,
      serialize: A.serialize
    }
  ), w = (
    /** @type {Record<SchemeName, SchemeHandler>} */
    {
      http: R,
      https: O,
      ws: A,
      wss: $,
      urn: (
        /** @type {SchemeHandler} */
        {
          scheme: "urn",
          parse: v,
          serialize: _,
          skipNormalize: !0
        }
      ),
      "urn:uuid": (
        /** @type {SchemeHandler} */
        {
          scheme: "urn:uuid",
          parse: E,
          serialize: k,
          skipNormalize: !0
        }
      )
    }
  );
  Object.setPrototypeOf(w, null);
  function P(d) {
    return d && (w[
      /** @type {SchemeName} */
      d
    ] || w[
      /** @type {SchemeName} */
      d.toLowerCase()
    ]) || void 0;
  }
  return ir = {
    wsIsSecure: c,
    SCHEMES: w,
    isValidSchemeName: s,
    getSchemeHandler: P
  }, ir;
}
var os;
function ni() {
  if (os) return Fe.exports;
  os = 1;
  const { normalizeIPv6: t, removeDotSegments: e, recomposeAuthority: i, normalizePercentEncoding: s, normalizePathEncoding: c, serializePathEncoding: r, normalizeQueryFragmentEncoding: a, encodeQuery: f, encodeFragment: l, reescapeHostDelimiters: v, isIPv4: _, nonSimpleDomain: E } = on(), { SCHEMES: k, getSchemeHandler: R } = si(), O = /^[A-Za-z][A-Za-z0-9+.-]*$/u, A = "URI scheme is malformed.";
  function $(h) {
    const o = unescape(String(h));
    if (!O.test(o))
      throw new TypeError(A);
    return o;
  }
  function b(h, o) {
    return typeof h == "string" ? h = /** @type {T} */
    le(h, o) : typeof h == "object" && (h = /** @type {T} */
    te(d(h, o), o)), h;
  }
  function p(h, o, m) {
    const u = m ? Object.assign({ scheme: "null" }, m) : { scheme: "null" }, {
      parsed: n,
      malformedAuthorityOrPort: g,
      malformedPercentEncoding: j,
      malformedSchemeSpecific: q,
      malformedHost: F,
      malformedScheme: K
    } = B(h, u), {
      parsed: G,
      malformedAuthorityOrPort: N,
      malformedPercentEncoding: I,
      malformedSchemeSpecific: T,
      malformedHost: D,
      malformedScheme: U
    } = B(o, u);
    if (g || N || j || I || q || T || F || D || K || U)
      throw new Error(n.error || G.error || "URI is malformed.");
    const L = w(n, G, u, !0), se = R(m && m.scheme || L.scheme), ne = L.host, re = ne !== void 0 && ne !== "" && (_(ne) || t(ne).isIPV6);
    z(L, m || {}, se, re);
    const ce = ne && ne.indexOf("%") !== -1 && !new RegExp("\\P{ASCII}", "u").test(ne);
    if (L.error && !ce)
      throw new Error(L.error);
    return u.skipEscape = !0, d(L, u);
  }
  function w(h, o, m, u) {
    const n = {};
    return u || (h = te(d(h, m), m), o = te(d(o, m), m)), m = m || {}, !m.tolerant && o.scheme ? (n.scheme = o.scheme, n.userinfo = o.userinfo, n.host = o.host, n.port = o.port, n.path = e(o.path || ""), n.query = o.query) : (o.userinfo !== void 0 || o.host !== void 0 || o.port !== void 0 ? (n.userinfo = o.userinfo, n.host = o.host, n.port = o.port, n.path = e(o.path || ""), n.query = o.query) : (o.path ? (o.path[0] === "/" ? n.path = e(o.path) : ((h.userinfo !== void 0 || h.host !== void 0 || h.port !== void 0) && !h.path ? n.path = "/" + o.path : h.path ? n.path = h.path.slice(0, h.path.lastIndexOf("/") + 1) + o.path : n.path = o.path, n.path = e(n.path)), n.query = o.query) : (n.path = h.path, o.query !== void 0 ? n.query = o.query : n.query = h.query), n.userinfo = h.userinfo, n.host = h.host, n.port = h.port), n.scheme = h.scheme), n.fragment = o.fragment, n;
  }
  function P(h, o, m) {
    const u = X(h, m), n = X(o, m);
    return u !== void 0 && n !== void 0 && u === n;
  }
  function d(h, o) {
    const m = {
      host: h.host,
      scheme: h.scheme,
      userinfo: h.userinfo,
      port: h.port,
      path: h.path,
      query: h.query,
      nid: h.nid,
      nss: h.nss,
      uuid: h.uuid,
      fragment: h.fragment,
      reference: h.reference,
      resourceName: h.resourceName,
      secure: h.secure,
      error: ""
    }, u = Object.assign({}, o), n = [];
    m.scheme && (m.scheme = $(m.scheme));
    const g = R(u.scheme || m.scheme);
    g && g.serialize && g.serialize(m, u);
    const j = m.userinfo !== void 0 || m.host !== void 0 || m.port !== void 0, q = !u.skipEscape && m.scheme === void 0 && !j;
    m.path !== void 0 && (u.skipEscape ? m.path = s(m.path) : m.path = r(m.path, q)), u.reference !== "suffix" && m.scheme && (m.scheme = $(m.scheme), n.push(m.scheme, ":"));
    const F = i(m);
    if (F !== void 0 && (u.reference !== "suffix" && n.push("//"), n.push(F), m.path && m.path[0] !== "/" && n.push("/")), m.path !== void 0) {
      let K = m.path;
      !u.absolutePath && (!g || !g.absolutePath) && (K = e(K)), q && (K = r(K, !0)), F === void 0 && K[0] === "/" && K[1] === "/" && (K = "/%2F" + K.slice(2)), n.push(K);
    }
    return m.query !== void 0 && n.push("?", f(m.query)), m.fragment !== void 0 && n.push("#", l(m.fragment)), n.join("");
  }
  const y = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u, S = /^(?:[^#/:?]+:)?\/\/([^/?#]*)/, C = /^(?:[^#/:?]+:)?([/\\\t\n\r]*)/;
  function M(h, o) {
    if (o[2] !== void 0 && h.path && h.path[0] !== "/")
      return 'URI path must start with "/" when authority is present.';
    if (typeof h.port == "number" && (h.port < 0 || h.port > 65535))
      return "URI port is malformed.";
  }
  function x(h) {
    if (h === void 0) return !1;
    let o = h.indexOf("%");
    for (; o !== -1; ) {
      if (o + 2 >= h.length || !/^[\da-f]{2}$/iu.test(h.slice(o + 1, o + 3)))
        return !0;
      o = h.indexOf("%", o + 3);
    }
    return !1;
  }
  function V(h) {
    return h[0] === "[" && h[h.length - 1] === "]";
  }
  function H(h) {
    const o = h[4];
    return x(h[3]) || o !== void 0 && !V(o) && x(o) || x(h[6]) || x(h[7]) || x(h[8]);
  }
  function z(h, o, m, u) {
    if (!o.unicodeSupport && (!m || !m.unicodeSupport) && h.host && !V(h.host) && (o.domainHost || m && m.domainHost) && u === !1 && E(h.host))
      try {
        h.host = new URL("http://" + h.host).hostname;
      } catch (n) {
        return h.error = h.error || "Host's domain name can not be converted to ASCII: " + n, !0;
      }
    return !1;
  }
  function B(h, o) {
    const m = Object.assign({}, o), u = {
      scheme: void 0,
      userinfo: void 0,
      host: "",
      port: void 0,
      path: "",
      query: void 0,
      fragment: void 0
    };
    let n = !1, g = !1, j = !1, q = !1, F = !1, K = !1, G = !1;
    m.reference === "suffix" && (m.scheme ? h = m.scheme + ":" + h : h = "//" + h);
    const N = h.match(S);
    N !== null && N[1].indexOf("\\") !== -1 && (u.error = "URI authority must not contain a literal backslash.", n = !0);
    const I = h.match(C);
    if (I !== null) {
      const D = I[1], U = D.replace(/[\t\n\r]/g, "");
      U.length >= 2 && (U.slice(0, 2) !== "//" ? (u.error = u.error || "URI authority must not contain a literal backslash.", n = !0) : D.length !== U.length && (u.error = u.error || "URI authority introducer must not contain whitespace.", n = !0));
    }
    const T = h.match(y);
    if (T) {
      if (u.scheme = T[1], u.userinfo = T[3], u.host = T[4], u.port = parseInt(T[5], 10), u.path = T[6] || "", u.query = T[7], u.fragment = T[8], u.scheme !== void 0) {
        const L = unescape(u.scheme);
        O.test(L) ? u.scheme = L.toLowerCase() : (u.error = u.error || A, K = !0);
      }
      g = H(T), g && (u.error = u.error || "URI contains malformed percent-encoding."), isNaN(u.port) && (u.port = T[5]);
      const D = M(u, T);
      if (D !== void 0 && (u.error = u.error || D, n = !0), u.host)
        if (_(u.host) === !1) {
          const se = V(u.host), ne = u.host.indexOf("[") !== -1 || u.host.indexOf("]") !== -1, re = t(u.host);
          G = re.isIPV6 || re.isIPVFuture === !0, F = ne && (!se || re.error === !0), u.host = G ? re.host : re.host.toLowerCase(), F && (u.error = u.error || "URI host is malformed.", n = !0);
        } else
          G = !0;
      u.scheme === void 0 && u.userinfo === void 0 && u.host === void 0 && u.port === void 0 && u.query === void 0 && !u.path ? u.reference = "same-document" : u.scheme === void 0 ? u.reference = "relative" : u.fragment === void 0 ? u.reference = "absolute" : u.reference = "uri", m.reference && m.reference !== "suffix" && m.reference !== u.reference && (u.error = u.error || "URI is not a " + m.reference + " reference.");
      const U = R(m.scheme || u.scheme);
      if (F || (q = z(u, m, U, G)), !U || U && !U.skipNormalize) {
        if (h.indexOf("%") !== -1 && u.host !== void 0 && !F) {
          const L = G ? u.host : s(u.host, !0);
          u.host = v(L, G);
        }
        u.path && (u.path = c(u.path)), u.query && (u.query = a(u.query)), u.fragment && (u.fragment = a(u.fragment));
      }
      U && U.parse && (U.parse(u, m), U === k.urn && u.nid === void 0 && (j = !0));
    } else
      u.error = u.error || "URI can not be parsed.";
    return { parsed: u, malformedAuthorityOrPort: n, malformedPercentEncoding: g, malformedSchemeSpecific: j, malformedHost: q, malformedScheme: K };
  }
  function te(h, o) {
    return B(h, o).parsed;
  }
  function le(h, o) {
    return de(h, o).normalized;
  }
  function de(h, o) {
    const { parsed: m, malformedAuthorityOrPort: u, malformedPercentEncoding: n, malformedSchemeSpecific: g, malformedHost: j, malformedScheme: q } = B(h, o);
    return {
      normalized: u || n || g || j || q ? h : d(m, o),
      malformedAuthorityOrPort: u,
      malformedPercentEncoding: n,
      malformedSchemeSpecific: g,
      malformedHost: j,
      malformedScheme: q
    };
  }
  function X(h, o) {
    if (typeof h != "string" && typeof h != "object")
      return;
    let m;
    try {
      m = typeof h == "string" ? h : d(h, o);
    } catch {
      return;
    }
    const { normalized: u, malformedAuthorityOrPort: n, malformedPercentEncoding: g, malformedSchemeSpecific: j, malformedHost: q, malformedScheme: F } = de(m, o);
    return n || g || j || q || F ? void 0 : u;
  }
  const fe = {
    SCHEMES: k,
    normalize: b,
    resolve: p,
    resolveComponent: w,
    equal: P,
    serialize: d,
    parse: te
  };
  return Fe.exports = fe, Fe.exports.default = fe, Fe.exports.fastUri = fe, Fe.exports;
}
var cs;
function ii() {
  if (cs) return Xe;
  cs = 1, Object.defineProperty(Xe, "__esModule", { value: !0 });
  const t = ni();
  return t.code = 'require("ajv/dist/runtime/uri").default', Xe.default = t, Xe;
}
var ls;
function ai() {
  return ls || (ls = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.CodeGen = t.Name = t.nil = t.stringify = t.str = t._ = t.KeywordCxt = void 0;
    var e = /* @__PURE__ */ Kt();
    Object.defineProperty(t, "KeywordCxt", { enumerable: !0, get: function() {
      return e.KeywordCxt;
    } });
    var i = /* @__PURE__ */ J();
    Object.defineProperty(t, "_", { enumerable: !0, get: function() {
      return i._;
    } }), Object.defineProperty(t, "str", { enumerable: !0, get: function() {
      return i.str;
    } }), Object.defineProperty(t, "stringify", { enumerable: !0, get: function() {
      return i.stringify;
    } }), Object.defineProperty(t, "nil", { enumerable: !0, get: function() {
      return i.nil;
    } }), Object.defineProperty(t, "Name", { enumerable: !0, get: function() {
      return i.Name;
    } }), Object.defineProperty(t, "CodeGen", { enumerable: !0, get: function() {
      return i.CodeGen;
    } });
    const s = /* @__PURE__ */ $r(), c = /* @__PURE__ */ Gt(), r = /* @__PURE__ */ sn(), a = /* @__PURE__ */ br(), f = /* @__PURE__ */ J(), l = /* @__PURE__ */ Lt(), v = /* @__PURE__ */ Mt(), _ = /* @__PURE__ */ Q(), E = ri, k = /* @__PURE__ */ ii(), R = (h, o) => new RegExp(h, o);
    R.code = "new RegExp";
    const O = ["removeAdditional", "useDefaults", "coerceTypes"], A = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]), $ = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    }, b = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    }, p = 200;
    function w(h) {
      var o, m, u, n, g, j, q, F, K, G, N, I, T, D, U, L, se, ne, re, ce, ae, ke, pe, Bt, Wt;
      const Me = h.strict, Jt = (o = h.code) === null || o === void 0 ? void 0 : o.optimize, Er = Jt === !0 || Jt === void 0 ? 1 : Jt || 0, Sr = (u = (m = h.code) === null || m === void 0 ? void 0 : m.regExp) !== null && u !== void 0 ? u : R, pn = (n = h.uriResolver) !== null && n !== void 0 ? n : k.default;
      return {
        strictSchema: (j = (g = h.strictSchema) !== null && g !== void 0 ? g : Me) !== null && j !== void 0 ? j : !0,
        strictNumbers: (F = (q = h.strictNumbers) !== null && q !== void 0 ? q : Me) !== null && F !== void 0 ? F : !0,
        strictTypes: (G = (K = h.strictTypes) !== null && K !== void 0 ? K : Me) !== null && G !== void 0 ? G : "log",
        strictTuples: (I = (N = h.strictTuples) !== null && N !== void 0 ? N : Me) !== null && I !== void 0 ? I : "log",
        strictRequired: (D = (T = h.strictRequired) !== null && T !== void 0 ? T : Me) !== null && D !== void 0 ? D : !1,
        code: h.code ? { ...h.code, optimize: Er, regExp: Sr } : { optimize: Er, regExp: Sr },
        loopRequired: (U = h.loopRequired) !== null && U !== void 0 ? U : p,
        loopEnum: (L = h.loopEnum) !== null && L !== void 0 ? L : p,
        meta: (se = h.meta) !== null && se !== void 0 ? se : !0,
        messages: (ne = h.messages) !== null && ne !== void 0 ? ne : !0,
        inlineRefs: (re = h.inlineRefs) !== null && re !== void 0 ? re : !0,
        schemaId: (ce = h.schemaId) !== null && ce !== void 0 ? ce : "$id",
        addUsedSchema: (ae = h.addUsedSchema) !== null && ae !== void 0 ? ae : !0,
        validateSchema: (ke = h.validateSchema) !== null && ke !== void 0 ? ke : !0,
        validateFormats: (pe = h.validateFormats) !== null && pe !== void 0 ? pe : !0,
        unicodeRegExp: (Bt = h.unicodeRegExp) !== null && Bt !== void 0 ? Bt : !0,
        int32range: (Wt = h.int32range) !== null && Wt !== void 0 ? Wt : !0,
        uriResolver: pn
      };
    }
    class P {
      constructor(o = {}) {
        this.schemas = {}, this.refs = {}, this.formats = /* @__PURE__ */ Object.create(null), this._compilations = /* @__PURE__ */ new Set(), this._loading = {}, this._cache = /* @__PURE__ */ new Map(), o = this.opts = { ...o, ...w(o) };
        const { es5: m, lines: u } = this.opts.code;
        this.scope = new f.ValueScope({ scope: {}, prefixes: A, es5: m, lines: u }), this.logger = H(o.logger);
        const n = o.validateFormats;
        o.validateFormats = !1, this.RULES = (0, r.getRules)(), d.call(this, $, o, "NOT SUPPORTED"), d.call(this, b, o, "DEPRECATED", "warn"), this._metaOpts = x.call(this), o.formats && C.call(this), this._addVocabularies(), this._addDefaultMetaSchema(), o.keywords && M.call(this, o.keywords), typeof o.meta == "object" && this.addMetaSchema(o.meta), S.call(this), o.validateFormats = n;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data: o, meta: m, schemaId: u } = this.opts;
        let n = E;
        u === "id" && (n = { ...E }, n.id = n.$id, delete n.$id), m && o && this.addMetaSchema(n, n[u], !1);
      }
      defaultMeta() {
        const { meta: o, schemaId: m } = this.opts;
        return this.opts.defaultMeta = typeof o == "object" ? o[m] || o : void 0;
      }
      validate(o, m) {
        let u;
        if (typeof o == "string") {
          if (u = this.getSchema(o), !u)
            throw new Error(`no schema with key or ref "${o}"`);
        } else
          u = this.compile(o);
        const n = u(m);
        return "$async" in u || (this.errors = u.errors), n;
      }
      compile(o, m) {
        const u = this._addSchema(o, m);
        return u.validate || this._compileSchemaEnv(u);
      }
      compileAsync(o, m) {
        if (typeof this.opts.loadSchema != "function")
          throw new Error("options.loadSchema should be a function");
        const { loadSchema: u } = this.opts;
        return n.call(this, o, m);
        async function n(G, N) {
          await g.call(this, G.$schema);
          const I = this._addSchema(G, N);
          return I.validate || j.call(this, I);
        }
        async function g(G) {
          G && !this.getSchema(G) && await n.call(this, { $ref: G }, !0);
        }
        async function j(G) {
          try {
            return this._compileSchemaEnv(G);
          } catch (N) {
            if (!(N instanceof c.default))
              throw N;
            return q.call(this, N), await F.call(this, N.missingSchema), j.call(this, G);
          }
        }
        function q({ missingSchema: G, missingRef: N }) {
          if (this.refs[G])
            throw new Error(`AnySchema ${G} is loaded but ${N} cannot be resolved`);
        }
        async function F(G) {
          const N = await K.call(this, G);
          this.refs[G] || await g.call(this, N.$schema), this.refs[G] || this.addSchema(N, G, m);
        }
        async function K(G) {
          const N = this._loading[G];
          if (N)
            return N;
          try {
            return await (this._loading[G] = u(G));
          } finally {
            delete this._loading[G];
          }
        }
      }
      // Adds schema to the instance
      addSchema(o, m, u, n = this.opts.validateSchema) {
        if (Array.isArray(o)) {
          for (const j of o)
            this.addSchema(j, void 0, u, n);
          return this;
        }
        let g;
        if (typeof o == "object") {
          const { schemaId: j } = this.opts;
          if (g = o[j], g !== void 0 && typeof g != "string")
            throw new Error(`schema ${j} must be string`);
        }
        return m = (0, l.normalizeId)(m || g), this._checkUnique(m), this.schemas[m] = this._addSchema(o, u, m, n, !0), this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(o, m, u = this.opts.validateSchema) {
        return this.addSchema(o, m, !0, u), this;
      }
      //  Validate schema against its meta-schema
      validateSchema(o, m) {
        if (typeof o == "boolean")
          return !0;
        let u;
        if (u = o.$schema, u !== void 0 && typeof u != "string")
          throw new Error("$schema must be a string");
        if (u = u || this.opts.defaultMeta || this.defaultMeta(), !u)
          return this.logger.warn("meta-schema not available"), this.errors = null, !0;
        const n = this.validate(u, o);
        if (!n && m) {
          const g = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(g);
          else
            throw new Error(g);
        }
        return n;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(o) {
        let m;
        for (; typeof (m = y.call(this, o)) == "string"; )
          o = m;
        if (m === void 0) {
          const { schemaId: u } = this.opts, n = new a.SchemaEnv({ schema: {}, schemaId: u });
          if (m = a.resolveSchema.call(this, n, o), !m)
            return;
          this.refs[o] = m;
        }
        return m.validate || this._compileSchemaEnv(m);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(o) {
        if (o instanceof RegExp)
          return this._removeAllSchemas(this.schemas, o), this._removeAllSchemas(this.refs, o), this;
        switch (typeof o) {
          case "undefined":
            return this._removeAllSchemas(this.schemas), this._removeAllSchemas(this.refs), this._cache.clear(), this;
          case "string": {
            const m = y.call(this, o);
            return typeof m == "object" && this._cache.delete(m.schema), delete this.schemas[o], delete this.refs[o], this;
          }
          case "object": {
            const m = o;
            this._cache.delete(m);
            let u = o[this.opts.schemaId];
            return u && (u = (0, l.normalizeId)(u), delete this.schemas[u], delete this.refs[u]), this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(o) {
        for (const m of o)
          this.addKeyword(m);
        return this;
      }
      addKeyword(o, m) {
        let u;
        if (typeof o == "string")
          u = o, typeof m == "object" && (this.logger.warn("these parameters are deprecated, see docs for addKeyword"), m.keyword = u);
        else if (typeof o == "object" && m === void 0) {
          if (m = o, u = m.keyword, Array.isArray(u) && !u.length)
            throw new Error("addKeywords: keyword must be string or non-empty array");
        } else
          throw new Error("invalid addKeywords parameters");
        if (B.call(this, u, m), !m)
          return (0, _.eachItem)(u, (g) => te.call(this, g)), this;
        de.call(this, m);
        const n = {
          ...m,
          type: (0, v.getJSONTypes)(m.type),
          schemaType: (0, v.getJSONTypes)(m.schemaType)
        };
        return (0, _.eachItem)(u, n.type.length === 0 ? (g) => te.call(this, g, n) : (g) => n.type.forEach((j) => te.call(this, g, n, j))), this;
      }
      getKeyword(o) {
        const m = this.RULES.all[o];
        return typeof m == "object" ? m.definition : !!m;
      }
      // Remove keyword
      removeKeyword(o) {
        const { RULES: m } = this;
        delete m.keywords[o], delete m.all[o];
        for (const u of m.rules) {
          const n = u.rules.findIndex((g) => g.keyword === o);
          n >= 0 && u.rules.splice(n, 1);
        }
        return this;
      }
      // Add format
      addFormat(o, m) {
        return typeof m == "string" && (m = new RegExp(m)), this.formats[o] = m, this;
      }
      errorsText(o = this.errors, { separator: m = ", ", dataVar: u = "data" } = {}) {
        return !o || o.length === 0 ? "No errors" : o.map((n) => `${u}${n.instancePath} ${n.message}`).reduce((n, g) => n + m + g);
      }
      $dataMetaSchema(o, m) {
        const u = this.RULES.all;
        o = JSON.parse(JSON.stringify(o));
        for (const n of m) {
          const g = n.split("/").slice(1);
          let j = o;
          for (const q of g)
            j = j[q];
          for (const q in u) {
            const F = u[q];
            if (typeof F != "object")
              continue;
            const { $data: K } = F.definition, G = j[q];
            K && G && (j[q] = fe(G));
          }
        }
        return o;
      }
      _removeAllSchemas(o, m) {
        for (const u in o) {
          const n = o[u];
          (!m || m.test(u)) && (typeof n == "string" ? delete o[u] : n && !n.meta && (this._cache.delete(n.schema), delete o[u]));
        }
      }
      _addSchema(o, m, u, n = this.opts.validateSchema, g = this.opts.addUsedSchema) {
        let j;
        const { schemaId: q } = this.opts;
        if (typeof o == "object")
          j = o[q];
        else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          if (typeof o != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let F = this._cache.get(o);
        if (F !== void 0)
          return F;
        u = (0, l.normalizeId)(j || u);
        const K = l.getSchemaRefs.call(this, o, u);
        return F = new a.SchemaEnv({ schema: o, schemaId: q, meta: m, baseId: u, localRefs: K }), this._cache.set(F.schema, F), g && !u.startsWith("#") && (u && this._checkUnique(u), this.refs[u] = F), n && this.validateSchema(o, !0), F;
      }
      _checkUnique(o) {
        if (this.schemas[o] || this.refs[o])
          throw new Error(`schema with key or id "${o}" already exists`);
      }
      _compileSchemaEnv(o) {
        if (o.meta ? this._compileMetaSchema(o) : a.compileSchema.call(this, o), !o.validate)
          throw new Error("ajv implementation error");
        return o.validate;
      }
      _compileMetaSchema(o) {
        const m = this.opts;
        this.opts = this._metaOpts;
        try {
          a.compileSchema.call(this, o);
        } finally {
          this.opts = m;
        }
      }
    }
    P.ValidationError = s.default, P.MissingRefError = c.default, t.default = P;
    function d(h, o, m, u = "error") {
      for (const n in h) {
        const g = n;
        g in o && this.logger[u](`${m}: option ${n}. ${h[g]}`);
      }
    }
    function y(h) {
      return h = (0, l.normalizeId)(h), this.schemas[h] || this.refs[h];
    }
    function S() {
      const h = this.opts.schemas;
      if (h)
        if (Array.isArray(h))
          this.addSchema(h);
        else
          for (const o in h)
            this.addSchema(h[o], o);
    }
    function C() {
      for (const h in this.opts.formats) {
        const o = this.opts.formats[h];
        o && this.addFormat(h, o);
      }
    }
    function M(h) {
      if (Array.isArray(h)) {
        this.addVocabulary(h);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const o in h) {
        const m = h[o];
        m.keyword || (m.keyword = o), this.addKeyword(m);
      }
    }
    function x() {
      const h = { ...this.opts };
      for (const o of O)
        delete h[o];
      return h;
    }
    const V = { log() {
    }, warn() {
    }, error() {
    } };
    function H(h) {
      if (h === !1)
        return V;
      if (h === void 0)
        return console;
      if (h.log && h.warn && h.error)
        return h;
      throw new Error("logger must implement log, warn and error methods");
    }
    const z = /^[a-z_$][a-z0-9_$:-]*$/i;
    function B(h, o) {
      const { RULES: m } = this;
      if ((0, _.eachItem)(h, (u) => {
        if (m.keywords[u])
          throw new Error(`Keyword ${u} is already defined`);
        if (!z.test(u))
          throw new Error(`Keyword ${u} has invalid name`);
      }), !!o && o.$data && !("code" in o || "validate" in o))
        throw new Error('$data keyword must have "code" or "validate" function');
    }
    function te(h, o, m) {
      var u;
      const n = o?.post;
      if (m && n)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES: g } = this;
      let j = n ? g.post : g.rules.find(({ type: F }) => F === m);
      if (j || (j = { type: m, rules: [] }, g.rules.push(j)), g.keywords[h] = !0, !o)
        return;
      const q = {
        keyword: h,
        definition: {
          ...o,
          type: (0, v.getJSONTypes)(o.type),
          schemaType: (0, v.getJSONTypes)(o.schemaType)
        }
      };
      o.before ? le.call(this, j, q, o.before) : j.rules.push(q), g.all[h] = q, (u = o.implements) === null || u === void 0 || u.forEach((F) => this.addKeyword(F));
    }
    function le(h, o, m) {
      const u = h.rules.findIndex((n) => n.keyword === m);
      u >= 0 ? h.rules.splice(u, 0, o) : (h.rules.push(o), this.logger.warn(`rule ${m} is not defined`));
    }
    function de(h) {
      let { metaSchema: o } = h;
      o !== void 0 && (h.$data && this.opts.$data && (o = fe(o)), h.validateSchema = this.compile(o, !0));
    }
    const X = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function fe(h) {
      return { anyOf: [h, X] };
    }
  })(Qt)), Qt;
}
var Ye = {}, et = {}, tt = {}, us;
function oi() {
  if (us) return tt;
  us = 1, Object.defineProperty(tt, "__esModule", { value: !0 });
  const t = {
    keyword: "id",
    code() {
      throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
    }
  };
  return tt.default = t, tt;
}
var $e = {}, ds;
function ci() {
  if (ds) return $e;
  ds = 1, Object.defineProperty($e, "__esModule", { value: !0 }), $e.callRef = $e.getValidate = void 0;
  const t = /* @__PURE__ */ Gt(), e = /* @__PURE__ */ ge(), i = /* @__PURE__ */ J(), s = /* @__PURE__ */ Ee(), c = /* @__PURE__ */ br(), r = /* @__PURE__ */ Q(), a = {
    keyword: "$ref",
    schemaType: "string",
    code(v) {
      const { gen: _, schema: E, it: k } = v, { baseId: R, schemaEnv: O, validateName: A, opts: $, self: b } = k, { root: p } = O;
      if ((E === "#" || E === "#/") && R === p.baseId)
        return P();
      const w = c.resolveRef.call(b, p, R, E);
      if (w === void 0)
        throw new t.default(k.opts.uriResolver, R, E);
      if (w instanceof c.SchemaEnv)
        return d(w);
      return y(w);
      function P() {
        if (O === p)
          return l(v, A, O, O.$async);
        const S = _.scopeValue("root", { ref: p });
        return l(v, (0, i._)`${S}.validate`, p, p.$async);
      }
      function d(S) {
        const C = f(v, S);
        l(v, C, S, S.$async);
      }
      function y(S) {
        const C = _.scopeValue("schema", $.code.source === !0 ? { ref: S, code: (0, i.stringify)(S) } : { ref: S }), M = _.name("valid"), x = v.subschema({
          schema: S,
          dataTypes: [],
          schemaPath: i.nil,
          topSchemaRef: C,
          errSchemaPath: E
        }, M);
        v.mergeEvaluated(x), v.ok(M);
      }
    }
  };
  function f(v, _) {
    const { gen: E } = v;
    return _.validate ? E.scopeValue("validate", { ref: _.validate }) : (0, i._)`${E.scopeValue("wrapper", { ref: _ })}.validate`;
  }
  $e.getValidate = f;
  function l(v, _, E, k) {
    const { gen: R, it: O } = v, { allErrors: A, schemaEnv: $, opts: b } = O, p = b.passContext ? s.default.this : i.nil;
    k ? w() : P();
    function w() {
      if (!$.$async)
        throw new Error("async schema referenced by sync schema");
      const S = R.let("valid");
      R.try(() => {
        R.code((0, i._)`await ${(0, e.callValidateCode)(v, _, p)}`), y(_), A || R.assign(S, !0);
      }, (C) => {
        R.if((0, i._)`!(${C} instanceof ${O.ValidationError})`, () => R.throw(C)), d(C), A || R.assign(S, !1);
      }), v.ok(S);
    }
    function P() {
      v.result((0, e.callValidateCode)(v, _, p), () => y(_), () => d(_));
    }
    function d(S) {
      const C = (0, i._)`${S}.errors`;
      R.assign(s.default.vErrors, (0, i._)`${s.default.vErrors} === null ? ${C} : ${s.default.vErrors}.concat(${C})`), R.assign(s.default.errors, (0, i._)`${s.default.vErrors}.length`);
    }
    function y(S) {
      var C;
      if (!O.opts.unevaluated)
        return;
      const M = (C = E?.validate) === null || C === void 0 ? void 0 : C.evaluated;
      if (O.props !== !0)
        if (M && !M.dynamicProps)
          M.props !== void 0 && (O.props = r.mergeEvaluated.props(R, M.props, O.props));
        else {
          const x = R.var("props", (0, i._)`${S}.evaluated.props`);
          O.props = r.mergeEvaluated.props(R, x, O.props, i.Name);
        }
      if (O.items !== !0)
        if (M && !M.dynamicItems)
          M.items !== void 0 && (O.items = r.mergeEvaluated.items(R, M.items, O.items));
        else {
          const x = R.var("items", (0, i._)`${S}.evaluated.items`);
          O.items = r.mergeEvaluated.items(R, x, O.items, i.Name);
        }
    }
  }
  return $e.callRef = l, $e.default = a, $e;
}
var fs;
function li() {
  if (fs) return et;
  fs = 1, Object.defineProperty(et, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ oi(), e = /* @__PURE__ */ ci(), i = [
    "$schema",
    "$id",
    "$defs",
    "$vocabulary",
    { keyword: "$comment" },
    "definitions",
    t.default,
    e.default
  ];
  return et.default = i, et;
}
var rt = {}, st = {}, hs;
function ui() {
  if (hs) return st;
  hs = 1, Object.defineProperty(st, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = t.operators, i = {
    maximum: { okStr: "<=", ok: e.LTE, fail: e.GT },
    minimum: { okStr: ">=", ok: e.GTE, fail: e.LT },
    exclusiveMaximum: { okStr: "<", ok: e.LT, fail: e.GTE },
    exclusiveMinimum: { okStr: ">", ok: e.GT, fail: e.LTE }
  }, s = {
    message: ({ keyword: r, schemaCode: a }) => (0, t.str)`must be ${i[r].okStr} ${a}`,
    params: ({ keyword: r, schemaCode: a }) => (0, t._)`{comparison: ${i[r].okStr}, limit: ${a}}`
  }, c = {
    keyword: Object.keys(i),
    type: "number",
    schemaType: "number",
    $data: !0,
    error: s,
    code(r) {
      const { keyword: a, data: f, schemaCode: l } = r;
      r.fail$data((0, t._)`${f} ${i[a].fail} ${l} || isNaN(${f})`);
    }
  };
  return st.default = c, st;
}
var nt = {}, ps;
function di() {
  if (ps) return nt;
  ps = 1, Object.defineProperty(nt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), i = {
    keyword: "multipleOf",
    type: "number",
    schemaType: "number",
    $data: !0,
    error: {
      message: ({ schemaCode: s }) => (0, t.str)`must be multiple of ${s}`,
      params: ({ schemaCode: s }) => (0, t._)`{multipleOf: ${s}}`
    },
    code(s) {
      const { gen: c, data: r, schemaCode: a, it: f } = s, l = f.opts.multipleOfPrecision, v = c.let("res"), _ = l ? (0, t._)`Math.abs(Math.round(${v}) - ${v}) > 1e-${l}` : (0, t._)`${v} !== parseInt(${v})`;
      s.fail$data((0, t._)`(${a} === 0 || (${v} = ${r}/${a}, ${_}))`);
    }
  };
  return nt.default = i, nt;
}
var it = {}, at = {}, ms;
function fi() {
  if (ms) return at;
  ms = 1, Object.defineProperty(at, "__esModule", { value: !0 });
  function t(e) {
    const i = e.length;
    let s = 0, c = 0, r;
    for (; c < i; )
      s++, r = e.charCodeAt(c++), r >= 55296 && r <= 56319 && c < i && (r = e.charCodeAt(c), (r & 64512) === 56320 && c++);
    return s;
  }
  return at.default = t, t.code = 'require("ajv/dist/runtime/ucs2length").default', at;
}
var gs;
function hi() {
  if (gs) return it;
  gs = 1, Object.defineProperty(it, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), i = /* @__PURE__ */ fi(), c = {
    keyword: ["maxLength", "minLength"],
    type: "string",
    schemaType: "number",
    $data: !0,
    error: {
      message({ keyword: r, schemaCode: a }) {
        const f = r === "maxLength" ? "more" : "fewer";
        return (0, t.str)`must NOT have ${f} than ${a} characters`;
      },
      params: ({ schemaCode: r }) => (0, t._)`{limit: ${r}}`
    },
    code(r) {
      const { keyword: a, data: f, schemaCode: l, it: v } = r, _ = a === "maxLength" ? t.operators.GT : t.operators.LT, E = v.opts.unicode === !1 ? (0, t._)`${f}.length` : (0, t._)`${(0, e.useFunc)(r.gen, i.default)}(${f})`;
      r.fail$data((0, t._)`${E} ${_} ${l}`);
    }
  };
  return it.default = c, it;
}
var ot = {}, ys;
function pi() {
  if (ys) return ot;
  ys = 1, Object.defineProperty(ot, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ ge(), e = /* @__PURE__ */ Q(), i = /* @__PURE__ */ J(), c = {
    keyword: "pattern",
    type: "string",
    schemaType: "string",
    $data: !0,
    error: {
      message: ({ schemaCode: r }) => (0, i.str)`must match pattern "${r}"`,
      params: ({ schemaCode: r }) => (0, i._)`{pattern: ${r}}`
    },
    code(r) {
      const { gen: a, data: f, $data: l, schema: v, schemaCode: _, it: E } = r, k = E.opts.unicodeRegExp ? "u" : "";
      if (l) {
        const { regExp: R } = E.opts.code, O = R.code === "new RegExp" ? (0, i._)`new RegExp` : (0, e.useFunc)(a, R), A = a.let("valid");
        a.try(() => a.assign(A, (0, i._)`${O}(${_}, ${k}).test(${f})`), () => a.assign(A, !1)), r.fail$data((0, i._)`!${A}`);
      } else {
        const R = (0, t.usePattern)(r, v);
        r.fail$data((0, i._)`!${R}.test(${f})`);
      }
    }
  };
  return ot.default = c, ot;
}
var ct = {}, vs;
function mi() {
  if (vs) return ct;
  vs = 1, Object.defineProperty(ct, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), i = {
    keyword: ["maxProperties", "minProperties"],
    type: "object",
    schemaType: "number",
    $data: !0,
    error: {
      message({ keyword: s, schemaCode: c }) {
        const r = s === "maxProperties" ? "more" : "fewer";
        return (0, t.str)`must NOT have ${r} than ${c} properties`;
      },
      params: ({ schemaCode: s }) => (0, t._)`{limit: ${s}}`
    },
    code(s) {
      const { keyword: c, data: r, schemaCode: a } = s, f = c === "maxProperties" ? t.operators.GT : t.operators.LT;
      s.fail$data((0, t._)`Object.keys(${r}).length ${f} ${a}`);
    }
  };
  return ct.default = i, ct;
}
var lt = {}, _s;
function gi() {
  if (_s) return lt;
  _s = 1, Object.defineProperty(lt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ ge(), e = /* @__PURE__ */ J(), i = /* @__PURE__ */ Q(), c = {
    keyword: "required",
    type: "object",
    schemaType: "array",
    $data: !0,
    error: {
      message: ({ params: { missingProperty: r } }) => (0, e.str)`must have required property '${r}'`,
      params: ({ params: { missingProperty: r } }) => (0, e._)`{missingProperty: ${r}}`
    },
    code(r) {
      const { gen: a, schema: f, schemaCode: l, data: v, $data: _, it: E } = r, { opts: k } = E;
      if (!_ && f.length === 0)
        return;
      const R = f.length >= k.loopRequired;
      if (E.allErrors ? O() : A(), k.strictRequired) {
        const p = r.parentSchema.properties, { definedProperties: w } = r.it;
        for (const P of f)
          if (p?.[P] === void 0 && !w.has(P)) {
            const d = E.schemaEnv.baseId + E.errSchemaPath, y = `required property "${P}" is not defined at "${d}" (strictRequired)`;
            (0, i.checkStrictMode)(E, y, E.opts.strictRequired);
          }
      }
      function O() {
        if (R || _)
          r.block$data(e.nil, $);
        else
          for (const p of f)
            (0, t.checkReportMissingProp)(r, p);
      }
      function A() {
        const p = a.let("missing");
        if (R || _) {
          const w = a.let("valid", !0);
          r.block$data(w, () => b(p, w)), r.ok(w);
        } else
          a.if((0, t.checkMissingProp)(r, f, p)), (0, t.reportMissingProp)(r, p), a.else();
      }
      function $() {
        a.forOf("prop", l, (p) => {
          r.setParams({ missingProperty: p }), a.if((0, t.noPropertyInData)(a, v, p, k.ownProperties), () => r.error());
        });
      }
      function b(p, w) {
        r.setParams({ missingProperty: p }), a.forOf(p, l, () => {
          a.assign(w, (0, t.propertyInData)(a, v, p, k.ownProperties)), a.if((0, e.not)(w), () => {
            r.error(), a.break();
          });
        }, e.nil);
      }
    }
  };
  return lt.default = c, lt;
}
var ut = {}, $s;
function yi() {
  if ($s) return ut;
  $s = 1, Object.defineProperty(ut, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), i = {
    keyword: ["maxItems", "minItems"],
    type: "array",
    schemaType: "number",
    $data: !0,
    error: {
      message({ keyword: s, schemaCode: c }) {
        const r = s === "maxItems" ? "more" : "fewer";
        return (0, t.str)`must NOT have ${r} than ${c} items`;
      },
      params: ({ schemaCode: s }) => (0, t._)`{limit: ${s}}`
    },
    code(s) {
      const { keyword: c, data: r, schemaCode: a } = s, f = c === "maxItems" ? t.operators.GT : t.operators.LT;
      s.fail$data((0, t._)`${r}.length ${f} ${a}`);
    }
  };
  return ut.default = i, ut;
}
var dt = {}, ft = {}, bs;
function wr() {
  if (bs) return ft;
  bs = 1, Object.defineProperty(ft, "__esModule", { value: !0 });
  const t = an();
  return t.code = 'require("ajv/dist/runtime/equal").default', ft.default = t, ft;
}
var ws;
function vi() {
  if (ws) return dt;
  ws = 1, Object.defineProperty(dt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ Mt(), e = /* @__PURE__ */ J(), i = /* @__PURE__ */ Q(), s = /* @__PURE__ */ wr(), r = {
    keyword: "uniqueItems",
    type: "array",
    schemaType: "boolean",
    $data: !0,
    error: {
      message: ({ params: { i: a, j: f } }) => (0, e.str)`must NOT have duplicate items (items ## ${f} and ${a} are identical)`,
      params: ({ params: { i: a, j: f } }) => (0, e._)`{i: ${a}, j: ${f}}`
    },
    code(a) {
      const { gen: f, data: l, $data: v, schema: _, parentSchema: E, schemaCode: k, it: R } = a;
      if (!v && !_)
        return;
      const O = f.let("valid"), A = E.items ? (0, t.getSchemaTypes)(E.items) : [];
      a.block$data(O, $, (0, e._)`${k} === false`), a.ok(O);
      function $() {
        const P = f.let("i", (0, e._)`${l}.length`), d = f.let("j");
        a.setParams({ i: P, j: d }), f.assign(O, !0), f.if((0, e._)`${P} > 1`, () => (b() ? p : w)(P, d));
      }
      function b() {
        return A.length > 0 && !A.some((P) => P === "object" || P === "array");
      }
      function p(P, d) {
        const y = f.name("item"), S = (0, t.checkDataTypes)(A, y, R.opts.strictNumbers, t.DataType.Wrong), C = f.const("indices", (0, e._)`{}`);
        f.for((0, e._)`;${P}--;`, () => {
          f.let(y, (0, e._)`${l}[${P}]`), f.if(S, (0, e._)`continue`), A.length > 1 && f.if((0, e._)`typeof ${y} == "string"`, (0, e._)`${y} += "_"`), f.if((0, e._)`typeof ${C}[${y}] == "number"`, () => {
            f.assign(d, (0, e._)`${C}[${y}]`), a.error(), f.assign(O, !1).break();
          }).code((0, e._)`${C}[${y}] = ${P}`);
        });
      }
      function w(P, d) {
        const y = (0, i.useFunc)(f, s.default), S = f.name("outer");
        f.label(S).for((0, e._)`;${P}--;`, () => f.for((0, e._)`${d} = ${P}; ${d}--;`, () => f.if((0, e._)`${y}(${l}[${P}], ${l}[${d}])`, () => {
          a.error(), f.assign(O, !1).break(S);
        })));
      }
    }
  };
  return dt.default = r, dt;
}
var ht = {}, Es;
function _i() {
  if (Es) return ht;
  Es = 1, Object.defineProperty(ht, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), i = /* @__PURE__ */ wr(), c = {
    keyword: "const",
    $data: !0,
    error: {
      message: "must be equal to constant",
      params: ({ schemaCode: r }) => (0, t._)`{allowedValue: ${r}}`
    },
    code(r) {
      const { gen: a, data: f, $data: l, schemaCode: v, schema: _ } = r;
      l || _ && typeof _ == "object" ? r.fail$data((0, t._)`!${(0, e.useFunc)(a, i.default)}(${f}, ${v})`) : r.fail((0, t._)`${_} !== ${f}`);
    }
  };
  return ht.default = c, ht;
}
var pt = {}, Ss;
function $i() {
  if (Ss) return pt;
  Ss = 1, Object.defineProperty(pt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), i = /* @__PURE__ */ wr(), c = {
    keyword: "enum",
    schemaType: "array",
    $data: !0,
    error: {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode: r }) => (0, t._)`{allowedValues: ${r}}`
    },
    code(r) {
      const { gen: a, data: f, $data: l, schema: v, schemaCode: _, it: E } = r;
      if (!l && v.length === 0)
        throw new Error("enum must have non-empty array");
      const k = v.length >= E.opts.loopEnum;
      let R;
      const O = () => R ?? (R = (0, e.useFunc)(a, i.default));
      let A;
      if (k || l)
        A = a.let("valid"), r.block$data(A, $);
      else {
        if (!Array.isArray(v))
          throw new Error("ajv implementation error");
        const p = a.const("vSchema", _);
        A = (0, t.or)(...v.map((w, P) => b(p, P)));
      }
      r.pass(A);
      function $() {
        a.assign(A, !1), a.forOf("v", _, (p) => a.if((0, t._)`${O()}(${f}, ${p})`, () => a.assign(A, !0).break()));
      }
      function b(p, w) {
        const P = v[w];
        return typeof P == "object" && P !== null ? (0, t._)`${O()}(${f}, ${p}[${w}])` : (0, t._)`${f} === ${P}`;
      }
    }
  };
  return pt.default = c, pt;
}
var Ps;
function bi() {
  if (Ps) return rt;
  Ps = 1, Object.defineProperty(rt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ ui(), e = /* @__PURE__ */ di(), i = /* @__PURE__ */ hi(), s = /* @__PURE__ */ pi(), c = /* @__PURE__ */ mi(), r = /* @__PURE__ */ gi(), a = /* @__PURE__ */ yi(), f = /* @__PURE__ */ vi(), l = /* @__PURE__ */ _i(), v = /* @__PURE__ */ $i(), _ = [
    // number
    t.default,
    e.default,
    // string
    i.default,
    s.default,
    // object
    c.default,
    r.default,
    // array
    a.default,
    f.default,
    // any
    { keyword: "type", schemaType: ["string", "array"] },
    { keyword: "nullable", schemaType: "boolean" },
    l.default,
    v.default
  ];
  return rt.default = _, rt;
}
var mt = {}, je = {}, Rs;
function cn() {
  if (Rs) return je;
  Rs = 1, Object.defineProperty(je, "__esModule", { value: !0 }), je.validateAdditionalItems = void 0;
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), s = {
    keyword: "additionalItems",
    type: "array",
    schemaType: ["boolean", "object"],
    before: "uniqueItems",
    error: {
      message: ({ params: { len: r } }) => (0, t.str)`must NOT have more than ${r} items`,
      params: ({ params: { len: r } }) => (0, t._)`{limit: ${r}}`
    },
    code(r) {
      const { parentSchema: a, it: f } = r, { items: l } = a;
      if (!Array.isArray(l)) {
        (0, e.checkStrictMode)(f, '"additionalItems" is ignored when "items" is not an array of schemas');
        return;
      }
      c(r, l);
    }
  };
  function c(r, a) {
    const { gen: f, schema: l, data: v, keyword: _, it: E } = r;
    E.items = !0;
    const k = f.const("len", (0, t._)`${v}.length`);
    if (l === !1)
      r.setParams({ len: a.length }), r.pass((0, t._)`${k} <= ${a.length}`);
    else if (typeof l == "object" && !(0, e.alwaysValidSchema)(E, l)) {
      const O = f.var("valid", (0, t._)`${k} <= ${a.length}`);
      f.if((0, t.not)(O), () => R(O)), r.ok(O);
    }
    function R(O) {
      f.forRange("i", a.length, k, (A) => {
        r.subschema({ keyword: _, dataProp: A, dataPropType: e.Type.Num }, O), E.allErrors || f.if((0, t.not)(O), () => f.break());
      });
    }
  }
  return je.validateAdditionalItems = c, je.default = s, je;
}
var gt = {}, Ie = {}, Os;
function ln() {
  if (Os) return Ie;
  Os = 1, Object.defineProperty(Ie, "__esModule", { value: !0 }), Ie.validateTuple = void 0;
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), i = /* @__PURE__ */ ge(), s = {
    keyword: "items",
    type: "array",
    schemaType: ["object", "array", "boolean"],
    before: "uniqueItems",
    code(r) {
      const { schema: a, it: f } = r;
      if (Array.isArray(a))
        return c(r, "additionalItems", a);
      f.items = !0, !(0, e.alwaysValidSchema)(f, a) && r.ok((0, i.validateArray)(r));
    }
  };
  function c(r, a, f = r.schema) {
    const { gen: l, parentSchema: v, data: _, keyword: E, it: k } = r;
    A(v), k.opts.unevaluated && f.length && k.items !== !0 && (k.items = e.mergeEvaluated.items(l, f.length, k.items));
    const R = l.name("valid"), O = l.const("len", (0, t._)`${_}.length`);
    f.forEach(($, b) => {
      (0, e.alwaysValidSchema)(k, $) || (l.if((0, t._)`${O} > ${b}`, () => r.subschema({
        keyword: E,
        schemaProp: b,
        dataProp: b
      }, R)), r.ok(R));
    });
    function A($) {
      const { opts: b, errSchemaPath: p } = k, w = f.length, P = w === $.minItems && (w === $.maxItems || $[a] === !1);
      if (b.strictTuples && !P) {
        const d = `"${E}" is ${w}-tuple, but minItems or maxItems/${a} are not specified or different at path "${p}"`;
        (0, e.checkStrictMode)(k, d, b.strictTuples);
      }
    }
  }
  return Ie.validateTuple = c, Ie.default = s, Ie;
}
var As;
function wi() {
  if (As) return gt;
  As = 1, Object.defineProperty(gt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ ln(), e = {
    keyword: "prefixItems",
    type: "array",
    schemaType: ["array"],
    before: "uniqueItems",
    code: (i) => (0, t.validateTuple)(i, "items")
  };
  return gt.default = e, gt;
}
var yt = {}, Ns;
function Ei() {
  if (Ns) return yt;
  Ns = 1, Object.defineProperty(yt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), i = /* @__PURE__ */ ge(), s = /* @__PURE__ */ cn(), r = {
    keyword: "items",
    type: "array",
    schemaType: ["object", "boolean"],
    before: "uniqueItems",
    error: {
      message: ({ params: { len: a } }) => (0, t.str)`must NOT have more than ${a} items`,
      params: ({ params: { len: a } }) => (0, t._)`{limit: ${a}}`
    },
    code(a) {
      const { schema: f, parentSchema: l, it: v } = a, { prefixItems: _ } = l;
      v.items = !0, !(0, e.alwaysValidSchema)(v, f) && (_ ? (0, s.validateAdditionalItems)(a, _) : a.ok((0, i.validateArray)(a)));
    }
  };
  return yt.default = r, yt;
}
var vt = {}, ks;
function Si() {
  if (ks) return vt;
  ks = 1, Object.defineProperty(vt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), s = {
    keyword: "contains",
    type: "array",
    schemaType: ["object", "boolean"],
    before: "uniqueItems",
    trackErrors: !0,
    error: {
      message: ({ params: { min: c, max: r } }) => r === void 0 ? (0, t.str)`must contain at least ${c} valid item(s)` : (0, t.str)`must contain at least ${c} and no more than ${r} valid item(s)`,
      params: ({ params: { min: c, max: r } }) => r === void 0 ? (0, t._)`{minContains: ${c}}` : (0, t._)`{minContains: ${c}, maxContains: ${r}}`
    },
    code(c) {
      const { gen: r, schema: a, parentSchema: f, data: l, it: v } = c;
      let _, E;
      const { minContains: k, maxContains: R } = f;
      v.opts.next ? (_ = k === void 0 ? 1 : k, E = R) : _ = 1;
      const O = r.const("len", (0, t._)`${l}.length`);
      if (c.setParams({ min: _, max: E }), E === void 0 && _ === 0) {
        (0, e.checkStrictMode)(v, '"minContains" == 0 without "maxContains": "contains" keyword ignored');
        return;
      }
      if (E !== void 0 && _ > E) {
        (0, e.checkStrictMode)(v, '"minContains" > "maxContains" is always invalid'), c.fail();
        return;
      }
      if ((0, e.alwaysValidSchema)(v, a)) {
        let w = (0, t._)`${O} >= ${_}`;
        E !== void 0 && (w = (0, t._)`${w} && ${O} <= ${E}`), c.pass(w);
        return;
      }
      v.items = !0;
      const A = r.name("valid");
      E === void 0 && _ === 1 ? b(A, () => r.if(A, () => r.break())) : _ === 0 ? (r.let(A, !0), E !== void 0 && r.if((0, t._)`${l}.length > 0`, $)) : (r.let(A, !1), $()), c.result(A, () => c.reset());
      function $() {
        const w = r.name("_valid"), P = r.let("count", 0);
        b(w, () => r.if(w, () => p(P)));
      }
      function b(w, P) {
        r.forRange("i", 0, O, (d) => {
          c.subschema({
            keyword: "contains",
            dataProp: d,
            dataPropType: e.Type.Num,
            compositeRule: !0
          }, w), P();
        });
      }
      function p(w) {
        r.code((0, t._)`${w}++`), E === void 0 ? r.if((0, t._)`${w} >= ${_}`, () => r.assign(A, !0).break()) : (r.if((0, t._)`${w} > ${E}`, () => r.assign(A, !1).break()), _ === 1 ? r.assign(A, !0) : r.if((0, t._)`${w} >= ${_}`, () => r.assign(A, !0)));
      }
    }
  };
  return vt.default = s, vt;
}
var ar = {}, js;
function Pi() {
  return js || (js = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.validateSchemaDeps = t.validatePropertyDeps = t.error = void 0;
    const e = /* @__PURE__ */ J(), i = /* @__PURE__ */ Q(), s = /* @__PURE__ */ ge();
    t.error = {
      message: ({ params: { property: l, depsCount: v, deps: _ } }) => {
        const E = v === 1 ? "property" : "properties";
        return (0, e.str)`must have ${E} ${_} when property ${l} is present`;
      },
      params: ({ params: { property: l, depsCount: v, deps: _, missingProperty: E } }) => (0, e._)`{property: ${l},
    missingProperty: ${E},
    depsCount: ${v},
    deps: ${_}}`
      // TODO change to reference
    };
    const c = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: t.error,
      code(l) {
        const [v, _] = r(l);
        a(l, v), f(l, _);
      }
    };
    function r({ schema: l }) {
      const v = {}, _ = {};
      for (const E in l) {
        if (E === "__proto__")
          continue;
        const k = Array.isArray(l[E]) ? v : _;
        k[E] = l[E];
      }
      return [v, _];
    }
    function a(l, v = l.schema) {
      const { gen: _, data: E, it: k } = l;
      if (Object.keys(v).length === 0)
        return;
      const R = _.let("missing");
      for (const O in v) {
        const A = v[O];
        if (A.length === 0)
          continue;
        const $ = (0, s.propertyInData)(_, E, O, k.opts.ownProperties);
        l.setParams({
          property: O,
          depsCount: A.length,
          deps: A.join(", ")
        }), k.allErrors ? _.if($, () => {
          for (const b of A)
            (0, s.checkReportMissingProp)(l, b);
        }) : (_.if((0, e._)`${$} && (${(0, s.checkMissingProp)(l, A, R)})`), (0, s.reportMissingProp)(l, R), _.else());
      }
    }
    t.validatePropertyDeps = a;
    function f(l, v = l.schema) {
      const { gen: _, data: E, keyword: k, it: R } = l, O = _.name("valid");
      for (const A in v)
        (0, i.alwaysValidSchema)(R, v[A]) || (_.if(
          (0, s.propertyInData)(_, E, A, R.opts.ownProperties),
          () => {
            const $ = l.subschema({ keyword: k, schemaProp: A }, O);
            l.mergeValidEvaluated($, O);
          },
          () => _.var(O, !0)
          // TODO var
        ), l.ok(O));
    }
    t.validateSchemaDeps = f, t.default = c;
  })(ar)), ar;
}
var _t = {}, Is;
function Ri() {
  if (Is) return _t;
  Is = 1, Object.defineProperty(_t, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), s = {
    keyword: "propertyNames",
    type: "object",
    schemaType: ["object", "boolean"],
    error: {
      message: "property name must be valid",
      params: ({ params: c }) => (0, t._)`{propertyName: ${c.propertyName}}`
    },
    code(c) {
      const { gen: r, schema: a, data: f, it: l } = c;
      if ((0, e.alwaysValidSchema)(l, a))
        return;
      const v = r.name("valid");
      r.forIn("key", f, (_) => {
        c.setParams({ propertyName: _ }), c.subschema({
          keyword: "propertyNames",
          data: _,
          dataTypes: ["string"],
          propertyName: _,
          compositeRule: !0
        }, v), r.if((0, t.not)(v), () => {
          c.error(!0), l.allErrors || r.break();
        });
      }), c.ok(v);
    }
  };
  return _t.default = s, _t;
}
var $t = {}, Cs;
function un() {
  if (Cs) return $t;
  Cs = 1, Object.defineProperty($t, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ ge(), e = /* @__PURE__ */ J(), i = /* @__PURE__ */ Ee(), s = /* @__PURE__ */ Q(), r = {
    keyword: "additionalProperties",
    type: ["object"],
    schemaType: ["boolean", "object"],
    allowUndefined: !0,
    trackErrors: !0,
    error: {
      message: "must NOT have additional properties",
      params: ({ params: a }) => (0, e._)`{additionalProperty: ${a.additionalProperty}}`
    },
    code(a) {
      const { gen: f, schema: l, parentSchema: v, data: _, errsCount: E, it: k } = a;
      if (!E)
        throw new Error("ajv implementation error");
      const { allErrors: R, opts: O } = k;
      if (k.props = !0, O.removeAdditional !== "all" && (0, s.alwaysValidSchema)(k, l))
        return;
      const A = (0, t.allSchemaProperties)(v.properties), $ = (0, t.allSchemaProperties)(v.patternProperties);
      b(), a.ok((0, e._)`${E} === ${i.default.errors}`);
      function b() {
        f.forIn("key", _, (y) => {
          !A.length && !$.length ? P(y) : f.if(p(y), () => P(y));
        });
      }
      function p(y) {
        let S;
        if (A.length > 8) {
          const C = (0, s.schemaRefOrVal)(k, v.properties, "properties");
          S = (0, t.isOwnProperty)(f, C, y);
        } else A.length ? S = (0, e.or)(...A.map((C) => (0, e._)`${y} === ${C}`)) : S = e.nil;
        return $.length && (S = (0, e.or)(S, ...$.map((C) => (0, e._)`${(0, t.usePattern)(a, C)}.test(${y})`))), (0, e.not)(S);
      }
      function w(y) {
        f.code((0, e._)`delete ${_}[${y}]`);
      }
      function P(y) {
        if (O.removeAdditional === "all" || O.removeAdditional && l === !1) {
          w(y);
          return;
        }
        if (l === !1) {
          a.setParams({ additionalProperty: y }), a.error(), R || f.break();
          return;
        }
        if (typeof l == "object" && !(0, s.alwaysValidSchema)(k, l)) {
          const S = f.name("valid");
          O.removeAdditional === "failing" ? (d(y, S, !1), f.if((0, e.not)(S), () => {
            a.reset(), w(y);
          })) : (d(y, S), R || f.if((0, e.not)(S), () => f.break()));
        }
      }
      function d(y, S, C) {
        const M = {
          keyword: "additionalProperties",
          dataProp: y,
          dataPropType: s.Type.Str
        };
        C === !1 && Object.assign(M, {
          compositeRule: !0,
          createErrors: !1,
          allErrors: !1
        }), a.subschema(M, S);
      }
    }
  };
  return $t.default = r, $t;
}
var bt = {}, Ts;
function Oi() {
  if (Ts) return bt;
  Ts = 1, Object.defineProperty(bt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ Kt(), e = /* @__PURE__ */ ge(), i = /* @__PURE__ */ Q(), s = /* @__PURE__ */ un(), c = {
    keyword: "properties",
    type: "object",
    schemaType: "object",
    code(r) {
      const { gen: a, schema: f, parentSchema: l, data: v, it: _ } = r;
      _.opts.removeAdditional === "all" && l.additionalProperties === void 0 && s.default.code(new t.KeywordCxt(_, s.default, "additionalProperties"));
      const E = (0, e.allSchemaProperties)(f);
      for (const $ of E)
        _.definedProperties.add($);
      _.opts.unevaluated && E.length && _.props !== !0 && (_.props = i.mergeEvaluated.props(a, (0, i.toHash)(E), _.props));
      const k = E.filter(($) => !(0, i.alwaysValidSchema)(_, f[$]));
      if (k.length === 0)
        return;
      const R = a.name("valid");
      for (const $ of k)
        O($) ? A($) : (a.if((0, e.propertyInData)(a, v, $, _.opts.ownProperties)), A($), _.allErrors || a.else().var(R, !0), a.endIf()), r.it.definedProperties.add($), r.ok(R);
      function O($) {
        return _.opts.useDefaults && !_.compositeRule && f[$].default !== void 0;
      }
      function A($) {
        r.subschema({
          keyword: "properties",
          schemaProp: $,
          dataProp: $
        }, R);
      }
    }
  };
  return bt.default = c, bt;
}
var wt = {}, qs;
function Ai() {
  if (qs) return wt;
  qs = 1, Object.defineProperty(wt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ ge(), e = /* @__PURE__ */ J(), i = /* @__PURE__ */ Q(), s = /* @__PURE__ */ Q(), c = {
    keyword: "patternProperties",
    type: "object",
    schemaType: "object",
    code(r) {
      const { gen: a, schema: f, data: l, parentSchema: v, it: _ } = r, { opts: E } = _, k = (0, t.allSchemaProperties)(f), R = k.filter((P) => (0, i.alwaysValidSchema)(_, f[P]));
      if (k.length === 0 || R.length === k.length && (!_.opts.unevaluated || _.props === !0))
        return;
      const O = E.strictSchema && !E.allowMatchingProperties && v.properties, A = a.name("valid");
      _.props !== !0 && !(_.props instanceof e.Name) && (_.props = (0, s.evaluatedPropsToName)(a, _.props));
      const { props: $ } = _;
      b();
      function b() {
        for (const P of k)
          O && p(P), _.allErrors ? w(P) : (a.var(A, !0), w(P), a.if(A));
      }
      function p(P) {
        for (const d in O)
          new RegExp(P).test(d) && (0, i.checkStrictMode)(_, `property ${d} matches pattern ${P} (use allowMatchingProperties)`);
      }
      function w(P) {
        a.forIn("key", l, (d) => {
          a.if((0, e._)`${(0, t.usePattern)(r, P)}.test(${d})`, () => {
            const y = R.includes(P);
            y || r.subschema({
              keyword: "patternProperties",
              schemaProp: P,
              dataProp: d,
              dataPropType: s.Type.Str
            }, A), _.opts.unevaluated && $ !== !0 ? a.assign((0, e._)`${$}[${d}]`, !0) : !y && !_.allErrors && a.if((0, e.not)(A), () => a.break());
          });
        });
      }
    }
  };
  return wt.default = c, wt;
}
var Et = {}, Ms;
function Ni() {
  if (Ms) return Et;
  Ms = 1, Object.defineProperty(Et, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ Q(), e = {
    keyword: "not",
    schemaType: ["object", "boolean"],
    trackErrors: !0,
    code(i) {
      const { gen: s, schema: c, it: r } = i;
      if ((0, t.alwaysValidSchema)(r, c)) {
        i.fail();
        return;
      }
      const a = s.name("valid");
      i.subschema({
        keyword: "not",
        compositeRule: !0,
        createErrors: !1,
        allErrors: !1
      }, a), i.failResult(a, () => i.reset(), () => i.error());
    },
    error: { message: "must NOT be valid" }
  };
  return Et.default = e, Et;
}
var St = {}, Ds;
function ki() {
  if (Ds) return St;
  Ds = 1, Object.defineProperty(St, "__esModule", { value: !0 });
  const e = {
    keyword: "anyOf",
    schemaType: "array",
    trackErrors: !0,
    code: (/* @__PURE__ */ ge()).validateUnion,
    error: { message: "must match a schema in anyOf" }
  };
  return St.default = e, St;
}
var Pt = {}, xs;
function ji() {
  if (xs) return Pt;
  xs = 1, Object.defineProperty(Pt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), s = {
    keyword: "oneOf",
    schemaType: "array",
    trackErrors: !0,
    error: {
      message: "must match exactly one schema in oneOf",
      params: ({ params: c }) => (0, t._)`{passingSchemas: ${c.passing}}`
    },
    code(c) {
      const { gen: r, schema: a, parentSchema: f, it: l } = c;
      if (!Array.isArray(a))
        throw new Error("ajv implementation error");
      if (l.opts.discriminator && f.discriminator)
        return;
      const v = a, _ = r.let("valid", !1), E = r.let("passing", null), k = r.name("_valid");
      c.setParams({ passing: E }), r.block(R), c.result(_, () => c.reset(), () => c.error(!0));
      function R() {
        v.forEach((O, A) => {
          let $;
          (0, e.alwaysValidSchema)(l, O) ? r.var(k, !0) : $ = c.subschema({
            keyword: "oneOf",
            schemaProp: A,
            compositeRule: !0
          }, k), A > 0 && r.if((0, t._)`${k} && ${_}`).assign(_, !1).assign(E, (0, t._)`[${E}, ${A}]`).else(), r.if(k, () => {
            r.assign(_, !0), r.assign(E, A), $ && c.mergeEvaluated($, t.Name);
          });
        });
      }
    }
  };
  return Pt.default = s, Pt;
}
var Rt = {}, Fs;
function Ii() {
  if (Fs) return Rt;
  Fs = 1, Object.defineProperty(Rt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ Q(), e = {
    keyword: "allOf",
    schemaType: "array",
    code(i) {
      const { gen: s, schema: c, it: r } = i;
      if (!Array.isArray(c))
        throw new Error("ajv implementation error");
      const a = s.name("valid");
      c.forEach((f, l) => {
        if ((0, t.alwaysValidSchema)(r, f))
          return;
        const v = i.subschema({ keyword: "allOf", schemaProp: l }, a);
        i.ok(a), i.mergeEvaluated(v);
      });
    }
  };
  return Rt.default = e, Rt;
}
var Ot = {}, Us;
function Ci() {
  if (Us) return Ot;
  Us = 1, Object.defineProperty(Ot, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Q(), s = {
    keyword: "if",
    schemaType: ["object", "boolean"],
    trackErrors: !0,
    error: {
      message: ({ params: r }) => (0, t.str)`must match "${r.ifClause}" schema`,
      params: ({ params: r }) => (0, t._)`{failingKeyword: ${r.ifClause}}`
    },
    code(r) {
      const { gen: a, parentSchema: f, it: l } = r;
      f.then === void 0 && f.else === void 0 && (0, e.checkStrictMode)(l, '"if" without "then" and "else" is ignored');
      const v = c(l, "then"), _ = c(l, "else");
      if (!v && !_)
        return;
      const E = a.let("valid", !0), k = a.name("_valid");
      if (R(), r.reset(), v && _) {
        const A = a.let("ifClause");
        r.setParams({ ifClause: A }), a.if(k, O("then", A), O("else", A));
      } else v ? a.if(k, O("then")) : a.if((0, t.not)(k), O("else"));
      r.pass(E, () => r.error(!0));
      function R() {
        const A = r.subschema({
          keyword: "if",
          compositeRule: !0,
          createErrors: !1,
          allErrors: !1
        }, k);
        r.mergeEvaluated(A);
      }
      function O(A, $) {
        return () => {
          const b = r.subschema({ keyword: A }, k);
          a.assign(E, k), r.mergeValidEvaluated(b, E), $ ? a.assign($, (0, t._)`${A}`) : r.setParams({ ifClause: A });
        };
      }
    }
  };
  function c(r, a) {
    const f = r.schema[a];
    return f !== void 0 && !(0, e.alwaysValidSchema)(r, f);
  }
  return Ot.default = s, Ot;
}
var At = {}, Vs;
function Ti() {
  if (Vs) return At;
  Vs = 1, Object.defineProperty(At, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ Q(), e = {
    keyword: ["then", "else"],
    schemaType: ["object", "boolean"],
    code({ keyword: i, parentSchema: s, it: c }) {
      s.if === void 0 && (0, t.checkStrictMode)(c, `"${i}" without "if" is ignored`);
    }
  };
  return At.default = e, At;
}
var zs;
function qi() {
  if (zs) return mt;
  zs = 1, Object.defineProperty(mt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ cn(), e = /* @__PURE__ */ wi(), i = /* @__PURE__ */ ln(), s = /* @__PURE__ */ Ei(), c = /* @__PURE__ */ Si(), r = /* @__PURE__ */ Pi(), a = /* @__PURE__ */ Ri(), f = /* @__PURE__ */ un(), l = /* @__PURE__ */ Oi(), v = /* @__PURE__ */ Ai(), _ = /* @__PURE__ */ Ni(), E = /* @__PURE__ */ ki(), k = /* @__PURE__ */ ji(), R = /* @__PURE__ */ Ii(), O = /* @__PURE__ */ Ci(), A = /* @__PURE__ */ Ti();
  function $(b = !1) {
    const p = [
      // any
      _.default,
      E.default,
      k.default,
      R.default,
      O.default,
      A.default,
      // object
      a.default,
      f.default,
      r.default,
      l.default,
      v.default
    ];
    return b ? p.push(e.default, s.default) : p.push(t.default, i.default), p.push(c.default), p;
  }
  return mt.default = $, mt;
}
var Nt = {}, kt = {}, Hs;
function Mi() {
  if (Hs) return kt;
  Hs = 1, Object.defineProperty(kt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), i = {
    keyword: "format",
    type: ["number", "string"],
    schemaType: "string",
    $data: !0,
    error: {
      message: ({ schemaCode: s }) => (0, t.str)`must match format "${s}"`,
      params: ({ schemaCode: s }) => (0, t._)`{format: ${s}}`
    },
    code(s, c) {
      const { gen: r, data: a, $data: f, schema: l, schemaCode: v, it: _ } = s, { opts: E, errSchemaPath: k, schemaEnv: R, self: O } = _;
      if (!E.validateFormats)
        return;
      f ? A() : $();
      function A() {
        const b = r.scopeValue("formats", {
          ref: O.formats,
          code: E.code.formats
        }), p = r.const("fDef", (0, t._)`${b}[${v}]`), w = r.let("fType"), P = r.let("format");
        r.if((0, t._)`typeof ${p} == "object" && !(${p} instanceof RegExp)`, () => r.assign(w, (0, t._)`${p}.type || "string"`).assign(P, (0, t._)`${p}.validate`), () => r.assign(w, (0, t._)`"string"`).assign(P, p)), s.fail$data((0, t.or)(d(), y()));
        function d() {
          return E.strictSchema === !1 ? t.nil : (0, t._)`${v} && !${P}`;
        }
        function y() {
          const S = R.$async ? (0, t._)`(${p}.async ? await ${P}(${a}) : ${P}(${a}))` : (0, t._)`${P}(${a})`, C = (0, t._)`(typeof ${P} == "function" ? ${S} : ${P}.test(${a}))`;
          return (0, t._)`${P} && ${P} !== true && ${w} === ${c} && !${C}`;
        }
      }
      function $() {
        const b = O.formats[l];
        if (!b) {
          d();
          return;
        }
        if (b === !0)
          return;
        const [p, w, P] = y(b);
        p === c && s.pass(S());
        function d() {
          if (E.strictSchema === !1) {
            O.logger.warn(C());
            return;
          }
          throw new Error(C());
          function C() {
            return `unknown format "${l}" ignored in schema at path "${k}"`;
          }
        }
        function y(C) {
          const M = C instanceof RegExp ? (0, t.regexpCode)(C) : E.code.formats ? (0, t._)`${E.code.formats}${(0, t.getProperty)(l)}` : void 0, x = r.scopeValue("formats", { key: l, ref: C, code: M });
          return typeof C == "object" && !(C instanceof RegExp) ? [C.type || "string", C.validate, (0, t._)`${x}.validate`] : ["string", C, x];
        }
        function S() {
          if (typeof b == "object" && !(b instanceof RegExp) && b.async) {
            if (!R.$async)
              throw new Error("async format in sync schema");
            return (0, t._)`await ${P}(${a})`;
          }
          return typeof w == "function" ? (0, t._)`${P}(${a})` : (0, t._)`${P}.test(${a})`;
        }
      }
    }
  };
  return kt.default = i, kt;
}
var Ls;
function Di() {
  if (Ls) return Nt;
  Ls = 1, Object.defineProperty(Nt, "__esModule", { value: !0 });
  const e = [(/* @__PURE__ */ Mi()).default];
  return Nt.default = e, Nt;
}
var Oe = {}, Ks;
function xi() {
  return Ks || (Ks = 1, Object.defineProperty(Oe, "__esModule", { value: !0 }), Oe.contentVocabulary = Oe.metadataVocabulary = void 0, Oe.metadataVocabulary = [
    "title",
    "description",
    "default",
    "deprecated",
    "readOnly",
    "writeOnly",
    "examples"
  ], Oe.contentVocabulary = [
    "contentMediaType",
    "contentEncoding",
    "contentSchema"
  ]), Oe;
}
var Gs;
function Fi() {
  if (Gs) return Ye;
  Gs = 1, Object.defineProperty(Ye, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ li(), e = /* @__PURE__ */ bi(), i = /* @__PURE__ */ qi(), s = /* @__PURE__ */ Di(), c = /* @__PURE__ */ xi(), r = [
    t.default,
    e.default,
    (0, i.default)(),
    s.default,
    c.metadataVocabulary,
    c.contentVocabulary
  ];
  return Ye.default = r, Ye;
}
var jt = {}, Ue = {}, Bs;
function Ui() {
  if (Bs) return Ue;
  Bs = 1, Object.defineProperty(Ue, "__esModule", { value: !0 }), Ue.DiscrError = void 0;
  var t;
  return (function(e) {
    e.Tag = "tag", e.Mapping = "mapping";
  })(t || (Ue.DiscrError = t = {})), Ue;
}
var Ws;
function Vi() {
  if (Ws) return jt;
  Ws = 1, Object.defineProperty(jt, "__esModule", { value: !0 });
  const t = /* @__PURE__ */ J(), e = /* @__PURE__ */ Ui(), i = /* @__PURE__ */ br(), s = /* @__PURE__ */ Gt(), c = /* @__PURE__ */ Q(), a = {
    keyword: "discriminator",
    type: "object",
    schemaType: "object",
    error: {
      message: ({ params: { discrError: f, tagName: l } }) => f === e.DiscrError.Tag ? `tag "${l}" must be string` : `value of tag "${l}" must be in oneOf`,
      params: ({ params: { discrError: f, tag: l, tagName: v } }) => (0, t._)`{error: ${f}, tag: ${v}, tagValue: ${l}}`
    },
    code(f) {
      const { gen: l, data: v, schema: _, parentSchema: E, it: k } = f, { oneOf: R } = E;
      if (!k.opts.discriminator)
        throw new Error("discriminator: requires discriminator option");
      const O = _.propertyName;
      if (typeof O != "string")
        throw new Error("discriminator: requires propertyName");
      if (_.mapping)
        throw new Error("discriminator: mapping is not supported");
      if (!R)
        throw new Error("discriminator: requires oneOf keyword");
      const A = l.let("valid", !1), $ = l.const("tag", (0, t._)`${v}${(0, t.getProperty)(O)}`);
      l.if((0, t._)`typeof ${$} == "string"`, () => b(), () => f.error(!1, { discrError: e.DiscrError.Tag, tag: $, tagName: O })), f.ok(A);
      function b() {
        const P = w();
        l.if(!1);
        for (const d in P)
          l.elseIf((0, t._)`${$} === ${d}`), l.assign(A, p(P[d]));
        l.else(), f.error(!1, { discrError: e.DiscrError.Mapping, tag: $, tagName: O }), l.endIf();
      }
      function p(P) {
        const d = l.name("valid"), y = f.subschema({ keyword: "oneOf", schemaProp: P }, d);
        return f.mergeEvaluated(y, t.Name), d;
      }
      function w() {
        var P;
        const d = {}, y = C(E);
        let S = !0;
        for (let V = 0; V < R.length; V++) {
          let H = R[V];
          if (H?.$ref && !(0, c.schemaHasRulesButRef)(H, k.self.RULES)) {
            const B = H.$ref;
            if (H = i.resolveRef.call(k.self, k.schemaEnv.root, k.baseId, B), H instanceof i.SchemaEnv && (H = H.schema), H === void 0)
              throw new s.default(k.opts.uriResolver, k.baseId, B);
          }
          const z = (P = H?.properties) === null || P === void 0 ? void 0 : P[O];
          if (typeof z != "object")
            throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${O}"`);
          S = S && (y || C(H)), M(z, V);
        }
        if (!S)
          throw new Error(`discriminator: "${O}" must be required`);
        return d;
        function C({ required: V }) {
          return Array.isArray(V) && V.includes(O);
        }
        function M(V, H) {
          if (V.const)
            x(V.const, H);
          else if (V.enum)
            for (const z of V.enum)
              x(z, H);
          else
            throw new Error(`discriminator: "properties/${O}" must have "const" or "enum"`);
        }
        function x(V, H) {
          if (typeof V != "string" || V in d)
            throw new Error(`discriminator: "${O}" values must be unique strings`);
          d[V] = H;
        }
      }
    }
  };
  return jt.default = a, jt;
}
const zi = "http://json-schema.org/draft-07/schema#", Hi = "http://json-schema.org/draft-07/schema#", Li = "Core schema meta-schema", Ki = { schemaArray: { type: "array", minItems: 1, items: { $ref: "#" } }, nonNegativeInteger: { type: "integer", minimum: 0 }, nonNegativeIntegerDefault0: { allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }] }, simpleTypes: { enum: ["array", "boolean", "integer", "null", "number", "object", "string"] }, stringArray: { type: "array", items: { type: "string" }, uniqueItems: !0, default: [] } }, Gi = ["object", "boolean"], Bi = { $id: { type: "string", format: "uri-reference" }, $schema: { type: "string", format: "uri" }, $ref: { type: "string", format: "uri-reference" }, $comment: { type: "string" }, title: { type: "string" }, description: { type: "string" }, default: !0, readOnly: { type: "boolean", default: !1 }, examples: { type: "array", items: !0 }, multipleOf: { type: "number", exclusiveMinimum: 0 }, maximum: { type: "number" }, exclusiveMaximum: { type: "number" }, minimum: { type: "number" }, exclusiveMinimum: { type: "number" }, maxLength: { $ref: "#/definitions/nonNegativeInteger" }, minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" }, pattern: { type: "string", format: "regex" }, additionalItems: { $ref: "#" }, items: { anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }], default: !0 }, maxItems: { $ref: "#/definitions/nonNegativeInteger" }, minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" }, uniqueItems: { type: "boolean", default: !1 }, contains: { $ref: "#" }, maxProperties: { $ref: "#/definitions/nonNegativeInteger" }, minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" }, required: { $ref: "#/definitions/stringArray" }, additionalProperties: { $ref: "#" }, definitions: { type: "object", additionalProperties: { $ref: "#" }, default: {} }, properties: { type: "object", additionalProperties: { $ref: "#" }, default: {} }, patternProperties: { type: "object", additionalProperties: { $ref: "#" }, propertyNames: { format: "regex" }, default: {} }, dependencies: { type: "object", additionalProperties: { anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }] } }, propertyNames: { $ref: "#" }, const: !0, enum: { type: "array", items: !0, minItems: 1, uniqueItems: !0 }, type: { anyOf: [{ $ref: "#/definitions/simpleTypes" }, { type: "array", items: { $ref: "#/definitions/simpleTypes" }, minItems: 1, uniqueItems: !0 }] }, format: { type: "string" }, contentMediaType: { type: "string" }, contentEncoding: { type: "string" }, if: { $ref: "#" }, then: { $ref: "#" }, else: { $ref: "#" }, allOf: { $ref: "#/definitions/schemaArray" }, anyOf: { $ref: "#/definitions/schemaArray" }, oneOf: { $ref: "#/definitions/schemaArray" }, not: { $ref: "#" } }, Wi = {
  $schema: zi,
  $id: Hi,
  title: Li,
  definitions: Ki,
  type: Gi,
  properties: Bi,
  default: !0
};
var Js;
function Ji() {
  return Js || (Js = 1, (function(t, e) {
    Object.defineProperty(e, "__esModule", { value: !0 }), e.MissingRefError = e.ValidationError = e.CodeGen = e.Name = e.nil = e.stringify = e.str = e._ = e.KeywordCxt = e.Ajv = void 0;
    const i = /* @__PURE__ */ ai(), s = /* @__PURE__ */ Fi(), c = /* @__PURE__ */ Vi(), r = Wi, a = ["/properties"], f = "http://json-schema.org/draft-07/schema";
    class l extends i.default {
      _addVocabularies() {
        super._addVocabularies(), s.default.forEach((O) => this.addVocabulary(O)), this.opts.discriminator && this.addKeyword(c.default);
      }
      _addDefaultMetaSchema() {
        if (super._addDefaultMetaSchema(), !this.opts.meta)
          return;
        const O = this.opts.$data ? this.$dataMetaSchema(r, a) : r;
        this.addMetaSchema(O, f, !1), this.refs["http://json-schema.org/schema"] = f;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(f) ? f : void 0);
      }
    }
    e.Ajv = l, t.exports = e = l, t.exports.Ajv = l, Object.defineProperty(e, "__esModule", { value: !0 }), e.default = l;
    var v = /* @__PURE__ */ Kt();
    Object.defineProperty(e, "KeywordCxt", { enumerable: !0, get: function() {
      return v.KeywordCxt;
    } });
    var _ = /* @__PURE__ */ J();
    Object.defineProperty(e, "_", { enumerable: !0, get: function() {
      return _._;
    } }), Object.defineProperty(e, "str", { enumerable: !0, get: function() {
      return _.str;
    } }), Object.defineProperty(e, "stringify", { enumerable: !0, get: function() {
      return _.stringify;
    } }), Object.defineProperty(e, "nil", { enumerable: !0, get: function() {
      return _.nil;
    } }), Object.defineProperty(e, "Name", { enumerable: !0, get: function() {
      return _.Name;
    } }), Object.defineProperty(e, "CodeGen", { enumerable: !0, get: function() {
      return _.CodeGen;
    } });
    var E = /* @__PURE__ */ $r();
    Object.defineProperty(e, "ValidationError", { enumerable: !0, get: function() {
      return E.default;
    } });
    var k = /* @__PURE__ */ Gt();
    Object.defineProperty(e, "MissingRefError", { enumerable: !0, get: function() {
      return k.default;
    } });
  })(We, We.exports)), We.exports;
}
var Zi = /* @__PURE__ */ Ji();
const Qi = /* @__PURE__ */ Ln(Zi), Xi = "http://json-schema.org/draft-07/schema#", Yi = "MP Glass Project v1", ea = "object", ta = !1, ra = ["schema_version", "project", "appearance", "roles", "overrides"], sa = { schema_version: { const: 1 }, project: { type: "object", additionalProperties: !1, required: ["name"], properties: { name: { type: "string", minLength: 1, maxLength: 100 } } }, appearance: { type: "object", additionalProperties: !1, required: ["preset"], properties: { preset: { enum: ["glass-blue", "glass-warm", "glass-dark", "glass-light", "glass-oled", "glass-neutral"] } } }, roles: { type: "object", maxProperties: 500, propertyNames: { pattern: "^[a-z][a-z0-9_]{0,63}$" }, additionalProperties: { type: "string", minLength: 1, maxLength: 255 } }, overrides: { type: "object", maxProperties: 5e3, propertyNames: { maxLength: 255, not: { enum: ["__proto__", "constructor", "prototype"] } }, additionalProperties: { type: "object", additionalProperties: !1, properties: { name: { type: "string", minLength: 1, maxLength: 100 }, areaId: { type: "string", minLength: 1, maxLength: 255 }, hidden: { type: "boolean" }, presentation: { enum: ["light", "generic"] } } } } }, na = {
  $schema: Xi,
  title: Yi,
  type: ea,
  additionalProperties: ta,
  required: ra,
  properties: sa
}, ia = new Qi({ allErrors: !0, strict: !0 }).compile(na);
function dn(t) {
  if (!ia(t)) throw new Error("invalid_project");
  return structuredClone(t);
}
const Ve = /* @__PURE__ */ new WeakMap();
class fn {
  static invalidate(e) {
    Ve.delete(e.connection);
  }
  static async read(e, i = !1) {
    let s = Ve.get(e.connection);
    if (i || !s || Date.now() - s.at > 6e4) {
      const c = Promise.all([
        e.callWS({ type: "config/area_registry/list" }),
        e.callWS({ type: "config/device_registry/list" }),
        e.callWS({ type: "config/entity_registry/list" }),
        e.callWS({ type: "config/floor_registry/list" }).then((r) => ({ floors: r, warnings: [] })).catch((r) => {
          if (r?.code === "unknown_command") return { floors: [], warnings: ["floors:unsupported"] };
          throw r;
        })
      ]).then(([r, a, f, l]) => ({ areas: r, devices: a, entities: f, ...l }));
      s = { at: Date.now(), promise: c }, Ve.set(e.connection, s), c.catch(() => {
        Ve.get(e.connection)?.promise === c && Ve.delete(e.connection);
      });
    }
    return { ...await s.promise, states: e.states };
  }
}
async function hn(t) {
  const e = await t.callWS({ type: "mp_glass/project/get" });
  return { revision: e.revision, project: dn(e.project) };
}
async function aa(t, e) {
  return t.callWS({ type: "mp_glass/project/save", revision: e.revision, project: dn(e.project) });
}
class oa extends HTMLElement {
  static getCreateSuggestions() {
    return { title: "MP Glass", icon: "mdi:view-dashboard" };
  }
  static async generate(e, i) {
    const [s, { project: c }] = await Promise.all([fn.read(i), hn(i)]);
    return Hn.compose(rn.discover(s, c), c, !!e.debug && !!i.user?.is_admin);
  }
}
const Ut = class Ut extends we {
  constructor() {
    super(...arguments), this.busy = !1, this.failure = !1, this.saved = !1, this.started = !1;
  }
  updated() {
    this.hass && !this.started && (this.started = !0, this.load());
  }
  async load() {
    if (!(!this.hass || this.busy)) {
      this.busy = !0, this.failure = !1;
      try {
        this.response = await hn(this.hass), await this.scanInternal();
      } catch {
        this.failure = !0;
      } finally {
        this.busy = !1;
      }
    }
  }
  async scanInternal() {
    this.graph = rn.discover(await fn.read(this.hass, !0), this.response.project);
  }
  async scan() {
    if (!(!this.hass || !this.response || this.busy)) {
      this.busy = !0, this.failure = !1;
      try {
        await this.scanInternal();
      } catch {
        this.failure = !0;
      } finally {
        this.busy = !1;
      }
    }
  }
  override(e, i) {
    this.response && (this.response = { ...this.response, project: { ...this.response.project, overrides: { ...this.response.project.overrides, [e]: { ...this.response.project.overrides[e], ...i } } } }, this.saved = !1);
  }
  async save() {
    if (!(!this.response || !this.hass || this.busy)) {
      this.busy = !0, this.failure = !1, this.saved = !1;
      try {
        this.response = await aa(this.hass, this.response), this.saved = !0, await this.scanInternal();
      } catch {
        this.failure = !0;
      } finally {
        this.busy = !1;
      }
    }
  }
  exportProject() {
    const e = URL.createObjectURL(new Blob([JSON.stringify(this.response?.project, null, 2)], { type: "application/json" })), i = document.createElement("a");
    i.href = e, i.download = "mp-glass-project.json", i.click(), setTimeout(() => URL.revokeObjectURL(e), 1e3);
  }
  render() {
    const e = this.hass?.locale?.language ?? this.hass?.language, i = this.response?.project, s = this.graph?.devices.filter((r) => !r.disabled) ?? [], c = s.filter((r) => r.confidence < 0.9 || !r.areaId);
    return ie`<main aria-busy=${this.busy}><p class="overline">MP GLASS</p><h1>${Z(e, "setup")}</h1><p>${Z(e, "intro")}</p>
      ${this.failure ? ie`<p role="alert" class="error">${Z(e, "failed")}</p><button @click=${this.load}>${Z(e, "reload")}</button>` : ee}
      ${i ? ie`<section class="surface"><label>${Z(e, "name")}<input maxlength="100" .value=${i.project.name} @input=${(r) => {
      i.project.name = r.target.value, this.saved = !1;
    }}></label>
      <label>${Z(e, "preset")}<select .value=${i.appearance.preset} @change=${(r) => {
      i.appearance.preset = r.target.value, this.setAttribute("preset", i.appearance.preset), this.saved = !1;
    }}>${["glass-blue", "glass-warm", "glass-dark", "glass-light", "glass-oled", "glass-neutral"].map((r) => ie`<option value=${r}>${r.replace("glass-", "Glass ")}</option>`)}</select></label></section>
      <div class="stats"><div class="surface"><strong>${s.length}</strong><p>${Z(e, "devices")}</p></div><div class="surface"><strong>${s.filter((r) => r.confidence >= 0.9).length}</strong><p>${Z(e, "auto")}</p></div><div class="surface"><strong>${c.length}</strong><p>${Z(e, "review")}</p></div></div>
      <nav><button ?disabled=${this.busy} @click=${this.scan}>${Z(e, "scan")}</button><button class="primary" ?disabled=${this.busy || !this.hass?.user?.is_admin} @click=${this.save}>${Z(e, "save")}</button><button @click=${this.exportProject}>${Z(e, "export")}</button></nav>
      ${this.saved ? ie`<p role="status" class="success">${Z(e, "saved")}</p>` : ee}
      <section class="surface"><h2>${Z(e, "review")}</h2>${c.map((r) => ie`<div class="device"><strong>${r.name}</strong><p>${r.confidence >= 0.9 ? Z(e, "noArea") : Z(e, "unsupported")}</p><div class="row"><label>${Z(e, "area")}<select .value=${i.overrides[r.entityKey]?.areaId ?? r.areaId ?? ""} @change=${(a) => {
      const f = a.target.value;
      f && this.override(r.entityKey, { areaId: f });
    }}><option value="">${Z(e, "noArea")}</option>${this.graph?.areas.map((a) => ie`<option value=${a.area_id}>${a.name}</option>`)}</select></label><label><span>${Z(e, "hidden")}</span><input type="checkbox" .checked=${i.overrides[r.entityKey]?.hidden ?? r.hidden} @change=${(a) => this.override(r.entityKey, { hidden: a.target.checked })}></label></div><details><summary>${Z(e, "why")}</summary><pre>${JSON.stringify({ id: r.id, evidence: r.evidence, capabilities: r.capabilities }, null, 2)}</pre></details></div>`)}</section>
      <nav><a href="/config/lovelace/dashboards">${Z(e, "generate")}</a></nav><p>${Z(e, "generateHelp")}</p>` : this.busy ? ie`<p role="status">${Z(e, "pending")}</p>` : ee}
    </main>`;
  }
};
Ut.styles = [vr, pr`:host{min-height:100%;background:radial-gradient(at 90% 0%,#243957,transparent 55%),#0c1423;padding:32px;box-sizing:border-box}main{max-width:1040px;margin:auto}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.stats strong{font-size:2rem}.device{padding:16px 0;border-bottom:1px solid var(--mp-glass-border)}.device label{min-width:180px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.overline{letter-spacing:.25em;color:var(--mp-accent);font-size:.75rem;margin-bottom:20px}.success{color:#addeb8}@media(max-width:600px){:host{padding:16px}.stats{grid-template-columns:1fr}.stats .surface{padding:16px}}`], Ut.properties = { hass: { attribute: !1 }, response: { state: !0 }, graph: { state: !0 }, busy: { state: !0 }, failure: { state: !0 }, saved: { state: !0 } };
let dr = Ut;
for (const [t, e] of Object.entries({ "mp-glass-light": Tt, "mp-glass-generic": Vn, "mp-glass-card-editor": lr, "mp-glass-view": ur, "ll-strategy-dashboard-mp-glass": oa, "mp-glass-settings": dr }))
  customElements.get(t) || customElements.define(t, e);
window.customStrategies ??= [];
window.customStrategies.some((t) => t.type === "mp-glass") || window.customStrategies.push({ type: "mp-glass", strategyType: "dashboard", name: "MP Glass Dashboard" });
window.customCards ??= [];
window.customCards.some((t) => t.type === "mp-glass-light") || window.customCards.push({ type: "mp-glass-light", name: "MP Glass Light", preview: !0, getEntitySuggestion: (t, e) => e.startsWith("light.") ? { config: { type: "custom:mp-glass-light", entity: e } } : null });
//# sourceMappingURL=mp-glass.js.map
