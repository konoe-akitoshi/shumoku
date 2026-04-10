var Sa = Object.defineProperty;
var Wi = (t) => {
  throw TypeError(t);
};
var Na = (t, e, n) => e in t ? Sa(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var vt = (t, e, n) => Na(t, typeof e != "symbol" ? e + "" : e, n), Zr = (t, e, n) => e.has(t) || Wi("Cannot " + n);
var y = (t, e, n) => (Zr(t, e, "read from private field"), n ? n.call(t) : e.get(t)), Z = (t, e, n) => e.has(t) ? Wi("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, n), G = (t, e, n, r) => (Zr(t, e, "write to private field"), r ? r.call(t, n) : e.set(t, n), n), xt = (t, e, n) => (Zr(t, e, "access private method"), n);
var Yo = Array.isArray, Ma = Array.prototype.indexOf, Br = Array.from, Aa = Object.defineProperty, _n = Object.getOwnPropertyDescriptor, Ia = Object.getOwnPropertyDescriptors, Pa = Object.prototype, za = Array.prototype, Ho = Object.getPrototypeOf, Ki = Object.isExtensible;
function Ta(t) {
  for (var e = 0; e < t.length; e++)
    t[e]();
}
function Bo() {
  var t, e, n = new Promise((r, i) => {
    t = r, e = i;
  });
  return { promise: n, resolve: t, reject: e };
}
const yt = 2, Ar = 4, Vr = 8, Vo = 1 << 24, be = 16, ke = 32, on = 64, Ei = 128, Gt = 512, kt = 1024, Ft = 2048, Ee = 4096, Yt = 8192, ye = 16384, Si = 32768, Pn = 65536, Zi = 1 << 17, Xo = 1 << 18, Ln = 1 << 19, Ca = 1 << 20, Ce = 1 << 25, $e = 32768, ni = 1 << 21, Ni = 1 << 22, Re = 1 << 23, Un = Symbol("$state"), Ra = Symbol("legacy props"), Fa = Symbol(""), vn = new class extends Error {
  constructor() {
    super(...arguments);
    vt(this, "name", "StaleReactionError");
    vt(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function La() {
  throw new Error("https://svelte.dev/e/async_derived_orphan");
}
function Oa(t) {
  throw new Error("https://svelte.dev/e/effect_in_teardown");
}
function Da() {
  throw new Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function Ya(t) {
  throw new Error("https://svelte.dev/e/effect_orphan");
}
function Ha() {
  throw new Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Ba(t) {
  throw new Error("https://svelte.dev/e/props_invalid_value");
}
function Va() {
  throw new Error("https://svelte.dev/e/state_descriptors_fixed");
}
function Xa() {
  throw new Error("https://svelte.dev/e/state_prototype_fixed");
}
function qa() {
  throw new Error("https://svelte.dev/e/state_unsafe_mutation");
}
function Ua() {
  throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
const Ga = 1, Wa = 2, Ka = 16, Za = 1, Ja = 4, Qa = 8, ja = 16, $a = 1, tl = 2, mt = Symbol(), el = "http://www.w3.org/1999/xhtml";
function nl() {
  console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
function qo(t) {
  return t === this.v;
}
function rl(t, e) {
  return t != t ? e == e : t !== e || t !== null && typeof t == "object" || typeof t == "function";
}
function Uo(t) {
  return !rl(t, this.v);
}
let Wt = null;
function zn(t) {
  Wt = t;
}
function sn(t, e = !1, n) {
  Wt = {
    p: Wt,
    i: !1,
    c: null,
    e: null,
    s: t,
    x: null,
    l: null
  };
}
function an(t) {
  var e = (
    /** @type {ComponentContext} */
    Wt
  ), n = e.e;
  if (n !== null) {
    e.e = null;
    for (var r of n)
      us(r);
  }
  return e.i = !0, Wt = e.p, /** @type {T} */
  {};
}
function Go() {
  return !0;
}
let mn = [];
function il() {
  var t = mn;
  mn = [], Ta(t);
}
function Fe(t) {
  if (mn.length === 0) {
    var e = mn;
    queueMicrotask(() => {
      e === mn && il();
    });
  }
  mn.push(t);
}
function Wo(t) {
  var e = et;
  if (e === null)
    return K.f |= Re, t;
  if ((e.f & Si) === 0) {
    if ((e.f & Ei) === 0)
      throw t;
    e.b.error(t);
  } else
    Tn(t, e);
}
function Tn(t, e) {
  for (; e !== null; ) {
    if ((e.f & Ei) !== 0)
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
const ol = -7169;
function gt(t, e) {
  t.f = t.f & ol | e;
}
function Mi(t) {
  (t.f & Gt) !== 0 || t.deps === null ? gt(t, kt) : gt(t, Ee);
}
function Ko(t) {
  if (t !== null)
    for (const e of t)
      (e.f & yt) === 0 || (e.f & $e) === 0 || (e.f ^= $e, Ko(
        /** @type {Derived} */
        e.deps
      ));
}
function Zo(t, e, n) {
  (t.f & Ft) !== 0 ? e.add(t) : (t.f & Ee) !== 0 && n.add(t), Ko(t.deps), gt(t, kt);
}
const hr = /* @__PURE__ */ new Set();
let it = null, _t = null, Jt = [], Ai = null, ri = !1;
var xn, bn, Ue, kn, rr, En, Sn, Nn, ue, ii, oi, Jo;
const Gi = class Gi {
  constructor() {
    Z(this, ue);
    vt(this, "committed", !1);
    /**
     * The current values of any sources that are updated in this batch
     * They keys of this map are identical to `this.#previous`
     * @type {Map<Source, any>}
     */
    vt(this, "current", /* @__PURE__ */ new Map());
    /**
     * The values of any sources that are updated in this batch _before_ those updates took place.
     * They keys of this map are identical to `this.#current`
     * @type {Map<Source, any>}
     */
    vt(this, "previous", /* @__PURE__ */ new Map());
    /**
     * When the batch is committed (and the DOM is updated), we need to remove old branches
     * and append new ones by calling the functions added inside (if/each/key/etc) blocks
     * @type {Set<() => void>}
     */
    Z(this, xn, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    Z(this, bn, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    Z(this, Ue, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    Z(this, kn, 0);
    /**
     * A deferred that resolves when the batch is committed, used with `settled()`
     * TODO replace with Promise.withResolvers once supported widely enough
     * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
     */
    Z(this, rr, null);
    /**
     * Deferred effects (which run after async work has completed) that are DIRTY
     * @type {Set<Effect>}
     */
    Z(this, En, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    Z(this, Sn, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    vt(this, "skipped_effects", /* @__PURE__ */ new Set());
    vt(this, "is_fork", !1);
    Z(this, Nn, !1);
  }
  is_deferred() {
    return this.is_fork || y(this, kn) > 0;
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
      xt(this, ue, ii).call(this, o, n, r);
    if (this.is_deferred())
      xt(this, ue, oi).call(this, r), xt(this, ue, oi).call(this, n);
    else {
      for (const o of y(this, xn)) o();
      y(this, xn).clear(), y(this, Ue) === 0 && xt(this, ue, Jo).call(this), it = null, Ji(r), Ji(n), (i = y(this, rr)) == null || i.resolve();
    }
    _t = null;
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} value
   */
  capture(e, n) {
    n !== mt && !this.previous.has(e) && this.previous.set(e, n), (e.f & Re) === 0 && (this.current.set(e, e.v), _t == null || _t.set(e, e.v));
  }
  activate() {
    it = this, this.apply();
  }
  deactivate() {
    it === this && (it = null, _t = null);
  }
  flush() {
    if (this.activate(), Jt.length > 0) {
      if (sl(), it !== null && it !== this)
        return;
    } else y(this, Ue) === 0 && this.process([]);
    this.deactivate();
  }
  discard() {
    for (const e of y(this, bn)) e(this);
    y(this, bn).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(e) {
    G(this, Ue, y(this, Ue) + 1), e && G(this, kn, y(this, kn) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(e) {
    G(this, Ue, y(this, Ue) - 1), e && G(this, kn, y(this, kn) - 1), !y(this, Nn) && (G(this, Nn, !0), Fe(() => {
      G(this, Nn, !1), this.is_deferred() ? Jt.length > 0 && this.flush() : this.revive();
    }));
  }
  revive() {
    for (const e of y(this, En))
      y(this, Sn).delete(e), gt(e, Ft), we(e);
    for (const e of y(this, Sn))
      gt(e, Ee), we(e);
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(e) {
    y(this, xn).add(e);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(e) {
    y(this, bn).add(e);
  }
  settled() {
    return (y(this, rr) ?? G(this, rr, Bo())).promise;
  }
  static ensure() {
    if (it === null) {
      const e = it = new Gi();
      hr.add(it), Fe(() => {
        it === e && e.flush();
      });
    }
    return it;
  }
  apply() {
  }
};
xn = new WeakMap(), bn = new WeakMap(), Ue = new WeakMap(), kn = new WeakMap(), rr = new WeakMap(), En = new WeakMap(), Sn = new WeakMap(), Nn = new WeakMap(), ue = new WeakSet(), /**
 * Traverse the effect tree, executing effects or stashing
 * them for later execution as appropriate
 * @param {Effect} root
 * @param {Effect[]} effects
 * @param {Effect[]} render_effects
 */
ii = function(e, n, r) {
  e.f ^= kt;
  for (var i = e.first, o = null; i !== null; ) {
    var s = i.f, a = (s & (ke | on)) !== 0, u = a && (s & kt) !== 0, f = u || (s & Yt) !== 0 || this.skipped_effects.has(i);
    if (!f && i.fn !== null) {
      a ? i.f ^= kt : o !== null && (s & (Ar | Vr | Vo)) !== 0 ? o.b.defer_effect(i) : (s & Ar) !== 0 ? n.push(i) : ar(i) && ((s & be) !== 0 && y(this, En).add(i), Kn(i));
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
oi = function(e) {
  for (var n = 0; n < e.length; n += 1)
    Zo(e[n], y(this, En), y(this, Sn));
}, Jo = function() {
  var i;
  if (hr.size > 1) {
    this.previous.clear();
    var e = _t, n = !0;
    for (const o of hr) {
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
          Qo(c, a, u, f);
        if (Jt.length > 0) {
          it = o, o.apply();
          for (const c of Jt)
            xt(i = o, ue, ii).call(i, c, [], []);
          o.deactivate();
        }
        Jt = r;
      }
    }
    it = null, _t = e;
  }
  this.committed = !0, hr.delete(this);
};
let Le = Gi;
function sl() {
  ri = !0;
  var t = null;
  try {
    for (var e = 0; Jt.length > 0; ) {
      var n = Le.ensure();
      if (e++ > 1e3) {
        var r, i;
        al();
      }
      n.process(Jt), Oe.clear();
    }
  } finally {
    ri = !1, Ai = null;
  }
}
function al() {
  try {
    Ha();
  } catch (t) {
    Tn(t, Ai);
  }
}
let Zt = null;
function Ji(t) {
  var e = t.length;
  if (e !== 0) {
    for (var n = 0; n < e; ) {
      var r = t[n++];
      if ((r.f & (ye | Yt)) === 0 && ar(r) && (Zt = /* @__PURE__ */ new Set(), Kn(r), r.deps === null && r.first === null && r.nodes === null && (r.teardown === null && r.ac === null ? gs(r) : r.fn = null), (Zt == null ? void 0 : Zt.size) > 0)) {
        Oe.clear();
        for (const i of Zt) {
          if ((i.f & (ye | Yt)) !== 0) continue;
          const o = [i];
          let s = i.parent;
          for (; s !== null; )
            Zt.has(s) && (Zt.delete(s), o.push(s)), s = s.parent;
          for (let a = o.length - 1; a >= 0; a--) {
            const u = o[a];
            (u.f & (ye | Yt)) === 0 && Kn(u);
          }
        }
        Zt.clear();
      }
    }
    Zt = null;
  }
}
function Qo(t, e, n, r) {
  if (!n.has(t) && (n.add(t), t.reactions !== null))
    for (const i of t.reactions) {
      const o = i.f;
      (o & yt) !== 0 ? Qo(
        /** @type {Derived} */
        i,
        e,
        n,
        r
      ) : (o & (Ni | be)) !== 0 && (o & Ft) === 0 && jo(i, e, r) && (gt(i, Ft), we(
        /** @type {Effect} */
        i
      ));
    }
}
function jo(t, e, n) {
  const r = n.get(t);
  if (r !== void 0) return r;
  if (t.deps !== null)
    for (const i of t.deps) {
      if (e.includes(i))
        return !0;
      if ((i.f & yt) !== 0 && jo(
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
  for (var e = Ai = t; e.parent !== null; ) {
    e = e.parent;
    var n = e.f;
    if (ri && e === et && (n & be) !== 0 && (n & Xo) === 0)
      return;
    if ((n & (on | ke)) !== 0) {
      if ((n & kt) === 0) return;
      e.f ^= kt;
    }
  }
  Jt.push(e);
}
function ll(t) {
  let e = 0, n = tn(0), r;
  return () => {
    zi() && (l(n), fs(() => (e === 0 && (r = Ri(() => t(() => Gn(n)))), e += 1, () => {
      Fe(() => {
        e -= 1, e === 0 && (r == null || r(), r = void 0, Gn(n));
      });
    })));
  };
}
var ul = Pn | Ln | Ei;
function fl(t, e, n) {
  new cl(t, e, n);
}
var Vt, ki, re, Ge, ie, Xt, Mt, oe, me, ze, We, Te, Mn, Ke, An, In, pe, Yr, dt, hl, dl, si, wr, xr, ai;
class cl {
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(e, n, r) {
    Z(this, dt);
    /** @type {Boundary | null} */
    vt(this, "parent");
    vt(this, "is_pending", !1);
    /** @type {TemplateNode} */
    Z(this, Vt);
    /** @type {TemplateNode | null} */
    Z(this, ki, null);
    /** @type {BoundaryProps} */
    Z(this, re);
    /** @type {((anchor: Node) => void)} */
    Z(this, Ge);
    /** @type {Effect} */
    Z(this, ie);
    /** @type {Effect | null} */
    Z(this, Xt, null);
    /** @type {Effect | null} */
    Z(this, Mt, null);
    /** @type {Effect | null} */
    Z(this, oe, null);
    /** @type {DocumentFragment | null} */
    Z(this, me, null);
    /** @type {TemplateNode | null} */
    Z(this, ze, null);
    Z(this, We, 0);
    Z(this, Te, 0);
    Z(this, Mn, !1);
    Z(this, Ke, !1);
    /** @type {Set<Effect>} */
    Z(this, An, /* @__PURE__ */ new Set());
    /** @type {Set<Effect>} */
    Z(this, In, /* @__PURE__ */ new Set());
    /**
     * A source containing the number of pending async deriveds/expressions.
     * Only created if `$effect.pending()` is used inside the boundary,
     * otherwise updating the source results in needless `Batch.ensure()`
     * calls followed by no-op flushes
     * @type {Source<number> | null}
     */
    Z(this, pe, null);
    Z(this, Yr, ll(() => (G(this, pe, tn(y(this, We))), () => {
      G(this, pe, null);
    })));
    G(this, Vt, e), G(this, re, n), G(this, Ge, r), this.parent = /** @type {Effect} */
    et.b, this.is_pending = !!y(this, re).pending, G(this, ie, Ti(() => {
      et.b = this;
      {
        var i = xt(this, dt, si).call(this);
        try {
          G(this, Xt, qt(() => r(i)));
        } catch (o) {
          this.error(o);
        }
        y(this, Te) > 0 ? xt(this, dt, xr).call(this) : this.is_pending = !1;
      }
      return () => {
        var o;
        (o = y(this, ze)) == null || o.remove();
      };
    }, ul));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(e) {
    Zo(e, y(this, An), y(this, In));
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
    xt(this, dt, ai).call(this, e), G(this, We, y(this, We) + e), !(!y(this, pe) || y(this, Mn)) && (G(this, Mn, !0), Fe(() => {
      G(this, Mn, !1), y(this, pe) && Cn(y(this, pe), y(this, We));
    }));
  }
  get_effect_pending() {
    return y(this, Yr).call(this), l(
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
    y(this, Xt) && (Rt(y(this, Xt)), G(this, Xt, null)), y(this, Mt) && (Rt(y(this, Mt)), G(this, Mt, null)), y(this, oe) && (Rt(y(this, oe)), G(this, oe, null));
    var i = !1, o = !1;
    const s = () => {
      if (i) {
        nl();
        return;
      }
      i = !0, o && Ua(), Le.ensure(), G(this, We, 0), y(this, oe) !== null && Je(y(this, oe), () => {
        G(this, oe, null);
      }), this.is_pending = this.has_pending_snippet(), G(this, Xt, xt(this, dt, wr).call(this, () => (G(this, Ke, !1), qt(() => y(this, Ge).call(this, y(this, Vt)))))), y(this, Te) > 0 ? xt(this, dt, xr).call(this) : this.is_pending = !1;
    };
    var a = K;
    try {
      Tt(null), o = !0, n == null || n(e, s), o = !1;
    } catch (u) {
      Tn(u, y(this, ie) && y(this, ie).parent);
    } finally {
      Tt(a);
    }
    r && Fe(() => {
      G(this, oe, xt(this, dt, wr).call(this, () => {
        Le.ensure(), G(this, Ke, !0);
        try {
          return qt(() => {
            r(
              y(this, Vt),
              () => e,
              () => s
            );
          });
        } catch (u) {
          return Tn(
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
Vt = new WeakMap(), ki = new WeakMap(), re = new WeakMap(), Ge = new WeakMap(), ie = new WeakMap(), Xt = new WeakMap(), Mt = new WeakMap(), oe = new WeakMap(), me = new WeakMap(), ze = new WeakMap(), We = new WeakMap(), Te = new WeakMap(), Mn = new WeakMap(), Ke = new WeakMap(), An = new WeakMap(), In = new WeakMap(), pe = new WeakMap(), Yr = new WeakMap(), dt = new WeakSet(), hl = function() {
  try {
    G(this, Xt, qt(() => y(this, Ge).call(this, y(this, Vt))));
  } catch (e) {
    this.error(e);
  }
}, dl = function() {
  const e = y(this, re).pending;
  e && (G(this, Mt, qt(() => e(y(this, Vt)))), Fe(() => {
    var n = xt(this, dt, si).call(this);
    G(this, Xt, xt(this, dt, wr).call(this, () => (Le.ensure(), qt(() => y(this, Ge).call(this, n))))), y(this, Te) > 0 ? xt(this, dt, xr).call(this) : (Je(
      /** @type {Effect} */
      y(this, Mt),
      () => {
        G(this, Mt, null);
      }
    ), this.is_pending = !1);
  }));
}, si = function() {
  var e = y(this, Vt);
  return this.is_pending && (G(this, ze, en()), y(this, Vt).before(y(this, ze)), e = y(this, ze)), e;
}, /**
 * @param {() => Effect | null} fn
 */
wr = function(e) {
  var n = et, r = K, i = Wt;
  le(y(this, ie)), Tt(y(this, ie)), zn(y(this, ie).ctx);
  try {
    return e();
  } catch (o) {
    return Wo(o), null;
  } finally {
    le(n), Tt(r), zn(i);
  }
}, xr = function() {
  const e = (
    /** @type {(anchor: Node) => void} */
    y(this, re).pending
  );
  y(this, Xt) !== null && (G(this, me, document.createDocumentFragment()), y(this, me).append(
    /** @type {TemplateNode} */
    y(this, ze)
  ), ps(y(this, Xt), y(this, me))), y(this, Mt) === null && G(this, Mt, qt(() => e(y(this, Vt))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
ai = function(e) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && xt(n = this.parent, dt, ai).call(n, e);
    return;
  }
  if (G(this, Te, y(this, Te) + e), y(this, Te) === 0) {
    this.is_pending = !1;
    for (const r of y(this, An))
      gt(r, Ft), we(r);
    for (const r of y(this, In))
      gt(r, Ee), we(r);
    y(this, An).clear(), y(this, In).clear(), y(this, Mt) && Je(y(this, Mt), () => {
      G(this, Mt, null);
    }), y(this, me) && (y(this, Vt).before(y(this, me)), G(this, me, null));
  }
};
function gl(t, e, n, r) {
  const i = Xr;
  var o = t.filter((h) => !h.settled);
  if (n.length === 0 && o.length === 0) {
    r(e.map(i));
    return;
  }
  var s = it, a = (
    /** @type {Effect} */
    et
  ), u = vl(), f = o.length === 1 ? o[0].promise : o.length > 1 ? Promise.all(o.map((h) => h.promise)) : null;
  function c(h) {
    u();
    try {
      r(h);
    } catch (g) {
      (a.f & ye) === 0 && Tn(g, a);
    }
    s == null || s.deactivate(), li();
  }
  if (n.length === 0) {
    f.then(() => c(e.map(i)));
    return;
  }
  function d() {
    u(), Promise.all(n.map((h) => /* @__PURE__ */ ml(h))).then((h) => c([...e.map(i), ...h])).catch((h) => Tn(h, a));
  }
  f ? f.then(d) : d();
}
function vl() {
  var t = et, e = K, n = Wt, r = it;
  return function(o = !0) {
    le(t), Tt(e), zn(n), o && (r == null || r.activate());
  };
}
function li() {
  le(null), Tt(null), zn(null);
}
// @__NO_SIDE_EFFECTS__
function Xr(t) {
  var e = yt | Ft, n = K !== null && (K.f & yt) !== 0 ? (
    /** @type {Derived} */
    K
  ) : null;
  return et !== null && (et.f |= Ln), {
    ctx: Wt,
    deps: null,
    effects: null,
    equals: qo,
    f: e,
    fn: t,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      mt
    ),
    wv: 0,
    parent: n ?? et,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function ml(t, e, n) {
  let r = (
    /** @type {Effect | null} */
    et
  );
  r === null && La();
  var i = (
    /** @type {Boundary} */
    r.b
  ), o = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  ), s = tn(
    /** @type {V} */
    mt
  ), a = !K, u = /* @__PURE__ */ new Map();
  return Nl(() => {
    var g;
    var f = Bo();
    o = f.promise;
    try {
      Promise.resolve(t()).then(f.resolve, f.reject).then(() => {
        c === it && c.committed && c.deactivate(), li();
      });
    } catch (m) {
      f.reject(m), li();
    }
    var c = (
      /** @type {Batch} */
      it
    );
    if (a) {
      var d = i.is_rendered();
      i.update_pending_count(1), c.increment(d), (g = u.get(c)) == null || g.reject(vn), u.delete(c), u.set(c, f);
    }
    const h = (m, b = void 0) => {
      if (c.activate(), b)
        b !== vn && (s.f |= Re, Cn(s, b));
      else {
        (s.f & Re) !== 0 && (s.f ^= Re), Cn(s, m);
        for (const [R, S] of u) {
          if (u.delete(R), R === c) break;
          S.reject(vn);
        }
      }
      a && (i.update_pending_count(-1), c.decrement(d));
    };
    f.promise.then(h, (m) => h(null, m || "unknown"));
  }), ls(() => {
    for (const f of u.values())
      f.reject(vn);
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
function L(t) {
  const e = /* @__PURE__ */ Xr(t);
  return _s(e), e;
}
// @__NO_SIDE_EFFECTS__
function $o(t) {
  const e = /* @__PURE__ */ Xr(t);
  return e.equals = Uo, e;
}
function ts(t) {
  var e = t.effects;
  if (e !== null) {
    t.effects = null;
    for (var n = 0; n < e.length; n += 1)
      Rt(
        /** @type {Effect} */
        e[n]
      );
  }
}
function pl(t) {
  for (var e = t.parent; e !== null; ) {
    if ((e.f & yt) === 0)
      return (e.f & ye) === 0 ? (
        /** @type {Effect} */
        e
      ) : null;
    e = e.parent;
  }
  return null;
}
function Ii(t) {
  var e, n = et;
  le(pl(t));
  try {
    t.f &= ~$e, ts(t), e = bs(t);
  } finally {
    le(n);
  }
  return e;
}
function es(t) {
  var e = Ii(t);
  if (!t.equals(e) && (t.wv = ws(), (!(it != null && it.is_fork) || t.deps === null) && (t.v = e, t.deps === null))) {
    gt(t, kt);
    return;
  }
  De || (_t !== null ? (zi() || it != null && it.is_fork) && _t.set(t, e) : Mi(t));
}
let ui = /* @__PURE__ */ new Set();
const Oe = /* @__PURE__ */ new Map();
let ns = !1;
function tn(t, e) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: t,
    reactions: null,
    equals: qo,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function ft(t, e) {
  const n = tn(t);
  return _s(n), n;
}
// @__NO_SIDE_EFFECTS__
function _l(t, e = !1, n = !0) {
  const r = tn(t);
  return e || (r.equals = Uo), r;
}
function B(t, e, n = !1) {
  K !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!$t || (K.f & Zi) !== 0) && Go() && (K.f & (yt | be | Ni | Zi)) !== 0 && !(St != null && St.includes(t)) && qa();
  let r = n ? It(e) : e;
  return Cn(t, r);
}
function Cn(t, e) {
  if (!t.equals(e)) {
    var n = t.v;
    De ? Oe.set(t, e) : Oe.set(t, n), t.v = e;
    var r = Le.ensure();
    if (r.capture(t, n), (t.f & yt) !== 0) {
      const i = (
        /** @type {Derived} */
        t
      );
      (t.f & Ft) !== 0 && Ii(i), Mi(i);
    }
    t.wv = ws(), rs(t, Ft), et !== null && (et.f & kt) !== 0 && (et.f & (ke | on)) === 0 && (Bt === null ? Al([t]) : Bt.push(t)), !r.is_fork && ui.size > 0 && !ns && yl();
  }
  return e;
}
function yl() {
  ns = !1;
  for (const t of ui)
    (t.f & kt) !== 0 && gt(t, Ee), ar(t) && Kn(t);
  ui.clear();
}
function Gn(t) {
  B(t, t.v + 1);
}
function rs(t, e) {
  var n = t.reactions;
  if (n !== null)
    for (var r = n.length, i = 0; i < r; i++) {
      var o = n[i], s = o.f, a = (s & Ft) === 0;
      if (a && gt(o, e), (s & yt) !== 0) {
        var u = (
          /** @type {Derived} */
          o
        );
        _t == null || _t.delete(u), (s & $e) === 0 && (s & Gt && (o.f |= $e), rs(u, Ee));
      } else a && ((s & be) !== 0 && Zt !== null && Zt.add(
        /** @type {Effect} */
        o
      ), we(
        /** @type {Effect} */
        o
      ));
    }
}
function It(t) {
  if (typeof t != "object" || t === null || Un in t)
    return t;
  const e = Ho(t);
  if (e !== Pa && e !== za)
    return t;
  var n = /* @__PURE__ */ new Map(), r = Yo(t), i = /* @__PURE__ */ ft(0), o = Qe, s = (a) => {
    if (Qe === o)
      return a();
    var u = K, f = Qe;
    Tt(null), $i(o);
    var c = a();
    return Tt(u), $i(f), c;
  };
  return r && n.set("length", /* @__PURE__ */ ft(
    /** @type {any[]} */
    t.length
  )), new Proxy(
    /** @type {any} */
    t,
    {
      defineProperty(a, u, f) {
        (!("value" in f) || f.configurable === !1 || f.enumerable === !1 || f.writable === !1) && Va();
        var c = n.get(u);
        return c === void 0 ? c = s(() => {
          var d = /* @__PURE__ */ ft(f.value);
          return n.set(u, d), d;
        }) : B(c, f.value, !0), !0;
      },
      deleteProperty(a, u) {
        var f = n.get(u);
        if (f === void 0) {
          if (u in a) {
            const c = s(() => /* @__PURE__ */ ft(mt));
            n.set(u, c), Gn(i);
          }
        } else
          B(f, mt), Gn(i);
        return !0;
      },
      get(a, u, f) {
        var g;
        if (u === Un)
          return t;
        var c = n.get(u), d = u in a;
        if (c === void 0 && (!d || (g = _n(a, u)) != null && g.writable) && (c = s(() => {
          var m = It(d ? a[u] : mt), b = /* @__PURE__ */ ft(m);
          return b;
        }), n.set(u, c)), c !== void 0) {
          var h = l(c);
          return h === mt ? void 0 : h;
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
          if (d !== void 0 && h !== mt)
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
        if (u === Un)
          return !0;
        var f = n.get(u), c = f !== void 0 && f.v !== mt || Reflect.has(a, u);
        if (f !== void 0 || et !== null && (!c || (h = _n(a, u)) != null && h.writable)) {
          f === void 0 && (f = s(() => {
            var g = c ? It(a[u]) : mt, m = /* @__PURE__ */ ft(g);
            return m;
          }), n.set(u, f));
          var d = l(f);
          if (d === mt)
            return !1;
        }
        return c;
      },
      set(a, u, f, c) {
        var P;
        var d = n.get(u), h = u in a;
        if (r && u === "length")
          for (var g = f; g < /** @type {Source<number>} */
          d.v; g += 1) {
            var m = n.get(g + "");
            m !== void 0 ? B(m, mt) : g in a && (m = s(() => /* @__PURE__ */ ft(mt)), n.set(g + "", m));
          }
        if (d === void 0)
          (!h || (P = _n(a, u)) != null && P.writable) && (d = s(() => /* @__PURE__ */ ft(void 0)), B(d, It(f)), n.set(u, d));
        else {
          h = d.v !== mt;
          var b = s(() => It(f));
          B(d, b);
        }
        var R = Reflect.getOwnPropertyDescriptor(a, u);
        if (R != null && R.set && R.set.call(c, f), !h) {
          if (r && typeof u == "string") {
            var S = (
              /** @type {Source<number>} */
              n.get("length")
            ), Y = Number(u);
            Number.isInteger(Y) && Y >= S.v && B(S, Y + 1);
          }
          Gn(i);
        }
        return !0;
      },
      ownKeys(a) {
        l(i);
        var u = Reflect.ownKeys(a).filter((d) => {
          var h = n.get(d);
          return h === void 0 || h.v !== mt;
        });
        for (var [f, c] of n)
          c.v !== mt && !(f in a) && u.push(f);
        return u;
      },
      setPrototypeOf() {
        Xa();
      }
    }
  );
}
var Qi, is, os, ss;
function wl() {
  if (Qi === void 0) {
    Qi = window, is = /Firefox/.test(navigator.userAgent);
    var t = Element.prototype, e = Node.prototype, n = Text.prototype;
    os = _n(e, "firstChild").get, ss = _n(e, "nextSibling").get, Ki(t) && (t.__click = void 0, t.__className = void 0, t.__attributes = null, t.__style = void 0, t.__e = void 0), Ki(n) && (n.__t = void 0);
  }
}
function en(t = "") {
  return document.createTextNode(t);
}
// @__NO_SIDE_EFFECTS__
function Ut(t) {
  return (
    /** @type {TemplateNode | null} */
    os.call(t)
  );
}
// @__NO_SIDE_EFFECTS__
function sr(t) {
  return (
    /** @type {TemplateNode | null} */
    ss.call(t)
  );
}
function ht(t, e) {
  return /* @__PURE__ */ Ut(t);
}
function At(t, e = !1) {
  {
    var n = /* @__PURE__ */ Ut(t);
    return n instanceof Comment && n.data === "" ? /* @__PURE__ */ sr(n) : n;
  }
}
function nt(t, e = 1, n = !1) {
  let r = t;
  for (; e--; )
    r = /** @type {TemplateNode} */
    /* @__PURE__ */ sr(r);
  return r;
}
function xl(t) {
  t.textContent = "";
}
function as() {
  return !1;
}
function Pi(t) {
  var e = K, n = et;
  Tt(null), le(null);
  try {
    return t();
  } finally {
    Tt(e), le(n);
  }
}
function bl(t) {
  et === null && (K === null && Ya(), Da()), De && Oa();
}
function kl(t, e) {
  var n = e.last;
  n === null ? e.last = e.first = t : (n.next = t, t.prev = n, e.last = t);
}
function Se(t, e, n) {
  var r = et;
  r !== null && (r.f & Yt) !== 0 && (t |= Yt);
  var i = {
    ctx: Wt,
    deps: null,
    nodes: null,
    f: t | Ft | Gt,
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
      Kn(i), i.f |= Si;
    } catch (a) {
      throw Rt(i), a;
    }
  else e !== null && we(i);
  var o = i;
  if (n && o.deps === null && o.teardown === null && o.nodes === null && o.first === o.last && // either `null`, or a singular child
  (o.f & Ln) === 0 && (o = o.first, (t & be) !== 0 && (t & Pn) !== 0 && o !== null && (o.f |= Pn)), o !== null && (o.parent = r, r !== null && kl(o, r), K !== null && (K.f & yt) !== 0 && (t & on) === 0)) {
    var s = (
      /** @type {Derived} */
      K
    );
    (s.effects ?? (s.effects = [])).push(o);
  }
  return i;
}
function zi() {
  return K !== null && !$t;
}
function ls(t) {
  const e = Se(Vr, null, !1);
  return gt(e, kt), e.teardown = t, e;
}
function pn(t) {
  bl();
  var e = (
    /** @type {Effect} */
    et.f
  ), n = !K && (e & ke) !== 0 && (e & Si) === 0;
  if (n) {
    var r = (
      /** @type {ComponentContext} */
      Wt
    );
    (r.e ?? (r.e = [])).push(t);
  } else
    return us(t);
}
function us(t) {
  return Se(Ar | Ca, t, !1);
}
function El(t) {
  Le.ensure();
  const e = Se(on | Ln, t, !0);
  return (n = {}) => new Promise((r) => {
    n.outro ? Je(e, () => {
      Rt(e), r(void 0);
    }) : (Rt(e), r(void 0));
  });
}
function Sl(t) {
  return Se(Ar, t, !1);
}
function Nl(t) {
  return Se(Ni | Ln, t, !0);
}
function fs(t, e = 0) {
  return Se(Vr | e, t, !0);
}
function ot(t, e = [], n = [], r = []) {
  gl(r, e, n, (i) => {
    Se(Vr, () => t(...i.map(l)), !0);
  });
}
function Ti(t, e = 0) {
  var n = Se(be | e, t, !0);
  return n;
}
function qt(t) {
  return Se(ke | Ln, t, !0);
}
function cs(t) {
  var e = t.teardown;
  if (e !== null) {
    const n = De, r = K;
    ji(!0), Tt(null);
    try {
      e.call(null);
    } finally {
      ji(n), Tt(r);
    }
  }
}
function hs(t, e = !1) {
  var n = t.first;
  for (t.first = t.last = null; n !== null; ) {
    const i = n.ac;
    i !== null && Pi(() => {
      i.abort(vn);
    });
    var r = n.next;
    (n.f & on) !== 0 ? n.parent = null : Rt(n, e), n = r;
  }
}
function Ml(t) {
  for (var e = t.first; e !== null; ) {
    var n = e.next;
    (e.f & ke) === 0 && Rt(e), e = n;
  }
}
function Rt(t, e = !0) {
  var n = !1;
  (e || (t.f & Xo) !== 0) && t.nodes !== null && t.nodes.end !== null && (ds(
    t.nodes.start,
    /** @type {TemplateNode} */
    t.nodes.end
  ), n = !0), hs(t, e && !n), Ir(t, 0), gt(t, ye);
  var r = t.nodes && t.nodes.t;
  if (r !== null)
    for (const o of r)
      o.stop();
  cs(t);
  var i = t.parent;
  i !== null && i.first !== null && gs(t), t.next = t.prev = t.teardown = t.ctx = t.deps = t.fn = t.nodes = t.ac = null;
}
function ds(t, e) {
  for (; t !== null; ) {
    var n = t === e ? null : /* @__PURE__ */ sr(t);
    t.remove(), t = n;
  }
}
function gs(t) {
  var e = t.parent, n = t.prev, r = t.next;
  n !== null && (n.next = r), r !== null && (r.prev = n), e !== null && (e.first === t && (e.first = r), e.last === t && (e.last = n));
}
function Je(t, e, n = !0) {
  var r = [];
  vs(t, r, !0);
  var i = () => {
    n && Rt(t), e && e();
  }, o = r.length;
  if (o > 0) {
    var s = () => --o || i();
    for (var a of r)
      a.out(s);
  } else
    i();
}
function vs(t, e, n) {
  if ((t.f & Yt) === 0) {
    t.f ^= Yt;
    var r = t.nodes && t.nodes.t;
    if (r !== null)
      for (const a of r)
        (a.is_global || n) && e.push(a);
    for (var i = t.first; i !== null; ) {
      var o = i.next, s = (i.f & Pn) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (i.f & ke) !== 0 && (t.f & be) !== 0;
      vs(i, e, s ? n : !1), i = o;
    }
  }
}
function Ci(t) {
  ms(t, !0);
}
function ms(t, e) {
  if ((t.f & Yt) !== 0) {
    t.f ^= Yt, (t.f & kt) === 0 && (gt(t, Ft), we(t));
    for (var n = t.first; n !== null; ) {
      var r = n.next, i = (n.f & Pn) !== 0 || (n.f & ke) !== 0;
      ms(n, i ? e : !1), n = r;
    }
    var o = t.nodes && t.nodes.t;
    if (o !== null)
      for (const s of o)
        (s.is_global || e) && s.in();
  }
}
function ps(t, e) {
  if (t.nodes)
    for (var n = t.nodes.start, r = t.nodes.end; n !== null; ) {
      var i = n === r ? null : /* @__PURE__ */ sr(n);
      e.append(n), n = i;
    }
}
let br = !1, De = !1;
function ji(t) {
  De = t;
}
let K = null, $t = !1;
function Tt(t) {
  K = t;
}
let et = null;
function le(t) {
  et = t;
}
let St = null;
function _s(t) {
  K !== null && (St === null ? St = [t] : St.push(t));
}
let Pt = null, Ot = 0, Bt = null;
function Al(t) {
  Bt = t;
}
let ys = 1, Xe = 0, Qe = Xe;
function $i(t) {
  Qe = t;
}
function ws() {
  return ++ys;
}
function ar(t) {
  var e = t.f;
  if ((e & Ft) !== 0)
    return !0;
  if (e & yt && (t.f &= ~$e), (e & Ee) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      t.deps
    ), r = n.length, i = 0; i < r; i++) {
      var o = n[i];
      if (ar(
        /** @type {Derived} */
        o
      ) && es(
        /** @type {Derived} */
        o
      ), o.wv > t.wv)
        return !0;
    }
    (e & Gt) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    _t === null && gt(t, kt);
  }
  return !1;
}
function xs(t, e, n = !0) {
  var r = t.reactions;
  if (r !== null && !(St != null && St.includes(t)))
    for (var i = 0; i < r.length; i++) {
      var o = r[i];
      (o.f & yt) !== 0 ? xs(
        /** @type {Derived} */
        o,
        e,
        !1
      ) : e === o && (n ? gt(o, Ft) : (o.f & kt) !== 0 && gt(o, Ee), we(
        /** @type {Effect} */
        o
      ));
    }
}
function bs(t) {
  var m;
  var e = Pt, n = Ot, r = Bt, i = K, o = St, s = Wt, a = $t, u = Qe, f = t.f;
  Pt = /** @type {null | Value[]} */
  null, Ot = 0, Bt = null, K = (f & (ke | on)) === 0 ? t : null, St = null, zn(t.ctx), $t = !1, Qe = ++Xe, t.ac !== null && (Pi(() => {
    t.ac.abort(vn);
  }), t.ac = null);
  try {
    t.f |= ni;
    var c = (
      /** @type {Function} */
      t.fn
    ), d = c(), h = t.deps;
    if (Pt !== null) {
      var g;
      if (Ir(t, Ot), h !== null && Ot > 0)
        for (h.length = Ot + Pt.length, g = 0; g < Pt.length; g++)
          h[Ot + g] = Pt[g];
      else
        t.deps = h = Pt;
      if (zi() && (t.f & Gt) !== 0)
        for (g = Ot; g < h.length; g++)
          ((m = h[g]).reactions ?? (m.reactions = [])).push(t);
    } else h !== null && Ot < h.length && (Ir(t, Ot), h.length = Ot);
    if (Go() && Bt !== null && !$t && h !== null && (t.f & (yt | Ee | Ft)) === 0)
      for (g = 0; g < /** @type {Source[]} */
      Bt.length; g++)
        xs(
          Bt[g],
          /** @type {Effect} */
          t
        );
    if (i !== null && i !== t) {
      if (Xe++, i.deps !== null)
        for (let b = 0; b < n; b += 1)
          i.deps[b].rv = Xe;
      if (e !== null)
        for (const b of e)
          b.rv = Xe;
      Bt !== null && (r === null ? r = Bt : r.push(.../** @type {Source[]} */
      Bt));
    }
    return (t.f & Re) !== 0 && (t.f ^= Re), d;
  } catch (b) {
    return Wo(b);
  } finally {
    t.f ^= ni, Pt = e, Ot = n, Bt = r, K = i, St = o, zn(s), $t = a, Qe = u;
  }
}
function Il(t, e) {
  let n = e.reactions;
  if (n !== null) {
    var r = Ma.call(n, t);
    if (r !== -1) {
      var i = n.length - 1;
      i === 0 ? n = e.reactions = null : (n[r] = n[i], n.pop());
    }
  }
  if (n === null && (e.f & yt) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (Pt === null || !Pt.includes(e))) {
    var o = (
      /** @type {Derived} */
      e
    );
    (o.f & Gt) !== 0 && (o.f ^= Gt, o.f &= ~$e), Mi(o), ts(o), Ir(o, 0);
  }
}
function Ir(t, e) {
  var n = t.deps;
  if (n !== null)
    for (var r = e; r < n.length; r++)
      Il(t, n[r]);
}
function Kn(t) {
  var e = t.f;
  if ((e & ye) === 0) {
    gt(t, kt);
    var n = et, r = br;
    et = t, br = !0;
    try {
      (e & (be | Vo)) !== 0 ? Ml(t) : hs(t), cs(t);
      var i = bs(t);
      t.teardown = typeof i == "function" ? i : null, t.wv = ys;
      var o;
    } finally {
      br = r, et = n;
    }
  }
}
function l(t) {
  var e = t.f, n = (e & yt) !== 0;
  if (K !== null && !$t) {
    var r = et !== null && (et.f & ye) !== 0;
    if (!r && !(St != null && St.includes(t))) {
      var i = K.deps;
      if ((K.f & ni) !== 0)
        t.rv < Xe && (t.rv = Xe, Pt === null && i !== null && i[Ot] === t ? Ot++ : Pt === null ? Pt = [t] : Pt.push(t));
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
      return ((s.f & kt) === 0 && s.reactions !== null || Es(s)) && (a = Ii(s)), Oe.set(s, a), a;
    }
    var u = (s.f & Gt) === 0 && !$t && K !== null && (br || (K.f & Gt) !== 0), f = s.deps === null;
    ar(s) && (u && (s.f |= Gt), es(s)), u && !f && ks(s);
  }
  if (_t != null && _t.has(t))
    return _t.get(t);
  if ((t.f & Re) !== 0)
    throw t.v;
  return t.v;
}
function ks(t) {
  if (t.deps !== null) {
    t.f |= Gt;
    for (const e of t.deps)
      (e.reactions ?? (e.reactions = [])).push(t), (e.f & yt) !== 0 && (e.f & Gt) === 0 && ks(
        /** @type {Derived} */
        e
      );
  }
}
function Es(t) {
  if (t.v === mt) return !0;
  if (t.deps === null) return !1;
  for (const e of t.deps)
    if (Oe.has(e) || (e.f & yt) !== 0 && Es(
      /** @type {Derived} */
      e
    ))
      return !0;
  return !1;
}
function Ri(t) {
  var e = $t;
  try {
    return $t = !0, t();
  } finally {
    $t = e;
  }
}
const Pl = ["touchstart", "touchmove"];
function zl(t) {
  return Pl.includes(t);
}
const Ss = /* @__PURE__ */ new Set(), fi = /* @__PURE__ */ new Set();
function Tl(t, e, n, r = {}) {
  function i(o) {
    if (r.capture || Bn.call(e, o), !o.cancelBubble)
      return Pi(() => n == null ? void 0 : n.call(this, o));
  }
  return t.startsWith("pointer") || t.startsWith("touch") || t === "wheel" ? Fe(() => {
    e.addEventListener(t, i, r);
  }) : e.addEventListener(t, i, r), i;
}
function Ie(t, e, n, r, i) {
  var o = { capture: r, passive: i }, s = Tl(t, e, n, o);
  (e === document.body || // @ts-ignore
  e === window || // @ts-ignore
  e === document || // Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
  e instanceof HTMLMediaElement) && ls(() => {
    e.removeEventListener(t, s, o);
  });
}
function lr(t) {
  for (var e = 0; e < t.length; e++)
    Ss.add(t[e]);
  for (var n of fi)
    n(t);
}
let to = null;
function Bn(t) {
  var R;
  var e = this, n = (
    /** @type {Node} */
    e.ownerDocument
  ), r = t.type, i = ((R = t.composedPath) == null ? void 0 : R.call(t)) || [], o = (
    /** @type {null | Element} */
    i[0] || t.target
  );
  to = t;
  var s = 0, a = to === t && t.__root;
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
    Aa(t, "currentTarget", {
      configurable: !0,
      get() {
        return o || n;
      }
    });
    var c = K, d = et;
    Tt(null), le(null);
    try {
      for (var h, g = []; o !== null; ) {
        var m = o.assignedSlot || o.parentNode || /** @type {any} */
        o.host || null;
        try {
          var b = o["__" + r];
          b != null && (!/** @type {any} */
          o.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
          // -> the target could not have been disabled because it emits the event in the first place
          t.target === o) && b.call(o, t);
        } catch (S) {
          h ? g.push(S) : h = S;
        }
        if (t.cancelBubble || m === e || m === null)
          break;
        o = m;
      }
      if (h) {
        for (let S of g)
          queueMicrotask(() => {
            throw S;
          });
        throw h;
      }
    } finally {
      t.__root = e, delete t.currentTarget, Tt(c), le(d);
    }
  }
}
function Fi(t) {
  var e = document.createElement("template");
  return e.innerHTML = t.replaceAll("<!>", "<!---->"), e.content;
}
function Zn(t, e) {
  var n = (
    /** @type {Effect} */
    et
  );
  n.nodes === null && (n.nodes = { start: t, end: e, a: null, t: null });
}
// @__NO_SIDE_EFFECTS__
function Cl(t, e) {
  var n = (e & tl) !== 0, r, i = !t.startsWith("<!>");
  return () => {
    r === void 0 && (r = Fi(i ? t : "<!>" + t), r = /** @type {TemplateNode} */
    /* @__PURE__ */ Ut(r));
    var o = (
      /** @type {TemplateNode} */
      n || is ? document.importNode(r, !0) : r.cloneNode(!0)
    );
    return Zn(o, o), o;
  };
}
// @__NO_SIDE_EFFECTS__
function Rl(t, e, n = "svg") {
  var r = !t.startsWith("<!>"), i = (e & $a) !== 0, o = `<${n}>${r ? t : "<!>" + t}</${n}>`, s;
  return () => {
    if (!s) {
      var a = (
        /** @type {DocumentFragment} */
        Fi(o)
      ), u = (
        /** @type {Element} */
        /* @__PURE__ */ Ut(a)
      );
      if (i)
        for (s = document.createDocumentFragment(); /* @__PURE__ */ Ut(u); )
          s.appendChild(
            /** @type {TemplateNode} */
            /* @__PURE__ */ Ut(u)
          );
      else
        s = /** @type {Element} */
        /* @__PURE__ */ Ut(u);
    }
    var f = (
      /** @type {TemplateNode} */
      s.cloneNode(!0)
    );
    if (i) {
      var c = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ Ut(f)
      ), d = (
        /** @type {TemplateNode} */
        f.lastChild
      );
      Zn(c, d);
    } else
      Zn(f, f);
    return f;
  };
}
// @__NO_SIDE_EFFECTS__
function st(t, e) {
  return /* @__PURE__ */ Rl(t, e, "svg");
}
function ge() {
  var t = document.createDocumentFragment(), e = document.createComment(""), n = en();
  return t.append(e, n), Zn(e, n), t;
}
function J(t, e) {
  t !== null && t.before(
    /** @type {Node} */
    e
  );
}
function Jn(t, e) {
  var n = e == null ? "" : typeof e == "object" ? e + "" : e;
  n !== (t.__t ?? (t.__t = t.nodeValue)) && (t.__t = n, t.nodeValue = n + "");
}
function Fl(t, e) {
  return Ll(t, e);
}
const dn = /* @__PURE__ */ new Map();
function Ll(t, { target: e, anchor: n, props: r = {}, events: i, context: o, intro: s = !0 }) {
  wl();
  var a = /* @__PURE__ */ new Set(), u = (d) => {
    for (var h = 0; h < d.length; h++) {
      var g = d[h];
      if (!a.has(g)) {
        a.add(g);
        var m = zl(g);
        e.addEventListener(g, Bn, { passive: m });
        var b = dn.get(g);
        b === void 0 ? (document.addEventListener(g, Bn, { passive: m }), dn.set(g, 1)) : dn.set(g, b + 1);
      }
    }
  };
  u(Br(Ss)), fi.add(u);
  var f = void 0, c = El(() => {
    var d = n ?? e.appendChild(en());
    return fl(
      /** @type {TemplateNode} */
      d,
      {
        pending: () => {
        }
      },
      (h) => {
        if (o) {
          sn({});
          var g = (
            /** @type {ComponentContext} */
            Wt
          );
          g.c = o;
        }
        i && (r.$$events = i), f = t(h, r) || {}, o && an();
      }
    ), () => {
      var m;
      for (var h of a) {
        e.removeEventListener(h, Bn);
        var g = (
          /** @type {number} */
          dn.get(h)
        );
        --g === 0 ? (document.removeEventListener(h, Bn), dn.delete(h)) : dn.set(h, g);
      }
      fi.delete(u), d !== n && ((m = d.parentNode) == null || m.removeChild(d));
    };
  });
  return ci.set(f, c), f;
}
let ci = /* @__PURE__ */ new WeakMap();
function eo(t, e) {
  const n = ci.get(t);
  return n ? (ci.delete(t), n(e)) : Promise.resolve();
}
var Qt, se, Dt, Ze, ir, or, Hr;
class Ol {
  /**
   * @param {TemplateNode} anchor
   * @param {boolean} transition
   */
  constructor(e, n = !0) {
    /** @type {TemplateNode} */
    vt(this, "anchor");
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
    Z(this, Dt, /* @__PURE__ */ new Map());
    /**
     * Keys of effects that are currently outroing
     * @type {Set<Key>}
     */
    Z(this, Ze, /* @__PURE__ */ new Set());
    /**
     * Whether to pause (i.e. outro) on change, or destroy immediately.
     * This is necessary for `<svelte:element>`
     */
    Z(this, ir, !0);
    Z(this, or, () => {
      var e = (
        /** @type {Batch} */
        it
      );
      if (y(this, Qt).has(e)) {
        var n = (
          /** @type {Key} */
          y(this, Qt).get(e)
        ), r = y(this, se).get(n);
        if (r)
          Ci(r), y(this, Ze).delete(n);
        else {
          var i = y(this, Dt).get(n);
          i && (y(this, se).set(n, i.effect), y(this, Dt).delete(n), i.fragment.lastChild.remove(), this.anchor.before(i.fragment), r = i.effect);
        }
        for (const [o, s] of y(this, Qt)) {
          if (y(this, Qt).delete(o), o === e)
            break;
          const a = y(this, Dt).get(s);
          a && (Rt(a.effect), y(this, Dt).delete(s));
        }
        for (const [o, s] of y(this, se)) {
          if (o === n || y(this, Ze).has(o)) continue;
          const a = () => {
            if (Array.from(y(this, Qt).values()).includes(o)) {
              var f = document.createDocumentFragment();
              ps(s, f), f.append(en()), y(this, Dt).set(o, { effect: s, fragment: f });
            } else
              Rt(s);
            y(this, Ze).delete(o), y(this, se).delete(o);
          };
          y(this, ir) || !r ? (y(this, Ze).add(o), Je(s, a, !1)) : a();
        }
      }
    });
    /**
     * @param {Batch} batch
     */
    Z(this, Hr, (e) => {
      y(this, Qt).delete(e);
      const n = Array.from(y(this, Qt).values());
      for (const [r, i] of y(this, Dt))
        n.includes(r) || (Rt(i.effect), y(this, Dt).delete(r));
    });
    this.anchor = e, G(this, ir, n);
  }
  /**
   *
   * @param {any} key
   * @param {null | ((target: TemplateNode) => void)} fn
   */
  ensure(e, n) {
    var r = (
      /** @type {Batch} */
      it
    ), i = as();
    if (n && !y(this, se).has(e) && !y(this, Dt).has(e))
      if (i) {
        var o = document.createDocumentFragment(), s = en();
        o.append(s), y(this, Dt).set(e, {
          effect: qt(() => n(s)),
          fragment: o
        });
      } else
        y(this, se).set(
          e,
          qt(() => n(this.anchor))
        );
    if (y(this, Qt).set(r, e), i) {
      for (const [a, u] of y(this, se))
        a === e ? r.skipped_effects.delete(u) : r.skipped_effects.add(u);
      for (const [a, u] of y(this, Dt))
        a === e ? r.skipped_effects.delete(u.effect) : r.skipped_effects.add(u.effect);
      r.oncommit(y(this, or)), r.ondiscard(y(this, Hr));
    } else
      y(this, or).call(this);
  }
}
Qt = new WeakMap(), se = new WeakMap(), Dt = new WeakMap(), Ze = new WeakMap(), ir = new WeakMap(), or = new WeakMap(), Hr = new WeakMap();
function pt(t, e, n = !1) {
  var r = new Ol(t), i = n ? Pn : 0;
  function o(s, a) {
    r.ensure(s, a);
  }
  Ti(() => {
    var s = !1;
    e((a, u = !0) => {
      s = !0, o(u, a);
    }), s || o(!1, null);
  }, i);
}
function Ns(t, e) {
  return e;
}
function Dl(t, e, n) {
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
            hi(Br(o.done)), h.delete(o), h.size === 0 && (t.outrogroups = null);
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
      xl(c), c.append(f), t.items.clear();
    }
    hi(e, !u);
  } else
    o = {
      pending: new Set(e),
      done: /* @__PURE__ */ new Set()
    }, (t.outrogroups ?? (t.outrogroups = /* @__PURE__ */ new Set())).add(o);
}
function hi(t, e = !0) {
  for (var n = 0; n < t.length; n++)
    Rt(t[n], e);
}
var no;
function Be(t, e, n, r, i, o = null) {
  var s = t, a = /* @__PURE__ */ new Map(), u = null, f = /* @__PURE__ */ $o(() => {
    var b = n();
    return Yo(b) ? b : b == null ? [] : Br(b);
  }), c, d = !0;
  function h() {
    m.fallback = u, Yl(m, c, s, e, r), u !== null && (c.length === 0 ? (u.f & Ce) === 0 ? Ci(u) : (u.f ^= Ce, Vn(u, null, s)) : Je(u, () => {
      u = null;
    }));
  }
  var g = Ti(() => {
    c = /** @type {V[]} */
    l(f);
    for (var b = c.length, R = /* @__PURE__ */ new Set(), S = (
      /** @type {Batch} */
      it
    ), Y = as(), P = 0; P < b; P += 1) {
      var w = c[P], T = r(w, P), k = d ? null : a.get(T);
      k ? (k.v && Cn(k.v, w), k.i && Cn(k.i, P), Y && S.skipped_effects.delete(k.e)) : (k = Hl(
        a,
        d ? s : no ?? (no = en()),
        w,
        T,
        P,
        i,
        e,
        n
      ), d || (k.e.f |= Ce), a.set(T, k)), R.add(T);
    }
    if (b === 0 && o && !u && (d ? u = qt(() => o(s)) : (u = qt(() => o(no ?? (no = en()))), u.f |= Ce)), !d)
      if (Y) {
        for (const [M, F] of a)
          R.has(M) || S.skipped_effects.add(F.e);
        S.oncommit(h), S.ondiscard(() => {
        });
      } else
        h();
    l(f);
  }), m = { effect: g, items: a, outrogroups: null, fallback: u };
  d = !1;
}
function Yl(t, e, n, r, i) {
  var F;
  var o = e.length, s = t.items, a = t.effect.first, u, f = null, c = [], d = [], h, g, m, b;
  for (b = 0; b < o; b += 1) {
    if (h = e[b], g = i(h, b), m = /** @type {EachItem} */
    s.get(g).e, t.outrogroups !== null)
      for (const D of t.outrogroups)
        D.pending.delete(m), D.done.delete(m);
    if ((m.f & Ce) !== 0)
      if (m.f ^= Ce, m === a)
        Vn(m, null, n);
      else {
        var R = f ? f.next : a;
        m === t.effect.last && (t.effect.last = m.prev), m.prev && (m.prev.next = m.next), m.next && (m.next.prev = m.prev), Ae(t, f, m), Ae(t, m, R), Vn(m, R, n), f = m, c = [], d = [], a = f.next;
        continue;
      }
    if ((m.f & Yt) !== 0 && Ci(m), m !== a) {
      if (u !== void 0 && u.has(m)) {
        if (c.length < d.length) {
          var S = d[0], Y;
          f = S.prev;
          var P = c[0], w = c[c.length - 1];
          for (Y = 0; Y < c.length; Y += 1)
            Vn(c[Y], S, n);
          for (Y = 0; Y < d.length; Y += 1)
            u.delete(d[Y]);
          Ae(t, P.prev, w.next), Ae(t, f, P), Ae(t, w, S), a = S, f = w, b -= 1, c = [], d = [];
        } else
          u.delete(m), Vn(m, a, n), Ae(t, m.prev, m.next), Ae(t, m, f === null ? t.effect.first : f.next), Ae(t, f, m), f = m;
        continue;
      }
      for (c = [], d = []; a !== null && a !== m; )
        (u ?? (u = /* @__PURE__ */ new Set())).add(a), d.push(a), a = a.next;
      if (a === null)
        continue;
    }
    (m.f & Ce) === 0 && c.push(m), f = m, a = m.next;
  }
  if (t.outrogroups !== null) {
    for (const D of t.outrogroups)
      D.pending.size === 0 && (hi(Br(D.done)), (F = t.outrogroups) == null || F.delete(D));
    t.outrogroups.size === 0 && (t.outrogroups = null);
  }
  if (a !== null || u !== void 0) {
    var T = [];
    if (u !== void 0)
      for (m of u)
        (m.f & Yt) === 0 && T.push(m);
    for (; a !== null; )
      (a.f & Yt) === 0 && a !== t.fallback && T.push(a), a = a.next;
    var k = T.length;
    if (k > 0) {
      var M = null;
      Dl(t, T, M);
    }
  }
}
function Hl(t, e, n, r, i, o, s, a) {
  var u = (s & Ga) !== 0 ? (s & Ka) === 0 ? /* @__PURE__ */ _l(n, !1, !1) : tn(n) : null, f = (s & Wa) !== 0 ? tn(i) : null;
  return {
    v: u,
    i: f,
    e: qt(() => (o(e, u ?? n, f ?? i, a), () => {
      t.delete(r);
    }))
  };
}
function Vn(t, e, n) {
  if (t.nodes)
    for (var r = t.nodes.start, i = t.nodes.end, o = e && (e.f & Ce) === 0 ? (
      /** @type {EffectNodes} */
      e.nodes.start
    ) : n; r !== null; ) {
      var s = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ sr(r)
      );
      if (o.before(r), r === i)
        return;
      r = s;
    }
}
function Ae(t, e, n) {
  e === null ? t.effect.first = n : e.next = n, n === null ? t.effect.last = e : n.prev = e;
}
function Ms(t, e, n = !1, r = !1, i = !1) {
  var o = t, s = "";
  ot(() => {
    var a = (
      /** @type {Effect} */
      et
    );
    if (s !== (s = e() ?? "") && (a.nodes !== null && (ds(
      a.nodes.start,
      /** @type {TemplateNode} */
      a.nodes.end
    ), a.nodes = null), s !== "")) {
      var u = s + "";
      n ? u = `<svg>${u}</svg>` : r && (u = `<math>${u}</math>`);
      var f = Fi(u);
      if ((n || r) && (f = /** @type {Element} */
      /* @__PURE__ */ Ut(f)), Zn(
        /** @type {TemplateNode} */
        /* @__PURE__ */ Ut(f),
        /** @type {TemplateNode} */
        f.lastChild
      ), n || r)
        for (; /* @__PURE__ */ Ut(f); )
          o.before(
            /** @type {TemplateNode} */
            /* @__PURE__ */ Ut(f)
          );
      else
        o.before(f);
    }
  });
}
function As(t) {
  var e, n, r = "";
  if (typeof t == "string" || typeof t == "number") r += t;
  else if (typeof t == "object") if (Array.isArray(t)) {
    var i = t.length;
    for (e = 0; e < i; e++) t[e] && (n = As(t[e])) && (r && (r += " "), r += n);
  } else for (n in t) t[n] && (r && (r += " "), r += n);
  return r;
}
function Bl() {
  for (var t, e, n = 0, r = "", i = arguments.length; n < i; n++) (t = arguments[n]) && (e = As(t)) && (r && (r += " "), r += e);
  return r;
}
function Vl(t) {
  return typeof t == "object" ? Bl(t) : t ?? "";
}
const ro = [...` 	
\r\f \v\uFEFF`];
function Xl(t, e, n) {
  var r = t == null ? "" : "" + t;
  if (e && (r = r ? r + " " + e : e), n) {
    for (var i in n)
      if (n[i])
        r = r ? r + " " + i : i;
      else if (r.length)
        for (var o = i.length, s = 0; (s = r.indexOf(i, s)) >= 0; ) {
          var a = s + o;
          (s === 0 || ro.includes(r[s - 1])) && (a === r.length || ro.includes(r[a])) ? r = (s === 0 ? "" : r.substring(0, s)) + r.substring(a + 1) : s = a;
        }
  }
  return r === "" ? null : r;
}
function Li(t, e, n, r, i, o) {
  var s = t.__className;
  if (s !== n || s === void 0) {
    var a = Xl(n, r, o);
    a == null ? t.removeAttribute("class") : t.setAttribute("class", a), t.__className = n;
  } else if (o && i !== o)
    for (var u in o) {
      var f = !!o[u];
      (i == null || f !== !!i[u]) && t.classList.toggle(u, f);
    }
  return o;
}
const ql = Symbol("is custom element"), Ul = Symbol("is html");
function v(t, e, n, r) {
  var i = Gl(t);
  i[e] !== (i[e] = n) && (e === "loading" && (t[Fa] = n), n == null ? t.removeAttribute(e) : typeof n != "string" && Wl(t).includes(e) ? t[e] = n : t.setAttribute(e, n));
}
function Gl(t) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    t.__attributes ?? (t.__attributes = {
      [ql]: t.nodeName.includes("-"),
      [Ul]: t.namespaceURI === el
    })
  );
}
var io = /* @__PURE__ */ new Map();
function Wl(t) {
  var e = t.getAttribute("is") || t.nodeName, n = io.get(e);
  if (n) return n;
  io.set(e, n = []);
  for (var r, i = t, o = Element.prototype; o !== i; ) {
    r = Ia(i);
    for (var s in r)
      r[s].set && n.push(s);
    i = Ho(i);
  }
  return n;
}
function oo(t, e) {
  return t === e || (t == null ? void 0 : t[Un]) === e;
}
function so(t = {}, e, n, r) {
  return Sl(() => {
    var i, o;
    return fs(() => {
      i = o, o = [], Ri(() => {
        t !== n(...o) && (e(t, ...o), i && oo(n(...i), t) && e(null, ...i));
      });
    }), () => {
      Fe(() => {
        o && oo(n(...o), t) && e(null, ...o);
      });
    };
  }), t;
}
let dr = !1;
function Kl(t) {
  var e = dr;
  try {
    return dr = !1, [t(), dr];
  } finally {
    dr = e;
  }
}
function bt(t, e, n, r) {
  var Y;
  var i = (n & Qa) !== 0, o = (n & ja) !== 0, s = (
    /** @type {V} */
    r
  ), a = !0, u = () => (a && (a = !1, s = o ? Ri(
    /** @type {() => V} */
    r
  ) : (
    /** @type {V} */
    r
  )), s), f;
  if (i) {
    var c = Un in t || Ra in t;
    f = ((Y = _n(t, e)) == null ? void 0 : Y.set) ?? (c && e in t ? (P) => t[e] = P : void 0);
  }
  var d, h = !1;
  i ? [d, h] = Kl(() => (
    /** @type {V} */
    t[e]
  )) : d = /** @type {V} */
  t[e], d === void 0 && r !== void 0 && (d = u(), f && (Ba(), f(d)));
  var g;
  if (g = () => {
    var P = (
      /** @type {V} */
      t[e]
    );
    return P === void 0 ? u() : (a = !0, P);
  }, (n & Ja) === 0)
    return g;
  if (f) {
    var m = t.$$legacy;
    return (
      /** @type {() => V} */
      (function(P, w) {
        return arguments.length > 0 ? ((!w || m || h) && f(w ? g() : P), P) : g();
      })
    );
  }
  var b = !1, R = ((n & Za) !== 0 ? Xr : $o)(() => (b = !1, g()));
  i && l(R);
  var S = (
    /** @type {Effect} */
    et
  );
  return (
    /** @type {() => V} */
    (function(P, w) {
      if (arguments.length > 0) {
        const T = w ? l(R) : i ? It(P) : P;
        return B(R, T), b = !0, s !== void 0 && (s = T), P;
      }
      return De && b || (S.f & ye) !== 0 ? R.v : l(R);
    })
  );
}
const Zl = "5";
var Do;
typeof window < "u" && ((Do = window.__svelte ?? (window.__svelte = {})).v ?? (Do.v = /* @__PURE__ */ new Set())).add(Zl);
const Jl = [
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
Jl.map(([t, e]) => [t.slice().sort((n, r) => r.length - n.length), e]);
const Ql = 40, jl = 8, Jr = 16, $l = 5.5;
var Q;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(Q || (Q = {}));
const tu = {
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
}, eu = {
  [Q.Router]: "router",
  [Q.L3Switch]: "l3-switch",
  [Q.L2Switch]: "l2-switch",
  [Q.Firewall]: "firewall",
  [Q.LoadBalancer]: "load-balancer",
  [Q.Server]: "server",
  [Q.AccessPoint]: "access-point",
  [Q.CPE]: "cpe",
  [Q.Cloud]: "cloud",
  [Q.Internet]: "internet",
  [Q.VPN]: "vpn",
  [Q.Database]: "database",
  [Q.Generic]: "generic"
};
function nu(t) {
  if (!t)
    return;
  const e = eu[t];
  if (e)
    return tu[e];
}
function ru(t) {
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
const iu = 1, Is = 2, ou = 4, su = 8;
function au(t) {
  switch (t) {
    case "top":
      return iu;
    case "bottom":
      return Is;
    case "left":
      return ou;
    case "right":
      return su;
  }
}
function Pr(t) {
  return typeof t == "string" ? t : t.node;
}
function zr(t) {
  return typeof t == "string" ? void 0 : t.port;
}
function ao(t) {
  return typeof t == "string" ? { node: t } : t;
}
function lu(t, e, n, r = 2) {
  for (const i of n.values()) {
    const o = i.size.width / 2 + r, s = i.size.height / 2 + r;
    if (t > i.position.x - o && t < i.position.x + o && e > i.position.y - s && e < i.position.y + s)
      return !0;
  }
  return !1;
}
let Qr = null;
async function uu() {
  if (!Qr) {
    const { AvoidLib: t } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await t.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await t.load(process.env.LIBAVOID_WASM_PATH) : await t.load(), Qr = t.getInstance();
  }
  return Qr;
}
async function Wn(t, e, n, r) {
  const i = await uu(), o = {
    edgeStyle: "orthogonal",
    shapeBufferDistance: 10,
    idealNudgingDistance: 20,
    ...r
  }, s = o.edgeStyle === "polyline" ? i.RouterFlag.PolyLineRouting.value : i.RouterFlag.OrthogonalRouting.value, a = new i.Router(s);
  a.setRoutingParameter(i.RoutingParameter.shapeBufferDistance.value, o.shapeBufferDistance), a.setRoutingParameter(i.RoutingParameter.idealNudgingDistance.value, o.idealNudgingDistance), a.setRoutingParameter(i.RoutingParameter.reverseDirectionPenalty.value, 500), a.setRoutingParameter(i.RoutingParameter.segmentPenalty.value, 50), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes.value, !0), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalTouchingColinearSegments.value, !0), a.setRoutingOption(i.RoutingOption.performUnifyingNudgingPreprocessingStep.value, !0), a.setRoutingOption(i.RoutingOption.nudgeSharedPathsWithCommonEndPoint.value, !0);
  try {
    return gu(i, a, t, e, n, o.edgeStyle, o.shapeBufferDistance);
  } finally {
    a.delete();
  }
}
function fu(t, e, n) {
  const r = /* @__PURE__ */ new Map();
  for (const [i, o] of n)
    r.set(i, new t.ShapeRef(e, new t.Rectangle(new t.Point(o.position.x, o.position.y), o.size.width, o.size.height)));
  return r;
}
function cu(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  let o = 1;
  for (const [s, a] of r) {
    const u = e.get(a.nodeId), f = n.get(a.nodeId);
    if (!u || !f)
      continue;
    const c = o++;
    i.set(s, c);
    const d = (a.absolutePosition.x - (f.position.x - f.size.width / 2)) / f.size.width, h = (a.absolutePosition.y - (f.position.y - f.size.height / 2)) / f.size.height, g = a.side === "top" || a.side === "bottom" ? Is : au(a.side);
    new t.ShapeConnectionPin(u, c, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, h)), !0, 0, g).setExclusive(!1);
  }
  return i;
}
function hu(t, e, n, r, i, o, s, a) {
  const u = /* @__PURE__ */ new Map();
  for (const [f, c] of s.entries()) {
    const d = c.id ?? `__link_${f}`, h = Pr(c.from), g = Pr(c.to);
    if (!n.has(h) || !n.has(g))
      continue;
    const m = zr(c.from), b = zr(c.to), R = m ? `${h}:${m}` : null, S = b ? `${g}:${b}` : null, Y = R ? r.get(R) : void 0;
    let P;
    if (Y !== void 0)
      P = new t.ConnEnd(n.get(h), Y);
    else {
      const V = R ? o.get(R) : void 0, I = i.get(h), q = (V == null ? void 0 : V.absolutePosition) ?? (I == null ? void 0 : I.position);
      if (!q)
        continue;
      P = new t.ConnEnd(new t.Point(q.x, q.y));
    }
    const w = S ? o.get(S) : void 0, T = i.get(g), k = (w == null ? void 0 : w.absolutePosition) ?? (T == null ? void 0 : T.position);
    if (!k)
      continue;
    const M = new t.ConnEnd(new t.Point(k.x, k.y)), F = new t.ConnRef(e, P, M), D = S ? o.get(S) : null;
    if (D != null && D.side) {
      const I = Math.max(D.size.width, D.size.height) / 2 + 16;
      let q = D.absolutePosition.x, X = D.absolutePosition.y;
      switch (D.side) {
        case "top":
          X -= I;
          break;
        case "bottom":
          X += I;
          break;
        case "left":
          q -= I;
          break;
        case "right":
          q += I;
          break;
      }
      if (!lu(q, X, i, a)) {
        const p = new t.CheckpointVector();
        p.push_back(new t.Checkpoint(new t.Point(q, X))), F.setRoutingCheckpoints(p);
      }
    }
    u.set(d, F);
  }
  return e.processTransaction(), u;
}
function du(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  for (const [o, s] of n.entries()) {
    const a = s.id ?? `__link_${o}`, u = t.get(a);
    if (!u)
      continue;
    const f = u.displayRoute(), c = [];
    for (let k = 0; k < f.size(); k++) {
      const M = f.at(k);
      c.push({ x: M.x, y: M.y });
    }
    const d = Pr(s.from), h = Pr(s.to), g = zr(s.from), m = zr(s.to), b = g ? `${d}:${g}` : null, R = m ? `${h}:${m}` : null, S = b ? e.get(b) : void 0, Y = R ? e.get(R) : void 0;
    S && c.length > 0 && (c[0] = { x: S.absolutePosition.x, y: S.absolutePosition.y }), Y && c.length > 0 && (c[c.length - 1] = {
      x: Y.absolutePosition.x,
      y: Y.absolutePosition.y
    });
    const P = c[0], w = c[c.length - 1], T = r === "straight" && c.length > 2 && P && w ? [P, w] : c;
    i.set(a, {
      id: a,
      fromPortId: g ? `${d}:${g}` : null,
      toPortId: m ? `${h}:${m}` : null,
      fromNodeId: d,
      toNodeId: h,
      fromEndpoint: ao(s.from),
      toEndpoint: ao(s.to),
      points: T,
      width: ru(s),
      link: s
    });
  }
  return i;
}
function gu(t, e, n, r, i, o, s) {
  const a = fu(t, e, n), u = cu(t, a, n, r), f = hu(t, e, a, u, n, r, i, s), c = du(f, r, i, o), d = vu(c);
  return pu(d);
}
function vu(t) {
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
  lo(n, e, "y");
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
  return lo(r, e, "x"), e;
}
function lo(t, e, n) {
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
      uo(e, i, -f, n), uo(e, o, f, n), i.fixed -= f, o.fixed += f;
    }
  }
}
function uo(t, e, n, r) {
  const i = t.get(e.edgeId);
  if (!i)
    return;
  const o = i.points[e.pointIndex], s = i.points[e.pointIndex + 1];
  !o || !s || (r === "y" ? (o.y += n, s.y += n) : (o.x += n, s.x += n));
}
const mu = 8, fo = 6;
function pu(t) {
  const e = /* @__PURE__ */ new Map();
  for (const [n, r] of t)
    e.set(n, {
      ...r,
      points: _u(r.points, mu)
    });
  return e;
}
function _u(t, e) {
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
    const h = (a.x - s.x) / f, g = (a.y - s.y) / f, m = (u.x - s.x) / c, b = (u.y - s.y) / c, R = h * b - g * m;
    if (Math.abs(R) < 1e-3) {
      n.push({ ...s });
      continue;
    }
    const S = s.x + h * d, Y = s.y + g * d, P = s.x + m * d, w = s.y + b * d;
    for (let T = 0; T <= fo; T++) {
      const k = T / fo, M = 1 - k, F = M * M * S + 2 * M * k * s.x + k * k * P, D = M * M * Y + 2 * M * k * s.y + k * k * w;
      n.push({ x: F, y: D });
    }
  }
  const i = t[t.length - 1];
  return i && n.push({ ...i }), n;
}
const nn = 8;
function Ps(t, e, n = nn) {
  return t.x - t.w / 2 - n < e.x + e.w / 2 && t.x + t.w / 2 + n > e.x - e.w / 2 && t.y - t.h / 2 - n < e.y + e.h / 2 && t.y + t.h / 2 + n > e.y - e.h / 2;
}
function zs(t, e, n = nn) {
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
function Ts(t, e, n, r) {
  const i = [];
  for (const [o, s] of n)
    o !== t && i.push({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height });
  if (r)
    for (const [o, s] of r)
      o !== t && (e && yu(e, o, r) || i.push(di(s.bounds)));
  return i;
}
function Cs(t, e, n = nn) {
  let r = t.x, i = t.y;
  for (const o of e) {
    const s = { x: r, y: i, w: t.w, h: t.h };
    if (Ps(s, o, n)) {
      const a = zs(s, o, n);
      r = a.x, i = a.y;
    }
  }
  return { x: r, y: i };
}
function Rs(t, e, n, r, i = nn, o) {
  const s = r.get(t);
  if (!s)
    return { x: e, y: n };
  const a = Ts(t, s.node.parent, r, o);
  return Cs({ x: e, y: n, w: s.size.width, h: s.size.height }, a, i);
}
function yu(t, e, n) {
  let r = t;
  const i = /* @__PURE__ */ new Set();
  for (; r; ) {
    if (r === e)
      return !0;
    if (i.has(r))
      return !1;
    i.add(r);
    const o = n.get(r);
    r = o == null ? void 0 : o.subgraph.parent;
  }
  return !1;
}
const gr = 20, co = 28;
function di(t) {
  return { x: t.x + t.width / 2, y: t.y + t.height / 2, w: t.width, h: t.height };
}
function Oi(t, e, n, r, i, o) {
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
    }), Oi(s, e, n, r, i, o));
}
function Tr(t, e, n) {
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
      const g = h.size.width / 2, m = h.size.height / 2;
      a = Math.min(a, h.position.x - g), u = Math.min(u, h.position.y - m), f = Math.max(f, h.position.x + g), c = Math.max(c, h.position.y + m);
    }
    for (const h of e.values())
      h.subgraph.parent === o && (d = !0, a = Math.min(a, h.bounds.x), u = Math.min(u, h.bounds.y), f = Math.max(f, h.bounds.x + h.bounds.width), c = Math.max(c, h.bounds.y + h.bounds.height));
    d && e.set(o, {
      ...s,
      bounds: {
        x: a - gr,
        y: u - gr - co,
        width: f - a + gr * 2,
        height: c - u + gr * 2 + co
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
      const c = di(s.bounds), d = di(f.bounds);
      if (!Ps(c, d, nn))
        continue;
      const h = zs(d, c, nn), g = h.x - d.x, m = h.y - d.y;
      g === 0 && m === 0 || (e.set(u, {
        ...f,
        bounds: { ...f.bounds, x: f.bounds.x + g, y: f.bounds.y + m }
      }), Oi(u, g, m, t, e, n));
    }
  }
  for (const [o, s] of t) {
    const a = Ts(o, s.node.parent, t, e), u = Cs({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height }, a);
    if (u.x !== s.position.x || u.y !== s.position.y) {
      const f = u.x - s.position.x, c = u.y - s.position.y;
      t.set(o, { ...s, position: u });
      for (const [d, h] of n)
        h.nodeId === o && n.set(d, {
          ...h,
          absolutePosition: { x: h.absolutePosition.x + f, y: h.absolutePosition.y + c }
        });
    }
  }
}
async function wu(t, e, n, r, i, o = nn) {
  const s = r.nodes.get(t);
  if (!s)
    return null;
  const { x: a, y: u } = Rs(t, e, n, r.nodes, o, r.subgraphs), f = a - s.position.x, c = u - s.position.y;
  if (f === 0 && c === 0)
    return null;
  const d = new Map(r.nodes);
  d.set(t, { ...s, position: { x: a, y: u } });
  const h = new Map(r.ports);
  for (const [b, R] of r.ports)
    R.nodeId === t && h.set(b, {
      ...R,
      absolutePosition: {
        x: R.absolutePosition.x + f,
        y: R.absolutePosition.y + c
      }
    });
  let g;
  r.subgraphs && (g = new Map(r.subgraphs), Tr(d, g, h));
  const m = await Wn(d, h, i);
  return { nodes: d, ports: h, edges: m, subgraphs: g };
}
async function xu(t, e, n, r, i) {
  const o = r.subgraphs.get(t);
  if (!o)
    return null;
  const s = e - o.bounds.x, a = n - o.bounds.y;
  if (s === 0 && a === 0)
    return null;
  const u = new Map(r.nodes), f = new Map(r.ports), c = new Map(r.subgraphs);
  c.set(t, { ...o, bounds: { ...o.bounds, x: e, y: n } }), Oi(t, s, a, u, c, f), Tr(u, c, f);
  const d = await Wn(u, f, i);
  return { nodes: u, ports: f, edges: d, subgraphs: c };
}
function bu(t, e, n, r, i) {
  return t.some((o) => {
    const s = typeof o.from == "string" ? { node: o.from } : o.from, a = typeof o.to == "string" ? { node: o.to } : o.to;
    return s.node === e && s.port === n && a.node === r && a.port === i || s.node === r && s.port === i && a.node === e && a.port === n;
  });
}
function ku(t, e, n) {
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
const ho = 8, go = 24;
function Eu(t, e) {
  const n = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const r of e.values())
    r.nodeId === t && r.side && n[r.side]++;
  return n;
}
function Su(t, e) {
  const n = Math.max(t.top, t.bottom), r = Math.max(t.left, t.right);
  return {
    width: Math.max(e.width, (n + 1) * go),
    height: Math.max(e.height, (r + 1) * go)
  };
}
function Nu(t, e, n, r) {
  const i = n.position.x, o = n.position.y, s = n.size.width / 2, a = n.size.height / 2, u = [];
  for (const f of r.values())
    f.nodeId === t && f.side === e && u.push(f);
  if (u.length !== 0)
    for (const [f, c] of u.entries()) {
      const d = (f + 1) / (u.length + 1);
      let h, g;
      switch (e) {
        case "top":
          h = i - s + n.size.width * d, g = o - a;
          break;
        case "bottom":
          h = i - s + n.size.width * d, g = o + a;
          break;
        case "left":
          h = i - s, g = o - a + n.size.height * d;
          break;
        case "right":
          h = i + s, g = o - a + n.size.height * d;
          break;
      }
      r.set(c.id, { ...c, absolutePosition: { x: h, y: g } });
    }
}
function Fs(t, e, n) {
  const r = e.get(t);
  if (!r)
    return;
  const i = Eu(t, n), o = Su(i, r.size);
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
    Nu(t, u, s, n);
}
function Mu(t, e, n, r, i) {
  if (!n.get(t))
    return null;
  const s = ku(t, i, r), a = `${t}:${s}`, u = new Map(r);
  u.set(a, {
    id: a,
    nodeId: t,
    label: s,
    absolutePosition: { x: 0, y: 0 },
    side: e,
    size: { width: ho, height: ho }
  });
  const f = new Map(n);
  return Fs(t, f, u), { nodes: f, ports: u, portId: a };
}
function Au(t, e, n, r) {
  const i = n.get(t);
  if (!i)
    return null;
  const o = i.nodeId, s = i.label, a = r.filter((c) => {
    const d = typeof c.from == "string" ? { node: c.from } : c.from, h = typeof c.to == "string" ? { node: c.to } : c.to;
    return !(d.node === o && d.port === s || h.node === o && h.port === s);
  }), u = new Map(n);
  u.delete(t);
  const f = new Map(e);
  return Fs(o, f, u), { nodes: f, ports: u, links: a };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function Ls(t) {
  return typeof t > "u" || t === null;
}
function Iu(t) {
  return typeof t == "object" && t !== null;
}
function Pu(t) {
  return Array.isArray(t) ? t : Ls(t) ? [] : [t];
}
function zu(t, e) {
  var n, r, i, o;
  if (e)
    for (o = Object.keys(e), n = 0, r = o.length; n < r; n += 1)
      i = o[n], t[i] = e[i];
  return t;
}
function Tu(t, e) {
  var n = "", r;
  for (r = 0; r < e; r += 1)
    n += t;
  return n;
}
function Cu(t) {
  return t === 0 && Number.NEGATIVE_INFINITY === 1 / t;
}
var Ru = Ls, Fu = Iu, Lu = Pu, Ou = Tu, Du = Cu, Yu = zu, Di = {
  isNothing: Ru,
  isObject: Fu,
  toArray: Lu,
  repeat: Ou,
  isNegativeZero: Du,
  extend: Yu
};
function Os(t, e) {
  var n = "", r = t.reason || "(unknown reason)";
  return t.mark ? (t.mark.name && (n += 'in "' + t.mark.name + '" '), n += "(" + (t.mark.line + 1) + ":" + (t.mark.column + 1) + ")", !e && t.mark.snippet && (n += `

` + t.mark.snippet), r + " " + n) : r;
}
function Qn(t, e) {
  Error.call(this), this.name = "YAMLException", this.reason = t, this.mark = e, this.message = Os(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
Qn.prototype = Object.create(Error.prototype);
Qn.prototype.constructor = Qn;
Qn.prototype.toString = function(e) {
  return this.name + ": " + Os(this, e);
};
var Ve = Qn, Hu = [
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
], Bu = [
  "scalar",
  "sequence",
  "mapping"
];
function Vu(t) {
  var e = {};
  return t !== null && Object.keys(t).forEach(function(n) {
    t[n].forEach(function(r) {
      e[String(r)] = n;
    });
  }), e;
}
function Xu(t, e) {
  if (e = e || {}, Object.keys(e).forEach(function(n) {
    if (Hu.indexOf(n) === -1)
      throw new Ve('Unknown option "' + n + '" is met in definition of "' + t + '" YAML type.');
  }), this.options = e, this.tag = t, this.kind = e.kind || null, this.resolve = e.resolve || function() {
    return !0;
  }, this.construct = e.construct || function(n) {
    return n;
  }, this.instanceOf = e.instanceOf || null, this.predicate = e.predicate || null, this.represent = e.represent || null, this.representName = e.representName || null, this.defaultStyle = e.defaultStyle || null, this.multi = e.multi || !1, this.styleAliases = Vu(e.styleAliases || null), Bu.indexOf(this.kind) === -1)
    throw new Ve('Unknown kind "' + this.kind + '" is specified for "' + t + '" YAML type.');
}
var Et = Xu;
function vo(t, e) {
  var n = [];
  return t[e].forEach(function(r) {
    var i = n.length;
    n.forEach(function(o, s) {
      o.tag === r.tag && o.kind === r.kind && o.multi === r.multi && (i = s);
    }), n[i] = r;
  }), n;
}
function qu() {
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
function gi(t) {
  return this.extend(t);
}
gi.prototype.extend = function(e) {
  var n = [], r = [];
  if (e instanceof Et)
    r.push(e);
  else if (Array.isArray(e))
    r = r.concat(e);
  else if (e && (Array.isArray(e.implicit) || Array.isArray(e.explicit)))
    e.implicit && (n = n.concat(e.implicit)), e.explicit && (r = r.concat(e.explicit));
  else
    throw new Ve("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  n.forEach(function(o) {
    if (!(o instanceof Et))
      throw new Ve("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (o.loadKind && o.loadKind !== "scalar")
      throw new Ve("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (o.multi)
      throw new Ve("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), r.forEach(function(o) {
    if (!(o instanceof Et))
      throw new Ve("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(gi.prototype);
  return i.implicit = (this.implicit || []).concat(n), i.explicit = (this.explicit || []).concat(r), i.compiledImplicit = vo(i, "implicit"), i.compiledExplicit = vo(i, "explicit"), i.compiledTypeMap = qu(i.compiledImplicit, i.compiledExplicit), i;
};
var Uu = gi, Gu = new Et("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(t) {
    return t !== null ? t : "";
  }
}), Wu = new Et("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(t) {
    return t !== null ? t : [];
  }
}), Ku = new Et("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(t) {
    return t !== null ? t : {};
  }
}), Zu = new Uu({
  explicit: [
    Gu,
    Wu,
    Ku
  ]
});
function Ju(t) {
  if (t === null) return !0;
  var e = t.length;
  return e === 1 && t === "~" || e === 4 && (t === "null" || t === "Null" || t === "NULL");
}
function Qu() {
  return null;
}
function ju(t) {
  return t === null;
}
var $u = new Et("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Ju,
  construct: Qu,
  predicate: ju,
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
function tf(t) {
  if (t === null) return !1;
  var e = t.length;
  return e === 4 && (t === "true" || t === "True" || t === "TRUE") || e === 5 && (t === "false" || t === "False" || t === "FALSE");
}
function ef(t) {
  return t === "true" || t === "True" || t === "TRUE";
}
function nf(t) {
  return Object.prototype.toString.call(t) === "[object Boolean]";
}
var rf = new Et("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: tf,
  construct: ef,
  predicate: nf,
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
function of(t) {
  return 48 <= t && t <= 57 || 65 <= t && t <= 70 || 97 <= t && t <= 102;
}
function sf(t) {
  return 48 <= t && t <= 55;
}
function af(t) {
  return 48 <= t && t <= 57;
}
function lf(t) {
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
          if (!of(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
    if (i === "o") {
      for (n++; n < e; n++)
        if (i = t[n], i !== "_") {
          if (!sf(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; n < e; n++)
    if (i = t[n], i !== "_") {
      if (!af(t.charCodeAt(n)))
        return !1;
      r = !0;
    }
  return !(!r || i === "_");
}
function uf(t) {
  var e = t, n = 1, r;
  if (e.indexOf("_") !== -1 && (e = e.replace(/_/g, "")), r = e[0], (r === "-" || r === "+") && (r === "-" && (n = -1), e = e.slice(1), r = e[0]), e === "0") return 0;
  if (r === "0") {
    if (e[1] === "b") return n * parseInt(e.slice(2), 2);
    if (e[1] === "x") return n * parseInt(e.slice(2), 16);
    if (e[1] === "o") return n * parseInt(e.slice(2), 8);
  }
  return n * parseInt(e, 10);
}
function ff(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && t % 1 === 0 && !Di.isNegativeZero(t);
}
var cf = new Et("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: lf,
  construct: uf,
  predicate: ff,
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
}), hf = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function df(t) {
  return !(t === null || !hf.test(t) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  t[t.length - 1] === "_");
}
function gf(t) {
  var e, n;
  return e = t.replace(/_/g, "").toLowerCase(), n = e[0] === "-" ? -1 : 1, "+-".indexOf(e[0]) >= 0 && (e = e.slice(1)), e === ".inf" ? n === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : e === ".nan" ? NaN : n * parseFloat(e, 10);
}
var vf = /^[-+]?[0-9]+e/;
function mf(t, e) {
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
  else if (Di.isNegativeZero(t))
    return "-0.0";
  return n = t.toString(10), vf.test(n) ? n.replace("e", ".e") : n;
}
function pf(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && (t % 1 !== 0 || Di.isNegativeZero(t));
}
var _f = new Et("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: df,
  construct: gf,
  predicate: pf,
  represent: mf,
  defaultStyle: "lowercase"
}), yf = Zu.extend({
  implicit: [
    $u,
    rf,
    cf,
    _f
  ]
}), wf = yf, Ds = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Ys = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function xf(t) {
  return t === null ? !1 : Ds.exec(t) !== null || Ys.exec(t) !== null;
}
function bf(t) {
  var e, n, r, i, o, s, a, u = 0, f = null, c, d, h;
  if (e = Ds.exec(t), e === null && (e = Ys.exec(t)), e === null) throw new Error("Date resolve error");
  if (n = +e[1], r = +e[2] - 1, i = +e[3], !e[4])
    return new Date(Date.UTC(n, r, i));
  if (o = +e[4], s = +e[5], a = +e[6], e[7]) {
    for (u = e[7].slice(0, 3); u.length < 3; )
      u += "0";
    u = +u;
  }
  return e[9] && (c = +e[10], d = +(e[11] || 0), f = (c * 60 + d) * 6e4, e[9] === "-" && (f = -f)), h = new Date(Date.UTC(n, r, i, o, s, a, u)), f && h.setTime(h.getTime() - f), h;
}
function kf(t) {
  return t.toISOString();
}
var Ef = new Et("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: xf,
  construct: bf,
  instanceOf: Date,
  represent: kf
});
function Sf(t) {
  return t === "<<" || t === null;
}
var Nf = new Et("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: Sf
}), Yi = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function Mf(t) {
  if (t === null) return !1;
  var e, n, r = 0, i = t.length, o = Yi;
  for (n = 0; n < i; n++)
    if (e = o.indexOf(t.charAt(n)), !(e > 64)) {
      if (e < 0) return !1;
      r += 6;
    }
  return r % 8 === 0;
}
function Af(t) {
  var e, n, r = t.replace(/[\r\n=]/g, ""), i = r.length, o = Yi, s = 0, a = [];
  for (e = 0; e < i; e++)
    e % 4 === 0 && e && (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)), s = s << 6 | o.indexOf(r.charAt(e));
  return n = i % 4 * 6, n === 0 ? (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)) : n === 18 ? (a.push(s >> 10 & 255), a.push(s >> 2 & 255)) : n === 12 && a.push(s >> 4 & 255), new Uint8Array(a);
}
function If(t) {
  var e = "", n = 0, r, i, o = t.length, s = Yi;
  for (r = 0; r < o; r++)
    r % 3 === 0 && r && (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]), n = (n << 8) + t[r];
  return i = o % 3, i === 0 ? (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]) : i === 2 ? (e += s[n >> 10 & 63], e += s[n >> 4 & 63], e += s[n << 2 & 63], e += s[64]) : i === 1 && (e += s[n >> 2 & 63], e += s[n << 4 & 63], e += s[64], e += s[64]), e;
}
function Pf(t) {
  return Object.prototype.toString.call(t) === "[object Uint8Array]";
}
var zf = new Et("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: Mf,
  construct: Af,
  predicate: Pf,
  represent: If
}), Tf = Object.prototype.hasOwnProperty, Cf = Object.prototype.toString;
function Rf(t) {
  if (t === null) return !0;
  var e = [], n, r, i, o, s, a = t;
  for (n = 0, r = a.length; n < r; n += 1) {
    if (i = a[n], s = !1, Cf.call(i) !== "[object Object]") return !1;
    for (o in i)
      if (Tf.call(i, o))
        if (!s) s = !0;
        else return !1;
    if (!s) return !1;
    if (e.indexOf(o) === -1) e.push(o);
    else return !1;
  }
  return !0;
}
function Ff(t) {
  return t !== null ? t : [];
}
var Lf = new Et("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: Rf,
  construct: Ff
}), Of = Object.prototype.toString;
function Df(t) {
  if (t === null) return !0;
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1) {
    if (r = s[e], Of.call(r) !== "[object Object]" || (i = Object.keys(r), i.length !== 1)) return !1;
    o[e] = [i[0], r[i[0]]];
  }
  return !0;
}
function Yf(t) {
  if (t === null) return [];
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1)
    r = s[e], i = Object.keys(r), o[e] = [i[0], r[i[0]]];
  return o;
}
var Hf = new Et("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: Df,
  construct: Yf
}), Bf = Object.prototype.hasOwnProperty;
function Vf(t) {
  if (t === null) return !0;
  var e, n = t;
  for (e in n)
    if (Bf.call(n, e) && n[e] !== null)
      return !1;
  return !0;
}
function Xf(t) {
  return t !== null ? t : {};
}
var qf = new Et("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Vf,
  construct: Xf
});
wf.extend({
  implicit: [
    Ef,
    Nf
  ],
  explicit: [
    zf,
    Lf,
    Hf,
    qf
  ]
});
function mo(t) {
  return t === 48 ? "\0" : t === 97 ? "\x07" : t === 98 ? "\b" : t === 116 || t === 9 ? "	" : t === 110 ? `
` : t === 118 ? "\v" : t === 102 ? "\f" : t === 114 ? "\r" : t === 101 ? "\x1B" : t === 32 ? " " : t === 34 ? '"' : t === 47 ? "/" : t === 92 ? "\\" : t === 78 ? "" : t === 95 ? " " : t === 76 ? "\u2028" : t === 80 ? "\u2029" : "";
}
var Uf = new Array(256), Gf = new Array(256);
for (var gn = 0; gn < 256; gn++)
  Uf[gn] = mo(gn) ? 1 : 0, Gf[gn] = mo(gn);
var po;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(po || (po = {}));
const kr = {
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
      [Q.Router]: "#3b82f6",
      [Q.L3Switch]: "#8b5cf6",
      [Q.L2Switch]: "#a78bfa",
      [Q.Firewall]: "#ef4444",
      [Q.LoadBalancer]: "#f59e0b",
      [Q.Server]: "#10b981",
      [Q.AccessPoint]: "#06b6d4",
      [Q.Cloud]: "#3b82f6",
      [Q.Internet]: "#6366f1",
      [Q.Generic]: "#94a3b8"
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
  ...kr,
  colors: {
    ...kr.colors,
    // Device colors (adjusted for dark)
    devices: (Q.Router + "", Q.L3Switch + "", Q.L2Switch + "", Q.Firewall + "", Q.LoadBalancer + "", Q.Server + "", Q.AccessPoint + "", Q.Cloud + "", Q.Internet + "", Q.Generic + "")
  },
  shadows: {
    ...kr.shadows
  }
});
function Wf(t = kr) {
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
var Kf = { value: () => {
} };
function qr() {
  for (var t = 0, e = arguments.length, n = {}, r; t < e; ++t) {
    if (!(r = arguments[t] + "") || r in n || /[\s.]/.test(r)) throw new Error("illegal type: " + r);
    n[r] = [];
  }
  return new Er(n);
}
function Er(t) {
  this._ = t;
}
function Zf(t, e) {
  return t.trim().split(/^|\s+/).map(function(n) {
    var r = "", i = n.indexOf(".");
    if (i >= 0 && (r = n.slice(i + 1), n = n.slice(0, i)), n && !e.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    return { type: n, name: r };
  });
}
Er.prototype = qr.prototype = {
  constructor: Er,
  on: function(t, e) {
    var n = this._, r = Zf(t + "", n), i, o = -1, s = r.length;
    if (arguments.length < 2) {
      for (; ++o < s; ) if ((i = (t = r[o]).type) && (i = Jf(n[i], t.name))) return i;
      return;
    }
    if (e != null && typeof e != "function") throw new Error("invalid callback: " + e);
    for (; ++o < s; )
      if (i = (t = r[o]).type) n[i] = _o(n[i], t.name, e);
      else if (e == null) for (i in n) n[i] = _o(n[i], t.name, null);
    return this;
  },
  copy: function() {
    var t = {}, e = this._;
    for (var n in e) t[n] = e[n].slice();
    return new Er(t);
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
function Jf(t, e) {
  for (var n = 0, r = t.length, i; n < r; ++n)
    if ((i = t[n]).name === e)
      return i.value;
}
function _o(t, e, n) {
  for (var r = 0, i = t.length; r < i; ++r)
    if (t[r].name === e) {
      t[r] = Kf, t = t.slice(0, r).concat(t.slice(r + 1));
      break;
    }
  return n != null && t.push({ name: e, value: n }), t;
}
var vi = "http://www.w3.org/1999/xhtml";
const yo = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: vi,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function Ur(t) {
  var e = t += "", n = e.indexOf(":");
  return n >= 0 && (e = t.slice(0, n)) !== "xmlns" && (t = t.slice(n + 1)), yo.hasOwnProperty(e) ? { space: yo[e], local: t } : t;
}
function Qf(t) {
  return function() {
    var e = this.ownerDocument, n = this.namespaceURI;
    return n === vi && e.documentElement.namespaceURI === vi ? e.createElement(t) : e.createElementNS(n, t);
  };
}
function jf(t) {
  return function() {
    return this.ownerDocument.createElementNS(t.space, t.local);
  };
}
function Hs(t) {
  var e = Ur(t);
  return (e.local ? jf : Qf)(e);
}
function $f() {
}
function Hi(t) {
  return t == null ? $f : function() {
    return this.querySelector(t);
  };
}
function tc(t) {
  typeof t != "function" && (t = Hi(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = new Array(s), u, f, c = 0; c < s; ++c)
      (u = o[c]) && (f = t.call(u, u.__data__, c, o)) && ("__data__" in u && (f.__data__ = u.__data__), a[c] = f);
  return new Ht(r, this._parents);
}
function ec(t) {
  return t == null ? [] : Array.isArray(t) ? t : Array.from(t);
}
function nc() {
  return [];
}
function Bs(t) {
  return t == null ? nc : function() {
    return this.querySelectorAll(t);
  };
}
function rc(t) {
  return function() {
    return ec(t.apply(this, arguments));
  };
}
function ic(t) {
  typeof t == "function" ? t = rc(t) : t = Bs(t);
  for (var e = this._groups, n = e.length, r = [], i = [], o = 0; o < n; ++o)
    for (var s = e[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && (r.push(t.call(u, u.__data__, f, s)), i.push(u));
  return new Ht(r, i);
}
function Vs(t) {
  return function() {
    return this.matches(t);
  };
}
function Xs(t) {
  return function(e) {
    return e.matches(t);
  };
}
var oc = Array.prototype.find;
function sc(t) {
  return function() {
    return oc.call(this.children, t);
  };
}
function ac() {
  return this.firstElementChild;
}
function lc(t) {
  return this.select(t == null ? ac : sc(typeof t == "function" ? t : Xs(t)));
}
var uc = Array.prototype.filter;
function fc() {
  return Array.from(this.children);
}
function cc(t) {
  return function() {
    return uc.call(this.children, t);
  };
}
function hc(t) {
  return this.selectAll(t == null ? fc : cc(typeof t == "function" ? t : Xs(t)));
}
function dc(t) {
  typeof t != "function" && (t = Vs(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new Ht(r, this._parents);
}
function qs(t) {
  return new Array(t.length);
}
function gc() {
  return new Ht(this._enter || this._groups.map(qs), this._parents);
}
function Cr(t, e) {
  this.ownerDocument = t.ownerDocument, this.namespaceURI = t.namespaceURI, this._next = null, this._parent = t, this.__data__ = e;
}
Cr.prototype = {
  constructor: Cr,
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
function vc(t) {
  return function() {
    return t;
  };
}
function mc(t, e, n, r, i, o) {
  for (var s = 0, a, u = e.length, f = o.length; s < f; ++s)
    (a = e[s]) ? (a.__data__ = o[s], r[s] = a) : n[s] = new Cr(t, o[s]);
  for (; s < u; ++s)
    (a = e[s]) && (i[s] = a);
}
function pc(t, e, n, r, i, o, s) {
  var a, u, f = /* @__PURE__ */ new Map(), c = e.length, d = o.length, h = new Array(c), g;
  for (a = 0; a < c; ++a)
    (u = e[a]) && (h[a] = g = s.call(u, u.__data__, a, e) + "", f.has(g) ? i[a] = u : f.set(g, u));
  for (a = 0; a < d; ++a)
    g = s.call(t, o[a], a, o) + "", (u = f.get(g)) ? (r[a] = u, u.__data__ = o[a], f.delete(g)) : n[a] = new Cr(t, o[a]);
  for (a = 0; a < c; ++a)
    (u = e[a]) && f.get(h[a]) === u && (i[a] = u);
}
function _c(t) {
  return t.__data__;
}
function yc(t, e) {
  if (!arguments.length) return Array.from(this, _c);
  var n = e ? pc : mc, r = this._parents, i = this._groups;
  typeof t != "function" && (t = vc(t));
  for (var o = i.length, s = new Array(o), a = new Array(o), u = new Array(o), f = 0; f < o; ++f) {
    var c = r[f], d = i[f], h = d.length, g = wc(t.call(c, c && c.__data__, f, r)), m = g.length, b = a[f] = new Array(m), R = s[f] = new Array(m), S = u[f] = new Array(h);
    n(c, d, b, R, S, g, e);
    for (var Y = 0, P = 0, w, T; Y < m; ++Y)
      if (w = b[Y]) {
        for (Y >= P && (P = Y + 1); !(T = R[P]) && ++P < m; ) ;
        w._next = T || null;
      }
  }
  return s = new Ht(s, r), s._enter = a, s._exit = u, s;
}
function wc(t) {
  return typeof t == "object" && "length" in t ? t : Array.from(t);
}
function xc() {
  return new Ht(this._exit || this._groups.map(qs), this._parents);
}
function bc(t, e, n) {
  var r = this.enter(), i = this, o = this.exit();
  return typeof t == "function" ? (r = t(r), r && (r = r.selection())) : r = r.append(t + ""), e != null && (i = e(i), i && (i = i.selection())), n == null ? o.remove() : n(o), r && i ? r.merge(i).order() : i;
}
function kc(t) {
  for (var e = t.selection ? t.selection() : t, n = this._groups, r = e._groups, i = n.length, o = r.length, s = Math.min(i, o), a = new Array(i), u = 0; u < s; ++u)
    for (var f = n[u], c = r[u], d = f.length, h = a[u] = new Array(d), g, m = 0; m < d; ++m)
      (g = f[m] || c[m]) && (h[m] = g);
  for (; u < i; ++u)
    a[u] = n[u];
  return new Ht(a, this._parents);
}
function Ec() {
  for (var t = this._groups, e = -1, n = t.length; ++e < n; )
    for (var r = t[e], i = r.length - 1, o = r[i], s; --i >= 0; )
      (s = r[i]) && (o && s.compareDocumentPosition(o) ^ 4 && o.parentNode.insertBefore(s, o), o = s);
  return this;
}
function Sc(t) {
  t || (t = Nc);
  function e(d, h) {
    return d && h ? t(d.__data__, h.__data__) : !d - !h;
  }
  for (var n = this._groups, r = n.length, i = new Array(r), o = 0; o < r; ++o) {
    for (var s = n[o], a = s.length, u = i[o] = new Array(a), f, c = 0; c < a; ++c)
      (f = s[c]) && (u[c] = f);
    u.sort(e);
  }
  return new Ht(i, this._parents).order();
}
function Nc(t, e) {
  return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
function Mc() {
  var t = arguments[0];
  return arguments[0] = this, t.apply(null, arguments), this;
}
function Ac() {
  return Array.from(this);
}
function Ic() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length; i < o; ++i) {
      var s = r[i];
      if (s) return s;
    }
  return null;
}
function Pc() {
  let t = 0;
  for (const e of this) ++t;
  return t;
}
function zc() {
  return !this.node();
}
function Tc(t) {
  for (var e = this._groups, n = 0, r = e.length; n < r; ++n)
    for (var i = e[n], o = 0, s = i.length, a; o < s; ++o)
      (a = i[o]) && t.call(a, a.__data__, o, i);
  return this;
}
function Cc(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function Rc(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function Fc(t, e) {
  return function() {
    this.setAttribute(t, e);
  };
}
function Lc(t, e) {
  return function() {
    this.setAttributeNS(t.space, t.local, e);
  };
}
function Oc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttribute(t) : this.setAttribute(t, n);
  };
}
function Dc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttributeNS(t.space, t.local) : this.setAttributeNS(t.space, t.local, n);
  };
}
function Yc(t, e) {
  var n = Ur(t);
  if (arguments.length < 2) {
    var r = this.node();
    return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n);
  }
  return this.each((e == null ? n.local ? Rc : Cc : typeof e == "function" ? n.local ? Dc : Oc : n.local ? Lc : Fc)(n, e));
}
function Us(t) {
  return t.ownerDocument && t.ownerDocument.defaultView || t.document && t || t.defaultView;
}
function Hc(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function Bc(t, e, n) {
  return function() {
    this.style.setProperty(t, e, n);
  };
}
function Vc(t, e, n) {
  return function() {
    var r = e.apply(this, arguments);
    r == null ? this.style.removeProperty(t) : this.style.setProperty(t, r, n);
  };
}
function Xc(t, e, n) {
  return arguments.length > 1 ? this.each((e == null ? Hc : typeof e == "function" ? Vc : Bc)(t, e, n ?? "")) : Rn(this.node(), t);
}
function Rn(t, e) {
  return t.style.getPropertyValue(e) || Us(t).getComputedStyle(t, null).getPropertyValue(e);
}
function qc(t) {
  return function() {
    delete this[t];
  };
}
function Uc(t, e) {
  return function() {
    this[t] = e;
  };
}
function Gc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? delete this[t] : this[t] = n;
  };
}
function Wc(t, e) {
  return arguments.length > 1 ? this.each((e == null ? qc : typeof e == "function" ? Gc : Uc)(t, e)) : this.node()[t];
}
function Gs(t) {
  return t.trim().split(/^|\s+/);
}
function Bi(t) {
  return t.classList || new Ws(t);
}
function Ws(t) {
  this._node = t, this._names = Gs(t.getAttribute("class") || "");
}
Ws.prototype = {
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
function Ks(t, e) {
  for (var n = Bi(t), r = -1, i = e.length; ++r < i; ) n.add(e[r]);
}
function Zs(t, e) {
  for (var n = Bi(t), r = -1, i = e.length; ++r < i; ) n.remove(e[r]);
}
function Kc(t) {
  return function() {
    Ks(this, t);
  };
}
function Zc(t) {
  return function() {
    Zs(this, t);
  };
}
function Jc(t, e) {
  return function() {
    (e.apply(this, arguments) ? Ks : Zs)(this, t);
  };
}
function Qc(t, e) {
  var n = Gs(t + "");
  if (arguments.length < 2) {
    for (var r = Bi(this.node()), i = -1, o = n.length; ++i < o; ) if (!r.contains(n[i])) return !1;
    return !0;
  }
  return this.each((typeof e == "function" ? Jc : e ? Kc : Zc)(n, e));
}
function jc() {
  this.textContent = "";
}
function $c(t) {
  return function() {
    this.textContent = t;
  };
}
function th(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.textContent = e ?? "";
  };
}
function eh(t) {
  return arguments.length ? this.each(t == null ? jc : (typeof t == "function" ? th : $c)(t)) : this.node().textContent;
}
function nh() {
  this.innerHTML = "";
}
function rh(t) {
  return function() {
    this.innerHTML = t;
  };
}
function ih(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.innerHTML = e ?? "";
  };
}
function oh(t) {
  return arguments.length ? this.each(t == null ? nh : (typeof t == "function" ? ih : rh)(t)) : this.node().innerHTML;
}
function sh() {
  this.nextSibling && this.parentNode.appendChild(this);
}
function ah() {
  return this.each(sh);
}
function lh() {
  this.previousSibling && this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function uh() {
  return this.each(lh);
}
function fh(t) {
  var e = typeof t == "function" ? t : Hs(t);
  return this.select(function() {
    return this.appendChild(e.apply(this, arguments));
  });
}
function ch() {
  return null;
}
function hh(t, e) {
  var n = typeof t == "function" ? t : Hs(t), r = e == null ? ch : typeof e == "function" ? e : Hi(e);
  return this.select(function() {
    return this.insertBefore(n.apply(this, arguments), r.apply(this, arguments) || null);
  });
}
function dh() {
  var t = this.parentNode;
  t && t.removeChild(this);
}
function gh() {
  return this.each(dh);
}
function vh() {
  var t = this.cloneNode(!1), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function mh() {
  var t = this.cloneNode(!0), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function ph(t) {
  return this.select(t ? mh : vh);
}
function _h(t) {
  return arguments.length ? this.property("__data__", t) : this.node().__data__;
}
function yh(t) {
  return function(e) {
    t.call(this, e, this.__data__);
  };
}
function wh(t) {
  return t.trim().split(/^|\s+/).map(function(e) {
    var n = "", r = e.indexOf(".");
    return r >= 0 && (n = e.slice(r + 1), e = e.slice(0, r)), { type: e, name: n };
  });
}
function xh(t) {
  return function() {
    var e = this.__on;
    if (e) {
      for (var n = 0, r = -1, i = e.length, o; n < i; ++n)
        o = e[n], (!t.type || o.type === t.type) && o.name === t.name ? this.removeEventListener(o.type, o.listener, o.options) : e[++r] = o;
      ++r ? e.length = r : delete this.__on;
    }
  };
}
function bh(t, e, n) {
  return function() {
    var r = this.__on, i, o = yh(e);
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
function kh(t, e, n) {
  var r = wh(t + ""), i, o = r.length, s;
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
  for (a = e ? bh : xh, i = 0; i < o; ++i) this.each(a(r[i], e, n));
  return this;
}
function Js(t, e, n) {
  var r = Us(t), i = r.CustomEvent;
  typeof i == "function" ? i = new i(e, n) : (i = r.document.createEvent("Event"), n ? (i.initEvent(e, n.bubbles, n.cancelable), i.detail = n.detail) : i.initEvent(e, !1, !1)), t.dispatchEvent(i);
}
function Eh(t, e) {
  return function() {
    return Js(this, t, e);
  };
}
function Sh(t, e) {
  return function() {
    return Js(this, t, e.apply(this, arguments));
  };
}
function Nh(t, e) {
  return this.each((typeof e == "function" ? Sh : Eh)(t, e));
}
function* Mh() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length, s; i < o; ++i)
      (s = r[i]) && (yield s);
}
var Qs = [null];
function Ht(t, e) {
  this._groups = t, this._parents = e;
}
function ur() {
  return new Ht([[document.documentElement]], Qs);
}
function Ah() {
  return this;
}
Ht.prototype = ur.prototype = {
  constructor: Ht,
  select: tc,
  selectAll: ic,
  selectChild: lc,
  selectChildren: hc,
  filter: dc,
  data: yc,
  enter: gc,
  exit: xc,
  join: bc,
  merge: kc,
  selection: Ah,
  order: Ec,
  sort: Sc,
  call: Mc,
  nodes: Ac,
  node: Ic,
  size: Pc,
  empty: zc,
  each: Tc,
  attr: Yc,
  style: Xc,
  property: Wc,
  classed: Qc,
  text: eh,
  html: oh,
  raise: ah,
  lower: uh,
  append: fh,
  insert: hh,
  remove: gh,
  clone: ph,
  datum: _h,
  on: kh,
  dispatch: Nh,
  [Symbol.iterator]: Mh
};
function zt(t) {
  return typeof t == "string" ? new Ht([[document.querySelector(t)]], [document.documentElement]) : new Ht([[t]], Qs);
}
function Ih(t) {
  let e;
  for (; e = t.sourceEvent; ) t = e;
  return t;
}
function ve(t, e) {
  if (t = Ih(t), e === void 0 && (e = t.currentTarget), e) {
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
const Ph = { passive: !1 }, jn = { capture: !0, passive: !1 };
function jr(t) {
  t.stopImmediatePropagation();
}
function yn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function js(t) {
  var e = t.document.documentElement, n = zt(t).on("dragstart.drag", yn, jn);
  "onselectstart" in e ? n.on("selectstart.drag", yn, jn) : (e.__noselect = e.style.MozUserSelect, e.style.MozUserSelect = "none");
}
function $s(t, e) {
  var n = t.document.documentElement, r = zt(t).on("dragstart.drag", null);
  e && (r.on("click.drag", yn, jn), setTimeout(function() {
    r.on("click.drag", null);
  }, 0)), "onselectstart" in n ? r.on("selectstart.drag", null) : (n.style.MozUserSelect = n.__noselect, delete n.__noselect);
}
const vr = (t) => () => t;
function mi(t, {
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
mi.prototype.on = function() {
  var t = this._.on.apply(this._, arguments);
  return t === this._ ? this : t;
};
function zh(t) {
  return !t.ctrlKey && !t.button;
}
function Th() {
  return this.parentNode;
}
function Ch(t, e) {
  return e ?? { x: t.x, y: t.y };
}
function Rh() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function wo() {
  var t = zh, e = Th, n = Ch, r = Rh, i = {}, o = qr("start", "drag", "end"), s = 0, a, u, f, c, d = 0;
  function h(w) {
    w.on("mousedown.drag", g).filter(r).on("touchstart.drag", R).on("touchmove.drag", S, Ph).on("touchend.drag touchcancel.drag", Y).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function g(w, T) {
    if (!(c || !t.call(this, w, T))) {
      var k = P(this, e.call(this, w, T), w, T, "mouse");
      k && (zt(w.view).on("mousemove.drag", m, jn).on("mouseup.drag", b, jn), js(w.view), jr(w), f = !1, a = w.clientX, u = w.clientY, k("start", w));
    }
  }
  function m(w) {
    if (yn(w), !f) {
      var T = w.clientX - a, k = w.clientY - u;
      f = T * T + k * k > d;
    }
    i.mouse("drag", w);
  }
  function b(w) {
    zt(w.view).on("mousemove.drag mouseup.drag", null), $s(w.view, f), yn(w), i.mouse("end", w);
  }
  function R(w, T) {
    if (t.call(this, w, T)) {
      var k = w.changedTouches, M = e.call(this, w, T), F = k.length, D, V;
      for (D = 0; D < F; ++D)
        (V = P(this, M, w, T, k[D].identifier, k[D])) && (jr(w), V("start", w, k[D]));
    }
  }
  function S(w) {
    var T = w.changedTouches, k = T.length, M, F;
    for (M = 0; M < k; ++M)
      (F = i[T[M].identifier]) && (yn(w), F("drag", w, T[M]));
  }
  function Y(w) {
    var T = w.changedTouches, k = T.length, M, F;
    for (c && clearTimeout(c), c = setTimeout(function() {
      c = null;
    }, 500), M = 0; M < k; ++M)
      (F = i[T[M].identifier]) && (jr(w), F("end", w, T[M]));
  }
  function P(w, T, k, M, F, D) {
    var V = o.copy(), I = ve(D || k, T), q, X, p;
    if ((p = n.call(w, new mi("beforestart", {
      sourceEvent: k,
      target: h,
      identifier: F,
      active: s,
      x: I[0],
      y: I[1],
      dx: 0,
      dy: 0,
      dispatch: V
    }), M)) != null)
      return q = p.x - I[0] || 0, X = p.y - I[1] || 0, function A(_, x, N) {
        var E = I, z;
        switch (_) {
          case "start":
            i[F] = A, z = s++;
            break;
          case "end":
            delete i[F], --s;
          // falls through
          case "drag":
            I = ve(N || x, T), z = s;
            break;
        }
        V.call(
          _,
          w,
          new mi(_, {
            sourceEvent: x,
            subject: p,
            target: h,
            identifier: F,
            active: z,
            x: I[0] + q,
            y: I[1] + X,
            dx: I[0] - E[0],
            dy: I[1] - E[1],
            dispatch: V
          }),
          M
        );
      };
  }
  return h.filter = function(w) {
    return arguments.length ? (t = typeof w == "function" ? w : vr(!!w), h) : t;
  }, h.container = function(w) {
    return arguments.length ? (e = typeof w == "function" ? w : vr(w), h) : e;
  }, h.subject = function(w) {
    return arguments.length ? (n = typeof w == "function" ? w : vr(w), h) : n;
  }, h.touchable = function(w) {
    return arguments.length ? (r = typeof w == "function" ? w : vr(!!w), h) : r;
  }, h.on = function() {
    var w = o.on.apply(o, arguments);
    return w === o ? h : w;
  }, h.clickDistance = function(w) {
    return arguments.length ? (d = (w = +w) * w, h) : Math.sqrt(d);
  }, h;
}
function Vi(t, e, n) {
  t.prototype = e.prototype = n, n.constructor = t;
}
function ta(t, e) {
  var n = Object.create(t.prototype);
  for (var r in e) n[r] = e[r];
  return n;
}
function fr() {
}
var $n = 0.7, Rr = 1 / $n, wn = "\\s*([+-]?\\d+)\\s*", tr = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", ae = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Fh = /^#([0-9a-f]{3,8})$/, Lh = new RegExp(`^rgb\\(${wn},${wn},${wn}\\)$`), Oh = new RegExp(`^rgb\\(${ae},${ae},${ae}\\)$`), Dh = new RegExp(`^rgba\\(${wn},${wn},${wn},${tr}\\)$`), Yh = new RegExp(`^rgba\\(${ae},${ae},${ae},${tr}\\)$`), Hh = new RegExp(`^hsl\\(${tr},${ae},${ae}\\)$`), Bh = new RegExp(`^hsla\\(${tr},${ae},${ae},${tr}\\)$`), xo = {
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
Vi(fr, er, {
  copy(t) {
    return Object.assign(new this.constructor(), this, t);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: bo,
  // Deprecated! Use color.formatHex.
  formatHex: bo,
  formatHex8: Vh,
  formatHsl: Xh,
  formatRgb: ko,
  toString: ko
});
function bo() {
  return this.rgb().formatHex();
}
function Vh() {
  return this.rgb().formatHex8();
}
function Xh() {
  return ea(this).formatHsl();
}
function ko() {
  return this.rgb().formatRgb();
}
function er(t) {
  var e, n;
  return t = (t + "").trim().toLowerCase(), (e = Fh.exec(t)) ? (n = e[1].length, e = parseInt(e[1], 16), n === 6 ? Eo(e) : n === 3 ? new Ct(e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, (e & 15) << 4 | e & 15, 1) : n === 8 ? mr(e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, (e & 255) / 255) : n === 4 ? mr(e >> 12 & 15 | e >> 8 & 240, e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, ((e & 15) << 4 | e & 15) / 255) : null) : (e = Lh.exec(t)) ? new Ct(e[1], e[2], e[3], 1) : (e = Oh.exec(t)) ? new Ct(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, 1) : (e = Dh.exec(t)) ? mr(e[1], e[2], e[3], e[4]) : (e = Yh.exec(t)) ? mr(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, e[4]) : (e = Hh.exec(t)) ? Mo(e[1], e[2] / 100, e[3] / 100, 1) : (e = Bh.exec(t)) ? Mo(e[1], e[2] / 100, e[3] / 100, e[4]) : xo.hasOwnProperty(t) ? Eo(xo[t]) : t === "transparent" ? new Ct(NaN, NaN, NaN, 0) : null;
}
function Eo(t) {
  return new Ct(t >> 16 & 255, t >> 8 & 255, t & 255, 1);
}
function mr(t, e, n, r) {
  return r <= 0 && (t = e = n = NaN), new Ct(t, e, n, r);
}
function qh(t) {
  return t instanceof fr || (t = er(t)), t ? (t = t.rgb(), new Ct(t.r, t.g, t.b, t.opacity)) : new Ct();
}
function pi(t, e, n, r) {
  return arguments.length === 1 ? qh(t) : new Ct(t, e, n, r ?? 1);
}
function Ct(t, e, n, r) {
  this.r = +t, this.g = +e, this.b = +n, this.opacity = +r;
}
Vi(Ct, pi, ta(fr, {
  brighter(t) {
    return t = t == null ? Rr : Math.pow(Rr, t), new Ct(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? $n : Math.pow($n, t), new Ct(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Ct(je(this.r), je(this.g), je(this.b), Fr(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && -0.5 <= this.g && this.g < 255.5 && -0.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
  },
  hex: So,
  // Deprecated! Use color.formatHex.
  formatHex: So,
  formatHex8: Uh,
  formatRgb: No,
  toString: No
}));
function So() {
  return `#${qe(this.r)}${qe(this.g)}${qe(this.b)}`;
}
function Uh() {
  return `#${qe(this.r)}${qe(this.g)}${qe(this.b)}${qe((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function No() {
  const t = Fr(this.opacity);
  return `${t === 1 ? "rgb(" : "rgba("}${je(this.r)}, ${je(this.g)}, ${je(this.b)}${t === 1 ? ")" : `, ${t})`}`;
}
function Fr(t) {
  return isNaN(t) ? 1 : Math.max(0, Math.min(1, t));
}
function je(t) {
  return Math.max(0, Math.min(255, Math.round(t) || 0));
}
function qe(t) {
  return t = je(t), (t < 16 ? "0" : "") + t.toString(16);
}
function Mo(t, e, n, r) {
  return r <= 0 ? t = e = n = NaN : n <= 0 || n >= 1 ? t = e = NaN : e <= 0 && (t = NaN), new jt(t, e, n, r);
}
function ea(t) {
  if (t instanceof jt) return new jt(t.h, t.s, t.l, t.opacity);
  if (t instanceof fr || (t = er(t)), !t) return new jt();
  if (t instanceof jt) return t;
  t = t.rgb();
  var e = t.r / 255, n = t.g / 255, r = t.b / 255, i = Math.min(e, n, r), o = Math.max(e, n, r), s = NaN, a = o - i, u = (o + i) / 2;
  return a ? (e === o ? s = (n - r) / a + (n < r) * 6 : n === o ? s = (r - e) / a + 2 : s = (e - n) / a + 4, a /= u < 0.5 ? o + i : 2 - o - i, s *= 60) : a = u > 0 && u < 1 ? 0 : s, new jt(s, a, u, t.opacity);
}
function Gh(t, e, n, r) {
  return arguments.length === 1 ? ea(t) : new jt(t, e, n, r ?? 1);
}
function jt(t, e, n, r) {
  this.h = +t, this.s = +e, this.l = +n, this.opacity = +r;
}
Vi(jt, Gh, ta(fr, {
  brighter(t) {
    return t = t == null ? Rr : Math.pow(Rr, t), new jt(this.h, this.s, this.l * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? $n : Math.pow($n, t), new jt(this.h, this.s, this.l * t, this.opacity);
  },
  rgb() {
    var t = this.h % 360 + (this.h < 0) * 360, e = isNaN(t) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < 0.5 ? n : 1 - n) * e, i = 2 * n - r;
    return new Ct(
      $r(t >= 240 ? t - 240 : t + 120, i, r),
      $r(t, i, r),
      $r(t < 120 ? t + 240 : t - 120, i, r),
      this.opacity
    );
  },
  clamp() {
    return new jt(Ao(this.h), pr(this.s), pr(this.l), Fr(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
  },
  formatHsl() {
    const t = Fr(this.opacity);
    return `${t === 1 ? "hsl(" : "hsla("}${Ao(this.h)}, ${pr(this.s) * 100}%, ${pr(this.l) * 100}%${t === 1 ? ")" : `, ${t})`}`;
  }
}));
function Ao(t) {
  return t = (t || 0) % 360, t < 0 ? t + 360 : t;
}
function pr(t) {
  return Math.max(0, Math.min(1, t || 0));
}
function $r(t, e, n) {
  return (t < 60 ? e + (n - e) * t / 60 : t < 180 ? n : t < 240 ? e + (n - e) * (240 - t) / 60 : e) * 255;
}
const na = (t) => () => t;
function Wh(t, e) {
  return function(n) {
    return t + n * e;
  };
}
function Kh(t, e, n) {
  return t = Math.pow(t, n), e = Math.pow(e, n) - t, n = 1 / n, function(r) {
    return Math.pow(t + r * e, n);
  };
}
function Zh(t) {
  return (t = +t) == 1 ? ra : function(e, n) {
    return n - e ? Kh(e, n, t) : na(isNaN(e) ? n : e);
  };
}
function ra(t, e) {
  var n = e - t;
  return n ? Wh(t, n) : na(isNaN(t) ? e : t);
}
const Io = (function t(e) {
  var n = Zh(e);
  function r(i, o) {
    var s = n((i = pi(i)).r, (o = pi(o)).r), a = n(i.g, o.g), u = n(i.b, o.b), f = ra(i.opacity, o.opacity);
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
var _i = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, ti = new RegExp(_i.source, "g");
function Jh(t) {
  return function() {
    return t;
  };
}
function Qh(t) {
  return function(e) {
    return t(e) + "";
  };
}
function jh(t, e) {
  var n = _i.lastIndex = ti.lastIndex = 0, r, i, o, s = -1, a = [], u = [];
  for (t = t + "", e = e + ""; (r = _i.exec(t)) && (i = ti.exec(e)); )
    (o = i.index) > n && (o = e.slice(n, o), a[s] ? a[s] += o : a[++s] = o), (r = r[0]) === (i = i[0]) ? a[s] ? a[s] += i : a[++s] = i : (a[++s] = null, u.push({ i: s, x: Pe(r, i) })), n = ti.lastIndex;
  return n < e.length && (o = e.slice(n), a[s] ? a[s] += o : a[++s] = o), a.length < 2 ? u[0] ? Qh(u[0].x) : Jh(e) : (e = u.length, function(f) {
    for (var c = 0, d; c < e; ++c) a[(d = u[c]).i] = d.x(f);
    return a.join("");
  });
}
var Po = 180 / Math.PI, yi = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function ia(t, e, n, r, i, o) {
  var s, a, u;
  return (s = Math.sqrt(t * t + e * e)) && (t /= s, e /= s), (u = t * n + e * r) && (n -= t * u, r -= e * u), (a = Math.sqrt(n * n + r * r)) && (n /= a, r /= a, u /= a), t * r < e * n && (t = -t, e = -e, u = -u, s = -s), {
    translateX: i,
    translateY: o,
    rotate: Math.atan2(e, t) * Po,
    skewX: Math.atan(u) * Po,
    scaleX: s,
    scaleY: a
  };
}
var _r;
function $h(t) {
  const e = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(t + "");
  return e.isIdentity ? yi : ia(e.a, e.b, e.c, e.d, e.e, e.f);
}
function td(t) {
  return t == null || (_r || (_r = document.createElementNS("http://www.w3.org/2000/svg", "g")), _r.setAttribute("transform", t), !(t = _r.transform.baseVal.consolidate())) ? yi : (t = t.matrix, ia(t.a, t.b, t.c, t.d, t.e, t.f));
}
function oa(t, e, n, r) {
  function i(f) {
    return f.length ? f.pop() + " " : "";
  }
  function o(f, c, d, h, g, m) {
    if (f !== d || c !== h) {
      var b = g.push("translate(", null, e, null, n);
      m.push({ i: b - 4, x: Pe(f, d) }, { i: b - 2, x: Pe(c, h) });
    } else (d || h) && g.push("translate(" + d + e + h + n);
  }
  function s(f, c, d, h) {
    f !== c ? (f - c > 180 ? c += 360 : c - f > 180 && (f += 360), h.push({ i: d.push(i(d) + "rotate(", null, r) - 2, x: Pe(f, c) })) : c && d.push(i(d) + "rotate(" + c + r);
  }
  function a(f, c, d, h) {
    f !== c ? h.push({ i: d.push(i(d) + "skewX(", null, r) - 2, x: Pe(f, c) }) : c && d.push(i(d) + "skewX(" + c + r);
  }
  function u(f, c, d, h, g, m) {
    if (f !== d || c !== h) {
      var b = g.push(i(g) + "scale(", null, ",", null, ")");
      m.push({ i: b - 4, x: Pe(f, d) }, { i: b - 2, x: Pe(c, h) });
    } else (d !== 1 || h !== 1) && g.push(i(g) + "scale(" + d + "," + h + ")");
  }
  return function(f, c) {
    var d = [], h = [];
    return f = t(f), c = t(c), o(f.translateX, f.translateY, c.translateX, c.translateY, d, h), s(f.rotate, c.rotate, d, h), a(f.skewX, c.skewX, d, h), u(f.scaleX, f.scaleY, c.scaleX, c.scaleY, d, h), f = c = null, function(g) {
      for (var m = -1, b = h.length, R; ++m < b; ) d[(R = h[m]).i] = R.x(g);
      return d.join("");
    };
  };
}
var ed = oa($h, "px, ", "px)", "deg)"), nd = oa(td, ", ", ")", ")"), rd = 1e-12;
function zo(t) {
  return ((t = Math.exp(t)) + 1 / t) / 2;
}
function id(t) {
  return ((t = Math.exp(t)) - 1 / t) / 2;
}
function od(t) {
  return ((t = Math.exp(2 * t)) - 1) / (t + 1);
}
const sd = (function t(e, n, r) {
  function i(o, s) {
    var a = o[0], u = o[1], f = o[2], c = s[0], d = s[1], h = s[2], g = c - a, m = d - u, b = g * g + m * m, R, S;
    if (b < rd)
      S = Math.log(h / f) / e, R = function(M) {
        return [
          a + M * g,
          u + M * m,
          f * Math.exp(e * M * S)
        ];
      };
    else {
      var Y = Math.sqrt(b), P = (h * h - f * f + r * b) / (2 * f * n * Y), w = (h * h - f * f - r * b) / (2 * h * n * Y), T = Math.log(Math.sqrt(P * P + 1) - P), k = Math.log(Math.sqrt(w * w + 1) - w);
      S = (k - T) / e, R = function(M) {
        var F = M * S, D = zo(T), V = f / (n * Y) * (D * od(e * F + T) - id(T));
        return [
          a + V * g,
          u + V * m,
          f * D / zo(e * F + T)
        ];
      };
    }
    return R.duration = S * 1e3 * e / Math.SQRT2, R;
  }
  return i.rho = function(o) {
    var s = Math.max(1e-3, +o), a = s * s, u = a * a;
    return t(s, a, u);
  }, i;
})(Math.SQRT2, 2, 4);
var Fn = 0, Xn = 0, Dn = 0, sa = 1e3, Lr, qn, Or = 0, rn = 0, Gr = 0, nr = typeof performance == "object" && performance.now ? performance : Date, aa = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(t) {
  setTimeout(t, 17);
};
function Xi() {
  return rn || (aa(ad), rn = nr.now() + Gr);
}
function ad() {
  rn = 0;
}
function Dr() {
  this._call = this._time = this._next = null;
}
Dr.prototype = la.prototype = {
  constructor: Dr,
  restart: function(t, e, n) {
    if (typeof t != "function") throw new TypeError("callback is not a function");
    n = (n == null ? Xi() : +n) + (e == null ? 0 : +e), !this._next && qn !== this && (qn ? qn._next = this : Lr = this, qn = this), this._call = t, this._time = n, wi();
  },
  stop: function() {
    this._call && (this._call = null, this._time = 1 / 0, wi());
  }
};
function la(t, e, n) {
  var r = new Dr();
  return r.restart(t, e, n), r;
}
function ld() {
  Xi(), ++Fn;
  for (var t = Lr, e; t; )
    (e = rn - t._time) >= 0 && t._call.call(void 0, e), t = t._next;
  --Fn;
}
function To() {
  rn = (Or = nr.now()) + Gr, Fn = Xn = 0;
  try {
    ld();
  } finally {
    Fn = 0, fd(), rn = 0;
  }
}
function ud() {
  var t = nr.now(), e = t - Or;
  e > sa && (Gr -= e, Or = t);
}
function fd() {
  for (var t, e = Lr, n, r = 1 / 0; e; )
    e._call ? (r > e._time && (r = e._time), t = e, e = e._next) : (n = e._next, e._next = null, e = t ? t._next = n : Lr = n);
  qn = t, wi(r);
}
function wi(t) {
  if (!Fn) {
    Xn && (Xn = clearTimeout(Xn));
    var e = t - rn;
    e > 24 ? (t < 1 / 0 && (Xn = setTimeout(To, t - nr.now() - Gr)), Dn && (Dn = clearInterval(Dn))) : (Dn || (Or = nr.now(), Dn = setInterval(ud, sa)), Fn = 1, aa(To));
  }
}
function Co(t, e, n) {
  var r = new Dr();
  return e = e == null ? 0 : +e, r.restart((i) => {
    r.stop(), t(i + e);
  }, e, n), r;
}
var cd = qr("start", "end", "cancel", "interrupt"), hd = [], ua = 0, Ro = 1, xi = 2, Sr = 3, Fo = 4, bi = 5, Nr = 6;
function Wr(t, e, n, r, i, o) {
  var s = t.__transition;
  if (!s) t.__transition = {};
  else if (n in s) return;
  dd(t, n, {
    name: e,
    index: r,
    // For context during callback.
    group: i,
    // For context during callback.
    on: cd,
    tween: hd,
    time: o.time,
    delay: o.delay,
    duration: o.duration,
    ease: o.ease,
    timer: null,
    state: ua
  });
}
function qi(t, e) {
  var n = te(t, e);
  if (n.state > ua) throw new Error("too late; already scheduled");
  return n;
}
function fe(t, e) {
  var n = te(t, e);
  if (n.state > Sr) throw new Error("too late; already running");
  return n;
}
function te(t, e) {
  var n = t.__transition;
  if (!n || !(n = n[e])) throw new Error("transition not found");
  return n;
}
function dd(t, e, n) {
  var r = t.__transition, i;
  r[e] = n, n.timer = la(o, 0, n.time);
  function o(f) {
    n.state = Ro, n.timer.restart(s, n.delay, n.time), n.delay <= f && s(f - n.delay);
  }
  function s(f) {
    var c, d, h, g;
    if (n.state !== Ro) return u();
    for (c in r)
      if (g = r[c], g.name === n.name) {
        if (g.state === Sr) return Co(s);
        g.state === Fo ? (g.state = Nr, g.timer.stop(), g.on.call("interrupt", t, t.__data__, g.index, g.group), delete r[c]) : +c < e && (g.state = Nr, g.timer.stop(), g.on.call("cancel", t, t.__data__, g.index, g.group), delete r[c]);
      }
    if (Co(function() {
      n.state === Sr && (n.state = Fo, n.timer.restart(a, n.delay, n.time), a(f));
    }), n.state = xi, n.on.call("start", t, t.__data__, n.index, n.group), n.state === xi) {
      for (n.state = Sr, i = new Array(h = n.tween.length), c = 0, d = -1; c < h; ++c)
        (g = n.tween[c].value.call(t, t.__data__, n.index, n.group)) && (i[++d] = g);
      i.length = d + 1;
    }
  }
  function a(f) {
    for (var c = f < n.duration ? n.ease.call(null, f / n.duration) : (n.timer.restart(u), n.state = bi, 1), d = -1, h = i.length; ++d < h; )
      i[d].call(t, c);
    n.state === bi && (n.on.call("end", t, t.__data__, n.index, n.group), u());
  }
  function u() {
    n.state = Nr, n.timer.stop(), delete r[e];
    for (var f in r) return;
    delete t.__transition;
  }
}
function Mr(t, e) {
  var n = t.__transition, r, i, o = !0, s;
  if (n) {
    e = e == null ? null : e + "";
    for (s in n) {
      if ((r = n[s]).name !== e) {
        o = !1;
        continue;
      }
      i = r.state > xi && r.state < bi, r.state = Nr, r.timer.stop(), r.on.call(i ? "interrupt" : "cancel", t, t.__data__, r.index, r.group), delete n[s];
    }
    o && delete t.__transition;
  }
}
function gd(t) {
  return this.each(function() {
    Mr(this, t);
  });
}
function vd(t, e) {
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
function md(t, e, n) {
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
function pd(t, e) {
  var n = this._id;
  if (t += "", arguments.length < 2) {
    for (var r = te(this.node(), n).tween, i = 0, o = r.length, s; i < o; ++i)
      if ((s = r[i]).name === t)
        return s.value;
    return null;
  }
  return this.each((e == null ? vd : md)(n, t, e));
}
function Ui(t, e, n) {
  var r = t._id;
  return t.each(function() {
    var i = fe(this, r);
    (i.value || (i.value = {}))[e] = n.apply(this, arguments);
  }), function(i) {
    return te(i, r).value[e];
  };
}
function fa(t, e) {
  var n;
  return (typeof e == "number" ? Pe : e instanceof er ? Io : (n = er(e)) ? (e = n, Io) : jh)(t, e);
}
function _d(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function yd(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function wd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttribute(t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function xd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttributeNS(t.space, t.local);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function bd(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttribute(t) : (s = this.getAttribute(t), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function kd(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttributeNS(t.space, t.local) : (s = this.getAttributeNS(t.space, t.local), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function Ed(t, e) {
  var n = Ur(t), r = n === "transform" ? nd : fa;
  return this.attrTween(t, typeof e == "function" ? (n.local ? kd : bd)(n, r, Ui(this, "attr." + t, e)) : e == null ? (n.local ? yd : _d)(n) : (n.local ? xd : wd)(n, r, e));
}
function Sd(t, e) {
  return function(n) {
    this.setAttribute(t, e.call(this, n));
  };
}
function Nd(t, e) {
  return function(n) {
    this.setAttributeNS(t.space, t.local, e.call(this, n));
  };
}
function Md(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && Nd(t, o)), n;
  }
  return i._value = e, i;
}
function Ad(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && Sd(t, o)), n;
  }
  return i._value = e, i;
}
function Id(t, e) {
  var n = "attr." + t;
  if (arguments.length < 2) return (n = this.tween(n)) && n._value;
  if (e == null) return this.tween(n, null);
  if (typeof e != "function") throw new Error();
  var r = Ur(t);
  return this.tween(n, (r.local ? Md : Ad)(r, e));
}
function Pd(t, e) {
  return function() {
    qi(this, t).delay = +e.apply(this, arguments);
  };
}
function zd(t, e) {
  return e = +e, function() {
    qi(this, t).delay = e;
  };
}
function Td(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Pd : zd)(e, t)) : te(this.node(), e).delay;
}
function Cd(t, e) {
  return function() {
    fe(this, t).duration = +e.apply(this, arguments);
  };
}
function Rd(t, e) {
  return e = +e, function() {
    fe(this, t).duration = e;
  };
}
function Fd(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Cd : Rd)(e, t)) : te(this.node(), e).duration;
}
function Ld(t, e) {
  if (typeof e != "function") throw new Error();
  return function() {
    fe(this, t).ease = e;
  };
}
function Od(t) {
  var e = this._id;
  return arguments.length ? this.each(Ld(e, t)) : te(this.node(), e).ease;
}
function Dd(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    if (typeof n != "function") throw new Error();
    fe(this, t).ease = n;
  };
}
function Yd(t) {
  if (typeof t != "function") throw new Error();
  return this.each(Dd(this._id, t));
}
function Hd(t) {
  typeof t != "function" && (t = Vs(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new xe(r, this._parents, this._name, this._id);
}
function Bd(t) {
  if (t._id !== this._id) throw new Error();
  for (var e = this._groups, n = t._groups, r = e.length, i = n.length, o = Math.min(r, i), s = new Array(r), a = 0; a < o; ++a)
    for (var u = e[a], f = n[a], c = u.length, d = s[a] = new Array(c), h, g = 0; g < c; ++g)
      (h = u[g] || f[g]) && (d[g] = h);
  for (; a < r; ++a)
    s[a] = e[a];
  return new xe(s, this._parents, this._name, this._id);
}
function Vd(t) {
  return (t + "").trim().split(/^|\s+/).every(function(e) {
    var n = e.indexOf(".");
    return n >= 0 && (e = e.slice(0, n)), !e || e === "start";
  });
}
function Xd(t, e, n) {
  var r, i, o = Vd(e) ? qi : fe;
  return function() {
    var s = o(this, t), a = s.on;
    a !== r && (i = (r = a).copy()).on(e, n), s.on = i;
  };
}
function qd(t, e) {
  var n = this._id;
  return arguments.length < 2 ? te(this.node(), n).on.on(t) : this.each(Xd(n, t, e));
}
function Ud(t) {
  return function() {
    var e = this.parentNode;
    for (var n in this.__transition) if (+n !== t) return;
    e && e.removeChild(this);
  };
}
function Gd() {
  return this.on("end.remove", Ud(this._id));
}
function Wd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Hi(t));
  for (var r = this._groups, i = r.length, o = new Array(i), s = 0; s < i; ++s)
    for (var a = r[s], u = a.length, f = o[s] = new Array(u), c, d, h = 0; h < u; ++h)
      (c = a[h]) && (d = t.call(c, c.__data__, h, a)) && ("__data__" in c && (d.__data__ = c.__data__), f[h] = d, Wr(f[h], e, n, h, f, te(c, n)));
  return new xe(o, this._parents, e, n);
}
function Kd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Bs(t));
  for (var r = this._groups, i = r.length, o = [], s = [], a = 0; a < i; ++a)
    for (var u = r[a], f = u.length, c, d = 0; d < f; ++d)
      if (c = u[d]) {
        for (var h = t.call(c, c.__data__, d, u), g, m = te(c, n), b = 0, R = h.length; b < R; ++b)
          (g = h[b]) && Wr(g, e, n, b, h, m);
        o.push(h), s.push(c);
      }
  return new xe(o, s, e, n);
}
var Zd = ur.prototype.constructor;
function Jd() {
  return new Zd(this._groups, this._parents);
}
function Qd(t, e) {
  var n, r, i;
  return function() {
    var o = Rn(this, t), s = (this.style.removeProperty(t), Rn(this, t));
    return o === s ? null : o === n && s === r ? i : i = e(n = o, r = s);
  };
}
function ca(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function jd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = Rn(this, t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function $d(t, e, n) {
  var r, i, o;
  return function() {
    var s = Rn(this, t), a = n(this), u = a + "";
    return a == null && (u = a = (this.style.removeProperty(t), Rn(this, t))), s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a));
  };
}
function t0(t, e) {
  var n, r, i, o = "style." + e, s = "end." + o, a;
  return function() {
    var u = fe(this, t), f = u.on, c = u.value[o] == null ? a || (a = ca(e)) : void 0;
    (f !== n || i !== c) && (r = (n = f).copy()).on(s, i = c), u.on = r;
  };
}
function e0(t, e, n) {
  var r = (t += "") == "transform" ? ed : fa;
  return e == null ? this.styleTween(t, Qd(t, r)).on("end.style." + t, ca(t)) : typeof e == "function" ? this.styleTween(t, $d(t, r, Ui(this, "style." + t, e))).each(t0(this._id, t)) : this.styleTween(t, jd(t, r, e), n).on("end.style." + t, null);
}
function n0(t, e, n) {
  return function(r) {
    this.style.setProperty(t, e.call(this, r), n);
  };
}
function r0(t, e, n) {
  var r, i;
  function o() {
    var s = e.apply(this, arguments);
    return s !== i && (r = (i = s) && n0(t, s, n)), r;
  }
  return o._value = e, o;
}
function i0(t, e, n) {
  var r = "style." + (t += "");
  if (arguments.length < 2) return (r = this.tween(r)) && r._value;
  if (e == null) return this.tween(r, null);
  if (typeof e != "function") throw new Error();
  return this.tween(r, r0(t, e, n ?? ""));
}
function o0(t) {
  return function() {
    this.textContent = t;
  };
}
function s0(t) {
  return function() {
    var e = t(this);
    this.textContent = e ?? "";
  };
}
function a0(t) {
  return this.tween("text", typeof t == "function" ? s0(Ui(this, "text", t)) : o0(t == null ? "" : t + ""));
}
function l0(t) {
  return function(e) {
    this.textContent = t.call(this, e);
  };
}
function u0(t) {
  var e, n;
  function r() {
    var i = t.apply(this, arguments);
    return i !== n && (e = (n = i) && l0(i)), e;
  }
  return r._value = t, r;
}
function f0(t) {
  var e = "text";
  if (arguments.length < 1) return (e = this.tween(e)) && e._value;
  if (t == null) return this.tween(e, null);
  if (typeof t != "function") throw new Error();
  return this.tween(e, u0(t));
}
function c0() {
  for (var t = this._name, e = this._id, n = ha(), r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, f = 0; f < a; ++f)
      if (u = s[f]) {
        var c = te(u, e);
        Wr(u, t, n, f, s, {
          time: c.time + c.delay + c.duration,
          delay: 0,
          duration: c.duration,
          ease: c.ease
        });
      }
  return new xe(r, this._parents, t, n);
}
function h0() {
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
var d0 = 0;
function xe(t, e, n, r) {
  this._groups = t, this._parents = e, this._name = n, this._id = r;
}
function ha() {
  return ++d0;
}
var de = ur.prototype;
xe.prototype = {
  constructor: xe,
  select: Wd,
  selectAll: Kd,
  selectChild: de.selectChild,
  selectChildren: de.selectChildren,
  filter: Hd,
  merge: Bd,
  selection: Jd,
  transition: c0,
  call: de.call,
  nodes: de.nodes,
  node: de.node,
  size: de.size,
  empty: de.empty,
  each: de.each,
  on: qd,
  attr: Ed,
  attrTween: Id,
  style: e0,
  styleTween: i0,
  text: a0,
  textTween: f0,
  remove: Gd,
  tween: pd,
  delay: Td,
  duration: Fd,
  ease: Od,
  easeVarying: Yd,
  end: h0,
  [Symbol.iterator]: de[Symbol.iterator]
};
function g0(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}
var v0 = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: g0
};
function m0(t, e) {
  for (var n; !(n = t.__transition) || !(n = n[e]); )
    if (!(t = t.parentNode))
      throw new Error(`transition ${e} not found`);
  return n;
}
function p0(t) {
  var e, n;
  t instanceof xe ? (e = t._id, t = t._name) : (e = ha(), (n = v0).time = Xi(), t = t == null ? null : t + "");
  for (var r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && Wr(u, t, e, f, s, n || m0(u, e));
  return new xe(r, this._parents, t, e);
}
ur.prototype.interrupt = gd;
ur.prototype.transition = p0;
const yr = (t) => () => t;
function _0(t, {
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
var da = new _e(1, 0, 0);
_e.prototype;
function ei(t) {
  t.stopImmediatePropagation();
}
function Yn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function y0(t) {
  return (!t.ctrlKey || t.type === "wheel") && !t.button;
}
function w0() {
  var t = this;
  return t instanceof SVGElement ? (t = t.ownerSVGElement || t, t.hasAttribute("viewBox") ? (t = t.viewBox.baseVal, [[t.x, t.y], [t.x + t.width, t.y + t.height]]) : [[0, 0], [t.width.baseVal.value, t.height.baseVal.value]]) : [[0, 0], [t.clientWidth, t.clientHeight]];
}
function Lo() {
  return this.__zoom || da;
}
function x0(t) {
  return -t.deltaY * (t.deltaMode === 1 ? 0.05 : t.deltaMode ? 1 : 2e-3) * (t.ctrlKey ? 10 : 1);
}
function b0() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function k0(t, e, n) {
  var r = t.invertX(e[0][0]) - n[0][0], i = t.invertX(e[1][0]) - n[1][0], o = t.invertY(e[0][1]) - n[0][1], s = t.invertY(e[1][1]) - n[1][1];
  return t.translate(
    i > r ? (r + i) / 2 : Math.min(0, r) || Math.max(0, i),
    s > o ? (o + s) / 2 : Math.min(0, o) || Math.max(0, s)
  );
}
function E0() {
  var t = y0, e = w0, n = k0, r = x0, i = b0, o = [0, 1 / 0], s = [[-1 / 0, -1 / 0], [1 / 0, 1 / 0]], a = 250, u = sd, f = qr("start", "zoom", "end"), c, d, h, g = 500, m = 150, b = 0, R = 10;
  function S(p) {
    p.property("__zoom", Lo).on("wheel.zoom", F, { passive: !1 }).on("mousedown.zoom", D).on("dblclick.zoom", V).filter(i).on("touchstart.zoom", I).on("touchmove.zoom", q).on("touchend.zoom touchcancel.zoom", X).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  S.transform = function(p, A, _, x) {
    var N = p.selection ? p.selection() : p;
    N.property("__zoom", Lo), p !== N ? T(p, A, _, x) : N.interrupt().each(function() {
      k(this, arguments).event(x).start().zoom(null, typeof A == "function" ? A.apply(this, arguments) : A).end();
    });
  }, S.scaleBy = function(p, A, _, x) {
    S.scaleTo(p, function() {
      var N = this.__zoom.k, E = typeof A == "function" ? A.apply(this, arguments) : A;
      return N * E;
    }, _, x);
  }, S.scaleTo = function(p, A, _, x) {
    S.transform(p, function() {
      var N = e.apply(this, arguments), E = this.__zoom, z = _ == null ? w(N) : typeof _ == "function" ? _.apply(this, arguments) : _, H = E.invert(z), U = typeof A == "function" ? A.apply(this, arguments) : A;
      return n(P(Y(E, U), z, H), N, s);
    }, _, x);
  }, S.translateBy = function(p, A, _, x) {
    S.transform(p, function() {
      return n(this.__zoom.translate(
        typeof A == "function" ? A.apply(this, arguments) : A,
        typeof _ == "function" ? _.apply(this, arguments) : _
      ), e.apply(this, arguments), s);
    }, null, x);
  }, S.translateTo = function(p, A, _, x, N) {
    S.transform(p, function() {
      var E = e.apply(this, arguments), z = this.__zoom, H = x == null ? w(E) : typeof x == "function" ? x.apply(this, arguments) : x;
      return n(da.translate(H[0], H[1]).scale(z.k).translate(
        typeof A == "function" ? -A.apply(this, arguments) : -A,
        typeof _ == "function" ? -_.apply(this, arguments) : -_
      ), E, s);
    }, x, N);
  };
  function Y(p, A) {
    return A = Math.max(o[0], Math.min(o[1], A)), A === p.k ? p : new _e(A, p.x, p.y);
  }
  function P(p, A, _) {
    var x = A[0] - _[0] * p.k, N = A[1] - _[1] * p.k;
    return x === p.x && N === p.y ? p : new _e(p.k, x, N);
  }
  function w(p) {
    return [(+p[0][0] + +p[1][0]) / 2, (+p[0][1] + +p[1][1]) / 2];
  }
  function T(p, A, _, x) {
    p.on("start.zoom", function() {
      k(this, arguments).event(x).start();
    }).on("interrupt.zoom end.zoom", function() {
      k(this, arguments).event(x).end();
    }).tween("zoom", function() {
      var N = this, E = arguments, z = k(N, E).event(x), H = e.apply(N, E), U = _ == null ? w(H) : typeof _ == "function" ? _.apply(N, E) : _, j = Math.max(H[1][0] - H[0][0], H[1][1] - H[0][1]), W = N.__zoom, rt = typeof A == "function" ? A.apply(N, E) : A, at = u(W.invert(U).concat(j / W.k), rt.invert(U).concat(j / rt.k));
      return function(C) {
        if (C === 1) C = rt;
        else {
          var O = at(C), tt = j / O[2];
          C = new _e(tt, U[0] - O[0] * tt, U[1] - O[1] * tt);
        }
        z.zoom(null, C);
      };
    });
  }
  function k(p, A, _) {
    return !_ && p.__zooming || new M(p, A);
  }
  function M(p, A) {
    this.that = p, this.args = A, this.active = 0, this.sourceEvent = null, this.extent = e.apply(p, A), this.taps = 0;
  }
  M.prototype = {
    event: function(p) {
      return p && (this.sourceEvent = p), this;
    },
    start: function() {
      return ++this.active === 1 && (this.that.__zooming = this, this.emit("start")), this;
    },
    zoom: function(p, A) {
      return this.mouse && p !== "mouse" && (this.mouse[1] = A.invert(this.mouse[0])), this.touch0 && p !== "touch" && (this.touch0[1] = A.invert(this.touch0[0])), this.touch1 && p !== "touch" && (this.touch1[1] = A.invert(this.touch1[0])), this.that.__zoom = A, this.emit("zoom"), this;
    },
    end: function() {
      return --this.active === 0 && (delete this.that.__zooming, this.emit("end")), this;
    },
    emit: function(p) {
      var A = zt(this.that).datum();
      f.call(
        p,
        this.that,
        new _0(p, {
          sourceEvent: this.sourceEvent,
          target: S,
          transform: this.that.__zoom,
          dispatch: f
        }),
        A
      );
    }
  };
  function F(p, ...A) {
    if (!t.apply(this, arguments)) return;
    var _ = k(this, A).event(p), x = this.__zoom, N = Math.max(o[0], Math.min(o[1], x.k * Math.pow(2, r.apply(this, arguments)))), E = ve(p);
    if (_.wheel)
      (_.mouse[0][0] !== E[0] || _.mouse[0][1] !== E[1]) && (_.mouse[1] = x.invert(_.mouse[0] = E)), clearTimeout(_.wheel);
    else {
      if (x.k === N) return;
      _.mouse = [E, x.invert(E)], Mr(this), _.start();
    }
    Yn(p), _.wheel = setTimeout(z, m), _.zoom("mouse", n(P(Y(x, N), _.mouse[0], _.mouse[1]), _.extent, s));
    function z() {
      _.wheel = null, _.end();
    }
  }
  function D(p, ...A) {
    if (h || !t.apply(this, arguments)) return;
    var _ = p.currentTarget, x = k(this, A, !0).event(p), N = zt(p.view).on("mousemove.zoom", U, !0).on("mouseup.zoom", j, !0), E = ve(p, _), z = p.clientX, H = p.clientY;
    js(p.view), ei(p), x.mouse = [E, this.__zoom.invert(E)], Mr(this), x.start();
    function U(W) {
      if (Yn(W), !x.moved) {
        var rt = W.clientX - z, at = W.clientY - H;
        x.moved = rt * rt + at * at > b;
      }
      x.event(W).zoom("mouse", n(P(x.that.__zoom, x.mouse[0] = ve(W, _), x.mouse[1]), x.extent, s));
    }
    function j(W) {
      N.on("mousemove.zoom mouseup.zoom", null), $s(W.view, x.moved), Yn(W), x.event(W).end();
    }
  }
  function V(p, ...A) {
    if (t.apply(this, arguments)) {
      var _ = this.__zoom, x = ve(p.changedTouches ? p.changedTouches[0] : p, this), N = _.invert(x), E = _.k * (p.shiftKey ? 0.5 : 2), z = n(P(Y(_, E), x, N), e.apply(this, A), s);
      Yn(p), a > 0 ? zt(this).transition().duration(a).call(T, z, x, p) : zt(this).call(S.transform, z, x, p);
    }
  }
  function I(p, ...A) {
    if (t.apply(this, arguments)) {
      var _ = p.touches, x = _.length, N = k(this, A, p.changedTouches.length === x).event(p), E, z, H, U;
      for (ei(p), z = 0; z < x; ++z)
        H = _[z], U = ve(H, this), U = [U, this.__zoom.invert(U), H.identifier], N.touch0 ? !N.touch1 && N.touch0[2] !== U[2] && (N.touch1 = U, N.taps = 0) : (N.touch0 = U, E = !0, N.taps = 1 + !!c);
      c && (c = clearTimeout(c)), E && (N.taps < 2 && (d = U[0], c = setTimeout(function() {
        c = null;
      }, g)), Mr(this), N.start());
    }
  }
  function q(p, ...A) {
    if (this.__zooming) {
      var _ = k(this, A).event(p), x = p.changedTouches, N = x.length, E, z, H, U;
      for (Yn(p), E = 0; E < N; ++E)
        z = x[E], H = ve(z, this), _.touch0 && _.touch0[2] === z.identifier ? _.touch0[0] = H : _.touch1 && _.touch1[2] === z.identifier && (_.touch1[0] = H);
      if (z = _.that.__zoom, _.touch1) {
        var j = _.touch0[0], W = _.touch0[1], rt = _.touch1[0], at = _.touch1[1], C = (C = rt[0] - j[0]) * C + (C = rt[1] - j[1]) * C, O = (O = at[0] - W[0]) * O + (O = at[1] - W[1]) * O;
        z = Y(z, Math.sqrt(C / O)), H = [(j[0] + rt[0]) / 2, (j[1] + rt[1]) / 2], U = [(W[0] + at[0]) / 2, (W[1] + at[1]) / 2];
      } else if (_.touch0) H = _.touch0[0], U = _.touch0[1];
      else return;
      _.zoom("touch", n(P(z, H, U), _.extent, s));
    }
  }
  function X(p, ...A) {
    if (this.__zooming) {
      var _ = k(this, A).event(p), x = p.changedTouches, N = x.length, E, z;
      for (ei(p), h && clearTimeout(h), h = setTimeout(function() {
        h = null;
      }, g), E = 0; E < N; ++E)
        z = x[E], _.touch0 && _.touch0[2] === z.identifier ? delete _.touch0 : _.touch1 && _.touch1[2] === z.identifier && delete _.touch1;
      if (_.touch1 && !_.touch0 && (_.touch0 = _.touch1, delete _.touch1), _.touch0) _.touch0[1] = this.__zoom.invert(_.touch0[0]);
      else if (_.end(), _.taps === 2 && (z = ve(z, this), Math.hypot(d[0] - z[0], d[1] - z[1]) < R)) {
        var H = zt(this).on("dblclick.zoom");
        H && H.apply(this, arguments);
      }
    }
  }
  return S.wheelDelta = function(p) {
    return arguments.length ? (r = typeof p == "function" ? p : yr(+p), S) : r;
  }, S.filter = function(p) {
    return arguments.length ? (t = typeof p == "function" ? p : yr(!!p), S) : t;
  }, S.touchable = function(p) {
    return arguments.length ? (i = typeof p == "function" ? p : yr(!!p), S) : i;
  }, S.extent = function(p) {
    return arguments.length ? (e = typeof p == "function" ? p : yr([[+p[0][0], +p[0][1]], [+p[1][0], +p[1][1]]]), S) : e;
  }, S.scaleExtent = function(p) {
    return arguments.length ? (o[0] = +p[0], o[1] = +p[1], S) : [o[0], o[1]];
  }, S.translateExtent = function(p) {
    return arguments.length ? (s[0][0] = +p[0][0], s[1][0] = +p[1][0], s[0][1] = +p[0][1], s[1][1] = +p[1][1], S) : [[s[0][0], s[0][1]], [s[1][0], s[1][1]]];
  }, S.constrain = function(p) {
    return arguments.length ? (n = p, S) : n;
  }, S.duration = function(p) {
    return arguments.length ? (a = +p, S) : a;
  }, S.interpolate = function(p) {
    return arguments.length ? (u = p, S) : u;
  }, S.on = function() {
    var p = f.on.apply(f, arguments);
    return p === f ? S : p;
  }, S.clickDistance = function(p) {
    return arguments.length ? (b = (p = +p) * p, S) : Math.sqrt(b);
  }, S.tapDistance = function(p) {
    return arguments.length ? (R = +p, S) : R;
  }, S;
}
function S0(t) {
  if (t.length === 0) return "";
  const [e, ...n] = t;
  if (!e) return "";
  let r = `M ${e.x} ${e.y}`;
  for (const i of n)
    r += ` L ${i.x} ${i.y}`;
  return r;
}
const Hn = 12;
function N0(t) {
  const e = t.absolutePosition.x, n = t.absolutePosition.y;
  switch (t.side) {
    case "top":
      return { x: e, y: n - Hn, textAnchor: "middle" };
    case "bottom":
      return { x: e, y: n + Hn + 4, textAnchor: "middle" };
    case "left":
      return { x: e - Hn, y: n, textAnchor: "end" };
    case "right":
      return { x: e + Hn, y: n, textAnchor: "start" };
    default:
      return { x: e, y: n - Hn, textAnchor: "middle" };
  }
}
const Oo = [
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
function M0(t) {
  if (!t || t.length === 0) return;
  const e = t.reduce((n, r) => n + r, 0);
  return Oo[e % Oo.length];
}
var A0 = /* @__PURE__ */ st('<path fill="none" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke="white" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke-linecap="round" pointer-events="none"></path>', 1), I0 = /* @__PURE__ */ st('<path class="link" fill="none" stroke-linecap="round" pointer-events="none"></path>'), P0 = /* @__PURE__ */ st('<text class="link-label" text-anchor="middle"> </text>'), z0 = /* @__PURE__ */ st('<text class="link-label" text-anchor="middle"> </text>'), T0 = /* @__PURE__ */ st("<!><!>", 1), C0 = /* @__PURE__ */ st('<g class="link-group"><!><path fill="none" stroke="transparent" stroke-linecap="round" class="link-hit"></path><!></g>');
function R0(t, e) {
  sn(e, !0);
  let n = bt(e, "selected", 3, !1), r = bt(e, "interactive", 3, !1);
  const i = /* @__PURE__ */ L(() => S0(e.edge.points)), o = /* @__PURE__ */ L(() => e.edge.link), s = /* @__PURE__ */ L(() => {
    var k;
    return ((k = l(o)) == null ? void 0 : k.type) ?? "solid";
  }), a = /* @__PURE__ */ L(() => () => {
    var k, M;
    switch (l(s)) {
      case "dashed":
        return "5 3";
      default:
        return ((M = (k = l(o)) == null ? void 0 : k.style) == null ? void 0 : M.strokeDasharray) ?? "";
    }
  }), u = /* @__PURE__ */ L(() => {
    var k, M, F;
    return n() ? e.colors.selection : ((M = (k = l(o)) == null ? void 0 : k.style) == null ? void 0 : M.stroke) ?? M0((F = l(o)) == null ? void 0 : F.vlan) ?? e.colors.linkStroke;
  }), f = /* @__PURE__ */ L(() => l(s) === "double"), c = /* @__PURE__ */ L(() => () => {
    var M;
    return (M = l(o)) != null && M.label ? [Array.isArray(l(o).label) ? l(o).label.join(" / ") : l(o).label] : [];
  }), d = /* @__PURE__ */ L(() => () => {
    var k;
    return !((k = l(o)) != null && k.vlan) || l(o).vlan.length === 0 ? "" : l(o).vlan.length === 1 ? `VLAN ${l(o).vlan[0]}` : `VLAN ${l(o).vlan.join(", ")}`;
  }), h = /* @__PURE__ */ L(() => () => {
    if (e.edge.points.length < 2) return null;
    const k = Math.floor(e.edge.points.length / 2), M = e.edge.points[k - 1], F = e.edge.points[k];
    return !M || !F ? null : { x: (M.x + F.x) / 2, y: (M.y + F.y) / 2 };
  });
  function g(k) {
    var M;
    r() && (k.stopPropagation(), (M = e.onselect) == null || M.call(e, e.edge.id));
  }
  function m(k) {
    var M, F;
    r() && (k.preventDefault(), k.stopPropagation(), (M = e.onselect) == null || M.call(e, e.edge.id), (F = e.oncontextmenu) == null || F.call(e, e.edge.id, k));
  }
  var b = C0(), R = ht(b);
  {
    var S = (k) => {
      const M = /* @__PURE__ */ L(() => Math.max(3, Math.round(e.edge.width * 0.9)));
      var F = A0(), D = At(F), V = nt(D), I = nt(V);
      ot(
        (q, X) => {
          v(D, "d", l(i)), v(D, "stroke", l(u)), v(D, "stroke-width", e.edge.width + l(M) * 2), v(V, "d", l(i)), v(V, "stroke-width", q), v(I, "d", l(i)), v(I, "stroke", l(u)), v(I, "stroke-width", X);
        },
        [
          () => Math.max(1, e.edge.width),
          () => Math.max(1, e.edge.width - Math.round(l(M) * 0.8))
        ]
      ), J(k, F);
    }, Y = (k) => {
      var M = I0();
      ot(
        (F) => {
          v(M, "d", l(i)), v(M, "stroke", l(u)), v(M, "stroke-width", e.edge.width), v(M, "stroke-dasharray", F);
        },
        [() => l(a)() || void 0]
      ), J(k, M);
    };
    pt(R, (k) => {
      l(f) ? k(S) : k(Y, !1);
    });
  }
  var P = nt(R);
  P.__click = g, P.__contextmenu = m;
  var w = nt(P);
  {
    var T = (k) => {
      const M = /* @__PURE__ */ L(() => l(h)());
      var F = ge(), D = At(F);
      {
        var V = (I) => {
          const q = /* @__PURE__ */ L(() => l(c)()), X = /* @__PURE__ */ L(() => l(d)());
          var p = T0(), A = At(p);
          Be(A, 17, () => l(q), Ns, (N, E, z) => {
            var H = P0(), U = ht(H);
            ot(() => {
              v(H, "x", l(M).x), v(H, "y", l(M).y - 8 + z * 12), Jn(U, l(E));
            }), J(N, H);
          });
          var _ = nt(A);
          {
            var x = (N) => {
              var E = z0(), z = ht(E);
              ot(() => {
                v(E, "x", l(M).x), v(E, "y", l(M).y - 8 + l(q).length * 12), Jn(z, l(X));
              }), J(N, E);
            };
            pt(_, (N) => {
              l(X) && N(x);
            });
          }
          J(I, p);
        };
        pt(D, (I) => {
          l(M) && I(V);
        });
      }
      J(k, F);
    };
    pt(w, (k) => {
      l(h)() && k(T);
    });
  }
  ot(
    (k) => {
      v(b, "data-link-id", e.edge.id), v(P, "d", l(i)), v(P, "stroke-width", k);
    },
    [() => Math.max(e.edge.width + 12, 16)]
  ), J(t, b), an();
}
lr(["click", "contextmenu"]);
var F0 = /* @__PURE__ */ st('<line stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"></line>');
function L0(t, e) {
  var n = F0();
  ot(() => {
    v(n, "x1", e.fromX), v(n, "y1", e.fromY), v(n, "x2", e.toX), v(n, "y2", e.toY);
  }), J(t, n);
}
var O0 = /* @__PURE__ */ st('<rect rx="8" ry="8"></rect>'), D0 = /* @__PURE__ */ st("<rect></rect>"), Y0 = /* @__PURE__ */ st("<circle></circle>"), H0 = /* @__PURE__ */ st("<polygon></polygon>"), B0 = /* @__PURE__ */ st("<polygon></polygon>"), V0 = /* @__PURE__ */ st('<g><ellipse></ellipse><rect stroke="none"></rect><line></line><line></line><ellipse></ellipse></g>'), X0 = /* @__PURE__ */ st("<rect></rect>"), q0 = /* @__PURE__ */ st("<polygon></polygon>"), U0 = /* @__PURE__ */ st('<rect rx="8" ry="8"></rect>'), G0 = /* @__PURE__ */ st('<g class="node-icon"><svg viewBox="0 0 24 24" fill="currentColor"><!></svg></g>'), W0 = /* @__PURE__ */ st('<text text-anchor="middle"> </text>'), K0 = /* @__PURE__ */ st('<rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect>', 1), Z0 = /* @__PURE__ */ st('<circle r="7" fill="#3b82f6" opacity="0.8" pointer-events="none"></circle><text text-anchor="middle" dominant-baseline="central" font-size="11" fill="white" pointer-events="none">+</text>', 1), J0 = /* @__PURE__ */ st('<g class="node"><g class="node-bg"><!></g><g class="node-fg" pointer-events="none"><!><!></g><!><!></g>');
function Q0(t, e) {
  sn(e, !0);
  let n = bt(e, "shadowFilterId", 3, "node-shadow"), r = bt(e, "selected", 3, !1), i = bt(e, "interactive", 3, !1);
  const o = /* @__PURE__ */ L(() => e.node.position.x), s = /* @__PURE__ */ L(() => e.node.position.y), a = /* @__PURE__ */ L(() => e.node.size.width / 2), u = /* @__PURE__ */ L(() => e.node.size.height / 2), f = /* @__PURE__ */ L(() => e.node.node.shape ?? "rounded");
  let c = /* @__PURE__ */ ft(!1);
  const d = /* @__PURE__ */ L(() => r() || l(c)), h = /* @__PURE__ */ L(() => {
    var C;
    return ((C = e.node.node.style) == null ? void 0 : C.fill) ?? (l(d) ? e.colors.nodeHoverFill : e.colors.nodeFill);
  }), g = /* @__PURE__ */ L(() => {
    var C;
    return r() ? e.colors.selection : ((C = e.node.node.style) == null ? void 0 : C.stroke) ?? (l(c) ? e.colors.nodeHoverStroke : e.colors.nodeStroke);
  }), m = /* @__PURE__ */ L(() => {
    var C;
    return r() ? 2.5 : ((C = e.node.node.style) == null ? void 0 : C.strokeWidth) ?? (l(c) ? 2 : 1.5);
  }), b = /* @__PURE__ */ L(() => {
    var C;
    return ((C = e.node.node.style) == null ? void 0 : C.strokeDasharray) ?? "";
  }), R = /* @__PURE__ */ L(() => nu(e.node.node.type)), S = Ql, Y = /* @__PURE__ */ L(() => Array.isArray(e.node.node.label) ? e.node.node.label : [e.node.node.label ?? ""]), P = /* @__PURE__ */ L(() => l(Y).map((C, O) => {
    const tt = C.includes("<b>") || C.includes("<strong>"), $ = C.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, ""), wt = O > 0 && !tt;
    return { text: $, className: tt ? "node-label node-label-bold" : wt ? "node-label-secondary" : "node-label" };
  })), w = /* @__PURE__ */ L(() => l(R) ? S : 0), T = /* @__PURE__ */ L(() => l(w) > 0 ? jl : 0), k = /* @__PURE__ */ L(() => l(P).length * Jr), M = /* @__PURE__ */ L(() => l(w) + l(T) + l(k)), F = /* @__PURE__ */ L(() => l(s) - l(M) / 2), D = /* @__PURE__ */ L(() => l(F) + l(w) + l(T) + Jr * 0.7);
  let V = /* @__PURE__ */ ft(null);
  function I(C, O) {
    const tt = O.currentTarget.getBoundingClientRect();
    if (C === "top" || C === "bottom") {
      const $ = Math.max(0, Math.min(1, (O.clientX - tt.left) / tt.width));
      B(
        V,
        {
          side: C,
          x: l(o) - l(a) + $ * e.node.size.width,
          y: C === "top" ? l(s) - l(u) : l(s) + l(u)
        },
        !0
      );
    } else {
      const $ = Math.max(0, Math.min(1, (O.clientY - tt.top) / tt.height));
      B(
        V,
        {
          side: C,
          x: C === "left" ? l(o) - l(a) : l(o) + l(a),
          y: l(s) - l(u) + $ * e.node.size.height
        },
        !0
      );
    }
  }
  function q(C) {
    var O;
    l(V) && (C.stopPropagation(), C.preventDefault(), (O = e.onaddport) == null || O.call(e, e.node.id, l(V).side));
  }
  function X(C) {
    var O;
    i() && (C.preventDefault(), C.stopPropagation(), (O = e.oncontextmenu) == null || O.call(e, e.node.id, C));
  }
  var p = J0();
  p.__contextmenu = X;
  var A = ht(p), _ = ht(A);
  {
    var x = (C) => {
      var O = O0();
      ot(() => {
        v(O, "x", l(o) - l(a)), v(O, "y", l(s) - l(u)), v(O, "width", e.node.size.width), v(O, "height", e.node.size.height), v(O, "fill", l(h)), v(O, "stroke", l(g)), v(O, "stroke-width", l(m)), v(O, "stroke-dasharray", l(b) || void 0);
      }), J(C, O);
    }, N = (C) => {
      var O = ge(), tt = At(O);
      {
        var $ = (lt) => {
          var ct = D0();
          ot(() => {
            v(ct, "x", l(o) - l(a)), v(ct, "y", l(s) - l(u)), v(ct, "width", e.node.size.width), v(ct, "height", e.node.size.height), v(ct, "fill", l(h)), v(ct, "stroke", l(g)), v(ct, "stroke-width", l(m)), v(ct, "stroke-dasharray", l(b) || void 0);
          }), J(lt, ct);
        }, wt = (lt) => {
          var ct = ge(), ce = At(ct);
          {
            var ga = (ln) => {
              var ee = Y0();
              ot(
                (Kr) => {
                  v(ee, "cx", l(o)), v(ee, "cy", l(s)), v(ee, "r", Kr), v(ee, "fill", l(h)), v(ee, "stroke", l(g)), v(ee, "stroke-width", l(m));
                },
                [() => Math.min(l(a), l(u))]
              ), J(ln, ee);
            }, va = (ln) => {
              var ee = ge(), Kr = At(ee);
              {
                var ma = (un) => {
                  var Ne = H0();
                  ot(() => {
                    v(Ne, "points", `${l(o) ?? ""},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) ?? ""},${l(s) + l(u)} ${l(o) - l(a)},${l(s) ?? ""}`), v(Ne, "fill", l(h)), v(Ne, "stroke", l(g)), v(Ne, "stroke-width", l(m));
                  }), J(un, Ne);
                }, pa = (un) => {
                  var Ne = ge(), _a = At(Ne);
                  {
                    var ya = (fn) => {
                      const Ye = /* @__PURE__ */ L(() => l(a) * 0.866);
                      var He = B0();
                      ot(() => {
                        v(He, "points", `${l(o) - l(a)},${l(s) ?? ""} ${l(o) - l(Ye)},${l(s) - l(u)} ${l(o) + l(Ye)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) + l(Ye)},${l(s) + l(u)} ${l(o) - l(Ye)},${l(s) + l(u)}`), v(He, "fill", l(h)), v(He, "stroke", l(g)), v(He, "stroke-width", l(m));
                      }), J(fn, He);
                    }, wa = (fn) => {
                      var Ye = ge(), He = At(Ye);
                      {
                        var xa = (cn) => {
                          const Lt = /* @__PURE__ */ L(() => e.node.size.height * 0.15);
                          var cr = V0(), ne = ht(cr), Me = nt(ne), Nt = nt(Me), ut = nt(Nt), he = nt(ut);
                          ot(() => {
                            v(ne, "cx", l(o)), v(ne, "cy", l(s) + l(u) - l(Lt)), v(ne, "rx", l(a)), v(ne, "ry", l(Lt)), v(ne, "fill", l(h)), v(ne, "stroke", l(g)), v(ne, "stroke-width", l(m)), v(Me, "x", l(o) - l(a)), v(Me, "y", l(s) - l(u) + l(Lt)), v(Me, "width", e.node.size.width), v(Me, "height", e.node.size.height - l(Lt) * 2), v(Me, "fill", l(h)), v(Nt, "x1", l(o) - l(a)), v(Nt, "y1", l(s) - l(u) + l(Lt)), v(Nt, "x2", l(o) - l(a)), v(Nt, "y2", l(s) + l(u) - l(Lt)), v(Nt, "stroke", l(g)), v(Nt, "stroke-width", l(m)), v(ut, "x1", l(o) + l(a)), v(ut, "y1", l(s) - l(u) + l(Lt)), v(ut, "x2", l(o) + l(a)), v(ut, "y2", l(s) + l(u) - l(Lt)), v(ut, "stroke", l(g)), v(ut, "stroke-width", l(m)), v(he, "cx", l(o)), v(he, "cy", l(s) - l(u) + l(Lt)), v(he, "rx", l(a)), v(he, "ry", l(Lt)), v(he, "fill", l(h)), v(he, "stroke", l(g)), v(he, "stroke-width", l(m));
                          }), J(cn, cr);
                        }, ba = (cn) => {
                          var Lt = ge(), cr = At(Lt);
                          {
                            var ne = (Nt) => {
                              var ut = X0();
                              ot(() => {
                                v(ut, "x", l(o) - l(a)), v(ut, "y", l(s) - l(u)), v(ut, "width", e.node.size.width), v(ut, "height", e.node.size.height), v(ut, "rx", l(u)), v(ut, "ry", l(u)), v(ut, "fill", l(h)), v(ut, "stroke", l(g)), v(ut, "stroke-width", l(m));
                              }), J(Nt, ut);
                            }, Me = (Nt) => {
                              var ut = ge(), he = At(ut);
                              {
                                var ka = (hn) => {
                                  const Kt = /* @__PURE__ */ L(() => e.node.size.width * 0.15);
                                  var On = q0();
                                  ot(() => {
                                    v(On, "points", `${l(o) - l(a) + l(Kt)},${l(s) - l(u)} ${l(o) + l(a) - l(Kt)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) + l(u)} ${l(o) - l(a)},${l(s) + l(u)}`), v(On, "fill", l(h)), v(On, "stroke", l(g)), v(On, "stroke-width", l(m));
                                  }), J(hn, On);
                                }, Ea = (hn) => {
                                  var Kt = U0();
                                  ot(() => {
                                    v(Kt, "x", l(o) - l(a)), v(Kt, "y", l(s) - l(u)), v(Kt, "width", e.node.size.width), v(Kt, "height", e.node.size.height), v(Kt, "fill", l(h)), v(Kt, "stroke", l(g)), v(Kt, "stroke-width", l(m));
                                  }), J(hn, Kt);
                                };
                                pt(
                                  he,
                                  (hn) => {
                                    l(f) === "trapezoid" ? hn(ka) : hn(Ea, !1);
                                  },
                                  !0
                                );
                              }
                              J(Nt, ut);
                            };
                            pt(
                              cr,
                              (Nt) => {
                                l(f) === "stadium" ? Nt(ne) : Nt(Me, !1);
                              },
                              !0
                            );
                          }
                          J(cn, Lt);
                        };
                        pt(
                          He,
                          (cn) => {
                            l(f) === "cylinder" ? cn(xa) : cn(ba, !1);
                          },
                          !0
                        );
                      }
                      J(fn, Ye);
                    };
                    pt(
                      _a,
                      (fn) => {
                        l(f) === "hexagon" ? fn(ya) : fn(wa, !1);
                      },
                      !0
                    );
                  }
                  J(un, Ne);
                };
                pt(
                  Kr,
                  (un) => {
                    l(f) === "diamond" ? un(ma) : un(pa, !1);
                  },
                  !0
                );
              }
              J(ln, ee);
            };
            pt(
              ce,
              (ln) => {
                l(f) === "circle" ? ln(ga) : ln(va, !1);
              },
              !0
            );
          }
          J(lt, ct);
        };
        pt(
          tt,
          (lt) => {
            l(f) === "rect" ? lt($) : lt(wt, !1);
          },
          !0
        );
      }
      J(C, O);
    };
    pt(_, (C) => {
      l(f) === "rounded" ? C(x) : C(N, !1);
    });
  }
  var E = nt(A), z = ht(E);
  {
    var H = (C) => {
      var O = G0(), tt = ht(O), $ = ht(tt);
      Ms($, () => l(R), !0), ot(() => {
        v(O, "transform", `translate(${l(o) - S / 2}, ${l(F) ?? ""})`), v(tt, "width", S), v(tt, "height", S);
      }), J(C, O);
    };
    pt(z, (C) => {
      l(R) && C(H);
    });
  }
  var U = nt(z);
  Be(U, 17, () => l(P), Ns, (C, O, tt) => {
    var $ = W0(), wt = ht($);
    ot(() => {
      v($, "x", l(o)), v($, "y", l(D) + tt * Jr), Li($, 0, Vl(l(O).className)), Jn(wt, l(O).text);
    }), J(C, $);
  });
  var j = nt(E);
  {
    var W = (C) => {
      const O = /* @__PURE__ */ L(() => 10);
      var tt = K0(), $ = At(tt);
      v($, "height", l(O)), $.__pointermove = (ce) => I("top", ce), $.__pointerdown = q;
      var wt = nt($);
      v(wt, "height", l(O)), wt.__pointermove = (ce) => I("bottom", ce), wt.__pointerdown = q;
      var lt = nt(wt);
      v(lt, "width", l(O)), lt.__pointermove = (ce) => I("left", ce), lt.__pointerdown = q;
      var ct = nt(lt);
      v(ct, "width", l(O)), ct.__pointermove = (ce) => I("right", ce), ct.__pointerdown = q, ot(() => {
        v($, "x", l(o) - l(a)), v($, "y", l(s) - l(u) - l(O) / 2), v($, "width", e.node.size.width), v(wt, "x", l(o) - l(a)), v(wt, "y", l(s) + l(u) - l(O) / 2), v(wt, "width", e.node.size.width), v(lt, "x", l(o) - l(a) - l(O) / 2), v(lt, "y", l(s) - l(u)), v(lt, "height", e.node.size.height), v(ct, "x", l(o) + l(a) - l(O) / 2), v(ct, "y", l(s) - l(u)), v(ct, "height", e.node.size.height);
      }), Ie("pointerleave", $, () => {
        B(V, null);
      }), Ie("pointerleave", wt, () => {
        B(V, null);
      }), Ie("pointerleave", lt, () => {
        B(V, null);
      }), Ie("pointerleave", ct, () => {
        B(V, null);
      }), J(C, tt);
    };
    pt(j, (C) => {
      i() && l(c) && C(W);
    });
  }
  var rt = nt(j);
  {
    var at = (C) => {
      var O = Z0(), tt = At(O), $ = nt(tt);
      ot(() => {
        v(tt, "cx", l(V).x), v(tt, "cy", l(V).y), v($, "x", l(V).x), v($, "y", l(V).y);
      }), J(C, O);
    };
    pt(rt, (C) => {
      l(V) && C(at);
    });
  }
  ot(() => {
    v(p, "data-id", e.node.id), v(p, "data-device-type", e.node.node.type ?? ""), v(p, "filter", `url(#${n() ?? ""})`);
  }), Ie("pointerenter", p, () => {
    i() && B(c, !0);
  }), Ie("pointerleave", p, () => {
    B(c, !1);
  }), J(t, p), an();
}
lr(["contextmenu", "pointermove", "pointerdown"]);
var j0 = /* @__PURE__ */ st('<rect class="port-label-bg" rx="2" pointer-events="none"></rect><text class="port-label" font-size="9" pointer-events="none"> </text>', 1), $0 = /* @__PURE__ */ st('<g class="port"><rect fill="transparent"></rect><rect class="port-box" rx="2" pointer-events="none"></rect><!></g>');
function tg(t, e) {
  sn(e, !0);
  let n = bt(e, "hideLabel", 3, !1), r = bt(e, "selected", 3, !1), i = bt(e, "interactive", 3, !1), o = bt(e, "linked", 3, !1);
  const s = /* @__PURE__ */ L(() => e.port.absolutePosition.x), a = /* @__PURE__ */ L(() => e.port.absolutePosition.y), u = /* @__PURE__ */ L(() => e.port.size.width), f = /* @__PURE__ */ L(() => e.port.size.height), c = /* @__PURE__ */ L(() => N0(e.port)), d = /* @__PURE__ */ L(() => e.port.label.length * $l + 4), h = 12, g = /* @__PURE__ */ L(() => () => l(c).textAnchor === "middle" ? l(c).x - l(d) / 2 : l(c).textAnchor === "end" ? l(c).x - l(d) + 2 : l(c).x - 2), m = /* @__PURE__ */ L(() => l(c).y - h + 3);
  let b = /* @__PURE__ */ ft(!1);
  function R(F) {
    var D, V;
    !i() || F.button !== 0 || (F.stopPropagation(), F.preventDefault(), o() ? (D = e.onselect) == null || D.call(e, e.port.id) : (V = e.onlinkstart) == null || V.call(e, e.port.id, l(s), l(a)));
  }
  function S(F) {
    var D;
    i() && (F.stopPropagation(), (D = e.onlinkend) == null || D.call(e, e.port.id));
  }
  function Y(F) {
    var D;
    i() && (F.preventDefault(), F.stopPropagation(), (D = e.oncontextmenu) == null || D.call(e, e.port.id, F));
  }
  var P = $0();
  P.__contextmenu = Y;
  var w = ht(P);
  v(w, "width", 24), v(w, "height", 24), w.__pointerdown = R, w.__pointerup = S;
  var T = nt(w), k = nt(T);
  {
    var M = (F) => {
      var D = j0(), V = At(D);
      v(V, "height", h);
      var I = nt(V), q = ht(I);
      ot(
        (X) => {
          v(V, "x", X), v(V, "y", l(m)), v(V, "width", l(d)), v(V, "fill", e.colors.portLabelBg), v(I, "x", l(c).x), v(I, "y", l(c).y), v(I, "text-anchor", l(c).textAnchor), v(I, "fill", e.colors.portLabelColor), Jn(q, e.port.label);
        },
        [() => l(g)()]
      ), J(F, D);
    };
    pt(k, (F) => {
      n() || F(M);
    });
  }
  ot(() => {
    v(P, "data-port", e.port.id), v(P, "data-port-device", e.port.nodeId), Li(w, 0, `port-hit ${o() ? "linked" : ""}`), v(w, "x", l(s) - 12), v(w, "y", l(a) - 12), v(T, "x", l(s) - l(u) / 2 - (r() || l(b) ? 2 : 0)), v(T, "y", l(a) - l(f) / 2 - (r() || l(b) ? 2 : 0)), v(T, "width", l(u) + (r() || l(b) ? 4 : 0)), v(T, "height", l(f) + (r() || l(b) ? 4 : 0)), v(T, "fill", r() ? e.colors.selection : l(b) ? "#3b82f6" : e.colors.portFill), v(T, "stroke", r() ? e.colors.selection : l(b) ? "#2563eb" : e.colors.portStroke), v(T, "stroke-width", r() || l(b) ? 2 : 1);
  }), Ie("pointerenter", P, () => {
    B(b, i());
  }), Ie("pointerleave", P, () => {
    B(b, !1);
  }), J(t, P), an();
}
lr(["contextmenu", "pointerdown", "pointerup"]);
var eg = /* @__PURE__ */ st('<g class="subgraph"><rect class="subgraph-bg" rx="12" ry="12"></rect><rect fill="transparent"></rect><text class="subgraph-label" text-anchor="start" pointer-events="none"> </text></g>');
function ng(t, e) {
  sn(e, !0);
  let n = bt(e, "selected", 3, !1);
  const r = /* @__PURE__ */ L(() => e.subgraph.subgraph.style ?? {}), i = [
    "surface-1",
    "surface-2",
    "surface-3",
    "accent-blue",
    "accent-green",
    "accent-red",
    "accent-amber",
    "accent-purple"
  ], o = /* @__PURE__ */ L(() => () => {
    const g = l(r).fill, m = l(r).stroke;
    if (g && i.includes(g) && e.theme) {
      const b = e.theme.colors.surfaces[g];
      return {
        fill: b.fill,
        stroke: m ?? b.stroke,
        text: b.text
      };
    }
    return {
      fill: g ?? e.colors.subgraphFill,
      stroke: m ?? e.colors.subgraphStroke,
      text: e.colors.subgraphText
    };
  }), s = /* @__PURE__ */ L(() => l(r).strokeWidth ?? 3), a = /* @__PURE__ */ L(() => l(r).strokeDasharray ?? "");
  var u = eg(), f = ht(u);
  f.__click = (g) => {
    var m;
    g.stopPropagation(), (m = e.onselect) == null || m.call(e, e.subgraph.id);
  };
  var c = nt(f);
  v(c, "height", 28);
  var d = nt(c), h = ht(d);
  ot(
    (g, m, b) => {
      v(u, "data-id", e.subgraph.id), v(f, "x", e.subgraph.bounds.x), v(f, "y", e.subgraph.bounds.y), v(f, "width", e.subgraph.bounds.width), v(f, "height", e.subgraph.bounds.height), v(f, "fill", g), v(f, "stroke", m), v(f, "stroke-width", n() ? 3 : l(s)), v(f, "stroke-dasharray", n() ? void 0 : l(a) || void 0), v(c, "data-sg-drag", e.subgraph.id), v(c, "x", e.subgraph.bounds.x), v(c, "y", e.subgraph.bounds.y), v(c, "width", e.subgraph.bounds.width), v(d, "x", e.subgraph.bounds.x + 10), v(d, "y", e.subgraph.bounds.y + 20), v(d, "fill", b), Jn(h, e.subgraph.subgraph.label);
    },
    [
      () => l(o)().fill,
      () => n() ? "#3b82f6" : l(o)().stroke,
      () => l(o)().text
    ]
  ), J(t, u), an();
}
lr(["click"]);
var rg = /* @__PURE__ */ st('<svg xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; user-select: none; background: #f8fafc;"><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7"></polygon></marker><filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"></feDropShadow></filter><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5"></path></pattern></defs><!><g class="viewport"><rect class="canvas-bg" x="-99999" y="-99999" width="199998" height="199998" fill="url(#grid)"></rect><!><!><!><!><!></g></svg>');
function ig(t, e) {
  sn(e, !0);
  let n = bt(e, "interactive", 3, !1), r = bt(e, "selection", 19, () => /* @__PURE__ */ new Set()), i = bt(e, "linkedPorts", 19, () => /* @__PURE__ */ new Set()), o = bt(e, "linkPreview", 3, null), s = bt(e, "svgEl", 15, null);
  const a = /* @__PURE__ */ L(() => `${e.bounds.x - 50} ${e.bounds.y - 50} ${e.bounds.width + 100} ${e.bounds.height + 100}`), u = /* @__PURE__ */ L(() => [...e.nodes.values()]), f = /* @__PURE__ */ L(() => [...e.edges.values()]), c = /* @__PURE__ */ L(() => [...e.subgraphs.values()]), d = /* @__PURE__ */ L(() => {
    const I = /* @__PURE__ */ new Map();
    for (const q of e.ports.values()) {
      const X = I.get(q.nodeId);
      X ? X.push(q) : I.set(q.nodeId, [q]);
    }
    return I;
  });
  let h = /* @__PURE__ */ ft(void 0);
  pn(() => {
    if (!s() || !l(h)) return;
    const I = zt(s()), q = E0().scaleExtent([0.1, 5]).filter((X) => X.type === "wheel" ? !0 : X.type === "mousedown" || X.type === "pointerdown" ? X.button === 1 || X.altKey : !1).on("zoom", (X) => {
      l(h) && l(h).setAttribute("transform", X.transform.toString());
    });
    return I.call(q), I.on("contextmenu.zoom", null), () => {
      I.on(".zoom", null);
    };
  }), pn(() => {
    if (l(u).length, l(c).length, !s() || !n()) return;
    const I = wo().filter((X) => {
      const p = X.target;
      return p.closest(".port") || p.closest("[data-droplet]") ? !1 : X.button === 0;
    }).on("drag", function(X) {
      var _;
      const p = this.getAttribute("data-id");
      if (!p) return;
      const A = e.nodes.get(p);
      A && ((_ = e.onnodedragmove) == null || _.call(e, p, A.position.x + X.dx, A.position.y + X.dy));
    });
    zt(s()).selectAll(".node[data-id]").call(I);
    const q = wo().on("drag", function(X) {
      var _;
      const p = this.getAttribute("data-sg-drag");
      if (!p) return;
      const A = e.subgraphs.get(p);
      A && ((_ = e.onsubgraphmove) == null || _.call(e, p, A.bounds.x + X.dx, A.bounds.y + X.dy));
    });
    return zt(s()).selectAll("[data-sg-drag]").call(q), () => {
      zt(s()).selectAll(".node[data-id]").on(".drag", null), zt(s()).selectAll("[data-sg-drag]").on(".drag", null);
    };
  });
  var g = rg();
  let m;
  var b = ht(g), R = ht(b), S = ht(R), Y = nt(b);
  Ms(
    Y,
    () => `<style>
    /* Typography (always) */
    .node-label { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; fill: ${e.colors.nodeText}; }
    .node-label-bold { font-weight: 700; }
    .node-label-secondary { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; font-weight: 400; fill: ${e.colors.nodeTextSecondary}; }
    .node-icon { color: ${e.colors.nodeTextSecondary}; }
    .subgraph-label { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .link-label { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; font-size: 10px; fill: ${e.colors.textSecondary}; }

    /* Default: all interactive elements disabled */
    .subgraph-bg, .port-hit, .link-hit, .edge-zone, [data-sg-drag] { pointer-events: none; }

    /* Edit mode: enable all interaction */
    svg.interactive .node[data-id] { cursor: grab; }
    svg.interactive .node[data-id]:active { cursor: grabbing; }
    svg.interactive .subgraph-bg { pointer-events: fill; cursor: pointer; }
    svg.interactive [data-sg-drag] { pointer-events: fill; cursor: grab; }
    svg.interactive [data-sg-drag]:active { cursor: grabbing; }
    svg.interactive .port-hit { pointer-events: fill; cursor: crosshair; }
    svg.interactive .port-hit.linked { cursor: pointer; }
    svg.interactive .link-hit { pointer-events: stroke; cursor: pointer; }
    svg.interactive .edge-zone { pointer-events: fill; cursor: pointer; }
  </style>`,
    !0
  );
  var P = nt(Y), w = ht(P);
  w.__click = () => {
    var I;
    return (I = e.onbackgroundclick) == null ? void 0 : I.call(e);
  };
  var T = nt(w);
  Be(T, 17, () => l(c), (I) => I.id, (I, q) => {
    {
      let X = /* @__PURE__ */ L(() => r().has(l(q).id));
      ng(I, {
        get subgraph() {
          return l(q);
        },
        get colors() {
          return e.colors;
        },
        get theme() {
          return e.theme;
        },
        get selected() {
          return l(X);
        },
        get onselect() {
          return e.onsubgraphselect;
        }
      });
    }
  });
  var k = nt(T);
  Be(k, 17, () => l(f), (I) => I.id, (I, q) => {
    {
      let X = /* @__PURE__ */ L(() => r().has(l(q).id));
      R0(I, {
        get edge() {
          return l(q);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(X);
        },
        get interactive() {
          return n();
        },
        get onselect() {
          return e.onedgeselect;
        },
        oncontextmenu: (p, A) => {
          var _;
          return (_ = e.oncontextmenu) == null ? void 0 : _.call(e, p, "edge", A);
        }
      });
    }
  });
  var M = nt(k);
  Be(M, 17, () => l(u), (I) => I.id, (I, q) => {
    {
      let X = /* @__PURE__ */ L(() => r().has(l(q).id));
      Q0(I, {
        get node() {
          return l(q);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(X);
        },
        get interactive() {
          return n();
        },
        get onaddport() {
          return e.onaddport;
        },
        oncontextmenu: (p, A) => {
          var _;
          return (_ = e.oncontextmenu) == null ? void 0 : _.call(e, p, "node", A);
        }
      });
    }
  });
  var F = nt(M);
  Be(F, 17, () => l(u), (I) => I.id, (I, q) => {
    var X = ge(), p = At(X);
    Be(p, 17, () => l(d).get(l(q).id) ?? [], (A) => A.id, (A, _) => {
      {
        let x = /* @__PURE__ */ L(() => r().has(l(_).id)), N = /* @__PURE__ */ L(() => i().has(l(_).id));
        tg(A, {
          get port() {
            return l(_);
          },
          get colors() {
            return e.colors;
          },
          get selected() {
            return l(x);
          },
          get interactive() {
            return n();
          },
          get linked() {
            return l(N);
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
          oncontextmenu: (E, z) => {
            var H;
            return (H = e.oncontextmenu) == null ? void 0 : H.call(e, E, "port", z);
          }
        });
      }
    }), J(I, X);
  });
  var D = nt(F);
  {
    var V = (I) => {
      L0(I, {
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
    pt(D, (I) => {
      o() && I(V);
    });
  }
  so(P, (I) => B(h, I), () => l(h)), so(g, (I) => s(I), () => s()), ot(() => {
    v(g, "viewBox", l(a)), m = Li(g, 0, "", null, m, { interactive: n() }), v(S, "fill", e.colors.linkStroke), v(w, "pointer-events", n() ? "fill" : "none");
  }), J(t, g), an();
}
lr(["click"]);
var og = /* @__PURE__ */ Cl('<div style="width: 100%; height: 100%; outline: none;"><!></div>');
function sg(t, e) {
  var A;
  sn(e, !0);
  let n = bt(e, "mode", 3, "view");
  const r = /* @__PURE__ */ L(() => Wf(e.theme));
  let i = /* @__PURE__ */ ft(It(n()));
  const o = /* @__PURE__ */ L(() => l(i) === "edit");
  let s = /* @__PURE__ */ ft(It(new Map(e.layout.nodes))), a = /* @__PURE__ */ ft(It(new Map(e.layout.ports))), u = /* @__PURE__ */ ft(It(new Map(e.layout.edges))), f = /* @__PURE__ */ ft(It(new Map(e.layout.subgraphs))), c = It(e.layout.bounds), d = /* @__PURE__ */ ft(It((A = e.graph) != null && A.links ? [...e.graph.links] : [])), h = /* @__PURE__ */ ft(It(/* @__PURE__ */ new Set())), g = /* @__PURE__ */ ft(null), m = /* @__PURE__ */ ft(null);
  const b = /* @__PURE__ */ L(() => {
    const _ = /* @__PURE__ */ new Set();
    for (const x of l(u).values())
      x.fromPortId && _.add(x.fromPortId), x.toPortId && _.add(x.toPortId);
    return _;
  });
  pn(() => {
    if (!l(o) || !l(m)) return;
    const _ = l(m);
    return _.addEventListener("keydown", q), () => _.removeEventListener("keydown", q);
  }), pn(() => {
    if (!l(m)) return;
    const x = l(m).getRootNode().host;
    if (!x) return;
    function N(E) {
      var H;
      const z = (H = E.detail) == null ? void 0 : H.mode;
      (z === "edit" || z === "view") && B(i, z, !0);
    }
    return x.addEventListener("shumoku-mode-change", N), () => x.removeEventListener("shumoku-mode-change", N);
  }), pn(() => {
    var _, x;
    if (l(h).size === 0)
      (_ = e.onselect) == null || _.call(e, null, null);
    else {
      const N = [...l(h)][0] ?? null;
      if (!N) return;
      let E = "node";
      l(u).has(N) ? E = "edge" : l(a).has(N) ? E = "port" : l(f).has(N) && (E = "subgraph"), (x = e.onselect) == null || x.call(e, N, E);
    }
  });
  async function R(_, x, N) {
    const E = await wu(
      _,
      x,
      N,
      {
        nodes: l(s),
        ports: l(a),
        subgraphs: l(f)
      },
      l(d)
    );
    E && (B(s, E.nodes, !0), B(a, E.ports, !0), B(u, E.edges, !0), E.subgraphs && B(f, E.subgraphs, !0));
  }
  async function S(_, x) {
    const N = Mu(_, x, l(s), l(a), l(d));
    N && (B(s, N.nodes, !0), B(a, N.ports, !0), B(u, await Wn(N.nodes, N.ports, l(d)), !0));
  }
  async function Y(_, x, N) {
    const E = await xu(
      _,
      x,
      N,
      {
        nodes: l(s),
        ports: l(a),
        subgraphs: l(f)
      },
      l(d)
    );
    E && (B(s, E.nodes, !0), B(a, E.ports, !0), B(u, E.edges, !0), B(f, E.subgraphs, !0));
  }
  let P = null;
  function w(_, x, N) {
    var U, j;
    B(g, { fromPortId: _, fromX: x, fromY: N, toX: x, toY: N }, !0);
    function E(W) {
      if (!l(g) || !l(m)) return;
      const at = (l(m).querySelector(".viewport") ?? l(m)).getScreenCTM();
      if (!at) return;
      const C = new DOMPoint(W.clientX, W.clientY).matrixTransform(at.inverse());
      B(g, { ...l(g), toX: C.x, toY: C.y }, !0);
    }
    function z(W) {
      W.target.closest(".port") || H();
    }
    function H() {
      var W, rt;
      (W = l(m)) == null || W.removeEventListener("pointermove", E), (rt = l(m)) == null || rt.removeEventListener("pointerup", z), B(g, null), P = null;
    }
    P = H, (U = l(m)) == null || U.addEventListener("pointermove", E), (j = l(m)) == null || j.addEventListener("pointerup", z);
  }
  function T(_) {
    if (!l(g)) return;
    const x = l(g).fromPortId;
    if (P == null || P(), x === _) return;
    const N = l(a).get(x), E = l(a).get(_);
    N && E && N.nodeId === E.nodeId || k(x, _);
  }
  async function k(_, x) {
    var at;
    const N = _.split(":"), E = x.split(":");
    let z = N[0] ?? "", H = N.slice(1).join(":"), U = E[0] ?? "", j = E.slice(1).join(":");
    if (!z || !H || !U || !j || bu(l(d), z, H, U, j)) return;
    const W = l(s).get(z), rt = l(s).get(U);
    W && rt && W.position.y > rt.position.y && ([z, U] = [U, z], [H, j] = [j, H]), B(
      d,
      [
        ...l(d),
        {
          id: `link-${Date.now()}`,
          from: { node: z, port: H },
          to: { node: U, port: j }
        }
      ],
      !0
    ), B(u, await Wn(l(s), l(a), l(d)), !0), (at = e.onchange) == null || at.call(e, l(d));
  }
  pn(() => {
    if (!l(m)) return;
    const x = l(m).getRootNode().host;
    function N(z) {
      const { label: H, position: U } = z.detail ?? {}, j = `node-${Date.now()}`, W = 180, rt = 80, at = [...l(h)].find((lt) => l(f).has(lt)), C = at ? l(f).get(at) : void 0;
      let O, tt;
      C ? (O = at, tt = U ?? {
        x: C.bounds.x + C.bounds.width / 2,
        y: C.bounds.y + C.bounds.height / 2
      }) : tt = U ?? {
        x: c.x + c.width + 20 + W / 2,
        y: c.y + c.height / 2
      };
      const $ = new Map(l(s));
      $.set(j, {
        id: j,
        position: tt,
        size: { width: W, height: rt },
        node: { id: j, label: H ?? "New Node", shape: "rounded", parent: O }
      });
      const wt = Rs(j, tt.x, tt.y, $, 8, l(f));
      if ($.set(j, { ...$.get(j), position: wt }), B(s, $, !0), O) {
        const lt = new Map(l(f));
        Tr($, lt, l(a)), B(f, lt, !0);
      }
      B(h, /* @__PURE__ */ new Set([j]), !0);
    }
    function E(z) {
      const { label: H, position: U } = z.detail ?? {}, j = `sg-${Date.now()}`, W = 200, rt = 120, at = U ?? {
        x: c.x + c.width + 20 + W / 2,
        y: c.y + c.height / 2
      }, C = new Map(l(f));
      C.set(j, {
        id: j,
        bounds: {
          x: at.x - W / 2,
          y: at.y - rt / 2,
          width: W,
          height: rt
        },
        subgraph: { id: j, label: H ?? "New Group" }
      }), Tr(l(s), C, l(a)), B(f, C, !0);
    }
    return x == null || x.addEventListener("shumoku-add-node", N), x == null || x.addEventListener("shumoku-add-subgraph", E), () => {
      x == null || x.removeEventListener("shumoku-add-node", N), x == null || x.removeEventListener("shumoku-add-subgraph", E);
    };
  });
  function M(_) {
    B(h, /* @__PURE__ */ new Set([_]), !0);
  }
  function F(_) {
    B(h, /* @__PURE__ */ new Set([_]), !0);
  }
  function D(_) {
    B(h, /* @__PURE__ */ new Set([_]), !0);
  }
  function V() {
    B(h, /* @__PURE__ */ new Set(), !0);
  }
  function I(_, x, N) {
    var E;
    B(h, /* @__PURE__ */ new Set([_]), !0), (E = e.oncontextmenu) == null || E.call(e, _, x, N.clientX, N.clientY);
  }
  function q(_) {
    var x, N;
    if (_.key === "Delete" || _.key === "Backspace") {
      for (const E of l(h))
        if (l(u).has(E)) {
          const z = l(u).get(E);
          (x = z == null ? void 0 : z.link) != null && x.id && B(d, l(d).filter((H) => {
            var U;
            return H.id !== ((U = z.link) == null ? void 0 : U.id);
          }), !0);
        } else if (l(a).has(E)) {
          const z = Au(E, l(s), l(a), l(d));
          z && (B(s, z.nodes, !0), B(a, z.ports, !0), B(d, z.links, !0));
        }
      Wn(l(s), l(a), l(d)).then((E) => {
        B(u, E, !0);
      }), B(h, /* @__PURE__ */ new Set(), !0), (N = e.onchange) == null || N.call(e, l(d));
    }
    _.key === "Escape" && (B(h, /* @__PURE__ */ new Set(), !0), B(g, null));
  }
  var X = og(), p = ht(X);
  ig(p, {
    get nodes() {
      return l(s);
    },
    get ports() {
      return l(a);
    },
    get edges() {
      return l(u);
    },
    get subgraphs() {
      return l(f);
    },
    get bounds() {
      return c;
    },
    get colors() {
      return l(r);
    },
    get theme() {
      return e.theme;
    },
    get interactive() {
      return l(o);
    },
    get selection() {
      return l(h);
    },
    get linkedPorts() {
      return l(b);
    },
    get linkPreview() {
      return l(g);
    },
    onnodedragmove: R,
    onaddport: S,
    onlinkstart: w,
    onlinkend: T,
    onedgeselect: M,
    onportselect: F,
    onsubgraphselect: D,
    onsubgraphmove: Y,
    oncontextmenu: I,
    onbackgroundclick: V,
    get svgEl() {
      return l(m);
    },
    set svgEl(_) {
      B(m, _, !0);
    }
  }), J(t, X), an();
}
class ag extends HTMLElement {
  constructor() {
    super();
    vt(this, "_layout", null);
    vt(this, "_graph", null);
    vt(this, "_theme");
    vt(this, "_mode", "view");
    vt(this, "_viewBox");
    vt(this, "_instance", null);
    this.attachShadow({ mode: "open" });
  }
  set layout(n) {
    this._layout = n, this._tryRender();
  }
  get layout() {
    return this._layout;
  }
  set graph(n) {
    this._graph = n;
  }
  get graph() {
    return this._graph;
  }
  set theme(n) {
    this._theme = n;
  }
  get theme() {
    return this._theme;
  }
  set mode(n) {
    this._mode = n;
  }
  get mode() {
    return this._mode;
  }
  get svgElement() {
    var n;
    return ((n = this.shadowRoot) == null ? void 0 : n.querySelector("svg")) ?? null;
  }
  connectedCallback() {
    this._tryRender();
  }
  disconnectedCallback() {
    this._instance && (eo(this._instance), this._instance = null);
  }
  _tryRender() {
    !this.shadowRoot || !this._layout || (this._instance && (eo(this._instance), this._instance = null), this._instance = Fl(sg, {
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
