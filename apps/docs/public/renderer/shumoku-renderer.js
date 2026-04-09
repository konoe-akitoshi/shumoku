var Tr = Object.defineProperty;
var yn = (e) => {
  throw TypeError(e);
};
var Rr = (e, t, n) => t in e ? Tr(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Z = (e, t, n) => Rr(e, typeof t != "symbol" ? t + "" : t, n), qt = (e, t, n) => t.has(e) || yn("Cannot " + n);
var p = (e, t, n) => (qt(e, t, "read from private field"), n ? n.call(e) : t.get(e)), N = (e, t, n) => t.has(e) ? yn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), w = (e, t, n, i) => (qt(e, t, "write to private field"), i ? i.call(e, n) : t.set(e, n), n), D = (e, t, n) => (qt(e, t, "access private method"), n);
var jn = Array.isArray, Cr = Array.prototype.indexOf, zt = Array.from, Or = Object.defineProperty, yt = Object.getOwnPropertyDescriptor, Mr = Object.getOwnPropertyDescriptors, Lr = Object.prototype, Yr = Array.prototype, Gn = Object.getPrototypeOf, bn = Object.isExtensible;
function Dr(e) {
  for (var t = 0; t < e.length; t++)
    e[t]();
}
function qn() {
  var e, t, n = new Promise((i, r) => {
    e = i, t = r;
  });
  return { promise: n, resolve: e, reject: t };
}
const Y = 2, Kt = 4, Ut = 8, Hn = 1 << 24, we = 16, Te = 32, Ge = 64, an = 128, ie = 512, B = 1024, W = 2048, xe = 4096, Q = 8192, Pe = 16384, Xn = 32768, Et = 65536, En = 1 << 17, Kn = 1 << 18, pt = 1 << 19, Br = 1 << 20, ke = 1 << 25, Ve = 32768, Wt = 1 << 21, un = 1 << 22, Ie = 1 << 23, Ht = Symbol("$state"), zr = Symbol(""), Xe = new class extends Error {
  constructor() {
    super(...arguments);
    Z(this, "name", "StaleReactionError");
    Z(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function Ur() {
  throw new Error("https://svelte.dev/e/async_derived_orphan");
}
function Vr() {
  throw new Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function jr() {
  throw new Error("https://svelte.dev/e/state_descriptors_fixed");
}
function Gr() {
  throw new Error("https://svelte.dev/e/state_prototype_fixed");
}
function qr() {
  throw new Error("https://svelte.dev/e/state_unsafe_mutation");
}
function Hr() {
  throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
const Xr = 1, Kr = 2, Wr = 16, Zr = 1, M = Symbol(), Jr = "http://www.w3.org/1999/xhtml";
function Qr() {
  console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
function Wn(e) {
  return e === this.v;
}
function $r(e, t) {
  return e != e ? t == t : e !== t || e !== null && typeof e == "object" || typeof e == "function";
}
function Zn(e) {
  return !$r(e, this.v);
}
let ae = null;
function at(e) {
  ae = e;
}
function vt(e, t = !1, n) {
  ae = {
    p: ae,
    i: !1,
    c: null,
    e: null,
    s: e,
    x: null,
    l: null
  };
}
function gt(e) {
  var t = (
    /** @type {ComponentContext} */
    ae
  ), n = t.e;
  if (n !== null) {
    t.e = null;
    for (var i of n)
      Ei(i);
  }
  return t.i = !0, ae = t.p, /** @type {T} */
  {};
}
function Jn() {
  return !0;
}
let Ke = [];
function ei() {
  var e = Ke;
  Ke = [], Dr(e);
}
function Je(e) {
  if (Ke.length === 0) {
    var t = Ke;
    queueMicrotask(() => {
      t === Ke && ei();
    });
  }
  Ke.push(e);
}
function Qn(e) {
  var t = F;
  if (t === null)
    return E.f |= Ie, e;
  if ((t.f & Xn) === 0) {
    if ((t.f & an) === 0)
      throw e;
    t.b.error(e);
  } else
    ut(e, t);
}
function ut(e, t) {
  for (; t !== null; ) {
    if ((t.f & an) !== 0)
      try {
        t.b.error(e);
        return;
      } catch (n) {
        e = n;
      }
    t = t.parent;
  }
  throw e;
}
const ti = -7169;
function O(e, t) {
  e.f = e.f & ti | t;
}
function cn(e) {
  (e.f & ie) !== 0 || e.deps === null ? O(e, B) : O(e, xe);
}
function $n(e) {
  if (e !== null)
    for (const t of e)
      (t.f & Y) === 0 || (t.f & Ve) === 0 || (t.f ^= Ve, $n(
        /** @type {Derived} */
        t.deps
      ));
}
function er(e, t, n) {
  (e.f & W) !== 0 ? t.add(e) : (e.f & xe) !== 0 && n.add(e), $n(e.deps), O(e, B);
}
const Tt = /* @__PURE__ */ new Set();
let T = null, L = null, oe = [], dn = null, Zt = !1;
var et, tt, Ye, nt, Pt, rt, it, st, ve, Jt, Qt, tr;
const wn = class wn {
  constructor() {
    N(this, ve);
    Z(this, "committed", !1);
    /**
     * The current values of any sources that are updated in this batch
     * They keys of this map are identical to `this.#previous`
     * @type {Map<Source, any>}
     */
    Z(this, "current", /* @__PURE__ */ new Map());
    /**
     * The values of any sources that are updated in this batch _before_ those updates took place.
     * They keys of this map are identical to `this.#current`
     * @type {Map<Source, any>}
     */
    Z(this, "previous", /* @__PURE__ */ new Map());
    /**
     * When the batch is committed (and the DOM is updated), we need to remove old branches
     * and append new ones by calling the functions added inside (if/each/key/etc) blocks
     * @type {Set<() => void>}
     */
    N(this, et, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    N(this, tt, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    N(this, Ye, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    N(this, nt, 0);
    /**
     * A deferred that resolves when the batch is committed, used with `settled()`
     * TODO replace with Promise.withResolvers once supported widely enough
     * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
     */
    N(this, Pt, null);
    /**
     * Deferred effects (which run after async work has completed) that are DIRTY
     * @type {Set<Effect>}
     */
    N(this, rt, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    N(this, it, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    Z(this, "skipped_effects", /* @__PURE__ */ new Set());
    Z(this, "is_fork", !1);
    N(this, st, !1);
  }
  is_deferred() {
    return this.is_fork || p(this, nt) > 0;
  }
  /**
   *
   * @param {Effect[]} root_effects
   */
  process(t) {
    var r;
    oe = [], this.apply();
    var n = [], i = [];
    for (const s of t)
      D(this, ve, Jt).call(this, s, n, i);
    if (this.is_deferred())
      D(this, ve, Qt).call(this, i), D(this, ve, Qt).call(this, n);
    else {
      for (const s of p(this, et)) s();
      p(this, et).clear(), p(this, Ye) === 0 && D(this, ve, tr).call(this), T = null, Sn(i), Sn(n), (r = p(this, Pt)) == null || r.resolve();
    }
    L = null;
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} value
   */
  capture(t, n) {
    n !== M && !this.previous.has(t) && this.previous.set(t, n), (t.f & Ie) === 0 && (this.current.set(t, t.v), L == null || L.set(t, t.v));
  }
  activate() {
    T = this, this.apply();
  }
  deactivate() {
    T === this && (T = null, L = null);
  }
  flush() {
    if (this.activate(), oe.length > 0) {
      if (ni(), T !== null && T !== this)
        return;
    } else p(this, Ye) === 0 && this.process([]);
    this.deactivate();
  }
  discard() {
    for (const t of p(this, tt)) t(this);
    p(this, tt).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(t) {
    w(this, Ye, p(this, Ye) + 1), t && w(this, nt, p(this, nt) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(t) {
    w(this, Ye, p(this, Ye) - 1), t && w(this, nt, p(this, nt) - 1), !p(this, st) && (w(this, st, !0), Je(() => {
      w(this, st, !1), this.is_deferred() ? oe.length > 0 && this.flush() : this.revive();
    }));
  }
  revive() {
    for (const t of p(this, rt))
      p(this, it).delete(t), O(t, W), me(t);
    for (const t of p(this, it))
      O(t, xe), me(t);
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(t) {
    p(this, et).add(t);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(t) {
    p(this, tt).add(t);
  }
  settled() {
    return (p(this, Pt) ?? w(this, Pt, qn())).promise;
  }
  static ensure() {
    if (T === null) {
      const t = T = new wn();
      Tt.add(T), Je(() => {
        T === t && t.flush();
      });
    }
    return T;
  }
  apply() {
  }
};
et = new WeakMap(), tt = new WeakMap(), Ye = new WeakMap(), nt = new WeakMap(), Pt = new WeakMap(), rt = new WeakMap(), it = new WeakMap(), st = new WeakMap(), ve = new WeakSet(), /**
 * Traverse the effect tree, executing effects or stashing
 * them for later execution as appropriate
 * @param {Effect} root
 * @param {Effect[]} effects
 * @param {Effect[]} render_effects
 */
Jt = function(t, n, i) {
  t.f ^= B;
  for (var r = t.first, s = null; r !== null; ) {
    var o = r.f, l = (o & (Te | Ge)) !== 0, f = l && (o & B) !== 0, a = f || (o & Q) !== 0 || this.skipped_effects.has(r);
    if (!a && r.fn !== null) {
      l ? r.f ^= B : s !== null && (o & (Kt | Ut | Hn)) !== 0 ? s.b.defer_effect(r) : (o & Kt) !== 0 ? n.push(r) : At(r) && ((o & we) !== 0 && p(this, rt).add(r), St(r));
      var c = r.first;
      if (c !== null) {
        r = c;
        continue;
      }
    }
    var d = r.parent;
    for (r = r.next; r === null && d !== null; )
      d === s && (s = null), r = d.next, d = d.parent;
  }
}, /**
 * @param {Effect[]} effects
 */
Qt = function(t) {
  for (var n = 0; n < t.length; n += 1)
    er(t[n], p(this, rt), p(this, it));
}, tr = function() {
  var r;
  if (Tt.size > 1) {
    this.previous.clear();
    var t = L, n = !0;
    for (const s of Tt) {
      if (s === this) {
        n = !1;
        continue;
      }
      const o = [];
      for (const [f, a] of this.current) {
        if (s.current.has(f))
          if (n && a !== s.current.get(f))
            s.current.set(f, a);
          else
            continue;
        o.push(f);
      }
      if (o.length === 0)
        continue;
      const l = [...s.current.keys()].filter((f) => !this.current.has(f));
      if (l.length > 0) {
        var i = oe;
        oe = [];
        const f = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Map();
        for (const c of o)
          nr(c, l, f, a);
        if (oe.length > 0) {
          T = s, s.apply();
          for (const c of oe)
            D(r = s, ve, Jt).call(r, c, [], []);
          s.deactivate();
        }
        oe = i;
      }
    }
    T = null, L = t;
  }
  this.committed = !0, Tt.delete(this);
};
let Ne = wn;
function ni() {
  Zt = !0;
  var e = null;
  try {
    for (var t = 0; oe.length > 0; ) {
      var n = Ne.ensure();
      if (t++ > 1e3) {
        var i, r;
        ri();
      }
      n.process(oe), Ae.clear();
    }
  } finally {
    Zt = !1, dn = null;
  }
}
function ri() {
  try {
    Vr();
  } catch (e) {
    ut(e, dn);
  }
}
let se = null;
function Sn(e) {
  var t = e.length;
  if (t !== 0) {
    for (var n = 0; n < t; ) {
      var i = e[n++];
      if ((i.f & (Pe | Q)) === 0 && At(i) && (se = /* @__PURE__ */ new Set(), St(i), i.deps === null && i.first === null && i.nodes === null && (i.teardown === null && i.ac === null ? pr(i) : i.fn = null), (se == null ? void 0 : se.size) > 0)) {
        Ae.clear();
        for (const r of se) {
          if ((r.f & (Pe | Q)) !== 0) continue;
          const s = [r];
          let o = r.parent;
          for (; o !== null; )
            se.has(o) && (se.delete(o), s.push(o)), o = o.parent;
          for (let l = s.length - 1; l >= 0; l--) {
            const f = s[l];
            (f.f & (Pe | Q)) === 0 && St(f);
          }
        }
        se.clear();
      }
    }
    se = null;
  }
}
function nr(e, t, n, i) {
  if (!n.has(e) && (n.add(e), e.reactions !== null))
    for (const r of e.reactions) {
      const s = r.f;
      (s & Y) !== 0 ? nr(
        /** @type {Derived} */
        r,
        t,
        n,
        i
      ) : (s & (un | we)) !== 0 && (s & W) === 0 && rr(r, t, i) && (O(r, W), me(
        /** @type {Effect} */
        r
      ));
    }
}
function rr(e, t, n) {
  const i = n.get(e);
  if (i !== void 0) return i;
  if (e.deps !== null)
    for (const r of e.deps) {
      if (t.includes(r))
        return !0;
      if ((r.f & Y) !== 0 && rr(
        /** @type {Derived} */
        r,
        t,
        n
      ))
        return n.set(
          /** @type {Derived} */
          r,
          !0
        ), !0;
    }
  return n.set(e, !1), !1;
}
function me(e) {
  for (var t = dn = e; t.parent !== null; ) {
    t = t.parent;
    var n = t.f;
    if (Zt && t === F && (n & we) !== 0 && (n & Kn) === 0)
      return;
    if ((n & (Ge | Te)) !== 0) {
      if ((n & B) === 0) return;
      t.f ^= B;
    }
  }
  oe.push(t);
}
function ii(e) {
  let t = 0, n = je(0), i;
  return () => {
    vn() && (x(n), Pi(() => (t === 0 && (i = Ri(() => e(() => bt(n)))), t += 1, () => {
      Je(() => {
        t -= 1, t === 0 && (i == null || i(), i = void 0, bt(n));
      });
    })));
  };
}
var si = Et | pt | an;
function oi(e, t, n) {
  new li(e, t, n);
}
var ee, fn, ce, De, de, te, G, he, ge, Ee, Be, Se, ot, ze, lt, ft, _e, Bt, C, fi, ai, $t, Ot, Mt, en;
class li {
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(t, n, i) {
    N(this, C);
    /** @type {Boundary | null} */
    Z(this, "parent");
    Z(this, "is_pending", !1);
    /** @type {TemplateNode} */
    N(this, ee);
    /** @type {TemplateNode | null} */
    N(this, fn, null);
    /** @type {BoundaryProps} */
    N(this, ce);
    /** @type {((anchor: Node) => void)} */
    N(this, De);
    /** @type {Effect} */
    N(this, de);
    /** @type {Effect | null} */
    N(this, te, null);
    /** @type {Effect | null} */
    N(this, G, null);
    /** @type {Effect | null} */
    N(this, he, null);
    /** @type {DocumentFragment | null} */
    N(this, ge, null);
    /** @type {TemplateNode | null} */
    N(this, Ee, null);
    N(this, Be, 0);
    N(this, Se, 0);
    N(this, ot, !1);
    N(this, ze, !1);
    /** @type {Set<Effect>} */
    N(this, lt, /* @__PURE__ */ new Set());
    /** @type {Set<Effect>} */
    N(this, ft, /* @__PURE__ */ new Set());
    /**
     * A source containing the number of pending async deriveds/expressions.
     * Only created if `$effect.pending()` is used inside the boundary,
     * otherwise updating the source results in needless `Batch.ensure()`
     * calls followed by no-op flushes
     * @type {Source<number> | null}
     */
    N(this, _e, null);
    N(this, Bt, ii(() => (w(this, _e, je(p(this, Be))), () => {
      w(this, _e, null);
    })));
    w(this, ee, t), w(this, ce, n), w(this, De, i), this.parent = /** @type {Effect} */
    F.b, this.is_pending = !!p(this, ce).pending, w(this, de, cr(() => {
      F.b = this;
      {
        var r = D(this, C, $t).call(this);
        try {
          w(this, te, ue(() => i(r)));
        } catch (s) {
          this.error(s);
        }
        p(this, Se) > 0 ? D(this, C, Mt).call(this) : this.is_pending = !1;
      }
      return () => {
        var s;
        (s = p(this, Ee)) == null || s.remove();
      };
    }, si));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(t) {
    er(t, p(this, lt), p(this, ft));
  }
  /**
   * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
   * @returns {boolean}
   */
  is_rendered() {
    return !this.is_pending && (!this.parent || this.parent.is_rendered());
  }
  has_pending_snippet() {
    return !!p(this, ce).pending;
  }
  /**
   * Update the source that powers `$effect.pending()` inside this boundary,
   * and controls when the current `pending` snippet (if any) is removed.
   * Do not call from inside the class
   * @param {1 | -1} d
   */
  update_pending_count(t) {
    D(this, C, en).call(this, t), w(this, Be, p(this, Be) + t), !(!p(this, _e) || p(this, ot)) && (w(this, ot, !0), Je(() => {
      w(this, ot, !1), p(this, _e) && ct(p(this, _e), p(this, Be));
    }));
  }
  get_effect_pending() {
    return p(this, Bt).call(this), x(
      /** @type {Source<number>} */
      p(this, _e)
    );
  }
  /** @param {unknown} error */
  error(t) {
    var n = p(this, ce).onerror;
    let i = p(this, ce).failed;
    if (p(this, ze) || !n && !i)
      throw t;
    p(this, te) && (fe(p(this, te)), w(this, te, null)), p(this, G) && (fe(p(this, G)), w(this, G, null)), p(this, he) && (fe(p(this, he)), w(this, he, null));
    var r = !1, s = !1;
    const o = () => {
      if (r) {
        Qr();
        return;
      }
      r = !0, s && Hr(), Ne.ensure(), w(this, Be, 0), p(this, he) !== null && $e(p(this, he), () => {
        w(this, he, null);
      }), this.is_pending = this.has_pending_snippet(), w(this, te, D(this, C, Ot).call(this, () => (w(this, ze, !1), ue(() => p(this, De).call(this, p(this, ee)))))), p(this, Se) > 0 ? D(this, C, Mt).call(this) : this.is_pending = !1;
    };
    var l = E;
    try {
      K(null), s = !0, n == null || n(t, o), s = !1;
    } catch (f) {
      ut(f, p(this, de) && p(this, de).parent);
    } finally {
      K(l);
    }
    i && Je(() => {
      w(this, he, D(this, C, Ot).call(this, () => {
        Ne.ensure(), w(this, ze, !0);
        try {
          return ue(() => {
            i(
              p(this, ee),
              () => t,
              () => o
            );
          });
        } catch (f) {
          return ut(
            f,
            /** @type {Effect} */
            p(this, de).parent
          ), null;
        } finally {
          w(this, ze, !1);
        }
      }));
    });
  }
}
ee = new WeakMap(), fn = new WeakMap(), ce = new WeakMap(), De = new WeakMap(), de = new WeakMap(), te = new WeakMap(), G = new WeakMap(), he = new WeakMap(), ge = new WeakMap(), Ee = new WeakMap(), Be = new WeakMap(), Se = new WeakMap(), ot = new WeakMap(), ze = new WeakMap(), lt = new WeakMap(), ft = new WeakMap(), _e = new WeakMap(), Bt = new WeakMap(), C = new WeakSet(), fi = function() {
  try {
    w(this, te, ue(() => p(this, De).call(this, p(this, ee))));
  } catch (t) {
    this.error(t);
  }
}, ai = function() {
  const t = p(this, ce).pending;
  t && (w(this, G, ue(() => t(p(this, ee)))), Je(() => {
    var n = D(this, C, $t).call(this);
    w(this, te, D(this, C, Ot).call(this, () => (Ne.ensure(), ue(() => p(this, De).call(this, n))))), p(this, Se) > 0 ? D(this, C, Mt).call(this) : ($e(
      /** @type {Effect} */
      p(this, G),
      () => {
        w(this, G, null);
      }
    ), this.is_pending = !1);
  }));
}, $t = function() {
  var t = p(this, ee);
  return this.is_pending && (w(this, Ee, Yt()), p(this, ee).before(p(this, Ee)), t = p(this, Ee)), t;
}, /**
 * @param {() => Effect | null} fn
 */
Ot = function(t) {
  var n = F, i = E, r = ae;
  pe(p(this, de)), K(p(this, de)), at(p(this, de).ctx);
  try {
    return t();
  } catch (s) {
    return Qn(s), null;
  } finally {
    pe(n), K(i), at(r);
  }
}, Mt = function() {
  const t = (
    /** @type {(anchor: Node) => void} */
    p(this, ce).pending
  );
  p(this, te) !== null && (w(this, ge, document.createDocumentFragment()), p(this, ge).append(
    /** @type {TemplateNode} */
    p(this, Ee)
  ), Ai(p(this, te), p(this, ge))), p(this, G) === null && w(this, G, ue(() => t(p(this, ee))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
en = function(t) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && D(n = this.parent, C, en).call(n, t);
    return;
  }
  if (w(this, Se, p(this, Se) + t), p(this, Se) === 0) {
    this.is_pending = !1;
    for (const i of p(this, lt))
      O(i, W), me(i);
    for (const i of p(this, ft))
      O(i, xe), me(i);
    p(this, lt).clear(), p(this, ft).clear(), p(this, G) && $e(p(this, G), () => {
      w(this, G, null);
    }), p(this, ge) && (p(this, ee).before(p(this, ge)), w(this, ge, null));
  }
};
function ui(e, t, n, i) {
  const r = hn;
  var s = e.filter((u) => !u.settled);
  if (n.length === 0 && s.length === 0) {
    i(t.map(r));
    return;
  }
  var o = T, l = (
    /** @type {Effect} */
    F
  ), f = ci(), a = s.length === 1 ? s[0].promise : s.length > 1 ? Promise.all(s.map((u) => u.promise)) : null;
  function c(u) {
    f();
    try {
      i(u);
    } catch (v) {
      (l.f & Pe) === 0 && ut(v, l);
    }
    o == null || o.deactivate(), tn();
  }
  if (n.length === 0) {
    a.then(() => c(t.map(r)));
    return;
  }
  function d() {
    f(), Promise.all(n.map((u) => /* @__PURE__ */ di(u))).then((u) => c([...t.map(r), ...u])).catch((u) => ut(u, l));
  }
  a ? a.then(d) : d();
}
function ci() {
  var e = F, t = E, n = ae, i = T;
  return function(s = !0) {
    pe(e), K(t), at(n), s && (i == null || i.activate());
  };
}
function tn() {
  pe(null), K(null), at(null);
}
// @__NO_SIDE_EFFECTS__
function hn(e) {
  var t = Y | W, n = E !== null && (E.f & Y) !== 0 ? (
    /** @type {Derived} */
    E
  ) : null;
  return F !== null && (F.f |= pt), {
    ctx: ae,
    deps: null,
    effects: null,
    equals: Wn,
    f: t,
    fn: e,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      M
    ),
    wv: 0,
    parent: n ?? F,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function di(e, t, n) {
  let i = (
    /** @type {Effect | null} */
    F
  );
  i === null && Ur();
  var r = (
    /** @type {Boundary} */
    i.b
  ), s = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  ), o = je(
    /** @type {V} */
    M
  ), l = !E, f = /* @__PURE__ */ new Map();
  return ki(() => {
    var v;
    var a = qn();
    s = a.promise;
    try {
      Promise.resolve(e()).then(a.resolve, a.reject).then(() => {
        c === T && c.committed && c.deactivate(), tn();
      });
    } catch (h) {
      a.reject(h), tn();
    }
    var c = (
      /** @type {Batch} */
      T
    );
    if (l) {
      var d = r.is_rendered();
      r.update_pending_count(1), c.increment(d), (v = f.get(c)) == null || v.reject(Xe), f.delete(c), f.set(c, a);
    }
    const u = (h, g = void 0) => {
      if (c.activate(), g)
        g !== Xe && (o.f |= Ie, ct(o, g));
      else {
        (o.f & Ie) !== 0 && (o.f ^= Ie), ct(o, h);
        for (const [S, _] of f) {
          if (f.delete(S), S === c) break;
          _.reject(Xe);
        }
      }
      l && (r.update_pending_count(-1), c.decrement(d));
    };
    a.promise.then(u, (h) => u(null, h || "unknown"));
  }), bi(() => {
    for (const a of f.values())
      a.reject(Xe);
  }), new Promise((a) => {
    function c(d) {
      function u() {
        d === s ? a(o) : c(s);
      }
      d.then(u, u);
    }
    c(s);
  });
}
// @__NO_SIDE_EFFECTS__
function ne(e) {
  const t = /* @__PURE__ */ hn(e);
  return mr(t), t;
}
// @__NO_SIDE_EFFECTS__
function hi(e) {
  const t = /* @__PURE__ */ hn(e);
  return t.equals = Zn, t;
}
function ir(e) {
  var t = e.effects;
  if (t !== null) {
    e.effects = null;
    for (var n = 0; n < t.length; n += 1)
      fe(
        /** @type {Effect} */
        t[n]
      );
  }
}
function pi(e) {
  for (var t = e.parent; t !== null; ) {
    if ((t.f & Y) === 0)
      return (t.f & Pe) === 0 ? (
        /** @type {Effect} */
        t
      ) : null;
    t = t.parent;
  }
  return null;
}
function pn(e) {
  var t, n = F;
  pe(pi(e));
  try {
    e.f &= ~Ve, ir(e), t = br(e);
  } finally {
    pe(n);
  }
  return t;
}
function sr(e) {
  var t = pn(e);
  if (!e.equals(t) && (e.wv = xr(), (!(T != null && T.is_fork) || e.deps === null) && (e.v = t, e.deps === null))) {
    O(e, B);
    return;
  }
  dt || (L !== null ? (vn() || T != null && T.is_fork) && L.set(e, t) : cn(e));
}
let nn = /* @__PURE__ */ new Set();
const Ae = /* @__PURE__ */ new Map();
let or = !1;
function je(e, t) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: e,
    reactions: null,
    equals: Wn,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function q(e, t) {
  const n = je(e);
  return mr(n), n;
}
// @__NO_SIDE_EFFECTS__
function vi(e, t = !1, n = !0) {
  const i = je(e);
  return t || (i.equals = Zn), i;
}
function X(e, t, n = !1) {
  E !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!le || (E.f & En) !== 0) && Jn() && (E.f & (Y | we | un | En)) !== 0 && !(U != null && U.includes(e)) && qr();
  let i = n ? re(t) : t;
  return ct(e, i);
}
function ct(e, t) {
  if (!e.equals(t)) {
    var n = e.v;
    dt ? Ae.set(e, t) : Ae.set(e, n), e.v = t;
    var i = Ne.ensure();
    if (i.capture(e, n), (e.f & Y) !== 0) {
      const r = (
        /** @type {Derived} */
        e
      );
      (e.f & W) !== 0 && pn(r), cn(r);
    }
    e.wv = xr(), lr(e, W), F !== null && (F.f & B) !== 0 && (F.f & (Te | Ge)) === 0 && ($ === null ? Fi([e]) : $.push(e)), !i.is_fork && nn.size > 0 && !or && gi();
  }
  return t;
}
function gi() {
  or = !1;
  for (const e of nn)
    (e.f & B) !== 0 && O(e, xe), At(e) && St(e);
  nn.clear();
}
function bt(e) {
  X(e, e.v + 1);
}
function lr(e, t) {
  var n = e.reactions;
  if (n !== null)
    for (var i = n.length, r = 0; r < i; r++) {
      var s = n[r], o = s.f, l = (o & W) === 0;
      if (l && O(s, t), (o & Y) !== 0) {
        var f = (
          /** @type {Derived} */
          s
        );
        L == null || L.delete(f), (o & Ve) === 0 && (o & ie && (s.f |= Ve), lr(f, xe));
      } else l && ((o & we) !== 0 && se !== null && se.add(
        /** @type {Effect} */
        s
      ), me(
        /** @type {Effect} */
        s
      ));
    }
}
function re(e) {
  if (typeof e != "object" || e === null || Ht in e)
    return e;
  const t = Gn(e);
  if (t !== Lr && t !== Yr)
    return e;
  var n = /* @__PURE__ */ new Map(), i = jn(e), r = /* @__PURE__ */ q(0), s = Ue, o = (l) => {
    if (Ue === s)
      return l();
    var f = E, a = Ue;
    K(null), In(s);
    var c = l();
    return K(f), In(a), c;
  };
  return i && n.set("length", /* @__PURE__ */ q(
    /** @type {any[]} */
    e.length
  )), new Proxy(
    /** @type {any} */
    e,
    {
      defineProperty(l, f, a) {
        (!("value" in a) || a.configurable === !1 || a.enumerable === !1 || a.writable === !1) && jr();
        var c = n.get(f);
        return c === void 0 ? c = o(() => {
          var d = /* @__PURE__ */ q(a.value);
          return n.set(f, d), d;
        }) : X(c, a.value, !0), !0;
      },
      deleteProperty(l, f) {
        var a = n.get(f);
        if (a === void 0) {
          if (f in l) {
            const c = o(() => /* @__PURE__ */ q(M));
            n.set(f, c), bt(r);
          }
        } else
          X(a, M), bt(r);
        return !0;
      },
      get(l, f, a) {
        var v;
        if (f === Ht)
          return e;
        var c = n.get(f), d = f in l;
        if (c === void 0 && (!d || (v = yt(l, f)) != null && v.writable) && (c = o(() => {
          var h = re(d ? l[f] : M), g = /* @__PURE__ */ q(h);
          return g;
        }), n.set(f, c)), c !== void 0) {
          var u = x(c);
          return u === M ? void 0 : u;
        }
        return Reflect.get(l, f, a);
      },
      getOwnPropertyDescriptor(l, f) {
        var a = Reflect.getOwnPropertyDescriptor(l, f);
        if (a && "value" in a) {
          var c = n.get(f);
          c && (a.value = x(c));
        } else if (a === void 0) {
          var d = n.get(f), u = d == null ? void 0 : d.v;
          if (d !== void 0 && u !== M)
            return {
              enumerable: !0,
              configurable: !0,
              value: u,
              writable: !0
            };
        }
        return a;
      },
      has(l, f) {
        var u;
        if (f === Ht)
          return !0;
        var a = n.get(f), c = a !== void 0 && a.v !== M || Reflect.has(l, f);
        if (a !== void 0 || F !== null && (!c || (u = yt(l, f)) != null && u.writable)) {
          a === void 0 && (a = o(() => {
            var v = c ? re(l[f]) : M, h = /* @__PURE__ */ q(v);
            return h;
          }), n.set(f, a));
          var d = x(a);
          if (d === M)
            return !1;
        }
        return c;
      },
      set(l, f, a, c) {
        var y;
        var d = n.get(f), u = f in l;
        if (i && f === "length")
          for (var v = a; v < /** @type {Source<number>} */
          d.v; v += 1) {
            var h = n.get(v + "");
            h !== void 0 ? X(h, M) : v in l && (h = o(() => /* @__PURE__ */ q(M)), n.set(v + "", h));
          }
        if (d === void 0)
          (!u || (y = yt(l, f)) != null && y.writable) && (d = o(() => /* @__PURE__ */ q(void 0)), X(d, re(a)), n.set(f, d));
        else {
          u = d.v !== M;
          var g = o(() => re(a));
          X(d, g);
        }
        var S = Reflect.getOwnPropertyDescriptor(l, f);
        if (S != null && S.set && S.set.call(c, a), !u) {
          if (i && typeof f == "string") {
            var _ = (
              /** @type {Source<number>} */
              n.get("length")
            ), m = Number(f);
            Number.isInteger(m) && m >= _.v && X(_, m + 1);
          }
          bt(r);
        }
        return !0;
      },
      ownKeys(l) {
        x(r);
        var f = Reflect.ownKeys(l).filter((d) => {
          var u = n.get(d);
          return u === void 0 || u.v !== M;
        });
        for (var [a, c] of n)
          c.v !== M && !(a in l) && f.push(a);
        return f;
      },
      setPrototypeOf() {
        Gr();
      }
    }
  );
}
var kn, fr, ar;
function _i() {
  if (kn === void 0) {
    kn = window;
    var e = Element.prototype, t = Node.prototype, n = Text.prototype;
    fr = yt(t, "firstChild").get, ar = yt(t, "nextSibling").get, bn(e) && (e.__click = void 0, e.__className = void 0, e.__attributes = null, e.__style = void 0, e.__e = void 0), bn(n) && (n.__t = void 0);
  }
}
function Yt(e = "") {
  return document.createTextNode(e);
}
// @__NO_SIDE_EFFECTS__
function Oe(e) {
  return (
    /** @type {TemplateNode | null} */
    fr.call(e)
  );
}
// @__NO_SIDE_EFFECTS__
function It(e) {
  return (
    /** @type {TemplateNode | null} */
    ar.call(e)
  );
}
function Fe(e, t) {
  return /* @__PURE__ */ Oe(e);
}
function mi(e, t = !1) {
  {
    var n = /* @__PURE__ */ Oe(e);
    return n instanceof Comment && n.data === "" ? /* @__PURE__ */ It(n) : n;
  }
}
function Qe(e, t = 1, n = !1) {
  let i = e;
  for (; t--; )
    i = /** @type {TemplateNode} */
    /* @__PURE__ */ It(i);
  return i;
}
function wi(e) {
  e.textContent = "";
}
function xi() {
  return !1;
}
function ur(e) {
  var t = E, n = F;
  K(null), pe(null);
  try {
    return e();
  } finally {
    K(t), pe(n);
  }
}
function yi(e, t) {
  var n = t.last;
  n === null ? t.last = t.first = e : (n.next = e, e.prev = n, t.last = e);
}
function Re(e, t, n) {
  var i = F;
  i !== null && (i.f & Q) !== 0 && (e |= Q);
  var r = {
    ctx: ae,
    deps: null,
    nodes: null,
    f: e | W | ie,
    first: null,
    fn: t,
    last: null,
    next: null,
    parent: i,
    b: i && i.b,
    prev: null,
    teardown: null,
    wv: 0,
    ac: null
  };
  if (n)
    try {
      St(r), r.f |= Xn;
    } catch (l) {
      throw fe(r), l;
    }
  else t !== null && me(r);
  var s = r;
  if (n && s.deps === null && s.teardown === null && s.nodes === null && s.first === s.last && // either `null`, or a singular child
  (s.f & pt) === 0 && (s = s.first, (e & we) !== 0 && (e & Et) !== 0 && s !== null && (s.f |= Et)), s !== null && (s.parent = i, i !== null && yi(s, i), E !== null && (E.f & Y) !== 0 && (e & Ge) === 0)) {
    var o = (
      /** @type {Derived} */
      E
    );
    (o.effects ?? (o.effects = [])).push(s);
  }
  return r;
}
function vn() {
  return E !== null && !le;
}
function bi(e) {
  const t = Re(Ut, null, !1);
  return O(t, B), t.teardown = e, t;
}
function Ei(e) {
  return Re(Kt | Br, e, !1);
}
function Si(e) {
  Ne.ensure();
  const t = Re(Ge | pt, e, !0);
  return (n = {}) => new Promise((i) => {
    n.outro ? $e(t, () => {
      fe(t), i(void 0);
    }) : (fe(t), i(void 0));
  });
}
function ki(e) {
  return Re(un | pt, e, !0);
}
function Pi(e, t = 0) {
  return Re(Ut | t, e, !0);
}
function Nt(e, t = [], n = [], i = []) {
  ui(i, t, n, (r) => {
    Re(Ut, () => e(...r.map(x)), !0);
  });
}
function cr(e, t = 0) {
  var n = Re(we | t, e, !0);
  return n;
}
function ue(e) {
  return Re(Te | pt, e, !0);
}
function dr(e) {
  var t = e.teardown;
  if (t !== null) {
    const n = dt, i = E;
    Pn(!0), K(null);
    try {
      t.call(null);
    } finally {
      Pn(n), K(i);
    }
  }
}
function hr(e, t = !1) {
  var n = e.first;
  for (e.first = e.last = null; n !== null; ) {
    const r = n.ac;
    r !== null && ur(() => {
      r.abort(Xe);
    });
    var i = n.next;
    (n.f & Ge) !== 0 ? n.parent = null : fe(n, t), n = i;
  }
}
function Ii(e) {
  for (var t = e.first; t !== null; ) {
    var n = t.next;
    (t.f & Te) === 0 && fe(t), t = n;
  }
}
function fe(e, t = !0) {
  var n = !1;
  (t || (e.f & Kn) !== 0) && e.nodes !== null && e.nodes.end !== null && (Ni(
    e.nodes.start,
    /** @type {TemplateNode} */
    e.nodes.end
  ), n = !0), hr(e, t && !n), Dt(e, 0), O(e, Pe);
  var i = e.nodes && e.nodes.t;
  if (i !== null)
    for (const s of i)
      s.stop();
  dr(e);
  var r = e.parent;
  r !== null && r.first !== null && pr(e), e.next = e.prev = e.teardown = e.ctx = e.deps = e.fn = e.nodes = e.ac = null;
}
function Ni(e, t) {
  for (; e !== null; ) {
    var n = e === t ? null : /* @__PURE__ */ It(e);
    e.remove(), e = n;
  }
}
function pr(e) {
  var t = e.parent, n = e.prev, i = e.next;
  n !== null && (n.next = i), i !== null && (i.prev = n), t !== null && (t.first === e && (t.first = i), t.last === e && (t.last = n));
}
function $e(e, t, n = !0) {
  var i = [];
  vr(e, i, !0);
  var r = () => {
    n && fe(e), t && t();
  }, s = i.length;
  if (s > 0) {
    var o = () => --s || r();
    for (var l of i)
      l.out(o);
  } else
    r();
}
function vr(e, t, n) {
  if ((e.f & Q) === 0) {
    e.f ^= Q;
    var i = e.nodes && e.nodes.t;
    if (i !== null)
      for (const l of i)
        (l.is_global || n) && t.push(l);
    for (var r = e.first; r !== null; ) {
      var s = r.next, o = (r.f & Et) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (r.f & Te) !== 0 && (e.f & we) !== 0;
      vr(r, t, o ? n : !1), r = s;
    }
  }
}
function gr(e) {
  _r(e, !0);
}
function _r(e, t) {
  if ((e.f & Q) !== 0) {
    e.f ^= Q, (e.f & B) === 0 && (O(e, W), me(e));
    for (var n = e.first; n !== null; ) {
      var i = n.next, r = (n.f & Et) !== 0 || (n.f & Te) !== 0;
      _r(n, r ? t : !1), n = i;
    }
    var s = e.nodes && e.nodes.t;
    if (s !== null)
      for (const o of s)
        (o.is_global || t) && o.in();
  }
}
function Ai(e, t) {
  if (e.nodes)
    for (var n = e.nodes.start, i = e.nodes.end; n !== null; ) {
      var r = n === i ? null : /* @__PURE__ */ It(n);
      t.append(n), n = r;
    }
}
let Lt = !1, dt = !1;
function Pn(e) {
  dt = e;
}
let E = null, le = !1;
function K(e) {
  E = e;
}
let F = null;
function pe(e) {
  F = e;
}
let U = null;
function mr(e) {
  E !== null && (U === null ? U = [e] : U.push(e));
}
let H = null, J = 0, $ = null;
function Fi(e) {
  $ = e;
}
let wr = 1, Le = 0, Ue = Le;
function In(e) {
  Ue = e;
}
function xr() {
  return ++wr;
}
function At(e) {
  var t = e.f;
  if ((t & W) !== 0)
    return !0;
  if (t & Y && (e.f &= ~Ve), (t & xe) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      e.deps
    ), i = n.length, r = 0; r < i; r++) {
      var s = n[r];
      if (At(
        /** @type {Derived} */
        s
      ) && sr(
        /** @type {Derived} */
        s
      ), s.wv > e.wv)
        return !0;
    }
    (t & ie) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    L === null && O(e, B);
  }
  return !1;
}
function yr(e, t, n = !0) {
  var i = e.reactions;
  if (i !== null && !(U != null && U.includes(e)))
    for (var r = 0; r < i.length; r++) {
      var s = i[r];
      (s.f & Y) !== 0 ? yr(
        /** @type {Derived} */
        s,
        t,
        !1
      ) : t === s && (n ? O(s, W) : (s.f & B) !== 0 && O(s, xe), me(
        /** @type {Effect} */
        s
      ));
    }
}
function br(e) {
  var h;
  var t = H, n = J, i = $, r = E, s = U, o = ae, l = le, f = Ue, a = e.f;
  H = /** @type {null | Value[]} */
  null, J = 0, $ = null, E = (a & (Te | Ge)) === 0 ? e : null, U = null, at(e.ctx), le = !1, Ue = ++Le, e.ac !== null && (ur(() => {
    e.ac.abort(Xe);
  }), e.ac = null);
  try {
    e.f |= Wt;
    var c = (
      /** @type {Function} */
      e.fn
    ), d = c(), u = e.deps;
    if (H !== null) {
      var v;
      if (Dt(e, J), u !== null && J > 0)
        for (u.length = J + H.length, v = 0; v < H.length; v++)
          u[J + v] = H[v];
      else
        e.deps = u = H;
      if (vn() && (e.f & ie) !== 0)
        for (v = J; v < u.length; v++)
          ((h = u[v]).reactions ?? (h.reactions = [])).push(e);
    } else u !== null && J < u.length && (Dt(e, J), u.length = J);
    if (Jn() && $ !== null && !le && u !== null && (e.f & (Y | xe | W)) === 0)
      for (v = 0; v < /** @type {Source[]} */
      $.length; v++)
        yr(
          $[v],
          /** @type {Effect} */
          e
        );
    if (r !== null && r !== e) {
      if (Le++, r.deps !== null)
        for (let g = 0; g < n; g += 1)
          r.deps[g].rv = Le;
      if (t !== null)
        for (const g of t)
          g.rv = Le;
      $ !== null && (i === null ? i = $ : i.push(.../** @type {Source[]} */
      $));
    }
    return (e.f & Ie) !== 0 && (e.f ^= Ie), d;
  } catch (g) {
    return Qn(g);
  } finally {
    e.f ^= Wt, H = t, J = n, $ = i, E = r, U = s, at(o), le = l, Ue = f;
  }
}
function Ti(e, t) {
  let n = t.reactions;
  if (n !== null) {
    var i = Cr.call(n, e);
    if (i !== -1) {
      var r = n.length - 1;
      r === 0 ? n = t.reactions = null : (n[i] = n[r], n.pop());
    }
  }
  if (n === null && (t.f & Y) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (H === null || !H.includes(t))) {
    var s = (
      /** @type {Derived} */
      t
    );
    (s.f & ie) !== 0 && (s.f ^= ie, s.f &= ~Ve), cn(s), ir(s), Dt(s, 0);
  }
}
function Dt(e, t) {
  var n = e.deps;
  if (n !== null)
    for (var i = t; i < n.length; i++)
      Ti(e, n[i]);
}
function St(e) {
  var t = e.f;
  if ((t & Pe) === 0) {
    O(e, B);
    var n = F, i = Lt;
    F = e, Lt = !0;
    try {
      (t & (we | Hn)) !== 0 ? Ii(e) : hr(e), dr(e);
      var r = br(e);
      e.teardown = typeof r == "function" ? r : null, e.wv = wr;
      var s;
    } finally {
      Lt = i, F = n;
    }
  }
}
function x(e) {
  var t = e.f, n = (t & Y) !== 0;
  if (E !== null && !le) {
    var i = F !== null && (F.f & Pe) !== 0;
    if (!i && !(U != null && U.includes(e))) {
      var r = E.deps;
      if ((E.f & Wt) !== 0)
        e.rv < Le && (e.rv = Le, H === null && r !== null && r[J] === e ? J++ : H === null ? H = [e] : H.push(e));
      else {
        (E.deps ?? (E.deps = [])).push(e);
        var s = e.reactions;
        s === null ? e.reactions = [E] : s.includes(E) || s.push(E);
      }
    }
  }
  if (dt && Ae.has(e))
    return Ae.get(e);
  if (n) {
    var o = (
      /** @type {Derived} */
      e
    );
    if (dt) {
      var l = o.v;
      return ((o.f & B) === 0 && o.reactions !== null || Sr(o)) && (l = pn(o)), Ae.set(o, l), l;
    }
    var f = (o.f & ie) === 0 && !le && E !== null && (Lt || (E.f & ie) !== 0), a = o.deps === null;
    At(o) && (f && (o.f |= ie), sr(o)), f && !a && Er(o);
  }
  if (L != null && L.has(e))
    return L.get(e);
  if ((e.f & Ie) !== 0)
    throw e.v;
  return e.v;
}
function Er(e) {
  if (e.deps !== null) {
    e.f |= ie;
    for (const t of e.deps)
      (t.reactions ?? (t.reactions = [])).push(e), (t.f & Y) !== 0 && (t.f & ie) === 0 && Er(
        /** @type {Derived} */
        t
      );
  }
}
function Sr(e) {
  if (e.v === M) return !0;
  if (e.deps === null) return !1;
  for (const t of e.deps)
    if (Ae.has(t) || (t.f & Y) !== 0 && Sr(
      /** @type {Derived} */
      t
    ))
      return !0;
  return !1;
}
function Ri(e) {
  var t = le;
  try {
    return le = !0, e();
  } finally {
    le = t;
  }
}
const Ci = ["touchstart", "touchmove"];
function Oi(e) {
  return Ci.includes(e);
}
const kr = /* @__PURE__ */ new Set(), rn = /* @__PURE__ */ new Set();
function Mi(e) {
  for (var t = 0; t < e.length; t++)
    kr.add(e[t]);
  for (var n of rn)
    n(e);
}
let Nn = null;
function Rt(e) {
  var S;
  var t = this, n = (
    /** @type {Node} */
    t.ownerDocument
  ), i = e.type, r = ((S = e.composedPath) == null ? void 0 : S.call(e)) || [], s = (
    /** @type {null | Element} */
    r[0] || e.target
  );
  Nn = e;
  var o = 0, l = Nn === e && e.__root;
  if (l) {
    var f = r.indexOf(l);
    if (f !== -1 && (t === document || t === /** @type {any} */
    window)) {
      e.__root = t;
      return;
    }
    var a = r.indexOf(t);
    if (a === -1)
      return;
    f <= a && (o = f);
  }
  if (s = /** @type {Element} */
  r[o] || e.target, s !== t) {
    Or(e, "currentTarget", {
      configurable: !0,
      get() {
        return s || n;
      }
    });
    var c = E, d = F;
    K(null), pe(null);
    try {
      for (var u, v = []; s !== null; ) {
        var h = s.assignedSlot || s.parentNode || /** @type {any} */
        s.host || null;
        try {
          var g = s["__" + i];
          g != null && (!/** @type {any} */
          s.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
          // -> the target could not have been disabled because it emits the event in the first place
          e.target === s) && g.call(s, e);
        } catch (_) {
          u ? v.push(_) : u = _;
        }
        if (e.cancelBubble || h === t || h === null)
          break;
        s = h;
      }
      if (u) {
        for (let _ of v)
          queueMicrotask(() => {
            throw _;
          });
        throw u;
      }
    } finally {
      e.__root = t, delete e.currentTarget, K(c), pe(d);
    }
  }
}
function Li(e) {
  var t = document.createElement("template");
  return t.innerHTML = e.replaceAll("<!>", "<!---->"), t.content;
}
function An(e, t) {
  var n = (
    /** @type {Effect} */
    F
  );
  n.nodes === null && (n.nodes = { start: e, end: t, a: null, t: null });
}
// @__NO_SIDE_EFFECTS__
function Yi(e, t, n = "svg") {
  var i = !e.startsWith("<!>"), r = (t & Zr) !== 0, s = `<${n}>${i ? e : "<!>" + e}</${n}>`, o;
  return () => {
    if (!o) {
      var l = (
        /** @type {DocumentFragment} */
        Li(s)
      ), f = (
        /** @type {Element} */
        /* @__PURE__ */ Oe(l)
      );
      if (r)
        for (o = document.createDocumentFragment(); /* @__PURE__ */ Oe(f); )
          o.appendChild(
            /** @type {TemplateNode} */
            /* @__PURE__ */ Oe(f)
          );
      else
        o = /** @type {Element} */
        /* @__PURE__ */ Oe(f);
    }
    var a = (
      /** @type {TemplateNode} */
      o.cloneNode(!0)
    );
    if (r) {
      var c = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ Oe(a)
      ), d = (
        /** @type {TemplateNode} */
        a.lastChild
      );
      An(c, d);
    } else
      An(a, a);
    return a;
  };
}
// @__NO_SIDE_EFFECTS__
function _t(e, t) {
  return /* @__PURE__ */ Yi(e, t, "svg");
}
function ht(e, t) {
  e !== null && e.before(
    /** @type {Node} */
    t
  );
}
function gn(e, t) {
  var n = t == null ? "" : typeof t == "object" ? t + "" : t;
  n !== (e.__t ?? (e.__t = e.nodeValue)) && (e.__t = n, e.nodeValue = n + "");
}
function Di(e, t) {
  return Bi(e, t);
}
const qe = /* @__PURE__ */ new Map();
function Bi(e, { target: t, anchor: n, props: i = {}, events: r, context: s, intro: o = !0 }) {
  _i();
  var l = /* @__PURE__ */ new Set(), f = (d) => {
    for (var u = 0; u < d.length; u++) {
      var v = d[u];
      if (!l.has(v)) {
        l.add(v);
        var h = Oi(v);
        t.addEventListener(v, Rt, { passive: h });
        var g = qe.get(v);
        g === void 0 ? (document.addEventListener(v, Rt, { passive: h }), qe.set(v, 1)) : qe.set(v, g + 1);
      }
    }
  };
  f(zt(kr)), rn.add(f);
  var a = void 0, c = Si(() => {
    var d = n ?? t.appendChild(Yt());
    return oi(
      /** @type {TemplateNode} */
      d,
      {
        pending: () => {
        }
      },
      (u) => {
        if (s) {
          vt({});
          var v = (
            /** @type {ComponentContext} */
            ae
          );
          v.c = s;
        }
        r && (i.$$events = r), a = e(u, i) || {}, s && gt();
      }
    ), () => {
      var h;
      for (var u of l) {
        t.removeEventListener(u, Rt);
        var v = (
          /** @type {number} */
          qe.get(u)
        );
        --v === 0 ? (document.removeEventListener(u, Rt), qe.delete(u)) : qe.set(u, v);
      }
      rn.delete(f), d !== n && ((h = d.parentNode) == null || h.removeChild(d));
    };
  });
  return sn.set(a, c), a;
}
let sn = /* @__PURE__ */ new WeakMap();
function Fn(e, t) {
  const n = sn.get(e);
  return n ? (sn.delete(e), n(t)) : Promise.resolve();
}
function zi(e, t, n) {
  for (var i = [], r = t.length, s, o = t.length, l = 0; l < r; l++) {
    let d = t[l];
    $e(
      d,
      () => {
        if (s) {
          if (s.pending.delete(d), s.done.add(d), s.pending.size === 0) {
            var u = (
              /** @type {Set<EachOutroGroup>} */
              e.outrogroups
            );
            on(zt(s.done)), u.delete(s), u.size === 0 && (e.outrogroups = null);
          }
        } else
          o -= 1;
      },
      !1
    );
  }
  if (o === 0) {
    var f = i.length === 0 && n !== null;
    if (f) {
      var a = (
        /** @type {Element} */
        n
      ), c = (
        /** @type {Element} */
        a.parentNode
      );
      wi(c), c.append(a), e.items.clear();
    }
    on(t, !f);
  } else
    s = {
      pending: new Set(t),
      done: /* @__PURE__ */ new Set()
    }, (e.outrogroups ?? (e.outrogroups = /* @__PURE__ */ new Set())).add(s);
}
function on(e, t = !0) {
  for (var n = 0; n < e.length; n++)
    fe(e[n], t);
}
var Tn;
function Ct(e, t, n, i, r, s = null) {
  var o = e, l = /* @__PURE__ */ new Map(), f = null, a = /* @__PURE__ */ hi(() => {
    var g = n();
    return jn(g) ? g : g == null ? [] : zt(g);
  }), c, d = !0;
  function u() {
    h.fallback = f, Ui(h, c, o, t, i), f !== null && (c.length === 0 ? (f.f & ke) === 0 ? gr(f) : (f.f ^= ke, xt(f, null, o)) : $e(f, () => {
      f = null;
    }));
  }
  var v = cr(() => {
    c = /** @type {V[]} */
    x(a);
    for (var g = c.length, S = /* @__PURE__ */ new Set(), _ = (
      /** @type {Batch} */
      T
    ), m = xi(), y = 0; y < g; y += 1) {
      var I = c[y], k = i(I, y), P = d ? null : l.get(k);
      P ? (P.v && ct(P.v, I), P.i && ct(P.i, y), m && _.skipped_effects.delete(P.e)) : (P = Vi(
        l,
        d ? o : Tn ?? (Tn = Yt()),
        I,
        k,
        y,
        r,
        t,
        n
      ), d || (P.e.f |= ke), l.set(k, P)), S.add(k);
    }
    if (g === 0 && s && !f && (d ? f = ue(() => s(o)) : (f = ue(() => s(Tn ?? (Tn = Yt()))), f.f |= ke)), !d)
      if (m) {
        for (const [R, V] of l)
          S.has(R) || _.skipped_effects.add(V.e);
        _.oncommit(u), _.ondiscard(() => {
        });
      } else
        u();
    x(a);
  }), h = { effect: v, items: l, outrogroups: null, fallback: f };
  d = !1;
}
function Ui(e, t, n, i, r) {
  var V;
  var s = t.length, o = e.items, l = e.effect.first, f, a = null, c = [], d = [], u, v, h, g;
  for (g = 0; g < s; g += 1) {
    if (u = t[g], v = r(u, g), h = /** @type {EachItem} */
    o.get(v).e, e.outrogroups !== null)
      for (const j of e.outrogroups)
        j.pending.delete(h), j.done.delete(h);
    if ((h.f & ke) !== 0)
      if (h.f ^= ke, h === l)
        xt(h, null, n);
      else {
        var S = a ? a.next : l;
        h === e.effect.last && (e.effect.last = h.prev), h.prev && (h.prev.next = h.next), h.next && (h.next.prev = h.prev), be(e, a, h), be(e, h, S), xt(h, S, n), a = h, c = [], d = [], l = a.next;
        continue;
      }
    if ((h.f & Q) !== 0 && gr(h), h !== l) {
      if (f !== void 0 && f.has(h)) {
        if (c.length < d.length) {
          var _ = d[0], m;
          a = _.prev;
          var y = c[0], I = c[c.length - 1];
          for (m = 0; m < c.length; m += 1)
            xt(c[m], _, n);
          for (m = 0; m < d.length; m += 1)
            f.delete(d[m]);
          be(e, y.prev, I.next), be(e, a, y), be(e, I, _), l = _, a = I, g -= 1, c = [], d = [];
        } else
          f.delete(h), xt(h, l, n), be(e, h.prev, h.next), be(e, h, a === null ? e.effect.first : a.next), be(e, a, h), a = h;
        continue;
      }
      for (c = [], d = []; l !== null && l !== h; )
        (f ?? (f = /* @__PURE__ */ new Set())).add(l), d.push(l), l = l.next;
      if (l === null)
        continue;
    }
    (h.f & ke) === 0 && c.push(h), a = h, l = h.next;
  }
  if (e.outrogroups !== null) {
    for (const j of e.outrogroups)
      j.pending.size === 0 && (on(zt(j.done)), (V = e.outrogroups) == null || V.delete(j));
    e.outrogroups.size === 0 && (e.outrogroups = null);
  }
  if (l !== null || f !== void 0) {
    var k = [];
    if (f !== void 0)
      for (h of f)
        (h.f & Q) === 0 && k.push(h);
    for (; l !== null; )
      (l.f & Q) === 0 && l !== e.fallback && k.push(l), l = l.next;
    var P = k.length;
    if (P > 0) {
      var R = null;
      zi(e, k, R);
    }
  }
}
function Vi(e, t, n, i, r, s, o, l) {
  var f = (o & Xr) !== 0 ? (o & Wr) === 0 ? /* @__PURE__ */ vi(n, !1, !1) : je(n) : null, a = (o & Kr) !== 0 ? je(r) : null;
  return {
    v: f,
    i: a,
    e: ue(() => (s(t, f ?? n, a ?? r, l), () => {
      e.delete(i);
    }))
  };
}
function xt(e, t, n) {
  if (e.nodes)
    for (var i = e.nodes.start, r = e.nodes.end, s = t && (t.f & ke) === 0 ? (
      /** @type {EffectNodes} */
      t.nodes.start
    ) : n; i !== null; ) {
      var o = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ It(i)
      );
      if (s.before(i), i === r)
        return;
      i = o;
    }
}
function be(e, t, n) {
  t === null ? e.effect.first = n : t.next = n, n === null ? e.effect.last = t : n.prev = t;
}
const Rn = [...` 	
\r\f \v\uFEFF`];
function ji(e, t, n) {
  var i = "" + e;
  if (n) {
    for (var r in n)
      if (n[r])
        i = i ? i + " " + r : r;
      else if (i.length)
        for (var s = r.length, o = 0; (o = i.indexOf(r, o)) >= 0; ) {
          var l = o + s;
          (o === 0 || Rn.includes(i[o - 1])) && (l === i.length || Rn.includes(i[l])) ? i = (o === 0 ? "" : i.substring(0, o)) + i.substring(l + 1) : o = l;
        }
  }
  return i === "" ? null : i;
}
function Gi(e, t) {
  return e == null ? null : String(e);
}
function qi(e, t, n, i, r, s) {
  var o = e.__className;
  if (o !== n || o === void 0) {
    var l = ji(n, i, s);
    l == null ? e.removeAttribute("class") : e.setAttribute("class", l), e.__className = n;
  } else if (s && r !== s)
    for (var f in s) {
      var a = !!s[f];
      (r == null || a !== !!r[f]) && e.classList.toggle(f, a);
    }
  return s;
}
function Hi(e, t, n, i) {
  var r = e.__style;
  if (r !== t) {
    var s = Gi(t);
    s == null ? e.removeAttribute("style") : e.style.cssText = s, e.__style = t;
  }
  return i;
}
const Xi = Symbol("is custom element"), Ki = Symbol("is html");
function A(e, t, n, i) {
  var r = Wi(e);
  r[t] !== (r[t] = n) && (t === "loading" && (e[zr] = n), n == null ? e.removeAttribute(t) : typeof n != "string" && Zi(e).includes(t) ? e[t] = n : e.setAttribute(t, n));
}
function Wi(e) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    e.__attributes ?? (e.__attributes = {
      [Xi]: e.nodeName.includes("-"),
      [Ki]: e.namespaceURI === Jr
    })
  );
}
var Cn = /* @__PURE__ */ new Map();
function Zi(e) {
  var t = e.getAttribute("is") || e.nodeName, n = Cn.get(t);
  if (n) return n;
  Cn.set(t, n = []);
  for (var i, r = e, s = Element.prototype; s !== r; ) {
    i = Mr(r);
    for (var o in i)
      i[o].set && n.push(o);
    r = Gn(r);
  }
  return n;
}
const Ji = "5";
var Vn;
typeof window < "u" && ((Vn = window.__svelte ?? (window.__svelte = {})).v ?? (Vn.v = /* @__PURE__ */ new Set())).add(Ji);
const Qi = [
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
Qi.map(([e, t]) => [e.slice().sort((n, i) => i.length - n.length), t]);
const $i = 5.5;
var b;
(function(e) {
  e.Router = "router", e.L3Switch = "l3-switch", e.L2Switch = "l2-switch", e.Firewall = "firewall", e.LoadBalancer = "load-balancer", e.Server = "server", e.AccessPoint = "access-point", e.CPE = "cpe", e.Cloud = "cloud", e.Internet = "internet", e.VPN = "vpn", e.Database = "database", e.Generic = "generic";
})(b || (b = {}));
b.Router + "", b.L3Switch + "", b.L2Switch + "", b.Firewall + "", b.LoadBalancer + "", b.Server + "", b.AccessPoint + "", b.CPE + "", b.Cloud + "", b.Internet + "", b.VPN + "", b.Database + "", b.Generic + "";
function es(e) {
  var t;
  if ((t = e.style) != null && t.strokeWidth)
    return e.style.strokeWidth;
  switch (e.bandwidth) {
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
  return e.type === "thick" ? 3 : 2;
}
const ts = 1, Pr = 2, ns = 4, rs = 8;
function is(e) {
  switch (e) {
    case "top":
      return ts;
    case "bottom":
      return Pr;
    case "left":
      return ns;
    case "right":
      return rs;
  }
}
function We(e) {
  return typeof e == "string" ? e : e.node;
}
function Ze(e) {
  return typeof e == "string" ? void 0 : e.port;
}
function On(e) {
  return typeof e == "string" ? { node: e } : e;
}
let Xt = null;
async function ss() {
  if (!Xt) {
    const { AvoidLib: e } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await e.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await e.load(process.env.LIBAVOID_WASM_PATH) : await e.load(), Xt = e.getInstance();
  }
  return Xt;
}
async function os(e, t, n, i) {
  const r = await ss(), s = {
    edgeStyle: "orthogonal",
    shapeBufferDistance: 10,
    idealNudgingDistance: 20,
    ...i
  }, o = s.edgeStyle === "polyline" ? r.RouterFlag.PolyLineRouting.value : r.RouterFlag.OrthogonalRouting.value, l = new r.Router(o);
  l.setRoutingParameter(r.RoutingParameter.shapeBufferDistance.value, s.shapeBufferDistance), l.setRoutingParameter(r.RoutingParameter.idealNudgingDistance.value, s.idealNudgingDistance), l.setRoutingParameter(r.RoutingParameter.reverseDirectionPenalty.value, 500), l.setRoutingParameter(r.RoutingParameter.segmentPenalty.value, 50), l.setRoutingOption(r.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes.value, !0), l.setRoutingOption(r.RoutingOption.nudgeOrthogonalTouchingColinearSegments.value, !0), l.setRoutingOption(r.RoutingOption.performUnifyingNudgingPreprocessingStep.value, !0), l.setRoutingOption(r.RoutingOption.nudgeSharedPathsWithCommonEndPoint.value, !0);
  try {
    return cs(r, l, e, t, n, s.edgeStyle);
  } finally {
    l.delete();
  }
}
function ls(e, t, n) {
  const i = /* @__PURE__ */ new Map();
  for (const [r, s] of n)
    i.set(r, new e.ShapeRef(t, new e.Rectangle(new e.Point(s.position.x, s.position.y), s.size.width, s.size.height)));
  return i;
}
function fs(e, t, n, i) {
  const r = /* @__PURE__ */ new Map();
  let s = 1;
  for (const [o, l] of i) {
    const f = t.get(l.nodeId), a = n.get(l.nodeId);
    if (!f || !a)
      continue;
    const c = s++;
    r.set(o, c);
    const d = (l.absolutePosition.x - (a.position.x - a.size.width / 2)) / a.size.width, u = (l.absolutePosition.y - (a.position.y - a.size.height / 2)) / a.size.height, v = l.side === "top" || l.side === "bottom" ? Pr : is(l.side);
    new e.ShapeConnectionPin(f, c, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, u)), !0, 0, v).setExclusive(!1);
  }
  return r;
}
function as(e, t, n, i, r, s, o) {
  const l = /* @__PURE__ */ new Map();
  let f = null, a = null;
  for (const [d, u] of o.entries()) {
    const v = u.id ?? `__link_${d}`, h = We(u.from), g = We(u.to);
    if (!n.has(h) || !n.has(g))
      continue;
    const S = Ze(u.from), _ = Ze(u.to), m = S ? `${h}:${S}` : null, y = _ ? `${g}:${_}` : null, I = m ? i.get(m) : void 0;
    let k;
    if (I !== void 0)
      k = new e.ConnEnd(n.get(h), I);
    else {
      const mt = m ? s.get(m) : void 0, wt = r.get(h), ye = (mt == null ? void 0 : mt.absolutePosition) ?? (wt == null ? void 0 : wt.position);
      if (!ye)
        continue;
      k = new e.ConnEnd(new e.Point(ye.x, ye.y));
    }
    const P = y ? s.get(y) : void 0, R = r.get(g), V = (P == null ? void 0 : P.absolutePosition) ?? (R == null ? void 0 : R.position);
    if (!V)
      continue;
    const j = new e.ConnEnd(new e.Point(V.x, V.y)), Ft = new e.ConnRef(t, k, j), Ce = y ? s.get(y) : null;
    if (Ce) {
      const mt = Math.max(Ce.size.width, Ce.size.height) / 2, wt = Ce.label.length * $i + 8, ye = mt + wt;
      let jt = Ce.absolutePosition.x, Gt = Ce.absolutePosition.y;
      switch (Ce.side) {
        case "top":
          Gt -= ye;
          break;
        case "bottom":
          Gt += ye;
          break;
        case "left":
          jt -= ye;
          break;
        case "right":
          jt += ye;
          break;
      }
      const xn = new e.CheckpointVector();
      xn.push_back(new e.Checkpoint(new e.Point(jt, Gt))), Ft.setRoutingCheckpoints(xn);
    }
    l.set(v, Ft), f === null && I !== void 0 && m && (f = v, a = m);
  }
  t.processTransaction();
  let c = !0;
  if (f && a) {
    const d = l.get(f), u = s.get(a);
    if (d && u) {
      const v = d.displayRoute();
      if (v.size() > 0) {
        const h = v.at(0), g = Math.abs(h.x - u.absolutePosition.x), S = Math.abs(h.y - u.absolutePosition.y);
        (g > 2 || S > 2) && (console.warn(`[libavoid] Pin-based ConnEnd not working (delta=${g.toFixed(1)},${S.toFixed(1)}). Falling back to Point-based.`), c = !1);
      }
    }
  }
  if (!c) {
    t.processTransaction(), l.clear();
    for (const [d, u] of o.entries()) {
      const v = u.id ?? `__link_${d}`, h = We(u.from), g = We(u.to);
      if (!n.has(h) || !n.has(g))
        continue;
      const S = Ze(u.from), _ = Ze(u.to), m = S ? `${h}:${S}` : null, y = _ ? `${g}:${_}` : null, I = m ? s.get(m) : void 0, k = r.get(h), P = (I == null ? void 0 : I.absolutePosition) ?? (k == null ? void 0 : k.position);
      if (!P)
        continue;
      const R = y ? s.get(y) : void 0, V = r.get(g), j = (R == null ? void 0 : R.absolutePosition) ?? (V == null ? void 0 : V.position);
      if (!j)
        continue;
      const Ft = new e.ConnRef(t, new e.ConnEnd(new e.Point(P.x, P.y)), new e.ConnEnd(new e.Point(j.x, j.y)));
      l.set(v, Ft);
    }
    t.processTransaction();
  }
  return l;
}
function us(e, t, n) {
  const i = /* @__PURE__ */ new Map();
  for (const [r, s] of t.entries()) {
    const o = s.id ?? `__link_${r}`, l = e.get(o);
    if (!l)
      continue;
    const f = l.displayRoute(), a = [];
    for (let _ = 0; _ < f.size(); _++) {
      const m = f.at(_);
      a.push({ x: m.x, y: m.y });
    }
    const c = a[0], d = a[a.length - 1], u = n === "straight" && a.length > 2 && c && d ? [c, d] : a, v = We(s.from), h = We(s.to), g = Ze(s.from), S = Ze(s.to);
    i.set(o, {
      id: o,
      fromPortId: g ? `${v}:${g}` : null,
      toPortId: S ? `${h}:${S}` : null,
      fromNodeId: v,
      toNodeId: h,
      fromEndpoint: On(s.from),
      toEndpoint: On(s.to),
      points: u,
      width: es(s),
      link: s
    });
  }
  return i;
}
function cs(e, t, n, i, r, s) {
  const o = ls(e, t, n), l = fs(e, o, n, i), f = as(e, t, o, l, n, i, r), a = us(f, r, s), c = ds(a);
  return ps(c);
}
function ds(e) {
  const t = /* @__PURE__ */ new Map();
  for (const [r, s] of e)
    t.set(r, {
      ...s,
      points: s.points.map((o) => ({ ...o }))
    });
  const n = [];
  for (const [r, s] of t)
    for (const [o, l] of s.points.entries()) {
      const f = s.points[o + 1];
      f && Math.abs(l.y - f.y) < 0.5 && Math.abs(l.x - f.x) > 1 && n.push({
        edgeId: r,
        pointIndex: o,
        fixed: l.y,
        min: Math.min(l.x, f.x),
        max: Math.max(l.x, f.x),
        width: s.width
      });
    }
  Mn(n, t, "y");
  const i = [];
  for (const [r, s] of t)
    for (const [o, l] of s.points.entries()) {
      const f = s.points[o + 1];
      f && Math.abs(l.x - f.x) < 0.5 && Math.abs(l.y - f.y) > 1 && i.push({
        edgeId: r,
        pointIndex: o,
        fixed: l.x,
        min: Math.min(l.y, f.y),
        max: Math.max(l.y, f.y),
        width: s.width
      });
    }
  return Mn(i, t, "x"), t;
}
function Mn(e, t, n) {
  if (!(e.length < 2)) {
    e.sort((i, r) => i.fixed - r.fixed);
    for (const [i, r] of e.entries()) {
      const s = e[i + 1];
      if (!s || r.max <= s.min || s.max <= r.min)
        continue;
      const o = (r.width + s.width) / 2 + Math.max(r.width, s.width), l = Math.abs(s.fixed - r.fixed);
      if (l >= o)
        continue;
      const a = (o - l) / 2;
      Ln(t, r, -a, n), Ln(t, s, a, n), r.fixed -= a, s.fixed += a;
    }
  }
}
function Ln(e, t, n, i) {
  const r = e.get(t.edgeId);
  if (!r)
    return;
  const s = r.points[t.pointIndex], o = r.points[t.pointIndex + 1];
  !s || !o || (i === "y" ? (s.y += n, o.y += n) : (s.x += n, o.x += n));
}
const hs = 8, Yn = 6;
function ps(e) {
  const t = /* @__PURE__ */ new Map();
  for (const [n, i] of e)
    t.set(n, {
      ...i,
      points: vs(i.points, hs)
    });
  return t;
}
function vs(e, t) {
  if (e.length < 3)
    return [...e];
  const n = [], i = e[0];
  if (!i)
    return [...e];
  n.push({ ...i });
  for (const [s, o] of e.entries()) {
    if (s === 0 || s === e.length - 1)
      continue;
    const l = e[s - 1], f = e[s + 1];
    if (!l || !f) {
      n.push({ ...o });
      continue;
    }
    const a = Math.hypot(o.x - l.x, o.y - l.y), c = Math.hypot(f.x - o.x, f.y - o.y), d = Math.min(t, a / 2, c / 2);
    if (d < 1) {
      n.push({ ...o });
      continue;
    }
    const u = (l.x - o.x) / a, v = (l.y - o.y) / a, h = (f.x - o.x) / c, g = (f.y - o.y) / c, S = u * g - v * h;
    if (Math.abs(S) < 1e-3) {
      n.push({ ...o });
      continue;
    }
    const _ = o.x + u * d, m = o.y + v * d, y = o.x + h * d, I = o.y + g * d;
    for (let k = 0; k <= Yn; k++) {
      const P = k / Yn, R = 1 - P, V = R * R * _ + 2 * R * P * o.x + P * P * y, j = R * R * m + 2 * R * P * o.y + P * P * I;
      n.push({ x: V, y: j });
    }
  }
  const r = e[e.length - 1];
  return r && n.push({ ...r }), n;
}
const Vt = 8;
function gs(e, t, n = Vt) {
  return e.x - e.w / 2 - n < t.x + t.w / 2 && e.x + e.w / 2 + n > t.x - t.w / 2 && e.y - e.h / 2 - n < t.y + t.h / 2 && e.y + e.h / 2 + n > t.y - t.h / 2;
}
function _s(e, t, n = Vt) {
  const i = [
    { x: t.x - t.w / 2 - e.w / 2 - n, y: e.y },
    { x: t.x + t.w / 2 + e.w / 2 + n, y: e.y },
    { x: e.x, y: t.y - t.h / 2 - e.h / 2 - n },
    { x: e.x, y: t.y + t.h / 2 + e.h / 2 + n }
  ];
  let r = i[0], s = Number.POSITIVE_INFINITY;
  for (const o of i) {
    const l = Math.hypot(o.x - e.x, o.y - e.y);
    l < s && (s = l, r = o);
  }
  return r ?? { x: e.x, y: e.y };
}
function ms(e, t, n, i, r = Vt) {
  const s = i.get(e);
  if (!s)
    return { x: t, y: n };
  let o = t, l = n;
  for (const [f, a] of i) {
    if (f === e)
      continue;
    const c = { x: o, y: l, w: s.size.width, h: s.size.height }, d = {
      x: a.position.x,
      y: a.position.y,
      w: a.size.width,
      h: a.size.height
    };
    if (gs(c, d, r)) {
      const u = _s(c, d, r);
      o = u.x, l = u.y;
    }
  }
  return { x: o, y: l };
}
async function ws(e, t, n, i, r, s = Vt) {
  const o = i.nodes.get(e);
  if (!o)
    return null;
  const { x: l, y: f } = ms(e, t, n, i.nodes, s), a = l - o.position.x, c = f - o.position.y;
  if (a === 0 && c === 0)
    return null;
  const d = new Map(i.nodes);
  d.set(e, { ...o, position: { x: l, y: f } });
  const u = new Map(i.ports);
  for (const [h, g] of i.ports)
    g.nodeId === e && u.set(h, {
      ...g,
      absolutePosition: {
        x: g.absolutePosition.x + a,
        y: g.absolutePosition.y + c
      }
    });
  const v = await os(d, u, r);
  return { nodes: d, ports: u, edges: v };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function Ir(e) {
  return typeof e > "u" || e === null;
}
function xs(e) {
  return typeof e == "object" && e !== null;
}
function ys(e) {
  return Array.isArray(e) ? e : Ir(e) ? [] : [e];
}
function bs(e, t) {
  var n, i, r, s;
  if (t)
    for (s = Object.keys(t), n = 0, i = s.length; n < i; n += 1)
      r = s[n], e[r] = t[r];
  return e;
}
function Es(e, t) {
  var n = "", i;
  for (i = 0; i < t; i += 1)
    n += e;
  return n;
}
function Ss(e) {
  return e === 0 && Number.NEGATIVE_INFINITY === 1 / e;
}
var ks = Ir, Ps = xs, Is = ys, Ns = Es, As = Ss, Fs = bs, _n = {
  isNothing: ks,
  isObject: Ps,
  toArray: Is,
  repeat: Ns,
  isNegativeZero: As,
  extend: Fs
};
function Nr(e, t) {
  var n = "", i = e.reason || "(unknown reason)";
  return e.mark ? (e.mark.name && (n += 'in "' + e.mark.name + '" '), n += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")", !t && e.mark.snippet && (n += `

` + e.mark.snippet), i + " " + n) : i;
}
function kt(e, t) {
  Error.call(this), this.name = "YAMLException", this.reason = e, this.mark = t, this.message = Nr(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
kt.prototype = Object.create(Error.prototype);
kt.prototype.constructor = kt;
kt.prototype.toString = function(t) {
  return this.name + ": " + Nr(this, t);
};
var Me = kt, Ts = [
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
], Rs = [
  "scalar",
  "sequence",
  "mapping"
];
function Cs(e) {
  var t = {};
  return e !== null && Object.keys(e).forEach(function(n) {
    e[n].forEach(function(i) {
      t[String(i)] = n;
    });
  }), t;
}
function Os(e, t) {
  if (t = t || {}, Object.keys(t).forEach(function(n) {
    if (Ts.indexOf(n) === -1)
      throw new Me('Unknown option "' + n + '" is met in definition of "' + e + '" YAML type.');
  }), this.options = t, this.tag = e, this.kind = t.kind || null, this.resolve = t.resolve || function() {
    return !0;
  }, this.construct = t.construct || function(n) {
    return n;
  }, this.instanceOf = t.instanceOf || null, this.predicate = t.predicate || null, this.represent = t.represent || null, this.representName = t.representName || null, this.defaultStyle = t.defaultStyle || null, this.multi = t.multi || !1, this.styleAliases = Cs(t.styleAliases || null), Rs.indexOf(this.kind) === -1)
    throw new Me('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.');
}
var z = Os;
function Dn(e, t) {
  var n = [];
  return e[t].forEach(function(i) {
    var r = n.length;
    n.forEach(function(s, o) {
      s.tag === i.tag && s.kind === i.kind && s.multi === i.multi && (r = o);
    }), n[r] = i;
  }), n;
}
function Ms() {
  var e = {
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
  }, t, n;
  function i(r) {
    r.multi ? (e.multi[r.kind].push(r), e.multi.fallback.push(r)) : e[r.kind][r.tag] = e.fallback[r.tag] = r;
  }
  for (t = 0, n = arguments.length; t < n; t += 1)
    arguments[t].forEach(i);
  return e;
}
function ln(e) {
  return this.extend(e);
}
ln.prototype.extend = function(t) {
  var n = [], i = [];
  if (t instanceof z)
    i.push(t);
  else if (Array.isArray(t))
    i = i.concat(t);
  else if (t && (Array.isArray(t.implicit) || Array.isArray(t.explicit)))
    t.implicit && (n = n.concat(t.implicit)), t.explicit && (i = i.concat(t.explicit));
  else
    throw new Me("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  n.forEach(function(s) {
    if (!(s instanceof z))
      throw new Me("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (s.loadKind && s.loadKind !== "scalar")
      throw new Me("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (s.multi)
      throw new Me("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), i.forEach(function(s) {
    if (!(s instanceof z))
      throw new Me("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var r = Object.create(ln.prototype);
  return r.implicit = (this.implicit || []).concat(n), r.explicit = (this.explicit || []).concat(i), r.compiledImplicit = Dn(r, "implicit"), r.compiledExplicit = Dn(r, "explicit"), r.compiledTypeMap = Ms(r.compiledImplicit, r.compiledExplicit), r;
};
var Ls = ln, Ys = new z("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(e) {
    return e !== null ? e : "";
  }
}), Ds = new z("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(e) {
    return e !== null ? e : [];
  }
}), Bs = new z("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(e) {
    return e !== null ? e : {};
  }
}), zs = new Ls({
  explicit: [
    Ys,
    Ds,
    Bs
  ]
});
function Us(e) {
  if (e === null) return !0;
  var t = e.length;
  return t === 1 && e === "~" || t === 4 && (e === "null" || e === "Null" || e === "NULL");
}
function Vs() {
  return null;
}
function js(e) {
  return e === null;
}
var Gs = new z("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Us,
  construct: Vs,
  predicate: js,
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
function qs(e) {
  if (e === null) return !1;
  var t = e.length;
  return t === 4 && (e === "true" || e === "True" || e === "TRUE") || t === 5 && (e === "false" || e === "False" || e === "FALSE");
}
function Hs(e) {
  return e === "true" || e === "True" || e === "TRUE";
}
function Xs(e) {
  return Object.prototype.toString.call(e) === "[object Boolean]";
}
var Ks = new z("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: qs,
  construct: Hs,
  predicate: Xs,
  represent: {
    lowercase: function(e) {
      return e ? "true" : "false";
    },
    uppercase: function(e) {
      return e ? "TRUE" : "FALSE";
    },
    camelcase: function(e) {
      return e ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
});
function Ws(e) {
  return 48 <= e && e <= 57 || 65 <= e && e <= 70 || 97 <= e && e <= 102;
}
function Zs(e) {
  return 48 <= e && e <= 55;
}
function Js(e) {
  return 48 <= e && e <= 57;
}
function Qs(e) {
  if (e === null) return !1;
  var t = e.length, n = 0, i = !1, r;
  if (!t) return !1;
  if (r = e[n], (r === "-" || r === "+") && (r = e[++n]), r === "0") {
    if (n + 1 === t) return !0;
    if (r = e[++n], r === "b") {
      for (n++; n < t; n++)
        if (r = e[n], r !== "_") {
          if (r !== "0" && r !== "1") return !1;
          i = !0;
        }
      return i && r !== "_";
    }
    if (r === "x") {
      for (n++; n < t; n++)
        if (r = e[n], r !== "_") {
          if (!Ws(e.charCodeAt(n))) return !1;
          i = !0;
        }
      return i && r !== "_";
    }
    if (r === "o") {
      for (n++; n < t; n++)
        if (r = e[n], r !== "_") {
          if (!Zs(e.charCodeAt(n))) return !1;
          i = !0;
        }
      return i && r !== "_";
    }
  }
  if (r === "_") return !1;
  for (; n < t; n++)
    if (r = e[n], r !== "_") {
      if (!Js(e.charCodeAt(n)))
        return !1;
      i = !0;
    }
  return !(!i || r === "_");
}
function $s(e) {
  var t = e, n = 1, i;
  if (t.indexOf("_") !== -1 && (t = t.replace(/_/g, "")), i = t[0], (i === "-" || i === "+") && (i === "-" && (n = -1), t = t.slice(1), i = t[0]), t === "0") return 0;
  if (i === "0") {
    if (t[1] === "b") return n * parseInt(t.slice(2), 2);
    if (t[1] === "x") return n * parseInt(t.slice(2), 16);
    if (t[1] === "o") return n * parseInt(t.slice(2), 8);
  }
  return n * parseInt(t, 10);
}
function eo(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && e % 1 === 0 && !_n.isNegativeZero(e);
}
var to = new z("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: Qs,
  construct: $s,
  predicate: eo,
  represent: {
    binary: function(e) {
      return e >= 0 ? "0b" + e.toString(2) : "-0b" + e.toString(2).slice(1);
    },
    octal: function(e) {
      return e >= 0 ? "0o" + e.toString(8) : "-0o" + e.toString(8).slice(1);
    },
    decimal: function(e) {
      return e.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(e) {
      return e >= 0 ? "0x" + e.toString(16).toUpperCase() : "-0x" + e.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
}), no = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function ro(e) {
  return !(e === null || !no.test(e) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  e[e.length - 1] === "_");
}
function io(e) {
  var t, n;
  return t = e.replace(/_/g, "").toLowerCase(), n = t[0] === "-" ? -1 : 1, "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)), t === ".inf" ? n === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : t === ".nan" ? NaN : n * parseFloat(t, 10);
}
var so = /^[-+]?[0-9]+e/;
function oo(e, t) {
  var n;
  if (isNaN(e))
    switch (t) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  else if (Number.POSITIVE_INFINITY === e)
    switch (t) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  else if (Number.NEGATIVE_INFINITY === e)
    switch (t) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  else if (_n.isNegativeZero(e))
    return "-0.0";
  return n = e.toString(10), so.test(n) ? n.replace("e", ".e") : n;
}
function lo(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && (e % 1 !== 0 || _n.isNegativeZero(e));
}
var fo = new z("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: ro,
  construct: io,
  predicate: lo,
  represent: oo,
  defaultStyle: "lowercase"
}), ao = zs.extend({
  implicit: [
    Gs,
    Ks,
    to,
    fo
  ]
}), uo = ao, Ar = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Fr = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function co(e) {
  return e === null ? !1 : Ar.exec(e) !== null || Fr.exec(e) !== null;
}
function ho(e) {
  var t, n, i, r, s, o, l, f = 0, a = null, c, d, u;
  if (t = Ar.exec(e), t === null && (t = Fr.exec(e)), t === null) throw new Error("Date resolve error");
  if (n = +t[1], i = +t[2] - 1, r = +t[3], !t[4])
    return new Date(Date.UTC(n, i, r));
  if (s = +t[4], o = +t[5], l = +t[6], t[7]) {
    for (f = t[7].slice(0, 3); f.length < 3; )
      f += "0";
    f = +f;
  }
  return t[9] && (c = +t[10], d = +(t[11] || 0), a = (c * 60 + d) * 6e4, t[9] === "-" && (a = -a)), u = new Date(Date.UTC(n, i, r, s, o, l, f)), a && u.setTime(u.getTime() - a), u;
}
function po(e) {
  return e.toISOString();
}
var vo = new z("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: co,
  construct: ho,
  instanceOf: Date,
  represent: po
});
function go(e) {
  return e === "<<" || e === null;
}
var _o = new z("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: go
}), mn = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function mo(e) {
  if (e === null) return !1;
  var t, n, i = 0, r = e.length, s = mn;
  for (n = 0; n < r; n++)
    if (t = s.indexOf(e.charAt(n)), !(t > 64)) {
      if (t < 0) return !1;
      i += 6;
    }
  return i % 8 === 0;
}
function wo(e) {
  var t, n, i = e.replace(/[\r\n=]/g, ""), r = i.length, s = mn, o = 0, l = [];
  for (t = 0; t < r; t++)
    t % 4 === 0 && t && (l.push(o >> 16 & 255), l.push(o >> 8 & 255), l.push(o & 255)), o = o << 6 | s.indexOf(i.charAt(t));
  return n = r % 4 * 6, n === 0 ? (l.push(o >> 16 & 255), l.push(o >> 8 & 255), l.push(o & 255)) : n === 18 ? (l.push(o >> 10 & 255), l.push(o >> 2 & 255)) : n === 12 && l.push(o >> 4 & 255), new Uint8Array(l);
}
function xo(e) {
  var t = "", n = 0, i, r, s = e.length, o = mn;
  for (i = 0; i < s; i++)
    i % 3 === 0 && i && (t += o[n >> 18 & 63], t += o[n >> 12 & 63], t += o[n >> 6 & 63], t += o[n & 63]), n = (n << 8) + e[i];
  return r = s % 3, r === 0 ? (t += o[n >> 18 & 63], t += o[n >> 12 & 63], t += o[n >> 6 & 63], t += o[n & 63]) : r === 2 ? (t += o[n >> 10 & 63], t += o[n >> 4 & 63], t += o[n << 2 & 63], t += o[64]) : r === 1 && (t += o[n >> 2 & 63], t += o[n << 4 & 63], t += o[64], t += o[64]), t;
}
function yo(e) {
  return Object.prototype.toString.call(e) === "[object Uint8Array]";
}
var bo = new z("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: mo,
  construct: wo,
  predicate: yo,
  represent: xo
}), Eo = Object.prototype.hasOwnProperty, So = Object.prototype.toString;
function ko(e) {
  if (e === null) return !0;
  var t = [], n, i, r, s, o, l = e;
  for (n = 0, i = l.length; n < i; n += 1) {
    if (r = l[n], o = !1, So.call(r) !== "[object Object]") return !1;
    for (s in r)
      if (Eo.call(r, s))
        if (!o) o = !0;
        else return !1;
    if (!o) return !1;
    if (t.indexOf(s) === -1) t.push(s);
    else return !1;
  }
  return !0;
}
function Po(e) {
  return e !== null ? e : [];
}
var Io = new z("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: ko,
  construct: Po
}), No = Object.prototype.toString;
function Ao(e) {
  if (e === null) return !0;
  var t, n, i, r, s, o = e;
  for (s = new Array(o.length), t = 0, n = o.length; t < n; t += 1) {
    if (i = o[t], No.call(i) !== "[object Object]" || (r = Object.keys(i), r.length !== 1)) return !1;
    s[t] = [r[0], i[r[0]]];
  }
  return !0;
}
function Fo(e) {
  if (e === null) return [];
  var t, n, i, r, s, o = e;
  for (s = new Array(o.length), t = 0, n = o.length; t < n; t += 1)
    i = o[t], r = Object.keys(i), s[t] = [r[0], i[r[0]]];
  return s;
}
var To = new z("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: Ao,
  construct: Fo
}), Ro = Object.prototype.hasOwnProperty;
function Co(e) {
  if (e === null) return !0;
  var t, n = e;
  for (t in n)
    if (Ro.call(n, t) && n[t] !== null)
      return !1;
  return !0;
}
function Oo(e) {
  return e !== null ? e : {};
}
var Mo = new z("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Co,
  construct: Oo
});
uo.extend({
  implicit: [
    vo,
    _o
  ],
  explicit: [
    bo,
    Io,
    To,
    Mo
  ]
});
function Bn(e) {
  return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? `
` : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? '"' : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? " " : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
}
var Lo = new Array(256), Yo = new Array(256);
for (var He = 0; He < 256; He++)
  Lo[He] = Bn(He) ? 1 : 0, Yo[He] = Bn(He);
var zn;
(function(e) {
  e.Router = "router", e.L3Switch = "l3-switch", e.L2Switch = "l2-switch", e.Firewall = "firewall", e.LoadBalancer = "load-balancer", e.Server = "server", e.AccessPoint = "access-point", e.CPE = "cpe", e.Cloud = "cloud", e.Internet = "internet", e.VPN = "vpn", e.Database = "database", e.Generic = "generic";
})(zn || (zn = {}));
const Un = {
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
      [b.Router]: "#3b82f6",
      [b.L3Switch]: "#8b5cf6",
      [b.L2Switch]: "#a78bfa",
      [b.Firewall]: "#ef4444",
      [b.LoadBalancer]: "#f59e0b",
      [b.Server]: "#10b981",
      [b.AccessPoint]: "#06b6d4",
      [b.Cloud]: "#3b82f6",
      [b.Internet]: "#6366f1",
      [b.Generic]: "#94a3b8"
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
  }
};
({
  ...Un.colors,
  // Device colors (adjusted for dark)
  devices: (b.Router + "", b.L3Switch + "", b.L2Switch + "", b.Firewall + "", b.LoadBalancer + "", b.Server + "", b.AccessPoint + "", b.Cloud + "", b.Internet + "", b.Generic + "")
}, {
  ...Un.shadows
});
var Do = /* @__PURE__ */ _t('<g class="edge"><path fill="none" stroke="#64748b" stroke-linecap="round"></path></g>');
function Bo(e, t) {
  vt(t, !0);
  const n = /* @__PURE__ */ ne(() => () => {
    if (t.edge.points.length === 0) return "";
    const [s, ...o] = t.edge.points;
    if (!s) return "";
    let l = `M ${s.x} ${s.y}`;
    for (const f of o)
      l += ` L ${f.x} ${f.y}`;
    return l;
  });
  var i = Do(), r = Fe(i);
  Nt(
    (s) => {
      A(i, "data-edge-id", t.edge.id), A(r, "d", s), A(r, "stroke-width", t.edge.width);
    },
    [() => x(n)()]
  ), ht(e, i), gt();
}
var zo = /* @__PURE__ */ _t('<g><rect rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"></rect><text text-anchor="middle" dominant-baseline="central" font-size="14" fill="#1e293b"> </text></g>');
function Uo(e, t) {
  vt(t, !0);
  const n = /* @__PURE__ */ ne(() => t.node.position.x - t.node.size.width / 2), i = /* @__PURE__ */ ne(() => t.node.position.y - t.node.size.height / 2);
  let r = /* @__PURE__ */ q(!1), s = /* @__PURE__ */ q(re({ x: 0, y: 0 })), o = /* @__PURE__ */ q(re({ x: 0, y: 0 }));
  function l(_) {
    const m = _.target.closest("svg");
    if (!m) return { x: _.clientX, y: _.clientY };
    const y = m.createSVGPoint();
    y.x = _.clientX, y.y = _.clientY;
    const I = m.getScreenCTM();
    if (!I) return { x: _.clientX, y: _.clientY };
    const k = y.matrixTransform(I.inverse());
    return { x: k.x, y: k.y };
  }
  function f(_) {
    X(r, !0);
    const m = l(_);
    X(s, m, !0), X(o, { x: t.node.position.x, y: t.node.position.y }, !0), _.target.setPointerCapture(_.pointerId), _.preventDefault();
  }
  function a(_) {
    var k;
    if (!x(r)) return;
    const m = l(_), y = x(o).x + (m.x - x(s).x), I = x(o).y + (m.y - x(s).y);
    (k = t.ondragmove) == null || k.call(t, t.node.id, y, I);
  }
  function c() {
    X(r, !1);
  }
  const d = /* @__PURE__ */ ne(() => Array.isArray(t.node.node.label) ? t.node.node.label[0] ?? "" : t.node.node.label ?? "");
  var u = zo();
  let v;
  u.__pointerdown = f, u.__pointermove = a, u.__pointerup = c;
  var h = Fe(u), g = Qe(h), S = Fe(g);
  Nt(() => {
    v = qi(u, 0, "node", null, v, { dragging: x(r) }), A(u, "data-node-id", t.node.id), Hi(u, `cursor: ${x(r) ? "grabbing" : "grab"}`), A(h, "x", x(n)), A(h, "y", x(i)), A(h, "width", t.node.size.width), A(h, "height", t.node.size.height), A(g, "x", t.node.position.x), A(g, "y", t.node.position.y), gn(S, x(d));
  }), ht(e, u), gt();
}
Mi(["pointerdown", "pointermove", "pointerup"]);
var Vo = /* @__PURE__ */ _t('<g class="port"><rect rx="2" fill="#334155" stroke="#0f172a" stroke-width="1"></rect><text font-size="9" fill="#64748b"> </text></g>');
function jo(e, t) {
  vt(t, !0);
  const n = 12, i = /* @__PURE__ */ ne(() => () => {
    switch (t.port.side) {
      case "left":
        return t.port.absolutePosition.x - n;
      case "right":
        return t.port.absolutePosition.x + n;
      default:
        return t.port.absolutePosition.x;
    }
  }), r = /* @__PURE__ */ ne(() => () => {
    switch (t.port.side) {
      case "top":
        return t.port.absolutePosition.y - n;
      case "bottom":
        return t.port.absolutePosition.y + n + 4;
      default:
        return t.port.absolutePosition.y;
    }
  }), s = /* @__PURE__ */ ne(() => () => {
    switch (t.port.side) {
      case "left":
        return "end";
      case "right":
        return "start";
      default:
        return "middle";
    }
  });
  var o = Vo(), l = Fe(o), f = Qe(l), a = Fe(f);
  Nt(
    (c, d, u) => {
      A(o, "data-port-id", t.port.id), A(l, "x", t.port.absolutePosition.x - t.port.size.width / 2), A(l, "y", t.port.absolutePosition.y - t.port.size.height / 2), A(l, "width", t.port.size.width), A(l, "height", t.port.size.height), A(f, "x", c), A(f, "y", d), A(f, "text-anchor", u), gn(a, t.port.label);
    },
    [
      () => x(i)(),
      () => x(r)(),
      () => x(s)()
    ]
  ), ht(e, o), gt();
}
var Go = /* @__PURE__ */ _t('<g class="subgraph"><rect rx="12" fill="#f1f5f9" fill-opacity="0.5" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 2"></rect><text font-size="11" font-weight="600" fill="#475569" text-transform="uppercase"> </text></g>');
function qo(e, t) {
  vt(t, !0);
  var n = Go(), i = Fe(n), r = Qe(i), s = Fe(r);
  Nt(() => {
    A(n, "data-subgraph-id", t.subgraph.id), A(i, "x", t.subgraph.bounds.x), A(i, "y", t.subgraph.bounds.y), A(i, "width", t.subgraph.bounds.width), A(i, "height", t.subgraph.bounds.height), A(r, "x", t.subgraph.bounds.x + 12), A(r, "y", t.subgraph.bounds.y + 20), gn(s, t.subgraph.subgraph.label);
  }), ht(e, n), gt();
}
var Ho = /* @__PURE__ */ _t("<!><!>", 1), Xo = /* @__PURE__ */ _t('<svg xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; user-select: none;"><!><!><!></svg>');
function Ko(e, t) {
  vt(t, !0);
  let n = /* @__PURE__ */ q(re(new Map(t.layout.nodes))), i = /* @__PURE__ */ q(re(new Map(t.layout.ports))), r = /* @__PURE__ */ q(re(new Map(t.layout.edges))), s = re(new Map(t.layout.subgraphs)), o = re(t.layout.bounds);
  const l = /* @__PURE__ */ ne(() => `${o.x - 50} ${o.y - 50} ${o.width + 100} ${o.height + 100}`), f = /* @__PURE__ */ ne(() => [...x(n).values()]), a = /* @__PURE__ */ ne(() => [...x(r).values()]), c = /* @__PURE__ */ ne(() => [...s.values()]), d = /* @__PURE__ */ ne(() => () => {
    const _ = /* @__PURE__ */ new Map();
    for (const m of x(i).values()) {
      const y = _.get(m.nodeId);
      y ? y.push(m) : _.set(m.nodeId, [m]);
    }
    return _;
  });
  async function u(_, m, y) {
    var k;
    if (!((k = t.graph) != null && k.links)) return;
    const I = await ws(_, m, y, { nodes: x(n), ports: x(i) }, t.graph.links);
    I && (X(n, I.nodes, !0), X(i, I.ports, !0), X(r, I.edges, !0));
  }
  var v = Xo(), h = Fe(v);
  Ct(h, 17, () => x(c), (_) => _.id, (_, m) => {
    qo(_, {
      get subgraph() {
        return x(m);
      }
    });
  });
  var g = Qe(h);
  Ct(g, 17, () => x(a), (_) => _.id, (_, m) => {
    Bo(_, {
      get edge() {
        return x(m);
      }
    });
  });
  var S = Qe(g);
  Ct(S, 17, () => x(f), (_) => _.id, (_, m) => {
    var y = Ho(), I = mi(y);
    Uo(I, {
      get node() {
        return x(m);
      },
      ondragmove: u
    });
    var k = Qe(I);
    Ct(k, 17, () => x(d)().get(x(m).id) ?? [], (P) => P.id, (P, R) => {
      jo(P, {
        get port() {
          return x(R);
        }
      });
    }), ht(_, y);
  }), Nt(() => A(v, "viewBox", x(l))), ht(e, v), gt();
}
class Wo extends HTMLElement {
  constructor() {
    super();
    Z(this, "_layout", null);
    Z(this, "_graph", null);
    Z(this, "_instance", null);
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
  connectedCallback() {
    this._tryRender();
  }
  disconnectedCallback() {
    this._instance && (Fn(this._instance), this._instance = null);
  }
  _tryRender() {
    !this.shadowRoot || !this._layout || (this._instance && (Fn(this._instance), this._instance = null), this._instance = Di(Ko, {
      target: this.shadowRoot,
      props: {
        layout: this._layout,
        graph: this._graph ?? void 0
      }
    }));
  }
}
typeof window < "u" && (customElements.get("shumoku-renderer") || customElements.define("shumoku-renderer", Wo));
export {
  Wo as ShumokuRendererElement
};
