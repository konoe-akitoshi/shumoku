var Fr = Object.defineProperty;
var yn = (e) => {
  throw TypeError(e);
};
var Tr = (e, t, n) => t in e ? Fr(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var K = (e, t, n) => Tr(e, typeof t != "symbol" ? t + "" : t, n), qt = (e, t, n) => t.has(e) || yn("Cannot " + n);
var p = (e, t, n) => (qt(e, t, "read from private field"), n ? n.call(e) : t.get(e)), k = (e, t, n) => t.has(e) ? yn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), w = (e, t, n, i) => (qt(e, t, "write to private field"), i ? i.call(e, n) : t.set(e, n), n), Y = (e, t, n) => (qt(e, t, "access private method"), n);
var Vn = Array.isArray, Rr = Array.prototype.indexOf, zt = Array.from, Cr = Object.defineProperty, yt = Object.getOwnPropertyDescriptor, Or = Object.getOwnPropertyDescriptors, Mr = Object.prototype, Lr = Array.prototype, jn = Object.getPrototypeOf, bn = Object.isExtensible;
function Yr(e) {
  for (var t = 0; t < e.length; t++)
    e[t]();
}
function Gn() {
  var e, t, n = new Promise((i, r) => {
    e = i, t = r;
  });
  return { promise: n, resolve: e, reject: t };
}
const L = 2, Kt = 4, Ut = 8, qn = 1 << 24, we = 16, Te = 32, Ge = 64, fn = 128, ie = 512, D = 1024, H = 2048, xe = 4096, Z = 8192, Pe = 16384, Hn = 32768, Et = 65536, En = 1 << 17, Xn = 1 << 18, pt = 1 << 19, Dr = 1 << 20, ke = 1 << 25, Ve = 32768, Wt = 1 << 21, un = 1 << 22, Ie = 1 << 23, Ht = Symbol("$state"), Br = Symbol(""), Xe = new class extends Error {
  constructor() {
    super(...arguments);
    K(this, "name", "StaleReactionError");
    K(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function zr() {
  throw new Error("https://svelte.dev/e/async_derived_orphan");
}
function Ur() {
  throw new Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Vr() {
  throw new Error("https://svelte.dev/e/state_descriptors_fixed");
}
function jr() {
  throw new Error("https://svelte.dev/e/state_prototype_fixed");
}
function Gr() {
  throw new Error("https://svelte.dev/e/state_unsafe_mutation");
}
function qr() {
  throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
const Hr = 1, Xr = 2, Kr = 16, Wr = 1, O = Symbol(), Zr = "http://www.w3.org/1999/xhtml";
function Jr() {
  console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
function Kn(e) {
  return e === this.v;
}
function Qr(e, t) {
  return e != e ? t == t : e !== t || e !== null && typeof e == "object" || typeof e == "function";
}
function Wn(e) {
  return !Qr(e, this.v);
}
let fe = null;
function ft(e) {
  fe = e;
}
function vt(e, t = !1, n) {
  fe = {
    p: fe,
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
    fe
  ), n = t.e;
  if (n !== null) {
    t.e = null;
    for (var i of n)
      bi(i);
  }
  return t.i = !0, fe = t.p, /** @type {T} */
  {};
}
function Zn() {
  return !0;
}
let Ke = [];
function $r() {
  var e = Ke;
  Ke = [], Yr(e);
}
function Je(e) {
  if (Ke.length === 0) {
    var t = Ke;
    queueMicrotask(() => {
      t === Ke && $r();
    });
  }
  Ke.push(e);
}
function Jn(e) {
  var t = A;
  if (t === null)
    return b.f |= Ie, e;
  if ((t.f & Hn) === 0) {
    if ((t.f & fn) === 0)
      throw e;
    t.b.error(e);
  } else
    ut(e, t);
}
function ut(e, t) {
  for (; t !== null; ) {
    if ((t.f & fn) !== 0)
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
const ei = -7169;
function C(e, t) {
  e.f = e.f & ei | t;
}
function cn(e) {
  (e.f & ie) !== 0 || e.deps === null ? C(e, D) : C(e, xe);
}
function Qn(e) {
  if (e !== null)
    for (const t of e)
      (t.f & L) === 0 || (t.f & Ve) === 0 || (t.f ^= Ve, Qn(
        /** @type {Derived} */
        t.deps
      ));
}
function $n(e, t, n) {
  (e.f & H) !== 0 ? t.add(e) : (e.f & xe) !== 0 && n.add(e), Qn(e.deps), C(e, D);
}
const Tt = /* @__PURE__ */ new Set();
let F = null, M = null, oe = [], dn = null, Zt = !1;
var et, tt, Ye, nt, Pt, rt, it, st, ve, Jt, Qt, er;
const wn = class wn {
  constructor() {
    k(this, ve);
    K(this, "committed", !1);
    /**
     * The current values of any sources that are updated in this batch
     * They keys of this map are identical to `this.#previous`
     * @type {Map<Source, any>}
     */
    K(this, "current", /* @__PURE__ */ new Map());
    /**
     * The values of any sources that are updated in this batch _before_ those updates took place.
     * They keys of this map are identical to `this.#current`
     * @type {Map<Source, any>}
     */
    K(this, "previous", /* @__PURE__ */ new Map());
    /**
     * When the batch is committed (and the DOM is updated), we need to remove old branches
     * and append new ones by calling the functions added inside (if/each/key/etc) blocks
     * @type {Set<() => void>}
     */
    k(this, et, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    k(this, tt, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    k(this, Ye, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    k(this, nt, 0);
    /**
     * A deferred that resolves when the batch is committed, used with `settled()`
     * TODO replace with Promise.withResolvers once supported widely enough
     * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
     */
    k(this, Pt, null);
    /**
     * Deferred effects (which run after async work has completed) that are DIRTY
     * @type {Set<Effect>}
     */
    k(this, rt, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    k(this, it, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    K(this, "skipped_effects", /* @__PURE__ */ new Set());
    K(this, "is_fork", !1);
    k(this, st, !1);
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
      Y(this, ve, Jt).call(this, s, n, i);
    if (this.is_deferred())
      Y(this, ve, Qt).call(this, i), Y(this, ve, Qt).call(this, n);
    else {
      for (const s of p(this, et)) s();
      p(this, et).clear(), p(this, Ye) === 0 && Y(this, ve, er).call(this), F = null, Sn(i), Sn(n), (r = p(this, Pt)) == null || r.resolve();
    }
    M = null;
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} value
   */
  capture(t, n) {
    n !== O && !this.previous.has(t) && this.previous.set(t, n), (t.f & Ie) === 0 && (this.current.set(t, t.v), M == null || M.set(t, t.v));
  }
  activate() {
    F = this, this.apply();
  }
  deactivate() {
    F === this && (F = null, M = null);
  }
  flush() {
    if (this.activate(), oe.length > 0) {
      if (ti(), F !== null && F !== this)
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
      p(this, it).delete(t), C(t, H), me(t);
    for (const t of p(this, it))
      C(t, xe), me(t);
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
    return (p(this, Pt) ?? w(this, Pt, Gn())).promise;
  }
  static ensure() {
    if (F === null) {
      const t = F = new wn();
      Tt.add(F), Je(() => {
        F === t && t.flush();
      });
    }
    return F;
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
  t.f ^= D;
  for (var r = t.first, s = null; r !== null; ) {
    var o = r.f, l = (o & (Te | Ge)) !== 0, a = l && (o & D) !== 0, f = a || (o & Z) !== 0 || this.skipped_effects.has(r);
    if (!f && r.fn !== null) {
      l ? r.f ^= D : s !== null && (o & (Kt | Ut | qn)) !== 0 ? s.b.defer_effect(r) : (o & Kt) !== 0 ? n.push(r) : At(r) && ((o & we) !== 0 && p(this, rt).add(r), St(r));
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
    $n(t[n], p(this, rt), p(this, it));
}, er = function() {
  var r;
  if (Tt.size > 1) {
    this.previous.clear();
    var t = M, n = !0;
    for (const s of Tt) {
      if (s === this) {
        n = !1;
        continue;
      }
      const o = [];
      for (const [a, f] of this.current) {
        if (s.current.has(a))
          if (n && f !== s.current.get(a))
            s.current.set(a, f);
          else
            continue;
        o.push(a);
      }
      if (o.length === 0)
        continue;
      const l = [...s.current.keys()].filter((a) => !this.current.has(a));
      if (l.length > 0) {
        var i = oe;
        oe = [];
        const a = /* @__PURE__ */ new Set(), f = /* @__PURE__ */ new Map();
        for (const c of o)
          tr(c, l, a, f);
        if (oe.length > 0) {
          F = s, s.apply();
          for (const c of oe)
            Y(r = s, ve, Jt).call(r, c, [], []);
          s.deactivate();
        }
        oe = i;
      }
    }
    F = null, M = t;
  }
  this.committed = !0, Tt.delete(this);
};
let Ne = wn;
function ti() {
  Zt = !0;
  var e = null;
  try {
    for (var t = 0; oe.length > 0; ) {
      var n = Ne.ensure();
      if (t++ > 1e3) {
        var i, r;
        ni();
      }
      n.process(oe), Ae.clear();
    }
  } finally {
    Zt = !1, dn = null;
  }
}
function ni() {
  try {
    Ur();
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
      if ((i.f & (Pe | Z)) === 0 && At(i) && (se = /* @__PURE__ */ new Set(), St(i), i.deps === null && i.first === null && i.nodes === null && (i.teardown === null && i.ac === null ? hr(i) : i.fn = null), (se == null ? void 0 : se.size) > 0)) {
        Ae.clear();
        for (const r of se) {
          if ((r.f & (Pe | Z)) !== 0) continue;
          const s = [r];
          let o = r.parent;
          for (; o !== null; )
            se.has(o) && (se.delete(o), s.push(o)), o = o.parent;
          for (let l = s.length - 1; l >= 0; l--) {
            const a = s[l];
            (a.f & (Pe | Z)) === 0 && St(a);
          }
        }
        se.clear();
      }
    }
    se = null;
  }
}
function tr(e, t, n, i) {
  if (!n.has(e) && (n.add(e), e.reactions !== null))
    for (const r of e.reactions) {
      const s = r.f;
      (s & L) !== 0 ? tr(
        /** @type {Derived} */
        r,
        t,
        n,
        i
      ) : (s & (un | we)) !== 0 && (s & H) === 0 && nr(r, t, i) && (C(r, H), me(
        /** @type {Effect} */
        r
      ));
    }
}
function nr(e, t, n) {
  const i = n.get(e);
  if (i !== void 0) return i;
  if (e.deps !== null)
    for (const r of e.deps) {
      if (t.includes(r))
        return !0;
      if ((r.f & L) !== 0 && nr(
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
    if (Zt && t === A && (n & we) !== 0 && (n & Xn) === 0)
      return;
    if ((n & (Ge | Te)) !== 0) {
      if ((n & D) === 0) return;
      t.f ^= D;
    }
  }
  oe.push(t);
}
function ri(e) {
  let t = 0, n = je(0), i;
  return () => {
    vn() && (x(n), ki(() => (t === 0 && (i = Ti(() => e(() => bt(n)))), t += 1, () => {
      Je(() => {
        t -= 1, t === 0 && (i == null || i(), i = void 0, bt(n));
      });
    })));
  };
}
var ii = Et | pt | fn;
function si(e, t, n) {
  new oi(e, t, n);
}
var ee, an, ce, De, de, te, U, he, ge, Ee, Be, Se, ot, ze, lt, at, _e, Bt, R, li, ai, $t, Ot, Mt, en;
class oi {
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(t, n, i) {
    k(this, R);
    /** @type {Boundary | null} */
    K(this, "parent");
    K(this, "is_pending", !1);
    /** @type {TemplateNode} */
    k(this, ee);
    /** @type {TemplateNode | null} */
    k(this, an, null);
    /** @type {BoundaryProps} */
    k(this, ce);
    /** @type {((anchor: Node) => void)} */
    k(this, De);
    /** @type {Effect} */
    k(this, de);
    /** @type {Effect | null} */
    k(this, te, null);
    /** @type {Effect | null} */
    k(this, U, null);
    /** @type {Effect | null} */
    k(this, he, null);
    /** @type {DocumentFragment | null} */
    k(this, ge, null);
    /** @type {TemplateNode | null} */
    k(this, Ee, null);
    k(this, Be, 0);
    k(this, Se, 0);
    k(this, ot, !1);
    k(this, ze, !1);
    /** @type {Set<Effect>} */
    k(this, lt, /* @__PURE__ */ new Set());
    /** @type {Set<Effect>} */
    k(this, at, /* @__PURE__ */ new Set());
    /**
     * A source containing the number of pending async deriveds/expressions.
     * Only created if `$effect.pending()` is used inside the boundary,
     * otherwise updating the source results in needless `Batch.ensure()`
     * calls followed by no-op flushes
     * @type {Source<number> | null}
     */
    k(this, _e, null);
    k(this, Bt, ri(() => (w(this, _e, je(p(this, Be))), () => {
      w(this, _e, null);
    })));
    w(this, ee, t), w(this, ce, n), w(this, De, i), this.parent = /** @type {Effect} */
    A.b, this.is_pending = !!p(this, ce).pending, w(this, de, ur(() => {
      A.b = this;
      {
        var r = Y(this, R, $t).call(this);
        try {
          w(this, te, ue(() => i(r)));
        } catch (s) {
          this.error(s);
        }
        p(this, Se) > 0 ? Y(this, R, Mt).call(this) : this.is_pending = !1;
      }
      return () => {
        var s;
        (s = p(this, Ee)) == null || s.remove();
      };
    }, ii));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(t) {
    $n(t, p(this, lt), p(this, at));
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
    Y(this, R, en).call(this, t), w(this, Be, p(this, Be) + t), !(!p(this, _e) || p(this, ot)) && (w(this, ot, !0), Je(() => {
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
    p(this, te) && (ae(p(this, te)), w(this, te, null)), p(this, U) && (ae(p(this, U)), w(this, U, null)), p(this, he) && (ae(p(this, he)), w(this, he, null));
    var r = !1, s = !1;
    const o = () => {
      if (r) {
        Jr();
        return;
      }
      r = !0, s && qr(), Ne.ensure(), w(this, Be, 0), p(this, he) !== null && $e(p(this, he), () => {
        w(this, he, null);
      }), this.is_pending = this.has_pending_snippet(), w(this, te, Y(this, R, Ot).call(this, () => (w(this, ze, !1), ue(() => p(this, De).call(this, p(this, ee)))))), p(this, Se) > 0 ? Y(this, R, Mt).call(this) : this.is_pending = !1;
    };
    var l = b;
    try {
      q(null), s = !0, n == null || n(t, o), s = !1;
    } catch (a) {
      ut(a, p(this, de) && p(this, de).parent);
    } finally {
      q(l);
    }
    i && Je(() => {
      w(this, he, Y(this, R, Ot).call(this, () => {
        Ne.ensure(), w(this, ze, !0);
        try {
          return ue(() => {
            i(
              p(this, ee),
              () => t,
              () => o
            );
          });
        } catch (a) {
          return ut(
            a,
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
ee = new WeakMap(), an = new WeakMap(), ce = new WeakMap(), De = new WeakMap(), de = new WeakMap(), te = new WeakMap(), U = new WeakMap(), he = new WeakMap(), ge = new WeakMap(), Ee = new WeakMap(), Be = new WeakMap(), Se = new WeakMap(), ot = new WeakMap(), ze = new WeakMap(), lt = new WeakMap(), at = new WeakMap(), _e = new WeakMap(), Bt = new WeakMap(), R = new WeakSet(), li = function() {
  try {
    w(this, te, ue(() => p(this, De).call(this, p(this, ee))));
  } catch (t) {
    this.error(t);
  }
}, ai = function() {
  const t = p(this, ce).pending;
  t && (w(this, U, ue(() => t(p(this, ee)))), Je(() => {
    var n = Y(this, R, $t).call(this);
    w(this, te, Y(this, R, Ot).call(this, () => (Ne.ensure(), ue(() => p(this, De).call(this, n))))), p(this, Se) > 0 ? Y(this, R, Mt).call(this) : ($e(
      /** @type {Effect} */
      p(this, U),
      () => {
        w(this, U, null);
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
  var n = A, i = b, r = fe;
  pe(p(this, de)), q(p(this, de)), ft(p(this, de).ctx);
  try {
    return t();
  } catch (s) {
    return Jn(s), null;
  } finally {
    pe(n), q(i), ft(r);
  }
}, Mt = function() {
  const t = (
    /** @type {(anchor: Node) => void} */
    p(this, ce).pending
  );
  p(this, te) !== null && (w(this, ge, document.createDocumentFragment()), p(this, ge).append(
    /** @type {TemplateNode} */
    p(this, Ee)
  ), Ni(p(this, te), p(this, ge))), p(this, U) === null && w(this, U, ue(() => t(p(this, ee))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
en = function(t) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && Y(n = this.parent, R, en).call(n, t);
    return;
  }
  if (w(this, Se, p(this, Se) + t), p(this, Se) === 0) {
    this.is_pending = !1;
    for (const i of p(this, lt))
      C(i, H), me(i);
    for (const i of p(this, at))
      C(i, xe), me(i);
    p(this, lt).clear(), p(this, at).clear(), p(this, U) && $e(p(this, U), () => {
      w(this, U, null);
    }), p(this, ge) && (p(this, ee).before(p(this, ge)), w(this, ge, null));
  }
};
function fi(e, t, n, i) {
  const r = hn;
  var s = e.filter((u) => !u.settled);
  if (n.length === 0 && s.length === 0) {
    i(t.map(r));
    return;
  }
  var o = F, l = (
    /** @type {Effect} */
    A
  ), a = ui(), f = s.length === 1 ? s[0].promise : s.length > 1 ? Promise.all(s.map((u) => u.promise)) : null;
  function c(u) {
    a();
    try {
      i(u);
    } catch (v) {
      (l.f & Pe) === 0 && ut(v, l);
    }
    o == null || o.deactivate(), tn();
  }
  if (n.length === 0) {
    f.then(() => c(t.map(r)));
    return;
  }
  function d() {
    a(), Promise.all(n.map((u) => /* @__PURE__ */ ci(u))).then((u) => c([...t.map(r), ...u])).catch((u) => ut(u, l));
  }
  f ? f.then(d) : d();
}
function ui() {
  var e = A, t = b, n = fe, i = F;
  return function(s = !0) {
    pe(e), q(t), ft(n), s && (i == null || i.activate());
  };
}
function tn() {
  pe(null), q(null), ft(null);
}
// @__NO_SIDE_EFFECTS__
function hn(e) {
  var t = L | H, n = b !== null && (b.f & L) !== 0 ? (
    /** @type {Derived} */
    b
  ) : null;
  return A !== null && (A.f |= pt), {
    ctx: fe,
    deps: null,
    effects: null,
    equals: Kn,
    f: t,
    fn: e,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      O
    ),
    wv: 0,
    parent: n ?? A,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function ci(e, t, n) {
  let i = (
    /** @type {Effect | null} */
    A
  );
  i === null && zr();
  var r = (
    /** @type {Boundary} */
    i.b
  ), s = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  ), o = je(
    /** @type {V} */
    O
  ), l = !b, a = /* @__PURE__ */ new Map();
  return Si(() => {
    var v;
    var f = Gn();
    s = f.promise;
    try {
      Promise.resolve(e()).then(f.resolve, f.reject).then(() => {
        c === F && c.committed && c.deactivate(), tn();
      });
    } catch (h) {
      f.reject(h), tn();
    }
    var c = (
      /** @type {Batch} */
      F
    );
    if (l) {
      var d = r.is_rendered();
      r.update_pending_count(1), c.increment(d), (v = a.get(c)) == null || v.reject(Xe), a.delete(c), a.set(c, f);
    }
    const u = (h, g = void 0) => {
      if (c.activate(), g)
        g !== Xe && (o.f |= Ie, ct(o, g));
      else {
        (o.f & Ie) !== 0 && (o.f ^= Ie), ct(o, h);
        for (const [S, _] of a) {
          if (a.delete(S), S === c) break;
          _.reject(Xe);
        }
      }
      l && (r.update_pending_count(-1), c.decrement(d));
    };
    f.promise.then(u, (h) => u(null, h || "unknown"));
  }), yi(() => {
    for (const f of a.values())
      f.reject(Xe);
  }), new Promise((f) => {
    function c(d) {
      function u() {
        d === s ? f(o) : c(s);
      }
      d.then(u, u);
    }
    c(s);
  });
}
// @__NO_SIDE_EFFECTS__
function ne(e) {
  const t = /* @__PURE__ */ hn(e);
  return _r(t), t;
}
// @__NO_SIDE_EFFECTS__
function di(e) {
  const t = /* @__PURE__ */ hn(e);
  return t.equals = Wn, t;
}
function rr(e) {
  var t = e.effects;
  if (t !== null) {
    e.effects = null;
    for (var n = 0; n < t.length; n += 1)
      ae(
        /** @type {Effect} */
        t[n]
      );
  }
}
function hi(e) {
  for (var t = e.parent; t !== null; ) {
    if ((t.f & L) === 0)
      return (t.f & Pe) === 0 ? (
        /** @type {Effect} */
        t
      ) : null;
    t = t.parent;
  }
  return null;
}
function pn(e) {
  var t, n = A;
  pe(hi(e));
  try {
    e.f &= ~Ve, rr(e), t = yr(e);
  } finally {
    pe(n);
  }
  return t;
}
function ir(e) {
  var t = pn(e);
  if (!e.equals(t) && (e.wv = wr(), (!(F != null && F.is_fork) || e.deps === null) && (e.v = t, e.deps === null))) {
    C(e, D);
    return;
  }
  dt || (M !== null ? (vn() || F != null && F.is_fork) && M.set(e, t) : cn(e));
}
let nn = /* @__PURE__ */ new Set();
const Ae = /* @__PURE__ */ new Map();
let sr = !1;
function je(e, t) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: e,
    reactions: null,
    equals: Kn,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function V(e, t) {
  const n = je(e);
  return _r(n), n;
}
// @__NO_SIDE_EFFECTS__
function pi(e, t = !1, n = !0) {
  const i = je(e);
  return t || (i.equals = Wn), i;
}
function G(e, t, n = !1) {
  b !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!le || (b.f & En) !== 0) && Zn() && (b.f & (L | we | un | En)) !== 0 && !(z != null && z.includes(e)) && Gr();
  let i = n ? re(t) : t;
  return ct(e, i);
}
function ct(e, t) {
  if (!e.equals(t)) {
    var n = e.v;
    dt ? Ae.set(e, t) : Ae.set(e, n), e.v = t;
    var i = Ne.ensure();
    if (i.capture(e, n), (e.f & L) !== 0) {
      const r = (
        /** @type {Derived} */
        e
      );
      (e.f & H) !== 0 && pn(r), cn(r);
    }
    e.wv = wr(), or(e, H), A !== null && (A.f & D) !== 0 && (A.f & (Te | Ge)) === 0 && ($ === null ? Ai([e]) : $.push(e)), !i.is_fork && nn.size > 0 && !sr && vi();
  }
  return t;
}
function vi() {
  sr = !1;
  for (const e of nn)
    (e.f & D) !== 0 && C(e, xe), At(e) && St(e);
  nn.clear();
}
function bt(e) {
  G(e, e.v + 1);
}
function or(e, t) {
  var n = e.reactions;
  if (n !== null)
    for (var i = n.length, r = 0; r < i; r++) {
      var s = n[r], o = s.f, l = (o & H) === 0;
      if (l && C(s, t), (o & L) !== 0) {
        var a = (
          /** @type {Derived} */
          s
        );
        M == null || M.delete(a), (o & Ve) === 0 && (o & ie && (s.f |= Ve), or(a, xe));
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
  const t = jn(e);
  if (t !== Mr && t !== Lr)
    return e;
  var n = /* @__PURE__ */ new Map(), i = Vn(e), r = /* @__PURE__ */ V(0), s = Ue, o = (l) => {
    if (Ue === s)
      return l();
    var a = b, f = Ue;
    q(null), In(s);
    var c = l();
    return q(a), In(f), c;
  };
  return i && n.set("length", /* @__PURE__ */ V(
    /** @type {any[]} */
    e.length
  )), new Proxy(
    /** @type {any} */
    e,
    {
      defineProperty(l, a, f) {
        (!("value" in f) || f.configurable === !1 || f.enumerable === !1 || f.writable === !1) && Vr();
        var c = n.get(a);
        return c === void 0 ? c = o(() => {
          var d = /* @__PURE__ */ V(f.value);
          return n.set(a, d), d;
        }) : G(c, f.value, !0), !0;
      },
      deleteProperty(l, a) {
        var f = n.get(a);
        if (f === void 0) {
          if (a in l) {
            const c = o(() => /* @__PURE__ */ V(O));
            n.set(a, c), bt(r);
          }
        } else
          G(f, O), bt(r);
        return !0;
      },
      get(l, a, f) {
        var v;
        if (a === Ht)
          return e;
        var c = n.get(a), d = a in l;
        if (c === void 0 && (!d || (v = yt(l, a)) != null && v.writable) && (c = o(() => {
          var h = re(d ? l[a] : O), g = /* @__PURE__ */ V(h);
          return g;
        }), n.set(a, c)), c !== void 0) {
          var u = x(c);
          return u === O ? void 0 : u;
        }
        return Reflect.get(l, a, f);
      },
      getOwnPropertyDescriptor(l, a) {
        var f = Reflect.getOwnPropertyDescriptor(l, a);
        if (f && "value" in f) {
          var c = n.get(a);
          c && (f.value = x(c));
        } else if (f === void 0) {
          var d = n.get(a), u = d == null ? void 0 : d.v;
          if (d !== void 0 && u !== O)
            return {
              enumerable: !0,
              configurable: !0,
              value: u,
              writable: !0
            };
        }
        return f;
      },
      has(l, a) {
        var u;
        if (a === Ht)
          return !0;
        var f = n.get(a), c = f !== void 0 && f.v !== O || Reflect.has(l, a);
        if (f !== void 0 || A !== null && (!c || (u = yt(l, a)) != null && u.writable)) {
          f === void 0 && (f = o(() => {
            var v = c ? re(l[a]) : O, h = /* @__PURE__ */ V(v);
            return h;
          }), n.set(a, f));
          var d = x(f);
          if (d === O)
            return !1;
        }
        return c;
      },
      set(l, a, f, c) {
        var E;
        var d = n.get(a), u = a in l;
        if (i && a === "length")
          for (var v = f; v < /** @type {Source<number>} */
          d.v; v += 1) {
            var h = n.get(v + "");
            h !== void 0 ? G(h, O) : v in l && (h = o(() => /* @__PURE__ */ V(O)), n.set(v + "", h));
          }
        if (d === void 0)
          (!u || (E = yt(l, a)) != null && E.writable) && (d = o(() => /* @__PURE__ */ V(void 0)), G(d, re(f)), n.set(a, d));
        else {
          u = d.v !== O;
          var g = o(() => re(f));
          G(d, g);
        }
        var S = Reflect.getOwnPropertyDescriptor(l, a);
        if (S != null && S.set && S.set.call(c, f), !u) {
          if (i && typeof a == "string") {
            var _ = (
              /** @type {Source<number>} */
              n.get("length")
            ), m = Number(a);
            Number.isInteger(m) && m >= _.v && G(_, m + 1);
          }
          bt(r);
        }
        return !0;
      },
      ownKeys(l) {
        x(r);
        var a = Reflect.ownKeys(l).filter((d) => {
          var u = n.get(d);
          return u === void 0 || u.v !== O;
        });
        for (var [f, c] of n)
          c.v !== O && !(f in l) && a.push(f);
        return a;
      },
      setPrototypeOf() {
        jr();
      }
    }
  );
}
var kn, lr, ar;
function gi() {
  if (kn === void 0) {
    kn = window;
    var e = Element.prototype, t = Node.prototype, n = Text.prototype;
    lr = yt(t, "firstChild").get, ar = yt(t, "nextSibling").get, bn(e) && (e.__click = void 0, e.__className = void 0, e.__attributes = null, e.__style = void 0, e.__e = void 0), bn(n) && (n.__t = void 0);
  }
}
function Yt(e = "") {
  return document.createTextNode(e);
}
// @__NO_SIDE_EFFECTS__
function Oe(e) {
  return (
    /** @type {TemplateNode | null} */
    lr.call(e)
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
function _i(e, t = !1) {
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
function mi(e) {
  e.textContent = "";
}
function wi() {
  return !1;
}
function fr(e) {
  var t = b, n = A;
  q(null), pe(null);
  try {
    return e();
  } finally {
    q(t), pe(n);
  }
}
function xi(e, t) {
  var n = t.last;
  n === null ? t.last = t.first = e : (n.next = e, e.prev = n, t.last = e);
}
function Re(e, t, n) {
  var i = A;
  i !== null && (i.f & Z) !== 0 && (e |= Z);
  var r = {
    ctx: fe,
    deps: null,
    nodes: null,
    f: e | H | ie,
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
      St(r), r.f |= Hn;
    } catch (l) {
      throw ae(r), l;
    }
  else t !== null && me(r);
  var s = r;
  if (n && s.deps === null && s.teardown === null && s.nodes === null && s.first === s.last && // either `null`, or a singular child
  (s.f & pt) === 0 && (s = s.first, (e & we) !== 0 && (e & Et) !== 0 && s !== null && (s.f |= Et)), s !== null && (s.parent = i, i !== null && xi(s, i), b !== null && (b.f & L) !== 0 && (e & Ge) === 0)) {
    var o = (
      /** @type {Derived} */
      b
    );
    (o.effects ?? (o.effects = [])).push(s);
  }
  return r;
}
function vn() {
  return b !== null && !le;
}
function yi(e) {
  const t = Re(Ut, null, !1);
  return C(t, D), t.teardown = e, t;
}
function bi(e) {
  return Re(Kt | Dr, e, !1);
}
function Ei(e) {
  Ne.ensure();
  const t = Re(Ge | pt, e, !0);
  return (n = {}) => new Promise((i) => {
    n.outro ? $e(t, () => {
      ae(t), i(void 0);
    }) : (ae(t), i(void 0));
  });
}
function Si(e) {
  return Re(un | pt, e, !0);
}
function ki(e, t = 0) {
  return Re(Ut | t, e, !0);
}
function Nt(e, t = [], n = [], i = []) {
  fi(i, t, n, (r) => {
    Re(Ut, () => e(...r.map(x)), !0);
  });
}
function ur(e, t = 0) {
  var n = Re(we | t, e, !0);
  return n;
}
function ue(e) {
  return Re(Te | pt, e, !0);
}
function cr(e) {
  var t = e.teardown;
  if (t !== null) {
    const n = dt, i = b;
    Pn(!0), q(null);
    try {
      t.call(null);
    } finally {
      Pn(n), q(i);
    }
  }
}
function dr(e, t = !1) {
  var n = e.first;
  for (e.first = e.last = null; n !== null; ) {
    const r = n.ac;
    r !== null && fr(() => {
      r.abort(Xe);
    });
    var i = n.next;
    (n.f & Ge) !== 0 ? n.parent = null : ae(n, t), n = i;
  }
}
function Pi(e) {
  for (var t = e.first; t !== null; ) {
    var n = t.next;
    (t.f & Te) === 0 && ae(t), t = n;
  }
}
function ae(e, t = !0) {
  var n = !1;
  (t || (e.f & Xn) !== 0) && e.nodes !== null && e.nodes.end !== null && (Ii(
    e.nodes.start,
    /** @type {TemplateNode} */
    e.nodes.end
  ), n = !0), dr(e, t && !n), Dt(e, 0), C(e, Pe);
  var i = e.nodes && e.nodes.t;
  if (i !== null)
    for (const s of i)
      s.stop();
  cr(e);
  var r = e.parent;
  r !== null && r.first !== null && hr(e), e.next = e.prev = e.teardown = e.ctx = e.deps = e.fn = e.nodes = e.ac = null;
}
function Ii(e, t) {
  for (; e !== null; ) {
    var n = e === t ? null : /* @__PURE__ */ It(e);
    e.remove(), e = n;
  }
}
function hr(e) {
  var t = e.parent, n = e.prev, i = e.next;
  n !== null && (n.next = i), i !== null && (i.prev = n), t !== null && (t.first === e && (t.first = i), t.last === e && (t.last = n));
}
function $e(e, t, n = !0) {
  var i = [];
  pr(e, i, !0);
  var r = () => {
    n && ae(e), t && t();
  }, s = i.length;
  if (s > 0) {
    var o = () => --s || r();
    for (var l of i)
      l.out(o);
  } else
    r();
}
function pr(e, t, n) {
  if ((e.f & Z) === 0) {
    e.f ^= Z;
    var i = e.nodes && e.nodes.t;
    if (i !== null)
      for (const l of i)
        (l.is_global || n) && t.push(l);
    for (var r = e.first; r !== null; ) {
      var s = r.next, o = (r.f & Et) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (r.f & Te) !== 0 && (e.f & we) !== 0;
      pr(r, t, o ? n : !1), r = s;
    }
  }
}
function vr(e) {
  gr(e, !0);
}
function gr(e, t) {
  if ((e.f & Z) !== 0) {
    e.f ^= Z, (e.f & D) === 0 && (C(e, H), me(e));
    for (var n = e.first; n !== null; ) {
      var i = n.next, r = (n.f & Et) !== 0 || (n.f & Te) !== 0;
      gr(n, r ? t : !1), n = i;
    }
    var s = e.nodes && e.nodes.t;
    if (s !== null)
      for (const o of s)
        (o.is_global || t) && o.in();
  }
}
function Ni(e, t) {
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
let b = null, le = !1;
function q(e) {
  b = e;
}
let A = null;
function pe(e) {
  A = e;
}
let z = null;
function _r(e) {
  b !== null && (z === null ? z = [e] : z.push(e));
}
let j = null, W = 0, $ = null;
function Ai(e) {
  $ = e;
}
let mr = 1, Le = 0, Ue = Le;
function In(e) {
  Ue = e;
}
function wr() {
  return ++mr;
}
function At(e) {
  var t = e.f;
  if ((t & H) !== 0)
    return !0;
  if (t & L && (e.f &= ~Ve), (t & xe) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      e.deps
    ), i = n.length, r = 0; r < i; r++) {
      var s = n[r];
      if (At(
        /** @type {Derived} */
        s
      ) && ir(
        /** @type {Derived} */
        s
      ), s.wv > e.wv)
        return !0;
    }
    (t & ie) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    M === null && C(e, D);
  }
  return !1;
}
function xr(e, t, n = !0) {
  var i = e.reactions;
  if (i !== null && !(z != null && z.includes(e)))
    for (var r = 0; r < i.length; r++) {
      var s = i[r];
      (s.f & L) !== 0 ? xr(
        /** @type {Derived} */
        s,
        t,
        !1
      ) : t === s && (n ? C(s, H) : (s.f & D) !== 0 && C(s, xe), me(
        /** @type {Effect} */
        s
      ));
    }
}
function yr(e) {
  var h;
  var t = j, n = W, i = $, r = b, s = z, o = fe, l = le, a = Ue, f = e.f;
  j = /** @type {null | Value[]} */
  null, W = 0, $ = null, b = (f & (Te | Ge)) === 0 ? e : null, z = null, ft(e.ctx), le = !1, Ue = ++Le, e.ac !== null && (fr(() => {
    e.ac.abort(Xe);
  }), e.ac = null);
  try {
    e.f |= Wt;
    var c = (
      /** @type {Function} */
      e.fn
    ), d = c(), u = e.deps;
    if (j !== null) {
      var v;
      if (Dt(e, W), u !== null && W > 0)
        for (u.length = W + j.length, v = 0; v < j.length; v++)
          u[W + v] = j[v];
      else
        e.deps = u = j;
      if (vn() && (e.f & ie) !== 0)
        for (v = W; v < u.length; v++)
          ((h = u[v]).reactions ?? (h.reactions = [])).push(e);
    } else u !== null && W < u.length && (Dt(e, W), u.length = W);
    if (Zn() && $ !== null && !le && u !== null && (e.f & (L | xe | H)) === 0)
      for (v = 0; v < /** @type {Source[]} */
      $.length; v++)
        xr(
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
    return Jn(g);
  } finally {
    e.f ^= Wt, j = t, W = n, $ = i, b = r, z = s, ft(o), le = l, Ue = a;
  }
}
function Fi(e, t) {
  let n = t.reactions;
  if (n !== null) {
    var i = Rr.call(n, e);
    if (i !== -1) {
      var r = n.length - 1;
      r === 0 ? n = t.reactions = null : (n[i] = n[r], n.pop());
    }
  }
  if (n === null && (t.f & L) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (j === null || !j.includes(t))) {
    var s = (
      /** @type {Derived} */
      t
    );
    (s.f & ie) !== 0 && (s.f ^= ie, s.f &= ~Ve), cn(s), rr(s), Dt(s, 0);
  }
}
function Dt(e, t) {
  var n = e.deps;
  if (n !== null)
    for (var i = t; i < n.length; i++)
      Fi(e, n[i]);
}
function St(e) {
  var t = e.f;
  if ((t & Pe) === 0) {
    C(e, D);
    var n = A, i = Lt;
    A = e, Lt = !0;
    try {
      (t & (we | qn)) !== 0 ? Pi(e) : dr(e), cr(e);
      var r = yr(e);
      e.teardown = typeof r == "function" ? r : null, e.wv = mr;
      var s;
    } finally {
      Lt = i, A = n;
    }
  }
}
function x(e) {
  var t = e.f, n = (t & L) !== 0;
  if (b !== null && !le) {
    var i = A !== null && (A.f & Pe) !== 0;
    if (!i && !(z != null && z.includes(e))) {
      var r = b.deps;
      if ((b.f & Wt) !== 0)
        e.rv < Le && (e.rv = Le, j === null && r !== null && r[W] === e ? W++ : j === null ? j = [e] : j.push(e));
      else {
        (b.deps ?? (b.deps = [])).push(e);
        var s = e.reactions;
        s === null ? e.reactions = [b] : s.includes(b) || s.push(b);
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
      return ((o.f & D) === 0 && o.reactions !== null || Er(o)) && (l = pn(o)), Ae.set(o, l), l;
    }
    var a = (o.f & ie) === 0 && !le && b !== null && (Lt || (b.f & ie) !== 0), f = o.deps === null;
    At(o) && (a && (o.f |= ie), ir(o)), a && !f && br(o);
  }
  if (M != null && M.has(e))
    return M.get(e);
  if ((e.f & Ie) !== 0)
    throw e.v;
  return e.v;
}
function br(e) {
  if (e.deps !== null) {
    e.f |= ie;
    for (const t of e.deps)
      (t.reactions ?? (t.reactions = [])).push(e), (t.f & L) !== 0 && (t.f & ie) === 0 && br(
        /** @type {Derived} */
        t
      );
  }
}
function Er(e) {
  if (e.v === O) return !0;
  if (e.deps === null) return !1;
  for (const t of e.deps)
    if (Ae.has(t) || (t.f & L) !== 0 && Er(
      /** @type {Derived} */
      t
    ))
      return !0;
  return !1;
}
function Ti(e) {
  var t = le;
  try {
    return le = !0, e();
  } finally {
    le = t;
  }
}
const Ri = ["touchstart", "touchmove"];
function Ci(e) {
  return Ri.includes(e);
}
const Sr = /* @__PURE__ */ new Set(), rn = /* @__PURE__ */ new Set();
function Oi(e) {
  for (var t = 0; t < e.length; t++)
    Sr.add(e[t]);
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
    var a = r.indexOf(l);
    if (a !== -1 && (t === document || t === /** @type {any} */
    window)) {
      e.__root = t;
      return;
    }
    var f = r.indexOf(t);
    if (f === -1)
      return;
    a <= f && (o = a);
  }
  if (s = /** @type {Element} */
  r[o] || e.target, s !== t) {
    Cr(e, "currentTarget", {
      configurable: !0,
      get() {
        return s || n;
      }
    });
    var c = b, d = A;
    q(null), pe(null);
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
      e.__root = t, delete e.currentTarget, q(c), pe(d);
    }
  }
}
function Mi(e) {
  var t = document.createElement("template");
  return t.innerHTML = e.replaceAll("<!>", "<!---->"), t.content;
}
function An(e, t) {
  var n = (
    /** @type {Effect} */
    A
  );
  n.nodes === null && (n.nodes = { start: e, end: t, a: null, t: null });
}
// @__NO_SIDE_EFFECTS__
function Li(e, t, n = "svg") {
  var i = !e.startsWith("<!>"), r = (t & Wr) !== 0, s = `<${n}>${i ? e : "<!>" + e}</${n}>`, o;
  return () => {
    if (!o) {
      var l = (
        /** @type {DocumentFragment} */
        Mi(s)
      ), a = (
        /** @type {Element} */
        /* @__PURE__ */ Oe(l)
      );
      if (r)
        for (o = document.createDocumentFragment(); /* @__PURE__ */ Oe(a); )
          o.appendChild(
            /** @type {TemplateNode} */
            /* @__PURE__ */ Oe(a)
          );
      else
        o = /** @type {Element} */
        /* @__PURE__ */ Oe(a);
    }
    var f = (
      /** @type {TemplateNode} */
      o.cloneNode(!0)
    );
    if (r) {
      var c = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ Oe(f)
      ), d = (
        /** @type {TemplateNode} */
        f.lastChild
      );
      An(c, d);
    } else
      An(f, f);
    return f;
  };
}
// @__NO_SIDE_EFFECTS__
function _t(e, t) {
  return /* @__PURE__ */ Li(e, t, "svg");
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
function Yi(e, t) {
  return Di(e, t);
}
const qe = /* @__PURE__ */ new Map();
function Di(e, { target: t, anchor: n, props: i = {}, events: r, context: s, intro: o = !0 }) {
  gi();
  var l = /* @__PURE__ */ new Set(), a = (d) => {
    for (var u = 0; u < d.length; u++) {
      var v = d[u];
      if (!l.has(v)) {
        l.add(v);
        var h = Ci(v);
        t.addEventListener(v, Rt, { passive: h });
        var g = qe.get(v);
        g === void 0 ? (document.addEventListener(v, Rt, { passive: h }), qe.set(v, 1)) : qe.set(v, g + 1);
      }
    }
  };
  a(zt(Sr)), rn.add(a);
  var f = void 0, c = Ei(() => {
    var d = n ?? t.appendChild(Yt());
    return si(
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
            fe
          );
          v.c = s;
        }
        r && (i.$$events = r), f = e(u, i) || {}, s && gt();
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
      rn.delete(a), d !== n && ((h = d.parentNode) == null || h.removeChild(d));
    };
  });
  return sn.set(f, c), f;
}
let sn = /* @__PURE__ */ new WeakMap();
function Fn(e, t) {
  const n = sn.get(e);
  return n ? (sn.delete(e), n(t)) : Promise.resolve();
}
function Bi(e, t, n) {
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
    var a = i.length === 0 && n !== null;
    if (a) {
      var f = (
        /** @type {Element} */
        n
      ), c = (
        /** @type {Element} */
        f.parentNode
      );
      mi(c), c.append(f), e.items.clear();
    }
    on(t, !a);
  } else
    s = {
      pending: new Set(t),
      done: /* @__PURE__ */ new Set()
    }, (e.outrogroups ?? (e.outrogroups = /* @__PURE__ */ new Set())).add(s);
}
function on(e, t = !0) {
  for (var n = 0; n < e.length; n++)
    ae(e[n], t);
}
var Tn;
function Ct(e, t, n, i, r, s = null) {
  var o = e, l = /* @__PURE__ */ new Map(), a = null, f = /* @__PURE__ */ di(() => {
    var g = n();
    return Vn(g) ? g : g == null ? [] : zt(g);
  }), c, d = !0;
  function u() {
    h.fallback = a, zi(h, c, o, t, i), a !== null && (c.length === 0 ? (a.f & ke) === 0 ? vr(a) : (a.f ^= ke, xt(a, null, o)) : $e(a, () => {
      a = null;
    }));
  }
  var v = ur(() => {
    c = /** @type {V[]} */
    x(f);
    for (var g = c.length, S = /* @__PURE__ */ new Set(), _ = (
      /** @type {Batch} */
      F
    ), m = wi(), E = 0; E < g; E += 1) {
      var P = c[E], I = i(P, E), T = d ? null : l.get(I);
      T ? (T.v && ct(T.v, P), T.i && ct(T.i, E), m && _.skipped_effects.delete(T.e)) : (T = Ui(
        l,
        d ? o : Tn ?? (Tn = Yt()),
        P,
        I,
        E,
        r,
        t,
        n
      ), d || (T.e.f |= ke), l.set(I, T)), S.add(I);
    }
    if (g === 0 && s && !a && (d ? a = ue(() => s(o)) : (a = ue(() => s(Tn ?? (Tn = Yt()))), a.f |= ke)), !d)
      if (m) {
        for (const [X, J] of l)
          S.has(X) || _.skipped_effects.add(J.e);
        _.oncommit(u), _.ondiscard(() => {
        });
      } else
        u();
    x(f);
  }), h = { effect: v, items: l, outrogroups: null, fallback: a };
  d = !1;
}
function zi(e, t, n, i, r) {
  var J;
  var s = t.length, o = e.items, l = e.effect.first, a, f = null, c = [], d = [], u, v, h, g;
  for (g = 0; g < s; g += 1) {
    if (u = t[g], v = r(u, g), h = /** @type {EachItem} */
    o.get(v).e, e.outrogroups !== null)
      for (const Q of e.outrogroups)
        Q.pending.delete(h), Q.done.delete(h);
    if ((h.f & ke) !== 0)
      if (h.f ^= ke, h === l)
        xt(h, null, n);
      else {
        var S = f ? f.next : l;
        h === e.effect.last && (e.effect.last = h.prev), h.prev && (h.prev.next = h.next), h.next && (h.next.prev = h.prev), be(e, f, h), be(e, h, S), xt(h, S, n), f = h, c = [], d = [], l = f.next;
        continue;
      }
    if ((h.f & Z) !== 0 && vr(h), h !== l) {
      if (a !== void 0 && a.has(h)) {
        if (c.length < d.length) {
          var _ = d[0], m;
          f = _.prev;
          var E = c[0], P = c[c.length - 1];
          for (m = 0; m < c.length; m += 1)
            xt(c[m], _, n);
          for (m = 0; m < d.length; m += 1)
            a.delete(d[m]);
          be(e, E.prev, P.next), be(e, f, E), be(e, P, _), l = _, f = P, g -= 1, c = [], d = [];
        } else
          a.delete(h), xt(h, l, n), be(e, h.prev, h.next), be(e, h, f === null ? e.effect.first : f.next), be(e, f, h), f = h;
        continue;
      }
      for (c = [], d = []; l !== null && l !== h; )
        (a ?? (a = /* @__PURE__ */ new Set())).add(l), d.push(l), l = l.next;
      if (l === null)
        continue;
    }
    (h.f & ke) === 0 && c.push(h), f = h, l = h.next;
  }
  if (e.outrogroups !== null) {
    for (const Q of e.outrogroups)
      Q.pending.size === 0 && (on(zt(Q.done)), (J = e.outrogroups) == null || J.delete(Q));
    e.outrogroups.size === 0 && (e.outrogroups = null);
  }
  if (l !== null || a !== void 0) {
    var I = [];
    if (a !== void 0)
      for (h of a)
        (h.f & Z) === 0 && I.push(h);
    for (; l !== null; )
      (l.f & Z) === 0 && l !== e.fallback && I.push(l), l = l.next;
    var T = I.length;
    if (T > 0) {
      var X = null;
      Bi(e, I, X);
    }
  }
}
function Ui(e, t, n, i, r, s, o, l) {
  var a = (o & Hr) !== 0 ? (o & Kr) === 0 ? /* @__PURE__ */ pi(n, !1, !1) : je(n) : null, f = (o & Xr) !== 0 ? je(r) : null;
  return {
    v: a,
    i: f,
    e: ue(() => (s(t, a ?? n, f ?? r, l), () => {
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
function Vi(e, t, n) {
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
function ji(e, t) {
  return e == null ? null : String(e);
}
function Gi(e, t, n, i, r, s) {
  var o = e.__className;
  if (o !== n || o === void 0) {
    var l = Vi(n, i, s);
    l == null ? e.removeAttribute("class") : e.setAttribute("class", l), e.__className = n;
  } else if (s && r !== s)
    for (var a in s) {
      var f = !!s[a];
      (r == null || f !== !!r[a]) && e.classList.toggle(a, f);
    }
  return s;
}
function qi(e, t, n, i) {
  var r = e.__style;
  if (r !== t) {
    var s = ji(t);
    s == null ? e.removeAttribute("style") : e.style.cssText = s, e.__style = t;
  }
  return i;
}
const Hi = Symbol("is custom element"), Xi = Symbol("is html");
function N(e, t, n, i) {
  var r = Ki(e);
  r[t] !== (r[t] = n) && (t === "loading" && (e[Br] = n), n == null ? e.removeAttribute(t) : typeof n != "string" && Wi(e).includes(t) ? e[t] = n : e.setAttribute(t, n));
}
function Ki(e) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    e.__attributes ?? (e.__attributes = {
      [Hi]: e.nodeName.includes("-"),
      [Xi]: e.namespaceURI === Zr
    })
  );
}
var Cn = /* @__PURE__ */ new Map();
function Wi(e) {
  var t = e.getAttribute("is") || e.nodeName, n = Cn.get(t);
  if (n) return n;
  Cn.set(t, n = []);
  for (var i, r = e, s = Element.prototype; s !== r; ) {
    i = Or(r);
    for (var o in i)
      i[o].set && n.push(o);
    r = jn(r);
  }
  return n;
}
const Zi = "5";
var Un;
typeof window < "u" && ((Un = window.__svelte ?? (window.__svelte = {})).v ?? (Un.v = /* @__PURE__ */ new Set())).add(Zi);
const Ji = [
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
Ji.map(([e, t]) => [e.slice().sort((n, i) => i.length - n.length), t]);
const Qi = 5.5;
var y;
(function(e) {
  e.Router = "router", e.L3Switch = "l3-switch", e.L2Switch = "l2-switch", e.Firewall = "firewall", e.LoadBalancer = "load-balancer", e.Server = "server", e.AccessPoint = "access-point", e.CPE = "cpe", e.Cloud = "cloud", e.Internet = "internet", e.VPN = "vpn", e.Database = "database", e.Generic = "generic";
})(y || (y = {}));
y.Router + "", y.L3Switch + "", y.L2Switch + "", y.Firewall + "", y.LoadBalancer + "", y.Server + "", y.AccessPoint + "", y.CPE + "", y.Cloud + "", y.Internet + "", y.VPN + "", y.Database + "", y.Generic + "";
function $i(e) {
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
const es = 1, kr = 2, ts = 4, ns = 8;
function rs(e) {
  switch (e) {
    case "top":
      return es;
    case "bottom":
      return kr;
    case "left":
      return ts;
    case "right":
      return ns;
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
async function is() {
  if (!Xt) {
    const { AvoidLib: e } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await e.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await e.load(process.env.LIBAVOID_WASM_PATH) : await e.load(), Xt = e.getInstance();
  }
  return Xt;
}
async function ss(e, t, n, i) {
  const r = await is(), s = {
    edgeStyle: "orthogonal",
    shapeBufferDistance: 10,
    idealNudgingDistance: 20,
    ...i
  }, o = s.edgeStyle === "polyline" ? r.RouterFlag.PolyLineRouting.value : r.RouterFlag.OrthogonalRouting.value, l = new r.Router(o);
  l.setRoutingParameter(r.RoutingParameter.shapeBufferDistance.value, s.shapeBufferDistance), l.setRoutingParameter(r.RoutingParameter.idealNudgingDistance.value, s.idealNudgingDistance), l.setRoutingParameter(r.RoutingParameter.reverseDirectionPenalty.value, 500), l.setRoutingParameter(r.RoutingParameter.segmentPenalty.value, 50), l.setRoutingOption(r.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes.value, !0), l.setRoutingOption(r.RoutingOption.nudgeOrthogonalTouchingColinearSegments.value, !0), l.setRoutingOption(r.RoutingOption.performUnifyingNudgingPreprocessingStep.value, !0), l.setRoutingOption(r.RoutingOption.nudgeSharedPathsWithCommonEndPoint.value, !0);
  try {
    return us(r, l, e, t, n, s.edgeStyle);
  } finally {
    l.delete();
  }
}
function os(e, t, n) {
  const i = /* @__PURE__ */ new Map();
  for (const [r, s] of n)
    i.set(r, new e.ShapeRef(t, new e.Rectangle(new e.Point(s.position.x, s.position.y), s.size.width, s.size.height)));
  return i;
}
function ls(e, t, n, i) {
  const r = /* @__PURE__ */ new Map();
  let s = 1;
  for (const [o, l] of i) {
    const a = t.get(l.nodeId), f = n.get(l.nodeId);
    if (!a || !f)
      continue;
    const c = s++;
    r.set(o, c);
    const d = (l.absolutePosition.x - (f.position.x - f.size.width / 2)) / f.size.width, u = (l.absolutePosition.y - (f.position.y - f.size.height / 2)) / f.size.height, v = l.side === "top" || l.side === "bottom" ? kr : rs(l.side);
    new e.ShapeConnectionPin(a, c, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, u)), !0, 0, v).setExclusive(!1);
  }
  return r;
}
function as(e, t, n, i, r, s, o) {
  const l = /* @__PURE__ */ new Map();
  let a = null, f = null;
  for (const [d, u] of o.entries()) {
    const v = u.id ?? `__link_${d}`, h = We(u.from), g = We(u.to);
    if (!n.has(h) || !n.has(g))
      continue;
    const S = Ze(u.from), _ = Ze(u.to), m = S ? `${h}:${S}` : null, E = _ ? `${g}:${_}` : null, P = m ? i.get(m) : void 0;
    let I;
    if (P !== void 0)
      I = new e.ConnEnd(n.get(h), P);
    else {
      const mt = m ? s.get(m) : void 0, wt = r.get(h), ye = (mt == null ? void 0 : mt.absolutePosition) ?? (wt == null ? void 0 : wt.position);
      if (!ye)
        continue;
      I = new e.ConnEnd(new e.Point(ye.x, ye.y));
    }
    const T = E ? s.get(E) : void 0, X = r.get(g), J = (T == null ? void 0 : T.absolutePosition) ?? (X == null ? void 0 : X.position);
    if (!J)
      continue;
    const Q = new e.ConnEnd(new e.Point(J.x, J.y)), Ft = new e.ConnRef(t, I, Q), Ce = E ? s.get(E) : null;
    if (Ce) {
      const mt = Math.max(Ce.size.width, Ce.size.height) / 2, wt = Ce.label.length * Qi + 8, ye = mt + wt;
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
    l.set(v, Ft), a === null && P !== void 0 && m && (a = v, f = m);
  }
  t.processTransaction();
  let c = !0;
  if (a && f) {
    const d = l.get(a), u = s.get(f);
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
      const S = Ze(u.from), _ = Ze(u.to), m = S ? `${h}:${S}` : null, E = _ ? `${g}:${_}` : null, P = m ? s.get(m) : void 0, I = r.get(h), T = (P == null ? void 0 : P.absolutePosition) ?? (I == null ? void 0 : I.position);
      if (!T)
        continue;
      const X = E ? s.get(E) : void 0, J = r.get(g), Q = (X == null ? void 0 : X.absolutePosition) ?? (J == null ? void 0 : J.position);
      if (!Q)
        continue;
      const Ft = new e.ConnRef(t, new e.ConnEnd(new e.Point(T.x, T.y)), new e.ConnEnd(new e.Point(Q.x, Q.y)));
      l.set(v, Ft);
    }
    t.processTransaction();
  }
  return l;
}
function fs(e, t, n) {
  const i = /* @__PURE__ */ new Map();
  for (const [r, s] of t.entries()) {
    const o = s.id ?? `__link_${r}`, l = e.get(o);
    if (!l)
      continue;
    const a = l.displayRoute(), f = [];
    for (let _ = 0; _ < a.size(); _++) {
      const m = a.at(_);
      f.push({ x: m.x, y: m.y });
    }
    const c = f[0], d = f[f.length - 1], u = n === "straight" && f.length > 2 && c && d ? [c, d] : f, v = We(s.from), h = We(s.to), g = Ze(s.from), S = Ze(s.to);
    i.set(o, {
      id: o,
      fromPortId: g ? `${v}:${g}` : null,
      toPortId: S ? `${h}:${S}` : null,
      fromNodeId: v,
      toNodeId: h,
      fromEndpoint: On(s.from),
      toEndpoint: On(s.to),
      points: u,
      width: $i(s),
      link: s
    });
  }
  return i;
}
function us(e, t, n, i, r, s) {
  const o = os(e, t, n), l = ls(e, o, n, i), a = as(e, t, o, l, n, i, r), f = fs(a, r, s);
  return cs(f);
}
function cs(e) {
  const t = /* @__PURE__ */ new Map();
  for (const [r, s] of e)
    t.set(r, {
      ...s,
      points: s.points.map((o) => ({ ...o }))
    });
  const n = [];
  for (const [r, s] of t)
    for (const [o, l] of s.points.entries()) {
      const a = s.points[o + 1];
      a && Math.abs(l.y - a.y) < 0.5 && Math.abs(l.x - a.x) > 1 && n.push({
        edgeId: r,
        pointIndex: o,
        fixed: l.y,
        min: Math.min(l.x, a.x),
        max: Math.max(l.x, a.x),
        width: s.width
      });
    }
  Mn(n, t, "y");
  const i = [];
  for (const [r, s] of t)
    for (const [o, l] of s.points.entries()) {
      const a = s.points[o + 1];
      a && Math.abs(l.x - a.x) < 0.5 && Math.abs(l.y - a.y) > 1 && i.push({
        edgeId: r,
        pointIndex: o,
        fixed: l.x,
        min: Math.min(l.y, a.y),
        max: Math.max(l.y, a.y),
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
      const f = (o - l) / 2;
      Ln(t, r, -f, n), Ln(t, s, f, n), r.fixed -= f, s.fixed += f;
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
const Vt = 8;
function ds(e, t, n = Vt) {
  return e.x - e.w / 2 - n < t.x + t.w / 2 && e.x + e.w / 2 + n > t.x - t.w / 2 && e.y - e.h / 2 - n < t.y + t.h / 2 && e.y + e.h / 2 + n > t.y - t.h / 2;
}
function hs(e, t, n = Vt) {
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
function ps(e, t, n, i, r = Vt) {
  const s = i.get(e);
  if (!s)
    return { x: t, y: n };
  let o = t, l = n;
  for (const [a, f] of i) {
    if (a === e)
      continue;
    const c = { x: o, y: l, w: s.size.width, h: s.size.height }, d = { x: f.position.x, y: f.position.y, w: f.size.width, h: f.size.height };
    if (ds(c, d, r)) {
      const u = hs(c, d, r);
      o = u.x, l = u.y;
    }
  }
  return { x: o, y: l };
}
async function vs(e, t, n, i, r, s = Vt) {
  const o = i.nodes.get(e);
  if (!o)
    return null;
  const { x: l, y: a } = ps(e, t, n, i.nodes, s), f = l - o.position.x, c = a - o.position.y;
  if (f === 0 && c === 0)
    return null;
  const d = new Map(i.nodes);
  d.set(e, { ...o, position: { x: l, y: a } });
  const u = new Map(i.ports);
  for (const [h, g] of i.ports)
    g.nodeId === e && u.set(h, {
      ...g,
      absolutePosition: {
        x: g.absolutePosition.x + f,
        y: g.absolutePosition.y + c
      }
    });
  const v = await ss(d, u, r);
  return { nodes: d, ports: u, edges: v };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function Pr(e) {
  return typeof e > "u" || e === null;
}
function gs(e) {
  return typeof e == "object" && e !== null;
}
function _s(e) {
  return Array.isArray(e) ? e : Pr(e) ? [] : [e];
}
function ms(e, t) {
  var n, i, r, s;
  if (t)
    for (s = Object.keys(t), n = 0, i = s.length; n < i; n += 1)
      r = s[n], e[r] = t[r];
  return e;
}
function ws(e, t) {
  var n = "", i;
  for (i = 0; i < t; i += 1)
    n += e;
  return n;
}
function xs(e) {
  return e === 0 && Number.NEGATIVE_INFINITY === 1 / e;
}
var ys = Pr, bs = gs, Es = _s, Ss = ws, ks = xs, Ps = ms, _n = {
  isNothing: ys,
  isObject: bs,
  toArray: Es,
  repeat: Ss,
  isNegativeZero: ks,
  extend: Ps
};
function Ir(e, t) {
  var n = "", i = e.reason || "(unknown reason)";
  return e.mark ? (e.mark.name && (n += 'in "' + e.mark.name + '" '), n += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")", !t && e.mark.snippet && (n += `

` + e.mark.snippet), i + " " + n) : i;
}
function kt(e, t) {
  Error.call(this), this.name = "YAMLException", this.reason = e, this.mark = t, this.message = Ir(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
kt.prototype = Object.create(Error.prototype);
kt.prototype.constructor = kt;
kt.prototype.toString = function(t) {
  return this.name + ": " + Ir(this, t);
};
var Me = kt, Is = [
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
], Ns = [
  "scalar",
  "sequence",
  "mapping"
];
function As(e) {
  var t = {};
  return e !== null && Object.keys(e).forEach(function(n) {
    e[n].forEach(function(i) {
      t[String(i)] = n;
    });
  }), t;
}
function Fs(e, t) {
  if (t = t || {}, Object.keys(t).forEach(function(n) {
    if (Is.indexOf(n) === -1)
      throw new Me('Unknown option "' + n + '" is met in definition of "' + e + '" YAML type.');
  }), this.options = t, this.tag = e, this.kind = t.kind || null, this.resolve = t.resolve || function() {
    return !0;
  }, this.construct = t.construct || function(n) {
    return n;
  }, this.instanceOf = t.instanceOf || null, this.predicate = t.predicate || null, this.represent = t.represent || null, this.representName = t.representName || null, this.defaultStyle = t.defaultStyle || null, this.multi = t.multi || !1, this.styleAliases = As(t.styleAliases || null), Ns.indexOf(this.kind) === -1)
    throw new Me('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.');
}
var B = Fs;
function Yn(e, t) {
  var n = [];
  return e[t].forEach(function(i) {
    var r = n.length;
    n.forEach(function(s, o) {
      s.tag === i.tag && s.kind === i.kind && s.multi === i.multi && (r = o);
    }), n[r] = i;
  }), n;
}
function Ts() {
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
  if (t instanceof B)
    i.push(t);
  else if (Array.isArray(t))
    i = i.concat(t);
  else if (t && (Array.isArray(t.implicit) || Array.isArray(t.explicit)))
    t.implicit && (n = n.concat(t.implicit)), t.explicit && (i = i.concat(t.explicit));
  else
    throw new Me("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  n.forEach(function(s) {
    if (!(s instanceof B))
      throw new Me("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (s.loadKind && s.loadKind !== "scalar")
      throw new Me("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (s.multi)
      throw new Me("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), i.forEach(function(s) {
    if (!(s instanceof B))
      throw new Me("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var r = Object.create(ln.prototype);
  return r.implicit = (this.implicit || []).concat(n), r.explicit = (this.explicit || []).concat(i), r.compiledImplicit = Yn(r, "implicit"), r.compiledExplicit = Yn(r, "explicit"), r.compiledTypeMap = Ts(r.compiledImplicit, r.compiledExplicit), r;
};
var Rs = ln, Cs = new B("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(e) {
    return e !== null ? e : "";
  }
}), Os = new B("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(e) {
    return e !== null ? e : [];
  }
}), Ms = new B("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(e) {
    return e !== null ? e : {};
  }
}), Ls = new Rs({
  explicit: [
    Cs,
    Os,
    Ms
  ]
});
function Ys(e) {
  if (e === null) return !0;
  var t = e.length;
  return t === 1 && e === "~" || t === 4 && (e === "null" || e === "Null" || e === "NULL");
}
function Ds() {
  return null;
}
function Bs(e) {
  return e === null;
}
var zs = new B("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Ys,
  construct: Ds,
  predicate: Bs,
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
function Us(e) {
  if (e === null) return !1;
  var t = e.length;
  return t === 4 && (e === "true" || e === "True" || e === "TRUE") || t === 5 && (e === "false" || e === "False" || e === "FALSE");
}
function Vs(e) {
  return e === "true" || e === "True" || e === "TRUE";
}
function js(e) {
  return Object.prototype.toString.call(e) === "[object Boolean]";
}
var Gs = new B("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: Us,
  construct: Vs,
  predicate: js,
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
function qs(e) {
  return 48 <= e && e <= 57 || 65 <= e && e <= 70 || 97 <= e && e <= 102;
}
function Hs(e) {
  return 48 <= e && e <= 55;
}
function Xs(e) {
  return 48 <= e && e <= 57;
}
function Ks(e) {
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
          if (!qs(e.charCodeAt(n))) return !1;
          i = !0;
        }
      return i && r !== "_";
    }
    if (r === "o") {
      for (n++; n < t; n++)
        if (r = e[n], r !== "_") {
          if (!Hs(e.charCodeAt(n))) return !1;
          i = !0;
        }
      return i && r !== "_";
    }
  }
  if (r === "_") return !1;
  for (; n < t; n++)
    if (r = e[n], r !== "_") {
      if (!Xs(e.charCodeAt(n)))
        return !1;
      i = !0;
    }
  return !(!i || r === "_");
}
function Ws(e) {
  var t = e, n = 1, i;
  if (t.indexOf("_") !== -1 && (t = t.replace(/_/g, "")), i = t[0], (i === "-" || i === "+") && (i === "-" && (n = -1), t = t.slice(1), i = t[0]), t === "0") return 0;
  if (i === "0") {
    if (t[1] === "b") return n * parseInt(t.slice(2), 2);
    if (t[1] === "x") return n * parseInt(t.slice(2), 16);
    if (t[1] === "o") return n * parseInt(t.slice(2), 8);
  }
  return n * parseInt(t, 10);
}
function Zs(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && e % 1 === 0 && !_n.isNegativeZero(e);
}
var Js = new B("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: Ks,
  construct: Ws,
  predicate: Zs,
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
}), Qs = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function $s(e) {
  return !(e === null || !Qs.test(e) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  e[e.length - 1] === "_");
}
function eo(e) {
  var t, n;
  return t = e.replace(/_/g, "").toLowerCase(), n = t[0] === "-" ? -1 : 1, "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)), t === ".inf" ? n === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : t === ".nan" ? NaN : n * parseFloat(t, 10);
}
var to = /^[-+]?[0-9]+e/;
function no(e, t) {
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
  return n = e.toString(10), to.test(n) ? n.replace("e", ".e") : n;
}
function ro(e) {
  return Object.prototype.toString.call(e) === "[object Number]" && (e % 1 !== 0 || _n.isNegativeZero(e));
}
var io = new B("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: $s,
  construct: eo,
  predicate: ro,
  represent: no,
  defaultStyle: "lowercase"
}), so = Ls.extend({
  implicit: [
    zs,
    Gs,
    Js,
    io
  ]
}), oo = so, Nr = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Ar = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function lo(e) {
  return e === null ? !1 : Nr.exec(e) !== null || Ar.exec(e) !== null;
}
function ao(e) {
  var t, n, i, r, s, o, l, a = 0, f = null, c, d, u;
  if (t = Nr.exec(e), t === null && (t = Ar.exec(e)), t === null) throw new Error("Date resolve error");
  if (n = +t[1], i = +t[2] - 1, r = +t[3], !t[4])
    return new Date(Date.UTC(n, i, r));
  if (s = +t[4], o = +t[5], l = +t[6], t[7]) {
    for (a = t[7].slice(0, 3); a.length < 3; )
      a += "0";
    a = +a;
  }
  return t[9] && (c = +t[10], d = +(t[11] || 0), f = (c * 60 + d) * 6e4, t[9] === "-" && (f = -f)), u = new Date(Date.UTC(n, i, r, s, o, l, a)), f && u.setTime(u.getTime() - f), u;
}
function fo(e) {
  return e.toISOString();
}
var uo = new B("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: lo,
  construct: ao,
  instanceOf: Date,
  represent: fo
});
function co(e) {
  return e === "<<" || e === null;
}
var ho = new B("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: co
}), mn = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function po(e) {
  if (e === null) return !1;
  var t, n, i = 0, r = e.length, s = mn;
  for (n = 0; n < r; n++)
    if (t = s.indexOf(e.charAt(n)), !(t > 64)) {
      if (t < 0) return !1;
      i += 6;
    }
  return i % 8 === 0;
}
function vo(e) {
  var t, n, i = e.replace(/[\r\n=]/g, ""), r = i.length, s = mn, o = 0, l = [];
  for (t = 0; t < r; t++)
    t % 4 === 0 && t && (l.push(o >> 16 & 255), l.push(o >> 8 & 255), l.push(o & 255)), o = o << 6 | s.indexOf(i.charAt(t));
  return n = r % 4 * 6, n === 0 ? (l.push(o >> 16 & 255), l.push(o >> 8 & 255), l.push(o & 255)) : n === 18 ? (l.push(o >> 10 & 255), l.push(o >> 2 & 255)) : n === 12 && l.push(o >> 4 & 255), new Uint8Array(l);
}
function go(e) {
  var t = "", n = 0, i, r, s = e.length, o = mn;
  for (i = 0; i < s; i++)
    i % 3 === 0 && i && (t += o[n >> 18 & 63], t += o[n >> 12 & 63], t += o[n >> 6 & 63], t += o[n & 63]), n = (n << 8) + e[i];
  return r = s % 3, r === 0 ? (t += o[n >> 18 & 63], t += o[n >> 12 & 63], t += o[n >> 6 & 63], t += o[n & 63]) : r === 2 ? (t += o[n >> 10 & 63], t += o[n >> 4 & 63], t += o[n << 2 & 63], t += o[64]) : r === 1 && (t += o[n >> 2 & 63], t += o[n << 4 & 63], t += o[64], t += o[64]), t;
}
function _o(e) {
  return Object.prototype.toString.call(e) === "[object Uint8Array]";
}
var mo = new B("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: po,
  construct: vo,
  predicate: _o,
  represent: go
}), wo = Object.prototype.hasOwnProperty, xo = Object.prototype.toString;
function yo(e) {
  if (e === null) return !0;
  var t = [], n, i, r, s, o, l = e;
  for (n = 0, i = l.length; n < i; n += 1) {
    if (r = l[n], o = !1, xo.call(r) !== "[object Object]") return !1;
    for (s in r)
      if (wo.call(r, s))
        if (!o) o = !0;
        else return !1;
    if (!o) return !1;
    if (t.indexOf(s) === -1) t.push(s);
    else return !1;
  }
  return !0;
}
function bo(e) {
  return e !== null ? e : [];
}
var Eo = new B("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: yo,
  construct: bo
}), So = Object.prototype.toString;
function ko(e) {
  if (e === null) return !0;
  var t, n, i, r, s, o = e;
  for (s = new Array(o.length), t = 0, n = o.length; t < n; t += 1) {
    if (i = o[t], So.call(i) !== "[object Object]" || (r = Object.keys(i), r.length !== 1)) return !1;
    s[t] = [r[0], i[r[0]]];
  }
  return !0;
}
function Po(e) {
  if (e === null) return [];
  var t, n, i, r, s, o = e;
  for (s = new Array(o.length), t = 0, n = o.length; t < n; t += 1)
    i = o[t], r = Object.keys(i), s[t] = [r[0], i[r[0]]];
  return s;
}
var Io = new B("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: ko,
  construct: Po
}), No = Object.prototype.hasOwnProperty;
function Ao(e) {
  if (e === null) return !0;
  var t, n = e;
  for (t in n)
    if (No.call(n, t) && n[t] !== null)
      return !1;
  return !0;
}
function Fo(e) {
  return e !== null ? e : {};
}
var To = new B("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Ao,
  construct: Fo
});
oo.extend({
  implicit: [
    uo,
    ho
  ],
  explicit: [
    mo,
    Eo,
    Io,
    To
  ]
});
function Dn(e) {
  return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? `
` : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? '"' : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? " " : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
}
var Ro = new Array(256), Co = new Array(256);
for (var He = 0; He < 256; He++)
  Ro[He] = Dn(He) ? 1 : 0, Co[He] = Dn(He);
var Bn;
(function(e) {
  e.Router = "router", e.L3Switch = "l3-switch", e.L2Switch = "l2-switch", e.Firewall = "firewall", e.LoadBalancer = "load-balancer", e.Server = "server", e.AccessPoint = "access-point", e.CPE = "cpe", e.Cloud = "cloud", e.Internet = "internet", e.VPN = "vpn", e.Database = "database", e.Generic = "generic";
})(Bn || (Bn = {}));
const zn = {
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
      [y.Router]: "#3b82f6",
      [y.L3Switch]: "#8b5cf6",
      [y.L2Switch]: "#a78bfa",
      [y.Firewall]: "#ef4444",
      [y.LoadBalancer]: "#f59e0b",
      [y.Server]: "#10b981",
      [y.AccessPoint]: "#06b6d4",
      [y.Cloud]: "#3b82f6",
      [y.Internet]: "#6366f1",
      [y.Generic]: "#94a3b8"
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
  ...zn.colors,
  // Device colors (adjusted for dark)
  devices: (y.Router + "", y.L3Switch + "", y.L2Switch + "", y.Firewall + "", y.LoadBalancer + "", y.Server + "", y.AccessPoint + "", y.Cloud + "", y.Internet + "", y.Generic + "")
}, {
  ...zn.shadows
});
var Oo = /* @__PURE__ */ _t('<g class="edge"><path fill="none" stroke="#64748b" stroke-linecap="round" stroke-linejoin="round"></path></g>');
function Mo(e, t) {
  vt(t, !0);
  const n = /* @__PURE__ */ ne(() => () => {
    if (t.edge.points.length === 0) return "";
    const [s, ...o] = t.edge.points;
    if (!s) return "";
    let l = `M ${s.x} ${s.y}`;
    for (const a of o)
      l += ` L ${a.x} ${a.y}`;
    return l;
  });
  var i = Oo(), r = Fe(i);
  Nt(
    (s) => {
      N(i, "data-edge-id", t.edge.id), N(r, "d", s), N(r, "stroke-width", t.edge.width);
    },
    [() => x(n)()]
  ), ht(e, i), gt();
}
var Lo = /* @__PURE__ */ _t('<g><rect rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"></rect><text text-anchor="middle" dominant-baseline="central" font-size="14" fill="#1e293b"> </text></g>');
function Yo(e, t) {
  vt(t, !0);
  const n = /* @__PURE__ */ ne(() => t.node.position.x - t.node.size.width / 2), i = /* @__PURE__ */ ne(() => t.node.position.y - t.node.size.height / 2);
  let r = /* @__PURE__ */ V(!1), s = /* @__PURE__ */ V(re({ x: 0, y: 0 })), o = /* @__PURE__ */ V(re({ x: 0, y: 0 }));
  function l(_) {
    const m = _.target.closest("svg");
    if (!m) return { x: _.clientX, y: _.clientY };
    const E = m.createSVGPoint();
    E.x = _.clientX, E.y = _.clientY;
    const P = m.getScreenCTM();
    if (!P) return { x: _.clientX, y: _.clientY };
    const I = E.matrixTransform(P.inverse());
    return { x: I.x, y: I.y };
  }
  function a(_) {
    G(r, !0);
    const m = l(_);
    G(s, m, !0), G(o, { x: t.node.position.x, y: t.node.position.y }, !0), _.target.setPointerCapture(_.pointerId), _.preventDefault();
  }
  function f(_) {
    var I;
    if (!x(r)) return;
    const m = l(_), E = x(o).x + (m.x - x(s).x), P = x(o).y + (m.y - x(s).y);
    (I = t.ondragmove) == null || I.call(t, t.node.id, E, P);
  }
  function c() {
    G(r, !1);
  }
  const d = /* @__PURE__ */ ne(() => Array.isArray(t.node.node.label) ? t.node.node.label[0] ?? "" : t.node.node.label ?? "");
  var u = Lo();
  let v;
  u.__pointerdown = a, u.__pointermove = f, u.__pointerup = c;
  var h = Fe(u), g = Qe(h), S = Fe(g);
  Nt(() => {
    v = Gi(u, 0, "node", null, v, { dragging: x(r) }), N(u, "data-node-id", t.node.id), qi(u, `cursor: ${x(r) ? "grabbing" : "grab"}`), N(h, "x", x(n)), N(h, "y", x(i)), N(h, "width", t.node.size.width), N(h, "height", t.node.size.height), N(g, "x", t.node.position.x), N(g, "y", t.node.position.y), gn(S, x(d));
  }), ht(e, u), gt();
}
Oi(["pointerdown", "pointermove", "pointerup"]);
var Do = /* @__PURE__ */ _t('<g class="port"><rect rx="2" fill="#334155" stroke="#0f172a" stroke-width="1"></rect><text font-size="9" fill="#64748b"> </text></g>');
function Bo(e, t) {
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
  var o = Do(), l = Fe(o), a = Qe(l), f = Fe(a);
  Nt(
    (c, d, u) => {
      N(o, "data-port-id", t.port.id), N(l, "x", t.port.absolutePosition.x - t.port.size.width / 2), N(l, "y", t.port.absolutePosition.y - t.port.size.height / 2), N(l, "width", t.port.size.width), N(l, "height", t.port.size.height), N(a, "x", c), N(a, "y", d), N(a, "text-anchor", u), gn(f, t.port.label);
    },
    [
      () => x(i)(),
      () => x(r)(),
      () => x(s)()
    ]
  ), ht(e, o), gt();
}
var zo = /* @__PURE__ */ _t('<g class="subgraph"><rect rx="12" fill="#f1f5f9" fill-opacity="0.5" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 2"></rect><text font-size="11" font-weight="600" fill="#475569" text-transform="uppercase"> </text></g>');
function Uo(e, t) {
  vt(t, !0);
  var n = zo(), i = Fe(n), r = Qe(i), s = Fe(r);
  Nt(() => {
    N(n, "data-subgraph-id", t.subgraph.id), N(i, "x", t.subgraph.bounds.x), N(i, "y", t.subgraph.bounds.y), N(i, "width", t.subgraph.bounds.width), N(i, "height", t.subgraph.bounds.height), N(r, "x", t.subgraph.bounds.x + 12), N(r, "y", t.subgraph.bounds.y + 20), gn(s, t.subgraph.subgraph.label);
  }), ht(e, n), gt();
}
var Vo = /* @__PURE__ */ _t("<!><!>", 1), jo = /* @__PURE__ */ _t('<svg xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; user-select: none;"><!><!><!></svg>');
function Go(e, t) {
  vt(t, !0);
  let n = /* @__PURE__ */ V(re(new Map(t.layout.nodes))), i = /* @__PURE__ */ V(re(new Map(t.layout.ports))), r = /* @__PURE__ */ V(re(new Map(t.layout.edges))), s = re(new Map(t.layout.subgraphs)), o = re(t.layout.bounds);
  const l = /* @__PURE__ */ ne(() => `${o.x - 50} ${o.y - 50} ${o.width + 100} ${o.height + 100}`), a = /* @__PURE__ */ ne(() => [...x(n).values()]), f = /* @__PURE__ */ ne(() => [...x(r).values()]), c = /* @__PURE__ */ ne(() => [...s.values()]), d = /* @__PURE__ */ ne(() => () => {
    const _ = /* @__PURE__ */ new Map();
    for (const m of x(i).values()) {
      const E = _.get(m.nodeId);
      E ? E.push(m) : _.set(m.nodeId, [m]);
    }
    return _;
  });
  async function u(_, m, E) {
    var I;
    if (!((I = t.graph) != null && I.links)) return;
    const P = await vs(_, m, E, { nodes: x(n), ports: x(i) }, t.graph.links);
    P && (G(n, P.nodes, !0), G(i, P.ports, !0), G(r, P.edges, !0));
  }
  var v = jo(), h = Fe(v);
  Ct(h, 17, () => x(c), (_) => _.id, (_, m) => {
    Uo(_, {
      get subgraph() {
        return x(m);
      }
    });
  });
  var g = Qe(h);
  Ct(g, 17, () => x(f), (_) => _.id, (_, m) => {
    Mo(_, {
      get edge() {
        return x(m);
      }
    });
  });
  var S = Qe(g);
  Ct(S, 17, () => x(a), (_) => _.id, (_, m) => {
    var E = Vo(), P = _i(E);
    Yo(P, {
      get node() {
        return x(m);
      },
      ondragmove: u
    });
    var I = Qe(P);
    Ct(I, 17, () => x(d)().get(x(m).id) ?? [], (T) => T.id, (T, X) => {
      Bo(T, {
        get port() {
          return x(X);
        }
      });
    }), ht(_, E);
  }), Nt(() => N(v, "viewBox", x(l))), ht(e, v), gt();
}
class qo extends HTMLElement {
  constructor() {
    super();
    K(this, "_layout", null);
    K(this, "_graph", null);
    K(this, "_instance", null);
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
    !this.shadowRoot || !this._layout || (this._instance && (Fn(this._instance), this._instance = null), this._instance = Yi(Go, {
      target: this.shadowRoot,
      props: {
        layout: this._layout,
        graph: this._graph ?? void 0
      }
    }));
  }
}
typeof window < "u" && (customElements.get("shumoku-renderer") || customElements.define("shumoku-renderer", qo));
export {
  qo as ShumokuRendererElement
};
