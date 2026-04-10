var xa = Object.defineProperty;
var Ui = (t) => {
  throw TypeError(t);
};
var ba = (t, e, n) => e in t ? xa(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var dt = (t, e, n) => ba(t, typeof e != "symbol" ? e + "" : e, n), Kr = (t, e, n) => e.has(t) || Ui("Cannot " + n);
var y = (t, e, n) => (Kr(t, e, "read from private field"), n ? n.call(t) : e.get(t)), Z = (t, e, n) => e.has(t) ? Ui("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, n), G = (t, e, n, r) => (Kr(t, e, "write to private field"), r ? r.call(t, n) : e.set(t, n), n), yt = (t, e, n) => (Kr(t, e, "access private method"), n);
var Oo = Array.isArray, ka = Array.prototype.indexOf, Yr = Array.from, Ea = Object.defineProperty, mn = Object.getOwnPropertyDescriptor, Sa = Object.getOwnPropertyDescriptors, Na = Object.prototype, Aa = Array.prototype, Do = Object.getPrototypeOf, Gi = Object.isExtensible;
function Ma(t) {
  for (var e = 0; e < t.length; e++)
    t[e]();
}
function Yo() {
  var t, e, n = new Promise((r, i) => {
    t = r, e = i;
  });
  return { promise: n, resolve: t, reject: e };
}
const mt = 2, Nr = 4, Hr = 8, Ho = 1 << 24, be = 16, ke = 32, rn = 64, bi = 128, Ut = 512, xt = 1024, Ct = 2048, Ee = 4096, Dt = 8192, ye = 16384, ki = 32768, Mn = 65536, Wi = 1 << 17, Bo = 1 << 18, Fn = 1 << 19, Ia = 1 << 20, Ce = 1 << 25, $e = 32768, ei = 1 << 21, Ei = 1 << 22, Re = 1 << 23, qn = Symbol("$state"), Pa = Symbol("legacy props"), Ta = Symbol(""), gn = new class extends Error {
  constructor() {
    super(...arguments);
    dt(this, "name", "StaleReactionError");
    dt(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function za() {
  throw new Error("https://svelte.dev/e/async_derived_orphan");
}
function Ca(t) {
  throw new Error("https://svelte.dev/e/effect_in_teardown");
}
function Ra() {
  throw new Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function Fa(t) {
  throw new Error("https://svelte.dev/e/effect_orphan");
}
function La() {
  throw new Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Oa(t) {
  throw new Error("https://svelte.dev/e/props_invalid_value");
}
function Da() {
  throw new Error("https://svelte.dev/e/state_descriptors_fixed");
}
function Ya() {
  throw new Error("https://svelte.dev/e/state_prototype_fixed");
}
function Ha() {
  throw new Error("https://svelte.dev/e/state_unsafe_mutation");
}
function Ba() {
  throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
const Va = 1, Xa = 2, qa = 16, Ua = 1, Ga = 4, Wa = 8, Ka = 16, Za = 1, Ja = 2, gt = Symbol(), Qa = "http://www.w3.org/1999/xhtml";
function ja() {
  console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
function Vo(t) {
  return t === this.v;
}
function $a(t, e) {
  return t != t ? e == e : t !== e || t !== null && typeof t == "object" || typeof t == "function";
}
function Xo(t) {
  return !$a(t, this.v);
}
let Gt = null;
function In(t) {
  Gt = t;
}
function on(t, e = !1, n) {
  Gt = {
    p: Gt,
    i: !1,
    c: null,
    e: null,
    s: t,
    x: null,
    l: null
  };
}
function sn(t) {
  var e = (
    /** @type {ComponentContext} */
    Gt
  ), n = e.e;
  if (n !== null) {
    e.e = null;
    for (var r of n)
      as(r);
  }
  return e.i = !0, Gt = e.p, /** @type {T} */
  {};
}
function qo() {
  return !0;
}
let vn = [];
function tl() {
  var t = vn;
  vn = [], Ma(t);
}
function Fe(t) {
  if (vn.length === 0) {
    var e = vn;
    queueMicrotask(() => {
      e === vn && tl();
    });
  }
  vn.push(t);
}
function Uo(t) {
  var e = j;
  if (e === null)
    return K.f |= Re, t;
  if ((e.f & ki) === 0) {
    if ((e.f & bi) === 0)
      throw t;
    e.b.error(t);
  } else
    Pn(t, e);
}
function Pn(t, e) {
  for (; e !== null; ) {
    if ((e.f & bi) !== 0)
      try {
        e.b.error(t);
        return;
      } catch (n) {
        t = n;
      }
    e = e.parent;
  }
  throw t;
}
const el = -7169;
function ht(t, e) {
  t.f = t.f & el | e;
}
function Si(t) {
  (t.f & Ut) !== 0 || t.deps === null ? ht(t, xt) : ht(t, Ee);
}
function Go(t) {
  if (t !== null)
    for (const e of t)
      (e.f & mt) === 0 || (e.f & $e) === 0 || (e.f ^= $e, Go(
        /** @type {Derived} */
        e.deps
      ));
}
function Wo(t, e, n) {
  (t.f & Ct) !== 0 ? e.add(t) : (t.f & Ee) !== 0 && n.add(t), Go(t.deps), ht(t, xt);
}
const fr = /* @__PURE__ */ new Set();
let rt = null, vt = null, Jt = [], Ni = null, ni = !1;
var yn, wn, Ue, xn, nr, bn, kn, En, ue, ri, ii, Ko;
const qi = class qi {
  constructor() {
    Z(this, ue);
    dt(this, "committed", !1);
    /**
     * The current values of any sources that are updated in this batch
     * They keys of this map are identical to `this.#previous`
     * @type {Map<Source, any>}
     */
    dt(this, "current", /* @__PURE__ */ new Map());
    /**
     * The values of any sources that are updated in this batch _before_ those updates took place.
     * They keys of this map are identical to `this.#current`
     * @type {Map<Source, any>}
     */
    dt(this, "previous", /* @__PURE__ */ new Map());
    /**
     * When the batch is committed (and the DOM is updated), we need to remove old branches
     * and append new ones by calling the functions added inside (if/each/key/etc) blocks
     * @type {Set<() => void>}
     */
    Z(this, yn, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    Z(this, wn, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    Z(this, Ue, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    Z(this, xn, 0);
    /**
     * A deferred that resolves when the batch is committed, used with `settled()`
     * TODO replace with Promise.withResolvers once supported widely enough
     * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
     */
    Z(this, nr, null);
    /**
     * Deferred effects (which run after async work has completed) that are DIRTY
     * @type {Set<Effect>}
     */
    Z(this, bn, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    Z(this, kn, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    dt(this, "skipped_effects", /* @__PURE__ */ new Set());
    dt(this, "is_fork", !1);
    Z(this, En, !1);
  }
  is_deferred() {
    return this.is_fork || y(this, xn) > 0;
  }
  /**
   *
   * @param {Effect[]} root_effects
   */
  process(e) {
    var i;
    Jt = [], this.apply();
    var n = [], r = [];
    for (const o of e)
      yt(this, ue, ri).call(this, o, n, r);
    if (this.is_deferred())
      yt(this, ue, ii).call(this, r), yt(this, ue, ii).call(this, n);
    else {
      for (const o of y(this, yn)) o();
      y(this, yn).clear(), y(this, Ue) === 0 && yt(this, ue, Ko).call(this), rt = null, Ki(r), Ki(n), (i = y(this, nr)) == null || i.resolve();
    }
    vt = null;
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} value
   */
  capture(e, n) {
    n !== gt && !this.previous.has(e) && this.previous.set(e, n), (e.f & Re) === 0 && (this.current.set(e, e.v), vt == null || vt.set(e, e.v));
  }
  activate() {
    rt = this, this.apply();
  }
  deactivate() {
    rt === this && (rt = null, vt = null);
  }
  flush() {
    if (this.activate(), Jt.length > 0) {
      if (nl(), rt !== null && rt !== this)
        return;
    } else y(this, Ue) === 0 && this.process([]);
    this.deactivate();
  }
  discard() {
    for (const e of y(this, wn)) e(this);
    y(this, wn).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(e) {
    G(this, Ue, y(this, Ue) + 1), e && G(this, xn, y(this, xn) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(e) {
    G(this, Ue, y(this, Ue) - 1), e && G(this, xn, y(this, xn) - 1), !y(this, En) && (G(this, En, !0), Fe(() => {
      G(this, En, !1), this.is_deferred() ? Jt.length > 0 && this.flush() : this.revive();
    }));
  }
  revive() {
    for (const e of y(this, bn))
      y(this, kn).delete(e), ht(e, Ct), we(e);
    for (const e of y(this, kn))
      ht(e, Ee), we(e);
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(e) {
    y(this, yn).add(e);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(e) {
    y(this, wn).add(e);
  }
  settled() {
    return (y(this, nr) ?? G(this, nr, Yo())).promise;
  }
  static ensure() {
    if (rt === null) {
      const e = rt = new qi();
      fr.add(rt), Fe(() => {
        rt === e && e.flush();
      });
    }
    return rt;
  }
  apply() {
  }
};
yn = new WeakMap(), wn = new WeakMap(), Ue = new WeakMap(), xn = new WeakMap(), nr = new WeakMap(), bn = new WeakMap(), kn = new WeakMap(), En = new WeakMap(), ue = new WeakSet(), /**
 * Traverse the effect tree, executing effects or stashing
 * them for later execution as appropriate
 * @param {Effect} root
 * @param {Effect[]} effects
 * @param {Effect[]} render_effects
 */
ri = function(e, n, r) {
  e.f ^= xt;
  for (var i = e.first, o = null; i !== null; ) {
    var s = i.f, a = (s & (ke | rn)) !== 0, u = a && (s & xt) !== 0, f = u || (s & Dt) !== 0 || this.skipped_effects.has(i);
    if (!f && i.fn !== null) {
      a ? i.f ^= xt : o !== null && (s & (Nr | Hr | Ho)) !== 0 ? o.b.defer_effect(i) : (s & Nr) !== 0 ? n.push(i) : sr(i) && ((s & be) !== 0 && y(this, bn).add(i), Wn(i));
      var c = i.first;
      if (c !== null) {
        i = c;
        continue;
      }
    }
    var d = i.parent;
    for (i = i.next; i === null && d !== null; )
      d === o && (o = null), i = d.next, d = d.parent;
  }
}, /**
 * @param {Effect[]} effects
 */
ii = function(e) {
  for (var n = 0; n < e.length; n += 1)
    Wo(e[n], y(this, bn), y(this, kn));
}, Ko = function() {
  var i;
  if (fr.size > 1) {
    this.previous.clear();
    var e = vt, n = !0;
    for (const o of fr) {
      if (o === this) {
        n = !1;
        continue;
      }
      const s = [];
      for (const [u, f] of this.current) {
        if (o.current.has(u))
          if (n && f !== o.current.get(u))
            o.current.set(u, f);
          else
            continue;
        s.push(u);
      }
      if (s.length === 0)
        continue;
      const a = [...o.current.keys()].filter((u) => !this.current.has(u));
      if (a.length > 0) {
        var r = Jt;
        Jt = [];
        const u = /* @__PURE__ */ new Set(), f = /* @__PURE__ */ new Map();
        for (const c of s)
          Zo(c, a, u, f);
        if (Jt.length > 0) {
          rt = o, o.apply();
          for (const c of Jt)
            yt(i = o, ue, ri).call(i, c, [], []);
          o.deactivate();
        }
        Jt = r;
      }
    }
    rt = null, vt = e;
  }
  this.committed = !0, fr.delete(this);
};
let Le = qi;
function nl() {
  ni = !0;
  var t = null;
  try {
    for (var e = 0; Jt.length > 0; ) {
      var n = Le.ensure();
      if (e++ > 1e3) {
        var r, i;
        rl();
      }
      n.process(Jt), Oe.clear();
    }
  } finally {
    ni = !1, Ni = null;
  }
}
function rl() {
  try {
    La();
  } catch (t) {
    Pn(t, Ni);
  }
}
let Zt = null;
function Ki(t) {
  var e = t.length;
  if (e !== 0) {
    for (var n = 0; n < e; ) {
      var r = t[n++];
      if ((r.f & (ye | Dt)) === 0 && sr(r) && (Zt = /* @__PURE__ */ new Set(), Wn(r), r.deps === null && r.first === null && r.nodes === null && (r.teardown === null && r.ac === null ? hs(r) : r.fn = null), (Zt == null ? void 0 : Zt.size) > 0)) {
        Oe.clear();
        for (const i of Zt) {
          if ((i.f & (ye | Dt)) !== 0) continue;
          const o = [i];
          let s = i.parent;
          for (; s !== null; )
            Zt.has(s) && (Zt.delete(s), o.push(s)), s = s.parent;
          for (let a = o.length - 1; a >= 0; a--) {
            const u = o[a];
            (u.f & (ye | Dt)) === 0 && Wn(u);
          }
        }
        Zt.clear();
      }
    }
    Zt = null;
  }
}
function Zo(t, e, n, r) {
  if (!n.has(t) && (n.add(t), t.reactions !== null))
    for (const i of t.reactions) {
      const o = i.f;
      (o & mt) !== 0 ? Zo(
        /** @type {Derived} */
        i,
        e,
        n,
        r
      ) : (o & (Ei | be)) !== 0 && (o & Ct) === 0 && Jo(i, e, r) && (ht(i, Ct), we(
        /** @type {Effect} */
        i
      ));
    }
}
function Jo(t, e, n) {
  const r = n.get(t);
  if (r !== void 0) return r;
  if (t.deps !== null)
    for (const i of t.deps) {
      if (e.includes(i))
        return !0;
      if ((i.f & mt) !== 0 && Jo(
        /** @type {Derived} */
        i,
        e,
        n
      ))
        return n.set(
          /** @type {Derived} */
          i,
          !0
        ), !0;
    }
  return n.set(t, !1), !1;
}
function we(t) {
  for (var e = Ni = t; e.parent !== null; ) {
    e = e.parent;
    var n = e.f;
    if (ni && e === j && (n & be) !== 0 && (n & Bo) === 0)
      return;
    if ((n & (rn | ke)) !== 0) {
      if ((n & xt) === 0) return;
      e.f ^= xt;
    }
  }
  Jt.push(e);
}
function il(t) {
  let e = 0, n = tn(0), r;
  return () => {
    Ii() && (l(n), ls(() => (e === 0 && (r = zi(() => t(() => Un(n)))), e += 1, () => {
      Fe(() => {
        e -= 1, e === 0 && (r == null || r(), r = void 0, Un(n));
      });
    })));
  };
}
var ol = Mn | Fn | bi;
function sl(t, e, n) {
  new al(t, e, n);
}
var Bt, xi, re, Ge, ie, Vt, Nt, oe, me, Te, We, ze, Sn, Ke, Nn, An, pe, Or, ct, ll, ul, oi, _r, yr, si;
class al {
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(e, n, r) {
    Z(this, ct);
    /** @type {Boundary | null} */
    dt(this, "parent");
    dt(this, "is_pending", !1);
    /** @type {TemplateNode} */
    Z(this, Bt);
    /** @type {TemplateNode | null} */
    Z(this, xi, null);
    /** @type {BoundaryProps} */
    Z(this, re);
    /** @type {((anchor: Node) => void)} */
    Z(this, Ge);
    /** @type {Effect} */
    Z(this, ie);
    /** @type {Effect | null} */
    Z(this, Vt, null);
    /** @type {Effect | null} */
    Z(this, Nt, null);
    /** @type {Effect | null} */
    Z(this, oe, null);
    /** @type {DocumentFragment | null} */
    Z(this, me, null);
    /** @type {TemplateNode | null} */
    Z(this, Te, null);
    Z(this, We, 0);
    Z(this, ze, 0);
    Z(this, Sn, !1);
    Z(this, Ke, !1);
    /** @type {Set<Effect>} */
    Z(this, Nn, /* @__PURE__ */ new Set());
    /** @type {Set<Effect>} */
    Z(this, An, /* @__PURE__ */ new Set());
    /**
     * A source containing the number of pending async deriveds/expressions.
     * Only created if `$effect.pending()` is used inside the boundary,
     * otherwise updating the source results in needless `Batch.ensure()`
     * calls followed by no-op flushes
     * @type {Source<number> | null}
     */
    Z(this, pe, null);
    Z(this, Or, il(() => (G(this, pe, tn(y(this, We))), () => {
      G(this, pe, null);
    })));
    G(this, Bt, e), G(this, re, n), G(this, Ge, r), this.parent = /** @type {Effect} */
    j.b, this.is_pending = !!y(this, re).pending, G(this, ie, Pi(() => {
      j.b = this;
      {
        var i = yt(this, ct, oi).call(this);
        try {
          G(this, Vt, Xt(() => r(i)));
        } catch (o) {
          this.error(o);
        }
        y(this, ze) > 0 ? yt(this, ct, yr).call(this) : this.is_pending = !1;
      }
      return () => {
        var o;
        (o = y(this, Te)) == null || o.remove();
      };
    }, ol));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(e) {
    Wo(e, y(this, Nn), y(this, An));
  }
  /**
   * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
   * @returns {boolean}
   */
  is_rendered() {
    return !this.is_pending && (!this.parent || this.parent.is_rendered());
  }
  has_pending_snippet() {
    return !!y(this, re).pending;
  }
  /**
   * Update the source that powers `$effect.pending()` inside this boundary,
   * and controls when the current `pending` snippet (if any) is removed.
   * Do not call from inside the class
   * @param {1 | -1} d
   */
  update_pending_count(e) {
    yt(this, ct, si).call(this, e), G(this, We, y(this, We) + e), !(!y(this, pe) || y(this, Sn)) && (G(this, Sn, !0), Fe(() => {
      G(this, Sn, !1), y(this, pe) && Tn(y(this, pe), y(this, We));
    }));
  }
  get_effect_pending() {
    return y(this, Or).call(this), l(
      /** @type {Source<number>} */
      y(this, pe)
    );
  }
  /** @param {unknown} error */
  error(e) {
    var n = y(this, re).onerror;
    let r = y(this, re).failed;
    if (y(this, Ke) || !n && !r)
      throw e;
    y(this, Vt) && (zt(y(this, Vt)), G(this, Vt, null)), y(this, Nt) && (zt(y(this, Nt)), G(this, Nt, null)), y(this, oe) && (zt(y(this, oe)), G(this, oe, null));
    var i = !1, o = !1;
    const s = () => {
      if (i) {
        ja();
        return;
      }
      i = !0, o && Ba(), Le.ensure(), G(this, We, 0), y(this, oe) !== null && Je(y(this, oe), () => {
        G(this, oe, null);
      }), this.is_pending = this.has_pending_snippet(), G(this, Vt, yt(this, ct, _r).call(this, () => (G(this, Ke, !1), Xt(() => y(this, Ge).call(this, y(this, Bt)))))), y(this, ze) > 0 ? yt(this, ct, yr).call(this) : this.is_pending = !1;
    };
    var a = K;
    try {
      Pt(null), o = !0, n == null || n(e, s), o = !1;
    } catch (u) {
      Pn(u, y(this, ie) && y(this, ie).parent);
    } finally {
      Pt(a);
    }
    r && Fe(() => {
      G(this, oe, yt(this, ct, _r).call(this, () => {
        Le.ensure(), G(this, Ke, !0);
        try {
          return Xt(() => {
            r(
              y(this, Bt),
              () => e,
              () => s
            );
          });
        } catch (u) {
          return Pn(
            u,
            /** @type {Effect} */
            y(this, ie).parent
          ), null;
        } finally {
          G(this, Ke, !1);
        }
      }));
    });
  }
}
Bt = new WeakMap(), xi = new WeakMap(), re = new WeakMap(), Ge = new WeakMap(), ie = new WeakMap(), Vt = new WeakMap(), Nt = new WeakMap(), oe = new WeakMap(), me = new WeakMap(), Te = new WeakMap(), We = new WeakMap(), ze = new WeakMap(), Sn = new WeakMap(), Ke = new WeakMap(), Nn = new WeakMap(), An = new WeakMap(), pe = new WeakMap(), Or = new WeakMap(), ct = new WeakSet(), ll = function() {
  try {
    G(this, Vt, Xt(() => y(this, Ge).call(this, y(this, Bt))));
  } catch (e) {
    this.error(e);
  }
}, ul = function() {
  const e = y(this, re).pending;
  e && (G(this, Nt, Xt(() => e(y(this, Bt)))), Fe(() => {
    var n = yt(this, ct, oi).call(this);
    G(this, Vt, yt(this, ct, _r).call(this, () => (Le.ensure(), Xt(() => y(this, Ge).call(this, n))))), y(this, ze) > 0 ? yt(this, ct, yr).call(this) : (Je(
      /** @type {Effect} */
      y(this, Nt),
      () => {
        G(this, Nt, null);
      }
    ), this.is_pending = !1);
  }));
}, oi = function() {
  var e = y(this, Bt);
  return this.is_pending && (G(this, Te, en()), y(this, Bt).before(y(this, Te)), e = y(this, Te)), e;
}, /**
 * @param {() => Effect | null} fn
 */
_r = function(e) {
  var n = j, r = K, i = Gt;
  le(y(this, ie)), Pt(y(this, ie)), In(y(this, ie).ctx);
  try {
    return e();
  } catch (o) {
    return Uo(o), null;
  } finally {
    le(n), Pt(r), In(i);
  }
}, yr = function() {
  const e = (
    /** @type {(anchor: Node) => void} */
    y(this, re).pending
  );
  y(this, Vt) !== null && (G(this, me, document.createDocumentFragment()), y(this, me).append(
    /** @type {TemplateNode} */
    y(this, Te)
  ), vs(y(this, Vt), y(this, me))), y(this, Nt) === null && G(this, Nt, Xt(() => e(y(this, Bt))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
si = function(e) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && yt(n = this.parent, ct, si).call(n, e);
    return;
  }
  if (G(this, ze, y(this, ze) + e), y(this, ze) === 0) {
    this.is_pending = !1;
    for (const r of y(this, Nn))
      ht(r, Ct), we(r);
    for (const r of y(this, An))
      ht(r, Ee), we(r);
    y(this, Nn).clear(), y(this, An).clear(), y(this, Nt) && Je(y(this, Nt), () => {
      G(this, Nt, null);
    }), y(this, me) && (y(this, Bt).before(y(this, me)), G(this, me, null));
  }
};
function fl(t, e, n, r) {
  const i = Br;
  var o = t.filter((h) => !h.settled);
  if (n.length === 0 && o.length === 0) {
    r(e.map(i));
    return;
  }
  var s = rt, a = (
    /** @type {Effect} */
    j
  ), u = cl(), f = o.length === 1 ? o[0].promise : o.length > 1 ? Promise.all(o.map((h) => h.promise)) : null;
  function c(h) {
    u();
    try {
      r(h);
    } catch (v) {
      (a.f & ye) === 0 && Pn(v, a);
    }
    s == null || s.deactivate(), ai();
  }
  if (n.length === 0) {
    f.then(() => c(e.map(i)));
    return;
  }
  function d() {
    u(), Promise.all(n.map((h) => /* @__PURE__ */ hl(h))).then((h) => c([...e.map(i), ...h])).catch((h) => Pn(h, a));
  }
  f ? f.then(d) : d();
}
function cl() {
  var t = j, e = K, n = Gt, r = rt;
  return function(o = !0) {
    le(t), Pt(e), In(n), o && (r == null || r.activate());
  };
}
function ai() {
  le(null), Pt(null), In(null);
}
// @__NO_SIDE_EFFECTS__
function Br(t) {
  var e = mt | Ct, n = K !== null && (K.f & mt) !== 0 ? (
    /** @type {Derived} */
    K
  ) : null;
  return j !== null && (j.f |= Fn), {
    ctx: Gt,
    deps: null,
    effects: null,
    equals: Vo,
    f: e,
    fn: t,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      gt
    ),
    wv: 0,
    parent: n ?? j,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function hl(t, e, n) {
  let r = (
    /** @type {Effect | null} */
    j
  );
  r === null && za();
  var i = (
    /** @type {Boundary} */
    r.b
  ), o = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  ), s = tn(
    /** @type {V} */
    gt
  ), a = !K, u = /* @__PURE__ */ new Map();
  return bl(() => {
    var v;
    var f = Yo();
    o = f.promise;
    try {
      Promise.resolve(t()).then(f.resolve, f.reject).then(() => {
        c === rt && c.committed && c.deactivate(), ai();
      });
    } catch (p) {
      f.reject(p), ai();
    }
    var c = (
      /** @type {Batch} */
      rt
    );
    if (a) {
      var d = i.is_rendered();
      i.update_pending_count(1), c.increment(d), (v = u.get(c)) == null || v.reject(gn), u.delete(c), u.set(c, f);
    }
    const h = (p, E = void 0) => {
      if (c.activate(), E)
        E !== gn && (s.f |= Re, Tn(s, E));
      else {
        (s.f & Re) !== 0 && (s.f ^= Re), Tn(s, p);
        for (const [T, S] of u) {
          if (u.delete(T), T === c) break;
          S.reject(gn);
        }
      }
      a && (i.update_pending_count(-1), c.decrement(d));
    };
    f.promise.then(h, (p) => h(null, p || "unknown"));
  }), ss(() => {
    for (const f of u.values())
      f.reject(gn);
  }), new Promise((f) => {
    function c(d) {
      function h() {
        d === o ? f(s) : c(o);
      }
      d.then(h, h);
    }
    c(o);
  });
}
// @__NO_SIDE_EFFECTS__
function O(t) {
  const e = /* @__PURE__ */ Br(t);
  return ms(e), e;
}
// @__NO_SIDE_EFFECTS__
function Qo(t) {
  const e = /* @__PURE__ */ Br(t);
  return e.equals = Xo, e;
}
function jo(t) {
  var e = t.effects;
  if (e !== null) {
    t.effects = null;
    for (var n = 0; n < e.length; n += 1)
      zt(
        /** @type {Effect} */
        e[n]
      );
  }
}
function dl(t) {
  for (var e = t.parent; e !== null; ) {
    if ((e.f & mt) === 0)
      return (e.f & ye) === 0 ? (
        /** @type {Effect} */
        e
      ) : null;
    e = e.parent;
  }
  return null;
}
function Ai(t) {
  var e, n = j;
  le(dl(t));
  try {
    t.f &= ~$e, jo(t), e = ws(t);
  } finally {
    le(n);
  }
  return e;
}
function $o(t) {
  var e = Ai(t);
  if (!t.equals(e) && (t.wv = _s(), (!(rt != null && rt.is_fork) || t.deps === null) && (t.v = e, t.deps === null))) {
    ht(t, xt);
    return;
  }
  De || (vt !== null ? (Ii() || rt != null && rt.is_fork) && vt.set(t, e) : Si(t));
}
let li = /* @__PURE__ */ new Set();
const Oe = /* @__PURE__ */ new Map();
let ts = !1;
function tn(t, e) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: t,
    reactions: null,
    equals: Vo,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function lt(t, e) {
  const n = tn(t);
  return ms(n), n;
}
// @__NO_SIDE_EFFECTS__
function gl(t, e = !1, n = !0) {
  const r = tn(t);
  return e || (r.equals = Xo), r;
}
function V(t, e, n = !1) {
  K !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!$t || (K.f & Wi) !== 0) && qo() && (K.f & (mt | be | Ei | Wi)) !== 0 && !(kt != null && kt.includes(t)) && Ha();
  let r = n ? Ot(e) : e;
  return Tn(t, r);
}
function Tn(t, e) {
  if (!t.equals(e)) {
    var n = t.v;
    De ? Oe.set(t, e) : Oe.set(t, n), t.v = e;
    var r = Le.ensure();
    if (r.capture(t, n), (t.f & mt) !== 0) {
      const i = (
        /** @type {Derived} */
        t
      );
      (t.f & Ct) !== 0 && Ai(i), Si(i);
    }
    t.wv = _s(), es(t, Ct), j !== null && (j.f & xt) !== 0 && (j.f & (ke | rn)) === 0 && (Ht === null ? El([t]) : Ht.push(t)), !r.is_fork && li.size > 0 && !ts && vl();
  }
  return e;
}
function vl() {
  ts = !1;
  for (const t of li)
    (t.f & xt) !== 0 && ht(t, Ee), sr(t) && Wn(t);
  li.clear();
}
function Un(t) {
  V(t, t.v + 1);
}
function es(t, e) {
  var n = t.reactions;
  if (n !== null)
    for (var r = n.length, i = 0; i < r; i++) {
      var o = n[i], s = o.f, a = (s & Ct) === 0;
      if (a && ht(o, e), (s & mt) !== 0) {
        var u = (
          /** @type {Derived} */
          o
        );
        vt == null || vt.delete(u), (s & $e) === 0 && (s & Ut && (o.f |= $e), es(u, Ee));
      } else a && ((s & be) !== 0 && Zt !== null && Zt.add(
        /** @type {Effect} */
        o
      ), we(
        /** @type {Effect} */
        o
      ));
    }
}
function Ot(t) {
  if (typeof t != "object" || t === null || qn in t)
    return t;
  const e = Do(t);
  if (e !== Na && e !== Aa)
    return t;
  var n = /* @__PURE__ */ new Map(), r = Oo(t), i = /* @__PURE__ */ lt(0), o = Qe, s = (a) => {
    if (Qe === o)
      return a();
    var u = K, f = Qe;
    Pt(null), Qi(o);
    var c = a();
    return Pt(u), Qi(f), c;
  };
  return r && n.set("length", /* @__PURE__ */ lt(
    /** @type {any[]} */
    t.length
  )), new Proxy(
    /** @type {any} */
    t,
    {
      defineProperty(a, u, f) {
        (!("value" in f) || f.configurable === !1 || f.enumerable === !1 || f.writable === !1) && Da();
        var c = n.get(u);
        return c === void 0 ? c = s(() => {
          var d = /* @__PURE__ */ lt(f.value);
          return n.set(u, d), d;
        }) : V(c, f.value, !0), !0;
      },
      deleteProperty(a, u) {
        var f = n.get(u);
        if (f === void 0) {
          if (u in a) {
            const c = s(() => /* @__PURE__ */ lt(gt));
            n.set(u, c), Un(i);
          }
        } else
          V(f, gt), Un(i);
        return !0;
      },
      get(a, u, f) {
        var v;
        if (u === qn)
          return t;
        var c = n.get(u), d = u in a;
        if (c === void 0 && (!d || (v = mn(a, u)) != null && v.writable) && (c = s(() => {
          var p = Ot(d ? a[u] : gt), E = /* @__PURE__ */ lt(p);
          return E;
        }), n.set(u, c)), c !== void 0) {
          var h = l(c);
          return h === gt ? void 0 : h;
        }
        return Reflect.get(a, u, f);
      },
      getOwnPropertyDescriptor(a, u) {
        var f = Reflect.getOwnPropertyDescriptor(a, u);
        if (f && "value" in f) {
          var c = n.get(u);
          c && (f.value = l(c));
        } else if (f === void 0) {
          var d = n.get(u), h = d == null ? void 0 : d.v;
          if (d !== void 0 && h !== gt)
            return {
              enumerable: !0,
              configurable: !0,
              value: h,
              writable: !0
            };
        }
        return f;
      },
      has(a, u) {
        var h;
        if (u === qn)
          return !0;
        var f = n.get(u), c = f !== void 0 && f.v !== gt || Reflect.has(a, u);
        if (f !== void 0 || j !== null && (!c || (h = mn(a, u)) != null && h.writable)) {
          f === void 0 && (f = s(() => {
            var v = c ? Ot(a[u]) : gt, p = /* @__PURE__ */ lt(v);
            return p;
          }), n.set(u, f));
          var d = l(f);
          if (d === gt)
            return !1;
        }
        return c;
      },
      set(a, u, f, c) {
        var A;
        var d = n.get(u), h = u in a;
        if (r && u === "length")
          for (var v = f; v < /** @type {Source<number>} */
          d.v; v += 1) {
            var p = n.get(v + "");
            p !== void 0 ? V(p, gt) : v in a && (p = s(() => /* @__PURE__ */ lt(gt)), n.set(v + "", p));
          }
        if (d === void 0)
          (!h || (A = mn(a, u)) != null && A.writable) && (d = s(() => /* @__PURE__ */ lt(void 0)), V(d, Ot(f)), n.set(u, d));
        else {
          h = d.v !== gt;
          var E = s(() => Ot(f));
          V(d, E);
        }
        var T = Reflect.getOwnPropertyDescriptor(a, u);
        if (T != null && T.set && T.set.call(c, f), !h) {
          if (r && typeof u == "string") {
            var S = (
              /** @type {Source<number>} */
              n.get("length")
            ), D = Number(u);
            Number.isInteger(D) && D >= S.v && V(S, D + 1);
          }
          Un(i);
        }
        return !0;
      },
      ownKeys(a) {
        l(i);
        var u = Reflect.ownKeys(a).filter((d) => {
          var h = n.get(d);
          return h === void 0 || h.v !== gt;
        });
        for (var [f, c] of n)
          c.v !== gt && !(f in a) && u.push(f);
        return u;
      },
      setPrototypeOf() {
        Ya();
      }
    }
  );
}
var Zi, ns, rs, is;
function ml() {
  if (Zi === void 0) {
    Zi = window, ns = /Firefox/.test(navigator.userAgent);
    var t = Element.prototype, e = Node.prototype, n = Text.prototype;
    rs = mn(e, "firstChild").get, is = mn(e, "nextSibling").get, Gi(t) && (t.__click = void 0, t.__className = void 0, t.__attributes = null, t.__style = void 0, t.__e = void 0), Gi(n) && (n.__t = void 0);
  }
}
function en(t = "") {
  return document.createTextNode(t);
}
// @__NO_SIDE_EFFECTS__
function qt(t) {
  return (
    /** @type {TemplateNode | null} */
    rs.call(t)
  );
}
// @__NO_SIDE_EFFECTS__
function or(t) {
  return (
    /** @type {TemplateNode | null} */
    is.call(t)
  );
}
function ft(t, e) {
  return /* @__PURE__ */ qt(t);
}
function At(t, e = !1) {
  {
    var n = /* @__PURE__ */ qt(t);
    return n instanceof Comment && n.data === "" ? /* @__PURE__ */ or(n) : n;
  }
}
function Q(t, e = 1, n = !1) {
  let r = t;
  for (; e--; )
    r = /** @type {TemplateNode} */
    /* @__PURE__ */ or(r);
  return r;
}
function pl(t) {
  t.textContent = "";
}
function os() {
  return !1;
}
function Mi(t) {
  var e = K, n = j;
  Pt(null), le(null);
  try {
    return t();
  } finally {
    Pt(e), le(n);
  }
}
function _l(t) {
  j === null && (K === null && Fa(), Ra()), De && Ca();
}
function yl(t, e) {
  var n = e.last;
  n === null ? e.last = e.first = t : (n.next = t, t.prev = n, e.last = t);
}
function Se(t, e, n) {
  var r = j;
  r !== null && (r.f & Dt) !== 0 && (t |= Dt);
  var i = {
    ctx: Gt,
    deps: null,
    nodes: null,
    f: t | Ct | Ut,
    first: null,
    fn: e,
    last: null,
    next: null,
    parent: r,
    b: r && r.b,
    prev: null,
    teardown: null,
    wv: 0,
    ac: null
  };
  if (n)
    try {
      Wn(i), i.f |= ki;
    } catch (a) {
      throw zt(i), a;
    }
  else e !== null && we(i);
  var o = i;
  if (n && o.deps === null && o.teardown === null && o.nodes === null && o.first === o.last && // either `null`, or a singular child
  (o.f & Fn) === 0 && (o = o.first, (t & be) !== 0 && (t & Mn) !== 0 && o !== null && (o.f |= Mn)), o !== null && (o.parent = r, r !== null && yl(o, r), K !== null && (K.f & mt) !== 0 && (t & rn) === 0)) {
    var s = (
      /** @type {Derived} */
      K
    );
    (s.effects ?? (s.effects = [])).push(o);
  }
  return i;
}
function Ii() {
  return K !== null && !$t;
}
function ss(t) {
  const e = Se(Hr, null, !1);
  return ht(e, xt), e.teardown = t, e;
}
function Ar(t) {
  _l();
  var e = (
    /** @type {Effect} */
    j.f
  ), n = !K && (e & ke) !== 0 && (e & ki) === 0;
  if (n) {
    var r = (
      /** @type {ComponentContext} */
      Gt
    );
    (r.e ?? (r.e = [])).push(t);
  } else
    return as(t);
}
function as(t) {
  return Se(Nr | Ia, t, !1);
}
function wl(t) {
  Le.ensure();
  const e = Se(rn | Fn, t, !0);
  return (n = {}) => new Promise((r) => {
    n.outro ? Je(e, () => {
      zt(e), r(void 0);
    }) : (zt(e), r(void 0));
  });
}
function xl(t) {
  return Se(Nr, t, !1);
}
function bl(t) {
  return Se(Ei | Fn, t, !0);
}
function ls(t, e = 0) {
  return Se(Hr | e, t, !0);
}
function nt(t, e = [], n = [], r = []) {
  fl(r, e, n, (i) => {
    Se(Hr, () => t(...i.map(l)), !0);
  });
}
function Pi(t, e = 0) {
  var n = Se(be | e, t, !0);
  return n;
}
function Xt(t) {
  return Se(ke | Fn, t, !0);
}
function us(t) {
  var e = t.teardown;
  if (e !== null) {
    const n = De, r = K;
    Ji(!0), Pt(null);
    try {
      e.call(null);
    } finally {
      Ji(n), Pt(r);
    }
  }
}
function fs(t, e = !1) {
  var n = t.first;
  for (t.first = t.last = null; n !== null; ) {
    const i = n.ac;
    i !== null && Mi(() => {
      i.abort(gn);
    });
    var r = n.next;
    (n.f & rn) !== 0 ? n.parent = null : zt(n, e), n = r;
  }
}
function kl(t) {
  for (var e = t.first; e !== null; ) {
    var n = e.next;
    (e.f & ke) === 0 && zt(e), e = n;
  }
}
function zt(t, e = !0) {
  var n = !1;
  (e || (t.f & Bo) !== 0) && t.nodes !== null && t.nodes.end !== null && (cs(
    t.nodes.start,
    /** @type {TemplateNode} */
    t.nodes.end
  ), n = !0), fs(t, e && !n), Mr(t, 0), ht(t, ye);
  var r = t.nodes && t.nodes.t;
  if (r !== null)
    for (const o of r)
      o.stop();
  us(t);
  var i = t.parent;
  i !== null && i.first !== null && hs(t), t.next = t.prev = t.teardown = t.ctx = t.deps = t.fn = t.nodes = t.ac = null;
}
function cs(t, e) {
  for (; t !== null; ) {
    var n = t === e ? null : /* @__PURE__ */ or(t);
    t.remove(), t = n;
  }
}
function hs(t) {
  var e = t.parent, n = t.prev, r = t.next;
  n !== null && (n.next = r), r !== null && (r.prev = n), e !== null && (e.first === t && (e.first = r), e.last === t && (e.last = n));
}
function Je(t, e, n = !0) {
  var r = [];
  ds(t, r, !0);
  var i = () => {
    n && zt(t), e && e();
  }, o = r.length;
  if (o > 0) {
    var s = () => --o || i();
    for (var a of r)
      a.out(s);
  } else
    i();
}
function ds(t, e, n) {
  if ((t.f & Dt) === 0) {
    t.f ^= Dt;
    var r = t.nodes && t.nodes.t;
    if (r !== null)
      for (const a of r)
        (a.is_global || n) && e.push(a);
    for (var i = t.first; i !== null; ) {
      var o = i.next, s = (i.f & Mn) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (i.f & ke) !== 0 && (t.f & be) !== 0;
      ds(i, e, s ? n : !1), i = o;
    }
  }
}
function Ti(t) {
  gs(t, !0);
}
function gs(t, e) {
  if ((t.f & Dt) !== 0) {
    t.f ^= Dt, (t.f & xt) === 0 && (ht(t, Ct), we(t));
    for (var n = t.first; n !== null; ) {
      var r = n.next, i = (n.f & Mn) !== 0 || (n.f & ke) !== 0;
      gs(n, i ? e : !1), n = r;
    }
    var o = t.nodes && t.nodes.t;
    if (o !== null)
      for (const s of o)
        (s.is_global || e) && s.in();
  }
}
function vs(t, e) {
  if (t.nodes)
    for (var n = t.nodes.start, r = t.nodes.end; n !== null; ) {
      var i = n === r ? null : /* @__PURE__ */ or(n);
      e.append(n), n = i;
    }
}
let wr = !1, De = !1;
function Ji(t) {
  De = t;
}
let K = null, $t = !1;
function Pt(t) {
  K = t;
}
let j = null;
function le(t) {
  j = t;
}
let kt = null;
function ms(t) {
  K !== null && (kt === null ? kt = [t] : kt.push(t));
}
let Mt = null, Ft = 0, Ht = null;
function El(t) {
  Ht = t;
}
let ps = 1, Xe = 0, Qe = Xe;
function Qi(t) {
  Qe = t;
}
function _s() {
  return ++ps;
}
function sr(t) {
  var e = t.f;
  if ((e & Ct) !== 0)
    return !0;
  if (e & mt && (t.f &= ~$e), (e & Ee) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      t.deps
    ), r = n.length, i = 0; i < r; i++) {
      var o = n[i];
      if (sr(
        /** @type {Derived} */
        o
      ) && $o(
        /** @type {Derived} */
        o
      ), o.wv > t.wv)
        return !0;
    }
    (e & Ut) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    vt === null && ht(t, xt);
  }
  return !1;
}
function ys(t, e, n = !0) {
  var r = t.reactions;
  if (r !== null && !(kt != null && kt.includes(t)))
    for (var i = 0; i < r.length; i++) {
      var o = r[i];
      (o.f & mt) !== 0 ? ys(
        /** @type {Derived} */
        o,
        e,
        !1
      ) : e === o && (n ? ht(o, Ct) : (o.f & xt) !== 0 && ht(o, Ee), we(
        /** @type {Effect} */
        o
      ));
    }
}
function ws(t) {
  var p;
  var e = Mt, n = Ft, r = Ht, i = K, o = kt, s = Gt, a = $t, u = Qe, f = t.f;
  Mt = /** @type {null | Value[]} */
  null, Ft = 0, Ht = null, K = (f & (ke | rn)) === 0 ? t : null, kt = null, In(t.ctx), $t = !1, Qe = ++Xe, t.ac !== null && (Mi(() => {
    t.ac.abort(gn);
  }), t.ac = null);
  try {
    t.f |= ei;
    var c = (
      /** @type {Function} */
      t.fn
    ), d = c(), h = t.deps;
    if (Mt !== null) {
      var v;
      if (Mr(t, Ft), h !== null && Ft > 0)
        for (h.length = Ft + Mt.length, v = 0; v < Mt.length; v++)
          h[Ft + v] = Mt[v];
      else
        t.deps = h = Mt;
      if (Ii() && (t.f & Ut) !== 0)
        for (v = Ft; v < h.length; v++)
          ((p = h[v]).reactions ?? (p.reactions = [])).push(t);
    } else h !== null && Ft < h.length && (Mr(t, Ft), h.length = Ft);
    if (qo() && Ht !== null && !$t && h !== null && (t.f & (mt | Ee | Ct)) === 0)
      for (v = 0; v < /** @type {Source[]} */
      Ht.length; v++)
        ys(
          Ht[v],
          /** @type {Effect} */
          t
        );
    if (i !== null && i !== t) {
      if (Xe++, i.deps !== null)
        for (let E = 0; E < n; E += 1)
          i.deps[E].rv = Xe;
      if (e !== null)
        for (const E of e)
          E.rv = Xe;
      Ht !== null && (r === null ? r = Ht : r.push(.../** @type {Source[]} */
      Ht));
    }
    return (t.f & Re) !== 0 && (t.f ^= Re), d;
  } catch (E) {
    return Uo(E);
  } finally {
    t.f ^= ei, Mt = e, Ft = n, Ht = r, K = i, kt = o, In(s), $t = a, Qe = u;
  }
}
function Sl(t, e) {
  let n = e.reactions;
  if (n !== null) {
    var r = ka.call(n, t);
    if (r !== -1) {
      var i = n.length - 1;
      i === 0 ? n = e.reactions = null : (n[r] = n[i], n.pop());
    }
  }
  if (n === null && (e.f & mt) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (Mt === null || !Mt.includes(e))) {
    var o = (
      /** @type {Derived} */
      e
    );
    (o.f & Ut) !== 0 && (o.f ^= Ut, o.f &= ~$e), Si(o), jo(o), Mr(o, 0);
  }
}
function Mr(t, e) {
  var n = t.deps;
  if (n !== null)
    for (var r = e; r < n.length; r++)
      Sl(t, n[r]);
}
function Wn(t) {
  var e = t.f;
  if ((e & ye) === 0) {
    ht(t, xt);
    var n = j, r = wr;
    j = t, wr = !0;
    try {
      (e & (be | Ho)) !== 0 ? kl(t) : fs(t), us(t);
      var i = ws(t);
      t.teardown = typeof i == "function" ? i : null, t.wv = ps;
      var o;
    } finally {
      wr = r, j = n;
    }
  }
}
function l(t) {
  var e = t.f, n = (e & mt) !== 0;
  if (K !== null && !$t) {
    var r = j !== null && (j.f & ye) !== 0;
    if (!r && !(kt != null && kt.includes(t))) {
      var i = K.deps;
      if ((K.f & ei) !== 0)
        t.rv < Xe && (t.rv = Xe, Mt === null && i !== null && i[Ft] === t ? Ft++ : Mt === null ? Mt = [t] : Mt.push(t));
      else {
        (K.deps ?? (K.deps = [])).push(t);
        var o = t.reactions;
        o === null ? t.reactions = [K] : o.includes(K) || o.push(K);
      }
    }
  }
  if (De && Oe.has(t))
    return Oe.get(t);
  if (n) {
    var s = (
      /** @type {Derived} */
      t
    );
    if (De) {
      var a = s.v;
      return ((s.f & xt) === 0 && s.reactions !== null || bs(s)) && (a = Ai(s)), Oe.set(s, a), a;
    }
    var u = (s.f & Ut) === 0 && !$t && K !== null && (wr || (K.f & Ut) !== 0), f = s.deps === null;
    sr(s) && (u && (s.f |= Ut), $o(s)), u && !f && xs(s);
  }
  if (vt != null && vt.has(t))
    return vt.get(t);
  if ((t.f & Re) !== 0)
    throw t.v;
  return t.v;
}
function xs(t) {
  if (t.deps !== null) {
    t.f |= Ut;
    for (const e of t.deps)
      (e.reactions ?? (e.reactions = [])).push(t), (e.f & mt) !== 0 && (e.f & Ut) === 0 && xs(
        /** @type {Derived} */
        e
      );
  }
}
function bs(t) {
  if (t.v === gt) return !0;
  if (t.deps === null) return !1;
  for (const e of t.deps)
    if (Oe.has(e) || (e.f & mt) !== 0 && bs(
      /** @type {Derived} */
      e
    ))
      return !0;
  return !1;
}
function zi(t) {
  var e = $t;
  try {
    return $t = !0, t();
  } finally {
    $t = e;
  }
}
const Nl = ["touchstart", "touchmove"];
function Al(t) {
  return Nl.includes(t);
}
const ks = /* @__PURE__ */ new Set(), ui = /* @__PURE__ */ new Set();
function Ml(t, e, n, r = {}) {
  function i(o) {
    if (r.capture || Hn.call(e, o), !o.cancelBubble)
      return Mi(() => n == null ? void 0 : n.call(this, o));
  }
  return t.startsWith("pointer") || t.startsWith("touch") || t === "wheel" ? Fe(() => {
    e.addEventListener(t, i, r);
  }) : e.addEventListener(t, i, r), i;
}
function Ie(t, e, n, r, i) {
  var o = { capture: r, passive: i }, s = Ml(t, e, n, o);
  (e === document.body || // @ts-ignore
  e === window || // @ts-ignore
  e === document || // Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
  e instanceof HTMLMediaElement) && ss(() => {
    e.removeEventListener(t, s, o);
  });
}
function Vr(t) {
  for (var e = 0; e < t.length; e++)
    ks.add(t[e]);
  for (var n of ui)
    n(t);
}
let ji = null;
function Hn(t) {
  var T;
  var e = this, n = (
    /** @type {Node} */
    e.ownerDocument
  ), r = t.type, i = ((T = t.composedPath) == null ? void 0 : T.call(t)) || [], o = (
    /** @type {null | Element} */
    i[0] || t.target
  );
  ji = t;
  var s = 0, a = ji === t && t.__root;
  if (a) {
    var u = i.indexOf(a);
    if (u !== -1 && (e === document || e === /** @type {any} */
    window)) {
      t.__root = e;
      return;
    }
    var f = i.indexOf(e);
    if (f === -1)
      return;
    u <= f && (s = u);
  }
  if (o = /** @type {Element} */
  i[s] || t.target, o !== e) {
    Ea(t, "currentTarget", {
      configurable: !0,
      get() {
        return o || n;
      }
    });
    var c = K, d = j;
    Pt(null), le(null);
    try {
      for (var h, v = []; o !== null; ) {
        var p = o.assignedSlot || o.parentNode || /** @type {any} */
        o.host || null;
        try {
          var E = o["__" + r];
          E != null && (!/** @type {any} */
          o.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
          // -> the target could not have been disabled because it emits the event in the first place
          t.target === o) && E.call(o, t);
        } catch (S) {
          h ? v.push(S) : h = S;
        }
        if (t.cancelBubble || p === e || p === null)
          break;
        o = p;
      }
      if (h) {
        for (let S of v)
          queueMicrotask(() => {
            throw S;
          });
        throw h;
      }
    } finally {
      t.__root = e, delete t.currentTarget, Pt(c), le(d);
    }
  }
}
function Ci(t) {
  var e = document.createElement("template");
  return e.innerHTML = t.replaceAll("<!>", "<!---->"), e.content;
}
function Kn(t, e) {
  var n = (
    /** @type {Effect} */
    j
  );
  n.nodes === null && (n.nodes = { start: t, end: e, a: null, t: null });
}
// @__NO_SIDE_EFFECTS__
function Il(t, e) {
  var n = (e & Ja) !== 0, r, i = !t.startsWith("<!>");
  return () => {
    r === void 0 && (r = Ci(i ? t : "<!>" + t), r = /** @type {TemplateNode} */
    /* @__PURE__ */ qt(r));
    var o = (
      /** @type {TemplateNode} */
      n || ns ? document.importNode(r, !0) : r.cloneNode(!0)
    );
    return Kn(o, o), o;
  };
}
// @__NO_SIDE_EFFECTS__
function Pl(t, e, n = "svg") {
  var r = !t.startsWith("<!>"), i = (e & Za) !== 0, o = `<${n}>${r ? t : "<!>" + t}</${n}>`, s;
  return () => {
    if (!s) {
      var a = (
        /** @type {DocumentFragment} */
        Ci(o)
      ), u = (
        /** @type {Element} */
        /* @__PURE__ */ qt(a)
      );
      if (i)
        for (s = document.createDocumentFragment(); /* @__PURE__ */ qt(u); )
          s.appendChild(
            /** @type {TemplateNode} */
            /* @__PURE__ */ qt(u)
          );
      else
        s = /** @type {Element} */
        /* @__PURE__ */ qt(u);
    }
    var f = (
      /** @type {TemplateNode} */
      s.cloneNode(!0)
    );
    if (i) {
      var c = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ qt(f)
      ), d = (
        /** @type {TemplateNode} */
        f.lastChild
      );
      Kn(c, d);
    } else
      Kn(f, f);
    return f;
  };
}
// @__NO_SIDE_EFFECTS__
function tt(t, e) {
  return /* @__PURE__ */ Pl(t, e, "svg");
}
function ge() {
  var t = document.createDocumentFragment(), e = document.createComment(""), n = en();
  return t.append(e, n), Kn(e, n), t;
}
function W(t, e) {
  t !== null && t.before(
    /** @type {Node} */
    e
  );
}
function Zn(t, e) {
  var n = e == null ? "" : typeof e == "object" ? e + "" : e;
  n !== (t.__t ?? (t.__t = t.nodeValue)) && (t.__t = n, t.nodeValue = n + "");
}
function Tl(t, e) {
  return zl(t, e);
}
const hn = /* @__PURE__ */ new Map();
function zl(t, { target: e, anchor: n, props: r = {}, events: i, context: o, intro: s = !0 }) {
  ml();
  var a = /* @__PURE__ */ new Set(), u = (d) => {
    for (var h = 0; h < d.length; h++) {
      var v = d[h];
      if (!a.has(v)) {
        a.add(v);
        var p = Al(v);
        e.addEventListener(v, Hn, { passive: p });
        var E = hn.get(v);
        E === void 0 ? (document.addEventListener(v, Hn, { passive: p }), hn.set(v, 1)) : hn.set(v, E + 1);
      }
    }
  };
  u(Yr(ks)), ui.add(u);
  var f = void 0, c = wl(() => {
    var d = n ?? e.appendChild(en());
    return sl(
      /** @type {TemplateNode} */
      d,
      {
        pending: () => {
        }
      },
      (h) => {
        if (o) {
          on({});
          var v = (
            /** @type {ComponentContext} */
            Gt
          );
          v.c = o;
        }
        i && (r.$$events = i), f = t(h, r) || {}, o && sn();
      }
    ), () => {
      var p;
      for (var h of a) {
        e.removeEventListener(h, Hn);
        var v = (
          /** @type {number} */
          hn.get(h)
        );
        --v === 0 ? (document.removeEventListener(h, Hn), hn.delete(h)) : hn.set(h, v);
      }
      ui.delete(u), d !== n && ((p = d.parentNode) == null || p.removeChild(d));
    };
  });
  return fi.set(f, c), f;
}
let fi = /* @__PURE__ */ new WeakMap();
function $i(t, e) {
  const n = fi.get(t);
  return n ? (fi.delete(t), n(e)) : Promise.resolve();
}
var Qt, se, Lt, Ze, rr, ir, Dr;
class Cl {
  /**
   * @param {TemplateNode} anchor
   * @param {boolean} transition
   */
  constructor(e, n = !0) {
    /** @type {TemplateNode} */
    dt(this, "anchor");
    /** @type {Map<Batch, Key>} */
    Z(this, Qt, /* @__PURE__ */ new Map());
    /**
     * Map of keys to effects that are currently rendered in the DOM.
     * These effects are visible and actively part of the document tree.
     * Example:
     * ```
     * {#if condition}
     * 	foo
     * {:else}
     * 	bar
     * {/if}
     * ```
     * Can result in the entries `true->Effect` and `false->Effect`
     * @type {Map<Key, Effect>}
     */
    Z(this, se, /* @__PURE__ */ new Map());
    /**
     * Similar to #onscreen with respect to the keys, but contains branches that are not yet
     * in the DOM, because their insertion is deferred.
     * @type {Map<Key, Branch>}
     */
    Z(this, Lt, /* @__PURE__ */ new Map());
    /**
     * Keys of effects that are currently outroing
     * @type {Set<Key>}
     */
    Z(this, Ze, /* @__PURE__ */ new Set());
    /**
     * Whether to pause (i.e. outro) on change, or destroy immediately.
     * This is necessary for `<svelte:element>`
     */
    Z(this, rr, !0);
    Z(this, ir, () => {
      var e = (
        /** @type {Batch} */
        rt
      );
      if (y(this, Qt).has(e)) {
        var n = (
          /** @type {Key} */
          y(this, Qt).get(e)
        ), r = y(this, se).get(n);
        if (r)
          Ti(r), y(this, Ze).delete(n);
        else {
          var i = y(this, Lt).get(n);
          i && (y(this, se).set(n, i.effect), y(this, Lt).delete(n), i.fragment.lastChild.remove(), this.anchor.before(i.fragment), r = i.effect);
        }
        for (const [o, s] of y(this, Qt)) {
          if (y(this, Qt).delete(o), o === e)
            break;
          const a = y(this, Lt).get(s);
          a && (zt(a.effect), y(this, Lt).delete(s));
        }
        for (const [o, s] of y(this, se)) {
          if (o === n || y(this, Ze).has(o)) continue;
          const a = () => {
            if (Array.from(y(this, Qt).values()).includes(o)) {
              var f = document.createDocumentFragment();
              vs(s, f), f.append(en()), y(this, Lt).set(o, { effect: s, fragment: f });
            } else
              zt(s);
            y(this, Ze).delete(o), y(this, se).delete(o);
          };
          y(this, rr) || !r ? (y(this, Ze).add(o), Je(s, a, !1)) : a();
        }
      }
    });
    /**
     * @param {Batch} batch
     */
    Z(this, Dr, (e) => {
      y(this, Qt).delete(e);
      const n = Array.from(y(this, Qt).values());
      for (const [r, i] of y(this, Lt))
        n.includes(r) || (zt(i.effect), y(this, Lt).delete(r));
    });
    this.anchor = e, G(this, rr, n);
  }
  /**
   *
   * @param {any} key
   * @param {null | ((target: TemplateNode) => void)} fn
   */
  ensure(e, n) {
    var r = (
      /** @type {Batch} */
      rt
    ), i = os();
    if (n && !y(this, se).has(e) && !y(this, Lt).has(e))
      if (i) {
        var o = document.createDocumentFragment(), s = en();
        o.append(s), y(this, Lt).set(e, {
          effect: Xt(() => n(s)),
          fragment: o
        });
      } else
        y(this, se).set(
          e,
          Xt(() => n(this.anchor))
        );
    if (y(this, Qt).set(r, e), i) {
      for (const [a, u] of y(this, se))
        a === e ? r.skipped_effects.delete(u) : r.skipped_effects.add(u);
      for (const [a, u] of y(this, Lt))
        a === e ? r.skipped_effects.delete(u.effect) : r.skipped_effects.add(u.effect);
      r.oncommit(y(this, ir)), r.ondiscard(y(this, Dr));
    } else
      y(this, ir).call(this);
  }
}
Qt = new WeakMap(), se = new WeakMap(), Lt = new WeakMap(), Ze = new WeakMap(), rr = new WeakMap(), ir = new WeakMap(), Dr = new WeakMap();
function ut(t, e, n = !1) {
  var r = new Cl(t), i = n ? Mn : 0;
  function o(s, a) {
    r.ensure(s, a);
  }
  Pi(() => {
    var s = !1;
    e((a, u = !0) => {
      s = !0, o(u, a);
    }), s || o(!1, null);
  }, i);
}
function Es(t, e) {
  return e;
}
function Rl(t, e, n) {
  for (var r = [], i = e.length, o, s = e.length, a = 0; a < i; a++) {
    let d = e[a];
    Je(
      d,
      () => {
        if (o) {
          if (o.pending.delete(d), o.done.add(d), o.pending.size === 0) {
            var h = (
              /** @type {Set<EachOutroGroup>} */
              t.outrogroups
            );
            ci(Yr(o.done)), h.delete(o), h.size === 0 && (t.outrogroups = null);
          }
        } else
          s -= 1;
      },
      !1
    );
  }
  if (s === 0) {
    var u = r.length === 0 && n !== null;
    if (u) {
      var f = (
        /** @type {Element} */
        n
      ), c = (
        /** @type {Element} */
        f.parentNode
      );
      pl(c), c.append(f), t.items.clear();
    }
    ci(e, !u);
  } else
    o = {
      pending: new Set(e),
      done: /* @__PURE__ */ new Set()
    }, (t.outrogroups ?? (t.outrogroups = /* @__PURE__ */ new Set())).add(o);
}
function ci(t, e = !0) {
  for (var n = 0; n < t.length; n++)
    zt(t[n], e);
}
var to;
function Be(t, e, n, r, i, o = null) {
  var s = t, a = /* @__PURE__ */ new Map(), u = null, f = /* @__PURE__ */ Qo(() => {
    var E = n();
    return Oo(E) ? E : E == null ? [] : Yr(E);
  }), c, d = !0;
  function h() {
    p.fallback = u, Fl(p, c, s, e, r), u !== null && (c.length === 0 ? (u.f & Ce) === 0 ? Ti(u) : (u.f ^= Ce, Bn(u, null, s)) : Je(u, () => {
      u = null;
    }));
  }
  var v = Pi(() => {
    c = /** @type {V[]} */
    l(f);
    for (var E = c.length, T = /* @__PURE__ */ new Set(), S = (
      /** @type {Batch} */
      rt
    ), D = os(), A = 0; A < E; A += 1) {
      var x = c[A], P = r(x, A), k = d ? null : a.get(P);
      k ? (k.v && Tn(k.v, x), k.i && Tn(k.i, A), D && S.skipped_effects.delete(k.e)) : (k = Ll(
        a,
        d ? s : to ?? (to = en()),
        x,
        P,
        A,
        i,
        e,
        n
      ), d || (k.e.f |= Ce), a.set(P, k)), T.add(P);
    }
    if (E === 0 && o && !u && (d ? u = Xt(() => o(s)) : (u = Xt(() => o(to ?? (to = en()))), u.f |= Ce)), !d)
      if (D) {
        for (const [N, Y] of a)
          T.has(N) || S.skipped_effects.add(Y.e);
        S.oncommit(h), S.ondiscard(() => {
        });
      } else
        h();
    l(f);
  }), p = { effect: v, items: a, outrogroups: null, fallback: u };
  d = !1;
}
function Fl(t, e, n, r, i) {
  var Y;
  var o = e.length, s = t.items, a = t.effect.first, u, f = null, c = [], d = [], h, v, p, E;
  for (E = 0; E < o; E += 1) {
    if (h = e[E], v = i(h, E), p = /** @type {EachItem} */
    s.get(v).e, t.outrogroups !== null)
      for (const z of t.outrogroups)
        z.pending.delete(p), z.done.delete(p);
    if ((p.f & Ce) !== 0)
      if (p.f ^= Ce, p === a)
        Bn(p, null, n);
      else {
        var T = f ? f.next : a;
        p === t.effect.last && (t.effect.last = p.prev), p.prev && (p.prev.next = p.next), p.next && (p.next.prev = p.prev), Me(t, f, p), Me(t, p, T), Bn(p, T, n), f = p, c = [], d = [], a = f.next;
        continue;
      }
    if ((p.f & Dt) !== 0 && Ti(p), p !== a) {
      if (u !== void 0 && u.has(p)) {
        if (c.length < d.length) {
          var S = d[0], D;
          f = S.prev;
          var A = c[0], x = c[c.length - 1];
          for (D = 0; D < c.length; D += 1)
            Bn(c[D], S, n);
          for (D = 0; D < d.length; D += 1)
            u.delete(d[D]);
          Me(t, A.prev, x.next), Me(t, f, A), Me(t, x, S), a = S, f = x, E -= 1, c = [], d = [];
        } else
          u.delete(p), Bn(p, a, n), Me(t, p.prev, p.next), Me(t, p, f === null ? t.effect.first : f.next), Me(t, f, p), f = p;
        continue;
      }
      for (c = [], d = []; a !== null && a !== p; )
        (u ?? (u = /* @__PURE__ */ new Set())).add(a), d.push(a), a = a.next;
      if (a === null)
        continue;
    }
    (p.f & Ce) === 0 && c.push(p), f = p, a = p.next;
  }
  if (t.outrogroups !== null) {
    for (const z of t.outrogroups)
      z.pending.size === 0 && (ci(Yr(z.done)), (Y = t.outrogroups) == null || Y.delete(z));
    t.outrogroups.size === 0 && (t.outrogroups = null);
  }
  if (a !== null || u !== void 0) {
    var P = [];
    if (u !== void 0)
      for (p of u)
        (p.f & Dt) === 0 && P.push(p);
    for (; a !== null; )
      (a.f & Dt) === 0 && a !== t.fallback && P.push(a), a = a.next;
    var k = P.length;
    if (k > 0) {
      var N = null;
      Rl(t, P, N);
    }
  }
}
function Ll(t, e, n, r, i, o, s, a) {
  var u = (s & Va) !== 0 ? (s & qa) === 0 ? /* @__PURE__ */ gl(n, !1, !1) : tn(n) : null, f = (s & Xa) !== 0 ? tn(i) : null;
  return {
    v: u,
    i: f,
    e: Xt(() => (o(e, u ?? n, f ?? i, a), () => {
      t.delete(r);
    }))
  };
}
function Bn(t, e, n) {
  if (t.nodes)
    for (var r = t.nodes.start, i = t.nodes.end, o = e && (e.f & Ce) === 0 ? (
      /** @type {EffectNodes} */
      e.nodes.start
    ) : n; r !== null; ) {
      var s = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ or(r)
      );
      if (o.before(r), r === i)
        return;
      r = s;
    }
}
function Me(t, e, n) {
  e === null ? t.effect.first = n : e.next = n, n === null ? t.effect.last = e : n.prev = e;
}
function Ss(t, e, n = !1, r = !1, i = !1) {
  var o = t, s = "";
  nt(() => {
    var a = (
      /** @type {Effect} */
      j
    );
    if (s !== (s = e() ?? "") && (a.nodes !== null && (cs(
      a.nodes.start,
      /** @type {TemplateNode} */
      a.nodes.end
    ), a.nodes = null), s !== "")) {
      var u = s + "";
      n ? u = `<svg>${u}</svg>` : r && (u = `<math>${u}</math>`);
      var f = Ci(u);
      if ((n || r) && (f = /** @type {Element} */
      /* @__PURE__ */ qt(f)), Kn(
        /** @type {TemplateNode} */
        /* @__PURE__ */ qt(f),
        /** @type {TemplateNode} */
        f.lastChild
      ), n || r)
        for (; /* @__PURE__ */ qt(f); )
          o.before(
            /** @type {TemplateNode} */
            /* @__PURE__ */ qt(f)
          );
      else
        o.before(f);
    }
  });
}
function Ns(t) {
  var e, n, r = "";
  if (typeof t == "string" || typeof t == "number") r += t;
  else if (typeof t == "object") if (Array.isArray(t)) {
    var i = t.length;
    for (e = 0; e < i; e++) t[e] && (n = Ns(t[e])) && (r && (r += " "), r += n);
  } else for (n in t) t[n] && (r && (r += " "), r += n);
  return r;
}
function Ol() {
  for (var t, e, n = 0, r = "", i = arguments.length; n < i; n++) (t = arguments[n]) && (e = Ns(t)) && (r && (r += " "), r += e);
  return r;
}
function Dl(t) {
  return typeof t == "object" ? Ol(t) : t ?? "";
}
function Yl(t, e, n) {
  var r = t == null ? "" : "" + t;
  return r === "" ? null : r;
}
function Hl(t, e) {
  return t == null ? null : String(t);
}
function Bl(t, e, n, r, i, o) {
  var s = t.__className;
  if (s !== n || s === void 0) {
    var a = Yl(n);
    a == null ? t.removeAttribute("class") : t.setAttribute("class", a), t.__className = n;
  }
  return o;
}
function Ri(t, e, n, r) {
  var i = t.__style;
  if (i !== e) {
    var o = Hl(e);
    o == null ? t.removeAttribute("style") : t.style.cssText = o, t.__style = e;
  }
  return r;
}
const Vl = Symbol("is custom element"), Xl = Symbol("is html");
function m(t, e, n, r) {
  var i = ql(t);
  i[e] !== (i[e] = n) && (e === "loading" && (t[Ta] = n), n == null ? t.removeAttribute(e) : typeof n != "string" && Ul(t).includes(e) ? t[e] = n : t.setAttribute(e, n));
}
function ql(t) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    t.__attributes ?? (t.__attributes = {
      [Vl]: t.nodeName.includes("-"),
      [Xl]: t.namespaceURI === Qa
    })
  );
}
var eo = /* @__PURE__ */ new Map();
function Ul(t) {
  var e = t.getAttribute("is") || t.nodeName, n = eo.get(e);
  if (n) return n;
  eo.set(e, n = []);
  for (var r, i = t, o = Element.prototype; o !== i; ) {
    r = Sa(i);
    for (var s in r)
      r[s].set && n.push(s);
    i = Do(i);
  }
  return n;
}
function no(t, e) {
  return t === e || (t == null ? void 0 : t[qn]) === e;
}
function ro(t = {}, e, n, r) {
  return xl(() => {
    var i, o;
    return ls(() => {
      i = o, o = [], zi(() => {
        t !== n(...o) && (e(t, ...o), i && no(n(...i), t) && e(null, ...i));
      });
    }), () => {
      Fe(() => {
        o && no(n(...o), t) && e(null, ...o);
      });
    };
  }), t;
}
let cr = !1;
function Gl(t) {
  var e = cr;
  try {
    return cr = !1, [t(), cr];
  } finally {
    cr = e;
  }
}
function wt(t, e, n, r) {
  var D;
  var i = (n & Wa) !== 0, o = (n & Ka) !== 0, s = (
    /** @type {V} */
    r
  ), a = !0, u = () => (a && (a = !1, s = o ? zi(
    /** @type {() => V} */
    r
  ) : (
    /** @type {V} */
    r
  )), s), f;
  if (i) {
    var c = qn in t || Pa in t;
    f = ((D = mn(t, e)) == null ? void 0 : D.set) ?? (c && e in t ? (A) => t[e] = A : void 0);
  }
  var d, h = !1;
  i ? [d, h] = Gl(() => (
    /** @type {V} */
    t[e]
  )) : d = /** @type {V} */
  t[e], d === void 0 && r !== void 0 && (d = u(), f && (Oa(), f(d)));
  var v;
  if (v = () => {
    var A = (
      /** @type {V} */
      t[e]
    );
    return A === void 0 ? u() : (a = !0, A);
  }, (n & Ga) === 0)
    return v;
  if (f) {
    var p = t.$$legacy;
    return (
      /** @type {() => V} */
      (function(A, x) {
        return arguments.length > 0 ? ((!x || p || h) && f(x ? v() : A), A) : v();
      })
    );
  }
  var E = !1, T = ((n & Ua) !== 0 ? Br : Qo)(() => (E = !1, v()));
  i && l(T);
  var S = (
    /** @type {Effect} */
    j
  );
  return (
    /** @type {() => V} */
    (function(A, x) {
      if (arguments.length > 0) {
        const P = x ? l(T) : i ? Ot(A) : A;
        return V(T, P), E = !0, s !== void 0 && (s = P), A;
      }
      return De && E || (S.f & ye) !== 0 ? T.v : l(T);
    })
  );
}
const Wl = "5";
var Lo;
typeof window < "u" && ((Lo = window.__svelte ?? (window.__svelte = {})).v ?? (Lo.v = /* @__PURE__ */ new Set())).add(Wl);
const Kl = [
  [["hundredgigabitethernet", "hundredgige", "hu"], "hundredge"],
  [["fortygigabitethernet", "fortygige", "fo"], "fortyge"],
  [["twentyfivegigabitethernet", "twentyfivegige"], "twentyfivege"],
  [["tengigabitethernet", "tengigaethernet", "tenge", "te", "xge", "xe"], "te"],
  [["gigabitethernet", "gigaethernet", "gi", "ge"], "ge"],
  [["fastethernet", "fa", "fe"], "fe"],
  [["ethernet", "ens", "enp", "eno", "eth", "en"], "eth"],
  [["port-channel", "portchannel", "po", "ae", "bond"], "lag"],
  [["vlan", "vl", "irb"], "vlan"],
  [["loopback", "lo"], "lo"],
  [["tunnel", "tu", "tun"], "tun"],
  [["management", "mgmt", "me"], "mgmt"],
  [["wireless", "wifi", "wlan"], "wlan"],
  [["wired"], "wired"],
  [["serial", "se"], "serial"],
  [["bvi"], "bvi"]
];
Kl.map(([t, e]) => [t.slice().sort((n, r) => r.length - n.length), e]);
const Zl = 40, Jl = 8, Zr = 16, Ql = 5.5;
var J;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(J || (J = {}));
const jl = {
  "access-point": '<path d="M12 10a2 2 0 100 4 2 2 0 000-4zm-4.5-2.5a6.5 6.5 0 019 0l-1.4 1.4a4.5 4.5 0 00-6.2 0l-1.4-1.4zm-2.8-2.8a10 10 0 0114.6 0l-1.4 1.4a8 8 0 00-11.8 0L4.7 4.7z"/>',
  cloud: '<path d="M19.4 10.6A7 7 0 006 12a5 5 0 00.7 9.9h11.8a4.5 4.5 0 00.9-8.9z"/>',
  cpe: '<path d="M4 7h16v10H4V7zm2 2v6h12V9H6zm3 1h2v4H9v-4zm4 0h2v4h-2v-4z"/> <circle cx="7" cy="5" r="1"/> <circle cx="12" cy="5" r="1"/> <path d="M7 5h5"/>',
  database: '<path d="M12 4c-4.4 0-8 1.3-8 3v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7c0-1.7-3.6-3-8-3zm0 2c3.3 0 6 .9 6 2s-2.7 2-6 2-6-.9-6-2 2.7-2 6-2zM6 10.5c1.4.7 3.5 1 6 1s4.6-.3 6-1V12c0 1.1-2.7 2-6 2s-6-.9-6-2v-1.5zm0 4c1.4.7 3.5 1 6 1s4.6-.3 6-1V16c0 1.1-2.7 2-6 2s-6-.9-6-2v-1.5z"/>',
  firewall: '<path d="M12 2L4 6v6c0 5.5 3.4 10.3 8 12 4.6-1.7 8-6.5 8-12V6l-8-4zm0 2.2l6 3v5.3c0 4.3-2.6 8.1-6 9.5-3.4-1.4-6-5.2-6-9.5V7.2l6-3z"/> <path d="M11 8h2v5h-2V8zm0 6h2v2h-2v-2z"/>',
  generic: '<path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z"/>',
  internet: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c.6 0 1.3.8 1.8 2H10.2c.5-1.2 1.2-2 1.8-2zm-3.2.7A8 8 0 005 10h2.5c.1-2 .5-3.7 1.3-5.3zm6.4 0c.8 1.6 1.2 3.3 1.3 5.3H19a8 8 0 00-3.8-5.3zM5 12h2.5c.1 2 .5 3.7 1.3 5.3A8 8 0 015 12zm4.5 0h5c0 1.5-.3 3-1 4h-3c-.7-1-1-2.5-1-4zm7 0H19a8 8 0 01-3.8 5.3c.8-1.6 1.2-3.3 1.3-5.3zM10.2 18h3.6c-.5 1.2-1.2 2-1.8 2s-1.3-.8-1.8-2z"/>',
  "l2-switch": '<path d="M3 8h18v8H3V8zm2 2v4h14v-4H5zm2 1h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>',
  "l3-switch": '<path d="M3 6h18v12H3V6zm2 2v8h14V8H5zm2 2h4v1H7v-1zm6 0h4v1h-4v-1zm-6 3h4v1H7v-1zm6 0h4v1h-4v-1z"/>',
  "load-balancer": '<path d="M12 4L4 8l8 4 8-4-8-4zm0 2.5L16 8l-4 2-4-2 4-1.5zM4 12l8 4 8-4v2l-8 4-8-4v-2zm0 4l8 4 8-4v2l-8 4-8-4v-2z"/>',
  router: '<path d="M4 8h16v8H4V8zm2 2v4h12v-4H6zm1 1h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>',
  server: '<path d="M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4zm2-10v2h2V6H6zm0 6v2h2v-2H6zm0 6v2h2v-2H6zm10-12v2h2V6h-2zm0 6v2h2v-2h-2zm0 6v2h2v-2h-2z"/>',
  vpn: '<path d="M12 2L4 5v6.5c0 5.3 3.4 10 8 11.5 4.6-1.5 8-6.2 8-11.5V5l-8-3zm0 4a3 3 0 110 6 3 3 0 010-6zm-4 8h8v1c0 2-1.8 3-4 3s-4-1-4-3v-1z"/>'
}, $l = {
  [J.Router]: "router",
  [J.L3Switch]: "l3-switch",
  [J.L2Switch]: "l2-switch",
  [J.Firewall]: "firewall",
  [J.LoadBalancer]: "load-balancer",
  [J.Server]: "server",
  [J.AccessPoint]: "access-point",
  [J.CPE]: "cpe",
  [J.Cloud]: "cloud",
  [J.Internet]: "internet",
  [J.VPN]: "vpn",
  [J.Database]: "database",
  [J.Generic]: "generic"
};
function tu(t) {
  if (!t)
    return;
  const e = $l[t];
  if (e)
    return jl[e];
}
function eu(t) {
  var e;
  if ((e = t.style) != null && e.strokeWidth)
    return t.style.strokeWidth;
  switch (t.bandwidth) {
    case "100G":
      return 24;
    case "40G":
      return 18;
    case "25G":
      return 14;
    case "10G":
      return 10;
    case "1G":
      return 6;
  }
  return t.type === "thick" ? 3 : 2;
}
const nu = 1, As = 2, ru = 4, iu = 8;
function ou(t) {
  switch (t) {
    case "top":
      return nu;
    case "bottom":
      return As;
    case "left":
      return ru;
    case "right":
      return iu;
  }
}
function Ir(t) {
  return typeof t == "string" ? t : t.node;
}
function Pr(t) {
  return typeof t == "string" ? void 0 : t.port;
}
function io(t) {
  return typeof t == "string" ? { node: t } : t;
}
function su(t, e, n, r = 2) {
  for (const i of n.values()) {
    const o = i.size.width / 2 + r, s = i.size.height / 2 + r;
    if (t > i.position.x - o && t < i.position.x + o && e > i.position.y - s && e < i.position.y + s)
      return !0;
  }
  return !1;
}
let Jr = null;
async function au() {
  if (!Jr) {
    const { AvoidLib: t } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await t.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await t.load(process.env.LIBAVOID_WASM_PATH) : await t.load(), Jr = t.getInstance();
  }
  return Jr;
}
async function Gn(t, e, n, r) {
  const i = await au(), o = {
    edgeStyle: "orthogonal",
    shapeBufferDistance: 10,
    idealNudgingDistance: 20,
    ...r
  }, s = o.edgeStyle === "polyline" ? i.RouterFlag.PolyLineRouting.value : i.RouterFlag.OrthogonalRouting.value, a = new i.Router(s);
  a.setRoutingParameter(i.RoutingParameter.shapeBufferDistance.value, o.shapeBufferDistance), a.setRoutingParameter(i.RoutingParameter.idealNudgingDistance.value, o.idealNudgingDistance), a.setRoutingParameter(i.RoutingParameter.reverseDirectionPenalty.value, 500), a.setRoutingParameter(i.RoutingParameter.segmentPenalty.value, 50), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes.value, !0), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalTouchingColinearSegments.value, !0), a.setRoutingOption(i.RoutingOption.performUnifyingNudgingPreprocessingStep.value, !0), a.setRoutingOption(i.RoutingOption.nudgeSharedPathsWithCommonEndPoint.value, !0);
  try {
    return hu(i, a, t, e, n, o.edgeStyle, o.shapeBufferDistance);
  } finally {
    a.delete();
  }
}
function lu(t, e, n) {
  const r = /* @__PURE__ */ new Map();
  for (const [i, o] of n)
    r.set(i, new t.ShapeRef(e, new t.Rectangle(new t.Point(o.position.x, o.position.y), o.size.width, o.size.height)));
  return r;
}
function uu(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  let o = 1;
  for (const [s, a] of r) {
    const u = e.get(a.nodeId), f = n.get(a.nodeId);
    if (!u || !f)
      continue;
    const c = o++;
    i.set(s, c);
    const d = (a.absolutePosition.x - (f.position.x - f.size.width / 2)) / f.size.width, h = (a.absolutePosition.y - (f.position.y - f.size.height / 2)) / f.size.height, v = a.side === "top" || a.side === "bottom" ? As : ou(a.side);
    new t.ShapeConnectionPin(u, c, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, h)), !0, 0, v).setExclusive(!1);
  }
  return i;
}
function fu(t, e, n, r, i, o, s, a) {
  const u = /* @__PURE__ */ new Map();
  for (const [f, c] of s.entries()) {
    const d = c.id ?? `__link_${f}`, h = Ir(c.from), v = Ir(c.to);
    if (!n.has(h) || !n.has(v))
      continue;
    const p = Pr(c.from), E = Pr(c.to), T = p ? `${h}:${p}` : null, S = E ? `${v}:${E}` : null, D = T ? r.get(T) : void 0;
    let A;
    if (D !== void 0)
      A = new t.ConnEnd(n.get(h), D);
    else {
      const C = T ? o.get(T) : void 0, B = i.get(h), M = (C == null ? void 0 : C.absolutePosition) ?? (B == null ? void 0 : B.position);
      if (!M)
        continue;
      A = new t.ConnEnd(new t.Point(M.x, M.y));
    }
    const x = S ? o.get(S) : void 0, P = i.get(v), k = (x == null ? void 0 : x.absolutePosition) ?? (P == null ? void 0 : P.position);
    if (!k)
      continue;
    const N = new t.ConnEnd(new t.Point(k.x, k.y)), Y = new t.ConnRef(e, A, N), z = S ? o.get(S) : null;
    if (z != null && z.side) {
      const B = Math.max(z.size.width, z.size.height) / 2 + 16;
      let M = z.absolutePosition.x, q = z.absolutePosition.y;
      switch (z.side) {
        case "top":
          q -= B;
          break;
        case "bottom":
          q += B;
          break;
        case "left":
          M -= B;
          break;
        case "right":
          M += B;
          break;
      }
      if (!su(M, q, i, a)) {
        const g = new t.CheckpointVector();
        g.push_back(new t.Checkpoint(new t.Point(M, q))), Y.setRoutingCheckpoints(g);
      }
    }
    u.set(d, Y);
  }
  return e.processTransaction(), u;
}
function cu(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  for (const [o, s] of n.entries()) {
    const a = s.id ?? `__link_${o}`, u = t.get(a);
    if (!u)
      continue;
    const f = u.displayRoute(), c = [];
    for (let k = 0; k < f.size(); k++) {
      const N = f.at(k);
      c.push({ x: N.x, y: N.y });
    }
    const d = Ir(s.from), h = Ir(s.to), v = Pr(s.from), p = Pr(s.to), E = v ? `${d}:${v}` : null, T = p ? `${h}:${p}` : null, S = E ? e.get(E) : void 0, D = T ? e.get(T) : void 0;
    S && c.length > 0 && (c[0] = { x: S.absolutePosition.x, y: S.absolutePosition.y }), D && c.length > 0 && (c[c.length - 1] = {
      x: D.absolutePosition.x,
      y: D.absolutePosition.y
    });
    const A = c[0], x = c[c.length - 1], P = r === "straight" && c.length > 2 && A && x ? [A, x] : c;
    i.set(a, {
      id: a,
      fromPortId: v ? `${d}:${v}` : null,
      toPortId: p ? `${h}:${p}` : null,
      fromNodeId: d,
      toNodeId: h,
      fromEndpoint: io(s.from),
      toEndpoint: io(s.to),
      points: P,
      width: eu(s),
      link: s
    });
  }
  return i;
}
function hu(t, e, n, r, i, o, s) {
  const a = lu(t, e, n), u = uu(t, a, n, r), f = fu(t, e, a, u, n, r, i, s), c = cu(f, r, i, o), d = du(c);
  return vu(d);
}
function du(t) {
  const e = /* @__PURE__ */ new Map();
  for (const [i, o] of t)
    e.set(i, {
      ...o,
      points: o.points.map((s) => ({ ...s }))
    });
  const n = [];
  for (const [i, o] of e)
    for (const [s, a] of o.points.entries()) {
      const u = o.points[s + 1];
      u && Math.abs(a.y - u.y) < 0.5 && Math.abs(a.x - u.x) > 1 && n.push({
        edgeId: i,
        pointIndex: s,
        fixed: a.y,
        min: Math.min(a.x, u.x),
        max: Math.max(a.x, u.x),
        width: o.width
      });
    }
  oo(n, e, "y");
  const r = [];
  for (const [i, o] of e)
    for (const [s, a] of o.points.entries()) {
      const u = o.points[s + 1];
      u && Math.abs(a.x - u.x) < 0.5 && Math.abs(a.y - u.y) > 1 && r.push({
        edgeId: i,
        pointIndex: s,
        fixed: a.x,
        min: Math.min(a.y, u.y),
        max: Math.max(a.y, u.y),
        width: o.width
      });
    }
  return oo(r, e, "x"), e;
}
function oo(t, e, n) {
  if (!(t.length < 2)) {
    t.sort((r, i) => r.fixed - i.fixed);
    for (const [r, i] of t.entries()) {
      const o = t[r + 1];
      if (!o || i.max <= o.min || o.max <= i.min)
        continue;
      const s = (i.width + o.width) / 2 + Math.max(i.width, o.width), a = Math.abs(o.fixed - i.fixed);
      if (a >= s)
        continue;
      const f = (s - a) / 2;
      so(e, i, -f, n), so(e, o, f, n), i.fixed -= f, o.fixed += f;
    }
  }
}
function so(t, e, n, r) {
  const i = t.get(e.edgeId);
  if (!i)
    return;
  const o = i.points[e.pointIndex], s = i.points[e.pointIndex + 1];
  !o || !s || (r === "y" ? (o.y += n, s.y += n) : (o.x += n, s.x += n));
}
const gu = 8, ao = 6;
function vu(t) {
  const e = /* @__PURE__ */ new Map();
  for (const [n, r] of t)
    e.set(n, {
      ...r,
      points: mu(r.points, gu)
    });
  return e;
}
function mu(t, e) {
  if (t.length < 3)
    return [...t];
  const n = [], r = t[0];
  if (!r)
    return [...t];
  n.push({ ...r });
  for (const [o, s] of t.entries()) {
    if (o === 0 || o === t.length - 1)
      continue;
    const a = t[o - 1], u = t[o + 1];
    if (!a || !u) {
      n.push({ ...s });
      continue;
    }
    const f = Math.hypot(s.x - a.x, s.y - a.y), c = Math.hypot(u.x - s.x, u.y - s.y), d = Math.min(e, f / 2, c / 2);
    if (d < 1) {
      n.push({ ...s });
      continue;
    }
    const h = (a.x - s.x) / f, v = (a.y - s.y) / f, p = (u.x - s.x) / c, E = (u.y - s.y) / c, T = h * E - v * p;
    if (Math.abs(T) < 1e-3) {
      n.push({ ...s });
      continue;
    }
    const S = s.x + h * d, D = s.y + v * d, A = s.x + p * d, x = s.y + E * d;
    for (let P = 0; P <= ao; P++) {
      const k = P / ao, N = 1 - k, Y = N * N * S + 2 * N * k * s.x + k * k * A, z = N * N * D + 2 * N * k * s.y + k * k * x;
      n.push({ x: Y, y: z });
    }
  }
  const i = t[t.length - 1];
  return i && n.push({ ...i }), n;
}
const zn = 8;
function Ms(t, e, n = zn) {
  return t.x - t.w / 2 - n < e.x + e.w / 2 && t.x + t.w / 2 + n > e.x - e.w / 2 && t.y - t.h / 2 - n < e.y + e.h / 2 && t.y + t.h / 2 + n > e.y - e.h / 2;
}
function Is(t, e, n = zn) {
  const r = [
    { x: e.x - e.w / 2 - t.w / 2 - n, y: t.y },
    { x: e.x + e.w / 2 + t.w / 2 + n, y: t.y },
    { x: t.x, y: e.y - e.h / 2 - t.h / 2 - n },
    { x: t.x, y: e.y + e.h / 2 + t.h / 2 + n }
  ];
  let i = r[0], o = Number.POSITIVE_INFINITY;
  for (const s of r) {
    const a = Math.hypot(s.x - t.x, s.y - t.y);
    a < o && (o = a, i = s);
  }
  return i ?? { x: t.x, y: t.y };
}
function pu(t, e, n, r, i = zn) {
  const o = r.get(t);
  if (!o)
    return { x: e, y: n };
  let s = e, a = n;
  for (const [u, f] of r) {
    if (u === t)
      continue;
    const c = { x: s, y: a, w: o.size.width, h: o.size.height }, d = {
      x: f.position.x,
      y: f.position.y,
      w: f.size.width,
      h: f.size.height
    };
    if (Ms(c, d, i)) {
      const h = Is(c, d, i);
      s = h.x, a = h.y;
    }
  }
  return { x: s, y: a };
}
const hr = 20, lo = 28;
function uo(t) {
  return { x: t.x + t.width / 2, y: t.y + t.height / 2, w: t.width, h: t.height };
}
function Fi(t, e, n, r, i, o) {
  for (const [s, a] of r)
    if (a.node.parent === t) {
      r.set(s, { ...a, position: { x: a.position.x + e, y: a.position.y + n } });
      for (const [u, f] of o)
        f.nodeId === s && o.set(u, {
          ...f,
          absolutePosition: { x: f.absolutePosition.x + e, y: f.absolutePosition.y + n }
        });
    }
  for (const [s, a] of i)
    a.subgraph.parent === t && (i.set(s, {
      ...a,
      bounds: { ...a.bounds, x: a.bounds.x + e, y: a.bounds.y + n }
    }), Fi(s, e, n, r, i, o));
}
function Ps(t, e, n) {
  const r = (o, s = /* @__PURE__ */ new Set()) => {
    if (s.has(o))
      return 0;
    s.add(o);
    const a = e.get(o);
    return a != null && a.subgraph.parent ? 1 + r(a.subgraph.parent, s) : 0;
  }, i = [...e.keys()].sort((o, s) => r(s) - r(o));
  for (const o of i) {
    const s = e.get(o);
    if (!s)
      continue;
    let a = Number.POSITIVE_INFINITY, u = Number.POSITIVE_INFINITY, f = Number.NEGATIVE_INFINITY, c = Number.NEGATIVE_INFINITY, d = !1;
    for (const h of t.values()) {
      if (h.node.parent !== o)
        continue;
      d = !0;
      const v = h.size.width / 2, p = h.size.height / 2;
      a = Math.min(a, h.position.x - v), u = Math.min(u, h.position.y - p), f = Math.max(f, h.position.x + v), c = Math.max(c, h.position.y + p);
    }
    for (const h of e.values())
      h.subgraph.parent === o && (d = !0, a = Math.min(a, h.bounds.x), u = Math.min(u, h.bounds.y), f = Math.max(f, h.bounds.x + h.bounds.width), c = Math.max(c, h.bounds.y + h.bounds.height));
    d && e.set(o, {
      ...s,
      bounds: {
        x: a - hr,
        y: u - hr - lo,
        width: f - a + hr * 2,
        height: c - u + hr * 2 + lo
      }
    });
  }
  for (const o of [...i].reverse()) {
    const s = e.get(o);
    if (!s)
      continue;
    const a = s.subgraph.parent;
    for (const [u] of e) {
      if (u === o)
        continue;
      const f = e.get(u);
      if (!f || f.subgraph.parent !== a)
        continue;
      const c = uo(s.bounds), d = uo(f.bounds);
      if (!Ms(c, d, zn))
        continue;
      const h = Is(d, c, zn), v = h.x - d.x, p = h.y - d.y;
      v === 0 && p === 0 || (e.set(u, {
        ...f,
        bounds: { ...f.bounds, x: f.bounds.x + v, y: f.bounds.y + p }
      }), Fi(u, v, p, t, e, n));
    }
  }
}
async function _u(t, e, n, r, i, o = zn) {
  const s = r.nodes.get(t);
  if (!s)
    return null;
  const { x: a, y: u } = pu(t, e, n, r.nodes, o), f = a - s.position.x, c = u - s.position.y;
  if (f === 0 && c === 0)
    return null;
  const d = new Map(r.nodes);
  d.set(t, { ...s, position: { x: a, y: u } });
  const h = new Map(r.ports);
  for (const [E, T] of r.ports)
    T.nodeId === t && h.set(E, {
      ...T,
      absolutePosition: {
        x: T.absolutePosition.x + f,
        y: T.absolutePosition.y + c
      }
    });
  let v;
  r.subgraphs && (v = new Map(r.subgraphs), Ps(d, v, h));
  const p = await Gn(d, h, i);
  return { nodes: d, ports: h, edges: p, subgraphs: v };
}
async function yu(t, e, n, r, i) {
  const o = r.subgraphs.get(t);
  if (!o)
    return null;
  const s = e - o.bounds.x, a = n - o.bounds.y;
  if (s === 0 && a === 0)
    return null;
  const u = new Map(r.nodes), f = new Map(r.ports), c = new Map(r.subgraphs);
  c.set(t, { ...o, bounds: { ...o.bounds, x: e, y: n } }), Fi(t, s, a, u, c, f), Ps(u, c, f);
  const d = await Gn(u, f, i);
  return { nodes: u, ports: f, edges: d, subgraphs: c };
}
function wu(t, e, n, r, i) {
  return t.some((o) => {
    const s = typeof o.from == "string" ? { node: o.from } : o.from, a = typeof o.to == "string" ? { node: o.to } : o.to;
    return s.node === e && s.port === n && a.node === r && a.port === i || s.node === r && s.port === i && a.node === e && a.port === n;
  });
}
function xu(t, e, n) {
  const r = /* @__PURE__ */ new Set();
  for (const o of e) {
    const s = typeof o.from == "string" ? { node: o.from } : o.from, a = typeof o.to == "string" ? { node: o.to } : o.to;
    s.node === t && s.port && r.add(s.port), a.node === t && a.port && r.add(a.port);
  }
  if (n)
    for (const o of n.values())
      o.nodeId === t && r.add(o.label);
  let i = 0;
  for (; ; ) {
    const o = `eth${i}`;
    if (!r.has(o))
      return o;
    i++;
  }
}
const fo = 8, co = 24;
function bu(t, e) {
  const n = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const r of e.values())
    r.nodeId === t && r.side && n[r.side]++;
  return n;
}
function ku(t, e) {
  const n = Math.max(t.top, t.bottom), r = Math.max(t.left, t.right);
  return {
    width: Math.max(e.width, (n + 1) * co),
    height: Math.max(e.height, (r + 1) * co)
  };
}
function Eu(t, e, n, r) {
  const i = n.position.x, o = n.position.y, s = n.size.width / 2, a = n.size.height / 2, u = [];
  for (const f of r.values())
    f.nodeId === t && f.side === e && u.push(f);
  if (u.length !== 0)
    for (const [f, c] of u.entries()) {
      const d = (f + 1) / (u.length + 1);
      let h, v;
      switch (e) {
        case "top":
          h = i - s + n.size.width * d, v = o - a;
          break;
        case "bottom":
          h = i - s + n.size.width * d, v = o + a;
          break;
        case "left":
          h = i - s, v = o - a + n.size.height * d;
          break;
        case "right":
          h = i + s, v = o - a + n.size.height * d;
          break;
      }
      r.set(c.id, { ...c, absolutePosition: { x: h, y: v } });
    }
}
function Ts(t, e, n) {
  const r = e.get(t);
  if (!r)
    return;
  const i = bu(t, n), o = ku(i, r.size);
  let s = r;
  (o.width !== r.size.width || o.height !== r.size.height) && (s = {
    ...r,
    size: {
      width: Math.max(r.size.width, o.width),
      height: Math.max(r.size.height, o.height)
    }
  }, e.set(t, s));
  const a = ["top", "bottom", "left", "right"];
  for (const u of a)
    Eu(t, u, s, n);
}
function Su(t, e, n, r, i) {
  if (!n.get(t))
    return null;
  const s = xu(t, i, r), a = `${t}:${s}`, u = new Map(r);
  u.set(a, {
    id: a,
    nodeId: t,
    label: s,
    absolutePosition: { x: 0, y: 0 },
    side: e,
    size: { width: fo, height: fo }
  });
  const f = new Map(n);
  return Ts(t, f, u), { nodes: f, ports: u, portId: a };
}
function Nu(t, e, n, r) {
  const i = n.get(t);
  if (!i)
    return null;
  const o = i.nodeId, s = i.label, a = r.filter((c) => {
    const d = typeof c.from == "string" ? { node: c.from } : c.from, h = typeof c.to == "string" ? { node: c.to } : c.to;
    return !(d.node === o && d.port === s || h.node === o && h.port === s);
  }), u = new Map(n);
  u.delete(t);
  const f = new Map(e);
  return Ts(o, f, u), { nodes: f, ports: u, links: a };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function zs(t) {
  return typeof t > "u" || t === null;
}
function Au(t) {
  return typeof t == "object" && t !== null;
}
function Mu(t) {
  return Array.isArray(t) ? t : zs(t) ? [] : [t];
}
function Iu(t, e) {
  var n, r, i, o;
  if (e)
    for (o = Object.keys(e), n = 0, r = o.length; n < r; n += 1)
      i = o[n], t[i] = e[i];
  return t;
}
function Pu(t, e) {
  var n = "", r;
  for (r = 0; r < e; r += 1)
    n += t;
  return n;
}
function Tu(t) {
  return t === 0 && Number.NEGATIVE_INFINITY === 1 / t;
}
var zu = zs, Cu = Au, Ru = Mu, Fu = Pu, Lu = Tu, Ou = Iu, Li = {
  isNothing: zu,
  isObject: Cu,
  toArray: Ru,
  repeat: Fu,
  isNegativeZero: Lu,
  extend: Ou
};
function Cs(t, e) {
  var n = "", r = t.reason || "(unknown reason)";
  return t.mark ? (t.mark.name && (n += 'in "' + t.mark.name + '" '), n += "(" + (t.mark.line + 1) + ":" + (t.mark.column + 1) + ")", !e && t.mark.snippet && (n += `

` + t.mark.snippet), r + " " + n) : r;
}
function Jn(t, e) {
  Error.call(this), this.name = "YAMLException", this.reason = t, this.mark = e, this.message = Cs(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
Jn.prototype = Object.create(Error.prototype);
Jn.prototype.constructor = Jn;
Jn.prototype.toString = function(e) {
  return this.name + ": " + Cs(this, e);
};
var Ve = Jn, Du = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
], Yu = [
  "scalar",
  "sequence",
  "mapping"
];
function Hu(t) {
  var e = {};
  return t !== null && Object.keys(t).forEach(function(n) {
    t[n].forEach(function(r) {
      e[String(r)] = n;
    });
  }), e;
}
function Bu(t, e) {
  if (e = e || {}, Object.keys(e).forEach(function(n) {
    if (Du.indexOf(n) === -1)
      throw new Ve('Unknown option "' + n + '" is met in definition of "' + t + '" YAML type.');
  }), this.options = e, this.tag = t, this.kind = e.kind || null, this.resolve = e.resolve || function() {
    return !0;
  }, this.construct = e.construct || function(n) {
    return n;
  }, this.instanceOf = e.instanceOf || null, this.predicate = e.predicate || null, this.represent = e.represent || null, this.representName = e.representName || null, this.defaultStyle = e.defaultStyle || null, this.multi = e.multi || !1, this.styleAliases = Hu(e.styleAliases || null), Yu.indexOf(this.kind) === -1)
    throw new Ve('Unknown kind "' + this.kind + '" is specified for "' + t + '" YAML type.');
}
var bt = Bu;
function ho(t, e) {
  var n = [];
  return t[e].forEach(function(r) {
    var i = n.length;
    n.forEach(function(o, s) {
      o.tag === r.tag && o.kind === r.kind && o.multi === r.multi && (i = s);
    }), n[i] = r;
  }), n;
}
function Vu() {
  var t = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, e, n;
  function r(i) {
    i.multi ? (t.multi[i.kind].push(i), t.multi.fallback.push(i)) : t[i.kind][i.tag] = t.fallback[i.tag] = i;
  }
  for (e = 0, n = arguments.length; e < n; e += 1)
    arguments[e].forEach(r);
  return t;
}
function hi(t) {
  return this.extend(t);
}
hi.prototype.extend = function(e) {
  var n = [], r = [];
  if (e instanceof bt)
    r.push(e);
  else if (Array.isArray(e))
    r = r.concat(e);
  else if (e && (Array.isArray(e.implicit) || Array.isArray(e.explicit)))
    e.implicit && (n = n.concat(e.implicit)), e.explicit && (r = r.concat(e.explicit));
  else
    throw new Ve("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  n.forEach(function(o) {
    if (!(o instanceof bt))
      throw new Ve("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (o.loadKind && o.loadKind !== "scalar")
      throw new Ve("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (o.multi)
      throw new Ve("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), r.forEach(function(o) {
    if (!(o instanceof bt))
      throw new Ve("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(hi.prototype);
  return i.implicit = (this.implicit || []).concat(n), i.explicit = (this.explicit || []).concat(r), i.compiledImplicit = ho(i, "implicit"), i.compiledExplicit = ho(i, "explicit"), i.compiledTypeMap = Vu(i.compiledImplicit, i.compiledExplicit), i;
};
var Xu = hi, qu = new bt("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(t) {
    return t !== null ? t : "";
  }
}), Uu = new bt("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(t) {
    return t !== null ? t : [];
  }
}), Gu = new bt("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(t) {
    return t !== null ? t : {};
  }
}), Wu = new Xu({
  explicit: [
    qu,
    Uu,
    Gu
  ]
});
function Ku(t) {
  if (t === null) return !0;
  var e = t.length;
  return e === 1 && t === "~" || e === 4 && (t === "null" || t === "Null" || t === "NULL");
}
function Zu() {
  return null;
}
function Ju(t) {
  return t === null;
}
var Qu = new bt("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Ku,
  construct: Zu,
  predicate: Ju,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
});
function ju(t) {
  if (t === null) return !1;
  var e = t.length;
  return e === 4 && (t === "true" || t === "True" || t === "TRUE") || e === 5 && (t === "false" || t === "False" || t === "FALSE");
}
function $u(t) {
  return t === "true" || t === "True" || t === "TRUE";
}
function tf(t) {
  return Object.prototype.toString.call(t) === "[object Boolean]";
}
var ef = new bt("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: ju,
  construct: $u,
  predicate: tf,
  represent: {
    lowercase: function(t) {
      return t ? "true" : "false";
    },
    uppercase: function(t) {
      return t ? "TRUE" : "FALSE";
    },
    camelcase: function(t) {
      return t ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
});
function nf(t) {
  return 48 <= t && t <= 57 || 65 <= t && t <= 70 || 97 <= t && t <= 102;
}
function rf(t) {
  return 48 <= t && t <= 55;
}
function of(t) {
  return 48 <= t && t <= 57;
}
function sf(t) {
  if (t === null) return !1;
  var e = t.length, n = 0, r = !1, i;
  if (!e) return !1;
  if (i = t[n], (i === "-" || i === "+") && (i = t[++n]), i === "0") {
    if (n + 1 === e) return !0;
    if (i = t[++n], i === "b") {
      for (n++; n < e; n++)
        if (i = t[n], i !== "_") {
          if (i !== "0" && i !== "1") return !1;
          r = !0;
        }
      return r && i !== "_";
    }
    if (i === "x") {
      for (n++; n < e; n++)
        if (i = t[n], i !== "_") {
          if (!nf(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
    if (i === "o") {
      for (n++; n < e; n++)
        if (i = t[n], i !== "_") {
          if (!rf(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; n < e; n++)
    if (i = t[n], i !== "_") {
      if (!of(t.charCodeAt(n)))
        return !1;
      r = !0;
    }
  return !(!r || i === "_");
}
function af(t) {
  var e = t, n = 1, r;
  if (e.indexOf("_") !== -1 && (e = e.replace(/_/g, "")), r = e[0], (r === "-" || r === "+") && (r === "-" && (n = -1), e = e.slice(1), r = e[0]), e === "0") return 0;
  if (r === "0") {
    if (e[1] === "b") return n * parseInt(e.slice(2), 2);
    if (e[1] === "x") return n * parseInt(e.slice(2), 16);
    if (e[1] === "o") return n * parseInt(e.slice(2), 8);
  }
  return n * parseInt(e, 10);
}
function lf(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && t % 1 === 0 && !Li.isNegativeZero(t);
}
var uf = new bt("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: sf,
  construct: af,
  predicate: lf,
  represent: {
    binary: function(t) {
      return t >= 0 ? "0b" + t.toString(2) : "-0b" + t.toString(2).slice(1);
    },
    octal: function(t) {
      return t >= 0 ? "0o" + t.toString(8) : "-0o" + t.toString(8).slice(1);
    },
    decimal: function(t) {
      return t.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(t) {
      return t >= 0 ? "0x" + t.toString(16).toUpperCase() : "-0x" + t.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
}), ff = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function cf(t) {
  return !(t === null || !ff.test(t) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  t[t.length - 1] === "_");
}
function hf(t) {
  var e, n;
  return e = t.replace(/_/g, "").toLowerCase(), n = e[0] === "-" ? -1 : 1, "+-".indexOf(e[0]) >= 0 && (e = e.slice(1)), e === ".inf" ? n === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : e === ".nan" ? NaN : n * parseFloat(e, 10);
}
var df = /^[-+]?[0-9]+e/;
function gf(t, e) {
  var n;
  if (isNaN(t))
    switch (e) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  else if (Number.POSITIVE_INFINITY === t)
    switch (e) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  else if (Number.NEGATIVE_INFINITY === t)
    switch (e) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  else if (Li.isNegativeZero(t))
    return "-0.0";
  return n = t.toString(10), df.test(n) ? n.replace("e", ".e") : n;
}
function vf(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && (t % 1 !== 0 || Li.isNegativeZero(t));
}
var mf = new bt("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: cf,
  construct: hf,
  predicate: vf,
  represent: gf,
  defaultStyle: "lowercase"
}), pf = Wu.extend({
  implicit: [
    Qu,
    ef,
    uf,
    mf
  ]
}), _f = pf, Rs = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Fs = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function yf(t) {
  return t === null ? !1 : Rs.exec(t) !== null || Fs.exec(t) !== null;
}
function wf(t) {
  var e, n, r, i, o, s, a, u = 0, f = null, c, d, h;
  if (e = Rs.exec(t), e === null && (e = Fs.exec(t)), e === null) throw new Error("Date resolve error");
  if (n = +e[1], r = +e[2] - 1, i = +e[3], !e[4])
    return new Date(Date.UTC(n, r, i));
  if (o = +e[4], s = +e[5], a = +e[6], e[7]) {
    for (u = e[7].slice(0, 3); u.length < 3; )
      u += "0";
    u = +u;
  }
  return e[9] && (c = +e[10], d = +(e[11] || 0), f = (c * 60 + d) * 6e4, e[9] === "-" && (f = -f)), h = new Date(Date.UTC(n, r, i, o, s, a, u)), f && h.setTime(h.getTime() - f), h;
}
function xf(t) {
  return t.toISOString();
}
var bf = new bt("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: yf,
  construct: wf,
  instanceOf: Date,
  represent: xf
});
function kf(t) {
  return t === "<<" || t === null;
}
var Ef = new bt("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: kf
}), Oi = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function Sf(t) {
  if (t === null) return !1;
  var e, n, r = 0, i = t.length, o = Oi;
  for (n = 0; n < i; n++)
    if (e = o.indexOf(t.charAt(n)), !(e > 64)) {
      if (e < 0) return !1;
      r += 6;
    }
  return r % 8 === 0;
}
function Nf(t) {
  var e, n, r = t.replace(/[\r\n=]/g, ""), i = r.length, o = Oi, s = 0, a = [];
  for (e = 0; e < i; e++)
    e % 4 === 0 && e && (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)), s = s << 6 | o.indexOf(r.charAt(e));
  return n = i % 4 * 6, n === 0 ? (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)) : n === 18 ? (a.push(s >> 10 & 255), a.push(s >> 2 & 255)) : n === 12 && a.push(s >> 4 & 255), new Uint8Array(a);
}
function Af(t) {
  var e = "", n = 0, r, i, o = t.length, s = Oi;
  for (r = 0; r < o; r++)
    r % 3 === 0 && r && (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]), n = (n << 8) + t[r];
  return i = o % 3, i === 0 ? (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]) : i === 2 ? (e += s[n >> 10 & 63], e += s[n >> 4 & 63], e += s[n << 2 & 63], e += s[64]) : i === 1 && (e += s[n >> 2 & 63], e += s[n << 4 & 63], e += s[64], e += s[64]), e;
}
function Mf(t) {
  return Object.prototype.toString.call(t) === "[object Uint8Array]";
}
var If = new bt("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: Sf,
  construct: Nf,
  predicate: Mf,
  represent: Af
}), Pf = Object.prototype.hasOwnProperty, Tf = Object.prototype.toString;
function zf(t) {
  if (t === null) return !0;
  var e = [], n, r, i, o, s, a = t;
  for (n = 0, r = a.length; n < r; n += 1) {
    if (i = a[n], s = !1, Tf.call(i) !== "[object Object]") return !1;
    for (o in i)
      if (Pf.call(i, o))
        if (!s) s = !0;
        else return !1;
    if (!s) return !1;
    if (e.indexOf(o) === -1) e.push(o);
    else return !1;
  }
  return !0;
}
function Cf(t) {
  return t !== null ? t : [];
}
var Rf = new bt("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: zf,
  construct: Cf
}), Ff = Object.prototype.toString;
function Lf(t) {
  if (t === null) return !0;
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1) {
    if (r = s[e], Ff.call(r) !== "[object Object]" || (i = Object.keys(r), i.length !== 1)) return !1;
    o[e] = [i[0], r[i[0]]];
  }
  return !0;
}
function Of(t) {
  if (t === null) return [];
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1)
    r = s[e], i = Object.keys(r), o[e] = [i[0], r[i[0]]];
  return o;
}
var Df = new bt("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: Lf,
  construct: Of
}), Yf = Object.prototype.hasOwnProperty;
function Hf(t) {
  if (t === null) return !0;
  var e, n = t;
  for (e in n)
    if (Yf.call(n, e) && n[e] !== null)
      return !1;
  return !0;
}
function Bf(t) {
  return t !== null ? t : {};
}
var Vf = new bt("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Hf,
  construct: Bf
});
_f.extend({
  implicit: [
    bf,
    Ef
  ],
  explicit: [
    If,
    Rf,
    Df,
    Vf
  ]
});
function go(t) {
  return t === 48 ? "\0" : t === 97 ? "\x07" : t === 98 ? "\b" : t === 116 || t === 9 ? "	" : t === 110 ? `
` : t === 118 ? "\v" : t === 102 ? "\f" : t === 114 ? "\r" : t === 101 ? "\x1B" : t === 32 ? " " : t === 34 ? '"' : t === 47 ? "/" : t === 92 ? "\\" : t === 78 ? "" : t === 95 ? " " : t === 76 ? "\u2028" : t === 80 ? "\u2029" : "";
}
var Xf = new Array(256), qf = new Array(256);
for (var dn = 0; dn < 256; dn++)
  Xf[dn] = go(dn) ? 1 : 0, qf[dn] = go(dn);
var vo;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(vo || (vo = {}));
const xr = {
  name: "light",
  variant: "light",
  colors: {
    // Backgrounds
    background: "#ffffff",
    surface: "#f8fafc",
    surfaceHover: "#f1f5f9",
    // Text
    text: "#0f172a",
    textSecondary: "#64748b",
    textDisabled: "#cbd5e1",
    // Primary (Blue)
    primary: "#3b82f6",
    primaryHover: "#2563eb",
    primaryActive: "#1d4ed8",
    // Secondary (Purple)
    secondary: "#8b5cf6",
    secondaryHover: "#7c3aed",
    secondaryActive: "#6d28d9",
    // Status
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
    // Links
    link: "#3b82f6",
    linkHover: "#2563eb",
    linkDown: "#ef4444",
    // Device colors
    devices: {
      [J.Router]: "#3b82f6",
      [J.L3Switch]: "#8b5cf6",
      [J.L2Switch]: "#a78bfa",
      [J.Firewall]: "#ef4444",
      [J.LoadBalancer]: "#f59e0b",
      [J.Server]: "#10b981",
      [J.AccessPoint]: "#06b6d4",
      [J.Cloud]: "#3b82f6",
      [J.Internet]: "#6366f1",
      [J.Generic]: "#94a3b8"
    },
    // Module colors (background fill only - stroke/text handled by renderer)
    // @deprecated Use zonePresets instead
    modules: {
      core: "#f0fdf4",
      // Green-50
      distribution: "#f0fdf4",
      // Green-50
      access: "#f0fdf4",
      // Green-50
      dmz: "#fff1f2",
      // Rose-50
      cloud: "#eff6ff",
      // Blue-50
      default: "#f8fafc"
      // Slate-50
    },
    // Surface token colors for subgraph rendering
    surfaces: {
      "surface-1": { fill: "#f8fafc", stroke: "#e2e8f0", text: "#64748b" },
      // Slate-50
      "surface-2": { fill: "#f1f5f9", stroke: "#cbd5e1", text: "#475569" },
      // Slate-100
      "surface-3": { fill: "#e2e8f0", stroke: "#94a3b8", text: "#334155" },
      // Slate-200
      "accent-blue": { fill: "#eff6ff", stroke: "#bfdbfe", text: "#3b82f6" },
      // Blue
      "accent-green": { fill: "#f0fdf4", stroke: "#bbf7d0", text: "#16a34a" },
      // Green
      "accent-red": { fill: "#fff1f2", stroke: "#fecdd3", text: "#e11d48" },
      // Rose
      "accent-amber": { fill: "#fef3c7", stroke: "#fcd34d", text: "#d97706" },
      // Amber
      "accent-purple": { fill: "#faf5ff", stroke: "#e9d5ff", text: "#9333ea" }
      // Purple
    },
    // Grid
    grid: "#e5e7eb",
    guideline: "#3b82f6"
  },
  dimensions: {
    device: {
      small: { width: 60, height: 40 },
      medium: { width: 80, height: 60 },
      large: { width: 120, height: 80 }
    },
    fontSize: {
      tiny: 10,
      small: 12,
      medium: 14,
      large: 16,
      huge: 20
    },
    lineWidth: {
      thin: 1,
      normal: 2,
      thick: 3,
      emphasis: 4
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32
    },
    radius: {
      small: 4,
      medium: 8,
      large: 12,
      round: 9999
    }
  },
  shadows: {
    none: {
      color: "transparent",
      blur: 0,
      offsetX: 0,
      offsetY: 0
    },
    small: {
      color: "#0f172a",
      blur: 4,
      offsetX: 0,
      offsetY: 1,
      alpha: 0.05
    },
    medium: {
      color: "#0f172a",
      blur: 10,
      offsetX: 0,
      offsetY: 4,
      alpha: 0.1
    },
    large: {
      color: "#0f172a",
      blur: 25,
      offsetX: 0,
      offsetY: 10,
      alpha: 0.15
    },
    glow: {
      color: "#3b82f6",
      blur: 20,
      offsetX: 0,
      offsetY: 0,
      alpha: 0.5
    }
  },
  animations: {
    duration: {
      instant: 0,
      fast: 150,
      normal: 300,
      slow: 500
    },
    easing: {
      linear: "linear",
      easeIn: "ease-in",
      easeOut: "ease-out",
      easeInOut: "ease-in-out",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)"
    }
  },
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, "Cascadia Mono", "Consolas", monospace',
      display: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    letterSpacing: {
      tight: -0.025,
      normal: 0,
      wide: 0.025
    }
  }
};
({
  ...xr,
  colors: {
    ...xr.colors,
    // Device colors (adjusted for dark)
    devices: (J.Router + "", J.L3Switch + "", J.L2Switch + "", J.Firewall + "", J.LoadBalancer + "", J.Server + "", J.AccessPoint + "", J.Cloud + "", J.Internet + "", J.Generic + "")
  },
  shadows: {
    ...xr.shadows
  }
});
function Uf(t = xr) {
  const e = t.colors.surfaces["surface-1"];
  return {
    background: t.colors.background,
    nodeFill: t.colors.surface,
    nodeStroke: t.colors.textSecondary,
    nodeText: t.colors.text,
    nodeTextSecondary: t.colors.textSecondary,
    nodeHoverFill: t.colors.surfaceHover,
    nodeHoverStroke: t.colors.primary,
    linkStroke: t.colors.textSecondary,
    portFill: t.variant === "dark" ? "#64748b" : "#334155",
    portStroke: t.variant === "dark" ? "#94a3b8" : "#0f172a",
    portLabelBg: "#0f172a",
    portLabelColor: "#ffffff",
    subgraphFill: e.fill,
    subgraphStroke: e.stroke,
    subgraphText: e.text,
    textSecondary: t.colors.textSecondary,
    selection: t.colors.primary
  };
}
var Gf = { value: () => {
} };
function Xr() {
  for (var t = 0, e = arguments.length, n = {}, r; t < e; ++t) {
    if (!(r = arguments[t] + "") || r in n || /[\s.]/.test(r)) throw new Error("illegal type: " + r);
    n[r] = [];
  }
  return new br(n);
}
function br(t) {
  this._ = t;
}
function Wf(t, e) {
  return t.trim().split(/^|\s+/).map(function(n) {
    var r = "", i = n.indexOf(".");
    if (i >= 0 && (r = n.slice(i + 1), n = n.slice(0, i)), n && !e.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    return { type: n, name: r };
  });
}
br.prototype = Xr.prototype = {
  constructor: br,
  on: function(t, e) {
    var n = this._, r = Wf(t + "", n), i, o = -1, s = r.length;
    if (arguments.length < 2) {
      for (; ++o < s; ) if ((i = (t = r[o]).type) && (i = Kf(n[i], t.name))) return i;
      return;
    }
    if (e != null && typeof e != "function") throw new Error("invalid callback: " + e);
    for (; ++o < s; )
      if (i = (t = r[o]).type) n[i] = mo(n[i], t.name, e);
      else if (e == null) for (i in n) n[i] = mo(n[i], t.name, null);
    return this;
  },
  copy: function() {
    var t = {}, e = this._;
    for (var n in e) t[n] = e[n].slice();
    return new br(t);
  },
  call: function(t, e) {
    if ((i = arguments.length - 2) > 0) for (var n = new Array(i), r = 0, i, o; r < i; ++r) n[r] = arguments[r + 2];
    if (!this._.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    for (o = this._[t], r = 0, i = o.length; r < i; ++r) o[r].value.apply(e, n);
  },
  apply: function(t, e, n) {
    if (!this._.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    for (var r = this._[t], i = 0, o = r.length; i < o; ++i) r[i].value.apply(e, n);
  }
};
function Kf(t, e) {
  for (var n = 0, r = t.length, i; n < r; ++n)
    if ((i = t[n]).name === e)
      return i.value;
}
function mo(t, e, n) {
  for (var r = 0, i = t.length; r < i; ++r)
    if (t[r].name === e) {
      t[r] = Gf, t = t.slice(0, r).concat(t.slice(r + 1));
      break;
    }
  return n != null && t.push({ name: e, value: n }), t;
}
var di = "http://www.w3.org/1999/xhtml";
const po = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: di,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function qr(t) {
  var e = t += "", n = e.indexOf(":");
  return n >= 0 && (e = t.slice(0, n)) !== "xmlns" && (t = t.slice(n + 1)), po.hasOwnProperty(e) ? { space: po[e], local: t } : t;
}
function Zf(t) {
  return function() {
    var e = this.ownerDocument, n = this.namespaceURI;
    return n === di && e.documentElement.namespaceURI === di ? e.createElement(t) : e.createElementNS(n, t);
  };
}
function Jf(t) {
  return function() {
    return this.ownerDocument.createElementNS(t.space, t.local);
  };
}
function Ls(t) {
  var e = qr(t);
  return (e.local ? Jf : Zf)(e);
}
function Qf() {
}
function Di(t) {
  return t == null ? Qf : function() {
    return this.querySelector(t);
  };
}
function jf(t) {
  typeof t != "function" && (t = Di(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = new Array(s), u, f, c = 0; c < s; ++c)
      (u = o[c]) && (f = t.call(u, u.__data__, c, o)) && ("__data__" in u && (f.__data__ = u.__data__), a[c] = f);
  return new Yt(r, this._parents);
}
function $f(t) {
  return t == null ? [] : Array.isArray(t) ? t : Array.from(t);
}
function tc() {
  return [];
}
function Os(t) {
  return t == null ? tc : function() {
    return this.querySelectorAll(t);
  };
}
function ec(t) {
  return function() {
    return $f(t.apply(this, arguments));
  };
}
function nc(t) {
  typeof t == "function" ? t = ec(t) : t = Os(t);
  for (var e = this._groups, n = e.length, r = [], i = [], o = 0; o < n; ++o)
    for (var s = e[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && (r.push(t.call(u, u.__data__, f, s)), i.push(u));
  return new Yt(r, i);
}
function Ds(t) {
  return function() {
    return this.matches(t);
  };
}
function Ys(t) {
  return function(e) {
    return e.matches(t);
  };
}
var rc = Array.prototype.find;
function ic(t) {
  return function() {
    return rc.call(this.children, t);
  };
}
function oc() {
  return this.firstElementChild;
}
function sc(t) {
  return this.select(t == null ? oc : ic(typeof t == "function" ? t : Ys(t)));
}
var ac = Array.prototype.filter;
function lc() {
  return Array.from(this.children);
}
function uc(t) {
  return function() {
    return ac.call(this.children, t);
  };
}
function fc(t) {
  return this.selectAll(t == null ? lc : uc(typeof t == "function" ? t : Ys(t)));
}
function cc(t) {
  typeof t != "function" && (t = Ds(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new Yt(r, this._parents);
}
function Hs(t) {
  return new Array(t.length);
}
function hc() {
  return new Yt(this._enter || this._groups.map(Hs), this._parents);
}
function Tr(t, e) {
  this.ownerDocument = t.ownerDocument, this.namespaceURI = t.namespaceURI, this._next = null, this._parent = t, this.__data__ = e;
}
Tr.prototype = {
  constructor: Tr,
  appendChild: function(t) {
    return this._parent.insertBefore(t, this._next);
  },
  insertBefore: function(t, e) {
    return this._parent.insertBefore(t, e);
  },
  querySelector: function(t) {
    return this._parent.querySelector(t);
  },
  querySelectorAll: function(t) {
    return this._parent.querySelectorAll(t);
  }
};
function dc(t) {
  return function() {
    return t;
  };
}
function gc(t, e, n, r, i, o) {
  for (var s = 0, a, u = e.length, f = o.length; s < f; ++s)
    (a = e[s]) ? (a.__data__ = o[s], r[s] = a) : n[s] = new Tr(t, o[s]);
  for (; s < u; ++s)
    (a = e[s]) && (i[s] = a);
}
function vc(t, e, n, r, i, o, s) {
  var a, u, f = /* @__PURE__ */ new Map(), c = e.length, d = o.length, h = new Array(c), v;
  for (a = 0; a < c; ++a)
    (u = e[a]) && (h[a] = v = s.call(u, u.__data__, a, e) + "", f.has(v) ? i[a] = u : f.set(v, u));
  for (a = 0; a < d; ++a)
    v = s.call(t, o[a], a, o) + "", (u = f.get(v)) ? (r[a] = u, u.__data__ = o[a], f.delete(v)) : n[a] = new Tr(t, o[a]);
  for (a = 0; a < c; ++a)
    (u = e[a]) && f.get(h[a]) === u && (i[a] = u);
}
function mc(t) {
  return t.__data__;
}
function pc(t, e) {
  if (!arguments.length) return Array.from(this, mc);
  var n = e ? vc : gc, r = this._parents, i = this._groups;
  typeof t != "function" && (t = dc(t));
  for (var o = i.length, s = new Array(o), a = new Array(o), u = new Array(o), f = 0; f < o; ++f) {
    var c = r[f], d = i[f], h = d.length, v = _c(t.call(c, c && c.__data__, f, r)), p = v.length, E = a[f] = new Array(p), T = s[f] = new Array(p), S = u[f] = new Array(h);
    n(c, d, E, T, S, v, e);
    for (var D = 0, A = 0, x, P; D < p; ++D)
      if (x = E[D]) {
        for (D >= A && (A = D + 1); !(P = T[A]) && ++A < p; ) ;
        x._next = P || null;
      }
  }
  return s = new Yt(s, r), s._enter = a, s._exit = u, s;
}
function _c(t) {
  return typeof t == "object" && "length" in t ? t : Array.from(t);
}
function yc() {
  return new Yt(this._exit || this._groups.map(Hs), this._parents);
}
function wc(t, e, n) {
  var r = this.enter(), i = this, o = this.exit();
  return typeof t == "function" ? (r = t(r), r && (r = r.selection())) : r = r.append(t + ""), e != null && (i = e(i), i && (i = i.selection())), n == null ? o.remove() : n(o), r && i ? r.merge(i).order() : i;
}
function xc(t) {
  for (var e = t.selection ? t.selection() : t, n = this._groups, r = e._groups, i = n.length, o = r.length, s = Math.min(i, o), a = new Array(i), u = 0; u < s; ++u)
    for (var f = n[u], c = r[u], d = f.length, h = a[u] = new Array(d), v, p = 0; p < d; ++p)
      (v = f[p] || c[p]) && (h[p] = v);
  for (; u < i; ++u)
    a[u] = n[u];
  return new Yt(a, this._parents);
}
function bc() {
  for (var t = this._groups, e = -1, n = t.length; ++e < n; )
    for (var r = t[e], i = r.length - 1, o = r[i], s; --i >= 0; )
      (s = r[i]) && (o && s.compareDocumentPosition(o) ^ 4 && o.parentNode.insertBefore(s, o), o = s);
  return this;
}
function kc(t) {
  t || (t = Ec);
  function e(d, h) {
    return d && h ? t(d.__data__, h.__data__) : !d - !h;
  }
  for (var n = this._groups, r = n.length, i = new Array(r), o = 0; o < r; ++o) {
    for (var s = n[o], a = s.length, u = i[o] = new Array(a), f, c = 0; c < a; ++c)
      (f = s[c]) && (u[c] = f);
    u.sort(e);
  }
  return new Yt(i, this._parents).order();
}
function Ec(t, e) {
  return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
function Sc() {
  var t = arguments[0];
  return arguments[0] = this, t.apply(null, arguments), this;
}
function Nc() {
  return Array.from(this);
}
function Ac() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length; i < o; ++i) {
      var s = r[i];
      if (s) return s;
    }
  return null;
}
function Mc() {
  let t = 0;
  for (const e of this) ++t;
  return t;
}
function Ic() {
  return !this.node();
}
function Pc(t) {
  for (var e = this._groups, n = 0, r = e.length; n < r; ++n)
    for (var i = e[n], o = 0, s = i.length, a; o < s; ++o)
      (a = i[o]) && t.call(a, a.__data__, o, i);
  return this;
}
function Tc(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function zc(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function Cc(t, e) {
  return function() {
    this.setAttribute(t, e);
  };
}
function Rc(t, e) {
  return function() {
    this.setAttributeNS(t.space, t.local, e);
  };
}
function Fc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttribute(t) : this.setAttribute(t, n);
  };
}
function Lc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttributeNS(t.space, t.local) : this.setAttributeNS(t.space, t.local, n);
  };
}
function Oc(t, e) {
  var n = qr(t);
  if (arguments.length < 2) {
    var r = this.node();
    return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n);
  }
  return this.each((e == null ? n.local ? zc : Tc : typeof e == "function" ? n.local ? Lc : Fc : n.local ? Rc : Cc)(n, e));
}
function Bs(t) {
  return t.ownerDocument && t.ownerDocument.defaultView || t.document && t || t.defaultView;
}
function Dc(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function Yc(t, e, n) {
  return function() {
    this.style.setProperty(t, e, n);
  };
}
function Hc(t, e, n) {
  return function() {
    var r = e.apply(this, arguments);
    r == null ? this.style.removeProperty(t) : this.style.setProperty(t, r, n);
  };
}
function Bc(t, e, n) {
  return arguments.length > 1 ? this.each((e == null ? Dc : typeof e == "function" ? Hc : Yc)(t, e, n ?? "")) : Cn(this.node(), t);
}
function Cn(t, e) {
  return t.style.getPropertyValue(e) || Bs(t).getComputedStyle(t, null).getPropertyValue(e);
}
function Vc(t) {
  return function() {
    delete this[t];
  };
}
function Xc(t, e) {
  return function() {
    this[t] = e;
  };
}
function qc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? delete this[t] : this[t] = n;
  };
}
function Uc(t, e) {
  return arguments.length > 1 ? this.each((e == null ? Vc : typeof e == "function" ? qc : Xc)(t, e)) : this.node()[t];
}
function Vs(t) {
  return t.trim().split(/^|\s+/);
}
function Yi(t) {
  return t.classList || new Xs(t);
}
function Xs(t) {
  this._node = t, this._names = Vs(t.getAttribute("class") || "");
}
Xs.prototype = {
  add: function(t) {
    var e = this._names.indexOf(t);
    e < 0 && (this._names.push(t), this._node.setAttribute("class", this._names.join(" ")));
  },
  remove: function(t) {
    var e = this._names.indexOf(t);
    e >= 0 && (this._names.splice(e, 1), this._node.setAttribute("class", this._names.join(" ")));
  },
  contains: function(t) {
    return this._names.indexOf(t) >= 0;
  }
};
function qs(t, e) {
  for (var n = Yi(t), r = -1, i = e.length; ++r < i; ) n.add(e[r]);
}
function Us(t, e) {
  for (var n = Yi(t), r = -1, i = e.length; ++r < i; ) n.remove(e[r]);
}
function Gc(t) {
  return function() {
    qs(this, t);
  };
}
function Wc(t) {
  return function() {
    Us(this, t);
  };
}
function Kc(t, e) {
  return function() {
    (e.apply(this, arguments) ? qs : Us)(this, t);
  };
}
function Zc(t, e) {
  var n = Vs(t + "");
  if (arguments.length < 2) {
    for (var r = Yi(this.node()), i = -1, o = n.length; ++i < o; ) if (!r.contains(n[i])) return !1;
    return !0;
  }
  return this.each((typeof e == "function" ? Kc : e ? Gc : Wc)(n, e));
}
function Jc() {
  this.textContent = "";
}
function Qc(t) {
  return function() {
    this.textContent = t;
  };
}
function jc(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.textContent = e ?? "";
  };
}
function $c(t) {
  return arguments.length ? this.each(t == null ? Jc : (typeof t == "function" ? jc : Qc)(t)) : this.node().textContent;
}
function th() {
  this.innerHTML = "";
}
function eh(t) {
  return function() {
    this.innerHTML = t;
  };
}
function nh(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.innerHTML = e ?? "";
  };
}
function rh(t) {
  return arguments.length ? this.each(t == null ? th : (typeof t == "function" ? nh : eh)(t)) : this.node().innerHTML;
}
function ih() {
  this.nextSibling && this.parentNode.appendChild(this);
}
function oh() {
  return this.each(ih);
}
function sh() {
  this.previousSibling && this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function ah() {
  return this.each(sh);
}
function lh(t) {
  var e = typeof t == "function" ? t : Ls(t);
  return this.select(function() {
    return this.appendChild(e.apply(this, arguments));
  });
}
function uh() {
  return null;
}
function fh(t, e) {
  var n = typeof t == "function" ? t : Ls(t), r = e == null ? uh : typeof e == "function" ? e : Di(e);
  return this.select(function() {
    return this.insertBefore(n.apply(this, arguments), r.apply(this, arguments) || null);
  });
}
function ch() {
  var t = this.parentNode;
  t && t.removeChild(this);
}
function hh() {
  return this.each(ch);
}
function dh() {
  var t = this.cloneNode(!1), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function gh() {
  var t = this.cloneNode(!0), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function vh(t) {
  return this.select(t ? gh : dh);
}
function mh(t) {
  return arguments.length ? this.property("__data__", t) : this.node().__data__;
}
function ph(t) {
  return function(e) {
    t.call(this, e, this.__data__);
  };
}
function _h(t) {
  return t.trim().split(/^|\s+/).map(function(e) {
    var n = "", r = e.indexOf(".");
    return r >= 0 && (n = e.slice(r + 1), e = e.slice(0, r)), { type: e, name: n };
  });
}
function yh(t) {
  return function() {
    var e = this.__on;
    if (e) {
      for (var n = 0, r = -1, i = e.length, o; n < i; ++n)
        o = e[n], (!t.type || o.type === t.type) && o.name === t.name ? this.removeEventListener(o.type, o.listener, o.options) : e[++r] = o;
      ++r ? e.length = r : delete this.__on;
    }
  };
}
function wh(t, e, n) {
  return function() {
    var r = this.__on, i, o = ph(e);
    if (r) {
      for (var s = 0, a = r.length; s < a; ++s)
        if ((i = r[s]).type === t.type && i.name === t.name) {
          this.removeEventListener(i.type, i.listener, i.options), this.addEventListener(i.type, i.listener = o, i.options = n), i.value = e;
          return;
        }
    }
    this.addEventListener(t.type, o, n), i = { type: t.type, name: t.name, value: e, listener: o, options: n }, r ? r.push(i) : this.__on = [i];
  };
}
function xh(t, e, n) {
  var r = _h(t + ""), i, o = r.length, s;
  if (arguments.length < 2) {
    var a = this.node().__on;
    if (a) {
      for (var u = 0, f = a.length, c; u < f; ++u)
        for (i = 0, c = a[u]; i < o; ++i)
          if ((s = r[i]).type === c.type && s.name === c.name)
            return c.value;
    }
    return;
  }
  for (a = e ? wh : yh, i = 0; i < o; ++i) this.each(a(r[i], e, n));
  return this;
}
function Gs(t, e, n) {
  var r = Bs(t), i = r.CustomEvent;
  typeof i == "function" ? i = new i(e, n) : (i = r.document.createEvent("Event"), n ? (i.initEvent(e, n.bubbles, n.cancelable), i.detail = n.detail) : i.initEvent(e, !1, !1)), t.dispatchEvent(i);
}
function bh(t, e) {
  return function() {
    return Gs(this, t, e);
  };
}
function kh(t, e) {
  return function() {
    return Gs(this, t, e.apply(this, arguments));
  };
}
function Eh(t, e) {
  return this.each((typeof e == "function" ? kh : bh)(t, e));
}
function* Sh() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length, s; i < o; ++i)
      (s = r[i]) && (yield s);
}
var Ws = [null];
function Yt(t, e) {
  this._groups = t, this._parents = e;
}
function ar() {
  return new Yt([[document.documentElement]], Ws);
}
function Nh() {
  return this;
}
Yt.prototype = ar.prototype = {
  constructor: Yt,
  select: jf,
  selectAll: nc,
  selectChild: sc,
  selectChildren: fc,
  filter: cc,
  data: pc,
  enter: hc,
  exit: yc,
  join: wc,
  merge: xc,
  selection: Nh,
  order: bc,
  sort: kc,
  call: Sc,
  nodes: Nc,
  node: Ac,
  size: Mc,
  empty: Ic,
  each: Pc,
  attr: Oc,
  style: Bc,
  property: Uc,
  classed: Zc,
  text: $c,
  html: rh,
  raise: oh,
  lower: ah,
  append: lh,
  insert: fh,
  remove: hh,
  clone: vh,
  datum: mh,
  on: xh,
  dispatch: Eh,
  [Symbol.iterator]: Sh
};
function It(t) {
  return typeof t == "string" ? new Yt([[document.querySelector(t)]], [document.documentElement]) : new Yt([[t]], Ws);
}
function Ah(t) {
  let e;
  for (; e = t.sourceEvent; ) t = e;
  return t;
}
function ve(t, e) {
  if (t = Ah(t), e === void 0 && (e = t.currentTarget), e) {
    var n = e.ownerSVGElement || e;
    if (n.createSVGPoint) {
      var r = n.createSVGPoint();
      return r.x = t.clientX, r.y = t.clientY, r = r.matrixTransform(e.getScreenCTM().inverse()), [r.x, r.y];
    }
    if (e.getBoundingClientRect) {
      var i = e.getBoundingClientRect();
      return [t.clientX - i.left - e.clientLeft, t.clientY - i.top - e.clientTop];
    }
  }
  return [t.pageX, t.pageY];
}
const Mh = { passive: !1 }, Qn = { capture: !0, passive: !1 };
function Qr(t) {
  t.stopImmediatePropagation();
}
function pn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function Ks(t) {
  var e = t.document.documentElement, n = It(t).on("dragstart.drag", pn, Qn);
  "onselectstart" in e ? n.on("selectstart.drag", pn, Qn) : (e.__noselect = e.style.MozUserSelect, e.style.MozUserSelect = "none");
}
function Zs(t, e) {
  var n = t.document.documentElement, r = It(t).on("dragstart.drag", null);
  e && (r.on("click.drag", pn, Qn), setTimeout(function() {
    r.on("click.drag", null);
  }, 0)), "onselectstart" in n ? r.on("selectstart.drag", null) : (n.style.MozUserSelect = n.__noselect, delete n.__noselect);
}
const dr = (t) => () => t;
function gi(t, {
  sourceEvent: e,
  subject: n,
  target: r,
  identifier: i,
  active: o,
  x: s,
  y: a,
  dx: u,
  dy: f,
  dispatch: c
}) {
  Object.defineProperties(this, {
    type: { value: t, enumerable: !0, configurable: !0 },
    sourceEvent: { value: e, enumerable: !0, configurable: !0 },
    subject: { value: n, enumerable: !0, configurable: !0 },
    target: { value: r, enumerable: !0, configurable: !0 },
    identifier: { value: i, enumerable: !0, configurable: !0 },
    active: { value: o, enumerable: !0, configurable: !0 },
    x: { value: s, enumerable: !0, configurable: !0 },
    y: { value: a, enumerable: !0, configurable: !0 },
    dx: { value: u, enumerable: !0, configurable: !0 },
    dy: { value: f, enumerable: !0, configurable: !0 },
    _: { value: c }
  });
}
gi.prototype.on = function() {
  var t = this._.on.apply(this._, arguments);
  return t === this._ ? this : t;
};
function Ih(t) {
  return !t.ctrlKey && !t.button;
}
function Ph() {
  return this.parentNode;
}
function Th(t, e) {
  return e ?? { x: t.x, y: t.y };
}
function zh() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function _o() {
  var t = Ih, e = Ph, n = Th, r = zh, i = {}, o = Xr("start", "drag", "end"), s = 0, a, u, f, c, d = 0;
  function h(x) {
    x.on("mousedown.drag", v).filter(r).on("touchstart.drag", T).on("touchmove.drag", S, Mh).on("touchend.drag touchcancel.drag", D).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function v(x, P) {
    if (!(c || !t.call(this, x, P))) {
      var k = A(this, e.call(this, x, P), x, P, "mouse");
      k && (It(x.view).on("mousemove.drag", p, Qn).on("mouseup.drag", E, Qn), Ks(x.view), Qr(x), f = !1, a = x.clientX, u = x.clientY, k("start", x));
    }
  }
  function p(x) {
    if (pn(x), !f) {
      var P = x.clientX - a, k = x.clientY - u;
      f = P * P + k * k > d;
    }
    i.mouse("drag", x);
  }
  function E(x) {
    It(x.view).on("mousemove.drag mouseup.drag", null), Zs(x.view, f), pn(x), i.mouse("end", x);
  }
  function T(x, P) {
    if (t.call(this, x, P)) {
      var k = x.changedTouches, N = e.call(this, x, P), Y = k.length, z, C;
      for (z = 0; z < Y; ++z)
        (C = A(this, N, x, P, k[z].identifier, k[z])) && (Qr(x), C("start", x, k[z]));
    }
  }
  function S(x) {
    var P = x.changedTouches, k = P.length, N, Y;
    for (N = 0; N < k; ++N)
      (Y = i[P[N].identifier]) && (pn(x), Y("drag", x, P[N]));
  }
  function D(x) {
    var P = x.changedTouches, k = P.length, N, Y;
    for (c && clearTimeout(c), c = setTimeout(function() {
      c = null;
    }, 500), N = 0; N < k; ++N)
      (Y = i[P[N].identifier]) && (Qr(x), Y("end", x, P[N]));
  }
  function A(x, P, k, N, Y, z) {
    var C = o.copy(), B = ve(z || k, P), M, q, g;
    if ((g = n.call(x, new gi("beforestart", {
      sourceEvent: k,
      target: h,
      identifier: Y,
      active: s,
      x: B[0],
      y: B[1],
      dx: 0,
      dy: 0,
      dispatch: C
    }), N)) != null)
      return M = g.x - B[0] || 0, q = g.y - B[1] || 0, function b(_, w, I) {
        var R = B, L;
        switch (_) {
          case "start":
            i[Y] = b, L = s++;
            break;
          case "end":
            delete i[Y], --s;
          // falls through
          case "drag":
            B = ve(I || w, P), L = s;
            break;
        }
        C.call(
          _,
          x,
          new gi(_, {
            sourceEvent: w,
            subject: g,
            target: h,
            identifier: Y,
            active: L,
            x: B[0] + M,
            y: B[1] + q,
            dx: B[0] - R[0],
            dy: B[1] - R[1],
            dispatch: C
          }),
          N
        );
      };
  }
  return h.filter = function(x) {
    return arguments.length ? (t = typeof x == "function" ? x : dr(!!x), h) : t;
  }, h.container = function(x) {
    return arguments.length ? (e = typeof x == "function" ? x : dr(x), h) : e;
  }, h.subject = function(x) {
    return arguments.length ? (n = typeof x == "function" ? x : dr(x), h) : n;
  }, h.touchable = function(x) {
    return arguments.length ? (r = typeof x == "function" ? x : dr(!!x), h) : r;
  }, h.on = function() {
    var x = o.on.apply(o, arguments);
    return x === o ? h : x;
  }, h.clickDistance = function(x) {
    return arguments.length ? (d = (x = +x) * x, h) : Math.sqrt(d);
  }, h;
}
function Hi(t, e, n) {
  t.prototype = e.prototype = n, n.constructor = t;
}
function Js(t, e) {
  var n = Object.create(t.prototype);
  for (var r in e) n[r] = e[r];
  return n;
}
function lr() {
}
var jn = 0.7, zr = 1 / jn, _n = "\\s*([+-]?\\d+)\\s*", $n = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", ae = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Ch = /^#([0-9a-f]{3,8})$/, Rh = new RegExp(`^rgb\\(${_n},${_n},${_n}\\)$`), Fh = new RegExp(`^rgb\\(${ae},${ae},${ae}\\)$`), Lh = new RegExp(`^rgba\\(${_n},${_n},${_n},${$n}\\)$`), Oh = new RegExp(`^rgba\\(${ae},${ae},${ae},${$n}\\)$`), Dh = new RegExp(`^hsl\\(${$n},${ae},${ae}\\)$`), Yh = new RegExp(`^hsla\\(${$n},${ae},${ae},${$n}\\)$`), yo = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
Hi(lr, tr, {
  copy(t) {
    return Object.assign(new this.constructor(), this, t);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: wo,
  // Deprecated! Use color.formatHex.
  formatHex: wo,
  formatHex8: Hh,
  formatHsl: Bh,
  formatRgb: xo,
  toString: xo
});
function wo() {
  return this.rgb().formatHex();
}
function Hh() {
  return this.rgb().formatHex8();
}
function Bh() {
  return Qs(this).formatHsl();
}
function xo() {
  return this.rgb().formatRgb();
}
function tr(t) {
  var e, n;
  return t = (t + "").trim().toLowerCase(), (e = Ch.exec(t)) ? (n = e[1].length, e = parseInt(e[1], 16), n === 6 ? bo(e) : n === 3 ? new Tt(e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, (e & 15) << 4 | e & 15, 1) : n === 8 ? gr(e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, (e & 255) / 255) : n === 4 ? gr(e >> 12 & 15 | e >> 8 & 240, e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, ((e & 15) << 4 | e & 15) / 255) : null) : (e = Rh.exec(t)) ? new Tt(e[1], e[2], e[3], 1) : (e = Fh.exec(t)) ? new Tt(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, 1) : (e = Lh.exec(t)) ? gr(e[1], e[2], e[3], e[4]) : (e = Oh.exec(t)) ? gr(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, e[4]) : (e = Dh.exec(t)) ? So(e[1], e[2] / 100, e[3] / 100, 1) : (e = Yh.exec(t)) ? So(e[1], e[2] / 100, e[3] / 100, e[4]) : yo.hasOwnProperty(t) ? bo(yo[t]) : t === "transparent" ? new Tt(NaN, NaN, NaN, 0) : null;
}
function bo(t) {
  return new Tt(t >> 16 & 255, t >> 8 & 255, t & 255, 1);
}
function gr(t, e, n, r) {
  return r <= 0 && (t = e = n = NaN), new Tt(t, e, n, r);
}
function Vh(t) {
  return t instanceof lr || (t = tr(t)), t ? (t = t.rgb(), new Tt(t.r, t.g, t.b, t.opacity)) : new Tt();
}
function vi(t, e, n, r) {
  return arguments.length === 1 ? Vh(t) : new Tt(t, e, n, r ?? 1);
}
function Tt(t, e, n, r) {
  this.r = +t, this.g = +e, this.b = +n, this.opacity = +r;
}
Hi(Tt, vi, Js(lr, {
  brighter(t) {
    return t = t == null ? zr : Math.pow(zr, t), new Tt(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? jn : Math.pow(jn, t), new Tt(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Tt(je(this.r), je(this.g), je(this.b), Cr(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && -0.5 <= this.g && this.g < 255.5 && -0.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
  },
  hex: ko,
  // Deprecated! Use color.formatHex.
  formatHex: ko,
  formatHex8: Xh,
  formatRgb: Eo,
  toString: Eo
}));
function ko() {
  return `#${qe(this.r)}${qe(this.g)}${qe(this.b)}`;
}
function Xh() {
  return `#${qe(this.r)}${qe(this.g)}${qe(this.b)}${qe((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function Eo() {
  const t = Cr(this.opacity);
  return `${t === 1 ? "rgb(" : "rgba("}${je(this.r)}, ${je(this.g)}, ${je(this.b)}${t === 1 ? ")" : `, ${t})`}`;
}
function Cr(t) {
  return isNaN(t) ? 1 : Math.max(0, Math.min(1, t));
}
function je(t) {
  return Math.max(0, Math.min(255, Math.round(t) || 0));
}
function qe(t) {
  return t = je(t), (t < 16 ? "0" : "") + t.toString(16);
}
function So(t, e, n, r) {
  return r <= 0 ? t = e = n = NaN : n <= 0 || n >= 1 ? t = e = NaN : e <= 0 && (t = NaN), new jt(t, e, n, r);
}
function Qs(t) {
  if (t instanceof jt) return new jt(t.h, t.s, t.l, t.opacity);
  if (t instanceof lr || (t = tr(t)), !t) return new jt();
  if (t instanceof jt) return t;
  t = t.rgb();
  var e = t.r / 255, n = t.g / 255, r = t.b / 255, i = Math.min(e, n, r), o = Math.max(e, n, r), s = NaN, a = o - i, u = (o + i) / 2;
  return a ? (e === o ? s = (n - r) / a + (n < r) * 6 : n === o ? s = (r - e) / a + 2 : s = (e - n) / a + 4, a /= u < 0.5 ? o + i : 2 - o - i, s *= 60) : a = u > 0 && u < 1 ? 0 : s, new jt(s, a, u, t.opacity);
}
function qh(t, e, n, r) {
  return arguments.length === 1 ? Qs(t) : new jt(t, e, n, r ?? 1);
}
function jt(t, e, n, r) {
  this.h = +t, this.s = +e, this.l = +n, this.opacity = +r;
}
Hi(jt, qh, Js(lr, {
  brighter(t) {
    return t = t == null ? zr : Math.pow(zr, t), new jt(this.h, this.s, this.l * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? jn : Math.pow(jn, t), new jt(this.h, this.s, this.l * t, this.opacity);
  },
  rgb() {
    var t = this.h % 360 + (this.h < 0) * 360, e = isNaN(t) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < 0.5 ? n : 1 - n) * e, i = 2 * n - r;
    return new Tt(
      jr(t >= 240 ? t - 240 : t + 120, i, r),
      jr(t, i, r),
      jr(t < 120 ? t + 240 : t - 120, i, r),
      this.opacity
    );
  },
  clamp() {
    return new jt(No(this.h), vr(this.s), vr(this.l), Cr(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
  },
  formatHsl() {
    const t = Cr(this.opacity);
    return `${t === 1 ? "hsl(" : "hsla("}${No(this.h)}, ${vr(this.s) * 100}%, ${vr(this.l) * 100}%${t === 1 ? ")" : `, ${t})`}`;
  }
}));
function No(t) {
  return t = (t || 0) % 360, t < 0 ? t + 360 : t;
}
function vr(t) {
  return Math.max(0, Math.min(1, t || 0));
}
function jr(t, e, n) {
  return (t < 60 ? e + (n - e) * t / 60 : t < 180 ? n : t < 240 ? e + (n - e) * (240 - t) / 60 : e) * 255;
}
const js = (t) => () => t;
function Uh(t, e) {
  return function(n) {
    return t + n * e;
  };
}
function Gh(t, e, n) {
  return t = Math.pow(t, n), e = Math.pow(e, n) - t, n = 1 / n, function(r) {
    return Math.pow(t + r * e, n);
  };
}
function Wh(t) {
  return (t = +t) == 1 ? $s : function(e, n) {
    return n - e ? Gh(e, n, t) : js(isNaN(e) ? n : e);
  };
}
function $s(t, e) {
  var n = e - t;
  return n ? Uh(t, n) : js(isNaN(t) ? e : t);
}
const Ao = (function t(e) {
  var n = Wh(e);
  function r(i, o) {
    var s = n((i = vi(i)).r, (o = vi(o)).r), a = n(i.g, o.g), u = n(i.b, o.b), f = $s(i.opacity, o.opacity);
    return function(c) {
      return i.r = s(c), i.g = a(c), i.b = u(c), i.opacity = f(c), i + "";
    };
  }
  return r.gamma = t, r;
})(1);
function Pe(t, e) {
  return t = +t, e = +e, function(n) {
    return t * (1 - n) + e * n;
  };
}
var mi = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, $r = new RegExp(mi.source, "g");
function Kh(t) {
  return function() {
    return t;
  };
}
function Zh(t) {
  return function(e) {
    return t(e) + "";
  };
}
function Jh(t, e) {
  var n = mi.lastIndex = $r.lastIndex = 0, r, i, o, s = -1, a = [], u = [];
  for (t = t + "", e = e + ""; (r = mi.exec(t)) && (i = $r.exec(e)); )
    (o = i.index) > n && (o = e.slice(n, o), a[s] ? a[s] += o : a[++s] = o), (r = r[0]) === (i = i[0]) ? a[s] ? a[s] += i : a[++s] = i : (a[++s] = null, u.push({ i: s, x: Pe(r, i) })), n = $r.lastIndex;
  return n < e.length && (o = e.slice(n), a[s] ? a[s] += o : a[++s] = o), a.length < 2 ? u[0] ? Zh(u[0].x) : Kh(e) : (e = u.length, function(f) {
    for (var c = 0, d; c < e; ++c) a[(d = u[c]).i] = d.x(f);
    return a.join("");
  });
}
var Mo = 180 / Math.PI, pi = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function ta(t, e, n, r, i, o) {
  var s, a, u;
  return (s = Math.sqrt(t * t + e * e)) && (t /= s, e /= s), (u = t * n + e * r) && (n -= t * u, r -= e * u), (a = Math.sqrt(n * n + r * r)) && (n /= a, r /= a, u /= a), t * r < e * n && (t = -t, e = -e, u = -u, s = -s), {
    translateX: i,
    translateY: o,
    rotate: Math.atan2(e, t) * Mo,
    skewX: Math.atan(u) * Mo,
    scaleX: s,
    scaleY: a
  };
}
var mr;
function Qh(t) {
  const e = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(t + "");
  return e.isIdentity ? pi : ta(e.a, e.b, e.c, e.d, e.e, e.f);
}
function jh(t) {
  return t == null || (mr || (mr = document.createElementNS("http://www.w3.org/2000/svg", "g")), mr.setAttribute("transform", t), !(t = mr.transform.baseVal.consolidate())) ? pi : (t = t.matrix, ta(t.a, t.b, t.c, t.d, t.e, t.f));
}
function ea(t, e, n, r) {
  function i(f) {
    return f.length ? f.pop() + " " : "";
  }
  function o(f, c, d, h, v, p) {
    if (f !== d || c !== h) {
      var E = v.push("translate(", null, e, null, n);
      p.push({ i: E - 4, x: Pe(f, d) }, { i: E - 2, x: Pe(c, h) });
    } else (d || h) && v.push("translate(" + d + e + h + n);
  }
  function s(f, c, d, h) {
    f !== c ? (f - c > 180 ? c += 360 : c - f > 180 && (f += 360), h.push({ i: d.push(i(d) + "rotate(", null, r) - 2, x: Pe(f, c) })) : c && d.push(i(d) + "rotate(" + c + r);
  }
  function a(f, c, d, h) {
    f !== c ? h.push({ i: d.push(i(d) + "skewX(", null, r) - 2, x: Pe(f, c) }) : c && d.push(i(d) + "skewX(" + c + r);
  }
  function u(f, c, d, h, v, p) {
    if (f !== d || c !== h) {
      var E = v.push(i(v) + "scale(", null, ",", null, ")");
      p.push({ i: E - 4, x: Pe(f, d) }, { i: E - 2, x: Pe(c, h) });
    } else (d !== 1 || h !== 1) && v.push(i(v) + "scale(" + d + "," + h + ")");
  }
  return function(f, c) {
    var d = [], h = [];
    return f = t(f), c = t(c), o(f.translateX, f.translateY, c.translateX, c.translateY, d, h), s(f.rotate, c.rotate, d, h), a(f.skewX, c.skewX, d, h), u(f.scaleX, f.scaleY, c.scaleX, c.scaleY, d, h), f = c = null, function(v) {
      for (var p = -1, E = h.length, T; ++p < E; ) d[(T = h[p]).i] = T.x(v);
      return d.join("");
    };
  };
}
var $h = ea(Qh, "px, ", "px)", "deg)"), td = ea(jh, ", ", ")", ")"), ed = 1e-12;
function Io(t) {
  return ((t = Math.exp(t)) + 1 / t) / 2;
}
function nd(t) {
  return ((t = Math.exp(t)) - 1 / t) / 2;
}
function rd(t) {
  return ((t = Math.exp(2 * t)) - 1) / (t + 1);
}
const id = (function t(e, n, r) {
  function i(o, s) {
    var a = o[0], u = o[1], f = o[2], c = s[0], d = s[1], h = s[2], v = c - a, p = d - u, E = v * v + p * p, T, S;
    if (E < ed)
      S = Math.log(h / f) / e, T = function(N) {
        return [
          a + N * v,
          u + N * p,
          f * Math.exp(e * N * S)
        ];
      };
    else {
      var D = Math.sqrt(E), A = (h * h - f * f + r * E) / (2 * f * n * D), x = (h * h - f * f - r * E) / (2 * h * n * D), P = Math.log(Math.sqrt(A * A + 1) - A), k = Math.log(Math.sqrt(x * x + 1) - x);
      S = (k - P) / e, T = function(N) {
        var Y = N * S, z = Io(P), C = f / (n * D) * (z * rd(e * Y + P) - nd(P));
        return [
          a + C * v,
          u + C * p,
          f * z / Io(e * Y + P)
        ];
      };
    }
    return T.duration = S * 1e3 * e / Math.SQRT2, T;
  }
  return i.rho = function(o) {
    var s = Math.max(1e-3, +o), a = s * s, u = a * a;
    return t(s, a, u);
  }, i;
})(Math.SQRT2, 2, 4);
var Rn = 0, Vn = 0, On = 0, na = 1e3, Rr, Xn, Fr = 0, nn = 0, Ur = 0, er = typeof performance == "object" && performance.now ? performance : Date, ra = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(t) {
  setTimeout(t, 17);
};
function Bi() {
  return nn || (ra(od), nn = er.now() + Ur);
}
function od() {
  nn = 0;
}
function Lr() {
  this._call = this._time = this._next = null;
}
Lr.prototype = ia.prototype = {
  constructor: Lr,
  restart: function(t, e, n) {
    if (typeof t != "function") throw new TypeError("callback is not a function");
    n = (n == null ? Bi() : +n) + (e == null ? 0 : +e), !this._next && Xn !== this && (Xn ? Xn._next = this : Rr = this, Xn = this), this._call = t, this._time = n, _i();
  },
  stop: function() {
    this._call && (this._call = null, this._time = 1 / 0, _i());
  }
};
function ia(t, e, n) {
  var r = new Lr();
  return r.restart(t, e, n), r;
}
function sd() {
  Bi(), ++Rn;
  for (var t = Rr, e; t; )
    (e = nn - t._time) >= 0 && t._call.call(void 0, e), t = t._next;
  --Rn;
}
function Po() {
  nn = (Fr = er.now()) + Ur, Rn = Vn = 0;
  try {
    sd();
  } finally {
    Rn = 0, ld(), nn = 0;
  }
}
function ad() {
  var t = er.now(), e = t - Fr;
  e > na && (Ur -= e, Fr = t);
}
function ld() {
  for (var t, e = Rr, n, r = 1 / 0; e; )
    e._call ? (r > e._time && (r = e._time), t = e, e = e._next) : (n = e._next, e._next = null, e = t ? t._next = n : Rr = n);
  Xn = t, _i(r);
}
function _i(t) {
  if (!Rn) {
    Vn && (Vn = clearTimeout(Vn));
    var e = t - nn;
    e > 24 ? (t < 1 / 0 && (Vn = setTimeout(Po, t - er.now() - Ur)), On && (On = clearInterval(On))) : (On || (Fr = er.now(), On = setInterval(ad, na)), Rn = 1, ra(Po));
  }
}
function To(t, e, n) {
  var r = new Lr();
  return e = e == null ? 0 : +e, r.restart((i) => {
    r.stop(), t(i + e);
  }, e, n), r;
}
var ud = Xr("start", "end", "cancel", "interrupt"), fd = [], oa = 0, zo = 1, yi = 2, kr = 3, Co = 4, wi = 5, Er = 6;
function Gr(t, e, n, r, i, o) {
  var s = t.__transition;
  if (!s) t.__transition = {};
  else if (n in s) return;
  cd(t, n, {
    name: e,
    index: r,
    // For context during callback.
    group: i,
    // For context during callback.
    on: ud,
    tween: fd,
    time: o.time,
    delay: o.delay,
    duration: o.duration,
    ease: o.ease,
    timer: null,
    state: oa
  });
}
function Vi(t, e) {
  var n = te(t, e);
  if (n.state > oa) throw new Error("too late; already scheduled");
  return n;
}
function fe(t, e) {
  var n = te(t, e);
  if (n.state > kr) throw new Error("too late; already running");
  return n;
}
function te(t, e) {
  var n = t.__transition;
  if (!n || !(n = n[e])) throw new Error("transition not found");
  return n;
}
function cd(t, e, n) {
  var r = t.__transition, i;
  r[e] = n, n.timer = ia(o, 0, n.time);
  function o(f) {
    n.state = zo, n.timer.restart(s, n.delay, n.time), n.delay <= f && s(f - n.delay);
  }
  function s(f) {
    var c, d, h, v;
    if (n.state !== zo) return u();
    for (c in r)
      if (v = r[c], v.name === n.name) {
        if (v.state === kr) return To(s);
        v.state === Co ? (v.state = Er, v.timer.stop(), v.on.call("interrupt", t, t.__data__, v.index, v.group), delete r[c]) : +c < e && (v.state = Er, v.timer.stop(), v.on.call("cancel", t, t.__data__, v.index, v.group), delete r[c]);
      }
    if (To(function() {
      n.state === kr && (n.state = Co, n.timer.restart(a, n.delay, n.time), a(f));
    }), n.state = yi, n.on.call("start", t, t.__data__, n.index, n.group), n.state === yi) {
      for (n.state = kr, i = new Array(h = n.tween.length), c = 0, d = -1; c < h; ++c)
        (v = n.tween[c].value.call(t, t.__data__, n.index, n.group)) && (i[++d] = v);
      i.length = d + 1;
    }
  }
  function a(f) {
    for (var c = f < n.duration ? n.ease.call(null, f / n.duration) : (n.timer.restart(u), n.state = wi, 1), d = -1, h = i.length; ++d < h; )
      i[d].call(t, c);
    n.state === wi && (n.on.call("end", t, t.__data__, n.index, n.group), u());
  }
  function u() {
    n.state = Er, n.timer.stop(), delete r[e];
    for (var f in r) return;
    delete t.__transition;
  }
}
function Sr(t, e) {
  var n = t.__transition, r, i, o = !0, s;
  if (n) {
    e = e == null ? null : e + "";
    for (s in n) {
      if ((r = n[s]).name !== e) {
        o = !1;
        continue;
      }
      i = r.state > yi && r.state < wi, r.state = Er, r.timer.stop(), r.on.call(i ? "interrupt" : "cancel", t, t.__data__, r.index, r.group), delete n[s];
    }
    o && delete t.__transition;
  }
}
function hd(t) {
  return this.each(function() {
    Sr(this, t);
  });
}
function dd(t, e) {
  var n, r;
  return function() {
    var i = fe(this, t), o = i.tween;
    if (o !== n) {
      r = n = o;
      for (var s = 0, a = r.length; s < a; ++s)
        if (r[s].name === e) {
          r = r.slice(), r.splice(s, 1);
          break;
        }
    }
    i.tween = r;
  };
}
function gd(t, e, n) {
  var r, i;
  if (typeof n != "function") throw new Error();
  return function() {
    var o = fe(this, t), s = o.tween;
    if (s !== r) {
      i = (r = s).slice();
      for (var a = { name: e, value: n }, u = 0, f = i.length; u < f; ++u)
        if (i[u].name === e) {
          i[u] = a;
          break;
        }
      u === f && i.push(a);
    }
    o.tween = i;
  };
}
function vd(t, e) {
  var n = this._id;
  if (t += "", arguments.length < 2) {
    for (var r = te(this.node(), n).tween, i = 0, o = r.length, s; i < o; ++i)
      if ((s = r[i]).name === t)
        return s.value;
    return null;
  }
  return this.each((e == null ? dd : gd)(n, t, e));
}
function Xi(t, e, n) {
  var r = t._id;
  return t.each(function() {
    var i = fe(this, r);
    (i.value || (i.value = {}))[e] = n.apply(this, arguments);
  }), function(i) {
    return te(i, r).value[e];
  };
}
function sa(t, e) {
  var n;
  return (typeof e == "number" ? Pe : e instanceof tr ? Ao : (n = tr(e)) ? (e = n, Ao) : Jh)(t, e);
}
function md(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function pd(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function _d(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttribute(t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function yd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttributeNS(t.space, t.local);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function wd(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttribute(t) : (s = this.getAttribute(t), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function xd(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttributeNS(t.space, t.local) : (s = this.getAttributeNS(t.space, t.local), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function bd(t, e) {
  var n = qr(t), r = n === "transform" ? td : sa;
  return this.attrTween(t, typeof e == "function" ? (n.local ? xd : wd)(n, r, Xi(this, "attr." + t, e)) : e == null ? (n.local ? pd : md)(n) : (n.local ? yd : _d)(n, r, e));
}
function kd(t, e) {
  return function(n) {
    this.setAttribute(t, e.call(this, n));
  };
}
function Ed(t, e) {
  return function(n) {
    this.setAttributeNS(t.space, t.local, e.call(this, n));
  };
}
function Sd(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && Ed(t, o)), n;
  }
  return i._value = e, i;
}
function Nd(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && kd(t, o)), n;
  }
  return i._value = e, i;
}
function Ad(t, e) {
  var n = "attr." + t;
  if (arguments.length < 2) return (n = this.tween(n)) && n._value;
  if (e == null) return this.tween(n, null);
  if (typeof e != "function") throw new Error();
  var r = qr(t);
  return this.tween(n, (r.local ? Sd : Nd)(r, e));
}
function Md(t, e) {
  return function() {
    Vi(this, t).delay = +e.apply(this, arguments);
  };
}
function Id(t, e) {
  return e = +e, function() {
    Vi(this, t).delay = e;
  };
}
function Pd(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Md : Id)(e, t)) : te(this.node(), e).delay;
}
function Td(t, e) {
  return function() {
    fe(this, t).duration = +e.apply(this, arguments);
  };
}
function zd(t, e) {
  return e = +e, function() {
    fe(this, t).duration = e;
  };
}
function Cd(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Td : zd)(e, t)) : te(this.node(), e).duration;
}
function Rd(t, e) {
  if (typeof e != "function") throw new Error();
  return function() {
    fe(this, t).ease = e;
  };
}
function Fd(t) {
  var e = this._id;
  return arguments.length ? this.each(Rd(e, t)) : te(this.node(), e).ease;
}
function Ld(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    if (typeof n != "function") throw new Error();
    fe(this, t).ease = n;
  };
}
function Od(t) {
  if (typeof t != "function") throw new Error();
  return this.each(Ld(this._id, t));
}
function Dd(t) {
  typeof t != "function" && (t = Ds(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new xe(r, this._parents, this._name, this._id);
}
function Yd(t) {
  if (t._id !== this._id) throw new Error();
  for (var e = this._groups, n = t._groups, r = e.length, i = n.length, o = Math.min(r, i), s = new Array(r), a = 0; a < o; ++a)
    for (var u = e[a], f = n[a], c = u.length, d = s[a] = new Array(c), h, v = 0; v < c; ++v)
      (h = u[v] || f[v]) && (d[v] = h);
  for (; a < r; ++a)
    s[a] = e[a];
  return new xe(s, this._parents, this._name, this._id);
}
function Hd(t) {
  return (t + "").trim().split(/^|\s+/).every(function(e) {
    var n = e.indexOf(".");
    return n >= 0 && (e = e.slice(0, n)), !e || e === "start";
  });
}
function Bd(t, e, n) {
  var r, i, o = Hd(e) ? Vi : fe;
  return function() {
    var s = o(this, t), a = s.on;
    a !== r && (i = (r = a).copy()).on(e, n), s.on = i;
  };
}
function Vd(t, e) {
  var n = this._id;
  return arguments.length < 2 ? te(this.node(), n).on.on(t) : this.each(Bd(n, t, e));
}
function Xd(t) {
  return function() {
    var e = this.parentNode;
    for (var n in this.__transition) if (+n !== t) return;
    e && e.removeChild(this);
  };
}
function qd() {
  return this.on("end.remove", Xd(this._id));
}
function Ud(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Di(t));
  for (var r = this._groups, i = r.length, o = new Array(i), s = 0; s < i; ++s)
    for (var a = r[s], u = a.length, f = o[s] = new Array(u), c, d, h = 0; h < u; ++h)
      (c = a[h]) && (d = t.call(c, c.__data__, h, a)) && ("__data__" in c && (d.__data__ = c.__data__), f[h] = d, Gr(f[h], e, n, h, f, te(c, n)));
  return new xe(o, this._parents, e, n);
}
function Gd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Os(t));
  for (var r = this._groups, i = r.length, o = [], s = [], a = 0; a < i; ++a)
    for (var u = r[a], f = u.length, c, d = 0; d < f; ++d)
      if (c = u[d]) {
        for (var h = t.call(c, c.__data__, d, u), v, p = te(c, n), E = 0, T = h.length; E < T; ++E)
          (v = h[E]) && Gr(v, e, n, E, h, p);
        o.push(h), s.push(c);
      }
  return new xe(o, s, e, n);
}
var Wd = ar.prototype.constructor;
function Kd() {
  return new Wd(this._groups, this._parents);
}
function Zd(t, e) {
  var n, r, i;
  return function() {
    var o = Cn(this, t), s = (this.style.removeProperty(t), Cn(this, t));
    return o === s ? null : o === n && s === r ? i : i = e(n = o, r = s);
  };
}
function aa(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function Jd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = Cn(this, t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function Qd(t, e, n) {
  var r, i, o;
  return function() {
    var s = Cn(this, t), a = n(this), u = a + "";
    return a == null && (u = a = (this.style.removeProperty(t), Cn(this, t))), s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a));
  };
}
function jd(t, e) {
  var n, r, i, o = "style." + e, s = "end." + o, a;
  return function() {
    var u = fe(this, t), f = u.on, c = u.value[o] == null ? a || (a = aa(e)) : void 0;
    (f !== n || i !== c) && (r = (n = f).copy()).on(s, i = c), u.on = r;
  };
}
function $d(t, e, n) {
  var r = (t += "") == "transform" ? $h : sa;
  return e == null ? this.styleTween(t, Zd(t, r)).on("end.style." + t, aa(t)) : typeof e == "function" ? this.styleTween(t, Qd(t, r, Xi(this, "style." + t, e))).each(jd(this._id, t)) : this.styleTween(t, Jd(t, r, e), n).on("end.style." + t, null);
}
function t0(t, e, n) {
  return function(r) {
    this.style.setProperty(t, e.call(this, r), n);
  };
}
function e0(t, e, n) {
  var r, i;
  function o() {
    var s = e.apply(this, arguments);
    return s !== i && (r = (i = s) && t0(t, s, n)), r;
  }
  return o._value = e, o;
}
function n0(t, e, n) {
  var r = "style." + (t += "");
  if (arguments.length < 2) return (r = this.tween(r)) && r._value;
  if (e == null) return this.tween(r, null);
  if (typeof e != "function") throw new Error();
  return this.tween(r, e0(t, e, n ?? ""));
}
function r0(t) {
  return function() {
    this.textContent = t;
  };
}
function i0(t) {
  return function() {
    var e = t(this);
    this.textContent = e ?? "";
  };
}
function o0(t) {
  return this.tween("text", typeof t == "function" ? i0(Xi(this, "text", t)) : r0(t == null ? "" : t + ""));
}
function s0(t) {
  return function(e) {
    this.textContent = t.call(this, e);
  };
}
function a0(t) {
  var e, n;
  function r() {
    var i = t.apply(this, arguments);
    return i !== n && (e = (n = i) && s0(i)), e;
  }
  return r._value = t, r;
}
function l0(t) {
  var e = "text";
  if (arguments.length < 1) return (e = this.tween(e)) && e._value;
  if (t == null) return this.tween(e, null);
  if (typeof t != "function") throw new Error();
  return this.tween(e, a0(t));
}
function u0() {
  for (var t = this._name, e = this._id, n = la(), r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, f = 0; f < a; ++f)
      if (u = s[f]) {
        var c = te(u, e);
        Gr(u, t, n, f, s, {
          time: c.time + c.delay + c.duration,
          delay: 0,
          duration: c.duration,
          ease: c.ease
        });
      }
  return new xe(r, this._parents, t, n);
}
function f0() {
  var t, e, n = this, r = n._id, i = n.size();
  return new Promise(function(o, s) {
    var a = { value: s }, u = { value: function() {
      --i === 0 && o();
    } };
    n.each(function() {
      var f = fe(this, r), c = f.on;
      c !== t && (e = (t = c).copy(), e._.cancel.push(a), e._.interrupt.push(a), e._.end.push(u)), f.on = e;
    }), i === 0 && o();
  });
}
var c0 = 0;
function xe(t, e, n, r) {
  this._groups = t, this._parents = e, this._name = n, this._id = r;
}
function la() {
  return ++c0;
}
var de = ar.prototype;
xe.prototype = {
  constructor: xe,
  select: Ud,
  selectAll: Gd,
  selectChild: de.selectChild,
  selectChildren: de.selectChildren,
  filter: Dd,
  merge: Yd,
  selection: Kd,
  transition: u0,
  call: de.call,
  nodes: de.nodes,
  node: de.node,
  size: de.size,
  empty: de.empty,
  each: de.each,
  on: Vd,
  attr: bd,
  attrTween: Ad,
  style: $d,
  styleTween: n0,
  text: o0,
  textTween: l0,
  remove: qd,
  tween: vd,
  delay: Pd,
  duration: Cd,
  ease: Fd,
  easeVarying: Od,
  end: f0,
  [Symbol.iterator]: de[Symbol.iterator]
};
function h0(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}
var d0 = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: h0
};
function g0(t, e) {
  for (var n; !(n = t.__transition) || !(n = n[e]); )
    if (!(t = t.parentNode))
      throw new Error(`transition ${e} not found`);
  return n;
}
function v0(t) {
  var e, n;
  t instanceof xe ? (e = t._id, t = t._name) : (e = la(), (n = d0).time = Bi(), t = t == null ? null : t + "");
  for (var r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && Gr(u, t, e, f, s, n || g0(u, e));
  return new xe(r, this._parents, t, e);
}
ar.prototype.interrupt = hd;
ar.prototype.transition = v0;
const pr = (t) => () => t;
function m0(t, {
  sourceEvent: e,
  target: n,
  transform: r,
  dispatch: i
}) {
  Object.defineProperties(this, {
    type: { value: t, enumerable: !0, configurable: !0 },
    sourceEvent: { value: e, enumerable: !0, configurable: !0 },
    target: { value: n, enumerable: !0, configurable: !0 },
    transform: { value: r, enumerable: !0, configurable: !0 },
    _: { value: i }
  });
}
function _e(t, e, n) {
  this.k = t, this.x = e, this.y = n;
}
_e.prototype = {
  constructor: _e,
  scale: function(t) {
    return t === 1 ? this : new _e(this.k * t, this.x, this.y);
  },
  translate: function(t, e) {
    return t === 0 & e === 0 ? this : new _e(this.k, this.x + this.k * t, this.y + this.k * e);
  },
  apply: function(t) {
    return [t[0] * this.k + this.x, t[1] * this.k + this.y];
  },
  applyX: function(t) {
    return t * this.k + this.x;
  },
  applyY: function(t) {
    return t * this.k + this.y;
  },
  invert: function(t) {
    return [(t[0] - this.x) / this.k, (t[1] - this.y) / this.k];
  },
  invertX: function(t) {
    return (t - this.x) / this.k;
  },
  invertY: function(t) {
    return (t - this.y) / this.k;
  },
  rescaleX: function(t) {
    return t.copy().domain(t.range().map(this.invertX, this).map(t.invert, t));
  },
  rescaleY: function(t) {
    return t.copy().domain(t.range().map(this.invertY, this).map(t.invert, t));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};
var ua = new _e(1, 0, 0);
_e.prototype;
function ti(t) {
  t.stopImmediatePropagation();
}
function Dn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function p0(t) {
  return (!t.ctrlKey || t.type === "wheel") && !t.button;
}
function _0() {
  var t = this;
  return t instanceof SVGElement ? (t = t.ownerSVGElement || t, t.hasAttribute("viewBox") ? (t = t.viewBox.baseVal, [[t.x, t.y], [t.x + t.width, t.y + t.height]]) : [[0, 0], [t.width.baseVal.value, t.height.baseVal.value]]) : [[0, 0], [t.clientWidth, t.clientHeight]];
}
function Ro() {
  return this.__zoom || ua;
}
function y0(t) {
  return -t.deltaY * (t.deltaMode === 1 ? 0.05 : t.deltaMode ? 1 : 2e-3) * (t.ctrlKey ? 10 : 1);
}
function w0() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function x0(t, e, n) {
  var r = t.invertX(e[0][0]) - n[0][0], i = t.invertX(e[1][0]) - n[1][0], o = t.invertY(e[0][1]) - n[0][1], s = t.invertY(e[1][1]) - n[1][1];
  return t.translate(
    i > r ? (r + i) / 2 : Math.min(0, r) || Math.max(0, i),
    s > o ? (o + s) / 2 : Math.min(0, o) || Math.max(0, s)
  );
}
function b0() {
  var t = p0, e = _0, n = x0, r = y0, i = w0, o = [0, 1 / 0], s = [[-1 / 0, -1 / 0], [1 / 0, 1 / 0]], a = 250, u = id, f = Xr("start", "zoom", "end"), c, d, h, v = 500, p = 150, E = 0, T = 10;
  function S(g) {
    g.property("__zoom", Ro).on("wheel.zoom", Y, { passive: !1 }).on("mousedown.zoom", z).on("dblclick.zoom", C).filter(i).on("touchstart.zoom", B).on("touchmove.zoom", M).on("touchend.zoom touchcancel.zoom", q).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  S.transform = function(g, b, _, w) {
    var I = g.selection ? g.selection() : g;
    I.property("__zoom", Ro), g !== I ? P(g, b, _, w) : I.interrupt().each(function() {
      k(this, arguments).event(w).start().zoom(null, typeof b == "function" ? b.apply(this, arguments) : b).end();
    });
  }, S.scaleBy = function(g, b, _, w) {
    S.scaleTo(g, function() {
      var I = this.__zoom.k, R = typeof b == "function" ? b.apply(this, arguments) : b;
      return I * R;
    }, _, w);
  }, S.scaleTo = function(g, b, _, w) {
    S.transform(g, function() {
      var I = e.apply(this, arguments), R = this.__zoom, L = _ == null ? x(I) : typeof _ == "function" ? _.apply(this, arguments) : _, X = R.invert(L), U = typeof b == "function" ? b.apply(this, arguments) : b;
      return n(A(D(R, U), L, X), I, s);
    }, _, w);
  }, S.translateBy = function(g, b, _, w) {
    S.transform(g, function() {
      return n(this.__zoom.translate(
        typeof b == "function" ? b.apply(this, arguments) : b,
        typeof _ == "function" ? _.apply(this, arguments) : _
      ), e.apply(this, arguments), s);
    }, null, w);
  }, S.translateTo = function(g, b, _, w, I) {
    S.transform(g, function() {
      var R = e.apply(this, arguments), L = this.__zoom, X = w == null ? x(R) : typeof w == "function" ? w.apply(this, arguments) : w;
      return n(ua.translate(X[0], X[1]).scale(L.k).translate(
        typeof b == "function" ? -b.apply(this, arguments) : -b,
        typeof _ == "function" ? -_.apply(this, arguments) : -_
      ), R, s);
    }, w, I);
  };
  function D(g, b) {
    return b = Math.max(o[0], Math.min(o[1], b)), b === g.k ? g : new _e(b, g.x, g.y);
  }
  function A(g, b, _) {
    var w = b[0] - _[0] * g.k, I = b[1] - _[1] * g.k;
    return w === g.x && I === g.y ? g : new _e(g.k, w, I);
  }
  function x(g) {
    return [(+g[0][0] + +g[1][0]) / 2, (+g[0][1] + +g[1][1]) / 2];
  }
  function P(g, b, _, w) {
    g.on("start.zoom", function() {
      k(this, arguments).event(w).start();
    }).on("interrupt.zoom end.zoom", function() {
      k(this, arguments).event(w).end();
    }).tween("zoom", function() {
      var I = this, R = arguments, L = k(I, R).event(w), X = e.apply(I, R), U = _ == null ? x(X) : typeof _ == "function" ? _.apply(I, R) : _, ot = Math.max(X[1][0] - X[0][0], X[1][1] - X[0][1]), it = I.__zoom, pt = typeof b == "function" ? b.apply(I, R) : b, Wt = u(it.invert(U).concat(ot / it.k), pt.invert(U).concat(ot / pt.k));
      return function(F) {
        if (F === 1) F = pt;
        else {
          var H = Wt(F), et = ot / H[2];
          F = new _e(et, U[0] - H[0] * et, U[1] - H[1] * et);
        }
        L.zoom(null, F);
      };
    });
  }
  function k(g, b, _) {
    return !_ && g.__zooming || new N(g, b);
  }
  function N(g, b) {
    this.that = g, this.args = b, this.active = 0, this.sourceEvent = null, this.extent = e.apply(g, b), this.taps = 0;
  }
  N.prototype = {
    event: function(g) {
      return g && (this.sourceEvent = g), this;
    },
    start: function() {
      return ++this.active === 1 && (this.that.__zooming = this, this.emit("start")), this;
    },
    zoom: function(g, b) {
      return this.mouse && g !== "mouse" && (this.mouse[1] = b.invert(this.mouse[0])), this.touch0 && g !== "touch" && (this.touch0[1] = b.invert(this.touch0[0])), this.touch1 && g !== "touch" && (this.touch1[1] = b.invert(this.touch1[0])), this.that.__zoom = b, this.emit("zoom"), this;
    },
    end: function() {
      return --this.active === 0 && (delete this.that.__zooming, this.emit("end")), this;
    },
    emit: function(g) {
      var b = It(this.that).datum();
      f.call(
        g,
        this.that,
        new m0(g, {
          sourceEvent: this.sourceEvent,
          target: S,
          transform: this.that.__zoom,
          dispatch: f
        }),
        b
      );
    }
  };
  function Y(g, ...b) {
    if (!t.apply(this, arguments)) return;
    var _ = k(this, b).event(g), w = this.__zoom, I = Math.max(o[0], Math.min(o[1], w.k * Math.pow(2, r.apply(this, arguments)))), R = ve(g);
    if (_.wheel)
      (_.mouse[0][0] !== R[0] || _.mouse[0][1] !== R[1]) && (_.mouse[1] = w.invert(_.mouse[0] = R)), clearTimeout(_.wheel);
    else {
      if (w.k === I) return;
      _.mouse = [R, w.invert(R)], Sr(this), _.start();
    }
    Dn(g), _.wheel = setTimeout(L, p), _.zoom("mouse", n(A(D(w, I), _.mouse[0], _.mouse[1]), _.extent, s));
    function L() {
      _.wheel = null, _.end();
    }
  }
  function z(g, ...b) {
    if (h || !t.apply(this, arguments)) return;
    var _ = g.currentTarget, w = k(this, b, !0).event(g), I = It(g.view).on("mousemove.zoom", U, !0).on("mouseup.zoom", ot, !0), R = ve(g, _), L = g.clientX, X = g.clientY;
    Ks(g.view), ti(g), w.mouse = [R, this.__zoom.invert(R)], Sr(this), w.start();
    function U(it) {
      if (Dn(it), !w.moved) {
        var pt = it.clientX - L, Wt = it.clientY - X;
        w.moved = pt * pt + Wt * Wt > E;
      }
      w.event(it).zoom("mouse", n(A(w.that.__zoom, w.mouse[0] = ve(it, _), w.mouse[1]), w.extent, s));
    }
    function ot(it) {
      I.on("mousemove.zoom mouseup.zoom", null), Zs(it.view, w.moved), Dn(it), w.event(it).end();
    }
  }
  function C(g, ...b) {
    if (t.apply(this, arguments)) {
      var _ = this.__zoom, w = ve(g.changedTouches ? g.changedTouches[0] : g, this), I = _.invert(w), R = _.k * (g.shiftKey ? 0.5 : 2), L = n(A(D(_, R), w, I), e.apply(this, b), s);
      Dn(g), a > 0 ? It(this).transition().duration(a).call(P, L, w, g) : It(this).call(S.transform, L, w, g);
    }
  }
  function B(g, ...b) {
    if (t.apply(this, arguments)) {
      var _ = g.touches, w = _.length, I = k(this, b, g.changedTouches.length === w).event(g), R, L, X, U;
      for (ti(g), L = 0; L < w; ++L)
        X = _[L], U = ve(X, this), U = [U, this.__zoom.invert(U), X.identifier], I.touch0 ? !I.touch1 && I.touch0[2] !== U[2] && (I.touch1 = U, I.taps = 0) : (I.touch0 = U, R = !0, I.taps = 1 + !!c);
      c && (c = clearTimeout(c)), R && (I.taps < 2 && (d = U[0], c = setTimeout(function() {
        c = null;
      }, v)), Sr(this), I.start());
    }
  }
  function M(g, ...b) {
    if (this.__zooming) {
      var _ = k(this, b).event(g), w = g.changedTouches, I = w.length, R, L, X, U;
      for (Dn(g), R = 0; R < I; ++R)
        L = w[R], X = ve(L, this), _.touch0 && _.touch0[2] === L.identifier ? _.touch0[0] = X : _.touch1 && _.touch1[2] === L.identifier && (_.touch1[0] = X);
      if (L = _.that.__zoom, _.touch1) {
        var ot = _.touch0[0], it = _.touch0[1], pt = _.touch1[0], Wt = _.touch1[1], F = (F = pt[0] - ot[0]) * F + (F = pt[1] - ot[1]) * F, H = (H = Wt[0] - it[0]) * H + (H = Wt[1] - it[1]) * H;
        L = D(L, Math.sqrt(F / H)), X = [(ot[0] + pt[0]) / 2, (ot[1] + pt[1]) / 2], U = [(it[0] + Wt[0]) / 2, (it[1] + Wt[1]) / 2];
      } else if (_.touch0) X = _.touch0[0], U = _.touch0[1];
      else return;
      _.zoom("touch", n(A(L, X, U), _.extent, s));
    }
  }
  function q(g, ...b) {
    if (this.__zooming) {
      var _ = k(this, b).event(g), w = g.changedTouches, I = w.length, R, L;
      for (ti(g), h && clearTimeout(h), h = setTimeout(function() {
        h = null;
      }, v), R = 0; R < I; ++R)
        L = w[R], _.touch0 && _.touch0[2] === L.identifier ? delete _.touch0 : _.touch1 && _.touch1[2] === L.identifier && delete _.touch1;
      if (_.touch1 && !_.touch0 && (_.touch0 = _.touch1, delete _.touch1), _.touch0) _.touch0[1] = this.__zoom.invert(_.touch0[0]);
      else if (_.end(), _.taps === 2 && (L = ve(L, this), Math.hypot(d[0] - L[0], d[1] - L[1]) < T)) {
        var X = It(this).on("dblclick.zoom");
        X && X.apply(this, arguments);
      }
    }
  }
  return S.wheelDelta = function(g) {
    return arguments.length ? (r = typeof g == "function" ? g : pr(+g), S) : r;
  }, S.filter = function(g) {
    return arguments.length ? (t = typeof g == "function" ? g : pr(!!g), S) : t;
  }, S.touchable = function(g) {
    return arguments.length ? (i = typeof g == "function" ? g : pr(!!g), S) : i;
  }, S.extent = function(g) {
    return arguments.length ? (e = typeof g == "function" ? g : pr([[+g[0][0], +g[0][1]], [+g[1][0], +g[1][1]]]), S) : e;
  }, S.scaleExtent = function(g) {
    return arguments.length ? (o[0] = +g[0], o[1] = +g[1], S) : [o[0], o[1]];
  }, S.translateExtent = function(g) {
    return arguments.length ? (s[0][0] = +g[0][0], s[1][0] = +g[1][0], s[0][1] = +g[0][1], s[1][1] = +g[1][1], S) : [[s[0][0], s[0][1]], [s[1][0], s[1][1]]];
  }, S.constrain = function(g) {
    return arguments.length ? (n = g, S) : n;
  }, S.duration = function(g) {
    return arguments.length ? (a = +g, S) : a;
  }, S.interpolate = function(g) {
    return arguments.length ? (u = g, S) : u;
  }, S.on = function() {
    var g = f.on.apply(f, arguments);
    return g === f ? S : g;
  }, S.clickDistance = function(g) {
    return arguments.length ? (E = (g = +g) * g, S) : Math.sqrt(E);
  }, S.tapDistance = function(g) {
    return arguments.length ? (T = +g, S) : T;
  }, S;
}
function k0(t) {
  if (t.length === 0) return "";
  const [e, ...n] = t;
  if (!e) return "";
  let r = `M ${e.x} ${e.y}`;
  for (const i of n)
    r += ` L ${i.x} ${i.y}`;
  return r;
}
const Yn = 12;
function E0(t) {
  const e = t.absolutePosition.x, n = t.absolutePosition.y;
  switch (t.side) {
    case "top":
      return { x: e, y: n - Yn, textAnchor: "middle" };
    case "bottom":
      return { x: e, y: n + Yn + 4, textAnchor: "middle" };
    case "left":
      return { x: e - Yn, y: n, textAnchor: "end" };
    case "right":
      return { x: e + Yn, y: n, textAnchor: "start" };
    default:
      return { x: e, y: n - Yn, textAnchor: "middle" };
  }
}
const Fo = [
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#db2777",
  "#059669",
  "#0284c7",
  "#4f46e5"
];
function S0(t) {
  if (!t || t.length === 0) return;
  const e = t.reduce((n, r) => n + r, 0);
  return Fo[e % Fo.length];
}
var N0 = /* @__PURE__ */ tt('<path fill="none" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke="white" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke-linecap="round" pointer-events="none"></path>', 1), A0 = /* @__PURE__ */ tt('<path class="link" fill="none" stroke-linecap="round" pointer-events="none"></path>'), M0 = /* @__PURE__ */ tt('<text class="link-label" text-anchor="middle"> </text>'), I0 = /* @__PURE__ */ tt('<text class="link-label" text-anchor="middle"> </text>'), P0 = /* @__PURE__ */ tt("<!><!>", 1), T0 = /* @__PURE__ */ tt('<g class="link-group"><!><path fill="none" stroke="transparent" stroke-linecap="round"></path><!></g>');
function z0(t, e) {
  on(e, !0);
  let n = wt(e, "selected", 3, !1), r = wt(e, "interactive", 3, !1);
  const i = /* @__PURE__ */ O(() => k0(e.edge.points)), o = /* @__PURE__ */ O(() => e.edge.link), s = /* @__PURE__ */ O(() => {
    var k;
    return ((k = l(o)) == null ? void 0 : k.type) ?? "solid";
  }), a = /* @__PURE__ */ O(() => () => {
    var k, N;
    switch (l(s)) {
      case "dashed":
        return "5 3";
      default:
        return ((N = (k = l(o)) == null ? void 0 : k.style) == null ? void 0 : N.strokeDasharray) ?? "";
    }
  }), u = /* @__PURE__ */ O(() => {
    var k, N, Y;
    return n() ? e.colors.selection : ((N = (k = l(o)) == null ? void 0 : k.style) == null ? void 0 : N.stroke) ?? S0((Y = l(o)) == null ? void 0 : Y.vlan) ?? e.colors.linkStroke;
  }), f = /* @__PURE__ */ O(() => l(s) === "double"), c = /* @__PURE__ */ O(() => () => {
    var N;
    return (N = l(o)) != null && N.label ? [Array.isArray(l(o).label) ? l(o).label.join(" / ") : l(o).label] : [];
  }), d = /* @__PURE__ */ O(() => () => {
    var k;
    return !((k = l(o)) != null && k.vlan) || l(o).vlan.length === 0 ? "" : l(o).vlan.length === 1 ? `VLAN ${l(o).vlan[0]}` : `VLAN ${l(o).vlan.join(", ")}`;
  }), h = /* @__PURE__ */ O(() => () => {
    if (e.edge.points.length < 2) return null;
    const k = Math.floor(e.edge.points.length / 2), N = e.edge.points[k - 1], Y = e.edge.points[k];
    return !N || !Y ? null : { x: (N.x + Y.x) / 2, y: (N.y + Y.y) / 2 };
  });
  function v(k) {
    var N;
    r() && (k.stopPropagation(), (N = e.onselect) == null || N.call(e, e.edge.id));
  }
  function p(k) {
    var N, Y;
    r() && (k.preventDefault(), k.stopPropagation(), (N = e.onselect) == null || N.call(e, e.edge.id), (Y = e.oncontextmenu) == null || Y.call(e, e.edge.id, k));
  }
  var E = T0(), T = ft(E);
  {
    var S = (k) => {
      const N = /* @__PURE__ */ O(() => Math.max(3, Math.round(e.edge.width * 0.9)));
      var Y = N0(), z = At(Y), C = Q(z), B = Q(C);
      nt(
        (M, q) => {
          m(z, "d", l(i)), m(z, "stroke", l(u)), m(z, "stroke-width", e.edge.width + l(N) * 2), m(C, "d", l(i)), m(C, "stroke-width", M), m(B, "d", l(i)), m(B, "stroke", l(u)), m(B, "stroke-width", q);
        },
        [
          () => Math.max(1, e.edge.width),
          () => Math.max(1, e.edge.width - Math.round(l(N) * 0.8))
        ]
      ), W(k, Y);
    }, D = (k) => {
      var N = A0();
      nt(
        (Y) => {
          m(N, "d", l(i)), m(N, "stroke", l(u)), m(N, "stroke-width", e.edge.width), m(N, "stroke-dasharray", Y);
        },
        [() => l(a)() || void 0]
      ), W(k, N);
    };
    ut(T, (k) => {
      l(f) ? k(S) : k(D, !1);
    });
  }
  var A = Q(T);
  A.__click = v, A.__contextmenu = p;
  var x = Q(A);
  {
    var P = (k) => {
      const N = /* @__PURE__ */ O(() => l(h)());
      var Y = ge(), z = At(Y);
      {
        var C = (B) => {
          const M = /* @__PURE__ */ O(() => l(c)()), q = /* @__PURE__ */ O(() => l(d)());
          var g = P0(), b = At(g);
          Be(b, 17, () => l(M), Es, (I, R, L) => {
            var X = M0(), U = ft(X);
            nt(() => {
              m(X, "x", l(N).x), m(X, "y", l(N).y - 8 + L * 12), Zn(U, l(R));
            }), W(I, X);
          });
          var _ = Q(b);
          {
            var w = (I) => {
              var R = I0(), L = ft(R);
              nt(() => {
                m(R, "x", l(N).x), m(R, "y", l(N).y - 8 + l(M).length * 12), Zn(L, l(q));
              }), W(I, R);
            };
            ut(_, (I) => {
              l(q) && I(w);
            });
          }
          W(B, g);
        };
        ut(z, (B) => {
          l(N) && B(C);
        });
      }
      W(k, Y);
    };
    ut(x, (k) => {
      l(h)() && k(P);
    });
  }
  nt(
    (k) => {
      m(E, "data-link-id", e.edge.id), m(A, "d", l(i)), m(A, "stroke-width", k), Ri(A, `pointer-events: ${r() ? "stroke" : "none"}; cursor: pointer;`);
    },
    [() => Math.max(e.edge.width + 12, 16)]
  ), W(t, E), sn();
}
Vr(["click", "contextmenu"]);
var C0 = /* @__PURE__ */ tt('<line stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"></line>');
function R0(t, e) {
  var n = C0();
  nt(() => {
    m(n, "x1", e.fromX), m(n, "y1", e.fromY), m(n, "x2", e.toX), m(n, "y2", e.toY);
  }), W(t, n);
}
var F0 = /* @__PURE__ */ tt('<rect rx="8" ry="8"></rect>'), L0 = /* @__PURE__ */ tt("<rect></rect>"), O0 = /* @__PURE__ */ tt("<circle></circle>"), D0 = /* @__PURE__ */ tt("<polygon></polygon>"), Y0 = /* @__PURE__ */ tt("<polygon></polygon>"), H0 = /* @__PURE__ */ tt('<g><ellipse></ellipse><rect stroke="none"></rect><line></line><line></line><ellipse></ellipse></g>'), B0 = /* @__PURE__ */ tt("<rect></rect>"), V0 = /* @__PURE__ */ tt("<polygon></polygon>"), X0 = /* @__PURE__ */ tt('<rect rx="8" ry="8"></rect>'), q0 = /* @__PURE__ */ tt('<g class="node-icon"><svg viewBox="0 0 24 24" fill="currentColor"><!></svg></g>'), U0 = /* @__PURE__ */ tt('<text text-anchor="middle"> </text>'), G0 = /* @__PURE__ */ tt('<rect fill="transparent" style="cursor: pointer; pointer-events: fill;"></rect><rect fill="transparent" style="cursor: pointer; pointer-events: fill;"></rect><rect fill="transparent" style="cursor: pointer; pointer-events: fill;"></rect><rect fill="transparent" style="cursor: pointer; pointer-events: fill;"></rect>', 1), W0 = /* @__PURE__ */ tt('<circle r="7" fill="#3b82f6" opacity="0.8" pointer-events="none"></circle><text text-anchor="middle" dominant-baseline="central" font-size="11" fill="white" pointer-events="none">+</text>', 1), K0 = /* @__PURE__ */ tt('<g class="node"><g class="node-bg"><!></g><g class="node-fg" pointer-events="none"><!><!></g><!><!></g>');
function Z0(t, e) {
  on(e, !0);
  let n = wt(e, "shadowFilterId", 3, "node-shadow"), r = wt(e, "selected", 3, !1), i = wt(e, "interactive", 3, !1);
  const o = /* @__PURE__ */ O(() => e.node.position.x), s = /* @__PURE__ */ O(() => e.node.position.y), a = /* @__PURE__ */ O(() => e.node.size.width / 2), u = /* @__PURE__ */ O(() => e.node.size.height / 2), f = /* @__PURE__ */ O(() => e.node.node.shape ?? "rounded");
  let c = /* @__PURE__ */ lt(!1);
  const d = /* @__PURE__ */ O(() => r() || l(c)), h = /* @__PURE__ */ O(() => {
    var F;
    return ((F = e.node.node.style) == null ? void 0 : F.fill) ?? (l(d) ? e.colors.nodeHoverFill : e.colors.nodeFill);
  }), v = /* @__PURE__ */ O(() => {
    var F;
    return r() ? e.colors.selection : ((F = e.node.node.style) == null ? void 0 : F.stroke) ?? (l(c) ? e.colors.nodeHoverStroke : e.colors.nodeStroke);
  }), p = /* @__PURE__ */ O(() => {
    var F;
    return r() ? 2.5 : ((F = e.node.node.style) == null ? void 0 : F.strokeWidth) ?? (l(c) ? 2 : 1.5);
  }), E = /* @__PURE__ */ O(() => {
    var F;
    return ((F = e.node.node.style) == null ? void 0 : F.strokeDasharray) ?? "";
  }), T = /* @__PURE__ */ O(() => tu(e.node.node.type)), S = Zl, D = /* @__PURE__ */ O(() => Array.isArray(e.node.node.label) ? e.node.node.label : [e.node.node.label ?? ""]), A = /* @__PURE__ */ O(() => l(D).map((F, H) => {
    const et = F.includes("<b>") || F.includes("<strong>"), $ = F.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, ""), Et = H > 0 && !et;
    return { text: $, className: et ? "node-label node-label-bold" : Et ? "node-label-secondary" : "node-label" };
  })), x = /* @__PURE__ */ O(() => l(T) ? S : 0), P = /* @__PURE__ */ O(() => l(x) > 0 ? Jl : 0), k = /* @__PURE__ */ O(() => l(A).length * Zr), N = /* @__PURE__ */ O(() => l(x) + l(P) + l(k)), Y = /* @__PURE__ */ O(() => l(s) - l(N) / 2), z = /* @__PURE__ */ O(() => l(Y) + l(x) + l(P) + Zr * 0.7);
  let C = /* @__PURE__ */ lt(null);
  function B(F, H) {
    const et = H.currentTarget.getBoundingClientRect();
    if (F === "top" || F === "bottom") {
      const $ = Math.max(0, Math.min(1, (H.clientX - et.left) / et.width));
      V(
        C,
        {
          side: F,
          x: l(o) - l(a) + $ * e.node.size.width,
          y: F === "top" ? l(s) - l(u) : l(s) + l(u)
        },
        !0
      );
    } else {
      const $ = Math.max(0, Math.min(1, (H.clientY - et.top) / et.height));
      V(
        C,
        {
          side: F,
          x: F === "left" ? l(o) - l(a) : l(o) + l(a),
          y: l(s) - l(u) + $ * e.node.size.height
        },
        !0
      );
    }
  }
  function M(F) {
    var H;
    l(C) && (F.stopPropagation(), F.preventDefault(), (H = e.onaddport) == null || H.call(e, e.node.id, l(C).side));
  }
  function q(F) {
    var H;
    i() && (F.preventDefault(), F.stopPropagation(), (H = e.oncontextmenu) == null || H.call(e, e.node.id, F));
  }
  var g = K0();
  g.__contextmenu = q;
  var b = ft(g), _ = ft(b);
  {
    var w = (F) => {
      var H = F0();
      nt(() => {
        m(H, "x", l(o) - l(a)), m(H, "y", l(s) - l(u)), m(H, "width", e.node.size.width), m(H, "height", e.node.size.height), m(H, "fill", l(h)), m(H, "stroke", l(v)), m(H, "stroke-width", l(p)), m(H, "stroke-dasharray", l(E) || void 0);
      }), W(F, H);
    }, I = (F) => {
      var H = ge(), et = At(H);
      {
        var $ = (_t) => {
          var at = L0();
          nt(() => {
            m(at, "x", l(o) - l(a)), m(at, "y", l(s) - l(u)), m(at, "width", e.node.size.width), m(at, "height", e.node.size.height), m(at, "fill", l(h)), m(at, "stroke", l(v)), m(at, "stroke-width", l(p)), m(at, "stroke-dasharray", l(E) || void 0);
          }), W(_t, at);
        }, Et = (_t) => {
          var at = ge(), ce = At(at);
          {
            var fa = (an) => {
              var ee = O0();
              nt(
                (Wr) => {
                  m(ee, "cx", l(o)), m(ee, "cy", l(s)), m(ee, "r", Wr), m(ee, "fill", l(h)), m(ee, "stroke", l(v)), m(ee, "stroke-width", l(p));
                },
                [() => Math.min(l(a), l(u))]
              ), W(an, ee);
            }, ca = (an) => {
              var ee = ge(), Wr = At(ee);
              {
                var ha = (ln) => {
                  var Ne = D0();
                  nt(() => {
                    m(Ne, "points", `${l(o) ?? ""},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) ?? ""},${l(s) + l(u)} ${l(o) - l(a)},${l(s) ?? ""}`), m(Ne, "fill", l(h)), m(Ne, "stroke", l(v)), m(Ne, "stroke-width", l(p));
                  }), W(ln, Ne);
                }, da = (ln) => {
                  var Ne = ge(), ga = At(Ne);
                  {
                    var va = (un) => {
                      const Ye = /* @__PURE__ */ O(() => l(a) * 0.866);
                      var He = Y0();
                      nt(() => {
                        m(He, "points", `${l(o) - l(a)},${l(s) ?? ""} ${l(o) - l(Ye)},${l(s) - l(u)} ${l(o) + l(Ye)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) + l(Ye)},${l(s) + l(u)} ${l(o) - l(Ye)},${l(s) + l(u)}`), m(He, "fill", l(h)), m(He, "stroke", l(v)), m(He, "stroke-width", l(p));
                      }), W(un, He);
                    }, ma = (un) => {
                      var Ye = ge(), He = At(Ye);
                      {
                        var pa = (fn) => {
                          const Rt = /* @__PURE__ */ O(() => e.node.size.height * 0.15);
                          var ur = H0(), ne = ft(ur), Ae = Q(ne), St = Q(Ae), st = Q(St), he = Q(st);
                          nt(() => {
                            m(ne, "cx", l(o)), m(ne, "cy", l(s) + l(u) - l(Rt)), m(ne, "rx", l(a)), m(ne, "ry", l(Rt)), m(ne, "fill", l(h)), m(ne, "stroke", l(v)), m(ne, "stroke-width", l(p)), m(Ae, "x", l(o) - l(a)), m(Ae, "y", l(s) - l(u) + l(Rt)), m(Ae, "width", e.node.size.width), m(Ae, "height", e.node.size.height - l(Rt) * 2), m(Ae, "fill", l(h)), m(St, "x1", l(o) - l(a)), m(St, "y1", l(s) - l(u) + l(Rt)), m(St, "x2", l(o) - l(a)), m(St, "y2", l(s) + l(u) - l(Rt)), m(St, "stroke", l(v)), m(St, "stroke-width", l(p)), m(st, "x1", l(o) + l(a)), m(st, "y1", l(s) - l(u) + l(Rt)), m(st, "x2", l(o) + l(a)), m(st, "y2", l(s) + l(u) - l(Rt)), m(st, "stroke", l(v)), m(st, "stroke-width", l(p)), m(he, "cx", l(o)), m(he, "cy", l(s) - l(u) + l(Rt)), m(he, "rx", l(a)), m(he, "ry", l(Rt)), m(he, "fill", l(h)), m(he, "stroke", l(v)), m(he, "stroke-width", l(p));
                          }), W(fn, ur);
                        }, _a = (fn) => {
                          var Rt = ge(), ur = At(Rt);
                          {
                            var ne = (St) => {
                              var st = B0();
                              nt(() => {
                                m(st, "x", l(o) - l(a)), m(st, "y", l(s) - l(u)), m(st, "width", e.node.size.width), m(st, "height", e.node.size.height), m(st, "rx", l(u)), m(st, "ry", l(u)), m(st, "fill", l(h)), m(st, "stroke", l(v)), m(st, "stroke-width", l(p));
                              }), W(St, st);
                            }, Ae = (St) => {
                              var st = ge(), he = At(st);
                              {
                                var ya = (cn) => {
                                  const Kt = /* @__PURE__ */ O(() => e.node.size.width * 0.15);
                                  var Ln = V0();
                                  nt(() => {
                                    m(Ln, "points", `${l(o) - l(a) + l(Kt)},${l(s) - l(u)} ${l(o) + l(a) - l(Kt)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) + l(u)} ${l(o) - l(a)},${l(s) + l(u)}`), m(Ln, "fill", l(h)), m(Ln, "stroke", l(v)), m(Ln, "stroke-width", l(p));
                                  }), W(cn, Ln);
                                }, wa = (cn) => {
                                  var Kt = X0();
                                  nt(() => {
                                    m(Kt, "x", l(o) - l(a)), m(Kt, "y", l(s) - l(u)), m(Kt, "width", e.node.size.width), m(Kt, "height", e.node.size.height), m(Kt, "fill", l(h)), m(Kt, "stroke", l(v)), m(Kt, "stroke-width", l(p));
                                  }), W(cn, Kt);
                                };
                                ut(
                                  he,
                                  (cn) => {
                                    l(f) === "trapezoid" ? cn(ya) : cn(wa, !1);
                                  },
                                  !0
                                );
                              }
                              W(St, st);
                            };
                            ut(
                              ur,
                              (St) => {
                                l(f) === "stadium" ? St(ne) : St(Ae, !1);
                              },
                              !0
                            );
                          }
                          W(fn, Rt);
                        };
                        ut(
                          He,
                          (fn) => {
                            l(f) === "cylinder" ? fn(pa) : fn(_a, !1);
                          },
                          !0
                        );
                      }
                      W(un, Ye);
                    };
                    ut(
                      ga,
                      (un) => {
                        l(f) === "hexagon" ? un(va) : un(ma, !1);
                      },
                      !0
                    );
                  }
                  W(ln, Ne);
                };
                ut(
                  Wr,
                  (ln) => {
                    l(f) === "diamond" ? ln(ha) : ln(da, !1);
                  },
                  !0
                );
              }
              W(an, ee);
            };
            ut(
              ce,
              (an) => {
                l(f) === "circle" ? an(fa) : an(ca, !1);
              },
              !0
            );
          }
          W(_t, at);
        };
        ut(
          et,
          (_t) => {
            l(f) === "rect" ? _t($) : _t(Et, !1);
          },
          !0
        );
      }
      W(F, H);
    };
    ut(_, (F) => {
      l(f) === "rounded" ? F(w) : F(I, !1);
    });
  }
  var R = Q(b), L = ft(R);
  {
    var X = (F) => {
      var H = q0(), et = ft(H), $ = ft(et);
      Ss($, () => l(T), !0), nt(() => {
        m(H, "transform", `translate(${l(o) - S / 2}, ${l(Y) ?? ""})`), m(et, "width", S), m(et, "height", S);
      }), W(F, H);
    };
    ut(L, (F) => {
      l(T) && F(X);
    });
  }
  var U = Q(L);
  Be(U, 17, () => l(A), Es, (F, H, et) => {
    var $ = U0(), Et = ft($);
    nt(() => {
      m($, "x", l(o)), m($, "y", l(z) + et * Zr), Bl($, 0, Dl(l(H).className)), Zn(Et, l(H).text);
    }), W(F, $);
  });
  var ot = Q(R);
  {
    var it = (F) => {
      const H = /* @__PURE__ */ O(() => 10);
      var et = G0(), $ = At(et);
      m($, "height", l(H)), $.__pointermove = (ce) => B("top", ce), $.__pointerdown = M;
      var Et = Q($);
      m(Et, "height", l(H)), Et.__pointermove = (ce) => B("bottom", ce), Et.__pointerdown = M;
      var _t = Q(Et);
      m(_t, "width", l(H)), _t.__pointermove = (ce) => B("left", ce), _t.__pointerdown = M;
      var at = Q(_t);
      m(at, "width", l(H)), at.__pointermove = (ce) => B("right", ce), at.__pointerdown = M, nt(() => {
        m($, "x", l(o) - l(a)), m($, "y", l(s) - l(u) - l(H) / 2), m($, "width", e.node.size.width), m(Et, "x", l(o) - l(a)), m(Et, "y", l(s) + l(u) - l(H) / 2), m(Et, "width", e.node.size.width), m(_t, "x", l(o) - l(a) - l(H) / 2), m(_t, "y", l(s) - l(u)), m(_t, "height", e.node.size.height), m(at, "x", l(o) + l(a) - l(H) / 2), m(at, "y", l(s) - l(u)), m(at, "height", e.node.size.height);
      }), Ie("pointerleave", $, () => {
        V(C, null);
      }), Ie("pointerleave", Et, () => {
        V(C, null);
      }), Ie("pointerleave", _t, () => {
        V(C, null);
      }), Ie("pointerleave", at, () => {
        V(C, null);
      }), W(F, et);
    };
    ut(ot, (F) => {
      i() && l(c) && F(it);
    });
  }
  var pt = Q(ot);
  {
    var Wt = (F) => {
      var H = W0(), et = At(H), $ = Q(et);
      nt(() => {
        m(et, "cx", l(C).x), m(et, "cy", l(C).y), m($, "x", l(C).x), m($, "y", l(C).y);
      }), W(F, H);
    };
    ut(pt, (F) => {
      l(C) && F(Wt);
    });
  }
  nt(() => {
    m(g, "data-id", e.node.id), m(g, "data-device-type", e.node.node.type ?? ""), m(g, "filter", `url(#${n() ?? ""})`);
  }), Ie("pointerenter", g, () => {
    V(c, !0);
  }), Ie("pointerleave", g, () => {
    V(c, !1);
  }), W(t, g), sn();
}
Vr(["contextmenu", "pointermove", "pointerdown"]);
var J0 = /* @__PURE__ */ tt('<rect fill="transparent"></rect>'), Q0 = /* @__PURE__ */ tt('<rect class="port-label-bg" rx="2" pointer-events="none"></rect><text class="port-label" font-size="9" pointer-events="none"> </text>', 1), j0 = /* @__PURE__ */ tt('<g class="port"><!><rect class="port-box" rx="2" pointer-events="none"></rect><!></g>');
function $0(t, e) {
  on(e, !0);
  let n = wt(e, "hideLabel", 3, !1), r = wt(e, "selected", 3, !1), i = wt(e, "interactive", 3, !1), o = wt(e, "linked", 3, !1);
  const s = /* @__PURE__ */ O(() => e.port.absolutePosition.x), a = /* @__PURE__ */ O(() => e.port.absolutePosition.y), u = /* @__PURE__ */ O(() => e.port.size.width), f = /* @__PURE__ */ O(() => e.port.size.height), c = /* @__PURE__ */ O(() => E0(e.port)), d = /* @__PURE__ */ O(() => e.port.label.length * Ql + 4), h = 12, v = /* @__PURE__ */ O(() => () => l(c).textAnchor === "middle" ? l(c).x - l(d) / 2 : l(c).textAnchor === "end" ? l(c).x - l(d) + 2 : l(c).x - 2), p = /* @__PURE__ */ O(() => l(c).y - h + 3);
  let E = /* @__PURE__ */ lt(!1);
  function T(z) {
    var C, B;
    !i() || z.button !== 0 || (z.stopPropagation(), z.preventDefault(), o() ? (C = e.onselect) == null || C.call(e, e.port.id) : (B = e.onlinkstart) == null || B.call(e, e.port.id, l(s), l(a)));
  }
  function S(z) {
    var C;
    i() && (z.stopPropagation(), (C = e.onlinkend) == null || C.call(e, e.port.id));
  }
  function D(z) {
    var C;
    i() && (z.preventDefault(), z.stopPropagation(), (C = e.oncontextmenu) == null || C.call(e, e.port.id, z));
  }
  var A = j0();
  A.__contextmenu = D;
  var x = ft(A);
  {
    var P = (z) => {
      var C = J0();
      m(C, "width", 24), m(C, "height", 24), C.__pointerdown = T, C.__pointerup = S, nt(() => {
        m(C, "x", l(s) - 12), m(C, "y", l(a) - 12), Ri(C, `pointer-events: fill; cursor: ${o() ? "pointer" : "crosshair"};`);
      }), W(z, C);
    };
    ut(x, (z) => {
      i() && z(P);
    });
  }
  var k = Q(x), N = Q(k);
  {
    var Y = (z) => {
      var C = Q0(), B = At(C);
      m(B, "height", h);
      var M = Q(B), q = ft(M);
      nt(
        (g) => {
          m(B, "x", g), m(B, "y", l(p)), m(B, "width", l(d)), m(B, "fill", e.colors.portLabelBg), m(M, "x", l(c).x), m(M, "y", l(c).y), m(M, "text-anchor", l(c).textAnchor), m(M, "fill", e.colors.portLabelColor), Zn(q, e.port.label);
        },
        [() => l(v)()]
      ), W(z, C);
    };
    ut(N, (z) => {
      n() || z(Y);
    });
  }
  nt(() => {
    m(A, "data-port", e.port.id), m(A, "data-port-device", e.port.nodeId), m(k, "x", l(s) - l(u) / 2 - (r() || i() && l(E) ? 2 : 0)), m(k, "y", l(a) - l(f) / 2 - (r() || i() && l(E) ? 2 : 0)), m(k, "width", l(u) + (r() || i() && l(E) ? 4 : 0)), m(k, "height", l(f) + (r() || i() && l(E) ? 4 : 0)), m(k, "fill", r() ? e.colors.selection : i() && l(E) ? "#3b82f6" : e.colors.portFill), m(k, "stroke", r() ? e.colors.selection : i() && l(E) ? "#2563eb" : e.colors.portStroke), m(k, "stroke-width", r() || i() && l(E) ? 2 : 1);
  }), Ie("pointerenter", A, () => {
    V(E, !0);
  }), Ie("pointerleave", A, () => {
    V(E, !1);
  }), W(t, A), sn();
}
Vr(["contextmenu", "pointerdown", "pointerup"]);
var tg = /* @__PURE__ */ tt('<g class="subgraph"><rect rx="12" ry="12"></rect><rect fill="transparent"></rect><text class="subgraph-label" text-anchor="start" pointer-events="none"> </text></g>');
function eg(t, e) {
  on(e, !0);
  let n = wt(e, "interactive", 3, !1);
  const r = /* @__PURE__ */ O(() => e.subgraph.subgraph.style ?? {}), i = [
    "surface-1",
    "surface-2",
    "surface-3",
    "accent-blue",
    "accent-green",
    "accent-red",
    "accent-amber",
    "accent-purple"
  ], o = /* @__PURE__ */ O(() => () => {
    const v = l(r).fill, p = l(r).stroke;
    if (v && i.includes(v) && e.theme) {
      const E = e.theme.colors.surfaces[v];
      return {
        fill: E.fill,
        stroke: p ?? E.stroke,
        text: E.text
      };
    }
    return {
      fill: v ?? e.colors.subgraphFill,
      stroke: p ?? e.colors.subgraphStroke,
      text: e.colors.subgraphText
    };
  }), s = /* @__PURE__ */ O(() => l(r).strokeWidth ?? 3), a = /* @__PURE__ */ O(() => l(r).strokeDasharray ?? "");
  var u = tg(), f = ft(u), c = Q(f);
  m(c, "height", 28);
  var d = Q(c), h = ft(d);
  nt(
    (v, p, E) => {
      m(u, "data-id", e.subgraph.id), m(f, "x", e.subgraph.bounds.x), m(f, "y", e.subgraph.bounds.y), m(f, "width", e.subgraph.bounds.width), m(f, "height", e.subgraph.bounds.height), m(f, "fill", v), m(f, "stroke", p), m(f, "stroke-width", l(s)), m(f, "stroke-dasharray", l(a) || void 0), m(c, "data-sg-drag", e.subgraph.id), m(c, "x", e.subgraph.bounds.x), m(c, "y", e.subgraph.bounds.y), m(c, "width", e.subgraph.bounds.width), m(c, "pointer-events", n() ? "fill" : "none"), m(d, "x", e.subgraph.bounds.x + 10), m(d, "y", e.subgraph.bounds.y + 20), m(d, "fill", E), Zn(h, e.subgraph.subgraph.label);
    },
    [
      () => l(o)().fill,
      () => l(o)().stroke,
      () => l(o)().text
    ]
  ), W(t, u), sn();
}
var ng = /* @__PURE__ */ tt('<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5"></path></pattern>'), rg = /* @__PURE__ */ tt('<svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7"></polygon></marker><filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"></feDropShadow></filter><!></defs><!><g class="viewport"><rect class="canvas-bg" x="-99999" y="-99999" width="199998" height="199998"></rect><!><!><!><!><!></g></svg>');
function ig(t, e) {
  on(e, !0);
  let n = wt(e, "interactive", 3, !1), r = wt(e, "selection", 19, () => /* @__PURE__ */ new Set()), i = wt(e, "linkedPorts", 19, () => /* @__PURE__ */ new Set()), o = wt(e, "linkPreview", 3, null), s = wt(e, "svgEl", 15, null);
  const a = /* @__PURE__ */ O(() => `${e.bounds.x - 50} ${e.bounds.y - 50} ${e.bounds.width + 100} ${e.bounds.height + 100}`), u = /* @__PURE__ */ O(() => [...e.nodes.values()]), f = /* @__PURE__ */ O(() => [...e.edges.values()]), c = /* @__PURE__ */ O(() => [...e.subgraphs.values()]), d = /* @__PURE__ */ O(() => {
    const M = /* @__PURE__ */ new Map();
    for (const q of e.ports.values()) {
      const g = M.get(q.nodeId);
      g ? g.push(q) : M.set(q.nodeId, [q]);
    }
    return M;
  });
  let h = /* @__PURE__ */ lt(void 0);
  Ar(() => {
    if (!s() || !n() || !l(h)) return;
    const M = It(s()), q = b0().scaleExtent([0.1, 5]).filter((g) => g.type === "wheel" ? !0 : g.type === "mousedown" || g.type === "pointerdown" ? g.button === 1 || g.altKey : !1).on("zoom", (g) => {
      l(h) && l(h).setAttribute("transform", g.transform.toString());
    });
    return M.call(q), M.on("contextmenu.zoom", null), () => {
      M.on(".zoom", null);
    };
  }), Ar(() => {
    if (!s() || !n()) return;
    const M = _o().filter((g) => {
      const b = g.target;
      return b.closest(".port") || b.closest("[data-droplet]") ? !1 : g.button === 0;
    }).on("drag", function(g) {
      var w;
      const b = this.getAttribute("data-id");
      if (!b) return;
      const _ = e.nodes.get(b);
      _ && ((w = e.onnodedragmove) == null || w.call(e, b, _.position.x + g.dx, _.position.y + g.dy));
    });
    It(s()).selectAll(".node[data-id]").call(M);
    const q = _o().on("drag", function(g) {
      var w;
      const b = this.getAttribute("data-sg-drag");
      if (!b) return;
      const _ = e.subgraphs.get(b);
      _ && ((w = e.onsubgraphmove) == null || w.call(e, b, _.bounds.x + g.dx, _.bounds.y + g.dy));
    });
    return It(s()).selectAll("[data-sg-drag]").call(q), () => {
      It(s()).selectAll(".node[data-id]").on(".drag", null), It(s()).selectAll("[data-sg-drag]").on(".drag", null);
    };
  });
  var v = rg(), p = ft(v), E = ft(p), T = ft(E), S = Q(E, 2);
  {
    var D = (M) => {
      var q = ng();
      W(M, q);
    };
    ut(S, (M) => {
      n() && M(D);
    });
  }
  var A = Q(p);
  Ss(
    A,
    () => `<style>
    .node-label { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; fill: ${e.colors.nodeText}; }
    .node-label-bold { font-weight: 700; }
    .node-label-secondary { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; font-weight: 400; fill: ${e.colors.nodeTextSecondary}; }
    .node-icon { color: ${e.colors.nodeTextSecondary}; }
    .subgraph-label { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .link-label { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; fill: ${e.colors.textSecondary}; }
    .node[data-id] { cursor: ${n() ? "grab" : "default"}; }
    .node[data-id]:active { cursor: grabbing; }
    [data-sg-drag] { cursor: ${n() ? "grab" : "default"}; }
    [data-sg-drag]:active { cursor: grabbing; }
  </style>`,
    !0
  );
  var x = Q(A), P = ft(x);
  P.__click = () => {
    var M;
    return (M = e.onbackgroundclick) == null ? void 0 : M.call(e);
  };
  var k = Q(P);
  Be(k, 17, () => l(c), (M) => M.id, (M, q) => {
    eg(M, {
      get subgraph() {
        return l(q);
      },
      get colors() {
        return e.colors;
      },
      get theme() {
        return e.theme;
      },
      get interactive() {
        return n();
      }
    });
  });
  var N = Q(k);
  Be(N, 17, () => l(f), (M) => M.id, (M, q) => {
    {
      let g = /* @__PURE__ */ O(() => r().has(l(q).id));
      z0(M, {
        get edge() {
          return l(q);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(g);
        },
        get interactive() {
          return n();
        },
        get onselect() {
          return e.onedgeselect;
        },
        oncontextmenu: (b, _) => {
          var w;
          return (w = e.oncontextmenu) == null ? void 0 : w.call(e, b, "edge", _);
        }
      });
    }
  });
  var Y = Q(N);
  Be(Y, 17, () => l(u), (M) => M.id, (M, q) => {
    {
      let g = /* @__PURE__ */ O(() => r().has(l(q).id));
      Z0(M, {
        get node() {
          return l(q);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(g);
        },
        get interactive() {
          return n();
        },
        get onaddport() {
          return e.onaddport;
        },
        oncontextmenu: (b, _) => {
          var w;
          return (w = e.oncontextmenu) == null ? void 0 : w.call(e, b, "node", _);
        }
      });
    }
  });
  var z = Q(Y);
  Be(z, 17, () => l(u), (M) => M.id, (M, q) => {
    var g = ge(), b = At(g);
    Be(b, 17, () => l(d).get(l(q).id) ?? [], (_) => _.id, (_, w) => {
      {
        let I = /* @__PURE__ */ O(() => r().has(l(w).id)), R = /* @__PURE__ */ O(() => i().has(l(w).id));
        $0(_, {
          get port() {
            return l(w);
          },
          get colors() {
            return e.colors;
          },
          get selected() {
            return l(I);
          },
          get interactive() {
            return n();
          },
          get linked() {
            return l(R);
          },
          get onlinkstart() {
            return e.onlinkstart;
          },
          get onlinkend() {
            return e.onlinkend;
          },
          get onselect() {
            return e.onportselect;
          },
          oncontextmenu: (L, X) => {
            var U;
            return (U = e.oncontextmenu) == null ? void 0 : U.call(e, L, "port", X);
          }
        });
      }
    }), W(M, g);
  });
  var C = Q(z);
  {
    var B = (M) => {
      R0(M, {
        get fromX() {
          return o().fromX;
        },
        get fromY() {
          return o().fromY;
        },
        get toX() {
          return o().toX;
        },
        get toY() {
          return o().toY;
        }
      });
    };
    ut(C, (M) => {
      o() && M(B);
    });
  }
  ro(x, (M) => V(h, M), () => l(h)), ro(v, (M) => s(M), () => s()), nt(() => {
    m(v, "viewBox", l(a)), Ri(v, `width: 100%; height: 100%; user-select: none; background: ${n() ? "#f8fafc" : "transparent"};`), m(T, "fill", e.colors.linkStroke), m(P, "fill", n() ? "url(#grid)" : "transparent"), m(P, "pointer-events", n() ? "fill" : "none");
  }), W(t, v), sn();
}
Vr(["click"]);
var og = /* @__PURE__ */ Il('<div style="width: 100%; height: 100%; outline: none;"><!></div>');
function sg(t, e) {
  var q;
  on(e, !0);
  let n = wt(e, "mode", 3, "view");
  const r = /* @__PURE__ */ O(() => Uf(e.theme)), i = /* @__PURE__ */ O(() => n() === "edit");
  let o = /* @__PURE__ */ lt(Ot(new Map(e.layout.nodes))), s = /* @__PURE__ */ lt(Ot(new Map(e.layout.ports))), a = /* @__PURE__ */ lt(Ot(new Map(e.layout.edges))), u = /* @__PURE__ */ lt(Ot(new Map(e.layout.subgraphs))), f = Ot(e.layout.bounds), c = /* @__PURE__ */ lt(Ot((q = e.graph) != null && q.links ? [...e.graph.links] : [])), d = /* @__PURE__ */ lt(Ot(/* @__PURE__ */ new Set())), h = /* @__PURE__ */ lt(null), v = /* @__PURE__ */ lt(null);
  const p = /* @__PURE__ */ O(() => {
    const g = /* @__PURE__ */ new Set();
    for (const b of l(a).values())
      b.fromPortId && g.add(b.fromPortId), b.toPortId && g.add(b.toPortId);
    return g;
  });
  Ar(() => {
    if (!l(i) || !l(v)) return;
    const g = l(v);
    return g.addEventListener("keydown", C), () => g.removeEventListener("keydown", C);
  }), Ar(() => {
    var g, b;
    if (l(d).size === 0)
      (g = e.onselect) == null || g.call(e, null, null);
    else {
      const _ = [...l(d)][0] ?? null;
      if (!_) return;
      let w = "node";
      l(a).has(_) ? w = "edge" : l(s).has(_) && (w = "port"), (b = e.onselect) == null || b.call(e, _, w);
    }
  });
  async function E(g, b, _) {
    const w = await _u(
      g,
      b,
      _,
      {
        nodes: l(o),
        ports: l(s),
        subgraphs: l(u)
      },
      l(c)
    );
    w && (V(o, w.nodes, !0), V(s, w.ports, !0), V(a, w.edges, !0), w.subgraphs && V(u, w.subgraphs, !0));
  }
  async function T(g, b) {
    const _ = Su(g, b, l(o), l(s), l(c));
    _ && (V(o, _.nodes, !0), V(s, _.ports, !0), V(a, await Gn(_.nodes, _.ports, l(c)), !0));
  }
  async function S(g, b, _) {
    const w = await yu(
      g,
      b,
      _,
      {
        nodes: l(o),
        ports: l(s),
        subgraphs: l(u)
      },
      l(c)
    );
    w && (V(o, w.nodes, !0), V(s, w.ports, !0), V(a, w.edges, !0), V(u, w.subgraphs, !0));
  }
  let D = null;
  function A(g, b, _) {
    var L, X;
    V(h, { fromPortId: g, fromX: b, fromY: _, toX: b, toY: _ }, !0);
    function w(U) {
      if (!l(h) || !l(v)) return;
      const it = (l(v).querySelector(".viewport") ?? l(v)).getScreenCTM();
      if (!it) return;
      const pt = new DOMPoint(U.clientX, U.clientY).matrixTransform(it.inverse());
      V(h, { ...l(h), toX: pt.x, toY: pt.y }, !0);
    }
    function I(U) {
      U.target.closest(".port") || R();
    }
    function R() {
      var U, ot;
      (U = l(v)) == null || U.removeEventListener("pointermove", w), (ot = l(v)) == null || ot.removeEventListener("pointerup", I), V(h, null), D = null;
    }
    D = R, (L = l(v)) == null || L.addEventListener("pointermove", w), (X = l(v)) == null || X.addEventListener("pointerup", I);
  }
  function x(g) {
    if (!l(h)) return;
    const b = l(h).fromPortId;
    if (D == null || D(), b === g) return;
    const _ = l(s).get(b), w = l(s).get(g);
    _ && w && _.nodeId === w.nodeId || P(b, g);
  }
  async function P(g, b) {
    var it;
    const _ = g.split(":"), w = b.split(":");
    let I = _[0] ?? "", R = _.slice(1).join(":"), L = w[0] ?? "", X = w.slice(1).join(":");
    if (!I || !R || !L || !X || wu(l(c), I, R, L, X)) return;
    const U = l(o).get(I), ot = l(o).get(L);
    U && ot && U.position.y > ot.position.y && ([I, L] = [L, I], [R, X] = [X, R]), V(
      c,
      [
        ...l(c),
        {
          id: `link-${Date.now()}`,
          from: { node: I, port: R },
          to: { node: L, port: X }
        }
      ],
      !0
    ), V(a, await Gn(l(o), l(s), l(c)), !0), (it = e.onchange) == null || it.call(e, l(c));
  }
  function k(g) {
    V(d, /* @__PURE__ */ new Set([g]), !0);
  }
  function N(g) {
    V(d, /* @__PURE__ */ new Set([g]), !0);
  }
  function Y() {
    V(d, /* @__PURE__ */ new Set(), !0);
  }
  function z(g, b, _) {
    var w;
    V(d, /* @__PURE__ */ new Set([g]), !0), (w = e.oncontextmenu) == null || w.call(e, g, b, _.clientX, _.clientY);
  }
  function C(g) {
    var b, _;
    if (g.key === "Delete" || g.key === "Backspace") {
      for (const w of l(d))
        if (l(a).has(w)) {
          const I = l(a).get(w);
          (b = I == null ? void 0 : I.link) != null && b.id && V(c, l(c).filter((R) => {
            var L;
            return R.id !== ((L = I.link) == null ? void 0 : L.id);
          }), !0);
        } else if (l(s).has(w)) {
          const I = Nu(w, l(o), l(s), l(c));
          I && (V(o, I.nodes, !0), V(s, I.ports, !0), V(c, I.links, !0));
        }
      Gn(l(o), l(s), l(c)).then((w) => {
        V(a, w, !0);
      }), V(d, /* @__PURE__ */ new Set(), !0), (_ = e.onchange) == null || _.call(e, l(c));
    }
    g.key === "Escape" && (V(d, /* @__PURE__ */ new Set(), !0), V(h, null));
  }
  var B = og(), M = ft(B);
  ig(M, {
    get nodes() {
      return l(o);
    },
    get ports() {
      return l(s);
    },
    get edges() {
      return l(a);
    },
    get subgraphs() {
      return l(u);
    },
    get bounds() {
      return f;
    },
    get colors() {
      return l(r);
    },
    get theme() {
      return e.theme;
    },
    get interactive() {
      return l(i);
    },
    get selection() {
      return l(d);
    },
    get linkedPorts() {
      return l(p);
    },
    get linkPreview() {
      return l(h);
    },
    onnodedragmove: E,
    onaddport: T,
    onlinkstart: A,
    onlinkend: x,
    onedgeselect: k,
    onportselect: N,
    onsubgraphmove: S,
    oncontextmenu: z,
    onbackgroundclick: Y,
    get svgEl() {
      return l(v);
    },
    set svgEl(g) {
      V(v, g, !0);
    }
  }), W(t, B), sn();
}
class ag extends HTMLElement {
  constructor() {
    super();
    dt(this, "_layout", null);
    dt(this, "_graph", null);
    dt(this, "_theme");
    dt(this, "_mode", "view");
    dt(this, "_viewBox");
    dt(this, "_instance", null);
    this.attachShadow({ mode: "open" });
  }
  set layout(n) {
    this._layout = n, this._tryRender();
  }
  get layout() {
    return this._layout;
  }
  set graph(n) {
    this._graph = n, this._tryRender();
  }
  get graph() {
    return this._graph;
  }
  set theme(n) {
    this._theme = n, this._tryRender();
  }
  get theme() {
    return this._theme;
  }
  set mode(n) {
    this._mode = n, this._tryRender();
  }
  get mode() {
    return this._mode;
  }
  set viewBox(n) {
    this._viewBox = n, this._tryRender();
  }
  get viewBox() {
    return this._viewBox;
  }
  get svgElement() {
    var n;
    return ((n = this.shadowRoot) == null ? void 0 : n.querySelector("svg")) ?? null;
  }
  connectedCallback() {
    this._tryRender();
  }
  disconnectedCallback() {
    this._instance && ($i(this._instance), this._instance = null);
  }
  _tryRender() {
    !this.shadowRoot || !this._layout || (this._instance && ($i(this._instance), this._instance = null), this._instance = Tl(sg, {
      target: this.shadowRoot,
      props: {
        layout: this._layout,
        graph: this._graph ?? void 0,
        theme: this._theme,
        mode: this._mode,
        viewBox: this._viewBox,
        onselect: (n, r) => {
          this.dispatchEvent(
            new CustomEvent("shumoku-select", {
              detail: { id: n, type: r },
              bubbles: !0,
              composed: !0
            })
          );
        },
        onchange: (n) => {
          this.dispatchEvent(
            new CustomEvent("shumoku-change", { detail: { links: n }, bubbles: !0, composed: !0 })
          );
        },
        oncontextmenu: (n, r, i, o) => {
          this.dispatchEvent(
            new CustomEvent("shumoku-contextmenu", {
              detail: { id: n, type: r, screenX: i, screenY: o },
              bubbles: !0,
              composed: !0
            })
          );
        }
      }
    }));
  }
}
typeof window < "u" && (customElements.get("shumoku-renderer") || customElements.define("shumoku-renderer", ag));
export {
  ag as ShumokuRendererElement
};
