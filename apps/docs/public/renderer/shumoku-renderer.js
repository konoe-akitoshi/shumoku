var Ea = Object.defineProperty;
var Wi = (t) => {
  throw TypeError(t);
};
var Sa = (t, e, n) => e in t ? Ea(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var mt = (t, e, n) => Sa(t, typeof e != "symbol" ? e + "" : e, n), Jr = (t, e, n) => e.has(t) || Wi("Cannot " + n);
var y = (t, e, n) => (Jr(t, e, "read from private field"), n ? n.call(t) : e.get(t)), Z = (t, e, n) => e.has(t) ? Wi("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, n), G = (t, e, n, r) => (Jr(t, e, "write to private field"), r ? r.call(t, n) : e.set(t, n), n), bt = (t, e, n) => (Jr(t, e, "access private method"), n);
var Do = Array.isArray, Na = Array.prototype.indexOf, Br = Array.from, Aa = Object.defineProperty, pn = Object.getOwnPropertyDescriptor, Ma = Object.getOwnPropertyDescriptors, Ia = Object.prototype, Pa = Array.prototype, Yo = Object.getPrototypeOf, Ki = Object.isExtensible;
function za(t) {
  for (var e = 0; e < t.length; e++)
    t[e]();
}
function Ho() {
  var t, e, n = new Promise((r, i) => {
    t = r, e = i;
  });
  return { promise: n, resolve: t, reject: e };
}
const wt = 2, Mr = 4, Vr = 8, Bo = 1 << 24, be = 16, ke = 32, on = 64, Si = 128, Gt = 512, kt = 1024, Rt = 2048, Ee = 4096, Yt = 8192, ye = 16384, Ni = 32768, In = 65536, Zi = 1 << 17, Vo = 1 << 18, Fn = 1 << 19, Ta = 1 << 20, Ce = 1 << 25, $e = 32768, ri = 1 << 21, Ai = 1 << 22, Re = 1 << 23, qn = Symbol("$state"), Ca = Symbol("legacy props"), Ra = Symbol(""), vn = new class extends Error {
  constructor() {
    super(...arguments);
    mt(this, "name", "StaleReactionError");
    mt(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function Fa() {
  throw new Error("https://svelte.dev/e/async_derived_orphan");
}
function La(t) {
  throw new Error("https://svelte.dev/e/effect_in_teardown");
}
function Oa() {
  throw new Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function Da(t) {
  throw new Error("https://svelte.dev/e/effect_orphan");
}
function Ya() {
  throw new Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Ha(t) {
  throw new Error("https://svelte.dev/e/props_invalid_value");
}
function Ba() {
  throw new Error("https://svelte.dev/e/state_descriptors_fixed");
}
function Va() {
  throw new Error("https://svelte.dev/e/state_prototype_fixed");
}
function Xa() {
  throw new Error("https://svelte.dev/e/state_unsafe_mutation");
}
function qa() {
  throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
const Ua = 1, Ga = 2, Wa = 16, Ka = 1, Za = 4, Ja = 8, Qa = 16, ja = 1, $a = 2, pt = Symbol(), tl = "http://www.w3.org/1999/xhtml";
function el() {
  console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
function Xo(t) {
  return t === this.v;
}
function nl(t, e) {
  return t != t ? e == e : t !== e || t !== null && typeof t == "object" || typeof t == "function";
}
function qo(t) {
  return !nl(t, this.v);
}
let Wt = null;
function Pn(t) {
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
      ls(r);
  }
  return e.i = !0, Wt = e.p, /** @type {T} */
  {};
}
function Uo() {
  return !0;
}
let mn = [];
function rl() {
  var t = mn;
  mn = [], za(t);
}
function Fe(t) {
  if (mn.length === 0) {
    var e = mn;
    queueMicrotask(() => {
      e === mn && rl();
    });
  }
  mn.push(t);
}
function Go(t) {
  var e = et;
  if (e === null)
    return K.f |= Re, t;
  if ((e.f & Ni) === 0) {
    if ((e.f & Si) === 0)
      throw t;
    e.b.error(t);
  } else
    zn(t, e);
}
function zn(t, e) {
  for (; e !== null; ) {
    if ((e.f & Si) !== 0)
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
const il = -7169;
function vt(t, e) {
  t.f = t.f & il | e;
}
function Mi(t) {
  (t.f & Gt) !== 0 || t.deps === null ? vt(t, kt) : vt(t, Ee);
}
function Wo(t) {
  if (t !== null)
    for (const e of t)
      (e.f & wt) === 0 || (e.f & $e) === 0 || (e.f ^= $e, Wo(
        /** @type {Derived} */
        e.deps
      ));
}
function Ko(t, e, n) {
  (t.f & Rt) !== 0 ? e.add(t) : (t.f & Ee) !== 0 && n.add(t), Wo(t.deps), vt(t, kt);
}
const hr = /* @__PURE__ */ new Set();
let st = null, _t = null, Jt = [], Ii = null, ii = !1;
var wn, xn, Ue, bn, rr, kn, En, Sn, ue, oi, si, Zo;
const Gi = class Gi {
  constructor() {
    Z(this, ue);
    mt(this, "committed", !1);
    /**
     * The current values of any sources that are updated in this batch
     * They keys of this map are identical to `this.#previous`
     * @type {Map<Source, any>}
     */
    mt(this, "current", /* @__PURE__ */ new Map());
    /**
     * The values of any sources that are updated in this batch _before_ those updates took place.
     * They keys of this map are identical to `this.#current`
     * @type {Map<Source, any>}
     */
    mt(this, "previous", /* @__PURE__ */ new Map());
    /**
     * When the batch is committed (and the DOM is updated), we need to remove old branches
     * and append new ones by calling the functions added inside (if/each/key/etc) blocks
     * @type {Set<() => void>}
     */
    Z(this, wn, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    Z(this, xn, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    Z(this, Ue, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    Z(this, bn, 0);
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
    Z(this, kn, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    Z(this, En, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    mt(this, "skipped_effects", /* @__PURE__ */ new Set());
    mt(this, "is_fork", !1);
    Z(this, Sn, !1);
  }
  is_deferred() {
    return this.is_fork || y(this, bn) > 0;
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
      bt(this, ue, oi).call(this, o, n, r);
    if (this.is_deferred())
      bt(this, ue, si).call(this, r), bt(this, ue, si).call(this, n);
    else {
      for (const o of y(this, wn)) o();
      y(this, wn).clear(), y(this, Ue) === 0 && bt(this, ue, Zo).call(this), st = null, Ji(r), Ji(n), (i = y(this, rr)) == null || i.resolve();
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
    n !== pt && !this.previous.has(e) && this.previous.set(e, n), (e.f & Re) === 0 && (this.current.set(e, e.v), _t == null || _t.set(e, e.v));
  }
  activate() {
    st = this, this.apply();
  }
  deactivate() {
    st === this && (st = null, _t = null);
  }
  flush() {
    if (this.activate(), Jt.length > 0) {
      if (ol(), st !== null && st !== this)
        return;
    } else y(this, Ue) === 0 && this.process([]);
    this.deactivate();
  }
  discard() {
    for (const e of y(this, xn)) e(this);
    y(this, xn).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(e) {
    G(this, Ue, y(this, Ue) + 1), e && G(this, bn, y(this, bn) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(e) {
    G(this, Ue, y(this, Ue) - 1), e && G(this, bn, y(this, bn) - 1), !y(this, Sn) && (G(this, Sn, !0), Fe(() => {
      G(this, Sn, !1), this.is_deferred() ? Jt.length > 0 && this.flush() : this.revive();
    }));
  }
  revive() {
    for (const e of y(this, kn))
      y(this, En).delete(e), vt(e, Rt), we(e);
    for (const e of y(this, En))
      vt(e, Ee), we(e);
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(e) {
    y(this, wn).add(e);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(e) {
    y(this, xn).add(e);
  }
  settled() {
    return (y(this, rr) ?? G(this, rr, Ho())).promise;
  }
  static ensure() {
    if (st === null) {
      const e = st = new Gi();
      hr.add(st), Fe(() => {
        st === e && e.flush();
      });
    }
    return st;
  }
  apply() {
  }
};
wn = new WeakMap(), xn = new WeakMap(), Ue = new WeakMap(), bn = new WeakMap(), rr = new WeakMap(), kn = new WeakMap(), En = new WeakMap(), Sn = new WeakMap(), ue = new WeakSet(), /**
 * Traverse the effect tree, executing effects or stashing
 * them for later execution as appropriate
 * @param {Effect} root
 * @param {Effect[]} effects
 * @param {Effect[]} render_effects
 */
oi = function(e, n, r) {
  e.f ^= kt;
  for (var i = e.first, o = null; i !== null; ) {
    var s = i.f, a = (s & (ke | on)) !== 0, u = a && (s & kt) !== 0, f = u || (s & Yt) !== 0 || this.skipped_effects.has(i);
    if (!f && i.fn !== null) {
      a ? i.f ^= kt : o !== null && (s & (Mr | Vr | Bo)) !== 0 ? o.b.defer_effect(i) : (s & Mr) !== 0 ? n.push(i) : ar(i) && ((s & be) !== 0 && y(this, kn).add(i), Kn(i));
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
si = function(e) {
  for (var n = 0; n < e.length; n += 1)
    Ko(e[n], y(this, kn), y(this, En));
}, Zo = function() {
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
          Jo(c, a, u, f);
        if (Jt.length > 0) {
          st = o, o.apply();
          for (const c of Jt)
            bt(i = o, ue, oi).call(i, c, [], []);
          o.deactivate();
        }
        Jt = r;
      }
    }
    st = null, _t = e;
  }
  this.committed = !0, hr.delete(this);
};
let Le = Gi;
function ol() {
  ii = !0;
  var t = null;
  try {
    for (var e = 0; Jt.length > 0; ) {
      var n = Le.ensure();
      if (e++ > 1e3) {
        var r, i;
        sl();
      }
      n.process(Jt), Oe.clear();
    }
  } finally {
    ii = !1, Ii = null;
  }
}
function sl() {
  try {
    Ya();
  } catch (t) {
    zn(t, Ii);
  }
}
let Zt = null;
function Ji(t) {
  var e = t.length;
  if (e !== 0) {
    for (var n = 0; n < e; ) {
      var r = t[n++];
      if ((r.f & (ye | Yt)) === 0 && ar(r) && (Zt = /* @__PURE__ */ new Set(), Kn(r), r.deps === null && r.first === null && r.nodes === null && (r.teardown === null && r.ac === null ? ds(r) : r.fn = null), (Zt == null ? void 0 : Zt.size) > 0)) {
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
function Jo(t, e, n, r) {
  if (!n.has(t) && (n.add(t), t.reactions !== null))
    for (const i of t.reactions) {
      const o = i.f;
      (o & wt) !== 0 ? Jo(
        /** @type {Derived} */
        i,
        e,
        n,
        r
      ) : (o & (Ai | be)) !== 0 && (o & Rt) === 0 && Qo(i, e, r) && (vt(i, Rt), we(
        /** @type {Effect} */
        i
      ));
    }
}
function Qo(t, e, n) {
  const r = n.get(t);
  if (r !== void 0) return r;
  if (t.deps !== null)
    for (const i of t.deps) {
      if (e.includes(i))
        return !0;
      if ((i.f & wt) !== 0 && Qo(
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
  for (var e = Ii = t; e.parent !== null; ) {
    e = e.parent;
    var n = e.f;
    if (ii && e === et && (n & be) !== 0 && (n & Vo) === 0)
      return;
    if ((n & (on | ke)) !== 0) {
      if ((n & kt) === 0) return;
      e.f ^= kt;
    }
  }
  Jt.push(e);
}
function al(t) {
  let e = 0, n = tn(0), r;
  return () => {
    Ti() && (l(n), us(() => (e === 0 && (r = Fi(() => t(() => Un(n)))), e += 1, () => {
      Fe(() => {
        e -= 1, e === 0 && (r == null || r(), r = void 0, Un(n));
      });
    })));
  };
}
var ll = In | Fn | Si;
function ul(t, e, n) {
  new fl(t, e, n);
}
var Vt, Ei, re, Ge, ie, Xt, At, oe, me, ze, We, Te, Nn, Ke, An, Mn, pe, Yr, gt, cl, hl, ai, wr, xr, li;
class fl {
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(e, n, r) {
    Z(this, gt);
    /** @type {Boundary | null} */
    mt(this, "parent");
    mt(this, "is_pending", !1);
    /** @type {TemplateNode} */
    Z(this, Vt);
    /** @type {TemplateNode | null} */
    Z(this, Ei, null);
    /** @type {BoundaryProps} */
    Z(this, re);
    /** @type {((anchor: Node) => void)} */
    Z(this, Ge);
    /** @type {Effect} */
    Z(this, ie);
    /** @type {Effect | null} */
    Z(this, Xt, null);
    /** @type {Effect | null} */
    Z(this, At, null);
    /** @type {Effect | null} */
    Z(this, oe, null);
    /** @type {DocumentFragment | null} */
    Z(this, me, null);
    /** @type {TemplateNode | null} */
    Z(this, ze, null);
    Z(this, We, 0);
    Z(this, Te, 0);
    Z(this, Nn, !1);
    Z(this, Ke, !1);
    /** @type {Set<Effect>} */
    Z(this, An, /* @__PURE__ */ new Set());
    /** @type {Set<Effect>} */
    Z(this, Mn, /* @__PURE__ */ new Set());
    /**
     * A source containing the number of pending async deriveds/expressions.
     * Only created if `$effect.pending()` is used inside the boundary,
     * otherwise updating the source results in needless `Batch.ensure()`
     * calls followed by no-op flushes
     * @type {Source<number> | null}
     */
    Z(this, pe, null);
    Z(this, Yr, al(() => (G(this, pe, tn(y(this, We))), () => {
      G(this, pe, null);
    })));
    G(this, Vt, e), G(this, re, n), G(this, Ge, r), this.parent = /** @type {Effect} */
    et.b, this.is_pending = !!y(this, re).pending, G(this, ie, Ci(() => {
      et.b = this;
      {
        var i = bt(this, gt, ai).call(this);
        try {
          G(this, Xt, qt(() => r(i)));
        } catch (o) {
          this.error(o);
        }
        y(this, Te) > 0 ? bt(this, gt, xr).call(this) : this.is_pending = !1;
      }
      return () => {
        var o;
        (o = y(this, ze)) == null || o.remove();
      };
    }, ll));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(e) {
    Ko(e, y(this, An), y(this, Mn));
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
    bt(this, gt, li).call(this, e), G(this, We, y(this, We) + e), !(!y(this, pe) || y(this, Nn)) && (G(this, Nn, !0), Fe(() => {
      G(this, Nn, !1), y(this, pe) && Tn(y(this, pe), y(this, We));
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
    y(this, Xt) && (Ct(y(this, Xt)), G(this, Xt, null)), y(this, At) && (Ct(y(this, At)), G(this, At, null)), y(this, oe) && (Ct(y(this, oe)), G(this, oe, null));
    var i = !1, o = !1;
    const s = () => {
      if (i) {
        el();
        return;
      }
      i = !0, o && qa(), Le.ensure(), G(this, We, 0), y(this, oe) !== null && Je(y(this, oe), () => {
        G(this, oe, null);
      }), this.is_pending = this.has_pending_snippet(), G(this, Xt, bt(this, gt, wr).call(this, () => (G(this, Ke, !1), qt(() => y(this, Ge).call(this, y(this, Vt)))))), y(this, Te) > 0 ? bt(this, gt, xr).call(this) : this.is_pending = !1;
    };
    var a = K;
    try {
      zt(null), o = !0, n == null || n(e, s), o = !1;
    } catch (u) {
      zn(u, y(this, ie) && y(this, ie).parent);
    } finally {
      zt(a);
    }
    r && Fe(() => {
      G(this, oe, bt(this, gt, wr).call(this, () => {
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
          return zn(
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
Vt = new WeakMap(), Ei = new WeakMap(), re = new WeakMap(), Ge = new WeakMap(), ie = new WeakMap(), Xt = new WeakMap(), At = new WeakMap(), oe = new WeakMap(), me = new WeakMap(), ze = new WeakMap(), We = new WeakMap(), Te = new WeakMap(), Nn = new WeakMap(), Ke = new WeakMap(), An = new WeakMap(), Mn = new WeakMap(), pe = new WeakMap(), Yr = new WeakMap(), gt = new WeakSet(), cl = function() {
  try {
    G(this, Xt, qt(() => y(this, Ge).call(this, y(this, Vt))));
  } catch (e) {
    this.error(e);
  }
}, hl = function() {
  const e = y(this, re).pending;
  e && (G(this, At, qt(() => e(y(this, Vt)))), Fe(() => {
    var n = bt(this, gt, ai).call(this);
    G(this, Xt, bt(this, gt, wr).call(this, () => (Le.ensure(), qt(() => y(this, Ge).call(this, n))))), y(this, Te) > 0 ? bt(this, gt, xr).call(this) : (Je(
      /** @type {Effect} */
      y(this, At),
      () => {
        G(this, At, null);
      }
    ), this.is_pending = !1);
  }));
}, ai = function() {
  var e = y(this, Vt);
  return this.is_pending && (G(this, ze, en()), y(this, Vt).before(y(this, ze)), e = y(this, ze)), e;
}, /**
 * @param {() => Effect | null} fn
 */
wr = function(e) {
  var n = et, r = K, i = Wt;
  le(y(this, ie)), zt(y(this, ie)), Pn(y(this, ie).ctx);
  try {
    return e();
  } catch (o) {
    return Go(o), null;
  } finally {
    le(n), zt(r), Pn(i);
  }
}, xr = function() {
  const e = (
    /** @type {(anchor: Node) => void} */
    y(this, re).pending
  );
  y(this, Xt) !== null && (G(this, me, document.createDocumentFragment()), y(this, me).append(
    /** @type {TemplateNode} */
    y(this, ze)
  ), ms(y(this, Xt), y(this, me))), y(this, At) === null && G(this, At, qt(() => e(y(this, Vt))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
li = function(e) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && bt(n = this.parent, gt, li).call(n, e);
    return;
  }
  if (G(this, Te, y(this, Te) + e), y(this, Te) === 0) {
    this.is_pending = !1;
    for (const r of y(this, An))
      vt(r, Rt), we(r);
    for (const r of y(this, Mn))
      vt(r, Ee), we(r);
    y(this, An).clear(), y(this, Mn).clear(), y(this, At) && Je(y(this, At), () => {
      G(this, At, null);
    }), y(this, me) && (y(this, Vt).before(y(this, me)), G(this, me, null));
  }
};
function dl(t, e, n, r) {
  const i = Xr;
  var o = t.filter((h) => !h.settled);
  if (n.length === 0 && o.length === 0) {
    r(e.map(i));
    return;
  }
  var s = st, a = (
    /** @type {Effect} */
    et
  ), u = gl(), f = o.length === 1 ? o[0].promise : o.length > 1 ? Promise.all(o.map((h) => h.promise)) : null;
  function c(h) {
    u();
    try {
      r(h);
    } catch (g) {
      (a.f & ye) === 0 && zn(g, a);
    }
    s == null || s.deactivate(), ui();
  }
  if (n.length === 0) {
    f.then(() => c(e.map(i)));
    return;
  }
  function d() {
    u(), Promise.all(n.map((h) => /* @__PURE__ */ vl(h))).then((h) => c([...e.map(i), ...h])).catch((h) => zn(h, a));
  }
  f ? f.then(d) : d();
}
function gl() {
  var t = et, e = K, n = Wt, r = st;
  return function(o = !0) {
    le(t), zt(e), Pn(n), o && (r == null || r.activate());
  };
}
function ui() {
  le(null), zt(null), Pn(null);
}
// @__NO_SIDE_EFFECTS__
function Xr(t) {
  var e = wt | Rt, n = K !== null && (K.f & wt) !== 0 ? (
    /** @type {Derived} */
    K
  ) : null;
  return et !== null && (et.f |= Fn), {
    ctx: Wt,
    deps: null,
    effects: null,
    equals: Xo,
    f: e,
    fn: t,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      pt
    ),
    wv: 0,
    parent: n ?? et,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function vl(t, e, n) {
  let r = (
    /** @type {Effect | null} */
    et
  );
  r === null && Fa();
  var i = (
    /** @type {Boundary} */
    r.b
  ), o = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  ), s = tn(
    /** @type {V} */
    pt
  ), a = !K, u = /* @__PURE__ */ new Map();
  return Sl(() => {
    var g;
    var f = Ho();
    o = f.promise;
    try {
      Promise.resolve(t()).then(f.resolve, f.reject).then(() => {
        c === st && c.committed && c.deactivate(), ui();
      });
    } catch (_) {
      f.reject(_), ui();
    }
    var c = (
      /** @type {Batch} */
      st
    );
    if (a) {
      var d = i.is_rendered();
      i.update_pending_count(1), c.increment(d), (g = u.get(c)) == null || g.reject(vn), u.delete(c), u.set(c, f);
    }
    const h = (_, k = void 0) => {
      if (c.activate(), k)
        k !== vn && (s.f |= Re, Tn(s, k));
      else {
        (s.f & Re) !== 0 && (s.f ^= Re), Tn(s, _);
        for (const [M, S] of u) {
          if (u.delete(M), M === c) break;
          S.reject(vn);
        }
      }
      a && (i.update_pending_count(-1), c.decrement(d));
    };
    f.promise.then(h, (_) => h(null, _ || "unknown"));
  }), as(() => {
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
function O(t) {
  const e = /* @__PURE__ */ Xr(t);
  return ps(e), e;
}
// @__NO_SIDE_EFFECTS__
function jo(t) {
  const e = /* @__PURE__ */ Xr(t);
  return e.equals = qo, e;
}
function $o(t) {
  var e = t.effects;
  if (e !== null) {
    t.effects = null;
    for (var n = 0; n < e.length; n += 1)
      Ct(
        /** @type {Effect} */
        e[n]
      );
  }
}
function ml(t) {
  for (var e = t.parent; e !== null; ) {
    if ((e.f & wt) === 0)
      return (e.f & ye) === 0 ? (
        /** @type {Effect} */
        e
      ) : null;
    e = e.parent;
  }
  return null;
}
function Pi(t) {
  var e, n = et;
  le(ml(t));
  try {
    t.f &= ~$e, $o(t), e = xs(t);
  } finally {
    le(n);
  }
  return e;
}
function ts(t) {
  var e = Pi(t);
  if (!t.equals(e) && (t.wv = ys(), (!(st != null && st.is_fork) || t.deps === null) && (t.v = e, t.deps === null))) {
    vt(t, kt);
    return;
  }
  De || (_t !== null ? (Ti() || st != null && st.is_fork) && _t.set(t, e) : Mi(t));
}
let fi = /* @__PURE__ */ new Set();
const Oe = /* @__PURE__ */ new Map();
let es = !1;
function tn(t, e) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: t,
    reactions: null,
    equals: Xo,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function ft(t, e) {
  const n = tn(t);
  return ps(n), n;
}
// @__NO_SIDE_EFFECTS__
function pl(t, e = !1, n = !0) {
  const r = tn(t);
  return e || (r.equals = qo), r;
}
function V(t, e, n = !1) {
  K !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!$t || (K.f & Zi) !== 0) && Uo() && (K.f & (wt | be | Ai | Zi)) !== 0 && !(St != null && St.includes(t)) && Xa();
  let r = n ? Dt(e) : e;
  return Tn(t, r);
}
function Tn(t, e) {
  if (!t.equals(e)) {
    var n = t.v;
    De ? Oe.set(t, e) : Oe.set(t, n), t.v = e;
    var r = Le.ensure();
    if (r.capture(t, n), (t.f & wt) !== 0) {
      const i = (
        /** @type {Derived} */
        t
      );
      (t.f & Rt) !== 0 && Pi(i), Mi(i);
    }
    t.wv = ys(), ns(t, Rt), et !== null && (et.f & kt) !== 0 && (et.f & (ke | on)) === 0 && (Bt === null ? Al([t]) : Bt.push(t)), !r.is_fork && fi.size > 0 && !es && _l();
  }
  return e;
}
function _l() {
  es = !1;
  for (const t of fi)
    (t.f & kt) !== 0 && vt(t, Ee), ar(t) && Kn(t);
  fi.clear();
}
function Un(t) {
  V(t, t.v + 1);
}
function ns(t, e) {
  var n = t.reactions;
  if (n !== null)
    for (var r = n.length, i = 0; i < r; i++) {
      var o = n[i], s = o.f, a = (s & Rt) === 0;
      if (a && vt(o, e), (s & wt) !== 0) {
        var u = (
          /** @type {Derived} */
          o
        );
        _t == null || _t.delete(u), (s & $e) === 0 && (s & Gt && (o.f |= $e), ns(u, Ee));
      } else a && ((s & be) !== 0 && Zt !== null && Zt.add(
        /** @type {Effect} */
        o
      ), we(
        /** @type {Effect} */
        o
      ));
    }
}
function Dt(t) {
  if (typeof t != "object" || t === null || qn in t)
    return t;
  const e = Yo(t);
  if (e !== Ia && e !== Pa)
    return t;
  var n = /* @__PURE__ */ new Map(), r = Do(t), i = /* @__PURE__ */ ft(0), o = Qe, s = (a) => {
    if (Qe === o)
      return a();
    var u = K, f = Qe;
    zt(null), $i(o);
    var c = a();
    return zt(u), $i(f), c;
  };
  return r && n.set("length", /* @__PURE__ */ ft(
    /** @type {any[]} */
    t.length
  )), new Proxy(
    /** @type {any} */
    t,
    {
      defineProperty(a, u, f) {
        (!("value" in f) || f.configurable === !1 || f.enumerable === !1 || f.writable === !1) && Ba();
        var c = n.get(u);
        return c === void 0 ? c = s(() => {
          var d = /* @__PURE__ */ ft(f.value);
          return n.set(u, d), d;
        }) : V(c, f.value, !0), !0;
      },
      deleteProperty(a, u) {
        var f = n.get(u);
        if (f === void 0) {
          if (u in a) {
            const c = s(() => /* @__PURE__ */ ft(pt));
            n.set(u, c), Un(i);
          }
        } else
          V(f, pt), Un(i);
        return !0;
      },
      get(a, u, f) {
        var g;
        if (u === qn)
          return t;
        var c = n.get(u), d = u in a;
        if (c === void 0 && (!d || (g = pn(a, u)) != null && g.writable) && (c = s(() => {
          var _ = Dt(d ? a[u] : pt), k = /* @__PURE__ */ ft(_);
          return k;
        }), n.set(u, c)), c !== void 0) {
          var h = l(c);
          return h === pt ? void 0 : h;
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
          if (d !== void 0 && h !== pt)
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
        var f = n.get(u), c = f !== void 0 && f.v !== pt || Reflect.has(a, u);
        if (f !== void 0 || et !== null && (!c || (h = pn(a, u)) != null && h.writable)) {
          f === void 0 && (f = s(() => {
            var g = c ? Dt(a[u]) : pt, _ = /* @__PURE__ */ ft(g);
            return _;
          }), n.set(u, f));
          var d = l(f);
          if (d === pt)
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
            var _ = n.get(g + "");
            _ !== void 0 ? V(_, pt) : g in a && (_ = s(() => /* @__PURE__ */ ft(pt)), n.set(g + "", _));
          }
        if (d === void 0)
          (!h || (P = pn(a, u)) != null && P.writable) && (d = s(() => /* @__PURE__ */ ft(void 0)), V(d, Dt(f)), n.set(u, d));
        else {
          h = d.v !== pt;
          var k = s(() => Dt(f));
          V(d, k);
        }
        var M = Reflect.getOwnPropertyDescriptor(a, u);
        if (M != null && M.set && M.set.call(c, f), !h) {
          if (r && typeof u == "string") {
            var S = (
              /** @type {Source<number>} */
              n.get("length")
            ), Y = Number(u);
            Number.isInteger(Y) && Y >= S.v && V(S, Y + 1);
          }
          Un(i);
        }
        return !0;
      },
      ownKeys(a) {
        l(i);
        var u = Reflect.ownKeys(a).filter((d) => {
          var h = n.get(d);
          return h === void 0 || h.v !== pt;
        });
        for (var [f, c] of n)
          c.v !== pt && !(f in a) && u.push(f);
        return u;
      },
      setPrototypeOf() {
        Va();
      }
    }
  );
}
var Qi, rs, is, os;
function yl() {
  if (Qi === void 0) {
    Qi = window, rs = /Firefox/.test(navigator.userAgent);
    var t = Element.prototype, e = Node.prototype, n = Text.prototype;
    is = pn(e, "firstChild").get, os = pn(e, "nextSibling").get, Ki(t) && (t.__click = void 0, t.__className = void 0, t.__attributes = null, t.__style = void 0, t.__e = void 0), Ki(n) && (n.__t = void 0);
  }
}
function en(t = "") {
  return document.createTextNode(t);
}
// @__NO_SIDE_EFFECTS__
function Ut(t) {
  return (
    /** @type {TemplateNode | null} */
    is.call(t)
  );
}
// @__NO_SIDE_EFFECTS__
function sr(t) {
  return (
    /** @type {TemplateNode | null} */
    os.call(t)
  );
}
function dt(t, e) {
  return /* @__PURE__ */ Ut(t);
}
function Mt(t, e = !1) {
  {
    var n = /* @__PURE__ */ Ut(t);
    return n instanceof Comment && n.data === "" ? /* @__PURE__ */ sr(n) : n;
  }
}
function tt(t, e = 1, n = !1) {
  let r = t;
  for (; e--; )
    r = /** @type {TemplateNode} */
    /* @__PURE__ */ sr(r);
  return r;
}
function wl(t) {
  t.textContent = "";
}
function ss() {
  return !1;
}
function zi(t) {
  var e = K, n = et;
  zt(null), le(null);
  try {
    return t();
  } finally {
    zt(e), le(n);
  }
}
function xl(t) {
  et === null && (K === null && Da(), Oa()), De && La();
}
function bl(t, e) {
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
    f: t | Rt | Gt,
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
      Kn(i), i.f |= Ni;
    } catch (a) {
      throw Ct(i), a;
    }
  else e !== null && we(i);
  var o = i;
  if (n && o.deps === null && o.teardown === null && o.nodes === null && o.first === o.last && // either `null`, or a singular child
  (o.f & Fn) === 0 && (o = o.first, (t & be) !== 0 && (t & In) !== 0 && o !== null && (o.f |= In)), o !== null && (o.parent = r, r !== null && bl(o, r), K !== null && (K.f & wt) !== 0 && (t & on) === 0)) {
    var s = (
      /** @type {Derived} */
      K
    );
    (s.effects ?? (s.effects = [])).push(o);
  }
  return i;
}
function Ti() {
  return K !== null && !$t;
}
function as(t) {
  const e = Se(Vr, null, !1);
  return vt(e, kt), e.teardown = t, e;
}
function Gn(t) {
  xl();
  var e = (
    /** @type {Effect} */
    et.f
  ), n = !K && (e & ke) !== 0 && (e & Ni) === 0;
  if (n) {
    var r = (
      /** @type {ComponentContext} */
      Wt
    );
    (r.e ?? (r.e = [])).push(t);
  } else
    return ls(t);
}
function ls(t) {
  return Se(Mr | Ta, t, !1);
}
function kl(t) {
  Le.ensure();
  const e = Se(on | Fn, t, !0);
  return (n = {}) => new Promise((r) => {
    n.outro ? Je(e, () => {
      Ct(e), r(void 0);
    }) : (Ct(e), r(void 0));
  });
}
function El(t) {
  return Se(Mr, t, !1);
}
function Sl(t) {
  return Se(Ai | Fn, t, !0);
}
function us(t, e = 0) {
  return Se(Vr | e, t, !0);
}
function ot(t, e = [], n = [], r = []) {
  dl(r, e, n, (i) => {
    Se(Vr, () => t(...i.map(l)), !0);
  });
}
function Ci(t, e = 0) {
  var n = Se(be | e, t, !0);
  return n;
}
function qt(t) {
  return Se(ke | Fn, t, !0);
}
function fs(t) {
  var e = t.teardown;
  if (e !== null) {
    const n = De, r = K;
    ji(!0), zt(null);
    try {
      e.call(null);
    } finally {
      ji(n), zt(r);
    }
  }
}
function cs(t, e = !1) {
  var n = t.first;
  for (t.first = t.last = null; n !== null; ) {
    const i = n.ac;
    i !== null && zi(() => {
      i.abort(vn);
    });
    var r = n.next;
    (n.f & on) !== 0 ? n.parent = null : Ct(n, e), n = r;
  }
}
function Nl(t) {
  for (var e = t.first; e !== null; ) {
    var n = e.next;
    (e.f & ke) === 0 && Ct(e), e = n;
  }
}
function Ct(t, e = !0) {
  var n = !1;
  (e || (t.f & Vo) !== 0) && t.nodes !== null && t.nodes.end !== null && (hs(
    t.nodes.start,
    /** @type {TemplateNode} */
    t.nodes.end
  ), n = !0), cs(t, e && !n), Ir(t, 0), vt(t, ye);
  var r = t.nodes && t.nodes.t;
  if (r !== null)
    for (const o of r)
      o.stop();
  fs(t);
  var i = t.parent;
  i !== null && i.first !== null && ds(t), t.next = t.prev = t.teardown = t.ctx = t.deps = t.fn = t.nodes = t.ac = null;
}
function hs(t, e) {
  for (; t !== null; ) {
    var n = t === e ? null : /* @__PURE__ */ sr(t);
    t.remove(), t = n;
  }
}
function ds(t) {
  var e = t.parent, n = t.prev, r = t.next;
  n !== null && (n.next = r), r !== null && (r.prev = n), e !== null && (e.first === t && (e.first = r), e.last === t && (e.last = n));
}
function Je(t, e, n = !0) {
  var r = [];
  gs(t, r, !0);
  var i = () => {
    n && Ct(t), e && e();
  }, o = r.length;
  if (o > 0) {
    var s = () => --o || i();
    for (var a of r)
      a.out(s);
  } else
    i();
}
function gs(t, e, n) {
  if ((t.f & Yt) === 0) {
    t.f ^= Yt;
    var r = t.nodes && t.nodes.t;
    if (r !== null)
      for (const a of r)
        (a.is_global || n) && e.push(a);
    for (var i = t.first; i !== null; ) {
      var o = i.next, s = (i.f & In) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (i.f & ke) !== 0 && (t.f & be) !== 0;
      gs(i, e, s ? n : !1), i = o;
    }
  }
}
function Ri(t) {
  vs(t, !0);
}
function vs(t, e) {
  if ((t.f & Yt) !== 0) {
    t.f ^= Yt, (t.f & kt) === 0 && (vt(t, Rt), we(t));
    for (var n = t.first; n !== null; ) {
      var r = n.next, i = (n.f & In) !== 0 || (n.f & ke) !== 0;
      vs(n, i ? e : !1), n = r;
    }
    var o = t.nodes && t.nodes.t;
    if (o !== null)
      for (const s of o)
        (s.is_global || e) && s.in();
  }
}
function ms(t, e) {
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
function zt(t) {
  K = t;
}
let et = null;
function le(t) {
  et = t;
}
let St = null;
function ps(t) {
  K !== null && (St === null ? St = [t] : St.push(t));
}
let It = null, Lt = 0, Bt = null;
function Al(t) {
  Bt = t;
}
let _s = 1, Xe = 0, Qe = Xe;
function $i(t) {
  Qe = t;
}
function ys() {
  return ++_s;
}
function ar(t) {
  var e = t.f;
  if ((e & Rt) !== 0)
    return !0;
  if (e & wt && (t.f &= ~$e), (e & Ee) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      t.deps
    ), r = n.length, i = 0; i < r; i++) {
      var o = n[i];
      if (ar(
        /** @type {Derived} */
        o
      ) && ts(
        /** @type {Derived} */
        o
      ), o.wv > t.wv)
        return !0;
    }
    (e & Gt) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    _t === null && vt(t, kt);
  }
  return !1;
}
function ws(t, e, n = !0) {
  var r = t.reactions;
  if (r !== null && !(St != null && St.includes(t)))
    for (var i = 0; i < r.length; i++) {
      var o = r[i];
      (o.f & wt) !== 0 ? ws(
        /** @type {Derived} */
        o,
        e,
        !1
      ) : e === o && (n ? vt(o, Rt) : (o.f & kt) !== 0 && vt(o, Ee), we(
        /** @type {Effect} */
        o
      ));
    }
}
function xs(t) {
  var _;
  var e = It, n = Lt, r = Bt, i = K, o = St, s = Wt, a = $t, u = Qe, f = t.f;
  It = /** @type {null | Value[]} */
  null, Lt = 0, Bt = null, K = (f & (ke | on)) === 0 ? t : null, St = null, Pn(t.ctx), $t = !1, Qe = ++Xe, t.ac !== null && (zi(() => {
    t.ac.abort(vn);
  }), t.ac = null);
  try {
    t.f |= ri;
    var c = (
      /** @type {Function} */
      t.fn
    ), d = c(), h = t.deps;
    if (It !== null) {
      var g;
      if (Ir(t, Lt), h !== null && Lt > 0)
        for (h.length = Lt + It.length, g = 0; g < It.length; g++)
          h[Lt + g] = It[g];
      else
        t.deps = h = It;
      if (Ti() && (t.f & Gt) !== 0)
        for (g = Lt; g < h.length; g++)
          ((_ = h[g]).reactions ?? (_.reactions = [])).push(t);
    } else h !== null && Lt < h.length && (Ir(t, Lt), h.length = Lt);
    if (Uo() && Bt !== null && !$t && h !== null && (t.f & (wt | Ee | Rt)) === 0)
      for (g = 0; g < /** @type {Source[]} */
      Bt.length; g++)
        ws(
          Bt[g],
          /** @type {Effect} */
          t
        );
    if (i !== null && i !== t) {
      if (Xe++, i.deps !== null)
        for (let k = 0; k < n; k += 1)
          i.deps[k].rv = Xe;
      if (e !== null)
        for (const k of e)
          k.rv = Xe;
      Bt !== null && (r === null ? r = Bt : r.push(.../** @type {Source[]} */
      Bt));
    }
    return (t.f & Re) !== 0 && (t.f ^= Re), d;
  } catch (k) {
    return Go(k);
  } finally {
    t.f ^= ri, It = e, Lt = n, Bt = r, K = i, St = o, Pn(s), $t = a, Qe = u;
  }
}
function Ml(t, e) {
  let n = e.reactions;
  if (n !== null) {
    var r = Na.call(n, t);
    if (r !== -1) {
      var i = n.length - 1;
      i === 0 ? n = e.reactions = null : (n[r] = n[i], n.pop());
    }
  }
  if (n === null && (e.f & wt) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (It === null || !It.includes(e))) {
    var o = (
      /** @type {Derived} */
      e
    );
    (o.f & Gt) !== 0 && (o.f ^= Gt, o.f &= ~$e), Mi(o), $o(o), Ir(o, 0);
  }
}
function Ir(t, e) {
  var n = t.deps;
  if (n !== null)
    for (var r = e; r < n.length; r++)
      Ml(t, n[r]);
}
function Kn(t) {
  var e = t.f;
  if ((e & ye) === 0) {
    vt(t, kt);
    var n = et, r = br;
    et = t, br = !0;
    try {
      (e & (be | Bo)) !== 0 ? Nl(t) : cs(t), fs(t);
      var i = xs(t);
      t.teardown = typeof i == "function" ? i : null, t.wv = _s;
      var o;
    } finally {
      br = r, et = n;
    }
  }
}
function l(t) {
  var e = t.f, n = (e & wt) !== 0;
  if (K !== null && !$t) {
    var r = et !== null && (et.f & ye) !== 0;
    if (!r && !(St != null && St.includes(t))) {
      var i = K.deps;
      if ((K.f & ri) !== 0)
        t.rv < Xe && (t.rv = Xe, It === null && i !== null && i[Lt] === t ? Lt++ : It === null ? It = [t] : It.push(t));
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
      return ((s.f & kt) === 0 && s.reactions !== null || ks(s)) && (a = Pi(s)), Oe.set(s, a), a;
    }
    var u = (s.f & Gt) === 0 && !$t && K !== null && (br || (K.f & Gt) !== 0), f = s.deps === null;
    ar(s) && (u && (s.f |= Gt), ts(s)), u && !f && bs(s);
  }
  if (_t != null && _t.has(t))
    return _t.get(t);
  if ((t.f & Re) !== 0)
    throw t.v;
  return t.v;
}
function bs(t) {
  if (t.deps !== null) {
    t.f |= Gt;
    for (const e of t.deps)
      (e.reactions ?? (e.reactions = [])).push(t), (e.f & wt) !== 0 && (e.f & Gt) === 0 && bs(
        /** @type {Derived} */
        e
      );
  }
}
function ks(t) {
  if (t.v === pt) return !0;
  if (t.deps === null) return !1;
  for (const e of t.deps)
    if (Oe.has(e) || (e.f & wt) !== 0 && ks(
      /** @type {Derived} */
      e
    ))
      return !0;
  return !1;
}
function Fi(t) {
  var e = $t;
  try {
    return $t = !0, t();
  } finally {
    $t = e;
  }
}
const Il = ["touchstart", "touchmove"];
function Pl(t) {
  return Il.includes(t);
}
const Es = /* @__PURE__ */ new Set(), ci = /* @__PURE__ */ new Set();
function zl(t, e, n, r = {}) {
  function i(o) {
    if (r.capture || Hn.call(e, o), !o.cancelBubble)
      return zi(() => n == null ? void 0 : n.call(this, o));
  }
  return t.startsWith("pointer") || t.startsWith("touch") || t === "wheel" ? Fe(() => {
    e.addEventListener(t, i, r);
  }) : e.addEventListener(t, i, r), i;
}
function Ie(t, e, n, r, i) {
  var o = { capture: r, passive: i }, s = zl(t, e, n, o);
  (e === document.body || // @ts-ignore
  e === window || // @ts-ignore
  e === document || // Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
  e instanceof HTMLMediaElement) && as(() => {
    e.removeEventListener(t, s, o);
  });
}
function lr(t) {
  for (var e = 0; e < t.length; e++)
    Es.add(t[e]);
  for (var n of ci)
    n(t);
}
let to = null;
function Hn(t) {
  var M;
  var e = this, n = (
    /** @type {Node} */
    e.ownerDocument
  ), r = t.type, i = ((M = t.composedPath) == null ? void 0 : M.call(t)) || [], o = (
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
    zt(null), le(null);
    try {
      for (var h, g = []; o !== null; ) {
        var _ = o.assignedSlot || o.parentNode || /** @type {any} */
        o.host || null;
        try {
          var k = o["__" + r];
          k != null && (!/** @type {any} */
          o.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
          // -> the target could not have been disabled because it emits the event in the first place
          t.target === o) && k.call(o, t);
        } catch (S) {
          h ? g.push(S) : h = S;
        }
        if (t.cancelBubble || _ === e || _ === null)
          break;
        o = _;
      }
      if (h) {
        for (let S of g)
          queueMicrotask(() => {
            throw S;
          });
        throw h;
      }
    } finally {
      t.__root = e, delete t.currentTarget, zt(c), le(d);
    }
  }
}
function Li(t) {
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
function Tl(t, e) {
  var n = (e & $a) !== 0, r, i = !t.startsWith("<!>");
  return () => {
    r === void 0 && (r = Li(i ? t : "<!>" + t), r = /** @type {TemplateNode} */
    /* @__PURE__ */ Ut(r));
    var o = (
      /** @type {TemplateNode} */
      n || rs ? document.importNode(r, !0) : r.cloneNode(!0)
    );
    return Zn(o, o), o;
  };
}
// @__NO_SIDE_EFFECTS__
function Cl(t, e, n = "svg") {
  var r = !t.startsWith("<!>"), i = (e & ja) !== 0, o = `<${n}>${r ? t : "<!>" + t}</${n}>`, s;
  return () => {
    if (!s) {
      var a = (
        /** @type {DocumentFragment} */
        Li(o)
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
function rt(t, e) {
  return /* @__PURE__ */ Cl(t, e, "svg");
}
function ge() {
  var t = document.createDocumentFragment(), e = document.createComment(""), n = en();
  return t.append(e, n), Zn(e, n), t;
}
function W(t, e) {
  t !== null && t.before(
    /** @type {Node} */
    e
  );
}
function Jn(t, e) {
  var n = e == null ? "" : typeof e == "object" ? e + "" : e;
  n !== (t.__t ?? (t.__t = t.nodeValue)) && (t.__t = n, t.nodeValue = n + "");
}
function Rl(t, e) {
  return Fl(t, e);
}
const dn = /* @__PURE__ */ new Map();
function Fl(t, { target: e, anchor: n, props: r = {}, events: i, context: o, intro: s = !0 }) {
  yl();
  var a = /* @__PURE__ */ new Set(), u = (d) => {
    for (var h = 0; h < d.length; h++) {
      var g = d[h];
      if (!a.has(g)) {
        a.add(g);
        var _ = Pl(g);
        e.addEventListener(g, Hn, { passive: _ });
        var k = dn.get(g);
        k === void 0 ? (document.addEventListener(g, Hn, { passive: _ }), dn.set(g, 1)) : dn.set(g, k + 1);
      }
    }
  };
  u(Br(Es)), ci.add(u);
  var f = void 0, c = kl(() => {
    var d = n ?? e.appendChild(en());
    return ul(
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
      var _;
      for (var h of a) {
        e.removeEventListener(h, Hn);
        var g = (
          /** @type {number} */
          dn.get(h)
        );
        --g === 0 ? (document.removeEventListener(h, Hn), dn.delete(h)) : dn.set(h, g);
      }
      ci.delete(u), d !== n && ((_ = d.parentNode) == null || _.removeChild(d));
    };
  });
  return hi.set(f, c), f;
}
let hi = /* @__PURE__ */ new WeakMap();
function eo(t, e) {
  const n = hi.get(t);
  return n ? (hi.delete(t), n(e)) : Promise.resolve();
}
var Qt, se, Ot, Ze, ir, or, Hr;
class Ll {
  /**
   * @param {TemplateNode} anchor
   * @param {boolean} transition
   */
  constructor(e, n = !0) {
    /** @type {TemplateNode} */
    mt(this, "anchor");
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
    Z(this, Ot, /* @__PURE__ */ new Map());
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
        st
      );
      if (y(this, Qt).has(e)) {
        var n = (
          /** @type {Key} */
          y(this, Qt).get(e)
        ), r = y(this, se).get(n);
        if (r)
          Ri(r), y(this, Ze).delete(n);
        else {
          var i = y(this, Ot).get(n);
          i && (y(this, se).set(n, i.effect), y(this, Ot).delete(n), i.fragment.lastChild.remove(), this.anchor.before(i.fragment), r = i.effect);
        }
        for (const [o, s] of y(this, Qt)) {
          if (y(this, Qt).delete(o), o === e)
            break;
          const a = y(this, Ot).get(s);
          a && (Ct(a.effect), y(this, Ot).delete(s));
        }
        for (const [o, s] of y(this, se)) {
          if (o === n || y(this, Ze).has(o)) continue;
          const a = () => {
            if (Array.from(y(this, Qt).values()).includes(o)) {
              var f = document.createDocumentFragment();
              ms(s, f), f.append(en()), y(this, Ot).set(o, { effect: s, fragment: f });
            } else
              Ct(s);
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
      for (const [r, i] of y(this, Ot))
        n.includes(r) || (Ct(i.effect), y(this, Ot).delete(r));
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
      st
    ), i = ss();
    if (n && !y(this, se).has(e) && !y(this, Ot).has(e))
      if (i) {
        var o = document.createDocumentFragment(), s = en();
        o.append(s), y(this, Ot).set(e, {
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
      for (const [a, u] of y(this, Ot))
        a === e ? r.skipped_effects.delete(u.effect) : r.skipped_effects.add(u.effect);
      r.oncommit(y(this, or)), r.ondiscard(y(this, Hr));
    } else
      y(this, or).call(this);
  }
}
Qt = new WeakMap(), se = new WeakMap(), Ot = new WeakMap(), Ze = new WeakMap(), ir = new WeakMap(), or = new WeakMap(), Hr = new WeakMap();
function ht(t, e, n = !1) {
  var r = new Ll(t), i = n ? In : 0;
  function o(s, a) {
    r.ensure(s, a);
  }
  Ci(() => {
    var s = !1;
    e((a, u = !0) => {
      s = !0, o(u, a);
    }), s || o(!1, null);
  }, i);
}
function Ss(t, e) {
  return e;
}
function Ol(t, e, n) {
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
            di(Br(o.done)), h.delete(o), h.size === 0 && (t.outrogroups = null);
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
      wl(c), c.append(f), t.items.clear();
    }
    di(e, !u);
  } else
    o = {
      pending: new Set(e),
      done: /* @__PURE__ */ new Set()
    }, (t.outrogroups ?? (t.outrogroups = /* @__PURE__ */ new Set())).add(o);
}
function di(t, e = !0) {
  for (var n = 0; n < t.length; n++)
    Ct(t[n], e);
}
var no;
function Be(t, e, n, r, i, o = null) {
  var s = t, a = /* @__PURE__ */ new Map(), u = null, f = /* @__PURE__ */ jo(() => {
    var k = n();
    return Do(k) ? k : k == null ? [] : Br(k);
  }), c, d = !0;
  function h() {
    _.fallback = u, Dl(_, c, s, e, r), u !== null && (c.length === 0 ? (u.f & Ce) === 0 ? Ri(u) : (u.f ^= Ce, Bn(u, null, s)) : Je(u, () => {
      u = null;
    }));
  }
  var g = Ci(() => {
    c = /** @type {V[]} */
    l(f);
    for (var k = c.length, M = /* @__PURE__ */ new Set(), S = (
      /** @type {Batch} */
      st
    ), Y = ss(), P = 0; P < k; P += 1) {
      var b = c[P], T = r(b, P), E = d ? null : a.get(T);
      E ? (E.v && Tn(E.v, b), E.i && Tn(E.i, P), Y && S.skipped_effects.delete(E.e)) : (E = Yl(
        a,
        d ? s : no ?? (no = en()),
        b,
        T,
        P,
        i,
        e,
        n
      ), d || (E.e.f |= Ce), a.set(T, E)), M.add(T);
    }
    if (k === 0 && o && !u && (d ? u = qt(() => o(s)) : (u = qt(() => o(no ?? (no = en()))), u.f |= Ce)), !d)
      if (Y) {
        for (const [A, H] of a)
          M.has(A) || S.skipped_effects.add(H.e);
        S.oncommit(h), S.ondiscard(() => {
        });
      } else
        h();
    l(f);
  }), _ = { effect: g, items: a, outrogroups: null, fallback: u };
  d = !1;
}
function Dl(t, e, n, r, i) {
  var H;
  var o = e.length, s = t.items, a = t.effect.first, u, f = null, c = [], d = [], h, g, _, k;
  for (k = 0; k < o; k += 1) {
    if (h = e[k], g = i(h, k), _ = /** @type {EachItem} */
    s.get(g).e, t.outrogroups !== null)
      for (const R of t.outrogroups)
        R.pending.delete(_), R.done.delete(_);
    if ((_.f & Ce) !== 0)
      if (_.f ^= Ce, _ === a)
        Bn(_, null, n);
      else {
        var M = f ? f.next : a;
        _ === t.effect.last && (t.effect.last = _.prev), _.prev && (_.prev.next = _.next), _.next && (_.next.prev = _.prev), Me(t, f, _), Me(t, _, M), Bn(_, M, n), f = _, c = [], d = [], a = f.next;
        continue;
      }
    if ((_.f & Yt) !== 0 && Ri(_), _ !== a) {
      if (u !== void 0 && u.has(_)) {
        if (c.length < d.length) {
          var S = d[0], Y;
          f = S.prev;
          var P = c[0], b = c[c.length - 1];
          for (Y = 0; Y < c.length; Y += 1)
            Bn(c[Y], S, n);
          for (Y = 0; Y < d.length; Y += 1)
            u.delete(d[Y]);
          Me(t, P.prev, b.next), Me(t, f, P), Me(t, b, S), a = S, f = b, k -= 1, c = [], d = [];
        } else
          u.delete(_), Bn(_, a, n), Me(t, _.prev, _.next), Me(t, _, f === null ? t.effect.first : f.next), Me(t, f, _), f = _;
        continue;
      }
      for (c = [], d = []; a !== null && a !== _; )
        (u ?? (u = /* @__PURE__ */ new Set())).add(a), d.push(a), a = a.next;
      if (a === null)
        continue;
    }
    (_.f & Ce) === 0 && c.push(_), f = _, a = _.next;
  }
  if (t.outrogroups !== null) {
    for (const R of t.outrogroups)
      R.pending.size === 0 && (di(Br(R.done)), (H = t.outrogroups) == null || H.delete(R));
    t.outrogroups.size === 0 && (t.outrogroups = null);
  }
  if (a !== null || u !== void 0) {
    var T = [];
    if (u !== void 0)
      for (_ of u)
        (_.f & Yt) === 0 && T.push(_);
    for (; a !== null; )
      (a.f & Yt) === 0 && a !== t.fallback && T.push(a), a = a.next;
    var E = T.length;
    if (E > 0) {
      var A = null;
      Ol(t, T, A);
    }
  }
}
function Yl(t, e, n, r, i, o, s, a) {
  var u = (s & Ua) !== 0 ? (s & Wa) === 0 ? /* @__PURE__ */ pl(n, !1, !1) : tn(n) : null, f = (s & Ga) !== 0 ? tn(i) : null;
  return {
    v: u,
    i: f,
    e: qt(() => (o(e, u ?? n, f ?? i, a), () => {
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
        /* @__PURE__ */ sr(r)
      );
      if (o.before(r), r === i)
        return;
      r = s;
    }
}
function Me(t, e, n) {
  e === null ? t.effect.first = n : e.next = n, n === null ? t.effect.last = e : n.prev = e;
}
function Ns(t, e, n = !1, r = !1, i = !1) {
  var o = t, s = "";
  ot(() => {
    var a = (
      /** @type {Effect} */
      et
    );
    if (s !== (s = e() ?? "") && (a.nodes !== null && (hs(
      a.nodes.start,
      /** @type {TemplateNode} */
      a.nodes.end
    ), a.nodes = null), s !== "")) {
      var u = s + "";
      n ? u = `<svg>${u}</svg>` : r && (u = `<math>${u}</math>`);
      var f = Li(u);
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
function Hl() {
  for (var t, e, n = 0, r = "", i = arguments.length; n < i; n++) (t = arguments[n]) && (e = As(t)) && (r && (r += " "), r += e);
  return r;
}
function Bl(t) {
  return typeof t == "object" ? Hl(t) : t ?? "";
}
function Vl(t, e, n) {
  var r = t == null ? "" : "" + t;
  return r === "" ? null : r;
}
function Xl(t, e) {
  return t == null ? null : String(t);
}
function ql(t, e, n, r, i, o) {
  var s = t.__className;
  if (s !== n || s === void 0) {
    var a = Vl(n);
    a == null ? t.removeAttribute("class") : t.setAttribute("class", a), t.__className = n;
  }
  return o;
}
function qr(t, e, n, r) {
  var i = t.__style;
  if (i !== e) {
    var o = Xl(e);
    o == null ? t.removeAttribute("style") : t.style.cssText = o, t.__style = e;
  }
  return r;
}
const Ul = Symbol("is custom element"), Gl = Symbol("is html");
function m(t, e, n, r) {
  var i = Wl(t);
  i[e] !== (i[e] = n) && (e === "loading" && (t[Ra] = n), n == null ? t.removeAttribute(e) : typeof n != "string" && Kl(t).includes(e) ? t[e] = n : t.setAttribute(e, n));
}
function Wl(t) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    t.__attributes ?? (t.__attributes = {
      [Ul]: t.nodeName.includes("-"),
      [Gl]: t.namespaceURI === tl
    })
  );
}
var ro = /* @__PURE__ */ new Map();
function Kl(t) {
  var e = t.getAttribute("is") || t.nodeName, n = ro.get(e);
  if (n) return n;
  ro.set(e, n = []);
  for (var r, i = t, o = Element.prototype; o !== i; ) {
    r = Ma(i);
    for (var s in r)
      r[s].set && n.push(s);
    i = Yo(i);
  }
  return n;
}
function io(t, e) {
  return t === e || (t == null ? void 0 : t[qn]) === e;
}
function oo(t = {}, e, n, r) {
  return El(() => {
    var i, o;
    return us(() => {
      i = o, o = [], Fi(() => {
        t !== n(...o) && (e(t, ...o), i && io(n(...i), t) && e(null, ...i));
      });
    }), () => {
      Fe(() => {
        o && io(n(...o), t) && e(null, ...o);
      });
    };
  }), t;
}
let dr = !1;
function Zl(t) {
  var e = dr;
  try {
    return dr = !1, [t(), dr];
  } finally {
    dr = e;
  }
}
function yt(t, e, n, r) {
  var Y;
  var i = (n & Ja) !== 0, o = (n & Qa) !== 0, s = (
    /** @type {V} */
    r
  ), a = !0, u = () => (a && (a = !1, s = o ? Fi(
    /** @type {() => V} */
    r
  ) : (
    /** @type {V} */
    r
  )), s), f;
  if (i) {
    var c = qn in t || Ca in t;
    f = ((Y = pn(t, e)) == null ? void 0 : Y.set) ?? (c && e in t ? (P) => t[e] = P : void 0);
  }
  var d, h = !1;
  i ? [d, h] = Zl(() => (
    /** @type {V} */
    t[e]
  )) : d = /** @type {V} */
  t[e], d === void 0 && r !== void 0 && (d = u(), f && (Ha(), f(d)));
  var g;
  if (g = () => {
    var P = (
      /** @type {V} */
      t[e]
    );
    return P === void 0 ? u() : (a = !0, P);
  }, (n & Za) === 0)
    return g;
  if (f) {
    var _ = t.$$legacy;
    return (
      /** @type {() => V} */
      (function(P, b) {
        return arguments.length > 0 ? ((!b || _ || h) && f(b ? g() : P), P) : g();
      })
    );
  }
  var k = !1, M = ((n & Ka) !== 0 ? Xr : jo)(() => (k = !1, g()));
  i && l(M);
  var S = (
    /** @type {Effect} */
    et
  );
  return (
    /** @type {() => V} */
    (function(P, b) {
      if (arguments.length > 0) {
        const T = b ? l(M) : i ? Dt(P) : P;
        return V(M, T), k = !0, s !== void 0 && (s = T), P;
      }
      return De && k || (S.f & ye) !== 0 ? M.v : l(M);
    })
  );
}
const Jl = "5";
var Oo;
typeof window < "u" && ((Oo = window.__svelte ?? (window.__svelte = {})).v ?? (Oo.v = /* @__PURE__ */ new Set())).add(Jl);
const Ql = [
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
Ql.map(([t, e]) => [t.slice().sort((n, r) => r.length - n.length), e]);
const jl = 40, $l = 8, Qr = 16, tu = 5.5;
var J;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(J || (J = {}));
const eu = {
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
}, nu = {
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
function ru(t) {
  if (!t)
    return;
  const e = nu[t];
  if (e)
    return eu[e];
}
function iu(t) {
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
const ou = 1, Ms = 2, su = 4, au = 8;
function lu(t) {
  switch (t) {
    case "top":
      return ou;
    case "bottom":
      return Ms;
    case "left":
      return su;
    case "right":
      return au;
  }
}
function Pr(t) {
  return typeof t == "string" ? t : t.node;
}
function zr(t) {
  return typeof t == "string" ? void 0 : t.port;
}
function so(t) {
  return typeof t == "string" ? { node: t } : t;
}
function uu(t, e, n, r = 2) {
  for (const i of n.values()) {
    const o = i.size.width / 2 + r, s = i.size.height / 2 + r;
    if (t > i.position.x - o && t < i.position.x + o && e > i.position.y - s && e < i.position.y + s)
      return !0;
  }
  return !1;
}
let jr = null;
async function fu() {
  if (!jr) {
    const { AvoidLib: t } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await t.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await t.load(process.env.LIBAVOID_WASM_PATH) : await t.load(), jr = t.getInstance();
  }
  return jr;
}
async function Wn(t, e, n, r) {
  const i = await fu(), o = {
    edgeStyle: "orthogonal",
    shapeBufferDistance: 10,
    idealNudgingDistance: 20,
    ...r
  }, s = o.edgeStyle === "polyline" ? i.RouterFlag.PolyLineRouting.value : i.RouterFlag.OrthogonalRouting.value, a = new i.Router(s);
  a.setRoutingParameter(i.RoutingParameter.shapeBufferDistance.value, o.shapeBufferDistance), a.setRoutingParameter(i.RoutingParameter.idealNudgingDistance.value, o.idealNudgingDistance), a.setRoutingParameter(i.RoutingParameter.reverseDirectionPenalty.value, 500), a.setRoutingParameter(i.RoutingParameter.segmentPenalty.value, 50), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes.value, !0), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalTouchingColinearSegments.value, !0), a.setRoutingOption(i.RoutingOption.performUnifyingNudgingPreprocessingStep.value, !0), a.setRoutingOption(i.RoutingOption.nudgeSharedPathsWithCommonEndPoint.value, !0);
  try {
    return vu(i, a, t, e, n, o.edgeStyle, o.shapeBufferDistance);
  } finally {
    a.delete();
  }
}
function cu(t, e, n) {
  const r = /* @__PURE__ */ new Map();
  for (const [i, o] of n)
    r.set(i, new t.ShapeRef(e, new t.Rectangle(new t.Point(o.position.x, o.position.y), o.size.width, o.size.height)));
  return r;
}
function hu(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  let o = 1;
  for (const [s, a] of r) {
    const u = e.get(a.nodeId), f = n.get(a.nodeId);
    if (!u || !f)
      continue;
    const c = o++;
    i.set(s, c);
    const d = (a.absolutePosition.x - (f.position.x - f.size.width / 2)) / f.size.width, h = (a.absolutePosition.y - (f.position.y - f.size.height / 2)) / f.size.height, g = a.side === "top" || a.side === "bottom" ? Ms : lu(a.side);
    new t.ShapeConnectionPin(u, c, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, h)), !0, 0, g).setExclusive(!1);
  }
  return i;
}
function du(t, e, n, r, i, o, s, a) {
  const u = /* @__PURE__ */ new Map();
  for (const [f, c] of s.entries()) {
    const d = c.id ?? `__link_${f}`, h = Pr(c.from), g = Pr(c.to);
    if (!n.has(h) || !n.has(g))
      continue;
    const _ = zr(c.from), k = zr(c.to), M = _ ? `${h}:${_}` : null, S = k ? `${g}:${k}` : null, Y = M ? r.get(M) : void 0;
    let P;
    if (Y !== void 0)
      P = new t.ConnEnd(n.get(h), Y);
    else {
      const L = M ? o.get(M) : void 0, X = i.get(h), z = (L == null ? void 0 : L.absolutePosition) ?? (X == null ? void 0 : X.position);
      if (!z)
        continue;
      P = new t.ConnEnd(new t.Point(z.x, z.y));
    }
    const b = S ? o.get(S) : void 0, T = i.get(g), E = (b == null ? void 0 : b.absolutePosition) ?? (T == null ? void 0 : T.position);
    if (!E)
      continue;
    const A = new t.ConnEnd(new t.Point(E.x, E.y)), H = new t.ConnRef(e, P, A), R = S ? o.get(S) : null;
    if (R != null && R.side) {
      const X = Math.max(R.size.width, R.size.height) / 2 + 16;
      let z = R.absolutePosition.x, U = R.absolutePosition.y;
      switch (R.side) {
        case "top":
          U -= X;
          break;
        case "bottom":
          U += X;
          break;
        case "left":
          z -= X;
          break;
        case "right":
          z += X;
          break;
      }
      if (!uu(z, U, i, a)) {
        const v = new t.CheckpointVector();
        v.push_back(new t.Checkpoint(new t.Point(z, U))), H.setRoutingCheckpoints(v);
      }
    }
    u.set(d, H);
  }
  return e.processTransaction(), u;
}
function gu(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  for (const [o, s] of n.entries()) {
    const a = s.id ?? `__link_${o}`, u = t.get(a);
    if (!u)
      continue;
    const f = u.displayRoute(), c = [];
    for (let E = 0; E < f.size(); E++) {
      const A = f.at(E);
      c.push({ x: A.x, y: A.y });
    }
    const d = Pr(s.from), h = Pr(s.to), g = zr(s.from), _ = zr(s.to), k = g ? `${d}:${g}` : null, M = _ ? `${h}:${_}` : null, S = k ? e.get(k) : void 0, Y = M ? e.get(M) : void 0;
    S && c.length > 0 && (c[0] = { x: S.absolutePosition.x, y: S.absolutePosition.y }), Y && c.length > 0 && (c[c.length - 1] = {
      x: Y.absolutePosition.x,
      y: Y.absolutePosition.y
    });
    const P = c[0], b = c[c.length - 1], T = r === "straight" && c.length > 2 && P && b ? [P, b] : c;
    i.set(a, {
      id: a,
      fromPortId: g ? `${d}:${g}` : null,
      toPortId: _ ? `${h}:${_}` : null,
      fromNodeId: d,
      toNodeId: h,
      fromEndpoint: so(s.from),
      toEndpoint: so(s.to),
      points: T,
      width: iu(s),
      link: s
    });
  }
  return i;
}
function vu(t, e, n, r, i, o, s) {
  const a = cu(t, e, n), u = hu(t, a, n, r), f = du(t, e, a, u, n, r, i, s), c = gu(f, r, i, o), d = mu(c);
  return _u(d);
}
function mu(t) {
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
  ao(n, e, "y");
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
  return ao(r, e, "x"), e;
}
function ao(t, e, n) {
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
      lo(e, i, -f, n), lo(e, o, f, n), i.fixed -= f, o.fixed += f;
    }
  }
}
function lo(t, e, n, r) {
  const i = t.get(e.edgeId);
  if (!i)
    return;
  const o = i.points[e.pointIndex], s = i.points[e.pointIndex + 1];
  !o || !s || (r === "y" ? (o.y += n, s.y += n) : (o.x += n, s.x += n));
}
const pu = 8, uo = 6;
function _u(t) {
  const e = /* @__PURE__ */ new Map();
  for (const [n, r] of t)
    e.set(n, {
      ...r,
      points: yu(r.points, pu)
    });
  return e;
}
function yu(t, e) {
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
    const h = (a.x - s.x) / f, g = (a.y - s.y) / f, _ = (u.x - s.x) / c, k = (u.y - s.y) / c, M = h * k - g * _;
    if (Math.abs(M) < 1e-3) {
      n.push({ ...s });
      continue;
    }
    const S = s.x + h * d, Y = s.y + g * d, P = s.x + _ * d, b = s.y + k * d;
    for (let T = 0; T <= uo; T++) {
      const E = T / uo, A = 1 - E, H = A * A * S + 2 * A * E * s.x + E * E * P, R = A * A * Y + 2 * A * E * s.y + E * E * b;
      n.push({ x: H, y: R });
    }
  }
  const i = t[t.length - 1];
  return i && n.push({ ...i }), n;
}
const nn = 8;
function Is(t, e, n = nn) {
  return t.x - t.w / 2 - n < e.x + e.w / 2 && t.x + t.w / 2 + n > e.x - e.w / 2 && t.y - t.h / 2 - n < e.y + e.h / 2 && t.y + t.h / 2 + n > e.y - e.h / 2;
}
function Ps(t, e, n = nn) {
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
function zs(t, e, n, r) {
  const i = [];
  for (const [o, s] of n)
    o !== t && i.push({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height });
  if (r)
    for (const [o, s] of r)
      o !== t && (e && wu(e, o, r) || i.push(gi(s.bounds)));
  return i;
}
function Ts(t, e, n = nn) {
  let r = t.x, i = t.y;
  for (const o of e) {
    const s = { x: r, y: i, w: t.w, h: t.h };
    if (Is(s, o, n)) {
      const a = Ps(s, o, n);
      r = a.x, i = a.y;
    }
  }
  return { x: r, y: i };
}
function Cs(t, e, n, r, i = nn, o) {
  const s = r.get(t);
  if (!s)
    return { x: e, y: n };
  const a = zs(t, s.node.parent, r, o);
  return Ts({ x: e, y: n, w: s.size.width, h: s.size.height }, a, i);
}
function wu(t, e, n) {
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
const gr = 20, fo = 28;
function gi(t) {
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
      const g = h.size.width / 2, _ = h.size.height / 2;
      a = Math.min(a, h.position.x - g), u = Math.min(u, h.position.y - _), f = Math.max(f, h.position.x + g), c = Math.max(c, h.position.y + _);
    }
    for (const h of e.values())
      h.subgraph.parent === o && (d = !0, a = Math.min(a, h.bounds.x), u = Math.min(u, h.bounds.y), f = Math.max(f, h.bounds.x + h.bounds.width), c = Math.max(c, h.bounds.y + h.bounds.height));
    d && e.set(o, {
      ...s,
      bounds: {
        x: a - gr,
        y: u - gr - fo,
        width: f - a + gr * 2,
        height: c - u + gr * 2 + fo
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
      const c = gi(s.bounds), d = gi(f.bounds);
      if (!Is(c, d, nn))
        continue;
      const h = Ps(d, c, nn), g = h.x - d.x, _ = h.y - d.y;
      g === 0 && _ === 0 || (e.set(u, {
        ...f,
        bounds: { ...f.bounds, x: f.bounds.x + g, y: f.bounds.y + _ }
      }), Oi(u, g, _, t, e, n));
    }
  }
  for (const [o, s] of t) {
    const a = zs(o, s.node.parent, t, e), u = Ts({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height }, a);
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
async function xu(t, e, n, r, i, o = nn) {
  const s = r.nodes.get(t);
  if (!s)
    return null;
  const { x: a, y: u } = Cs(t, e, n, r.nodes, o, r.subgraphs), f = a - s.position.x, c = u - s.position.y;
  if (f === 0 && c === 0)
    return null;
  const d = new Map(r.nodes);
  d.set(t, { ...s, position: { x: a, y: u } });
  const h = new Map(r.ports);
  for (const [k, M] of r.ports)
    M.nodeId === t && h.set(k, {
      ...M,
      absolutePosition: {
        x: M.absolutePosition.x + f,
        y: M.absolutePosition.y + c
      }
    });
  let g;
  r.subgraphs && (g = new Map(r.subgraphs), Tr(d, g, h));
  const _ = await Wn(d, h, i);
  return { nodes: d, ports: h, edges: _, subgraphs: g };
}
async function bu(t, e, n, r, i) {
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
function ku(t, e, n, r, i) {
  return t.some((o) => {
    const s = typeof o.from == "string" ? { node: o.from } : o.from, a = typeof o.to == "string" ? { node: o.to } : o.to;
    return s.node === e && s.port === n && a.node === r && a.port === i || s.node === r && s.port === i && a.node === e && a.port === n;
  });
}
function Eu(t, e, n) {
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
const co = 8, ho = 24;
function Su(t, e) {
  const n = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const r of e.values())
    r.nodeId === t && r.side && n[r.side]++;
  return n;
}
function Nu(t, e) {
  const n = Math.max(t.top, t.bottom), r = Math.max(t.left, t.right);
  return {
    width: Math.max(e.width, (n + 1) * ho),
    height: Math.max(e.height, (r + 1) * ho)
  };
}
function Au(t, e, n, r) {
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
function Rs(t, e, n) {
  const r = e.get(t);
  if (!r)
    return;
  const i = Su(t, n), o = Nu(i, r.size);
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
    Au(t, u, s, n);
}
function Mu(t, e, n, r, i) {
  if (!n.get(t))
    return null;
  const s = Eu(t, i, r), a = `${t}:${s}`, u = new Map(r);
  u.set(a, {
    id: a,
    nodeId: t,
    label: s,
    absolutePosition: { x: 0, y: 0 },
    side: e,
    size: { width: co, height: co }
  });
  const f = new Map(n);
  return Rs(t, f, u), { nodes: f, ports: u, portId: a };
}
function Iu(t, e, n, r) {
  const i = n.get(t);
  if (!i)
    return null;
  const o = i.nodeId, s = i.label, a = r.filter((c) => {
    const d = typeof c.from == "string" ? { node: c.from } : c.from, h = typeof c.to == "string" ? { node: c.to } : c.to;
    return !(d.node === o && d.port === s || h.node === o && h.port === s);
  }), u = new Map(n);
  u.delete(t);
  const f = new Map(e);
  return Rs(o, f, u), { nodes: f, ports: u, links: a };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function Fs(t) {
  return typeof t > "u" || t === null;
}
function Pu(t) {
  return typeof t == "object" && t !== null;
}
function zu(t) {
  return Array.isArray(t) ? t : Fs(t) ? [] : [t];
}
function Tu(t, e) {
  var n, r, i, o;
  if (e)
    for (o = Object.keys(e), n = 0, r = o.length; n < r; n += 1)
      i = o[n], t[i] = e[i];
  return t;
}
function Cu(t, e) {
  var n = "", r;
  for (r = 0; r < e; r += 1)
    n += t;
  return n;
}
function Ru(t) {
  return t === 0 && Number.NEGATIVE_INFINITY === 1 / t;
}
var Fu = Fs, Lu = Pu, Ou = zu, Du = Cu, Yu = Ru, Hu = Tu, Di = {
  isNothing: Fu,
  isObject: Lu,
  toArray: Ou,
  repeat: Du,
  isNegativeZero: Yu,
  extend: Hu
};
function Ls(t, e) {
  var n = "", r = t.reason || "(unknown reason)";
  return t.mark ? (t.mark.name && (n += 'in "' + t.mark.name + '" '), n += "(" + (t.mark.line + 1) + ":" + (t.mark.column + 1) + ")", !e && t.mark.snippet && (n += `

` + t.mark.snippet), r + " " + n) : r;
}
function Qn(t, e) {
  Error.call(this), this.name = "YAMLException", this.reason = t, this.mark = e, this.message = Ls(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
Qn.prototype = Object.create(Error.prototype);
Qn.prototype.constructor = Qn;
Qn.prototype.toString = function(e) {
  return this.name + ": " + Ls(this, e);
};
var Ve = Qn, Bu = [
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
], Vu = [
  "scalar",
  "sequence",
  "mapping"
];
function Xu(t) {
  var e = {};
  return t !== null && Object.keys(t).forEach(function(n) {
    t[n].forEach(function(r) {
      e[String(r)] = n;
    });
  }), e;
}
function qu(t, e) {
  if (e = e || {}, Object.keys(e).forEach(function(n) {
    if (Bu.indexOf(n) === -1)
      throw new Ve('Unknown option "' + n + '" is met in definition of "' + t + '" YAML type.');
  }), this.options = e, this.tag = t, this.kind = e.kind || null, this.resolve = e.resolve || function() {
    return !0;
  }, this.construct = e.construct || function(n) {
    return n;
  }, this.instanceOf = e.instanceOf || null, this.predicate = e.predicate || null, this.represent = e.represent || null, this.representName = e.representName || null, this.defaultStyle = e.defaultStyle || null, this.multi = e.multi || !1, this.styleAliases = Xu(e.styleAliases || null), Vu.indexOf(this.kind) === -1)
    throw new Ve('Unknown kind "' + this.kind + '" is specified for "' + t + '" YAML type.');
}
var Et = qu;
function go(t, e) {
  var n = [];
  return t[e].forEach(function(r) {
    var i = n.length;
    n.forEach(function(o, s) {
      o.tag === r.tag && o.kind === r.kind && o.multi === r.multi && (i = s);
    }), n[i] = r;
  }), n;
}
function Uu() {
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
function vi(t) {
  return this.extend(t);
}
vi.prototype.extend = function(e) {
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
  var i = Object.create(vi.prototype);
  return i.implicit = (this.implicit || []).concat(n), i.explicit = (this.explicit || []).concat(r), i.compiledImplicit = go(i, "implicit"), i.compiledExplicit = go(i, "explicit"), i.compiledTypeMap = Uu(i.compiledImplicit, i.compiledExplicit), i;
};
var Gu = vi, Wu = new Et("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(t) {
    return t !== null ? t : "";
  }
}), Ku = new Et("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(t) {
    return t !== null ? t : [];
  }
}), Zu = new Et("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(t) {
    return t !== null ? t : {};
  }
}), Ju = new Gu({
  explicit: [
    Wu,
    Ku,
    Zu
  ]
});
function Qu(t) {
  if (t === null) return !0;
  var e = t.length;
  return e === 1 && t === "~" || e === 4 && (t === "null" || t === "Null" || t === "NULL");
}
function ju() {
  return null;
}
function $u(t) {
  return t === null;
}
var tf = new Et("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Qu,
  construct: ju,
  predicate: $u,
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
function ef(t) {
  if (t === null) return !1;
  var e = t.length;
  return e === 4 && (t === "true" || t === "True" || t === "TRUE") || e === 5 && (t === "false" || t === "False" || t === "FALSE");
}
function nf(t) {
  return t === "true" || t === "True" || t === "TRUE";
}
function rf(t) {
  return Object.prototype.toString.call(t) === "[object Boolean]";
}
var of = new Et("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: ef,
  construct: nf,
  predicate: rf,
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
function sf(t) {
  return 48 <= t && t <= 57 || 65 <= t && t <= 70 || 97 <= t && t <= 102;
}
function af(t) {
  return 48 <= t && t <= 55;
}
function lf(t) {
  return 48 <= t && t <= 57;
}
function uf(t) {
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
          if (!sf(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
    if (i === "o") {
      for (n++; n < e; n++)
        if (i = t[n], i !== "_") {
          if (!af(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; n < e; n++)
    if (i = t[n], i !== "_") {
      if (!lf(t.charCodeAt(n)))
        return !1;
      r = !0;
    }
  return !(!r || i === "_");
}
function ff(t) {
  var e = t, n = 1, r;
  if (e.indexOf("_") !== -1 && (e = e.replace(/_/g, "")), r = e[0], (r === "-" || r === "+") && (r === "-" && (n = -1), e = e.slice(1), r = e[0]), e === "0") return 0;
  if (r === "0") {
    if (e[1] === "b") return n * parseInt(e.slice(2), 2);
    if (e[1] === "x") return n * parseInt(e.slice(2), 16);
    if (e[1] === "o") return n * parseInt(e.slice(2), 8);
  }
  return n * parseInt(e, 10);
}
function cf(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && t % 1 === 0 && !Di.isNegativeZero(t);
}
var hf = new Et("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: uf,
  construct: ff,
  predicate: cf,
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
}), df = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function gf(t) {
  return !(t === null || !df.test(t) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  t[t.length - 1] === "_");
}
function vf(t) {
  var e, n;
  return e = t.replace(/_/g, "").toLowerCase(), n = e[0] === "-" ? -1 : 1, "+-".indexOf(e[0]) >= 0 && (e = e.slice(1)), e === ".inf" ? n === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : e === ".nan" ? NaN : n * parseFloat(e, 10);
}
var mf = /^[-+]?[0-9]+e/;
function pf(t, e) {
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
  return n = t.toString(10), mf.test(n) ? n.replace("e", ".e") : n;
}
function _f(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && (t % 1 !== 0 || Di.isNegativeZero(t));
}
var yf = new Et("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: gf,
  construct: vf,
  predicate: _f,
  represent: pf,
  defaultStyle: "lowercase"
}), wf = Ju.extend({
  implicit: [
    tf,
    of,
    hf,
    yf
  ]
}), xf = wf, Os = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Ds = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function bf(t) {
  return t === null ? !1 : Os.exec(t) !== null || Ds.exec(t) !== null;
}
function kf(t) {
  var e, n, r, i, o, s, a, u = 0, f = null, c, d, h;
  if (e = Os.exec(t), e === null && (e = Ds.exec(t)), e === null) throw new Error("Date resolve error");
  if (n = +e[1], r = +e[2] - 1, i = +e[3], !e[4])
    return new Date(Date.UTC(n, r, i));
  if (o = +e[4], s = +e[5], a = +e[6], e[7]) {
    for (u = e[7].slice(0, 3); u.length < 3; )
      u += "0";
    u = +u;
  }
  return e[9] && (c = +e[10], d = +(e[11] || 0), f = (c * 60 + d) * 6e4, e[9] === "-" && (f = -f)), h = new Date(Date.UTC(n, r, i, o, s, a, u)), f && h.setTime(h.getTime() - f), h;
}
function Ef(t) {
  return t.toISOString();
}
var Sf = new Et("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: bf,
  construct: kf,
  instanceOf: Date,
  represent: Ef
});
function Nf(t) {
  return t === "<<" || t === null;
}
var Af = new Et("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: Nf
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
function If(t) {
  var e, n, r = t.replace(/[\r\n=]/g, ""), i = r.length, o = Yi, s = 0, a = [];
  for (e = 0; e < i; e++)
    e % 4 === 0 && e && (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)), s = s << 6 | o.indexOf(r.charAt(e));
  return n = i % 4 * 6, n === 0 ? (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)) : n === 18 ? (a.push(s >> 10 & 255), a.push(s >> 2 & 255)) : n === 12 && a.push(s >> 4 & 255), new Uint8Array(a);
}
function Pf(t) {
  var e = "", n = 0, r, i, o = t.length, s = Yi;
  for (r = 0; r < o; r++)
    r % 3 === 0 && r && (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]), n = (n << 8) + t[r];
  return i = o % 3, i === 0 ? (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]) : i === 2 ? (e += s[n >> 10 & 63], e += s[n >> 4 & 63], e += s[n << 2 & 63], e += s[64]) : i === 1 && (e += s[n >> 2 & 63], e += s[n << 4 & 63], e += s[64], e += s[64]), e;
}
function zf(t) {
  return Object.prototype.toString.call(t) === "[object Uint8Array]";
}
var Tf = new Et("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: Mf,
  construct: If,
  predicate: zf,
  represent: Pf
}), Cf = Object.prototype.hasOwnProperty, Rf = Object.prototype.toString;
function Ff(t) {
  if (t === null) return !0;
  var e = [], n, r, i, o, s, a = t;
  for (n = 0, r = a.length; n < r; n += 1) {
    if (i = a[n], s = !1, Rf.call(i) !== "[object Object]") return !1;
    for (o in i)
      if (Cf.call(i, o))
        if (!s) s = !0;
        else return !1;
    if (!s) return !1;
    if (e.indexOf(o) === -1) e.push(o);
    else return !1;
  }
  return !0;
}
function Lf(t) {
  return t !== null ? t : [];
}
var Of = new Et("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: Ff,
  construct: Lf
}), Df = Object.prototype.toString;
function Yf(t) {
  if (t === null) return !0;
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1) {
    if (r = s[e], Df.call(r) !== "[object Object]" || (i = Object.keys(r), i.length !== 1)) return !1;
    o[e] = [i[0], r[i[0]]];
  }
  return !0;
}
function Hf(t) {
  if (t === null) return [];
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1)
    r = s[e], i = Object.keys(r), o[e] = [i[0], r[i[0]]];
  return o;
}
var Bf = new Et("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: Yf,
  construct: Hf
}), Vf = Object.prototype.hasOwnProperty;
function Xf(t) {
  if (t === null) return !0;
  var e, n = t;
  for (e in n)
    if (Vf.call(n, e) && n[e] !== null)
      return !1;
  return !0;
}
function qf(t) {
  return t !== null ? t : {};
}
var Uf = new Et("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Xf,
  construct: qf
});
xf.extend({
  implicit: [
    Sf,
    Af
  ],
  explicit: [
    Tf,
    Of,
    Bf,
    Uf
  ]
});
function vo(t) {
  return t === 48 ? "\0" : t === 97 ? "\x07" : t === 98 ? "\b" : t === 116 || t === 9 ? "	" : t === 110 ? `
` : t === 118 ? "\v" : t === 102 ? "\f" : t === 114 ? "\r" : t === 101 ? "\x1B" : t === 32 ? " " : t === 34 ? '"' : t === 47 ? "/" : t === 92 ? "\\" : t === 78 ? "" : t === 95 ? " " : t === 76 ? "\u2028" : t === 80 ? "\u2029" : "";
}
var Gf = new Array(256), Wf = new Array(256);
for (var gn = 0; gn < 256; gn++)
  Gf[gn] = vo(gn) ? 1 : 0, Wf[gn] = vo(gn);
var mo;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(mo || (mo = {}));
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
  ...kr,
  colors: {
    ...kr.colors,
    // Device colors (adjusted for dark)
    devices: (J.Router + "", J.L3Switch + "", J.L2Switch + "", J.Firewall + "", J.LoadBalancer + "", J.Server + "", J.AccessPoint + "", J.Cloud + "", J.Internet + "", J.Generic + "")
  },
  shadows: {
    ...kr.shadows
  }
});
function Kf(t = kr) {
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
var Zf = { value: () => {
} };
function Ur() {
  for (var t = 0, e = arguments.length, n = {}, r; t < e; ++t) {
    if (!(r = arguments[t] + "") || r in n || /[\s.]/.test(r)) throw new Error("illegal type: " + r);
    n[r] = [];
  }
  return new Er(n);
}
function Er(t) {
  this._ = t;
}
function Jf(t, e) {
  return t.trim().split(/^|\s+/).map(function(n) {
    var r = "", i = n.indexOf(".");
    if (i >= 0 && (r = n.slice(i + 1), n = n.slice(0, i)), n && !e.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    return { type: n, name: r };
  });
}
Er.prototype = Ur.prototype = {
  constructor: Er,
  on: function(t, e) {
    var n = this._, r = Jf(t + "", n), i, o = -1, s = r.length;
    if (arguments.length < 2) {
      for (; ++o < s; ) if ((i = (t = r[o]).type) && (i = Qf(n[i], t.name))) return i;
      return;
    }
    if (e != null && typeof e != "function") throw new Error("invalid callback: " + e);
    for (; ++o < s; )
      if (i = (t = r[o]).type) n[i] = po(n[i], t.name, e);
      else if (e == null) for (i in n) n[i] = po(n[i], t.name, null);
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
function Qf(t, e) {
  for (var n = 0, r = t.length, i; n < r; ++n)
    if ((i = t[n]).name === e)
      return i.value;
}
function po(t, e, n) {
  for (var r = 0, i = t.length; r < i; ++r)
    if (t[r].name === e) {
      t[r] = Zf, t = t.slice(0, r).concat(t.slice(r + 1));
      break;
    }
  return n != null && t.push({ name: e, value: n }), t;
}
var mi = "http://www.w3.org/1999/xhtml";
const _o = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: mi,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function Gr(t) {
  var e = t += "", n = e.indexOf(":");
  return n >= 0 && (e = t.slice(0, n)) !== "xmlns" && (t = t.slice(n + 1)), _o.hasOwnProperty(e) ? { space: _o[e], local: t } : t;
}
function jf(t) {
  return function() {
    var e = this.ownerDocument, n = this.namespaceURI;
    return n === mi && e.documentElement.namespaceURI === mi ? e.createElement(t) : e.createElementNS(n, t);
  };
}
function $f(t) {
  return function() {
    return this.ownerDocument.createElementNS(t.space, t.local);
  };
}
function Ys(t) {
  var e = Gr(t);
  return (e.local ? $f : jf)(e);
}
function tc() {
}
function Hi(t) {
  return t == null ? tc : function() {
    return this.querySelector(t);
  };
}
function ec(t) {
  typeof t != "function" && (t = Hi(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = new Array(s), u, f, c = 0; c < s; ++c)
      (u = o[c]) && (f = t.call(u, u.__data__, c, o)) && ("__data__" in u && (f.__data__ = u.__data__), a[c] = f);
  return new Ht(r, this._parents);
}
function nc(t) {
  return t == null ? [] : Array.isArray(t) ? t : Array.from(t);
}
function rc() {
  return [];
}
function Hs(t) {
  return t == null ? rc : function() {
    return this.querySelectorAll(t);
  };
}
function ic(t) {
  return function() {
    return nc(t.apply(this, arguments));
  };
}
function oc(t) {
  typeof t == "function" ? t = ic(t) : t = Hs(t);
  for (var e = this._groups, n = e.length, r = [], i = [], o = 0; o < n; ++o)
    for (var s = e[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && (r.push(t.call(u, u.__data__, f, s)), i.push(u));
  return new Ht(r, i);
}
function Bs(t) {
  return function() {
    return this.matches(t);
  };
}
function Vs(t) {
  return function(e) {
    return e.matches(t);
  };
}
var sc = Array.prototype.find;
function ac(t) {
  return function() {
    return sc.call(this.children, t);
  };
}
function lc() {
  return this.firstElementChild;
}
function uc(t) {
  return this.select(t == null ? lc : ac(typeof t == "function" ? t : Vs(t)));
}
var fc = Array.prototype.filter;
function cc() {
  return Array.from(this.children);
}
function hc(t) {
  return function() {
    return fc.call(this.children, t);
  };
}
function dc(t) {
  return this.selectAll(t == null ? cc : hc(typeof t == "function" ? t : Vs(t)));
}
function gc(t) {
  typeof t != "function" && (t = Bs(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new Ht(r, this._parents);
}
function Xs(t) {
  return new Array(t.length);
}
function vc() {
  return new Ht(this._enter || this._groups.map(Xs), this._parents);
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
function mc(t) {
  return function() {
    return t;
  };
}
function pc(t, e, n, r, i, o) {
  for (var s = 0, a, u = e.length, f = o.length; s < f; ++s)
    (a = e[s]) ? (a.__data__ = o[s], r[s] = a) : n[s] = new Cr(t, o[s]);
  for (; s < u; ++s)
    (a = e[s]) && (i[s] = a);
}
function _c(t, e, n, r, i, o, s) {
  var a, u, f = /* @__PURE__ */ new Map(), c = e.length, d = o.length, h = new Array(c), g;
  for (a = 0; a < c; ++a)
    (u = e[a]) && (h[a] = g = s.call(u, u.__data__, a, e) + "", f.has(g) ? i[a] = u : f.set(g, u));
  for (a = 0; a < d; ++a)
    g = s.call(t, o[a], a, o) + "", (u = f.get(g)) ? (r[a] = u, u.__data__ = o[a], f.delete(g)) : n[a] = new Cr(t, o[a]);
  for (a = 0; a < c; ++a)
    (u = e[a]) && f.get(h[a]) === u && (i[a] = u);
}
function yc(t) {
  return t.__data__;
}
function wc(t, e) {
  if (!arguments.length) return Array.from(this, yc);
  var n = e ? _c : pc, r = this._parents, i = this._groups;
  typeof t != "function" && (t = mc(t));
  for (var o = i.length, s = new Array(o), a = new Array(o), u = new Array(o), f = 0; f < o; ++f) {
    var c = r[f], d = i[f], h = d.length, g = xc(t.call(c, c && c.__data__, f, r)), _ = g.length, k = a[f] = new Array(_), M = s[f] = new Array(_), S = u[f] = new Array(h);
    n(c, d, k, M, S, g, e);
    for (var Y = 0, P = 0, b, T; Y < _; ++Y)
      if (b = k[Y]) {
        for (Y >= P && (P = Y + 1); !(T = M[P]) && ++P < _; ) ;
        b._next = T || null;
      }
  }
  return s = new Ht(s, r), s._enter = a, s._exit = u, s;
}
function xc(t) {
  return typeof t == "object" && "length" in t ? t : Array.from(t);
}
function bc() {
  return new Ht(this._exit || this._groups.map(Xs), this._parents);
}
function kc(t, e, n) {
  var r = this.enter(), i = this, o = this.exit();
  return typeof t == "function" ? (r = t(r), r && (r = r.selection())) : r = r.append(t + ""), e != null && (i = e(i), i && (i = i.selection())), n == null ? o.remove() : n(o), r && i ? r.merge(i).order() : i;
}
function Ec(t) {
  for (var e = t.selection ? t.selection() : t, n = this._groups, r = e._groups, i = n.length, o = r.length, s = Math.min(i, o), a = new Array(i), u = 0; u < s; ++u)
    for (var f = n[u], c = r[u], d = f.length, h = a[u] = new Array(d), g, _ = 0; _ < d; ++_)
      (g = f[_] || c[_]) && (h[_] = g);
  for (; u < i; ++u)
    a[u] = n[u];
  return new Ht(a, this._parents);
}
function Sc() {
  for (var t = this._groups, e = -1, n = t.length; ++e < n; )
    for (var r = t[e], i = r.length - 1, o = r[i], s; --i >= 0; )
      (s = r[i]) && (o && s.compareDocumentPosition(o) ^ 4 && o.parentNode.insertBefore(s, o), o = s);
  return this;
}
function Nc(t) {
  t || (t = Ac);
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
function Ac(t, e) {
  return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
function Mc() {
  var t = arguments[0];
  return arguments[0] = this, t.apply(null, arguments), this;
}
function Ic() {
  return Array.from(this);
}
function Pc() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length; i < o; ++i) {
      var s = r[i];
      if (s) return s;
    }
  return null;
}
function zc() {
  let t = 0;
  for (const e of this) ++t;
  return t;
}
function Tc() {
  return !this.node();
}
function Cc(t) {
  for (var e = this._groups, n = 0, r = e.length; n < r; ++n)
    for (var i = e[n], o = 0, s = i.length, a; o < s; ++o)
      (a = i[o]) && t.call(a, a.__data__, o, i);
  return this;
}
function Rc(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function Fc(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function Lc(t, e) {
  return function() {
    this.setAttribute(t, e);
  };
}
function Oc(t, e) {
  return function() {
    this.setAttributeNS(t.space, t.local, e);
  };
}
function Dc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttribute(t) : this.setAttribute(t, n);
  };
}
function Yc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttributeNS(t.space, t.local) : this.setAttributeNS(t.space, t.local, n);
  };
}
function Hc(t, e) {
  var n = Gr(t);
  if (arguments.length < 2) {
    var r = this.node();
    return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n);
  }
  return this.each((e == null ? n.local ? Fc : Rc : typeof e == "function" ? n.local ? Yc : Dc : n.local ? Oc : Lc)(n, e));
}
function qs(t) {
  return t.ownerDocument && t.ownerDocument.defaultView || t.document && t || t.defaultView;
}
function Bc(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function Vc(t, e, n) {
  return function() {
    this.style.setProperty(t, e, n);
  };
}
function Xc(t, e, n) {
  return function() {
    var r = e.apply(this, arguments);
    r == null ? this.style.removeProperty(t) : this.style.setProperty(t, r, n);
  };
}
function qc(t, e, n) {
  return arguments.length > 1 ? this.each((e == null ? Bc : typeof e == "function" ? Xc : Vc)(t, e, n ?? "")) : Cn(this.node(), t);
}
function Cn(t, e) {
  return t.style.getPropertyValue(e) || qs(t).getComputedStyle(t, null).getPropertyValue(e);
}
function Uc(t) {
  return function() {
    delete this[t];
  };
}
function Gc(t, e) {
  return function() {
    this[t] = e;
  };
}
function Wc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? delete this[t] : this[t] = n;
  };
}
function Kc(t, e) {
  return arguments.length > 1 ? this.each((e == null ? Uc : typeof e == "function" ? Wc : Gc)(t, e)) : this.node()[t];
}
function Us(t) {
  return t.trim().split(/^|\s+/);
}
function Bi(t) {
  return t.classList || new Gs(t);
}
function Gs(t) {
  this._node = t, this._names = Us(t.getAttribute("class") || "");
}
Gs.prototype = {
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
function Ws(t, e) {
  for (var n = Bi(t), r = -1, i = e.length; ++r < i; ) n.add(e[r]);
}
function Ks(t, e) {
  for (var n = Bi(t), r = -1, i = e.length; ++r < i; ) n.remove(e[r]);
}
function Zc(t) {
  return function() {
    Ws(this, t);
  };
}
function Jc(t) {
  return function() {
    Ks(this, t);
  };
}
function Qc(t, e) {
  return function() {
    (e.apply(this, arguments) ? Ws : Ks)(this, t);
  };
}
function jc(t, e) {
  var n = Us(t + "");
  if (arguments.length < 2) {
    for (var r = Bi(this.node()), i = -1, o = n.length; ++i < o; ) if (!r.contains(n[i])) return !1;
    return !0;
  }
  return this.each((typeof e == "function" ? Qc : e ? Zc : Jc)(n, e));
}
function $c() {
  this.textContent = "";
}
function th(t) {
  return function() {
    this.textContent = t;
  };
}
function eh(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.textContent = e ?? "";
  };
}
function nh(t) {
  return arguments.length ? this.each(t == null ? $c : (typeof t == "function" ? eh : th)(t)) : this.node().textContent;
}
function rh() {
  this.innerHTML = "";
}
function ih(t) {
  return function() {
    this.innerHTML = t;
  };
}
function oh(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.innerHTML = e ?? "";
  };
}
function sh(t) {
  return arguments.length ? this.each(t == null ? rh : (typeof t == "function" ? oh : ih)(t)) : this.node().innerHTML;
}
function ah() {
  this.nextSibling && this.parentNode.appendChild(this);
}
function lh() {
  return this.each(ah);
}
function uh() {
  this.previousSibling && this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function fh() {
  return this.each(uh);
}
function ch(t) {
  var e = typeof t == "function" ? t : Ys(t);
  return this.select(function() {
    return this.appendChild(e.apply(this, arguments));
  });
}
function hh() {
  return null;
}
function dh(t, e) {
  var n = typeof t == "function" ? t : Ys(t), r = e == null ? hh : typeof e == "function" ? e : Hi(e);
  return this.select(function() {
    return this.insertBefore(n.apply(this, arguments), r.apply(this, arguments) || null);
  });
}
function gh() {
  var t = this.parentNode;
  t && t.removeChild(this);
}
function vh() {
  return this.each(gh);
}
function mh() {
  var t = this.cloneNode(!1), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function ph() {
  var t = this.cloneNode(!0), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function _h(t) {
  return this.select(t ? ph : mh);
}
function yh(t) {
  return arguments.length ? this.property("__data__", t) : this.node().__data__;
}
function wh(t) {
  return function(e) {
    t.call(this, e, this.__data__);
  };
}
function xh(t) {
  return t.trim().split(/^|\s+/).map(function(e) {
    var n = "", r = e.indexOf(".");
    return r >= 0 && (n = e.slice(r + 1), e = e.slice(0, r)), { type: e, name: n };
  });
}
function bh(t) {
  return function() {
    var e = this.__on;
    if (e) {
      for (var n = 0, r = -1, i = e.length, o; n < i; ++n)
        o = e[n], (!t.type || o.type === t.type) && o.name === t.name ? this.removeEventListener(o.type, o.listener, o.options) : e[++r] = o;
      ++r ? e.length = r : delete this.__on;
    }
  };
}
function kh(t, e, n) {
  return function() {
    var r = this.__on, i, o = wh(e);
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
function Eh(t, e, n) {
  var r = xh(t + ""), i, o = r.length, s;
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
  for (a = e ? kh : bh, i = 0; i < o; ++i) this.each(a(r[i], e, n));
  return this;
}
function Zs(t, e, n) {
  var r = qs(t), i = r.CustomEvent;
  typeof i == "function" ? i = new i(e, n) : (i = r.document.createEvent("Event"), n ? (i.initEvent(e, n.bubbles, n.cancelable), i.detail = n.detail) : i.initEvent(e, !1, !1)), t.dispatchEvent(i);
}
function Sh(t, e) {
  return function() {
    return Zs(this, t, e);
  };
}
function Nh(t, e) {
  return function() {
    return Zs(this, t, e.apply(this, arguments));
  };
}
function Ah(t, e) {
  return this.each((typeof e == "function" ? Nh : Sh)(t, e));
}
function* Mh() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length, s; i < o; ++i)
      (s = r[i]) && (yield s);
}
var Js = [null];
function Ht(t, e) {
  this._groups = t, this._parents = e;
}
function ur() {
  return new Ht([[document.documentElement]], Js);
}
function Ih() {
  return this;
}
Ht.prototype = ur.prototype = {
  constructor: Ht,
  select: ec,
  selectAll: oc,
  selectChild: uc,
  selectChildren: dc,
  filter: gc,
  data: wc,
  enter: vc,
  exit: bc,
  join: kc,
  merge: Ec,
  selection: Ih,
  order: Sc,
  sort: Nc,
  call: Mc,
  nodes: Ic,
  node: Pc,
  size: zc,
  empty: Tc,
  each: Cc,
  attr: Hc,
  style: qc,
  property: Kc,
  classed: jc,
  text: nh,
  html: sh,
  raise: lh,
  lower: fh,
  append: ch,
  insert: dh,
  remove: vh,
  clone: _h,
  datum: yh,
  on: Eh,
  dispatch: Ah,
  [Symbol.iterator]: Mh
};
function Pt(t) {
  return typeof t == "string" ? new Ht([[document.querySelector(t)]], [document.documentElement]) : new Ht([[t]], Js);
}
function Ph(t) {
  let e;
  for (; e = t.sourceEvent; ) t = e;
  return t;
}
function ve(t, e) {
  if (t = Ph(t), e === void 0 && (e = t.currentTarget), e) {
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
const zh = { passive: !1 }, jn = { capture: !0, passive: !1 };
function $r(t) {
  t.stopImmediatePropagation();
}
function _n(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function Qs(t) {
  var e = t.document.documentElement, n = Pt(t).on("dragstart.drag", _n, jn);
  "onselectstart" in e ? n.on("selectstart.drag", _n, jn) : (e.__noselect = e.style.MozUserSelect, e.style.MozUserSelect = "none");
}
function js(t, e) {
  var n = t.document.documentElement, r = Pt(t).on("dragstart.drag", null);
  e && (r.on("click.drag", _n, jn), setTimeout(function() {
    r.on("click.drag", null);
  }, 0)), "onselectstart" in n ? r.on("selectstart.drag", null) : (n.style.MozUserSelect = n.__noselect, delete n.__noselect);
}
const vr = (t) => () => t;
function pi(t, {
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
pi.prototype.on = function() {
  var t = this._.on.apply(this._, arguments);
  return t === this._ ? this : t;
};
function Th(t) {
  return !t.ctrlKey && !t.button;
}
function Ch() {
  return this.parentNode;
}
function Rh(t, e) {
  return e ?? { x: t.x, y: t.y };
}
function Fh() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function yo() {
  var t = Th, e = Ch, n = Rh, r = Fh, i = {}, o = Ur("start", "drag", "end"), s = 0, a, u, f, c, d = 0;
  function h(b) {
    b.on("mousedown.drag", g).filter(r).on("touchstart.drag", M).on("touchmove.drag", S, zh).on("touchend.drag touchcancel.drag", Y).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function g(b, T) {
    if (!(c || !t.call(this, b, T))) {
      var E = P(this, e.call(this, b, T), b, T, "mouse");
      E && (Pt(b.view).on("mousemove.drag", _, jn).on("mouseup.drag", k, jn), Qs(b.view), $r(b), f = !1, a = b.clientX, u = b.clientY, E("start", b));
    }
  }
  function _(b) {
    if (_n(b), !f) {
      var T = b.clientX - a, E = b.clientY - u;
      f = T * T + E * E > d;
    }
    i.mouse("drag", b);
  }
  function k(b) {
    Pt(b.view).on("mousemove.drag mouseup.drag", null), js(b.view, f), _n(b), i.mouse("end", b);
  }
  function M(b, T) {
    if (t.call(this, b, T)) {
      var E = b.changedTouches, A = e.call(this, b, T), H = E.length, R, L;
      for (R = 0; R < H; ++R)
        (L = P(this, A, b, T, E[R].identifier, E[R])) && ($r(b), L("start", b, E[R]));
    }
  }
  function S(b) {
    var T = b.changedTouches, E = T.length, A, H;
    for (A = 0; A < E; ++A)
      (H = i[T[A].identifier]) && (_n(b), H("drag", b, T[A]));
  }
  function Y(b) {
    var T = b.changedTouches, E = T.length, A, H;
    for (c && clearTimeout(c), c = setTimeout(function() {
      c = null;
    }, 500), A = 0; A < E; ++A)
      (H = i[T[A].identifier]) && ($r(b), H("end", b, T[A]));
  }
  function P(b, T, E, A, H, R) {
    var L = o.copy(), X = ve(R || E, T), z, U, v;
    if ((v = n.call(b, new pi("beforestart", {
      sourceEvent: E,
      target: h,
      identifier: H,
      active: s,
      x: X[0],
      y: X[1],
      dx: 0,
      dy: 0,
      dispatch: L
    }), A)) != null)
      return z = v.x - X[0] || 0, U = v.y - X[1] || 0, function w(p, x, N) {
        var I = X, F;
        switch (p) {
          case "start":
            i[H] = w, F = s++;
            break;
          case "end":
            delete i[H], --s;
          // falls through
          case "drag":
            X = ve(N || x, T), F = s;
            break;
        }
        L.call(
          p,
          b,
          new pi(p, {
            sourceEvent: x,
            subject: v,
            target: h,
            identifier: H,
            active: F,
            x: X[0] + z,
            y: X[1] + U,
            dx: X[0] - I[0],
            dy: X[1] - I[1],
            dispatch: L
          }),
          A
        );
      };
  }
  return h.filter = function(b) {
    return arguments.length ? (t = typeof b == "function" ? b : vr(!!b), h) : t;
  }, h.container = function(b) {
    return arguments.length ? (e = typeof b == "function" ? b : vr(b), h) : e;
  }, h.subject = function(b) {
    return arguments.length ? (n = typeof b == "function" ? b : vr(b), h) : n;
  }, h.touchable = function(b) {
    return arguments.length ? (r = typeof b == "function" ? b : vr(!!b), h) : r;
  }, h.on = function() {
    var b = o.on.apply(o, arguments);
    return b === o ? h : b;
  }, h.clickDistance = function(b) {
    return arguments.length ? (d = (b = +b) * b, h) : Math.sqrt(d);
  }, h;
}
function Vi(t, e, n) {
  t.prototype = e.prototype = n, n.constructor = t;
}
function $s(t, e) {
  var n = Object.create(t.prototype);
  for (var r in e) n[r] = e[r];
  return n;
}
function fr() {
}
var $n = 0.7, Rr = 1 / $n, yn = "\\s*([+-]?\\d+)\\s*", tr = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", ae = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Lh = /^#([0-9a-f]{3,8})$/, Oh = new RegExp(`^rgb\\(${yn},${yn},${yn}\\)$`), Dh = new RegExp(`^rgb\\(${ae},${ae},${ae}\\)$`), Yh = new RegExp(`^rgba\\(${yn},${yn},${yn},${tr}\\)$`), Hh = new RegExp(`^rgba\\(${ae},${ae},${ae},${tr}\\)$`), Bh = new RegExp(`^hsl\\(${tr},${ae},${ae}\\)$`), Vh = new RegExp(`^hsla\\(${tr},${ae},${ae},${tr}\\)$`), wo = {
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
  hex: xo,
  // Deprecated! Use color.formatHex.
  formatHex: xo,
  formatHex8: Xh,
  formatHsl: qh,
  formatRgb: bo,
  toString: bo
});
function xo() {
  return this.rgb().formatHex();
}
function Xh() {
  return this.rgb().formatHex8();
}
function qh() {
  return ta(this).formatHsl();
}
function bo() {
  return this.rgb().formatRgb();
}
function er(t) {
  var e, n;
  return t = (t + "").trim().toLowerCase(), (e = Lh.exec(t)) ? (n = e[1].length, e = parseInt(e[1], 16), n === 6 ? ko(e) : n === 3 ? new Tt(e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, (e & 15) << 4 | e & 15, 1) : n === 8 ? mr(e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, (e & 255) / 255) : n === 4 ? mr(e >> 12 & 15 | e >> 8 & 240, e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, ((e & 15) << 4 | e & 15) / 255) : null) : (e = Oh.exec(t)) ? new Tt(e[1], e[2], e[3], 1) : (e = Dh.exec(t)) ? new Tt(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, 1) : (e = Yh.exec(t)) ? mr(e[1], e[2], e[3], e[4]) : (e = Hh.exec(t)) ? mr(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, e[4]) : (e = Bh.exec(t)) ? No(e[1], e[2] / 100, e[3] / 100, 1) : (e = Vh.exec(t)) ? No(e[1], e[2] / 100, e[3] / 100, e[4]) : wo.hasOwnProperty(t) ? ko(wo[t]) : t === "transparent" ? new Tt(NaN, NaN, NaN, 0) : null;
}
function ko(t) {
  return new Tt(t >> 16 & 255, t >> 8 & 255, t & 255, 1);
}
function mr(t, e, n, r) {
  return r <= 0 && (t = e = n = NaN), new Tt(t, e, n, r);
}
function Uh(t) {
  return t instanceof fr || (t = er(t)), t ? (t = t.rgb(), new Tt(t.r, t.g, t.b, t.opacity)) : new Tt();
}
function _i(t, e, n, r) {
  return arguments.length === 1 ? Uh(t) : new Tt(t, e, n, r ?? 1);
}
function Tt(t, e, n, r) {
  this.r = +t, this.g = +e, this.b = +n, this.opacity = +r;
}
Vi(Tt, _i, $s(fr, {
  brighter(t) {
    return t = t == null ? Rr : Math.pow(Rr, t), new Tt(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? $n : Math.pow($n, t), new Tt(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Tt(je(this.r), je(this.g), je(this.b), Fr(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && -0.5 <= this.g && this.g < 255.5 && -0.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
  },
  hex: Eo,
  // Deprecated! Use color.formatHex.
  formatHex: Eo,
  formatHex8: Gh,
  formatRgb: So,
  toString: So
}));
function Eo() {
  return `#${qe(this.r)}${qe(this.g)}${qe(this.b)}`;
}
function Gh() {
  return `#${qe(this.r)}${qe(this.g)}${qe(this.b)}${qe((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function So() {
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
function No(t, e, n, r) {
  return r <= 0 ? t = e = n = NaN : n <= 0 || n >= 1 ? t = e = NaN : e <= 0 && (t = NaN), new jt(t, e, n, r);
}
function ta(t) {
  if (t instanceof jt) return new jt(t.h, t.s, t.l, t.opacity);
  if (t instanceof fr || (t = er(t)), !t) return new jt();
  if (t instanceof jt) return t;
  t = t.rgb();
  var e = t.r / 255, n = t.g / 255, r = t.b / 255, i = Math.min(e, n, r), o = Math.max(e, n, r), s = NaN, a = o - i, u = (o + i) / 2;
  return a ? (e === o ? s = (n - r) / a + (n < r) * 6 : n === o ? s = (r - e) / a + 2 : s = (e - n) / a + 4, a /= u < 0.5 ? o + i : 2 - o - i, s *= 60) : a = u > 0 && u < 1 ? 0 : s, new jt(s, a, u, t.opacity);
}
function Wh(t, e, n, r) {
  return arguments.length === 1 ? ta(t) : new jt(t, e, n, r ?? 1);
}
function jt(t, e, n, r) {
  this.h = +t, this.s = +e, this.l = +n, this.opacity = +r;
}
Vi(jt, Wh, $s(fr, {
  brighter(t) {
    return t = t == null ? Rr : Math.pow(Rr, t), new jt(this.h, this.s, this.l * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? $n : Math.pow($n, t), new jt(this.h, this.s, this.l * t, this.opacity);
  },
  rgb() {
    var t = this.h % 360 + (this.h < 0) * 360, e = isNaN(t) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < 0.5 ? n : 1 - n) * e, i = 2 * n - r;
    return new Tt(
      ti(t >= 240 ? t - 240 : t + 120, i, r),
      ti(t, i, r),
      ti(t < 120 ? t + 240 : t - 120, i, r),
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
function ti(t, e, n) {
  return (t < 60 ? e + (n - e) * t / 60 : t < 180 ? n : t < 240 ? e + (n - e) * (240 - t) / 60 : e) * 255;
}
const ea = (t) => () => t;
function Kh(t, e) {
  return function(n) {
    return t + n * e;
  };
}
function Zh(t, e, n) {
  return t = Math.pow(t, n), e = Math.pow(e, n) - t, n = 1 / n, function(r) {
    return Math.pow(t + r * e, n);
  };
}
function Jh(t) {
  return (t = +t) == 1 ? na : function(e, n) {
    return n - e ? Zh(e, n, t) : ea(isNaN(e) ? n : e);
  };
}
function na(t, e) {
  var n = e - t;
  return n ? Kh(t, n) : ea(isNaN(t) ? e : t);
}
const Mo = (function t(e) {
  var n = Jh(e);
  function r(i, o) {
    var s = n((i = _i(i)).r, (o = _i(o)).r), a = n(i.g, o.g), u = n(i.b, o.b), f = na(i.opacity, o.opacity);
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
var yi = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, ei = new RegExp(yi.source, "g");
function Qh(t) {
  return function() {
    return t;
  };
}
function jh(t) {
  return function(e) {
    return t(e) + "";
  };
}
function $h(t, e) {
  var n = yi.lastIndex = ei.lastIndex = 0, r, i, o, s = -1, a = [], u = [];
  for (t = t + "", e = e + ""; (r = yi.exec(t)) && (i = ei.exec(e)); )
    (o = i.index) > n && (o = e.slice(n, o), a[s] ? a[s] += o : a[++s] = o), (r = r[0]) === (i = i[0]) ? a[s] ? a[s] += i : a[++s] = i : (a[++s] = null, u.push({ i: s, x: Pe(r, i) })), n = ei.lastIndex;
  return n < e.length && (o = e.slice(n), a[s] ? a[s] += o : a[++s] = o), a.length < 2 ? u[0] ? jh(u[0].x) : Qh(e) : (e = u.length, function(f) {
    for (var c = 0, d; c < e; ++c) a[(d = u[c]).i] = d.x(f);
    return a.join("");
  });
}
var Io = 180 / Math.PI, wi = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function ra(t, e, n, r, i, o) {
  var s, a, u;
  return (s = Math.sqrt(t * t + e * e)) && (t /= s, e /= s), (u = t * n + e * r) && (n -= t * u, r -= e * u), (a = Math.sqrt(n * n + r * r)) && (n /= a, r /= a, u /= a), t * r < e * n && (t = -t, e = -e, u = -u, s = -s), {
    translateX: i,
    translateY: o,
    rotate: Math.atan2(e, t) * Io,
    skewX: Math.atan(u) * Io,
    scaleX: s,
    scaleY: a
  };
}
var _r;
function td(t) {
  const e = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(t + "");
  return e.isIdentity ? wi : ra(e.a, e.b, e.c, e.d, e.e, e.f);
}
function ed(t) {
  return t == null || (_r || (_r = document.createElementNS("http://www.w3.org/2000/svg", "g")), _r.setAttribute("transform", t), !(t = _r.transform.baseVal.consolidate())) ? wi : (t = t.matrix, ra(t.a, t.b, t.c, t.d, t.e, t.f));
}
function ia(t, e, n, r) {
  function i(f) {
    return f.length ? f.pop() + " " : "";
  }
  function o(f, c, d, h, g, _) {
    if (f !== d || c !== h) {
      var k = g.push("translate(", null, e, null, n);
      _.push({ i: k - 4, x: Pe(f, d) }, { i: k - 2, x: Pe(c, h) });
    } else (d || h) && g.push("translate(" + d + e + h + n);
  }
  function s(f, c, d, h) {
    f !== c ? (f - c > 180 ? c += 360 : c - f > 180 && (f += 360), h.push({ i: d.push(i(d) + "rotate(", null, r) - 2, x: Pe(f, c) })) : c && d.push(i(d) + "rotate(" + c + r);
  }
  function a(f, c, d, h) {
    f !== c ? h.push({ i: d.push(i(d) + "skewX(", null, r) - 2, x: Pe(f, c) }) : c && d.push(i(d) + "skewX(" + c + r);
  }
  function u(f, c, d, h, g, _) {
    if (f !== d || c !== h) {
      var k = g.push(i(g) + "scale(", null, ",", null, ")");
      _.push({ i: k - 4, x: Pe(f, d) }, { i: k - 2, x: Pe(c, h) });
    } else (d !== 1 || h !== 1) && g.push(i(g) + "scale(" + d + "," + h + ")");
  }
  return function(f, c) {
    var d = [], h = [];
    return f = t(f), c = t(c), o(f.translateX, f.translateY, c.translateX, c.translateY, d, h), s(f.rotate, c.rotate, d, h), a(f.skewX, c.skewX, d, h), u(f.scaleX, f.scaleY, c.scaleX, c.scaleY, d, h), f = c = null, function(g) {
      for (var _ = -1, k = h.length, M; ++_ < k; ) d[(M = h[_]).i] = M.x(g);
      return d.join("");
    };
  };
}
var nd = ia(td, "px, ", "px)", "deg)"), rd = ia(ed, ", ", ")", ")"), id = 1e-12;
function Po(t) {
  return ((t = Math.exp(t)) + 1 / t) / 2;
}
function od(t) {
  return ((t = Math.exp(t)) - 1 / t) / 2;
}
function sd(t) {
  return ((t = Math.exp(2 * t)) - 1) / (t + 1);
}
const ad = (function t(e, n, r) {
  function i(o, s) {
    var a = o[0], u = o[1], f = o[2], c = s[0], d = s[1], h = s[2], g = c - a, _ = d - u, k = g * g + _ * _, M, S;
    if (k < id)
      S = Math.log(h / f) / e, M = function(A) {
        return [
          a + A * g,
          u + A * _,
          f * Math.exp(e * A * S)
        ];
      };
    else {
      var Y = Math.sqrt(k), P = (h * h - f * f + r * k) / (2 * f * n * Y), b = (h * h - f * f - r * k) / (2 * h * n * Y), T = Math.log(Math.sqrt(P * P + 1) - P), E = Math.log(Math.sqrt(b * b + 1) - b);
      S = (E - T) / e, M = function(A) {
        var H = A * S, R = Po(T), L = f / (n * Y) * (R * sd(e * H + T) - od(T));
        return [
          a + L * g,
          u + L * _,
          f * R / Po(e * H + T)
        ];
      };
    }
    return M.duration = S * 1e3 * e / Math.SQRT2, M;
  }
  return i.rho = function(o) {
    var s = Math.max(1e-3, +o), a = s * s, u = a * a;
    return t(s, a, u);
  }, i;
})(Math.SQRT2, 2, 4);
var Rn = 0, Vn = 0, On = 0, oa = 1e3, Lr, Xn, Or = 0, rn = 0, Wr = 0, nr = typeof performance == "object" && performance.now ? performance : Date, sa = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(t) {
  setTimeout(t, 17);
};
function Xi() {
  return rn || (sa(ld), rn = nr.now() + Wr);
}
function ld() {
  rn = 0;
}
function Dr() {
  this._call = this._time = this._next = null;
}
Dr.prototype = aa.prototype = {
  constructor: Dr,
  restart: function(t, e, n) {
    if (typeof t != "function") throw new TypeError("callback is not a function");
    n = (n == null ? Xi() : +n) + (e == null ? 0 : +e), !this._next && Xn !== this && (Xn ? Xn._next = this : Lr = this, Xn = this), this._call = t, this._time = n, xi();
  },
  stop: function() {
    this._call && (this._call = null, this._time = 1 / 0, xi());
  }
};
function aa(t, e, n) {
  var r = new Dr();
  return r.restart(t, e, n), r;
}
function ud() {
  Xi(), ++Rn;
  for (var t = Lr, e; t; )
    (e = rn - t._time) >= 0 && t._call.call(void 0, e), t = t._next;
  --Rn;
}
function zo() {
  rn = (Or = nr.now()) + Wr, Rn = Vn = 0;
  try {
    ud();
  } finally {
    Rn = 0, cd(), rn = 0;
  }
}
function fd() {
  var t = nr.now(), e = t - Or;
  e > oa && (Wr -= e, Or = t);
}
function cd() {
  for (var t, e = Lr, n, r = 1 / 0; e; )
    e._call ? (r > e._time && (r = e._time), t = e, e = e._next) : (n = e._next, e._next = null, e = t ? t._next = n : Lr = n);
  Xn = t, xi(r);
}
function xi(t) {
  if (!Rn) {
    Vn && (Vn = clearTimeout(Vn));
    var e = t - rn;
    e > 24 ? (t < 1 / 0 && (Vn = setTimeout(zo, t - nr.now() - Wr)), On && (On = clearInterval(On))) : (On || (Or = nr.now(), On = setInterval(fd, oa)), Rn = 1, sa(zo));
  }
}
function To(t, e, n) {
  var r = new Dr();
  return e = e == null ? 0 : +e, r.restart((i) => {
    r.stop(), t(i + e);
  }, e, n), r;
}
var hd = Ur("start", "end", "cancel", "interrupt"), dd = [], la = 0, Co = 1, bi = 2, Sr = 3, Ro = 4, ki = 5, Nr = 6;
function Kr(t, e, n, r, i, o) {
  var s = t.__transition;
  if (!s) t.__transition = {};
  else if (n in s) return;
  gd(t, n, {
    name: e,
    index: r,
    // For context during callback.
    group: i,
    // For context during callback.
    on: hd,
    tween: dd,
    time: o.time,
    delay: o.delay,
    duration: o.duration,
    ease: o.ease,
    timer: null,
    state: la
  });
}
function qi(t, e) {
  var n = te(t, e);
  if (n.state > la) throw new Error("too late; already scheduled");
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
function gd(t, e, n) {
  var r = t.__transition, i;
  r[e] = n, n.timer = aa(o, 0, n.time);
  function o(f) {
    n.state = Co, n.timer.restart(s, n.delay, n.time), n.delay <= f && s(f - n.delay);
  }
  function s(f) {
    var c, d, h, g;
    if (n.state !== Co) return u();
    for (c in r)
      if (g = r[c], g.name === n.name) {
        if (g.state === Sr) return To(s);
        g.state === Ro ? (g.state = Nr, g.timer.stop(), g.on.call("interrupt", t, t.__data__, g.index, g.group), delete r[c]) : +c < e && (g.state = Nr, g.timer.stop(), g.on.call("cancel", t, t.__data__, g.index, g.group), delete r[c]);
      }
    if (To(function() {
      n.state === Sr && (n.state = Ro, n.timer.restart(a, n.delay, n.time), a(f));
    }), n.state = bi, n.on.call("start", t, t.__data__, n.index, n.group), n.state === bi) {
      for (n.state = Sr, i = new Array(h = n.tween.length), c = 0, d = -1; c < h; ++c)
        (g = n.tween[c].value.call(t, t.__data__, n.index, n.group)) && (i[++d] = g);
      i.length = d + 1;
    }
  }
  function a(f) {
    for (var c = f < n.duration ? n.ease.call(null, f / n.duration) : (n.timer.restart(u), n.state = ki, 1), d = -1, h = i.length; ++d < h; )
      i[d].call(t, c);
    n.state === ki && (n.on.call("end", t, t.__data__, n.index, n.group), u());
  }
  function u() {
    n.state = Nr, n.timer.stop(), delete r[e];
    for (var f in r) return;
    delete t.__transition;
  }
}
function Ar(t, e) {
  var n = t.__transition, r, i, o = !0, s;
  if (n) {
    e = e == null ? null : e + "";
    for (s in n) {
      if ((r = n[s]).name !== e) {
        o = !1;
        continue;
      }
      i = r.state > bi && r.state < ki, r.state = Nr, r.timer.stop(), r.on.call(i ? "interrupt" : "cancel", t, t.__data__, r.index, r.group), delete n[s];
    }
    o && delete t.__transition;
  }
}
function vd(t) {
  return this.each(function() {
    Ar(this, t);
  });
}
function md(t, e) {
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
function pd(t, e, n) {
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
function _d(t, e) {
  var n = this._id;
  if (t += "", arguments.length < 2) {
    for (var r = te(this.node(), n).tween, i = 0, o = r.length, s; i < o; ++i)
      if ((s = r[i]).name === t)
        return s.value;
    return null;
  }
  return this.each((e == null ? md : pd)(n, t, e));
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
function ua(t, e) {
  var n;
  return (typeof e == "number" ? Pe : e instanceof er ? Mo : (n = er(e)) ? (e = n, Mo) : $h)(t, e);
}
function yd(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function wd(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function xd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttribute(t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function bd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttributeNS(t.space, t.local);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function kd(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttribute(t) : (s = this.getAttribute(t), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function Ed(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttributeNS(t.space, t.local) : (s = this.getAttributeNS(t.space, t.local), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function Sd(t, e) {
  var n = Gr(t), r = n === "transform" ? rd : ua;
  return this.attrTween(t, typeof e == "function" ? (n.local ? Ed : kd)(n, r, Ui(this, "attr." + t, e)) : e == null ? (n.local ? wd : yd)(n) : (n.local ? bd : xd)(n, r, e));
}
function Nd(t, e) {
  return function(n) {
    this.setAttribute(t, e.call(this, n));
  };
}
function Ad(t, e) {
  return function(n) {
    this.setAttributeNS(t.space, t.local, e.call(this, n));
  };
}
function Md(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && Ad(t, o)), n;
  }
  return i._value = e, i;
}
function Id(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && Nd(t, o)), n;
  }
  return i._value = e, i;
}
function Pd(t, e) {
  var n = "attr." + t;
  if (arguments.length < 2) return (n = this.tween(n)) && n._value;
  if (e == null) return this.tween(n, null);
  if (typeof e != "function") throw new Error();
  var r = Gr(t);
  return this.tween(n, (r.local ? Md : Id)(r, e));
}
function zd(t, e) {
  return function() {
    qi(this, t).delay = +e.apply(this, arguments);
  };
}
function Td(t, e) {
  return e = +e, function() {
    qi(this, t).delay = e;
  };
}
function Cd(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? zd : Td)(e, t)) : te(this.node(), e).delay;
}
function Rd(t, e) {
  return function() {
    fe(this, t).duration = +e.apply(this, arguments);
  };
}
function Fd(t, e) {
  return e = +e, function() {
    fe(this, t).duration = e;
  };
}
function Ld(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Rd : Fd)(e, t)) : te(this.node(), e).duration;
}
function Od(t, e) {
  if (typeof e != "function") throw new Error();
  return function() {
    fe(this, t).ease = e;
  };
}
function Dd(t) {
  var e = this._id;
  return arguments.length ? this.each(Od(e, t)) : te(this.node(), e).ease;
}
function Yd(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    if (typeof n != "function") throw new Error();
    fe(this, t).ease = n;
  };
}
function Hd(t) {
  if (typeof t != "function") throw new Error();
  return this.each(Yd(this._id, t));
}
function Bd(t) {
  typeof t != "function" && (t = Bs(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new xe(r, this._parents, this._name, this._id);
}
function Vd(t) {
  if (t._id !== this._id) throw new Error();
  for (var e = this._groups, n = t._groups, r = e.length, i = n.length, o = Math.min(r, i), s = new Array(r), a = 0; a < o; ++a)
    for (var u = e[a], f = n[a], c = u.length, d = s[a] = new Array(c), h, g = 0; g < c; ++g)
      (h = u[g] || f[g]) && (d[g] = h);
  for (; a < r; ++a)
    s[a] = e[a];
  return new xe(s, this._parents, this._name, this._id);
}
function Xd(t) {
  return (t + "").trim().split(/^|\s+/).every(function(e) {
    var n = e.indexOf(".");
    return n >= 0 && (e = e.slice(0, n)), !e || e === "start";
  });
}
function qd(t, e, n) {
  var r, i, o = Xd(e) ? qi : fe;
  return function() {
    var s = o(this, t), a = s.on;
    a !== r && (i = (r = a).copy()).on(e, n), s.on = i;
  };
}
function Ud(t, e) {
  var n = this._id;
  return arguments.length < 2 ? te(this.node(), n).on.on(t) : this.each(qd(n, t, e));
}
function Gd(t) {
  return function() {
    var e = this.parentNode;
    for (var n in this.__transition) if (+n !== t) return;
    e && e.removeChild(this);
  };
}
function Wd() {
  return this.on("end.remove", Gd(this._id));
}
function Kd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Hi(t));
  for (var r = this._groups, i = r.length, o = new Array(i), s = 0; s < i; ++s)
    for (var a = r[s], u = a.length, f = o[s] = new Array(u), c, d, h = 0; h < u; ++h)
      (c = a[h]) && (d = t.call(c, c.__data__, h, a)) && ("__data__" in c && (d.__data__ = c.__data__), f[h] = d, Kr(f[h], e, n, h, f, te(c, n)));
  return new xe(o, this._parents, e, n);
}
function Zd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Hs(t));
  for (var r = this._groups, i = r.length, o = [], s = [], a = 0; a < i; ++a)
    for (var u = r[a], f = u.length, c, d = 0; d < f; ++d)
      if (c = u[d]) {
        for (var h = t.call(c, c.__data__, d, u), g, _ = te(c, n), k = 0, M = h.length; k < M; ++k)
          (g = h[k]) && Kr(g, e, n, k, h, _);
        o.push(h), s.push(c);
      }
  return new xe(o, s, e, n);
}
var Jd = ur.prototype.constructor;
function Qd() {
  return new Jd(this._groups, this._parents);
}
function jd(t, e) {
  var n, r, i;
  return function() {
    var o = Cn(this, t), s = (this.style.removeProperty(t), Cn(this, t));
    return o === s ? null : o === n && s === r ? i : i = e(n = o, r = s);
  };
}
function fa(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function $d(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = Cn(this, t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function t0(t, e, n) {
  var r, i, o;
  return function() {
    var s = Cn(this, t), a = n(this), u = a + "";
    return a == null && (u = a = (this.style.removeProperty(t), Cn(this, t))), s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a));
  };
}
function e0(t, e) {
  var n, r, i, o = "style." + e, s = "end." + o, a;
  return function() {
    var u = fe(this, t), f = u.on, c = u.value[o] == null ? a || (a = fa(e)) : void 0;
    (f !== n || i !== c) && (r = (n = f).copy()).on(s, i = c), u.on = r;
  };
}
function n0(t, e, n) {
  var r = (t += "") == "transform" ? nd : ua;
  return e == null ? this.styleTween(t, jd(t, r)).on("end.style." + t, fa(t)) : typeof e == "function" ? this.styleTween(t, t0(t, r, Ui(this, "style." + t, e))).each(e0(this._id, t)) : this.styleTween(t, $d(t, r, e), n).on("end.style." + t, null);
}
function r0(t, e, n) {
  return function(r) {
    this.style.setProperty(t, e.call(this, r), n);
  };
}
function i0(t, e, n) {
  var r, i;
  function o() {
    var s = e.apply(this, arguments);
    return s !== i && (r = (i = s) && r0(t, s, n)), r;
  }
  return o._value = e, o;
}
function o0(t, e, n) {
  var r = "style." + (t += "");
  if (arguments.length < 2) return (r = this.tween(r)) && r._value;
  if (e == null) return this.tween(r, null);
  if (typeof e != "function") throw new Error();
  return this.tween(r, i0(t, e, n ?? ""));
}
function s0(t) {
  return function() {
    this.textContent = t;
  };
}
function a0(t) {
  return function() {
    var e = t(this);
    this.textContent = e ?? "";
  };
}
function l0(t) {
  return this.tween("text", typeof t == "function" ? a0(Ui(this, "text", t)) : s0(t == null ? "" : t + ""));
}
function u0(t) {
  return function(e) {
    this.textContent = t.call(this, e);
  };
}
function f0(t) {
  var e, n;
  function r() {
    var i = t.apply(this, arguments);
    return i !== n && (e = (n = i) && u0(i)), e;
  }
  return r._value = t, r;
}
function c0(t) {
  var e = "text";
  if (arguments.length < 1) return (e = this.tween(e)) && e._value;
  if (t == null) return this.tween(e, null);
  if (typeof t != "function") throw new Error();
  return this.tween(e, f0(t));
}
function h0() {
  for (var t = this._name, e = this._id, n = ca(), r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, f = 0; f < a; ++f)
      if (u = s[f]) {
        var c = te(u, e);
        Kr(u, t, n, f, s, {
          time: c.time + c.delay + c.duration,
          delay: 0,
          duration: c.duration,
          ease: c.ease
        });
      }
  return new xe(r, this._parents, t, n);
}
function d0() {
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
var g0 = 0;
function xe(t, e, n, r) {
  this._groups = t, this._parents = e, this._name = n, this._id = r;
}
function ca() {
  return ++g0;
}
var de = ur.prototype;
xe.prototype = {
  constructor: xe,
  select: Kd,
  selectAll: Zd,
  selectChild: de.selectChild,
  selectChildren: de.selectChildren,
  filter: Bd,
  merge: Vd,
  selection: Qd,
  transition: h0,
  call: de.call,
  nodes: de.nodes,
  node: de.node,
  size: de.size,
  empty: de.empty,
  each: de.each,
  on: Ud,
  attr: Sd,
  attrTween: Pd,
  style: n0,
  styleTween: o0,
  text: l0,
  textTween: c0,
  remove: Wd,
  tween: _d,
  delay: Cd,
  duration: Ld,
  ease: Dd,
  easeVarying: Hd,
  end: d0,
  [Symbol.iterator]: de[Symbol.iterator]
};
function v0(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}
var m0 = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: v0
};
function p0(t, e) {
  for (var n; !(n = t.__transition) || !(n = n[e]); )
    if (!(t = t.parentNode))
      throw new Error(`transition ${e} not found`);
  return n;
}
function _0(t) {
  var e, n;
  t instanceof xe ? (e = t._id, t = t._name) : (e = ca(), (n = m0).time = Xi(), t = t == null ? null : t + "");
  for (var r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && Kr(u, t, e, f, s, n || p0(u, e));
  return new xe(r, this._parents, t, e);
}
ur.prototype.interrupt = vd;
ur.prototype.transition = _0;
const yr = (t) => () => t;
function y0(t, {
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
var ha = new _e(1, 0, 0);
_e.prototype;
function ni(t) {
  t.stopImmediatePropagation();
}
function Dn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function w0(t) {
  return (!t.ctrlKey || t.type === "wheel") && !t.button;
}
function x0() {
  var t = this;
  return t instanceof SVGElement ? (t = t.ownerSVGElement || t, t.hasAttribute("viewBox") ? (t = t.viewBox.baseVal, [[t.x, t.y], [t.x + t.width, t.y + t.height]]) : [[0, 0], [t.width.baseVal.value, t.height.baseVal.value]]) : [[0, 0], [t.clientWidth, t.clientHeight]];
}
function Fo() {
  return this.__zoom || ha;
}
function b0(t) {
  return -t.deltaY * (t.deltaMode === 1 ? 0.05 : t.deltaMode ? 1 : 2e-3) * (t.ctrlKey ? 10 : 1);
}
function k0() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function E0(t, e, n) {
  var r = t.invertX(e[0][0]) - n[0][0], i = t.invertX(e[1][0]) - n[1][0], o = t.invertY(e[0][1]) - n[0][1], s = t.invertY(e[1][1]) - n[1][1];
  return t.translate(
    i > r ? (r + i) / 2 : Math.min(0, r) || Math.max(0, i),
    s > o ? (o + s) / 2 : Math.min(0, o) || Math.max(0, s)
  );
}
function S0() {
  var t = w0, e = x0, n = E0, r = b0, i = k0, o = [0, 1 / 0], s = [[-1 / 0, -1 / 0], [1 / 0, 1 / 0]], a = 250, u = ad, f = Ur("start", "zoom", "end"), c, d, h, g = 500, _ = 150, k = 0, M = 10;
  function S(v) {
    v.property("__zoom", Fo).on("wheel.zoom", H, { passive: !1 }).on("mousedown.zoom", R).on("dblclick.zoom", L).filter(i).on("touchstart.zoom", X).on("touchmove.zoom", z).on("touchend.zoom touchcancel.zoom", U).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  S.transform = function(v, w, p, x) {
    var N = v.selection ? v.selection() : v;
    N.property("__zoom", Fo), v !== N ? T(v, w, p, x) : N.interrupt().each(function() {
      E(this, arguments).event(x).start().zoom(null, typeof w == "function" ? w.apply(this, arguments) : w).end();
    });
  }, S.scaleBy = function(v, w, p, x) {
    S.scaleTo(v, function() {
      var N = this.__zoom.k, I = typeof w == "function" ? w.apply(this, arguments) : w;
      return N * I;
    }, p, x);
  }, S.scaleTo = function(v, w, p, x) {
    S.transform(v, function() {
      var N = e.apply(this, arguments), I = this.__zoom, F = p == null ? b(N) : typeof p == "function" ? p.apply(this, arguments) : p, B = I.invert(F), q = typeof w == "function" ? w.apply(this, arguments) : w;
      return n(P(Y(I, q), F, B), N, s);
    }, p, x);
  }, S.translateBy = function(v, w, p, x) {
    S.transform(v, function() {
      return n(this.__zoom.translate(
        typeof w == "function" ? w.apply(this, arguments) : w,
        typeof p == "function" ? p.apply(this, arguments) : p
      ), e.apply(this, arguments), s);
    }, null, x);
  }, S.translateTo = function(v, w, p, x, N) {
    S.transform(v, function() {
      var I = e.apply(this, arguments), F = this.__zoom, B = x == null ? b(I) : typeof x == "function" ? x.apply(this, arguments) : x;
      return n(ha.translate(B[0], B[1]).scale(F.k).translate(
        typeof w == "function" ? -w.apply(this, arguments) : -w,
        typeof p == "function" ? -p.apply(this, arguments) : -p
      ), I, s);
    }, x, N);
  };
  function Y(v, w) {
    return w = Math.max(o[0], Math.min(o[1], w)), w === v.k ? v : new _e(w, v.x, v.y);
  }
  function P(v, w, p) {
    var x = w[0] - p[0] * v.k, N = w[1] - p[1] * v.k;
    return x === v.x && N === v.y ? v : new _e(v.k, x, N);
  }
  function b(v) {
    return [(+v[0][0] + +v[1][0]) / 2, (+v[0][1] + +v[1][1]) / 2];
  }
  function T(v, w, p, x) {
    v.on("start.zoom", function() {
      E(this, arguments).event(x).start();
    }).on("interrupt.zoom end.zoom", function() {
      E(this, arguments).event(x).end();
    }).tween("zoom", function() {
      var N = this, I = arguments, F = E(N, I).event(x), B = e.apply(N, I), q = p == null ? b(B) : typeof p == "function" ? p.apply(N, I) : p, $ = Math.max(B[1][0] - B[0][0], B[1][1] - B[0][1]), j = N.__zoom, it = typeof w == "function" ? w.apply(N, I) : w, at = u(j.invert(q).concat($ / j.k), it.invert(q).concat($ / it.k));
      return function(C) {
        if (C === 1) C = it;
        else {
          var D = at(C), Q = $ / D[2];
          C = new _e(Q, q[0] - D[0] * Q, q[1] - D[1] * Q);
        }
        F.zoom(null, C);
      };
    });
  }
  function E(v, w, p) {
    return !p && v.__zooming || new A(v, w);
  }
  function A(v, w) {
    this.that = v, this.args = w, this.active = 0, this.sourceEvent = null, this.extent = e.apply(v, w), this.taps = 0;
  }
  A.prototype = {
    event: function(v) {
      return v && (this.sourceEvent = v), this;
    },
    start: function() {
      return ++this.active === 1 && (this.that.__zooming = this, this.emit("start")), this;
    },
    zoom: function(v, w) {
      return this.mouse && v !== "mouse" && (this.mouse[1] = w.invert(this.mouse[0])), this.touch0 && v !== "touch" && (this.touch0[1] = w.invert(this.touch0[0])), this.touch1 && v !== "touch" && (this.touch1[1] = w.invert(this.touch1[0])), this.that.__zoom = w, this.emit("zoom"), this;
    },
    end: function() {
      return --this.active === 0 && (delete this.that.__zooming, this.emit("end")), this;
    },
    emit: function(v) {
      var w = Pt(this.that).datum();
      f.call(
        v,
        this.that,
        new y0(v, {
          sourceEvent: this.sourceEvent,
          target: S,
          transform: this.that.__zoom,
          dispatch: f
        }),
        w
      );
    }
  };
  function H(v, ...w) {
    if (!t.apply(this, arguments)) return;
    var p = E(this, w).event(v), x = this.__zoom, N = Math.max(o[0], Math.min(o[1], x.k * Math.pow(2, r.apply(this, arguments)))), I = ve(v);
    if (p.wheel)
      (p.mouse[0][0] !== I[0] || p.mouse[0][1] !== I[1]) && (p.mouse[1] = x.invert(p.mouse[0] = I)), clearTimeout(p.wheel);
    else {
      if (x.k === N) return;
      p.mouse = [I, x.invert(I)], Ar(this), p.start();
    }
    Dn(v), p.wheel = setTimeout(F, _), p.zoom("mouse", n(P(Y(x, N), p.mouse[0], p.mouse[1]), p.extent, s));
    function F() {
      p.wheel = null, p.end();
    }
  }
  function R(v, ...w) {
    if (h || !t.apply(this, arguments)) return;
    var p = v.currentTarget, x = E(this, w, !0).event(v), N = Pt(v.view).on("mousemove.zoom", q, !0).on("mouseup.zoom", $, !0), I = ve(v, p), F = v.clientX, B = v.clientY;
    Qs(v.view), ni(v), x.mouse = [I, this.__zoom.invert(I)], Ar(this), x.start();
    function q(j) {
      if (Dn(j), !x.moved) {
        var it = j.clientX - F, at = j.clientY - B;
        x.moved = it * it + at * at > k;
      }
      x.event(j).zoom("mouse", n(P(x.that.__zoom, x.mouse[0] = ve(j, p), x.mouse[1]), x.extent, s));
    }
    function $(j) {
      N.on("mousemove.zoom mouseup.zoom", null), js(j.view, x.moved), Dn(j), x.event(j).end();
    }
  }
  function L(v, ...w) {
    if (t.apply(this, arguments)) {
      var p = this.__zoom, x = ve(v.changedTouches ? v.changedTouches[0] : v, this), N = p.invert(x), I = p.k * (v.shiftKey ? 0.5 : 2), F = n(P(Y(p, I), x, N), e.apply(this, w), s);
      Dn(v), a > 0 ? Pt(this).transition().duration(a).call(T, F, x, v) : Pt(this).call(S.transform, F, x, v);
    }
  }
  function X(v, ...w) {
    if (t.apply(this, arguments)) {
      var p = v.touches, x = p.length, N = E(this, w, v.changedTouches.length === x).event(v), I, F, B, q;
      for (ni(v), F = 0; F < x; ++F)
        B = p[F], q = ve(B, this), q = [q, this.__zoom.invert(q), B.identifier], N.touch0 ? !N.touch1 && N.touch0[2] !== q[2] && (N.touch1 = q, N.taps = 0) : (N.touch0 = q, I = !0, N.taps = 1 + !!c);
      c && (c = clearTimeout(c)), I && (N.taps < 2 && (d = q[0], c = setTimeout(function() {
        c = null;
      }, g)), Ar(this), N.start());
    }
  }
  function z(v, ...w) {
    if (this.__zooming) {
      var p = E(this, w).event(v), x = v.changedTouches, N = x.length, I, F, B, q;
      for (Dn(v), I = 0; I < N; ++I)
        F = x[I], B = ve(F, this), p.touch0 && p.touch0[2] === F.identifier ? p.touch0[0] = B : p.touch1 && p.touch1[2] === F.identifier && (p.touch1[0] = B);
      if (F = p.that.__zoom, p.touch1) {
        var $ = p.touch0[0], j = p.touch0[1], it = p.touch1[0], at = p.touch1[1], C = (C = it[0] - $[0]) * C + (C = it[1] - $[1]) * C, D = (D = at[0] - j[0]) * D + (D = at[1] - j[1]) * D;
        F = Y(F, Math.sqrt(C / D)), B = [($[0] + it[0]) / 2, ($[1] + it[1]) / 2], q = [(j[0] + at[0]) / 2, (j[1] + at[1]) / 2];
      } else if (p.touch0) B = p.touch0[0], q = p.touch0[1];
      else return;
      p.zoom("touch", n(P(F, B, q), p.extent, s));
    }
  }
  function U(v, ...w) {
    if (this.__zooming) {
      var p = E(this, w).event(v), x = v.changedTouches, N = x.length, I, F;
      for (ni(v), h && clearTimeout(h), h = setTimeout(function() {
        h = null;
      }, g), I = 0; I < N; ++I)
        F = x[I], p.touch0 && p.touch0[2] === F.identifier ? delete p.touch0 : p.touch1 && p.touch1[2] === F.identifier && delete p.touch1;
      if (p.touch1 && !p.touch0 && (p.touch0 = p.touch1, delete p.touch1), p.touch0) p.touch0[1] = this.__zoom.invert(p.touch0[0]);
      else if (p.end(), p.taps === 2 && (F = ve(F, this), Math.hypot(d[0] - F[0], d[1] - F[1]) < M)) {
        var B = Pt(this).on("dblclick.zoom");
        B && B.apply(this, arguments);
      }
    }
  }
  return S.wheelDelta = function(v) {
    return arguments.length ? (r = typeof v == "function" ? v : yr(+v), S) : r;
  }, S.filter = function(v) {
    return arguments.length ? (t = typeof v == "function" ? v : yr(!!v), S) : t;
  }, S.touchable = function(v) {
    return arguments.length ? (i = typeof v == "function" ? v : yr(!!v), S) : i;
  }, S.extent = function(v) {
    return arguments.length ? (e = typeof v == "function" ? v : yr([[+v[0][0], +v[0][1]], [+v[1][0], +v[1][1]]]), S) : e;
  }, S.scaleExtent = function(v) {
    return arguments.length ? (o[0] = +v[0], o[1] = +v[1], S) : [o[0], o[1]];
  }, S.translateExtent = function(v) {
    return arguments.length ? (s[0][0] = +v[0][0], s[1][0] = +v[1][0], s[0][1] = +v[0][1], s[1][1] = +v[1][1], S) : [[s[0][0], s[0][1]], [s[1][0], s[1][1]]];
  }, S.constrain = function(v) {
    return arguments.length ? (n = v, S) : n;
  }, S.duration = function(v) {
    return arguments.length ? (a = +v, S) : a;
  }, S.interpolate = function(v) {
    return arguments.length ? (u = v, S) : u;
  }, S.on = function() {
    var v = f.on.apply(f, arguments);
    return v === f ? S : v;
  }, S.clickDistance = function(v) {
    return arguments.length ? (k = (v = +v) * v, S) : Math.sqrt(k);
  }, S.tapDistance = function(v) {
    return arguments.length ? (M = +v, S) : M;
  }, S;
}
function N0(t) {
  if (t.length === 0) return "";
  const [e, ...n] = t;
  if (!e) return "";
  let r = `M ${e.x} ${e.y}`;
  for (const i of n)
    r += ` L ${i.x} ${i.y}`;
  return r;
}
const Yn = 12;
function A0(t) {
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
const Lo = [
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
  return Lo[e % Lo.length];
}
var I0 = /* @__PURE__ */ rt('<path fill="none" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke="white" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke-linecap="round" pointer-events="none"></path>', 1), P0 = /* @__PURE__ */ rt('<path class="link" fill="none" stroke-linecap="round" pointer-events="none"></path>'), z0 = /* @__PURE__ */ rt('<text class="link-label" text-anchor="middle"> </text>'), T0 = /* @__PURE__ */ rt('<text class="link-label" text-anchor="middle"> </text>'), C0 = /* @__PURE__ */ rt("<!><!>", 1), R0 = /* @__PURE__ */ rt('<g class="link-group"><!><path fill="none" stroke="transparent" stroke-linecap="round"></path><!></g>');
function F0(t, e) {
  sn(e, !0);
  let n = yt(e, "selected", 3, !1), r = yt(e, "interactive", 3, !1);
  const i = /* @__PURE__ */ O(() => N0(e.edge.points)), o = /* @__PURE__ */ O(() => e.edge.link), s = /* @__PURE__ */ O(() => {
    var E;
    return ((E = l(o)) == null ? void 0 : E.type) ?? "solid";
  }), a = /* @__PURE__ */ O(() => () => {
    var E, A;
    switch (l(s)) {
      case "dashed":
        return "5 3";
      default:
        return ((A = (E = l(o)) == null ? void 0 : E.style) == null ? void 0 : A.strokeDasharray) ?? "";
    }
  }), u = /* @__PURE__ */ O(() => {
    var E, A, H;
    return n() ? e.colors.selection : ((A = (E = l(o)) == null ? void 0 : E.style) == null ? void 0 : A.stroke) ?? M0((H = l(o)) == null ? void 0 : H.vlan) ?? e.colors.linkStroke;
  }), f = /* @__PURE__ */ O(() => l(s) === "double"), c = /* @__PURE__ */ O(() => () => {
    var A;
    return (A = l(o)) != null && A.label ? [Array.isArray(l(o).label) ? l(o).label.join(" / ") : l(o).label] : [];
  }), d = /* @__PURE__ */ O(() => () => {
    var E;
    return !((E = l(o)) != null && E.vlan) || l(o).vlan.length === 0 ? "" : l(o).vlan.length === 1 ? `VLAN ${l(o).vlan[0]}` : `VLAN ${l(o).vlan.join(", ")}`;
  }), h = /* @__PURE__ */ O(() => () => {
    if (e.edge.points.length < 2) return null;
    const E = Math.floor(e.edge.points.length / 2), A = e.edge.points[E - 1], H = e.edge.points[E];
    return !A || !H ? null : { x: (A.x + H.x) / 2, y: (A.y + H.y) / 2 };
  });
  function g(E) {
    var A;
    r() && (E.stopPropagation(), (A = e.onselect) == null || A.call(e, e.edge.id));
  }
  function _(E) {
    var A, H;
    r() && (E.preventDefault(), E.stopPropagation(), (A = e.onselect) == null || A.call(e, e.edge.id), (H = e.oncontextmenu) == null || H.call(e, e.edge.id, E));
  }
  var k = R0(), M = dt(k);
  {
    var S = (E) => {
      const A = /* @__PURE__ */ O(() => Math.max(3, Math.round(e.edge.width * 0.9)));
      var H = I0(), R = Mt(H), L = tt(R), X = tt(L);
      ot(
        (z, U) => {
          m(R, "d", l(i)), m(R, "stroke", l(u)), m(R, "stroke-width", e.edge.width + l(A) * 2), m(L, "d", l(i)), m(L, "stroke-width", z), m(X, "d", l(i)), m(X, "stroke", l(u)), m(X, "stroke-width", U);
        },
        [
          () => Math.max(1, e.edge.width),
          () => Math.max(1, e.edge.width - Math.round(l(A) * 0.8))
        ]
      ), W(E, H);
    }, Y = (E) => {
      var A = P0();
      ot(
        (H) => {
          m(A, "d", l(i)), m(A, "stroke", l(u)), m(A, "stroke-width", e.edge.width), m(A, "stroke-dasharray", H);
        },
        [() => l(a)() || void 0]
      ), W(E, A);
    };
    ht(M, (E) => {
      l(f) ? E(S) : E(Y, !1);
    });
  }
  var P = tt(M);
  P.__click = g, P.__contextmenu = _;
  var b = tt(P);
  {
    var T = (E) => {
      const A = /* @__PURE__ */ O(() => l(h)());
      var H = ge(), R = Mt(H);
      {
        var L = (X) => {
          const z = /* @__PURE__ */ O(() => l(c)()), U = /* @__PURE__ */ O(() => l(d)());
          var v = C0(), w = Mt(v);
          Be(w, 17, () => l(z), Ss, (N, I, F) => {
            var B = z0(), q = dt(B);
            ot(() => {
              m(B, "x", l(A).x), m(B, "y", l(A).y - 8 + F * 12), Jn(q, l(I));
            }), W(N, B);
          });
          var p = tt(w);
          {
            var x = (N) => {
              var I = T0(), F = dt(I);
              ot(() => {
                m(I, "x", l(A).x), m(I, "y", l(A).y - 8 + l(z).length * 12), Jn(F, l(U));
              }), W(N, I);
            };
            ht(p, (N) => {
              l(U) && N(x);
            });
          }
          W(X, v);
        };
        ht(R, (X) => {
          l(A) && X(L);
        });
      }
      W(E, H);
    };
    ht(b, (E) => {
      l(h)() && E(T);
    });
  }
  ot(
    (E) => {
      m(k, "data-link-id", e.edge.id), m(P, "d", l(i)), m(P, "stroke-width", E), qr(P, `pointer-events: ${r() ? "stroke" : "none"}; cursor: pointer;`);
    },
    [() => Math.max(e.edge.width + 12, 16)]
  ), W(t, k), an();
}
lr(["click", "contextmenu"]);
var L0 = /* @__PURE__ */ rt('<line stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"></line>');
function O0(t, e) {
  var n = L0();
  ot(() => {
    m(n, "x1", e.fromX), m(n, "y1", e.fromY), m(n, "x2", e.toX), m(n, "y2", e.toY);
  }), W(t, n);
}
var D0 = /* @__PURE__ */ rt('<rect rx="8" ry="8"></rect>'), Y0 = /* @__PURE__ */ rt("<rect></rect>"), H0 = /* @__PURE__ */ rt("<circle></circle>"), B0 = /* @__PURE__ */ rt("<polygon></polygon>"), V0 = /* @__PURE__ */ rt("<polygon></polygon>"), X0 = /* @__PURE__ */ rt('<g><ellipse></ellipse><rect stroke="none"></rect><line></line><line></line><ellipse></ellipse></g>'), q0 = /* @__PURE__ */ rt("<rect></rect>"), U0 = /* @__PURE__ */ rt("<polygon></polygon>"), G0 = /* @__PURE__ */ rt('<rect rx="8" ry="8"></rect>'), W0 = /* @__PURE__ */ rt('<g class="node-icon"><svg viewBox="0 0 24 24" fill="currentColor"><!></svg></g>'), K0 = /* @__PURE__ */ rt('<text text-anchor="middle"> </text>'), Z0 = /* @__PURE__ */ rt('<rect fill="transparent" style="cursor: pointer; pointer-events: fill;"></rect><rect fill="transparent" style="cursor: pointer; pointer-events: fill;"></rect><rect fill="transparent" style="cursor: pointer; pointer-events: fill;"></rect><rect fill="transparent" style="cursor: pointer; pointer-events: fill;"></rect>', 1), J0 = /* @__PURE__ */ rt('<circle r="7" fill="#3b82f6" opacity="0.8" pointer-events="none"></circle><text text-anchor="middle" dominant-baseline="central" font-size="11" fill="white" pointer-events="none">+</text>', 1), Q0 = /* @__PURE__ */ rt('<g class="node"><g class="node-bg"><!></g><g class="node-fg" pointer-events="none"><!><!></g><!><!></g>');
function j0(t, e) {
  sn(e, !0);
  let n = yt(e, "shadowFilterId", 3, "node-shadow"), r = yt(e, "selected", 3, !1), i = yt(e, "interactive", 3, !1);
  const o = /* @__PURE__ */ O(() => e.node.position.x), s = /* @__PURE__ */ O(() => e.node.position.y), a = /* @__PURE__ */ O(() => e.node.size.width / 2), u = /* @__PURE__ */ O(() => e.node.size.height / 2), f = /* @__PURE__ */ O(() => e.node.node.shape ?? "rounded");
  let c = /* @__PURE__ */ ft(!1);
  const d = /* @__PURE__ */ O(() => r() || l(c)), h = /* @__PURE__ */ O(() => {
    var C;
    return ((C = e.node.node.style) == null ? void 0 : C.fill) ?? (l(d) ? e.colors.nodeHoverFill : e.colors.nodeFill);
  }), g = /* @__PURE__ */ O(() => {
    var C;
    return r() ? e.colors.selection : ((C = e.node.node.style) == null ? void 0 : C.stroke) ?? (l(c) ? e.colors.nodeHoverStroke : e.colors.nodeStroke);
  }), _ = /* @__PURE__ */ O(() => {
    var C;
    return r() ? 2.5 : ((C = e.node.node.style) == null ? void 0 : C.strokeWidth) ?? (l(c) ? 2 : 1.5);
  }), k = /* @__PURE__ */ O(() => {
    var C;
    return ((C = e.node.node.style) == null ? void 0 : C.strokeDasharray) ?? "";
  }), M = /* @__PURE__ */ O(() => ru(e.node.node.type)), S = jl, Y = /* @__PURE__ */ O(() => Array.isArray(e.node.node.label) ? e.node.node.label : [e.node.node.label ?? ""]), P = /* @__PURE__ */ O(() => l(Y).map((C, D) => {
    const Q = C.includes("<b>") || C.includes("<strong>"), nt = C.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, ""), ct = D > 0 && !Q;
    return { text: nt, className: Q ? "node-label node-label-bold" : ct ? "node-label-secondary" : "node-label" };
  })), b = /* @__PURE__ */ O(() => l(M) ? S : 0), T = /* @__PURE__ */ O(() => l(b) > 0 ? $l : 0), E = /* @__PURE__ */ O(() => l(P).length * Qr), A = /* @__PURE__ */ O(() => l(b) + l(T) + l(E)), H = /* @__PURE__ */ O(() => l(s) - l(A) / 2), R = /* @__PURE__ */ O(() => l(H) + l(b) + l(T) + Qr * 0.7);
  let L = /* @__PURE__ */ ft(null);
  function X(C, D) {
    const Q = D.currentTarget.getBoundingClientRect();
    if (C === "top" || C === "bottom") {
      const nt = Math.max(0, Math.min(1, (D.clientX - Q.left) / Q.width));
      V(
        L,
        {
          side: C,
          x: l(o) - l(a) + nt * e.node.size.width,
          y: C === "top" ? l(s) - l(u) : l(s) + l(u)
        },
        !0
      );
    } else {
      const nt = Math.max(0, Math.min(1, (D.clientY - Q.top) / Q.height));
      V(
        L,
        {
          side: C,
          x: C === "left" ? l(o) - l(a) : l(o) + l(a),
          y: l(s) - l(u) + nt * e.node.size.height
        },
        !0
      );
    }
  }
  function z(C) {
    var D;
    l(L) && (C.stopPropagation(), C.preventDefault(), (D = e.onaddport) == null || D.call(e, e.node.id, l(L).side));
  }
  function U(C) {
    var D;
    i() && (C.preventDefault(), C.stopPropagation(), (D = e.oncontextmenu) == null || D.call(e, e.node.id, C));
  }
  var v = Q0();
  v.__contextmenu = U;
  var w = dt(v), p = dt(w);
  {
    var x = (C) => {
      var D = D0();
      ot(() => {
        m(D, "x", l(o) - l(a)), m(D, "y", l(s) - l(u)), m(D, "width", e.node.size.width), m(D, "height", e.node.size.height), m(D, "fill", l(h)), m(D, "stroke", l(g)), m(D, "stroke-width", l(_)), m(D, "stroke-dasharray", l(k) || void 0);
      }), W(C, D);
    }, N = (C) => {
      var D = ge(), Q = Mt(D);
      {
        var nt = (xt) => {
          var ut = Y0();
          ot(() => {
            m(ut, "x", l(o) - l(a)), m(ut, "y", l(s) - l(u)), m(ut, "width", e.node.size.width), m(ut, "height", e.node.size.height), m(ut, "fill", l(h)), m(ut, "stroke", l(g)), m(ut, "stroke-width", l(_)), m(ut, "stroke-dasharray", l(k) || void 0);
          }), W(xt, ut);
        }, ct = (xt) => {
          var ut = ge(), ce = Mt(ut);
          {
            var da = (ln) => {
              var ee = H0();
              ot(
                (Zr) => {
                  m(ee, "cx", l(o)), m(ee, "cy", l(s)), m(ee, "r", Zr), m(ee, "fill", l(h)), m(ee, "stroke", l(g)), m(ee, "stroke-width", l(_));
                },
                [() => Math.min(l(a), l(u))]
              ), W(ln, ee);
            }, ga = (ln) => {
              var ee = ge(), Zr = Mt(ee);
              {
                var va = (un) => {
                  var Ne = B0();
                  ot(() => {
                    m(Ne, "points", `${l(o) ?? ""},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) ?? ""},${l(s) + l(u)} ${l(o) - l(a)},${l(s) ?? ""}`), m(Ne, "fill", l(h)), m(Ne, "stroke", l(g)), m(Ne, "stroke-width", l(_));
                  }), W(un, Ne);
                }, ma = (un) => {
                  var Ne = ge(), pa = Mt(Ne);
                  {
                    var _a = (fn) => {
                      const Ye = /* @__PURE__ */ O(() => l(a) * 0.866);
                      var He = V0();
                      ot(() => {
                        m(He, "points", `${l(o) - l(a)},${l(s) ?? ""} ${l(o) - l(Ye)},${l(s) - l(u)} ${l(o) + l(Ye)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) + l(Ye)},${l(s) + l(u)} ${l(o) - l(Ye)},${l(s) + l(u)}`), m(He, "fill", l(h)), m(He, "stroke", l(g)), m(He, "stroke-width", l(_));
                      }), W(fn, He);
                    }, ya = (fn) => {
                      var Ye = ge(), He = Mt(Ye);
                      {
                        var wa = (cn) => {
                          const Ft = /* @__PURE__ */ O(() => e.node.size.height * 0.15);
                          var cr = X0(), ne = dt(cr), Ae = tt(ne), Nt = tt(Ae), lt = tt(Nt), he = tt(lt);
                          ot(() => {
                            m(ne, "cx", l(o)), m(ne, "cy", l(s) + l(u) - l(Ft)), m(ne, "rx", l(a)), m(ne, "ry", l(Ft)), m(ne, "fill", l(h)), m(ne, "stroke", l(g)), m(ne, "stroke-width", l(_)), m(Ae, "x", l(o) - l(a)), m(Ae, "y", l(s) - l(u) + l(Ft)), m(Ae, "width", e.node.size.width), m(Ae, "height", e.node.size.height - l(Ft) * 2), m(Ae, "fill", l(h)), m(Nt, "x1", l(o) - l(a)), m(Nt, "y1", l(s) - l(u) + l(Ft)), m(Nt, "x2", l(o) - l(a)), m(Nt, "y2", l(s) + l(u) - l(Ft)), m(Nt, "stroke", l(g)), m(Nt, "stroke-width", l(_)), m(lt, "x1", l(o) + l(a)), m(lt, "y1", l(s) - l(u) + l(Ft)), m(lt, "x2", l(o) + l(a)), m(lt, "y2", l(s) + l(u) - l(Ft)), m(lt, "stroke", l(g)), m(lt, "stroke-width", l(_)), m(he, "cx", l(o)), m(he, "cy", l(s) - l(u) + l(Ft)), m(he, "rx", l(a)), m(he, "ry", l(Ft)), m(he, "fill", l(h)), m(he, "stroke", l(g)), m(he, "stroke-width", l(_));
                          }), W(cn, cr);
                        }, xa = (cn) => {
                          var Ft = ge(), cr = Mt(Ft);
                          {
                            var ne = (Nt) => {
                              var lt = q0();
                              ot(() => {
                                m(lt, "x", l(o) - l(a)), m(lt, "y", l(s) - l(u)), m(lt, "width", e.node.size.width), m(lt, "height", e.node.size.height), m(lt, "rx", l(u)), m(lt, "ry", l(u)), m(lt, "fill", l(h)), m(lt, "stroke", l(g)), m(lt, "stroke-width", l(_));
                              }), W(Nt, lt);
                            }, Ae = (Nt) => {
                              var lt = ge(), he = Mt(lt);
                              {
                                var ba = (hn) => {
                                  const Kt = /* @__PURE__ */ O(() => e.node.size.width * 0.15);
                                  var Ln = U0();
                                  ot(() => {
                                    m(Ln, "points", `${l(o) - l(a) + l(Kt)},${l(s) - l(u)} ${l(o) + l(a) - l(Kt)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) + l(u)} ${l(o) - l(a)},${l(s) + l(u)}`), m(Ln, "fill", l(h)), m(Ln, "stroke", l(g)), m(Ln, "stroke-width", l(_));
                                  }), W(hn, Ln);
                                }, ka = (hn) => {
                                  var Kt = G0();
                                  ot(() => {
                                    m(Kt, "x", l(o) - l(a)), m(Kt, "y", l(s) - l(u)), m(Kt, "width", e.node.size.width), m(Kt, "height", e.node.size.height), m(Kt, "fill", l(h)), m(Kt, "stroke", l(g)), m(Kt, "stroke-width", l(_));
                                  }), W(hn, Kt);
                                };
                                ht(
                                  he,
                                  (hn) => {
                                    l(f) === "trapezoid" ? hn(ba) : hn(ka, !1);
                                  },
                                  !0
                                );
                              }
                              W(Nt, lt);
                            };
                            ht(
                              cr,
                              (Nt) => {
                                l(f) === "stadium" ? Nt(ne) : Nt(Ae, !1);
                              },
                              !0
                            );
                          }
                          W(cn, Ft);
                        };
                        ht(
                          He,
                          (cn) => {
                            l(f) === "cylinder" ? cn(wa) : cn(xa, !1);
                          },
                          !0
                        );
                      }
                      W(fn, Ye);
                    };
                    ht(
                      pa,
                      (fn) => {
                        l(f) === "hexagon" ? fn(_a) : fn(ya, !1);
                      },
                      !0
                    );
                  }
                  W(un, Ne);
                };
                ht(
                  Zr,
                  (un) => {
                    l(f) === "diamond" ? un(va) : un(ma, !1);
                  },
                  !0
                );
              }
              W(ln, ee);
            };
            ht(
              ce,
              (ln) => {
                l(f) === "circle" ? ln(da) : ln(ga, !1);
              },
              !0
            );
          }
          W(xt, ut);
        };
        ht(
          Q,
          (xt) => {
            l(f) === "rect" ? xt(nt) : xt(ct, !1);
          },
          !0
        );
      }
      W(C, D);
    };
    ht(p, (C) => {
      l(f) === "rounded" ? C(x) : C(N, !1);
    });
  }
  var I = tt(w), F = dt(I);
  {
    var B = (C) => {
      var D = W0(), Q = dt(D), nt = dt(Q);
      Ns(nt, () => l(M), !0), ot(() => {
        m(D, "transform", `translate(${l(o) - S / 2}, ${l(H) ?? ""})`), m(Q, "width", S), m(Q, "height", S);
      }), W(C, D);
    };
    ht(F, (C) => {
      l(M) && C(B);
    });
  }
  var q = tt(F);
  Be(q, 17, () => l(P), Ss, (C, D, Q) => {
    var nt = K0(), ct = dt(nt);
    ot(() => {
      m(nt, "x", l(o)), m(nt, "y", l(R) + Q * Qr), ql(nt, 0, Bl(l(D).className)), Jn(ct, l(D).text);
    }), W(C, nt);
  });
  var $ = tt(I);
  {
    var j = (C) => {
      const D = /* @__PURE__ */ O(() => 10);
      var Q = Z0(), nt = Mt(Q);
      m(nt, "height", l(D)), nt.__pointermove = (ce) => X("top", ce), nt.__pointerdown = z;
      var ct = tt(nt);
      m(ct, "height", l(D)), ct.__pointermove = (ce) => X("bottom", ce), ct.__pointerdown = z;
      var xt = tt(ct);
      m(xt, "width", l(D)), xt.__pointermove = (ce) => X("left", ce), xt.__pointerdown = z;
      var ut = tt(xt);
      m(ut, "width", l(D)), ut.__pointermove = (ce) => X("right", ce), ut.__pointerdown = z, ot(() => {
        m(nt, "x", l(o) - l(a)), m(nt, "y", l(s) - l(u) - l(D) / 2), m(nt, "width", e.node.size.width), m(ct, "x", l(o) - l(a)), m(ct, "y", l(s) + l(u) - l(D) / 2), m(ct, "width", e.node.size.width), m(xt, "x", l(o) - l(a) - l(D) / 2), m(xt, "y", l(s) - l(u)), m(xt, "height", e.node.size.height), m(ut, "x", l(o) + l(a) - l(D) / 2), m(ut, "y", l(s) - l(u)), m(ut, "height", e.node.size.height);
      }), Ie("pointerleave", nt, () => {
        V(L, null);
      }), Ie("pointerleave", ct, () => {
        V(L, null);
      }), Ie("pointerleave", xt, () => {
        V(L, null);
      }), Ie("pointerleave", ut, () => {
        V(L, null);
      }), W(C, Q);
    };
    ht($, (C) => {
      i() && l(c) && C(j);
    });
  }
  var it = tt($);
  {
    var at = (C) => {
      var D = J0(), Q = Mt(D), nt = tt(Q);
      ot(() => {
        m(Q, "cx", l(L).x), m(Q, "cy", l(L).y), m(nt, "x", l(L).x), m(nt, "y", l(L).y);
      }), W(C, D);
    };
    ht(it, (C) => {
      l(L) && C(at);
    });
  }
  ot(() => {
    m(v, "data-id", e.node.id), m(v, "data-device-type", e.node.node.type ?? ""), m(v, "filter", `url(#${n() ?? ""})`);
  }), Ie("pointerenter", v, () => {
    V(c, !0);
  }), Ie("pointerleave", v, () => {
    V(c, !1);
  }), W(t, v), an();
}
lr(["contextmenu", "pointermove", "pointerdown"]);
var $0 = /* @__PURE__ */ rt('<rect fill="transparent"></rect>'), tg = /* @__PURE__ */ rt('<rect class="port-label-bg" rx="2" pointer-events="none"></rect><text class="port-label" font-size="9" pointer-events="none"> </text>', 1), eg = /* @__PURE__ */ rt('<g class="port"><!><rect class="port-box" rx="2" pointer-events="none"></rect><!></g>');
function ng(t, e) {
  sn(e, !0);
  let n = yt(e, "hideLabel", 3, !1), r = yt(e, "selected", 3, !1), i = yt(e, "interactive", 3, !1), o = yt(e, "linked", 3, !1);
  const s = /* @__PURE__ */ O(() => e.port.absolutePosition.x), a = /* @__PURE__ */ O(() => e.port.absolutePosition.y), u = /* @__PURE__ */ O(() => e.port.size.width), f = /* @__PURE__ */ O(() => e.port.size.height), c = /* @__PURE__ */ O(() => A0(e.port)), d = /* @__PURE__ */ O(() => e.port.label.length * tu + 4), h = 12, g = /* @__PURE__ */ O(() => () => l(c).textAnchor === "middle" ? l(c).x - l(d) / 2 : l(c).textAnchor === "end" ? l(c).x - l(d) + 2 : l(c).x - 2), _ = /* @__PURE__ */ O(() => l(c).y - h + 3);
  let k = /* @__PURE__ */ ft(!1);
  function M(R) {
    var L, X;
    !i() || R.button !== 0 || (R.stopPropagation(), R.preventDefault(), o() ? (L = e.onselect) == null || L.call(e, e.port.id) : (X = e.onlinkstart) == null || X.call(e, e.port.id, l(s), l(a)));
  }
  function S(R) {
    var L;
    i() && (R.stopPropagation(), (L = e.onlinkend) == null || L.call(e, e.port.id));
  }
  function Y(R) {
    var L;
    i() && (R.preventDefault(), R.stopPropagation(), (L = e.oncontextmenu) == null || L.call(e, e.port.id, R));
  }
  var P = eg();
  P.__contextmenu = Y;
  var b = dt(P);
  {
    var T = (R) => {
      var L = $0();
      m(L, "width", 24), m(L, "height", 24), L.__pointerdown = M, L.__pointerup = S, ot(() => {
        m(L, "x", l(s) - 12), m(L, "y", l(a) - 12), qr(L, `pointer-events: fill; cursor: ${o() ? "pointer" : "crosshair"};`);
      }), W(R, L);
    };
    ht(b, (R) => {
      i() && R(T);
    });
  }
  var E = tt(b), A = tt(E);
  {
    var H = (R) => {
      var L = tg(), X = Mt(L);
      m(X, "height", h);
      var z = tt(X), U = dt(z);
      ot(
        (v) => {
          m(X, "x", v), m(X, "y", l(_)), m(X, "width", l(d)), m(X, "fill", e.colors.portLabelBg), m(z, "x", l(c).x), m(z, "y", l(c).y), m(z, "text-anchor", l(c).textAnchor), m(z, "fill", e.colors.portLabelColor), Jn(U, e.port.label);
        },
        [() => l(g)()]
      ), W(R, L);
    };
    ht(A, (R) => {
      n() || R(H);
    });
  }
  ot(() => {
    m(P, "data-port", e.port.id), m(P, "data-port-device", e.port.nodeId), m(E, "x", l(s) - l(u) / 2 - (r() || i() && l(k) ? 2 : 0)), m(E, "y", l(a) - l(f) / 2 - (r() || i() && l(k) ? 2 : 0)), m(E, "width", l(u) + (r() || i() && l(k) ? 4 : 0)), m(E, "height", l(f) + (r() || i() && l(k) ? 4 : 0)), m(E, "fill", r() ? e.colors.selection : i() && l(k) ? "#3b82f6" : e.colors.portFill), m(E, "stroke", r() ? e.colors.selection : i() && l(k) ? "#2563eb" : e.colors.portStroke), m(E, "stroke-width", r() || i() && l(k) ? 2 : 1);
  }), Ie("pointerenter", P, () => {
    V(k, !0);
  }), Ie("pointerleave", P, () => {
    V(k, !1);
  }), W(t, P), an();
}
lr(["contextmenu", "pointerdown", "pointerup"]);
var rg = /* @__PURE__ */ rt('<g class="subgraph"><rect rx="12" ry="12"></rect><rect fill="transparent"></rect><text class="subgraph-label" text-anchor="start" pointer-events="none"> </text></g>');
function ig(t, e) {
  sn(e, !0);
  let n = yt(e, "interactive", 3, !1), r = yt(e, "selected", 3, !1);
  const i = /* @__PURE__ */ O(() => e.subgraph.subgraph.style ?? {}), o = [
    "surface-1",
    "surface-2",
    "surface-3",
    "accent-blue",
    "accent-green",
    "accent-red",
    "accent-amber",
    "accent-purple"
  ], s = /* @__PURE__ */ O(() => () => {
    const _ = l(i).fill, k = l(i).stroke;
    if (_ && o.includes(_) && e.theme) {
      const M = e.theme.colors.surfaces[_];
      return {
        fill: M.fill,
        stroke: k ?? M.stroke,
        text: M.text
      };
    }
    return {
      fill: _ ?? e.colors.subgraphFill,
      stroke: k ?? e.colors.subgraphStroke,
      text: e.colors.subgraphText
    };
  }), a = /* @__PURE__ */ O(() => l(i).strokeWidth ?? 3), u = /* @__PURE__ */ O(() => l(i).strokeDasharray ?? "");
  var f = rg(), c = dt(f);
  c.__click = (_) => {
    var k;
    n() && (_.stopPropagation(), (k = e.onselect) == null || k.call(e, e.subgraph.id));
  };
  var d = tt(c);
  m(d, "height", 28);
  var h = tt(d), g = dt(h);
  ot(
    (_, k, M) => {
      m(f, "data-id", e.subgraph.id), m(c, "x", e.subgraph.bounds.x), m(c, "y", e.subgraph.bounds.y), m(c, "width", e.subgraph.bounds.width), m(c, "height", e.subgraph.bounds.height), m(c, "fill", _), m(c, "stroke", k), m(c, "stroke-width", r() ? 3 : l(a)), m(c, "stroke-dasharray", r() ? void 0 : l(u) || void 0), qr(c, n() ? "cursor: pointer;" : ""), m(d, "data-sg-drag", e.subgraph.id), m(d, "x", e.subgraph.bounds.x), m(d, "y", e.subgraph.bounds.y), m(d, "width", e.subgraph.bounds.width), m(d, "pointer-events", n() ? "fill" : "none"), m(h, "x", e.subgraph.bounds.x + 10), m(h, "y", e.subgraph.bounds.y + 20), m(h, "fill", M), Jn(g, e.subgraph.subgraph.label);
    },
    [
      () => l(s)().fill,
      () => r() ? "#3b82f6" : l(s)().stroke,
      () => l(s)().text
    ]
  ), W(t, f), an();
}
lr(["click"]);
var og = /* @__PURE__ */ rt('<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5"></path></pattern>'), sg = /* @__PURE__ */ rt('<svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7"></polygon></marker><filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"></feDropShadow></filter><!></defs><!><g class="viewport"><rect class="canvas-bg" x="-99999" y="-99999" width="199998" height="199998"></rect><!><!><!><!><!></g></svg>');
function ag(t, e) {
  sn(e, !0);
  let n = yt(e, "interactive", 3, !1), r = yt(e, "selection", 19, () => /* @__PURE__ */ new Set()), i = yt(e, "linkedPorts", 19, () => /* @__PURE__ */ new Set()), o = yt(e, "linkPreview", 3, null), s = yt(e, "svgEl", 15, null);
  const a = /* @__PURE__ */ O(() => `${e.bounds.x - 50} ${e.bounds.y - 50} ${e.bounds.width + 100} ${e.bounds.height + 100}`), u = /* @__PURE__ */ O(() => [...e.nodes.values()]), f = /* @__PURE__ */ O(() => [...e.edges.values()]), c = /* @__PURE__ */ O(() => [...e.subgraphs.values()]), d = /* @__PURE__ */ O(() => {
    const z = /* @__PURE__ */ new Map();
    for (const U of e.ports.values()) {
      const v = z.get(U.nodeId);
      v ? v.push(U) : z.set(U.nodeId, [U]);
    }
    return z;
  });
  let h = /* @__PURE__ */ ft(void 0);
  Gn(() => {
    if (!s() || !n() || !l(h)) return;
    const z = Pt(s()), U = S0().scaleExtent([0.1, 5]).filter((v) => v.type === "wheel" ? !0 : v.type === "mousedown" || v.type === "pointerdown" ? v.button === 1 || v.altKey : !1).on("zoom", (v) => {
      l(h) && l(h).setAttribute("transform", v.transform.toString());
    });
    return z.call(U), z.on("contextmenu.zoom", null), () => {
      z.on(".zoom", null);
    };
  }), Gn(() => {
    if (l(u).length, l(c).length, !s() || !n()) return;
    const z = yo().filter((v) => {
      const w = v.target;
      return w.closest(".port") || w.closest("[data-droplet]") ? !1 : v.button === 0;
    }).on("drag", function(v) {
      var x;
      const w = this.getAttribute("data-id");
      if (!w) return;
      const p = e.nodes.get(w);
      p && ((x = e.onnodedragmove) == null || x.call(e, w, p.position.x + v.dx, p.position.y + v.dy));
    });
    Pt(s()).selectAll(".node[data-id]").call(z);
    const U = yo().on("drag", function(v) {
      var x;
      const w = this.getAttribute("data-sg-drag");
      if (!w) return;
      const p = e.subgraphs.get(w);
      p && ((x = e.onsubgraphmove) == null || x.call(e, w, p.bounds.x + v.dx, p.bounds.y + v.dy));
    });
    return Pt(s()).selectAll("[data-sg-drag]").call(U), () => {
      Pt(s()).selectAll(".node[data-id]").on(".drag", null), Pt(s()).selectAll("[data-sg-drag]").on(".drag", null);
    };
  });
  var g = sg(), _ = dt(g), k = dt(_), M = dt(k), S = tt(k, 2);
  {
    var Y = (z) => {
      var U = og();
      W(z, U);
    };
    ht(S, (z) => {
      n() && z(Y);
    });
  }
  var P = tt(_);
  Ns(
    P,
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
  var b = tt(P), T = dt(b);
  T.__click = () => {
    var z;
    return (z = e.onbackgroundclick) == null ? void 0 : z.call(e);
  };
  var E = tt(T);
  Be(E, 17, () => l(c), (z) => z.id, (z, U) => {
    {
      let v = /* @__PURE__ */ O(() => r().has(l(U).id));
      ig(z, {
        get subgraph() {
          return l(U);
        },
        get colors() {
          return e.colors;
        },
        get theme() {
          return e.theme;
        },
        get interactive() {
          return n();
        },
        get selected() {
          return l(v);
        },
        get onselect() {
          return e.onsubgraphselect;
        }
      });
    }
  });
  var A = tt(E);
  Be(A, 17, () => l(f), (z) => z.id, (z, U) => {
    {
      let v = /* @__PURE__ */ O(() => r().has(l(U).id));
      F0(z, {
        get edge() {
          return l(U);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(v);
        },
        get interactive() {
          return n();
        },
        get onselect() {
          return e.onedgeselect;
        },
        oncontextmenu: (w, p) => {
          var x;
          return (x = e.oncontextmenu) == null ? void 0 : x.call(e, w, "edge", p);
        }
      });
    }
  });
  var H = tt(A);
  Be(H, 17, () => l(u), (z) => z.id, (z, U) => {
    {
      let v = /* @__PURE__ */ O(() => r().has(l(U).id));
      j0(z, {
        get node() {
          return l(U);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(v);
        },
        get interactive() {
          return n();
        },
        get onaddport() {
          return e.onaddport;
        },
        oncontextmenu: (w, p) => {
          var x;
          return (x = e.oncontextmenu) == null ? void 0 : x.call(e, w, "node", p);
        }
      });
    }
  });
  var R = tt(H);
  Be(R, 17, () => l(u), (z) => z.id, (z, U) => {
    var v = ge(), w = Mt(v);
    Be(w, 17, () => l(d).get(l(U).id) ?? [], (p) => p.id, (p, x) => {
      {
        let N = /* @__PURE__ */ O(() => r().has(l(x).id)), I = /* @__PURE__ */ O(() => i().has(l(x).id));
        ng(p, {
          get port() {
            return l(x);
          },
          get colors() {
            return e.colors;
          },
          get selected() {
            return l(N);
          },
          get interactive() {
            return n();
          },
          get linked() {
            return l(I);
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
          oncontextmenu: (F, B) => {
            var q;
            return (q = e.oncontextmenu) == null ? void 0 : q.call(e, F, "port", B);
          }
        });
      }
    }), W(z, v);
  });
  var L = tt(R);
  {
    var X = (z) => {
      O0(z, {
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
    ht(L, (z) => {
      o() && z(X);
    });
  }
  oo(b, (z) => V(h, z), () => l(h)), oo(g, (z) => s(z), () => s()), ot(() => {
    m(g, "viewBox", l(a)), qr(g, `width: 100%; height: 100%; user-select: none; background: ${n() ? "#f8fafc" : "transparent"};`), m(M, "fill", e.colors.linkStroke), m(T, "fill", n() ? "url(#grid)" : "transparent"), m(T, "pointer-events", n() ? "fill" : "none");
  }), W(t, g), an();
}
lr(["click"]);
var lg = /* @__PURE__ */ Tl('<div style="width: 100%; height: 100%; outline: none;"><!></div>');
function ug(t, e) {
  var v;
  sn(e, !0);
  let n = yt(e, "mode", 3, "view");
  const r = /* @__PURE__ */ O(() => Kf(e.theme)), i = /* @__PURE__ */ O(() => n() === "edit");
  let o = /* @__PURE__ */ ft(Dt(new Map(e.layout.nodes))), s = /* @__PURE__ */ ft(Dt(new Map(e.layout.ports))), a = /* @__PURE__ */ ft(Dt(new Map(e.layout.edges))), u = /* @__PURE__ */ ft(Dt(new Map(e.layout.subgraphs))), f = Dt(e.layout.bounds), c = /* @__PURE__ */ ft(Dt((v = e.graph) != null && v.links ? [...e.graph.links] : [])), d = /* @__PURE__ */ ft(Dt(/* @__PURE__ */ new Set())), h = /* @__PURE__ */ ft(null), g = /* @__PURE__ */ ft(null);
  const _ = /* @__PURE__ */ O(() => {
    const w = /* @__PURE__ */ new Set();
    for (const p of l(a).values())
      p.fromPortId && w.add(p.fromPortId), p.toPortId && w.add(p.toPortId);
    return w;
  });
  Gn(() => {
    if (!l(i) || !l(g)) return;
    const w = l(g);
    return w.addEventListener("keydown", X), () => w.removeEventListener("keydown", X);
  }), Gn(() => {
    var w, p;
    if (l(d).size === 0)
      (w = e.onselect) == null || w.call(e, null, null);
    else {
      const x = [...l(d)][0] ?? null;
      if (!x) return;
      let N = "node";
      l(a).has(x) ? N = "edge" : l(s).has(x) ? N = "port" : l(u).has(x) && (N = "subgraph"), (p = e.onselect) == null || p.call(e, x, N);
    }
  });
  async function k(w, p, x) {
    const N = await xu(
      w,
      p,
      x,
      {
        nodes: l(o),
        ports: l(s),
        subgraphs: l(u)
      },
      l(c)
    );
    N && (V(o, N.nodes, !0), V(s, N.ports, !0), V(a, N.edges, !0), N.subgraphs && V(u, N.subgraphs, !0));
  }
  async function M(w, p) {
    const x = Mu(w, p, l(o), l(s), l(c));
    x && (V(o, x.nodes, !0), V(s, x.ports, !0), V(a, await Wn(x.nodes, x.ports, l(c)), !0));
  }
  async function S(w, p, x) {
    const N = await bu(
      w,
      p,
      x,
      {
        nodes: l(o),
        ports: l(s),
        subgraphs: l(u)
      },
      l(c)
    );
    N && (V(o, N.nodes, !0), V(s, N.ports, !0), V(a, N.edges, !0), V(u, N.subgraphs, !0));
  }
  let Y = null;
  function P(w, p, x) {
    var B, q;
    V(h, { fromPortId: w, fromX: p, fromY: x, toX: p, toY: x }, !0);
    function N($) {
      if (!l(h) || !l(g)) return;
      const it = (l(g).querySelector(".viewport") ?? l(g)).getScreenCTM();
      if (!it) return;
      const at = new DOMPoint($.clientX, $.clientY).matrixTransform(it.inverse());
      V(h, { ...l(h), toX: at.x, toY: at.y }, !0);
    }
    function I($) {
      $.target.closest(".port") || F();
    }
    function F() {
      var $, j;
      ($ = l(g)) == null || $.removeEventListener("pointermove", N), (j = l(g)) == null || j.removeEventListener("pointerup", I), V(h, null), Y = null;
    }
    Y = F, (B = l(g)) == null || B.addEventListener("pointermove", N), (q = l(g)) == null || q.addEventListener("pointerup", I);
  }
  function b(w) {
    if (!l(h)) return;
    const p = l(h).fromPortId;
    if (Y == null || Y(), p === w) return;
    const x = l(s).get(p), N = l(s).get(w);
    x && N && x.nodeId === N.nodeId || T(p, w);
  }
  async function T(w, p) {
    var it;
    const x = w.split(":"), N = p.split(":");
    let I = x[0] ?? "", F = x.slice(1).join(":"), B = N[0] ?? "", q = N.slice(1).join(":");
    if (!I || !F || !B || !q || ku(l(c), I, F, B, q)) return;
    const $ = l(o).get(I), j = l(o).get(B);
    $ && j && $.position.y > j.position.y && ([I, B] = [B, I], [F, q] = [q, F]), V(
      c,
      [
        ...l(c),
        {
          id: `link-${Date.now()}`,
          from: { node: I, port: F },
          to: { node: B, port: q }
        }
      ],
      !0
    ), V(a, await Wn(l(o), l(s), l(c)), !0), (it = e.onchange) == null || it.call(e, l(c));
  }
  Gn(() => {
    if (!l(g)) return;
    const p = l(g).getRootNode().host;
    function x(I) {
      const { label: F, position: B } = I.detail ?? {}, q = `node-${Date.now()}`, $ = 180, j = 80, it = [...l(d)].find((ct) => l(u).has(ct)), at = it ? l(u).get(it) : void 0;
      let C, D;
      at ? (C = it, D = B ?? {
        x: at.bounds.x + at.bounds.width / 2,
        y: at.bounds.y + at.bounds.height / 2
      }) : D = B ?? {
        x: f.x + f.width + 20 + $ / 2,
        y: f.y + f.height / 2
      };
      const Q = new Map(l(o));
      Q.set(q, {
        id: q,
        position: D,
        size: { width: $, height: j },
        node: { id: q, label: F ?? "New Node", shape: "rounded", parent: C }
      });
      const nt = Cs(q, D.x, D.y, Q, 8, l(u));
      if (Q.set(q, { ...Q.get(q), position: nt }), V(o, Q, !0), C) {
        const ct = new Map(l(u));
        Tr(Q, ct, l(s)), V(u, ct, !0);
      }
      V(d, /* @__PURE__ */ new Set([q]), !0);
    }
    function N(I) {
      const { label: F, position: B } = I.detail ?? {}, q = `sg-${Date.now()}`, $ = 200, j = 120, it = B ?? {
        x: f.x + f.width + 20 + $ / 2,
        y: f.y + f.height / 2
      }, at = new Map(l(u));
      at.set(q, {
        id: q,
        bounds: {
          x: it.x - $ / 2,
          y: it.y - j / 2,
          width: $,
          height: j
        },
        subgraph: { id: q, label: F ?? "New Group" }
      }), Tr(l(o), at, l(s)), V(u, at, !0);
    }
    return p == null || p.addEventListener("shumoku-add-node", x), p == null || p.addEventListener("shumoku-add-subgraph", N), () => {
      p == null || p.removeEventListener("shumoku-add-node", x), p == null || p.removeEventListener("shumoku-add-subgraph", N);
    };
  });
  function E(w) {
    V(d, /* @__PURE__ */ new Set([w]), !0);
  }
  function A(w) {
    V(d, /* @__PURE__ */ new Set([w]), !0);
  }
  function H(w) {
    V(d, /* @__PURE__ */ new Set([w]), !0);
  }
  function R() {
    V(d, /* @__PURE__ */ new Set(), !0);
  }
  function L(w, p, x) {
    var N;
    V(d, /* @__PURE__ */ new Set([w]), !0), (N = e.oncontextmenu) == null || N.call(e, w, p, x.clientX, x.clientY);
  }
  function X(w) {
    var p, x;
    if (w.key === "Delete" || w.key === "Backspace") {
      for (const N of l(d))
        if (l(a).has(N)) {
          const I = l(a).get(N);
          (p = I == null ? void 0 : I.link) != null && p.id && V(c, l(c).filter((F) => {
            var B;
            return F.id !== ((B = I.link) == null ? void 0 : B.id);
          }), !0);
        } else if (l(s).has(N)) {
          const I = Iu(N, l(o), l(s), l(c));
          I && (V(o, I.nodes, !0), V(s, I.ports, !0), V(c, I.links, !0));
        }
      Wn(l(o), l(s), l(c)).then((N) => {
        V(a, N, !0);
      }), V(d, /* @__PURE__ */ new Set(), !0), (x = e.onchange) == null || x.call(e, l(c));
    }
    w.key === "Escape" && (V(d, /* @__PURE__ */ new Set(), !0), V(h, null));
  }
  var z = lg(), U = dt(z);
  ag(U, {
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
      return l(_);
    },
    get linkPreview() {
      return l(h);
    },
    onnodedragmove: k,
    onaddport: M,
    onlinkstart: P,
    onlinkend: b,
    onedgeselect: E,
    onportselect: A,
    onsubgraphselect: H,
    onsubgraphmove: S,
    oncontextmenu: L,
    onbackgroundclick: R,
    get svgEl() {
      return l(g);
    },
    set svgEl(w) {
      V(g, w, !0);
    }
  }), W(t, z), an();
}
class fg extends HTMLElement {
  constructor() {
    super();
    mt(this, "_layout", null);
    mt(this, "_graph", null);
    mt(this, "_theme");
    mt(this, "_mode", "view");
    mt(this, "_viewBox");
    mt(this, "_instance", null);
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
    this._instance && (eo(this._instance), this._instance = null);
  }
  _tryRender() {
    !this.shadowRoot || !this._layout || (this._instance && (eo(this._instance), this._instance = null), this._instance = Rl(ug, {
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
typeof window < "u" && (customElements.get("shumoku-renderer") || customElements.define("shumoku-renderer", fg));
export {
  fg as ShumokuRendererElement
};
