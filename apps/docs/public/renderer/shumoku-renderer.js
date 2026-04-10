var Sa = Object.defineProperty;
var Zi = (t) => {
  throw TypeError(t);
};
var Na = (t, e, n) => e in t ? Sa(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var mt = (t, e, n) => Na(t, typeof e != "symbol" ? e + "" : e, n), Qr = (t, e, n) => e.has(t) || Zi("Cannot " + n);
var y = (t, e, n) => (Qr(t, e, "read from private field"), n ? n.call(t) : e.get(t)), j = (t, e, n) => e.has(t) ? Zi("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, n), K = (t, e, n, r) => (Qr(t, e, "write to private field"), r ? r.call(t, n) : e.set(t, n), n), bt = (t, e, n) => (Qr(t, e, "access private method"), n);
var Bo = Array.isArray, Ma = Array.prototype.indexOf, Vr = Array.from, Aa = Object.defineProperty, yn = Object.getOwnPropertyDescriptor, Pa = Object.getOwnPropertyDescriptors, Ia = Object.prototype, za = Array.prototype, Vo = Object.getPrototypeOf, Ji = Object.isExtensible;
function Ta(t) {
  for (var e = 0; e < t.length; e++)
    t[e]();
}
function Xo() {
  var t, e, n = new Promise((r, i) => {
    t = r, e = i;
  });
  return { promise: n, resolve: t, reject: e };
}
const wt = 2, Pr = 4, Xr = 8, qo = 1 << 24, be = 16, ke = 32, sn = 64, Ni = 128, Wt = 512, Et = 1024, Ft = 2048, Ee = 4096, Ht = 8192, ye = 16384, Mi = 32768, zn = 65536, Qi = 1 << 17, Uo = 1 << 18, On = 1 << 19, Ca = 1 << 20, Ce = 1 << 25, tn = 32768, ii = 1 << 21, Ai = 1 << 22, Re = 1 << 23, Gn = Symbol("$state"), Ra = Symbol("legacy props"), La = Symbol(""), pn = new class extends Error {
  constructor() {
    super(...arguments);
    mt(this, "name", "StaleReactionError");
    mt(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function Fa() {
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
const Ga = 1, Wa = 2, Ka = 16, Za = 1, Ja = 4, Qa = 8, ja = 16, $a = 1, tl = 2, pt = Symbol(), el = "http://www.w3.org/1999/xhtml";
function nl() {
  console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
function Go(t) {
  return t === this.v;
}
function rl(t, e) {
  return t != t ? e == e : t !== e || t !== null && typeof t == "object" || typeof t == "function";
}
function Wo(t) {
  return !rl(t, this.v);
}
let Kt = null;
function Tn(t) {
  Kt = t;
}
function an(t, e = !1, n) {
  Kt = {
    p: Kt,
    i: !1,
    c: null,
    e: null,
    s: t,
    x: null,
    l: null
  };
}
function ln(t) {
  var e = (
    /** @type {ComponentContext} */
    Kt
  ), n = e.e;
  if (n !== null) {
    e.e = null;
    for (var r of n)
      fs(r);
  }
  return e.i = !0, Kt = e.p, /** @type {T} */
  {};
}
function Ko() {
  return !0;
}
let _n = [];
function il() {
  var t = _n;
  _n = [], Ta(t);
}
function Le(t) {
  if (_n.length === 0) {
    var e = _n;
    queueMicrotask(() => {
      e === _n && il();
    });
  }
  _n.push(t);
}
function Zo(t) {
  var e = nt;
  if (e === null)
    return Q.f |= Re, t;
  if ((e.f & Mi) === 0) {
    if ((e.f & Ni) === 0)
      throw t;
    e.b.error(t);
  } else
    Cn(t, e);
}
function Cn(t, e) {
  for (; e !== null; ) {
    if ((e.f & Ni) !== 0)
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
function vt(t, e) {
  t.f = t.f & ol | e;
}
function Pi(t) {
  (t.f & Wt) !== 0 || t.deps === null ? vt(t, Et) : vt(t, Ee);
}
function Jo(t) {
  if (t !== null)
    for (const e of t)
      (e.f & wt) === 0 || (e.f & tn) === 0 || (e.f ^= tn, Jo(
        /** @type {Derived} */
        e.deps
      ));
}
function Qo(t, e, n) {
  (t.f & Ft) !== 0 ? e.add(t) : (t.f & Ee) !== 0 && n.add(t), Jo(t.deps), vt(t, Et);
}
const dr = /* @__PURE__ */ new Set();
let st = null, yt = null, Qt = [], Ii = null, oi = !1;
var bn, kn, Ge, En, ir, Sn, Nn, Mn, ce, si, ai, jo;
const Ki = class Ki {
  constructor() {
    j(this, ce);
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
    j(this, bn, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    j(this, kn, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    j(this, Ge, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    j(this, En, 0);
    /**
     * A deferred that resolves when the batch is committed, used with `settled()`
     * TODO replace with Promise.withResolvers once supported widely enough
     * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
     */
    j(this, ir, null);
    /**
     * Deferred effects (which run after async work has completed) that are DIRTY
     * @type {Set<Effect>}
     */
    j(this, Sn, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    j(this, Nn, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    mt(this, "skipped_effects", /* @__PURE__ */ new Set());
    mt(this, "is_fork", !1);
    j(this, Mn, !1);
  }
  is_deferred() {
    return this.is_fork || y(this, En) > 0;
  }
  /**
   *
   * @param {Effect[]} root_effects
   */
  process(e) {
    var i;
    Qt = [], this.apply();
    var n = [], r = [];
    for (const o of e)
      bt(this, ce, si).call(this, o, n, r);
    if (this.is_deferred())
      bt(this, ce, ai).call(this, r), bt(this, ce, ai).call(this, n);
    else {
      for (const o of y(this, bn)) o();
      y(this, bn).clear(), y(this, Ge) === 0 && bt(this, ce, jo).call(this), st = null, ji(r), ji(n), (i = y(this, ir)) == null || i.resolve();
    }
    yt = null;
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} value
   */
  capture(e, n) {
    n !== pt && !this.previous.has(e) && this.previous.set(e, n), (e.f & Re) === 0 && (this.current.set(e, e.v), yt == null || yt.set(e, e.v));
  }
  activate() {
    st = this, this.apply();
  }
  deactivate() {
    st === this && (st = null, yt = null);
  }
  flush() {
    if (this.activate(), Qt.length > 0) {
      if (sl(), st !== null && st !== this)
        return;
    } else y(this, Ge) === 0 && this.process([]);
    this.deactivate();
  }
  discard() {
    for (const e of y(this, kn)) e(this);
    y(this, kn).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(e) {
    K(this, Ge, y(this, Ge) + 1), e && K(this, En, y(this, En) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(e) {
    K(this, Ge, y(this, Ge) - 1), e && K(this, En, y(this, En) - 1), !y(this, Mn) && (K(this, Mn, !0), Le(() => {
      K(this, Mn, !1), this.is_deferred() ? Qt.length > 0 && this.flush() : this.revive();
    }));
  }
  revive() {
    for (const e of y(this, Sn))
      y(this, Nn).delete(e), vt(e, Ft), we(e);
    for (const e of y(this, Nn))
      vt(e, Ee), we(e);
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(e) {
    y(this, bn).add(e);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(e) {
    y(this, kn).add(e);
  }
  settled() {
    return (y(this, ir) ?? K(this, ir, Xo())).promise;
  }
  static ensure() {
    if (st === null) {
      const e = st = new Ki();
      dr.add(st), Le(() => {
        st === e && e.flush();
      });
    }
    return st;
  }
  apply() {
  }
};
bn = new WeakMap(), kn = new WeakMap(), Ge = new WeakMap(), En = new WeakMap(), ir = new WeakMap(), Sn = new WeakMap(), Nn = new WeakMap(), Mn = new WeakMap(), ce = new WeakSet(), /**
 * Traverse the effect tree, executing effects or stashing
 * them for later execution as appropriate
 * @param {Effect} root
 * @param {Effect[]} effects
 * @param {Effect[]} render_effects
 */
si = function(e, n, r) {
  e.f ^= Et;
  for (var i = e.first, o = null; i !== null; ) {
    var s = i.f, a = (s & (ke | sn)) !== 0, u = a && (s & Et) !== 0, c = u || (s & Ht) !== 0 || this.skipped_effects.has(i);
    if (!c && i.fn !== null) {
      a ? i.f ^= Et : o !== null && (s & (Pr | Xr | qo)) !== 0 ? o.b.defer_effect(i) : (s & Pr) !== 0 ? n.push(i) : lr(i) && ((s & be) !== 0 && y(this, Sn).add(i), Zn(i));
      var f = i.first;
      if (f !== null) {
        i = f;
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
ai = function(e) {
  for (var n = 0; n < e.length; n += 1)
    Qo(e[n], y(this, Sn), y(this, Nn));
}, jo = function() {
  var i;
  if (dr.size > 1) {
    this.previous.clear();
    var e = yt, n = !0;
    for (const o of dr) {
      if (o === this) {
        n = !1;
        continue;
      }
      const s = [];
      for (const [u, c] of this.current) {
        if (o.current.has(u))
          if (n && c !== o.current.get(u))
            o.current.set(u, c);
          else
            continue;
        s.push(u);
      }
      if (s.length === 0)
        continue;
      const a = [...o.current.keys()].filter((u) => !this.current.has(u));
      if (a.length > 0) {
        var r = Qt;
        Qt = [];
        const u = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Map();
        for (const f of s)
          $o(f, a, u, c);
        if (Qt.length > 0) {
          st = o, o.apply();
          for (const f of Qt)
            bt(i = o, ce, si).call(i, f, [], []);
          o.deactivate();
        }
        Qt = r;
      }
    }
    st = null, yt = e;
  }
  this.committed = !0, dr.delete(this);
};
let Fe = Ki;
function sl() {
  oi = !0;
  var t = null;
  try {
    for (var e = 0; Qt.length > 0; ) {
      var n = Fe.ensure();
      if (e++ > 1e3) {
        var r, i;
        al();
      }
      n.process(Qt), Oe.clear();
    }
  } finally {
    oi = !1, Ii = null;
  }
}
function al() {
  try {
    Ha();
  } catch (t) {
    Cn(t, Ii);
  }
}
let Jt = null;
function ji(t) {
  var e = t.length;
  if (e !== 0) {
    for (var n = 0; n < e; ) {
      var r = t[n++];
      if ((r.f & (ye | Ht)) === 0 && lr(r) && (Jt = /* @__PURE__ */ new Set(), Zn(r), r.deps === null && r.first === null && r.nodes === null && (r.teardown === null && r.ac === null ? ms(r) : r.fn = null), (Jt == null ? void 0 : Jt.size) > 0)) {
        Oe.clear();
        for (const i of Jt) {
          if ((i.f & (ye | Ht)) !== 0) continue;
          const o = [i];
          let s = i.parent;
          for (; s !== null; )
            Jt.has(s) && (Jt.delete(s), o.push(s)), s = s.parent;
          for (let a = o.length - 1; a >= 0; a--) {
            const u = o[a];
            (u.f & (ye | Ht)) === 0 && Zn(u);
          }
        }
        Jt.clear();
      }
    }
    Jt = null;
  }
}
function $o(t, e, n, r) {
  if (!n.has(t) && (n.add(t), t.reactions !== null))
    for (const i of t.reactions) {
      const o = i.f;
      (o & wt) !== 0 ? $o(
        /** @type {Derived} */
        i,
        e,
        n,
        r
      ) : (o & (Ai | be)) !== 0 && (o & Ft) === 0 && ts(i, e, r) && (vt(i, Ft), we(
        /** @type {Effect} */
        i
      ));
    }
}
function ts(t, e, n) {
  const r = n.get(t);
  if (r !== void 0) return r;
  if (t.deps !== null)
    for (const i of t.deps) {
      if (e.includes(i))
        return !0;
      if ((i.f & wt) !== 0 && ts(
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
    if (oi && e === nt && (n & be) !== 0 && (n & Uo) === 0)
      return;
    if ((n & (sn | ke)) !== 0) {
      if ((n & Et) === 0) return;
      e.f ^= Et;
    }
  }
  Qt.push(e);
}
function ll(t) {
  let e = 0, n = en(0), r;
  return () => {
    Ci() && (l(n), hs(() => (e === 0 && (r = Fi(() => t(() => Wn(n)))), e += 1, () => {
      Le(() => {
        e -= 1, e === 0 && (r == null || r(), r = void 0, Wn(n));
      });
    })));
  };
}
var ul = zn | On | Ni;
function cl(t, e, n) {
  new fl(t, e, n);
}
var Xt, Si, ie, We, oe, qt, Pt, se, me, ze, Ke, Te, An, Ze, Pn, In, pe, Hr, gt, hl, dl, li, xr, br, ui;
class fl {
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(e, n, r) {
    j(this, gt);
    /** @type {Boundary | null} */
    mt(this, "parent");
    mt(this, "is_pending", !1);
    /** @type {TemplateNode} */
    j(this, Xt);
    /** @type {TemplateNode | null} */
    j(this, Si, null);
    /** @type {BoundaryProps} */
    j(this, ie);
    /** @type {((anchor: Node) => void)} */
    j(this, We);
    /** @type {Effect} */
    j(this, oe);
    /** @type {Effect | null} */
    j(this, qt, null);
    /** @type {Effect | null} */
    j(this, Pt, null);
    /** @type {Effect | null} */
    j(this, se, null);
    /** @type {DocumentFragment | null} */
    j(this, me, null);
    /** @type {TemplateNode | null} */
    j(this, ze, null);
    j(this, Ke, 0);
    j(this, Te, 0);
    j(this, An, !1);
    j(this, Ze, !1);
    /** @type {Set<Effect>} */
    j(this, Pn, /* @__PURE__ */ new Set());
    /** @type {Set<Effect>} */
    j(this, In, /* @__PURE__ */ new Set());
    /**
     * A source containing the number of pending async deriveds/expressions.
     * Only created if `$effect.pending()` is used inside the boundary,
     * otherwise updating the source results in needless `Batch.ensure()`
     * calls followed by no-op flushes
     * @type {Source<number> | null}
     */
    j(this, pe, null);
    j(this, Hr, ll(() => (K(this, pe, en(y(this, Ke))), () => {
      K(this, pe, null);
    })));
    K(this, Xt, e), K(this, ie, n), K(this, We, r), this.parent = /** @type {Effect} */
    nt.b, this.is_pending = !!y(this, ie).pending, K(this, oe, Ri(() => {
      nt.b = this;
      {
        var i = bt(this, gt, li).call(this);
        try {
          K(this, qt, Ut(() => r(i)));
        } catch (o) {
          this.error(o);
        }
        y(this, Te) > 0 ? bt(this, gt, br).call(this) : this.is_pending = !1;
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
    Qo(e, y(this, Pn), y(this, In));
  }
  /**
   * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
   * @returns {boolean}
   */
  is_rendered() {
    return !this.is_pending && (!this.parent || this.parent.is_rendered());
  }
  has_pending_snippet() {
    return !!y(this, ie).pending;
  }
  /**
   * Update the source that powers `$effect.pending()` inside this boundary,
   * and controls when the current `pending` snippet (if any) is removed.
   * Do not call from inside the class
   * @param {1 | -1} d
   */
  update_pending_count(e) {
    bt(this, gt, ui).call(this, e), K(this, Ke, y(this, Ke) + e), !(!y(this, pe) || y(this, An)) && (K(this, An, !0), Le(() => {
      K(this, An, !1), y(this, pe) && Rn(y(this, pe), y(this, Ke));
    }));
  }
  get_effect_pending() {
    return y(this, Hr).call(this), l(
      /** @type {Source<number>} */
      y(this, pe)
    );
  }
  /** @param {unknown} error */
  error(e) {
    var n = y(this, ie).onerror;
    let r = y(this, ie).failed;
    if (y(this, Ze) || !n && !r)
      throw e;
    y(this, qt) && (Lt(y(this, qt)), K(this, qt, null)), y(this, Pt) && (Lt(y(this, Pt)), K(this, Pt, null)), y(this, se) && (Lt(y(this, se)), K(this, se, null));
    var i = !1, o = !1;
    const s = () => {
      if (i) {
        nl();
        return;
      }
      i = !0, o && Ua(), Fe.ensure(), K(this, Ke, 0), y(this, se) !== null && Qe(y(this, se), () => {
        K(this, se, null);
      }), this.is_pending = this.has_pending_snippet(), K(this, qt, bt(this, gt, xr).call(this, () => (K(this, Ze, !1), Ut(() => y(this, We).call(this, y(this, Xt)))))), y(this, Te) > 0 ? bt(this, gt, br).call(this) : this.is_pending = !1;
    };
    var a = Q;
    try {
      Ct(null), o = !0, n == null || n(e, s), o = !1;
    } catch (u) {
      Cn(u, y(this, oe) && y(this, oe).parent);
    } finally {
      Ct(a);
    }
    r && Le(() => {
      K(this, se, bt(this, gt, xr).call(this, () => {
        Fe.ensure(), K(this, Ze, !0);
        try {
          return Ut(() => {
            r(
              y(this, Xt),
              () => e,
              () => s
            );
          });
        } catch (u) {
          return Cn(
            u,
            /** @type {Effect} */
            y(this, oe).parent
          ), null;
        } finally {
          K(this, Ze, !1);
        }
      }));
    });
  }
}
Xt = new WeakMap(), Si = new WeakMap(), ie = new WeakMap(), We = new WeakMap(), oe = new WeakMap(), qt = new WeakMap(), Pt = new WeakMap(), se = new WeakMap(), me = new WeakMap(), ze = new WeakMap(), Ke = new WeakMap(), Te = new WeakMap(), An = new WeakMap(), Ze = new WeakMap(), Pn = new WeakMap(), In = new WeakMap(), pe = new WeakMap(), Hr = new WeakMap(), gt = new WeakSet(), hl = function() {
  try {
    K(this, qt, Ut(() => y(this, We).call(this, y(this, Xt))));
  } catch (e) {
    this.error(e);
  }
}, dl = function() {
  const e = y(this, ie).pending;
  e && (K(this, Pt, Ut(() => e(y(this, Xt)))), Le(() => {
    var n = bt(this, gt, li).call(this);
    K(this, qt, bt(this, gt, xr).call(this, () => (Fe.ensure(), Ut(() => y(this, We).call(this, n))))), y(this, Te) > 0 ? bt(this, gt, br).call(this) : (Qe(
      /** @type {Effect} */
      y(this, Pt),
      () => {
        K(this, Pt, null);
      }
    ), this.is_pending = !1);
  }));
}, li = function() {
  var e = y(this, Xt);
  return this.is_pending && (K(this, ze, nn()), y(this, Xt).before(y(this, ze)), e = y(this, ze)), e;
}, /**
 * @param {() => Effect | null} fn
 */
xr = function(e) {
  var n = nt, r = Q, i = Kt;
  ue(y(this, oe)), Ct(y(this, oe)), Tn(y(this, oe).ctx);
  try {
    return e();
  } catch (o) {
    return Zo(o), null;
  } finally {
    ue(n), Ct(r), Tn(i);
  }
}, br = function() {
  const e = (
    /** @type {(anchor: Node) => void} */
    y(this, ie).pending
  );
  y(this, qt) !== null && (K(this, me, document.createDocumentFragment()), y(this, me).append(
    /** @type {TemplateNode} */
    y(this, ze)
  ), ys(y(this, qt), y(this, me))), y(this, Pt) === null && K(this, Pt, Ut(() => e(y(this, Xt))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
ui = function(e) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && bt(n = this.parent, gt, ui).call(n, e);
    return;
  }
  if (K(this, Te, y(this, Te) + e), y(this, Te) === 0) {
    this.is_pending = !1;
    for (const r of y(this, Pn))
      vt(r, Ft), we(r);
    for (const r of y(this, In))
      vt(r, Ee), we(r);
    y(this, Pn).clear(), y(this, In).clear(), y(this, Pt) && Qe(y(this, Pt), () => {
      K(this, Pt, null);
    }), y(this, me) && (y(this, Xt).before(y(this, me)), K(this, me, null));
  }
};
function gl(t, e, n, r) {
  const i = qr;
  var o = t.filter((h) => !h.settled);
  if (n.length === 0 && o.length === 0) {
    r(e.map(i));
    return;
  }
  var s = st, a = (
    /** @type {Effect} */
    nt
  ), u = vl(), c = o.length === 1 ? o[0].promise : o.length > 1 ? Promise.all(o.map((h) => h.promise)) : null;
  function f(h) {
    u();
    try {
      r(h);
    } catch (g) {
      (a.f & ye) === 0 && Cn(g, a);
    }
    s == null || s.deactivate(), ci();
  }
  if (n.length === 0) {
    c.then(() => f(e.map(i)));
    return;
  }
  function d() {
    u(), Promise.all(n.map((h) => /* @__PURE__ */ ml(h))).then((h) => f([...e.map(i), ...h])).catch((h) => Cn(h, a));
  }
  c ? c.then(d) : d();
}
function vl() {
  var t = nt, e = Q, n = Kt, r = st;
  return function(o = !0) {
    ue(t), Ct(e), Tn(n), o && (r == null || r.activate());
  };
}
function ci() {
  ue(null), Ct(null), Tn(null);
}
// @__NO_SIDE_EFFECTS__
function qr(t) {
  var e = wt | Ft, n = Q !== null && (Q.f & wt) !== 0 ? (
    /** @type {Derived} */
    Q
  ) : null;
  return nt !== null && (nt.f |= On), {
    ctx: Kt,
    deps: null,
    effects: null,
    equals: Go,
    f: e,
    fn: t,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      pt
    ),
    wv: 0,
    parent: n ?? nt,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function ml(t, e, n) {
  let r = (
    /** @type {Effect | null} */
    nt
  );
  r === null && Fa();
  var i = (
    /** @type {Boundary} */
    r.b
  ), o = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  ), s = en(
    /** @type {V} */
    pt
  ), a = !Q, u = /* @__PURE__ */ new Map();
  return Nl(() => {
    var g;
    var c = Xo();
    o = c.promise;
    try {
      Promise.resolve(t()).then(c.resolve, c.reject).then(() => {
        f === st && f.committed && f.deactivate(), ci();
      });
    } catch (p) {
      c.reject(p), ci();
    }
    var f = (
      /** @type {Batch} */
      st
    );
    if (a) {
      var d = i.is_rendered();
      i.update_pending_count(1), f.increment(d), (g = u.get(f)) == null || g.reject(pn), u.delete(f), u.set(f, c);
    }
    const h = (p, _ = void 0) => {
      if (f.activate(), _)
        _ !== pn && (s.f |= Re, Rn(s, _));
      else {
        (s.f & Re) !== 0 && (s.f ^= Re), Rn(s, p);
        for (const [R, N] of u) {
          if (u.delete(R), R === f) break;
          N.reject(pn);
        }
      }
      a && (i.update_pending_count(-1), f.decrement(d));
    };
    c.promise.then(h, (p) => h(null, p || "unknown"));
  }), cs(() => {
    for (const c of u.values())
      c.reject(pn);
  }), new Promise((c) => {
    function f(d) {
      function h() {
        d === o ? c(s) : f(o);
      }
      d.then(h, h);
    }
    f(o);
  });
}
// @__NO_SIDE_EFFECTS__
function Y(t) {
  const e = /* @__PURE__ */ qr(t);
  return ws(e), e;
}
// @__NO_SIDE_EFFECTS__
function es(t) {
  const e = /* @__PURE__ */ qr(t);
  return e.equals = Wo, e;
}
function ns(t) {
  var e = t.effects;
  if (e !== null) {
    t.effects = null;
    for (var n = 0; n < e.length; n += 1)
      Lt(
        /** @type {Effect} */
        e[n]
      );
  }
}
function pl(t) {
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
function zi(t) {
  var e, n = nt;
  ue(pl(t));
  try {
    t.f &= ~tn, ns(t), e = Es(t);
  } finally {
    ue(n);
  }
  return e;
}
function rs(t) {
  var e = zi(t);
  if (!t.equals(e) && (t.wv = bs(), (!(st != null && st.is_fork) || t.deps === null) && (t.v = e, t.deps === null))) {
    vt(t, Et);
    return;
  }
  De || (yt !== null ? (Ci() || st != null && st.is_fork) && yt.set(t, e) : Pi(t));
}
let fi = /* @__PURE__ */ new Set();
const Oe = /* @__PURE__ */ new Map();
let is = !1;
function en(t, e) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: t,
    reactions: null,
    equals: Go,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function ct(t, e) {
  const n = en(t);
  return ws(n), n;
}
// @__NO_SIDE_EFFECTS__
function _l(t, e = !1, n = !0) {
  const r = en(t);
  return e || (r.equals = Wo), r;
}
function B(t, e, n = !1) {
  Q !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!te || (Q.f & Qi) !== 0) && Ko() && (Q.f & (wt | be | Ai | Qi)) !== 0 && !(Mt != null && Mt.includes(t)) && qa();
  let r = n ? Nt(e) : e;
  return Rn(t, r);
}
function Rn(t, e) {
  if (!t.equals(e)) {
    var n = t.v;
    De ? Oe.set(t, e) : Oe.set(t, n), t.v = e;
    var r = Fe.ensure();
    if (r.capture(t, n), (t.f & wt) !== 0) {
      const i = (
        /** @type {Derived} */
        t
      );
      (t.f & Ft) !== 0 && zi(i), Pi(i);
    }
    t.wv = bs(), os(t, Ft), nt !== null && (nt.f & Et) !== 0 && (nt.f & (ke | sn)) === 0 && (Vt === null ? Al([t]) : Vt.push(t)), !r.is_fork && fi.size > 0 && !is && yl();
  }
  return e;
}
function yl() {
  is = !1;
  for (const t of fi)
    (t.f & Et) !== 0 && vt(t, Ee), lr(t) && Zn(t);
  fi.clear();
}
function Wn(t) {
  B(t, t.v + 1);
}
function os(t, e) {
  var n = t.reactions;
  if (n !== null)
    for (var r = n.length, i = 0; i < r; i++) {
      var o = n[i], s = o.f, a = (s & Ft) === 0;
      if (a && vt(o, e), (s & wt) !== 0) {
        var u = (
          /** @type {Derived} */
          o
        );
        yt == null || yt.delete(u), (s & tn) === 0 && (s & Wt && (o.f |= tn), os(u, Ee));
      } else a && ((s & be) !== 0 && Jt !== null && Jt.add(
        /** @type {Effect} */
        o
      ), we(
        /** @type {Effect} */
        o
      ));
    }
}
function Nt(t) {
  if (typeof t != "object" || t === null || Gn in t)
    return t;
  const e = Vo(t);
  if (e !== Ia && e !== za)
    return t;
  var n = /* @__PURE__ */ new Map(), r = Bo(t), i = /* @__PURE__ */ ct(0), o = je, s = (a) => {
    if (je === o)
      return a();
    var u = Q, c = je;
    Ct(null), eo(o);
    var f = a();
    return Ct(u), eo(c), f;
  };
  return r && n.set("length", /* @__PURE__ */ ct(
    /** @type {any[]} */
    t.length
  )), new Proxy(
    /** @type {any} */
    t,
    {
      defineProperty(a, u, c) {
        (!("value" in c) || c.configurable === !1 || c.enumerable === !1 || c.writable === !1) && Va();
        var f = n.get(u);
        return f === void 0 ? f = s(() => {
          var d = /* @__PURE__ */ ct(c.value);
          return n.set(u, d), d;
        }) : B(f, c.value, !0), !0;
      },
      deleteProperty(a, u) {
        var c = n.get(u);
        if (c === void 0) {
          if (u in a) {
            const f = s(() => /* @__PURE__ */ ct(pt));
            n.set(u, f), Wn(i);
          }
        } else
          B(c, pt), Wn(i);
        return !0;
      },
      get(a, u, c) {
        var g;
        if (u === Gn)
          return t;
        var f = n.get(u), d = u in a;
        if (f === void 0 && (!d || (g = yn(a, u)) != null && g.writable) && (f = s(() => {
          var p = Nt(d ? a[u] : pt), _ = /* @__PURE__ */ ct(p);
          return _;
        }), n.set(u, f)), f !== void 0) {
          var h = l(f);
          return h === pt ? void 0 : h;
        }
        return Reflect.get(a, u, c);
      },
      getOwnPropertyDescriptor(a, u) {
        var c = Reflect.getOwnPropertyDescriptor(a, u);
        if (c && "value" in c) {
          var f = n.get(u);
          f && (c.value = l(f));
        } else if (c === void 0) {
          var d = n.get(u), h = d == null ? void 0 : d.v;
          if (d !== void 0 && h !== pt)
            return {
              enumerable: !0,
              configurable: !0,
              value: h,
              writable: !0
            };
        }
        return c;
      },
      has(a, u) {
        var h;
        if (u === Gn)
          return !0;
        var c = n.get(u), f = c !== void 0 && c.v !== pt || Reflect.has(a, u);
        if (c !== void 0 || nt !== null && (!f || (h = yn(a, u)) != null && h.writable)) {
          c === void 0 && (c = s(() => {
            var g = f ? Nt(a[u]) : pt, p = /* @__PURE__ */ ct(g);
            return p;
          }), n.set(u, c));
          var d = l(c);
          if (d === pt)
            return !1;
        }
        return f;
      },
      set(a, u, c, f) {
        var C;
        var d = n.get(u), h = u in a;
        if (r && u === "length")
          for (var g = c; g < /** @type {Source<number>} */
          d.v; g += 1) {
            var p = n.get(g + "");
            p !== void 0 ? B(p, pt) : g in a && (p = s(() => /* @__PURE__ */ ct(pt)), n.set(g + "", p));
          }
        if (d === void 0)
          (!h || (C = yn(a, u)) != null && C.writable) && (d = s(() => /* @__PURE__ */ ct(void 0)), B(d, Nt(c)), n.set(u, d));
        else {
          h = d.v !== pt;
          var _ = s(() => Nt(c));
          B(d, _);
        }
        var R = Reflect.getOwnPropertyDescriptor(a, u);
        if (R != null && R.set && R.set.call(f, c), !h) {
          if (r && typeof u == "string") {
            var N = (
              /** @type {Source<number>} */
              n.get("length")
            ), V = Number(u);
            Number.isInteger(V) && V >= N.v && B(N, V + 1);
          }
          Wn(i);
        }
        return !0;
      },
      ownKeys(a) {
        l(i);
        var u = Reflect.ownKeys(a).filter((d) => {
          var h = n.get(d);
          return h === void 0 || h.v !== pt;
        });
        for (var [c, f] of n)
          f.v !== pt && !(c in a) && u.push(c);
        return u;
      },
      setPrototypeOf() {
        Xa();
      }
    }
  );
}
var $i, ss, as, ls;
function wl() {
  if ($i === void 0) {
    $i = window, ss = /Firefox/.test(navigator.userAgent);
    var t = Element.prototype, e = Node.prototype, n = Text.prototype;
    as = yn(e, "firstChild").get, ls = yn(e, "nextSibling").get, Ji(t) && (t.__click = void 0, t.__className = void 0, t.__attributes = null, t.__style = void 0, t.__e = void 0), Ji(n) && (n.__t = void 0);
  }
}
function nn(t = "") {
  return document.createTextNode(t);
}
// @__NO_SIDE_EFFECTS__
function Gt(t) {
  return (
    /** @type {TemplateNode | null} */
    as.call(t)
  );
}
// @__NO_SIDE_EFFECTS__
function ar(t) {
  return (
    /** @type {TemplateNode | null} */
    ls.call(t)
  );
}
function dt(t, e) {
  return /* @__PURE__ */ Gt(t);
}
function It(t, e = !1) {
  {
    var n = /* @__PURE__ */ Gt(t);
    return n instanceof Comment && n.data === "" ? /* @__PURE__ */ ar(n) : n;
  }
}
function et(t, e = 1, n = !1) {
  let r = t;
  for (; e--; )
    r = /** @type {TemplateNode} */
    /* @__PURE__ */ ar(r);
  return r;
}
function xl(t) {
  t.textContent = "";
}
function us() {
  return !1;
}
function Ti(t) {
  var e = Q, n = nt;
  Ct(null), ue(null);
  try {
    return t();
  } finally {
    Ct(e), ue(n);
  }
}
function bl(t) {
  nt === null && (Q === null && Ya(), Da()), De && Oa();
}
function kl(t, e) {
  var n = e.last;
  n === null ? e.last = e.first = t : (n.next = t, t.prev = n, e.last = t);
}
function Se(t, e, n) {
  var r = nt;
  r !== null && (r.f & Ht) !== 0 && (t |= Ht);
  var i = {
    ctx: Kt,
    deps: null,
    nodes: null,
    f: t | Ft | Wt,
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
      Zn(i), i.f |= Mi;
    } catch (a) {
      throw Lt(i), a;
    }
  else e !== null && we(i);
  var o = i;
  if (n && o.deps === null && o.teardown === null && o.nodes === null && o.first === o.last && // either `null`, or a singular child
  (o.f & On) === 0 && (o = o.first, (t & be) !== 0 && (t & zn) !== 0 && o !== null && (o.f |= zn)), o !== null && (o.parent = r, r !== null && kl(o, r), Q !== null && (Q.f & wt) !== 0 && (t & sn) === 0)) {
    var s = (
      /** @type {Derived} */
      Q
    );
    (s.effects ?? (s.effects = [])).push(o);
  }
  return i;
}
function Ci() {
  return Q !== null && !te;
}
function cs(t) {
  const e = Se(Xr, null, !1);
  return vt(e, Et), e.teardown = t, e;
}
function Be(t) {
  bl();
  var e = (
    /** @type {Effect} */
    nt.f
  ), n = !Q && (e & ke) !== 0 && (e & Mi) === 0;
  if (n) {
    var r = (
      /** @type {ComponentContext} */
      Kt
    );
    (r.e ?? (r.e = [])).push(t);
  } else
    return fs(t);
}
function fs(t) {
  return Se(Pr | Ca, t, !1);
}
function El(t) {
  Fe.ensure();
  const e = Se(sn | On, t, !0);
  return (n = {}) => new Promise((r) => {
    n.outro ? Qe(e, () => {
      Lt(e), r(void 0);
    }) : (Lt(e), r(void 0));
  });
}
function Sl(t) {
  return Se(Pr, t, !1);
}
function Nl(t) {
  return Se(Ai | On, t, !0);
}
function hs(t, e = 0) {
  return Se(Xr | e, t, !0);
}
function at(t, e = [], n = [], r = []) {
  gl(r, e, n, (i) => {
    Se(Xr, () => t(...i.map(l)), !0);
  });
}
function Ri(t, e = 0) {
  var n = Se(be | e, t, !0);
  return n;
}
function Ut(t) {
  return Se(ke | On, t, !0);
}
function ds(t) {
  var e = t.teardown;
  if (e !== null) {
    const n = De, r = Q;
    to(!0), Ct(null);
    try {
      e.call(null);
    } finally {
      to(n), Ct(r);
    }
  }
}
function gs(t, e = !1) {
  var n = t.first;
  for (t.first = t.last = null; n !== null; ) {
    const i = n.ac;
    i !== null && Ti(() => {
      i.abort(pn);
    });
    var r = n.next;
    (n.f & sn) !== 0 ? n.parent = null : Lt(n, e), n = r;
  }
}
function Ml(t) {
  for (var e = t.first; e !== null; ) {
    var n = e.next;
    (e.f & ke) === 0 && Lt(e), e = n;
  }
}
function Lt(t, e = !0) {
  var n = !1;
  (e || (t.f & Uo) !== 0) && t.nodes !== null && t.nodes.end !== null && (vs(
    t.nodes.start,
    /** @type {TemplateNode} */
    t.nodes.end
  ), n = !0), gs(t, e && !n), Ir(t, 0), vt(t, ye);
  var r = t.nodes && t.nodes.t;
  if (r !== null)
    for (const o of r)
      o.stop();
  ds(t);
  var i = t.parent;
  i !== null && i.first !== null && ms(t), t.next = t.prev = t.teardown = t.ctx = t.deps = t.fn = t.nodes = t.ac = null;
}
function vs(t, e) {
  for (; t !== null; ) {
    var n = t === e ? null : /* @__PURE__ */ ar(t);
    t.remove(), t = n;
  }
}
function ms(t) {
  var e = t.parent, n = t.prev, r = t.next;
  n !== null && (n.next = r), r !== null && (r.prev = n), e !== null && (e.first === t && (e.first = r), e.last === t && (e.last = n));
}
function Qe(t, e, n = !0) {
  var r = [];
  ps(t, r, !0);
  var i = () => {
    n && Lt(t), e && e();
  }, o = r.length;
  if (o > 0) {
    var s = () => --o || i();
    for (var a of r)
      a.out(s);
  } else
    i();
}
function ps(t, e, n) {
  if ((t.f & Ht) === 0) {
    t.f ^= Ht;
    var r = t.nodes && t.nodes.t;
    if (r !== null)
      for (const a of r)
        (a.is_global || n) && e.push(a);
    for (var i = t.first; i !== null; ) {
      var o = i.next, s = (i.f & zn) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (i.f & ke) !== 0 && (t.f & be) !== 0;
      ps(i, e, s ? n : !1), i = o;
    }
  }
}
function Li(t) {
  _s(t, !0);
}
function _s(t, e) {
  if ((t.f & Ht) !== 0) {
    t.f ^= Ht, (t.f & Et) === 0 && (vt(t, Ft), we(t));
    for (var n = t.first; n !== null; ) {
      var r = n.next, i = (n.f & zn) !== 0 || (n.f & ke) !== 0;
      _s(n, i ? e : !1), n = r;
    }
    var o = t.nodes && t.nodes.t;
    if (o !== null)
      for (const s of o)
        (s.is_global || e) && s.in();
  }
}
function ys(t, e) {
  if (t.nodes)
    for (var n = t.nodes.start, r = t.nodes.end; n !== null; ) {
      var i = n === r ? null : /* @__PURE__ */ ar(n);
      e.append(n), n = i;
    }
}
let kr = !1, De = !1;
function to(t) {
  De = t;
}
let Q = null, te = !1;
function Ct(t) {
  Q = t;
}
let nt = null;
function ue(t) {
  nt = t;
}
let Mt = null;
function ws(t) {
  Q !== null && (Mt === null ? Mt = [t] : Mt.push(t));
}
let zt = null, Dt = 0, Vt = null;
function Al(t) {
  Vt = t;
}
let xs = 1, qe = 0, je = qe;
function eo(t) {
  je = t;
}
function bs() {
  return ++xs;
}
function lr(t) {
  var e = t.f;
  if ((e & Ft) !== 0)
    return !0;
  if (e & wt && (t.f &= ~tn), (e & Ee) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      t.deps
    ), r = n.length, i = 0; i < r; i++) {
      var o = n[i];
      if (lr(
        /** @type {Derived} */
        o
      ) && rs(
        /** @type {Derived} */
        o
      ), o.wv > t.wv)
        return !0;
    }
    (e & Wt) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    yt === null && vt(t, Et);
  }
  return !1;
}
function ks(t, e, n = !0) {
  var r = t.reactions;
  if (r !== null && !(Mt != null && Mt.includes(t)))
    for (var i = 0; i < r.length; i++) {
      var o = r[i];
      (o.f & wt) !== 0 ? ks(
        /** @type {Derived} */
        o,
        e,
        !1
      ) : e === o && (n ? vt(o, Ft) : (o.f & Et) !== 0 && vt(o, Ee), we(
        /** @type {Effect} */
        o
      ));
    }
}
function Es(t) {
  var p;
  var e = zt, n = Dt, r = Vt, i = Q, o = Mt, s = Kt, a = te, u = je, c = t.f;
  zt = /** @type {null | Value[]} */
  null, Dt = 0, Vt = null, Q = (c & (ke | sn)) === 0 ? t : null, Mt = null, Tn(t.ctx), te = !1, je = ++qe, t.ac !== null && (Ti(() => {
    t.ac.abort(pn);
  }), t.ac = null);
  try {
    t.f |= ii;
    var f = (
      /** @type {Function} */
      t.fn
    ), d = f(), h = t.deps;
    if (zt !== null) {
      var g;
      if (Ir(t, Dt), h !== null && Dt > 0)
        for (h.length = Dt + zt.length, g = 0; g < zt.length; g++)
          h[Dt + g] = zt[g];
      else
        t.deps = h = zt;
      if (Ci() && (t.f & Wt) !== 0)
        for (g = Dt; g < h.length; g++)
          ((p = h[g]).reactions ?? (p.reactions = [])).push(t);
    } else h !== null && Dt < h.length && (Ir(t, Dt), h.length = Dt);
    if (Ko() && Vt !== null && !te && h !== null && (t.f & (wt | Ee | Ft)) === 0)
      for (g = 0; g < /** @type {Source[]} */
      Vt.length; g++)
        ks(
          Vt[g],
          /** @type {Effect} */
          t
        );
    if (i !== null && i !== t) {
      if (qe++, i.deps !== null)
        for (let _ = 0; _ < n; _ += 1)
          i.deps[_].rv = qe;
      if (e !== null)
        for (const _ of e)
          _.rv = qe;
      Vt !== null && (r === null ? r = Vt : r.push(.../** @type {Source[]} */
      Vt));
    }
    return (t.f & Re) !== 0 && (t.f ^= Re), d;
  } catch (_) {
    return Zo(_);
  } finally {
    t.f ^= ii, zt = e, Dt = n, Vt = r, Q = i, Mt = o, Tn(s), te = a, je = u;
  }
}
function Pl(t, e) {
  let n = e.reactions;
  if (n !== null) {
    var r = Ma.call(n, t);
    if (r !== -1) {
      var i = n.length - 1;
      i === 0 ? n = e.reactions = null : (n[r] = n[i], n.pop());
    }
  }
  if (n === null && (e.f & wt) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (zt === null || !zt.includes(e))) {
    var o = (
      /** @type {Derived} */
      e
    );
    (o.f & Wt) !== 0 && (o.f ^= Wt, o.f &= ~tn), Pi(o), ns(o), Ir(o, 0);
  }
}
function Ir(t, e) {
  var n = t.deps;
  if (n !== null)
    for (var r = e; r < n.length; r++)
      Pl(t, n[r]);
}
function Zn(t) {
  var e = t.f;
  if ((e & ye) === 0) {
    vt(t, Et);
    var n = nt, r = kr;
    nt = t, kr = !0;
    try {
      (e & (be | qo)) !== 0 ? Ml(t) : gs(t), ds(t);
      var i = Es(t);
      t.teardown = typeof i == "function" ? i : null, t.wv = xs;
      var o;
    } finally {
      kr = r, nt = n;
    }
  }
}
function l(t) {
  var e = t.f, n = (e & wt) !== 0;
  if (Q !== null && !te) {
    var r = nt !== null && (nt.f & ye) !== 0;
    if (!r && !(Mt != null && Mt.includes(t))) {
      var i = Q.deps;
      if ((Q.f & ii) !== 0)
        t.rv < qe && (t.rv = qe, zt === null && i !== null && i[Dt] === t ? Dt++ : zt === null ? zt = [t] : zt.push(t));
      else {
        (Q.deps ?? (Q.deps = [])).push(t);
        var o = t.reactions;
        o === null ? t.reactions = [Q] : o.includes(Q) || o.push(Q);
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
      return ((s.f & Et) === 0 && s.reactions !== null || Ns(s)) && (a = zi(s)), Oe.set(s, a), a;
    }
    var u = (s.f & Wt) === 0 && !te && Q !== null && (kr || (Q.f & Wt) !== 0), c = s.deps === null;
    lr(s) && (u && (s.f |= Wt), rs(s)), u && !c && Ss(s);
  }
  if (yt != null && yt.has(t))
    return yt.get(t);
  if ((t.f & Re) !== 0)
    throw t.v;
  return t.v;
}
function Ss(t) {
  if (t.deps !== null) {
    t.f |= Wt;
    for (const e of t.deps)
      (e.reactions ?? (e.reactions = [])).push(t), (e.f & wt) !== 0 && (e.f & Wt) === 0 && Ss(
        /** @type {Derived} */
        e
      );
  }
}
function Ns(t) {
  if (t.v === pt) return !0;
  if (t.deps === null) return !1;
  for (const e of t.deps)
    if (Oe.has(e) || (e.f & wt) !== 0 && Ns(
      /** @type {Derived} */
      e
    ))
      return !0;
  return !1;
}
function Fi(t) {
  var e = te;
  try {
    return te = !0, t();
  } finally {
    te = e;
  }
}
const Il = ["touchstart", "touchmove"];
function zl(t) {
  return Il.includes(t);
}
const Ms = /* @__PURE__ */ new Set(), hi = /* @__PURE__ */ new Set();
function Tl(t, e, n, r = {}) {
  function i(o) {
    if (r.capture || Vn.call(e, o), !o.cancelBubble)
      return Ti(() => n == null ? void 0 : n.call(this, o));
  }
  return t.startsWith("pointer") || t.startsWith("touch") || t === "wheel" ? Le(() => {
    e.addEventListener(t, i, r);
  }) : e.addEventListener(t, i, r), i;
}
function Pe(t, e, n, r, i) {
  var o = { capture: r, passive: i }, s = Tl(t, e, n, o);
  (e === document.body || // @ts-ignore
  e === window || // @ts-ignore
  e === document || // Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
  e instanceof HTMLMediaElement) && cs(() => {
    e.removeEventListener(t, s, o);
  });
}
function ur(t) {
  for (var e = 0; e < t.length; e++)
    Ms.add(t[e]);
  for (var n of hi)
    n(t);
}
let no = null;
function Vn(t) {
  var R;
  var e = this, n = (
    /** @type {Node} */
    e.ownerDocument
  ), r = t.type, i = ((R = t.composedPath) == null ? void 0 : R.call(t)) || [], o = (
    /** @type {null | Element} */
    i[0] || t.target
  );
  no = t;
  var s = 0, a = no === t && t.__root;
  if (a) {
    var u = i.indexOf(a);
    if (u !== -1 && (e === document || e === /** @type {any} */
    window)) {
      t.__root = e;
      return;
    }
    var c = i.indexOf(e);
    if (c === -1)
      return;
    u <= c && (s = u);
  }
  if (o = /** @type {Element} */
  i[s] || t.target, o !== e) {
    Aa(t, "currentTarget", {
      configurable: !0,
      get() {
        return o || n;
      }
    });
    var f = Q, d = nt;
    Ct(null), ue(null);
    try {
      for (var h, g = []; o !== null; ) {
        var p = o.assignedSlot || o.parentNode || /** @type {any} */
        o.host || null;
        try {
          var _ = o["__" + r];
          _ != null && (!/** @type {any} */
          o.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
          // -> the target could not have been disabled because it emits the event in the first place
          t.target === o) && _.call(o, t);
        } catch (N) {
          h ? g.push(N) : h = N;
        }
        if (t.cancelBubble || p === e || p === null)
          break;
        o = p;
      }
      if (h) {
        for (let N of g)
          queueMicrotask(() => {
            throw N;
          });
        throw h;
      }
    } finally {
      t.__root = e, delete t.currentTarget, Ct(f), ue(d);
    }
  }
}
function Oi(t) {
  var e = document.createElement("template");
  return e.innerHTML = t.replaceAll("<!>", "<!---->"), e.content;
}
function Jn(t, e) {
  var n = (
    /** @type {Effect} */
    nt
  );
  n.nodes === null && (n.nodes = { start: t, end: e, a: null, t: null });
}
// @__NO_SIDE_EFFECTS__
function Cl(t, e) {
  var n = (e & tl) !== 0, r, i = !t.startsWith("<!>");
  return () => {
    r === void 0 && (r = Oi(i ? t : "<!>" + t), r = /** @type {TemplateNode} */
    /* @__PURE__ */ Gt(r));
    var o = (
      /** @type {TemplateNode} */
      n || ss ? document.importNode(r, !0) : r.cloneNode(!0)
    );
    return Jn(o, o), o;
  };
}
// @__NO_SIDE_EFFECTS__
function Rl(t, e, n = "svg") {
  var r = !t.startsWith("<!>"), i = (e & $a) !== 0, o = `<${n}>${r ? t : "<!>" + t}</${n}>`, s;
  return () => {
    if (!s) {
      var a = (
        /** @type {DocumentFragment} */
        Oi(o)
      ), u = (
        /** @type {Element} */
        /* @__PURE__ */ Gt(a)
      );
      if (i)
        for (s = document.createDocumentFragment(); /* @__PURE__ */ Gt(u); )
          s.appendChild(
            /** @type {TemplateNode} */
            /* @__PURE__ */ Gt(u)
          );
      else
        s = /** @type {Element} */
        /* @__PURE__ */ Gt(u);
    }
    var c = (
      /** @type {TemplateNode} */
      s.cloneNode(!0)
    );
    if (i) {
      var f = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ Gt(c)
      ), d = (
        /** @type {TemplateNode} */
        c.lastChild
      );
      Jn(f, d);
    } else
      Jn(c, c);
    return c;
  };
}
// @__NO_SIDE_EFFECTS__
function lt(t, e) {
  return /* @__PURE__ */ Rl(t, e, "svg");
}
function ge() {
  var t = document.createDocumentFragment(), e = document.createComment(""), n = nn();
  return t.append(e, n), Jn(e, n), t;
}
function $(t, e) {
  t !== null && t.before(
    /** @type {Node} */
    e
  );
}
function Qn(t, e) {
  var n = e == null ? "" : typeof e == "object" ? e + "" : e;
  n !== (t.__t ?? (t.__t = t.nodeValue)) && (t.__t = n, t.nodeValue = n + "");
}
function Ll(t, e) {
  return Fl(t, e);
}
const vn = /* @__PURE__ */ new Map();
function Fl(t, { target: e, anchor: n, props: r = {}, events: i, context: o, intro: s = !0 }) {
  wl();
  var a = /* @__PURE__ */ new Set(), u = (d) => {
    for (var h = 0; h < d.length; h++) {
      var g = d[h];
      if (!a.has(g)) {
        a.add(g);
        var p = zl(g);
        e.addEventListener(g, Vn, { passive: p });
        var _ = vn.get(g);
        _ === void 0 ? (document.addEventListener(g, Vn, { passive: p }), vn.set(g, 1)) : vn.set(g, _ + 1);
      }
    }
  };
  u(Vr(Ms)), hi.add(u);
  var c = void 0, f = El(() => {
    var d = n ?? e.appendChild(nn());
    return cl(
      /** @type {TemplateNode} */
      d,
      {
        pending: () => {
        }
      },
      (h) => {
        if (o) {
          an({});
          var g = (
            /** @type {ComponentContext} */
            Kt
          );
          g.c = o;
        }
        i && (r.$$events = i), c = t(h, r) || {}, o && ln();
      }
    ), () => {
      var p;
      for (var h of a) {
        e.removeEventListener(h, Vn);
        var g = (
          /** @type {number} */
          vn.get(h)
        );
        --g === 0 ? (document.removeEventListener(h, Vn), vn.delete(h)) : vn.set(h, g);
      }
      hi.delete(u), d !== n && ((p = d.parentNode) == null || p.removeChild(d));
    };
  });
  return di.set(c, f), c;
}
let di = /* @__PURE__ */ new WeakMap();
function ro(t, e) {
  const n = di.get(t);
  return n ? (di.delete(t), n(e)) : Promise.resolve();
}
var jt, ae, Yt, Je, or, sr, Br;
class Ol {
  /**
   * @param {TemplateNode} anchor
   * @param {boolean} transition
   */
  constructor(e, n = !0) {
    /** @type {TemplateNode} */
    mt(this, "anchor");
    /** @type {Map<Batch, Key>} */
    j(this, jt, /* @__PURE__ */ new Map());
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
    j(this, ae, /* @__PURE__ */ new Map());
    /**
     * Similar to #onscreen with respect to the keys, but contains branches that are not yet
     * in the DOM, because their insertion is deferred.
     * @type {Map<Key, Branch>}
     */
    j(this, Yt, /* @__PURE__ */ new Map());
    /**
     * Keys of effects that are currently outroing
     * @type {Set<Key>}
     */
    j(this, Je, /* @__PURE__ */ new Set());
    /**
     * Whether to pause (i.e. outro) on change, or destroy immediately.
     * This is necessary for `<svelte:element>`
     */
    j(this, or, !0);
    j(this, sr, () => {
      var e = (
        /** @type {Batch} */
        st
      );
      if (y(this, jt).has(e)) {
        var n = (
          /** @type {Key} */
          y(this, jt).get(e)
        ), r = y(this, ae).get(n);
        if (r)
          Li(r), y(this, Je).delete(n);
        else {
          var i = y(this, Yt).get(n);
          i && (y(this, ae).set(n, i.effect), y(this, Yt).delete(n), i.fragment.lastChild.remove(), this.anchor.before(i.fragment), r = i.effect);
        }
        for (const [o, s] of y(this, jt)) {
          if (y(this, jt).delete(o), o === e)
            break;
          const a = y(this, Yt).get(s);
          a && (Lt(a.effect), y(this, Yt).delete(s));
        }
        for (const [o, s] of y(this, ae)) {
          if (o === n || y(this, Je).has(o)) continue;
          const a = () => {
            if (Array.from(y(this, jt).values()).includes(o)) {
              var c = document.createDocumentFragment();
              ys(s, c), c.append(nn()), y(this, Yt).set(o, { effect: s, fragment: c });
            } else
              Lt(s);
            y(this, Je).delete(o), y(this, ae).delete(o);
          };
          y(this, or) || !r ? (y(this, Je).add(o), Qe(s, a, !1)) : a();
        }
      }
    });
    /**
     * @param {Batch} batch
     */
    j(this, Br, (e) => {
      y(this, jt).delete(e);
      const n = Array.from(y(this, jt).values());
      for (const [r, i] of y(this, Yt))
        n.includes(r) || (Lt(i.effect), y(this, Yt).delete(r));
    });
    this.anchor = e, K(this, or, n);
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
    ), i = us();
    if (n && !y(this, ae).has(e) && !y(this, Yt).has(e))
      if (i) {
        var o = document.createDocumentFragment(), s = nn();
        o.append(s), y(this, Yt).set(e, {
          effect: Ut(() => n(s)),
          fragment: o
        });
      } else
        y(this, ae).set(
          e,
          Ut(() => n(this.anchor))
        );
    if (y(this, jt).set(r, e), i) {
      for (const [a, u] of y(this, ae))
        a === e ? r.skipped_effects.delete(u) : r.skipped_effects.add(u);
      for (const [a, u] of y(this, Yt))
        a === e ? r.skipped_effects.delete(u.effect) : r.skipped_effects.add(u.effect);
      r.oncommit(y(this, sr)), r.ondiscard(y(this, Br));
    } else
      y(this, sr).call(this);
  }
}
jt = new WeakMap(), ae = new WeakMap(), Yt = new WeakMap(), Je = new WeakMap(), or = new WeakMap(), sr = new WeakMap(), Br = new WeakMap();
function _t(t, e, n = !1) {
  var r = new Ol(t), i = n ? zn : 0;
  function o(s, a) {
    r.ensure(s, a);
  }
  Ri(() => {
    var s = !1;
    e((a, u = !0) => {
      s = !0, o(u, a);
    }), s || o(!1, null);
  }, i);
}
function As(t, e) {
  return e;
}
function Dl(t, e, n) {
  for (var r = [], i = e.length, o, s = e.length, a = 0; a < i; a++) {
    let d = e[a];
    Qe(
      d,
      () => {
        if (o) {
          if (o.pending.delete(d), o.done.add(d), o.pending.size === 0) {
            var h = (
              /** @type {Set<EachOutroGroup>} */
              t.outrogroups
            );
            gi(Vr(o.done)), h.delete(o), h.size === 0 && (t.outrogroups = null);
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
      var c = (
        /** @type {Element} */
        n
      ), f = (
        /** @type {Element} */
        c.parentNode
      );
      xl(f), f.append(c), t.items.clear();
    }
    gi(e, !u);
  } else
    o = {
      pending: new Set(e),
      done: /* @__PURE__ */ new Set()
    }, (t.outrogroups ?? (t.outrogroups = /* @__PURE__ */ new Set())).add(o);
}
function gi(t, e = !0) {
  for (var n = 0; n < t.length; n++)
    Lt(t[n], e);
}
var io;
function Ve(t, e, n, r, i, o = null) {
  var s = t, a = /* @__PURE__ */ new Map(), u = null, c = /* @__PURE__ */ es(() => {
    var _ = n();
    return Bo(_) ? _ : _ == null ? [] : Vr(_);
  }), f, d = !0;
  function h() {
    p.fallback = u, Yl(p, f, s, e, r), u !== null && (f.length === 0 ? (u.f & Ce) === 0 ? Li(u) : (u.f ^= Ce, Xn(u, null, s)) : Qe(u, () => {
      u = null;
    }));
  }
  var g = Ri(() => {
    f = /** @type {V[]} */
    l(c);
    for (var _ = f.length, R = /* @__PURE__ */ new Set(), N = (
      /** @type {Batch} */
      st
    ), V = us(), C = 0; C < _; C += 1) {
      var w = f[C], T = r(w, C), k = d ? null : a.get(T);
      k ? (k.v && Rn(k.v, w), k.i && Rn(k.i, C), V && N.skipped_effects.delete(k.e)) : (k = Hl(
        a,
        d ? s : io ?? (io = nn()),
        w,
        T,
        C,
        i,
        e,
        n
      ), d || (k.e.f |= Ce), a.set(T, k)), R.add(T);
    }
    if (_ === 0 && o && !u && (d ? u = Ut(() => o(s)) : (u = Ut(() => o(io ?? (io = nn()))), u.f |= Ce)), !d)
      if (V) {
        for (const [A, O] of a)
          R.has(A) || N.skipped_effects.add(O.e);
        N.oncommit(h), N.ondiscard(() => {
        });
      } else
        h();
    l(c);
  }), p = { effect: g, items: a, outrogroups: null, fallback: u };
  d = !1;
}
function Yl(t, e, n, r, i) {
  var O;
  var o = e.length, s = t.items, a = t.effect.first, u, c = null, f = [], d = [], h, g, p, _;
  for (_ = 0; _ < o; _ += 1) {
    if (h = e[_], g = i(h, _), p = /** @type {EachItem} */
    s.get(g).e, t.outrogroups !== null)
      for (const H of t.outrogroups)
        H.pending.delete(p), H.done.delete(p);
    if ((p.f & Ce) !== 0)
      if (p.f ^= Ce, p === a)
        Xn(p, null, n);
      else {
        var R = c ? c.next : a;
        p === t.effect.last && (t.effect.last = p.prev), p.prev && (p.prev.next = p.next), p.next && (p.next.prev = p.prev), Ae(t, c, p), Ae(t, p, R), Xn(p, R, n), c = p, f = [], d = [], a = c.next;
        continue;
      }
    if ((p.f & Ht) !== 0 && Li(p), p !== a) {
      if (u !== void 0 && u.has(p)) {
        if (f.length < d.length) {
          var N = d[0], V;
          c = N.prev;
          var C = f[0], w = f[f.length - 1];
          for (V = 0; V < f.length; V += 1)
            Xn(f[V], N, n);
          for (V = 0; V < d.length; V += 1)
            u.delete(d[V]);
          Ae(t, C.prev, w.next), Ae(t, c, C), Ae(t, w, N), a = N, c = w, _ -= 1, f = [], d = [];
        } else
          u.delete(p), Xn(p, a, n), Ae(t, p.prev, p.next), Ae(t, p, c === null ? t.effect.first : c.next), Ae(t, c, p), c = p;
        continue;
      }
      for (f = [], d = []; a !== null && a !== p; )
        (u ?? (u = /* @__PURE__ */ new Set())).add(a), d.push(a), a = a.next;
      if (a === null)
        continue;
    }
    (p.f & Ce) === 0 && f.push(p), c = p, a = p.next;
  }
  if (t.outrogroups !== null) {
    for (const H of t.outrogroups)
      H.pending.size === 0 && (gi(Vr(H.done)), (O = t.outrogroups) == null || O.delete(H));
    t.outrogroups.size === 0 && (t.outrogroups = null);
  }
  if (a !== null || u !== void 0) {
    var T = [];
    if (u !== void 0)
      for (p of u)
        (p.f & Ht) === 0 && T.push(p);
    for (; a !== null; )
      (a.f & Ht) === 0 && a !== t.fallback && T.push(a), a = a.next;
    var k = T.length;
    if (k > 0) {
      var A = null;
      Dl(t, T, A);
    }
  }
}
function Hl(t, e, n, r, i, o, s, a) {
  var u = (s & Ga) !== 0 ? (s & Ka) === 0 ? /* @__PURE__ */ _l(n, !1, !1) : en(n) : null, c = (s & Wa) !== 0 ? en(i) : null;
  return {
    v: u,
    i: c,
    e: Ut(() => (o(e, u ?? n, c ?? i, a), () => {
      t.delete(r);
    }))
  };
}
function Xn(t, e, n) {
  if (t.nodes)
    for (var r = t.nodes.start, i = t.nodes.end, o = e && (e.f & Ce) === 0 ? (
      /** @type {EffectNodes} */
      e.nodes.start
    ) : n; r !== null; ) {
      var s = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ ar(r)
      );
      if (o.before(r), r === i)
        return;
      r = s;
    }
}
function Ae(t, e, n) {
  e === null ? t.effect.first = n : e.next = n, n === null ? t.effect.last = e : n.prev = e;
}
function Ps(t, e, n = !1, r = !1, i = !1) {
  var o = t, s = "";
  at(() => {
    var a = (
      /** @type {Effect} */
      nt
    );
    if (s !== (s = e() ?? "") && (a.nodes !== null && (vs(
      a.nodes.start,
      /** @type {TemplateNode} */
      a.nodes.end
    ), a.nodes = null), s !== "")) {
      var u = s + "";
      n ? u = `<svg>${u}</svg>` : r && (u = `<math>${u}</math>`);
      var c = Oi(u);
      if ((n || r) && (c = /** @type {Element} */
      /* @__PURE__ */ Gt(c)), Jn(
        /** @type {TemplateNode} */
        /* @__PURE__ */ Gt(c),
        /** @type {TemplateNode} */
        c.lastChild
      ), n || r)
        for (; /* @__PURE__ */ Gt(c); )
          o.before(
            /** @type {TemplateNode} */
            /* @__PURE__ */ Gt(c)
          );
      else
        o.before(c);
    }
  });
}
function Is(t) {
  var e, n, r = "";
  if (typeof t == "string" || typeof t == "number") r += t;
  else if (typeof t == "object") if (Array.isArray(t)) {
    var i = t.length;
    for (e = 0; e < i; e++) t[e] && (n = Is(t[e])) && (r && (r += " "), r += n);
  } else for (n in t) t[n] && (r && (r += " "), r += n);
  return r;
}
function Bl() {
  for (var t, e, n = 0, r = "", i = arguments.length; n < i; n++) (t = arguments[n]) && (e = Is(t)) && (r && (r += " "), r += e);
  return r;
}
function Vl(t) {
  return typeof t == "object" ? Bl(t) : t ?? "";
}
const oo = [...` 	
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
          (s === 0 || oo.includes(r[s - 1])) && (a === r.length || oo.includes(r[a])) ? r = (s === 0 ? "" : r.substring(0, s)) + r.substring(a + 1) : s = a;
        }
  }
  return r === "" ? null : r;
}
function ql(t, e) {
  return t == null ? null : String(t);
}
function Di(t, e, n, r, i, o) {
  var s = t.__className;
  if (s !== n || s === void 0) {
    var a = Xl(n, r, o);
    a == null ? t.removeAttribute("class") : t.setAttribute("class", a), t.__className = n;
  } else if (o && i !== o)
    for (var u in o) {
      var c = !!o[u];
      (i == null || c !== !!i[u]) && t.classList.toggle(u, c);
    }
  return o;
}
function Ul(t, e, n, r) {
  var i = t.__style;
  if (i !== e) {
    var o = ql(e);
    o == null ? t.removeAttribute("style") : t.style.cssText = o, t.__style = e;
  }
  return r;
}
const Gl = Symbol("is custom element"), Wl = Symbol("is html");
function v(t, e, n, r) {
  var i = Kl(t);
  i[e] !== (i[e] = n) && (e === "loading" && (t[La] = n), n == null ? t.removeAttribute(e) : typeof n != "string" && Zl(t).includes(e) ? t[e] = n : t.setAttribute(e, n));
}
function Kl(t) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    t.__attributes ?? (t.__attributes = {
      [Gl]: t.nodeName.includes("-"),
      [Wl]: t.namespaceURI === el
    })
  );
}
var so = /* @__PURE__ */ new Map();
function Zl(t) {
  var e = t.getAttribute("is") || t.nodeName, n = so.get(e);
  if (n) return n;
  so.set(e, n = []);
  for (var r, i = t, o = Element.prototype; o !== i; ) {
    r = Pa(i);
    for (var s in r)
      r[s].set && n.push(s);
    i = Vo(i);
  }
  return n;
}
function ao(t, e) {
  return t === e || (t == null ? void 0 : t[Gn]) === e;
}
function lo(t = {}, e, n, r) {
  return Sl(() => {
    var i, o;
    return hs(() => {
      i = o, o = [], Fi(() => {
        t !== n(...o) && (e(t, ...o), i && ao(n(...i), t) && e(null, ...i));
      });
    }), () => {
      Le(() => {
        o && ao(n(...o), t) && e(null, ...o);
      });
    };
  }), t;
}
let gr = !1;
function Jl(t) {
  var e = gr;
  try {
    return gr = !1, [t(), gr];
  } finally {
    gr = e;
  }
}
function kt(t, e, n, r) {
  var V;
  var i = (n & Qa) !== 0, o = (n & ja) !== 0, s = (
    /** @type {V} */
    r
  ), a = !0, u = () => (a && (a = !1, s = o ? Fi(
    /** @type {() => V} */
    r
  ) : (
    /** @type {V} */
    r
  )), s), c;
  if (i) {
    var f = Gn in t || Ra in t;
    c = ((V = yn(t, e)) == null ? void 0 : V.set) ?? (f && e in t ? (C) => t[e] = C : void 0);
  }
  var d, h = !1;
  i ? [d, h] = Jl(() => (
    /** @type {V} */
    t[e]
  )) : d = /** @type {V} */
  t[e], d === void 0 && r !== void 0 && (d = u(), c && (Ba(), c(d)));
  var g;
  if (g = () => {
    var C = (
      /** @type {V} */
      t[e]
    );
    return C === void 0 ? u() : (a = !0, C);
  }, (n & Ja) === 0)
    return g;
  if (c) {
    var p = t.$$legacy;
    return (
      /** @type {() => V} */
      (function(C, w) {
        return arguments.length > 0 ? ((!w || p || h) && c(w ? g() : C), C) : g();
      })
    );
  }
  var _ = !1, R = ((n & Za) !== 0 ? qr : es)(() => (_ = !1, g()));
  i && l(R);
  var N = (
    /** @type {Effect} */
    nt
  );
  return (
    /** @type {() => V} */
    (function(C, w) {
      if (arguments.length > 0) {
        const T = w ? l(R) : i ? Nt(C) : C;
        return B(R, T), _ = !0, s !== void 0 && (s = T), C;
      }
      return De && _ || (N.f & ye) !== 0 ? R.v : l(R);
    })
  );
}
const Ql = "5";
var Ho;
typeof window < "u" && ((Ho = window.__svelte ?? (window.__svelte = {})).v ?? (Ho.v = /* @__PURE__ */ new Set())).add(Ql);
const jl = [
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
jl.map(([t, e]) => [t.slice().sort((n, r) => r.length - n.length), e]);
const $l = 40, tu = 8, jr = 16, eu = 5.5;
var tt;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(tt || (tt = {}));
const nu = {
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
}, ru = {
  [tt.Router]: "router",
  [tt.L3Switch]: "l3-switch",
  [tt.L2Switch]: "l2-switch",
  [tt.Firewall]: "firewall",
  [tt.LoadBalancer]: "load-balancer",
  [tt.Server]: "server",
  [tt.AccessPoint]: "access-point",
  [tt.CPE]: "cpe",
  [tt.Cloud]: "cloud",
  [tt.Internet]: "internet",
  [tt.VPN]: "vpn",
  [tt.Database]: "database",
  [tt.Generic]: "generic"
};
function iu(t) {
  if (!t)
    return;
  const e = ru[t];
  if (e)
    return nu[e];
}
function ou(t) {
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
const su = 1, zs = 2, au = 4, lu = 8;
function uu(t) {
  switch (t) {
    case "top":
      return su;
    case "bottom":
      return zs;
    case "left":
      return au;
    case "right":
      return lu;
  }
}
function zr(t) {
  return typeof t == "string" ? t : t.node;
}
function Tr(t) {
  return typeof t == "string" ? void 0 : t.port;
}
function uo(t) {
  return typeof t == "string" ? { node: t } : t;
}
function cu(t, e, n, r = 2) {
  for (const i of n.values()) {
    const o = i.size.width / 2 + r, s = i.size.height / 2 + r;
    if (t > i.position.x - o && t < i.position.x + o && e > i.position.y - s && e < i.position.y + s)
      return !0;
  }
  return !1;
}
let $r = null;
async function fu() {
  if (!$r) {
    const { AvoidLib: t } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await t.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await t.load(process.env.LIBAVOID_WASM_PATH) : await t.load(), $r = t.getInstance();
  }
  return $r;
}
async function Kn(t, e, n, r) {
  const i = await fu(), o = {
    edgeStyle: "orthogonal",
    shapeBufferDistance: 10,
    idealNudgingDistance: 20,
    ...r
  }, s = o.edgeStyle === "polyline" ? i.RouterFlag.PolyLineRouting.value : i.RouterFlag.OrthogonalRouting.value, a = new i.Router(s);
  a.setRoutingParameter(i.RoutingParameter.shapeBufferDistance.value, o.shapeBufferDistance), a.setRoutingParameter(i.RoutingParameter.idealNudgingDistance.value, o.idealNudgingDistance), a.setRoutingParameter(i.RoutingParameter.reverseDirectionPenalty.value, 500), a.setRoutingParameter(i.RoutingParameter.segmentPenalty.value, 50), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes.value, !0), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalTouchingColinearSegments.value, !0), a.setRoutingOption(i.RoutingOption.performUnifyingNudgingPreprocessingStep.value, !0), a.setRoutingOption(i.RoutingOption.nudgeSharedPathsWithCommonEndPoint.value, !0);
  try {
    return mu(i, a, t, e, n, o.edgeStyle, o.shapeBufferDistance);
  } finally {
    a.delete();
  }
}
function hu(t, e, n) {
  const r = /* @__PURE__ */ new Map();
  for (const [i, o] of n)
    r.set(i, new t.ShapeRef(e, new t.Rectangle(new t.Point(o.position.x, o.position.y), o.size.width, o.size.height)));
  return r;
}
function du(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  let o = 1;
  for (const [s, a] of r) {
    const u = e.get(a.nodeId), c = n.get(a.nodeId);
    if (!u || !c)
      continue;
    const f = o++;
    i.set(s, f);
    const d = (a.absolutePosition.x - (c.position.x - c.size.width / 2)) / c.size.width, h = (a.absolutePosition.y - (c.position.y - c.size.height / 2)) / c.size.height, g = a.side === "top" || a.side === "bottom" ? zs : uu(a.side);
    new t.ShapeConnectionPin(u, f, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, h)), !0, 0, g).setExclusive(!1);
  }
  return i;
}
function gu(t, e, n, r, i, o, s, a) {
  const u = /* @__PURE__ */ new Map();
  for (const [c, f] of s.entries()) {
    const d = f.id ?? `__link_${c}`, h = zr(f.from), g = zr(f.to);
    if (!n.has(h) || !n.has(g))
      continue;
    const p = Tr(f.from), _ = Tr(f.to), R = p ? `${h}:${p}` : null, N = _ ? `${g}:${_}` : null, V = R ? r.get(R) : void 0;
    let C;
    if (V !== void 0)
      C = new t.ConnEnd(n.get(h), V);
    else {
      const X = R ? o.get(R) : void 0, G = i.get(h), rt = (X == null ? void 0 : X.absolutePosition) ?? (G == null ? void 0 : G.position);
      if (!rt)
        continue;
      C = new t.ConnEnd(new t.Point(rt.x, rt.y));
    }
    const w = N ? o.get(N) : void 0, T = i.get(g), k = (w == null ? void 0 : w.absolutePosition) ?? (T == null ? void 0 : T.position);
    if (!k)
      continue;
    const A = new t.ConnEnd(new t.Point(k.x, k.y)), O = new t.ConnRef(e, C, A), H = N ? o.get(N) : null;
    if (H != null && H.side) {
      const G = Math.max(H.size.width, H.size.height) / 2 + 16;
      let rt = H.absolutePosition.x, D = H.absolutePosition.y;
      switch (H.side) {
        case "top":
          D -= G;
          break;
        case "bottom":
          D += G;
          break;
        case "left":
          rt -= G;
          break;
        case "right":
          rt += G;
          break;
      }
      if (!cu(rt, D, i, a)) {
        const m = new t.CheckpointVector();
        m.push_back(new t.Checkpoint(new t.Point(rt, D))), O.setRoutingCheckpoints(m);
      }
    }
    u.set(d, O);
  }
  return e.processTransaction(), u;
}
function vu(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  for (const [o, s] of n.entries()) {
    const a = s.id ?? `__link_${o}`, u = t.get(a);
    if (!u)
      continue;
    const c = u.displayRoute(), f = [];
    for (let k = 0; k < c.size(); k++) {
      const A = c.at(k);
      f.push({ x: A.x, y: A.y });
    }
    const d = zr(s.from), h = zr(s.to), g = Tr(s.from), p = Tr(s.to), _ = g ? `${d}:${g}` : null, R = p ? `${h}:${p}` : null, N = _ ? e.get(_) : void 0, V = R ? e.get(R) : void 0;
    N && f.length > 0 && (f[0] = { x: N.absolutePosition.x, y: N.absolutePosition.y }), V && f.length > 0 && (f[f.length - 1] = {
      x: V.absolutePosition.x,
      y: V.absolutePosition.y
    });
    const C = f[0], w = f[f.length - 1], T = r === "straight" && f.length > 2 && C && w ? [C, w] : f;
    i.set(a, {
      id: a,
      fromPortId: g ? `${d}:${g}` : null,
      toPortId: p ? `${h}:${p}` : null,
      fromNodeId: d,
      toNodeId: h,
      fromEndpoint: uo(s.from),
      toEndpoint: uo(s.to),
      points: T,
      width: ou(s),
      link: s
    });
  }
  return i;
}
function mu(t, e, n, r, i, o, s) {
  const a = hu(t, e, n), u = du(t, a, n, r), c = gu(t, e, a, u, n, r, i, s), f = vu(c, r, i, o), d = pu(f);
  return yu(d);
}
function pu(t) {
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
  co(n, e, "y");
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
  return co(r, e, "x"), e;
}
function co(t, e, n) {
  if (!(t.length < 2)) {
    t.sort((r, i) => r.fixed - i.fixed);
    for (const [r, i] of t.entries()) {
      const o = t[r + 1];
      if (!o || i.max <= o.min || o.max <= i.min)
        continue;
      const s = (i.width + o.width) / 2 + Math.max(i.width, o.width), a = Math.abs(o.fixed - i.fixed);
      if (a >= s)
        continue;
      const c = (s - a) / 2;
      fo(e, i, -c, n), fo(e, o, c, n), i.fixed -= c, o.fixed += c;
    }
  }
}
function fo(t, e, n, r) {
  const i = t.get(e.edgeId);
  if (!i)
    return;
  const o = i.points[e.pointIndex], s = i.points[e.pointIndex + 1];
  !o || !s || (r === "y" ? (o.y += n, s.y += n) : (o.x += n, s.x += n));
}
const _u = 8, ho = 6;
function yu(t) {
  const e = /* @__PURE__ */ new Map();
  for (const [n, r] of t)
    e.set(n, {
      ...r,
      points: wu(r.points, _u)
    });
  return e;
}
function wu(t, e) {
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
    const c = Math.hypot(s.x - a.x, s.y - a.y), f = Math.hypot(u.x - s.x, u.y - s.y), d = Math.min(e, c / 2, f / 2);
    if (d < 1) {
      n.push({ ...s });
      continue;
    }
    const h = (a.x - s.x) / c, g = (a.y - s.y) / c, p = (u.x - s.x) / f, _ = (u.y - s.y) / f, R = h * _ - g * p;
    if (Math.abs(R) < 1e-3) {
      n.push({ ...s });
      continue;
    }
    const N = s.x + h * d, V = s.y + g * d, C = s.x + p * d, w = s.y + _ * d;
    for (let T = 0; T <= ho; T++) {
      const k = T / ho, A = 1 - k, O = A * A * N + 2 * A * k * s.x + k * k * C, H = A * A * V + 2 * A * k * s.y + k * k * w;
      n.push({ x: O, y: H });
    }
  }
  const i = t[t.length - 1];
  return i && n.push({ ...i }), n;
}
const rn = 8;
function Ts(t, e, n = rn) {
  return t.x - t.w / 2 - n < e.x + e.w / 2 && t.x + t.w / 2 + n > e.x - e.w / 2 && t.y - t.h / 2 - n < e.y + e.h / 2 && t.y + t.h / 2 + n > e.y - e.h / 2;
}
function Cs(t, e, n = rn) {
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
function Rs(t, e, n, r) {
  const i = [];
  for (const [o, s] of n)
    o !== t && i.push({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height });
  if (r)
    for (const [o, s] of r)
      o !== t && (e && xu(e, o, r) || i.push(vi(s.bounds)));
  return i;
}
function Ls(t, e, n = rn) {
  let r = t.x, i = t.y;
  for (const o of e) {
    const s = { x: r, y: i, w: t.w, h: t.h };
    if (Ts(s, o, n)) {
      const a = Cs(s, o, n);
      r = a.x, i = a.y;
    }
  }
  return { x: r, y: i };
}
function Fs(t, e, n, r, i = rn, o) {
  const s = r.get(t);
  if (!s)
    return { x: e, y: n };
  const a = Rs(t, s.node.parent, r, o);
  return Ls({ x: e, y: n, w: s.size.width, h: s.size.height }, a, i);
}
function xu(t, e, n) {
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
const vr = 20, go = 28;
function vi(t) {
  return { x: t.x + t.width / 2, y: t.y + t.height / 2, w: t.width, h: t.height };
}
function Yi(t, e, n, r, i, o) {
  for (const [s, a] of r)
    if (a.node.parent === t) {
      r.set(s, { ...a, position: { x: a.position.x + e, y: a.position.y + n } });
      for (const [u, c] of o)
        c.nodeId === s && o.set(u, {
          ...c,
          absolutePosition: { x: c.absolutePosition.x + e, y: c.absolutePosition.y + n }
        });
    }
  for (const [s, a] of i)
    a.subgraph.parent === t && (i.set(s, {
      ...a,
      bounds: { ...a.bounds, x: a.bounds.x + e, y: a.bounds.y + n }
    }), Yi(s, e, n, r, i, o));
}
function Cr(t, e, n) {
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
    let a = Number.POSITIVE_INFINITY, u = Number.POSITIVE_INFINITY, c = Number.NEGATIVE_INFINITY, f = Number.NEGATIVE_INFINITY, d = !1;
    for (const h of t.values()) {
      if (h.node.parent !== o)
        continue;
      d = !0;
      const g = h.size.width / 2, p = h.size.height / 2;
      a = Math.min(a, h.position.x - g), u = Math.min(u, h.position.y - p), c = Math.max(c, h.position.x + g), f = Math.max(f, h.position.y + p);
    }
    for (const h of e.values())
      h.subgraph.parent === o && (d = !0, a = Math.min(a, h.bounds.x), u = Math.min(u, h.bounds.y), c = Math.max(c, h.bounds.x + h.bounds.width), f = Math.max(f, h.bounds.y + h.bounds.height));
    d && e.set(o, {
      ...s,
      bounds: {
        x: a - vr,
        y: u - vr - go,
        width: c - a + vr * 2,
        height: f - u + vr * 2 + go
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
      const c = e.get(u);
      if (!c || c.subgraph.parent !== a)
        continue;
      const f = vi(s.bounds), d = vi(c.bounds);
      if (!Ts(f, d, rn))
        continue;
      const h = Cs(d, f, rn), g = h.x - d.x, p = h.y - d.y;
      g === 0 && p === 0 || (e.set(u, {
        ...c,
        bounds: { ...c.bounds, x: c.bounds.x + g, y: c.bounds.y + p }
      }), Yi(u, g, p, t, e, n));
    }
  }
  for (const [o, s] of t) {
    const a = Rs(o, s.node.parent, t, e), u = Ls({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height }, a);
    if (u.x !== s.position.x || u.y !== s.position.y) {
      const c = u.x - s.position.x, f = u.y - s.position.y;
      t.set(o, { ...s, position: u });
      for (const [d, h] of n)
        h.nodeId === o && n.set(d, {
          ...h,
          absolutePosition: { x: h.absolutePosition.x + c, y: h.absolutePosition.y + f }
        });
    }
  }
}
async function bu(t, e, n, r, i, o = rn) {
  const s = r.nodes.get(t);
  if (!s)
    return null;
  const { x: a, y: u } = Fs(t, e, n, r.nodes, o, r.subgraphs), c = a - s.position.x, f = u - s.position.y;
  if (c === 0 && f === 0)
    return null;
  const d = new Map(r.nodes);
  d.set(t, { ...s, position: { x: a, y: u } });
  const h = new Map(r.ports);
  for (const [_, R] of r.ports)
    R.nodeId === t && h.set(_, {
      ...R,
      absolutePosition: {
        x: R.absolutePosition.x + c,
        y: R.absolutePosition.y + f
      }
    });
  let g;
  r.subgraphs && (g = new Map(r.subgraphs), Cr(d, g, h));
  const p = await Kn(d, h, i);
  return { nodes: d, ports: h, edges: p, subgraphs: g };
}
async function ku(t, e, n, r, i) {
  const o = r.subgraphs.get(t);
  if (!o)
    return null;
  const s = e - o.bounds.x, a = n - o.bounds.y;
  if (s === 0 && a === 0)
    return null;
  const u = new Map(r.nodes), c = new Map(r.ports), f = new Map(r.subgraphs);
  f.set(t, { ...o, bounds: { ...o.bounds, x: e, y: n } }), Yi(t, s, a, u, f, c), Cr(u, f, c);
  const d = await Kn(u, c, i);
  return { nodes: u, ports: c, edges: d, subgraphs: f };
}
function Eu(t, e, n, r, i) {
  return t.some((o) => {
    const s = typeof o.from == "string" ? { node: o.from } : o.from, a = typeof o.to == "string" ? { node: o.to } : o.to;
    return s.node === e && s.port === n && a.node === r && a.port === i || s.node === r && s.port === i && a.node === e && a.port === n;
  });
}
function Su(t, e, n) {
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
const vo = 8, mo = 24;
function Nu(t, e) {
  const n = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const r of e.values())
    r.nodeId === t && r.side && n[r.side]++;
  return n;
}
function Mu(t, e) {
  const n = Math.max(t.top, t.bottom), r = Math.max(t.left, t.right);
  return {
    width: Math.max(e.width, (n + 1) * mo),
    height: Math.max(e.height, (r + 1) * mo)
  };
}
function Au(t, e, n, r) {
  const i = n.position.x, o = n.position.y, s = n.size.width / 2, a = n.size.height / 2, u = [];
  for (const c of r.values())
    c.nodeId === t && c.side === e && u.push(c);
  if (u.length !== 0)
    for (const [c, f] of u.entries()) {
      const d = (c + 1) / (u.length + 1);
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
      r.set(f.id, { ...f, absolutePosition: { x: h, y: g } });
    }
}
function Os(t, e, n) {
  const r = e.get(t);
  if (!r)
    return;
  const i = Nu(t, n), o = Mu(i, r.size);
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
function Pu(t, e, n, r, i) {
  if (!n.get(t))
    return null;
  const s = Su(t, i, r), a = `${t}:${s}`, u = new Map(r);
  u.set(a, {
    id: a,
    nodeId: t,
    label: s,
    absolutePosition: { x: 0, y: 0 },
    side: e,
    size: { width: vo, height: vo }
  });
  const c = new Map(n);
  return Os(t, c, u), { nodes: c, ports: u, portId: a };
}
function Iu(t, e, n, r) {
  const i = n.get(t);
  if (!i)
    return null;
  const o = i.nodeId, s = i.label, a = r.filter((f) => {
    const d = typeof f.from == "string" ? { node: f.from } : f.from, h = typeof f.to == "string" ? { node: f.to } : f.to;
    return !(d.node === o && d.port === s || h.node === o && h.port === s);
  }), u = new Map(n);
  u.delete(t);
  const c = new Map(e);
  return Os(o, c, u), { nodes: c, ports: u, links: a };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function Ds(t) {
  return typeof t > "u" || t === null;
}
function zu(t) {
  return typeof t == "object" && t !== null;
}
function Tu(t) {
  return Array.isArray(t) ? t : Ds(t) ? [] : [t];
}
function Cu(t, e) {
  var n, r, i, o;
  if (e)
    for (o = Object.keys(e), n = 0, r = o.length; n < r; n += 1)
      i = o[n], t[i] = e[i];
  return t;
}
function Ru(t, e) {
  var n = "", r;
  for (r = 0; r < e; r += 1)
    n += t;
  return n;
}
function Lu(t) {
  return t === 0 && Number.NEGATIVE_INFINITY === 1 / t;
}
var Fu = Ds, Ou = zu, Du = Tu, Yu = Ru, Hu = Lu, Bu = Cu, Hi = {
  isNothing: Fu,
  isObject: Ou,
  toArray: Du,
  repeat: Yu,
  isNegativeZero: Hu,
  extend: Bu
};
function Ys(t, e) {
  var n = "", r = t.reason || "(unknown reason)";
  return t.mark ? (t.mark.name && (n += 'in "' + t.mark.name + '" '), n += "(" + (t.mark.line + 1) + ":" + (t.mark.column + 1) + ")", !e && t.mark.snippet && (n += `

` + t.mark.snippet), r + " " + n) : r;
}
function jn(t, e) {
  Error.call(this), this.name = "YAMLException", this.reason = t, this.mark = e, this.message = Ys(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
jn.prototype = Object.create(Error.prototype);
jn.prototype.constructor = jn;
jn.prototype.toString = function(e) {
  return this.name + ": " + Ys(this, e);
};
var Xe = jn, Vu = [
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
], Xu = [
  "scalar",
  "sequence",
  "mapping"
];
function qu(t) {
  var e = {};
  return t !== null && Object.keys(t).forEach(function(n) {
    t[n].forEach(function(r) {
      e[String(r)] = n;
    });
  }), e;
}
function Uu(t, e) {
  if (e = e || {}, Object.keys(e).forEach(function(n) {
    if (Vu.indexOf(n) === -1)
      throw new Xe('Unknown option "' + n + '" is met in definition of "' + t + '" YAML type.');
  }), this.options = e, this.tag = t, this.kind = e.kind || null, this.resolve = e.resolve || function() {
    return !0;
  }, this.construct = e.construct || function(n) {
    return n;
  }, this.instanceOf = e.instanceOf || null, this.predicate = e.predicate || null, this.represent = e.represent || null, this.representName = e.representName || null, this.defaultStyle = e.defaultStyle || null, this.multi = e.multi || !1, this.styleAliases = qu(e.styleAliases || null), Xu.indexOf(this.kind) === -1)
    throw new Xe('Unknown kind "' + this.kind + '" is specified for "' + t + '" YAML type.');
}
var St = Uu;
function po(t, e) {
  var n = [];
  return t[e].forEach(function(r) {
    var i = n.length;
    n.forEach(function(o, s) {
      o.tag === r.tag && o.kind === r.kind && o.multi === r.multi && (i = s);
    }), n[i] = r;
  }), n;
}
function Gu() {
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
function mi(t) {
  return this.extend(t);
}
mi.prototype.extend = function(e) {
  var n = [], r = [];
  if (e instanceof St)
    r.push(e);
  else if (Array.isArray(e))
    r = r.concat(e);
  else if (e && (Array.isArray(e.implicit) || Array.isArray(e.explicit)))
    e.implicit && (n = n.concat(e.implicit)), e.explicit && (r = r.concat(e.explicit));
  else
    throw new Xe("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  n.forEach(function(o) {
    if (!(o instanceof St))
      throw new Xe("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (o.loadKind && o.loadKind !== "scalar")
      throw new Xe("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (o.multi)
      throw new Xe("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), r.forEach(function(o) {
    if (!(o instanceof St))
      throw new Xe("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(mi.prototype);
  return i.implicit = (this.implicit || []).concat(n), i.explicit = (this.explicit || []).concat(r), i.compiledImplicit = po(i, "implicit"), i.compiledExplicit = po(i, "explicit"), i.compiledTypeMap = Gu(i.compiledImplicit, i.compiledExplicit), i;
};
var Wu = mi, Ku = new St("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(t) {
    return t !== null ? t : "";
  }
}), Zu = new St("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(t) {
    return t !== null ? t : [];
  }
}), Ju = new St("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(t) {
    return t !== null ? t : {};
  }
}), Qu = new Wu({
  explicit: [
    Ku,
    Zu,
    Ju
  ]
});
function ju(t) {
  if (t === null) return !0;
  var e = t.length;
  return e === 1 && t === "~" || e === 4 && (t === "null" || t === "Null" || t === "NULL");
}
function $u() {
  return null;
}
function tc(t) {
  return t === null;
}
var ec = new St("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: ju,
  construct: $u,
  predicate: tc,
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
function nc(t) {
  if (t === null) return !1;
  var e = t.length;
  return e === 4 && (t === "true" || t === "True" || t === "TRUE") || e === 5 && (t === "false" || t === "False" || t === "FALSE");
}
function rc(t) {
  return t === "true" || t === "True" || t === "TRUE";
}
function ic(t) {
  return Object.prototype.toString.call(t) === "[object Boolean]";
}
var oc = new St("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: nc,
  construct: rc,
  predicate: ic,
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
function sc(t) {
  return 48 <= t && t <= 57 || 65 <= t && t <= 70 || 97 <= t && t <= 102;
}
function ac(t) {
  return 48 <= t && t <= 55;
}
function lc(t) {
  return 48 <= t && t <= 57;
}
function uc(t) {
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
          if (!sc(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
    if (i === "o") {
      for (n++; n < e; n++)
        if (i = t[n], i !== "_") {
          if (!ac(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; n < e; n++)
    if (i = t[n], i !== "_") {
      if (!lc(t.charCodeAt(n)))
        return !1;
      r = !0;
    }
  return !(!r || i === "_");
}
function cc(t) {
  var e = t, n = 1, r;
  if (e.indexOf("_") !== -1 && (e = e.replace(/_/g, "")), r = e[0], (r === "-" || r === "+") && (r === "-" && (n = -1), e = e.slice(1), r = e[0]), e === "0") return 0;
  if (r === "0") {
    if (e[1] === "b") return n * parseInt(e.slice(2), 2);
    if (e[1] === "x") return n * parseInt(e.slice(2), 16);
    if (e[1] === "o") return n * parseInt(e.slice(2), 8);
  }
  return n * parseInt(e, 10);
}
function fc(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && t % 1 === 0 && !Hi.isNegativeZero(t);
}
var hc = new St("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: uc,
  construct: cc,
  predicate: fc,
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
}), dc = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function gc(t) {
  return !(t === null || !dc.test(t) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  t[t.length - 1] === "_");
}
function vc(t) {
  var e, n;
  return e = t.replace(/_/g, "").toLowerCase(), n = e[0] === "-" ? -1 : 1, "+-".indexOf(e[0]) >= 0 && (e = e.slice(1)), e === ".inf" ? n === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : e === ".nan" ? NaN : n * parseFloat(e, 10);
}
var mc = /^[-+]?[0-9]+e/;
function pc(t, e) {
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
  else if (Hi.isNegativeZero(t))
    return "-0.0";
  return n = t.toString(10), mc.test(n) ? n.replace("e", ".e") : n;
}
function _c(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && (t % 1 !== 0 || Hi.isNegativeZero(t));
}
var yc = new St("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: gc,
  construct: vc,
  predicate: _c,
  represent: pc,
  defaultStyle: "lowercase"
}), wc = Qu.extend({
  implicit: [
    ec,
    oc,
    hc,
    yc
  ]
}), xc = wc, Hs = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Bs = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function bc(t) {
  return t === null ? !1 : Hs.exec(t) !== null || Bs.exec(t) !== null;
}
function kc(t) {
  var e, n, r, i, o, s, a, u = 0, c = null, f, d, h;
  if (e = Hs.exec(t), e === null && (e = Bs.exec(t)), e === null) throw new Error("Date resolve error");
  if (n = +e[1], r = +e[2] - 1, i = +e[3], !e[4])
    return new Date(Date.UTC(n, r, i));
  if (o = +e[4], s = +e[5], a = +e[6], e[7]) {
    for (u = e[7].slice(0, 3); u.length < 3; )
      u += "0";
    u = +u;
  }
  return e[9] && (f = +e[10], d = +(e[11] || 0), c = (f * 60 + d) * 6e4, e[9] === "-" && (c = -c)), h = new Date(Date.UTC(n, r, i, o, s, a, u)), c && h.setTime(h.getTime() - c), h;
}
function Ec(t) {
  return t.toISOString();
}
var Sc = new St("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: bc,
  construct: kc,
  instanceOf: Date,
  represent: Ec
});
function Nc(t) {
  return t === "<<" || t === null;
}
var Mc = new St("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: Nc
}), Bi = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function Ac(t) {
  if (t === null) return !1;
  var e, n, r = 0, i = t.length, o = Bi;
  for (n = 0; n < i; n++)
    if (e = o.indexOf(t.charAt(n)), !(e > 64)) {
      if (e < 0) return !1;
      r += 6;
    }
  return r % 8 === 0;
}
function Pc(t) {
  var e, n, r = t.replace(/[\r\n=]/g, ""), i = r.length, o = Bi, s = 0, a = [];
  for (e = 0; e < i; e++)
    e % 4 === 0 && e && (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)), s = s << 6 | o.indexOf(r.charAt(e));
  return n = i % 4 * 6, n === 0 ? (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)) : n === 18 ? (a.push(s >> 10 & 255), a.push(s >> 2 & 255)) : n === 12 && a.push(s >> 4 & 255), new Uint8Array(a);
}
function Ic(t) {
  var e = "", n = 0, r, i, o = t.length, s = Bi;
  for (r = 0; r < o; r++)
    r % 3 === 0 && r && (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]), n = (n << 8) + t[r];
  return i = o % 3, i === 0 ? (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]) : i === 2 ? (e += s[n >> 10 & 63], e += s[n >> 4 & 63], e += s[n << 2 & 63], e += s[64]) : i === 1 && (e += s[n >> 2 & 63], e += s[n << 4 & 63], e += s[64], e += s[64]), e;
}
function zc(t) {
  return Object.prototype.toString.call(t) === "[object Uint8Array]";
}
var Tc = new St("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: Ac,
  construct: Pc,
  predicate: zc,
  represent: Ic
}), Cc = Object.prototype.hasOwnProperty, Rc = Object.prototype.toString;
function Lc(t) {
  if (t === null) return !0;
  var e = [], n, r, i, o, s, a = t;
  for (n = 0, r = a.length; n < r; n += 1) {
    if (i = a[n], s = !1, Rc.call(i) !== "[object Object]") return !1;
    for (o in i)
      if (Cc.call(i, o))
        if (!s) s = !0;
        else return !1;
    if (!s) return !1;
    if (e.indexOf(o) === -1) e.push(o);
    else return !1;
  }
  return !0;
}
function Fc(t) {
  return t !== null ? t : [];
}
var Oc = new St("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: Lc,
  construct: Fc
}), Dc = Object.prototype.toString;
function Yc(t) {
  if (t === null) return !0;
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1) {
    if (r = s[e], Dc.call(r) !== "[object Object]" || (i = Object.keys(r), i.length !== 1)) return !1;
    o[e] = [i[0], r[i[0]]];
  }
  return !0;
}
function Hc(t) {
  if (t === null) return [];
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1)
    r = s[e], i = Object.keys(r), o[e] = [i[0], r[i[0]]];
  return o;
}
var Bc = new St("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: Yc,
  construct: Hc
}), Vc = Object.prototype.hasOwnProperty;
function Xc(t) {
  if (t === null) return !0;
  var e, n = t;
  for (e in n)
    if (Vc.call(n, e) && n[e] !== null)
      return !1;
  return !0;
}
function qc(t) {
  return t !== null ? t : {};
}
var Uc = new St("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Xc,
  construct: qc
});
xc.extend({
  implicit: [
    Sc,
    Mc
  ],
  explicit: [
    Tc,
    Oc,
    Bc,
    Uc
  ]
});
function _o(t) {
  return t === 48 ? "\0" : t === 97 ? "\x07" : t === 98 ? "\b" : t === 116 || t === 9 ? "	" : t === 110 ? `
` : t === 118 ? "\v" : t === 102 ? "\f" : t === 114 ? "\r" : t === 101 ? "\x1B" : t === 32 ? " " : t === 34 ? '"' : t === 47 ? "/" : t === 92 ? "\\" : t === 78 ? "" : t === 95 ? " " : t === 76 ? "\u2028" : t === 80 ? "\u2029" : "";
}
var Gc = new Array(256), Wc = new Array(256);
for (var mn = 0; mn < 256; mn++)
  Gc[mn] = _o(mn) ? 1 : 0, Wc[mn] = _o(mn);
var yo;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(yo || (yo = {}));
const Er = {
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
      [tt.Router]: "#3b82f6",
      [tt.L3Switch]: "#8b5cf6",
      [tt.L2Switch]: "#a78bfa",
      [tt.Firewall]: "#ef4444",
      [tt.LoadBalancer]: "#f59e0b",
      [tt.Server]: "#10b981",
      [tt.AccessPoint]: "#06b6d4",
      [tt.Cloud]: "#3b82f6",
      [tt.Internet]: "#6366f1",
      [tt.Generic]: "#94a3b8"
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
  ...Er,
  colors: {
    ...Er.colors,
    // Device colors (adjusted for dark)
    devices: (tt.Router + "", tt.L3Switch + "", tt.L2Switch + "", tt.Firewall + "", tt.LoadBalancer + "", tt.Server + "", tt.AccessPoint + "", tt.Cloud + "", tt.Internet + "", tt.Generic + "")
  },
  shadows: {
    ...Er.shadows
  }
});
function Kc(t = Er) {
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
    selection: t.colors.primary,
    grid: t.colors.grid ?? (t.variant === "dark" ? "#334155" : "#e2e8f0")
  };
}
var Zc = { value: () => {
} };
function Ur() {
  for (var t = 0, e = arguments.length, n = {}, r; t < e; ++t) {
    if (!(r = arguments[t] + "") || r in n || /[\s.]/.test(r)) throw new Error("illegal type: " + r);
    n[r] = [];
  }
  return new Sr(n);
}
function Sr(t) {
  this._ = t;
}
function Jc(t, e) {
  return t.trim().split(/^|\s+/).map(function(n) {
    var r = "", i = n.indexOf(".");
    if (i >= 0 && (r = n.slice(i + 1), n = n.slice(0, i)), n && !e.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    return { type: n, name: r };
  });
}
Sr.prototype = Ur.prototype = {
  constructor: Sr,
  on: function(t, e) {
    var n = this._, r = Jc(t + "", n), i, o = -1, s = r.length;
    if (arguments.length < 2) {
      for (; ++o < s; ) if ((i = (t = r[o]).type) && (i = Qc(n[i], t.name))) return i;
      return;
    }
    if (e != null && typeof e != "function") throw new Error("invalid callback: " + e);
    for (; ++o < s; )
      if (i = (t = r[o]).type) n[i] = wo(n[i], t.name, e);
      else if (e == null) for (i in n) n[i] = wo(n[i], t.name, null);
    return this;
  },
  copy: function() {
    var t = {}, e = this._;
    for (var n in e) t[n] = e[n].slice();
    return new Sr(t);
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
function Qc(t, e) {
  for (var n = 0, r = t.length, i; n < r; ++n)
    if ((i = t[n]).name === e)
      return i.value;
}
function wo(t, e, n) {
  for (var r = 0, i = t.length; r < i; ++r)
    if (t[r].name === e) {
      t[r] = Zc, t = t.slice(0, r).concat(t.slice(r + 1));
      break;
    }
  return n != null && t.push({ name: e, value: n }), t;
}
var pi = "http://www.w3.org/1999/xhtml";
const xo = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: pi,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function Gr(t) {
  var e = t += "", n = e.indexOf(":");
  return n >= 0 && (e = t.slice(0, n)) !== "xmlns" && (t = t.slice(n + 1)), xo.hasOwnProperty(e) ? { space: xo[e], local: t } : t;
}
function jc(t) {
  return function() {
    var e = this.ownerDocument, n = this.namespaceURI;
    return n === pi && e.documentElement.namespaceURI === pi ? e.createElement(t) : e.createElementNS(n, t);
  };
}
function $c(t) {
  return function() {
    return this.ownerDocument.createElementNS(t.space, t.local);
  };
}
function Vs(t) {
  var e = Gr(t);
  return (e.local ? $c : jc)(e);
}
function tf() {
}
function Vi(t) {
  return t == null ? tf : function() {
    return this.querySelector(t);
  };
}
function ef(t) {
  typeof t != "function" && (t = Vi(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = new Array(s), u, c, f = 0; f < s; ++f)
      (u = o[f]) && (c = t.call(u, u.__data__, f, o)) && ("__data__" in u && (c.__data__ = u.__data__), a[f] = c);
  return new Bt(r, this._parents);
}
function nf(t) {
  return t == null ? [] : Array.isArray(t) ? t : Array.from(t);
}
function rf() {
  return [];
}
function Xs(t) {
  return t == null ? rf : function() {
    return this.querySelectorAll(t);
  };
}
function of(t) {
  return function() {
    return nf(t.apply(this, arguments));
  };
}
function sf(t) {
  typeof t == "function" ? t = of(t) : t = Xs(t);
  for (var e = this._groups, n = e.length, r = [], i = [], o = 0; o < n; ++o)
    for (var s = e[o], a = s.length, u, c = 0; c < a; ++c)
      (u = s[c]) && (r.push(t.call(u, u.__data__, c, s)), i.push(u));
  return new Bt(r, i);
}
function qs(t) {
  return function() {
    return this.matches(t);
  };
}
function Us(t) {
  return function(e) {
    return e.matches(t);
  };
}
var af = Array.prototype.find;
function lf(t) {
  return function() {
    return af.call(this.children, t);
  };
}
function uf() {
  return this.firstElementChild;
}
function cf(t) {
  return this.select(t == null ? uf : lf(typeof t == "function" ? t : Us(t)));
}
var ff = Array.prototype.filter;
function hf() {
  return Array.from(this.children);
}
function df(t) {
  return function() {
    return ff.call(this.children, t);
  };
}
function gf(t) {
  return this.selectAll(t == null ? hf : df(typeof t == "function" ? t : Us(t)));
}
function vf(t) {
  typeof t != "function" && (t = qs(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, c = 0; c < s; ++c)
      (u = o[c]) && t.call(u, u.__data__, c, o) && a.push(u);
  return new Bt(r, this._parents);
}
function Gs(t) {
  return new Array(t.length);
}
function mf() {
  return new Bt(this._enter || this._groups.map(Gs), this._parents);
}
function Rr(t, e) {
  this.ownerDocument = t.ownerDocument, this.namespaceURI = t.namespaceURI, this._next = null, this._parent = t, this.__data__ = e;
}
Rr.prototype = {
  constructor: Rr,
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
function pf(t) {
  return function() {
    return t;
  };
}
function _f(t, e, n, r, i, o) {
  for (var s = 0, a, u = e.length, c = o.length; s < c; ++s)
    (a = e[s]) ? (a.__data__ = o[s], r[s] = a) : n[s] = new Rr(t, o[s]);
  for (; s < u; ++s)
    (a = e[s]) && (i[s] = a);
}
function yf(t, e, n, r, i, o, s) {
  var a, u, c = /* @__PURE__ */ new Map(), f = e.length, d = o.length, h = new Array(f), g;
  for (a = 0; a < f; ++a)
    (u = e[a]) && (h[a] = g = s.call(u, u.__data__, a, e) + "", c.has(g) ? i[a] = u : c.set(g, u));
  for (a = 0; a < d; ++a)
    g = s.call(t, o[a], a, o) + "", (u = c.get(g)) ? (r[a] = u, u.__data__ = o[a], c.delete(g)) : n[a] = new Rr(t, o[a]);
  for (a = 0; a < f; ++a)
    (u = e[a]) && c.get(h[a]) === u && (i[a] = u);
}
function wf(t) {
  return t.__data__;
}
function xf(t, e) {
  if (!arguments.length) return Array.from(this, wf);
  var n = e ? yf : _f, r = this._parents, i = this._groups;
  typeof t != "function" && (t = pf(t));
  for (var o = i.length, s = new Array(o), a = new Array(o), u = new Array(o), c = 0; c < o; ++c) {
    var f = r[c], d = i[c], h = d.length, g = bf(t.call(f, f && f.__data__, c, r)), p = g.length, _ = a[c] = new Array(p), R = s[c] = new Array(p), N = u[c] = new Array(h);
    n(f, d, _, R, N, g, e);
    for (var V = 0, C = 0, w, T; V < p; ++V)
      if (w = _[V]) {
        for (V >= C && (C = V + 1); !(T = R[C]) && ++C < p; ) ;
        w._next = T || null;
      }
  }
  return s = new Bt(s, r), s._enter = a, s._exit = u, s;
}
function bf(t) {
  return typeof t == "object" && "length" in t ? t : Array.from(t);
}
function kf() {
  return new Bt(this._exit || this._groups.map(Gs), this._parents);
}
function Ef(t, e, n) {
  var r = this.enter(), i = this, o = this.exit();
  return typeof t == "function" ? (r = t(r), r && (r = r.selection())) : r = r.append(t + ""), e != null && (i = e(i), i && (i = i.selection())), n == null ? o.remove() : n(o), r && i ? r.merge(i).order() : i;
}
function Sf(t) {
  for (var e = t.selection ? t.selection() : t, n = this._groups, r = e._groups, i = n.length, o = r.length, s = Math.min(i, o), a = new Array(i), u = 0; u < s; ++u)
    for (var c = n[u], f = r[u], d = c.length, h = a[u] = new Array(d), g, p = 0; p < d; ++p)
      (g = c[p] || f[p]) && (h[p] = g);
  for (; u < i; ++u)
    a[u] = n[u];
  return new Bt(a, this._parents);
}
function Nf() {
  for (var t = this._groups, e = -1, n = t.length; ++e < n; )
    for (var r = t[e], i = r.length - 1, o = r[i], s; --i >= 0; )
      (s = r[i]) && (o && s.compareDocumentPosition(o) ^ 4 && o.parentNode.insertBefore(s, o), o = s);
  return this;
}
function Mf(t) {
  t || (t = Af);
  function e(d, h) {
    return d && h ? t(d.__data__, h.__data__) : !d - !h;
  }
  for (var n = this._groups, r = n.length, i = new Array(r), o = 0; o < r; ++o) {
    for (var s = n[o], a = s.length, u = i[o] = new Array(a), c, f = 0; f < a; ++f)
      (c = s[f]) && (u[f] = c);
    u.sort(e);
  }
  return new Bt(i, this._parents).order();
}
function Af(t, e) {
  return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
function Pf() {
  var t = arguments[0];
  return arguments[0] = this, t.apply(null, arguments), this;
}
function If() {
  return Array.from(this);
}
function zf() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length; i < o; ++i) {
      var s = r[i];
      if (s) return s;
    }
  return null;
}
function Tf() {
  let t = 0;
  for (const e of this) ++t;
  return t;
}
function Cf() {
  return !this.node();
}
function Rf(t) {
  for (var e = this._groups, n = 0, r = e.length; n < r; ++n)
    for (var i = e[n], o = 0, s = i.length, a; o < s; ++o)
      (a = i[o]) && t.call(a, a.__data__, o, i);
  return this;
}
function Lf(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function Ff(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function Of(t, e) {
  return function() {
    this.setAttribute(t, e);
  };
}
function Df(t, e) {
  return function() {
    this.setAttributeNS(t.space, t.local, e);
  };
}
function Yf(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttribute(t) : this.setAttribute(t, n);
  };
}
function Hf(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttributeNS(t.space, t.local) : this.setAttributeNS(t.space, t.local, n);
  };
}
function Bf(t, e) {
  var n = Gr(t);
  if (arguments.length < 2) {
    var r = this.node();
    return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n);
  }
  return this.each((e == null ? n.local ? Ff : Lf : typeof e == "function" ? n.local ? Hf : Yf : n.local ? Df : Of)(n, e));
}
function Ws(t) {
  return t.ownerDocument && t.ownerDocument.defaultView || t.document && t || t.defaultView;
}
function Vf(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function Xf(t, e, n) {
  return function() {
    this.style.setProperty(t, e, n);
  };
}
function qf(t, e, n) {
  return function() {
    var r = e.apply(this, arguments);
    r == null ? this.style.removeProperty(t) : this.style.setProperty(t, r, n);
  };
}
function Uf(t, e, n) {
  return arguments.length > 1 ? this.each((e == null ? Vf : typeof e == "function" ? qf : Xf)(t, e, n ?? "")) : Ln(this.node(), t);
}
function Ln(t, e) {
  return t.style.getPropertyValue(e) || Ws(t).getComputedStyle(t, null).getPropertyValue(e);
}
function Gf(t) {
  return function() {
    delete this[t];
  };
}
function Wf(t, e) {
  return function() {
    this[t] = e;
  };
}
function Kf(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? delete this[t] : this[t] = n;
  };
}
function Zf(t, e) {
  return arguments.length > 1 ? this.each((e == null ? Gf : typeof e == "function" ? Kf : Wf)(t, e)) : this.node()[t];
}
function Ks(t) {
  return t.trim().split(/^|\s+/);
}
function Xi(t) {
  return t.classList || new Zs(t);
}
function Zs(t) {
  this._node = t, this._names = Ks(t.getAttribute("class") || "");
}
Zs.prototype = {
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
function Js(t, e) {
  for (var n = Xi(t), r = -1, i = e.length; ++r < i; ) n.add(e[r]);
}
function Qs(t, e) {
  for (var n = Xi(t), r = -1, i = e.length; ++r < i; ) n.remove(e[r]);
}
function Jf(t) {
  return function() {
    Js(this, t);
  };
}
function Qf(t) {
  return function() {
    Qs(this, t);
  };
}
function jf(t, e) {
  return function() {
    (e.apply(this, arguments) ? Js : Qs)(this, t);
  };
}
function $f(t, e) {
  var n = Ks(t + "");
  if (arguments.length < 2) {
    for (var r = Xi(this.node()), i = -1, o = n.length; ++i < o; ) if (!r.contains(n[i])) return !1;
    return !0;
  }
  return this.each((typeof e == "function" ? jf : e ? Jf : Qf)(n, e));
}
function th() {
  this.textContent = "";
}
function eh(t) {
  return function() {
    this.textContent = t;
  };
}
function nh(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.textContent = e ?? "";
  };
}
function rh(t) {
  return arguments.length ? this.each(t == null ? th : (typeof t == "function" ? nh : eh)(t)) : this.node().textContent;
}
function ih() {
  this.innerHTML = "";
}
function oh(t) {
  return function() {
    this.innerHTML = t;
  };
}
function sh(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.innerHTML = e ?? "";
  };
}
function ah(t) {
  return arguments.length ? this.each(t == null ? ih : (typeof t == "function" ? sh : oh)(t)) : this.node().innerHTML;
}
function lh() {
  this.nextSibling && this.parentNode.appendChild(this);
}
function uh() {
  return this.each(lh);
}
function ch() {
  this.previousSibling && this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function fh() {
  return this.each(ch);
}
function hh(t) {
  var e = typeof t == "function" ? t : Vs(t);
  return this.select(function() {
    return this.appendChild(e.apply(this, arguments));
  });
}
function dh() {
  return null;
}
function gh(t, e) {
  var n = typeof t == "function" ? t : Vs(t), r = e == null ? dh : typeof e == "function" ? e : Vi(e);
  return this.select(function() {
    return this.insertBefore(n.apply(this, arguments), r.apply(this, arguments) || null);
  });
}
function vh() {
  var t = this.parentNode;
  t && t.removeChild(this);
}
function mh() {
  return this.each(vh);
}
function ph() {
  var t = this.cloneNode(!1), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function _h() {
  var t = this.cloneNode(!0), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function yh(t) {
  return this.select(t ? _h : ph);
}
function wh(t) {
  return arguments.length ? this.property("__data__", t) : this.node().__data__;
}
function xh(t) {
  return function(e) {
    t.call(this, e, this.__data__);
  };
}
function bh(t) {
  return t.trim().split(/^|\s+/).map(function(e) {
    var n = "", r = e.indexOf(".");
    return r >= 0 && (n = e.slice(r + 1), e = e.slice(0, r)), { type: e, name: n };
  });
}
function kh(t) {
  return function() {
    var e = this.__on;
    if (e) {
      for (var n = 0, r = -1, i = e.length, o; n < i; ++n)
        o = e[n], (!t.type || o.type === t.type) && o.name === t.name ? this.removeEventListener(o.type, o.listener, o.options) : e[++r] = o;
      ++r ? e.length = r : delete this.__on;
    }
  };
}
function Eh(t, e, n) {
  return function() {
    var r = this.__on, i, o = xh(e);
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
function Sh(t, e, n) {
  var r = bh(t + ""), i, o = r.length, s;
  if (arguments.length < 2) {
    var a = this.node().__on;
    if (a) {
      for (var u = 0, c = a.length, f; u < c; ++u)
        for (i = 0, f = a[u]; i < o; ++i)
          if ((s = r[i]).type === f.type && s.name === f.name)
            return f.value;
    }
    return;
  }
  for (a = e ? Eh : kh, i = 0; i < o; ++i) this.each(a(r[i], e, n));
  return this;
}
function js(t, e, n) {
  var r = Ws(t), i = r.CustomEvent;
  typeof i == "function" ? i = new i(e, n) : (i = r.document.createEvent("Event"), n ? (i.initEvent(e, n.bubbles, n.cancelable), i.detail = n.detail) : i.initEvent(e, !1, !1)), t.dispatchEvent(i);
}
function Nh(t, e) {
  return function() {
    return js(this, t, e);
  };
}
function Mh(t, e) {
  return function() {
    return js(this, t, e.apply(this, arguments));
  };
}
function Ah(t, e) {
  return this.each((typeof e == "function" ? Mh : Nh)(t, e));
}
function* Ph() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length, s; i < o; ++i)
      (s = r[i]) && (yield s);
}
var $s = [null];
function Bt(t, e) {
  this._groups = t, this._parents = e;
}
function cr() {
  return new Bt([[document.documentElement]], $s);
}
function Ih() {
  return this;
}
Bt.prototype = cr.prototype = {
  constructor: Bt,
  select: ef,
  selectAll: sf,
  selectChild: cf,
  selectChildren: gf,
  filter: vf,
  data: xf,
  enter: mf,
  exit: kf,
  join: Ef,
  merge: Sf,
  selection: Ih,
  order: Nf,
  sort: Mf,
  call: Pf,
  nodes: If,
  node: zf,
  size: Tf,
  empty: Cf,
  each: Rf,
  attr: Bf,
  style: Uf,
  property: Zf,
  classed: $f,
  text: rh,
  html: ah,
  raise: uh,
  lower: fh,
  append: hh,
  insert: gh,
  remove: mh,
  clone: yh,
  datum: wh,
  on: Sh,
  dispatch: Ah,
  [Symbol.iterator]: Ph
};
function Tt(t) {
  return typeof t == "string" ? new Bt([[document.querySelector(t)]], [document.documentElement]) : new Bt([[t]], $s);
}
function zh(t) {
  let e;
  for (; e = t.sourceEvent; ) t = e;
  return t;
}
function ve(t, e) {
  if (t = zh(t), e === void 0 && (e = t.currentTarget), e) {
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
const Th = { passive: !1 }, $n = { capture: !0, passive: !1 };
function ti(t) {
  t.stopImmediatePropagation();
}
function wn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function ta(t) {
  var e = t.document.documentElement, n = Tt(t).on("dragstart.drag", wn, $n);
  "onselectstart" in e ? n.on("selectstart.drag", wn, $n) : (e.__noselect = e.style.MozUserSelect, e.style.MozUserSelect = "none");
}
function ea(t, e) {
  var n = t.document.documentElement, r = Tt(t).on("dragstart.drag", null);
  e && (r.on("click.drag", wn, $n), setTimeout(function() {
    r.on("click.drag", null);
  }, 0)), "onselectstart" in n ? r.on("selectstart.drag", null) : (n.style.MozUserSelect = n.__noselect, delete n.__noselect);
}
const mr = (t) => () => t;
function _i(t, {
  sourceEvent: e,
  subject: n,
  target: r,
  identifier: i,
  active: o,
  x: s,
  y: a,
  dx: u,
  dy: c,
  dispatch: f
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
    dy: { value: c, enumerable: !0, configurable: !0 },
    _: { value: f }
  });
}
_i.prototype.on = function() {
  var t = this._.on.apply(this._, arguments);
  return t === this._ ? this : t;
};
function Ch(t) {
  return !t.ctrlKey && !t.button;
}
function Rh() {
  return this.parentNode;
}
function Lh(t, e) {
  return e ?? { x: t.x, y: t.y };
}
function Fh() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function bo() {
  var t = Ch, e = Rh, n = Lh, r = Fh, i = {}, o = Ur("start", "drag", "end"), s = 0, a, u, c, f, d = 0;
  function h(w) {
    w.on("mousedown.drag", g).filter(r).on("touchstart.drag", R).on("touchmove.drag", N, Th).on("touchend.drag touchcancel.drag", V).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function g(w, T) {
    if (!(f || !t.call(this, w, T))) {
      var k = C(this, e.call(this, w, T), w, T, "mouse");
      k && (Tt(w.view).on("mousemove.drag", p, $n).on("mouseup.drag", _, $n), ta(w.view), ti(w), c = !1, a = w.clientX, u = w.clientY, k("start", w));
    }
  }
  function p(w) {
    if (wn(w), !c) {
      var T = w.clientX - a, k = w.clientY - u;
      c = T * T + k * k > d;
    }
    i.mouse("drag", w);
  }
  function _(w) {
    Tt(w.view).on("mousemove.drag mouseup.drag", null), ea(w.view, c), wn(w), i.mouse("end", w);
  }
  function R(w, T) {
    if (t.call(this, w, T)) {
      var k = w.changedTouches, A = e.call(this, w, T), O = k.length, H, X;
      for (H = 0; H < O; ++H)
        (X = C(this, A, w, T, k[H].identifier, k[H])) && (ti(w), X("start", w, k[H]));
    }
  }
  function N(w) {
    var T = w.changedTouches, k = T.length, A, O;
    for (A = 0; A < k; ++A)
      (O = i[T[A].identifier]) && (wn(w), O("drag", w, T[A]));
  }
  function V(w) {
    var T = w.changedTouches, k = T.length, A, O;
    for (f && clearTimeout(f), f = setTimeout(function() {
      f = null;
    }, 500), A = 0; A < k; ++A)
      (O = i[T[A].identifier]) && (ti(w), O("end", w, T[A]));
  }
  function C(w, T, k, A, O, H) {
    var X = o.copy(), G = ve(H || k, T), rt, D, m;
    if ((m = n.call(w, new _i("beforestart", {
      sourceEvent: k,
      target: h,
      identifier: O,
      active: s,
      x: G[0],
      y: G[1],
      dx: 0,
      dy: 0,
      dispatch: X
    }), A)) != null)
      return rt = m.x - G[0] || 0, D = m.y - G[1] || 0, function S(x, I, L) {
        var E = G, b;
        switch (x) {
          case "start":
            i[O] = S, b = s++;
            break;
          case "end":
            delete i[O], --s;
          // falls through
          case "drag":
            G = ve(L || I, T), b = s;
            break;
        }
        X.call(
          x,
          w,
          new _i(x, {
            sourceEvent: I,
            subject: m,
            target: h,
            identifier: O,
            active: b,
            x: G[0] + rt,
            y: G[1] + D,
            dx: G[0] - E[0],
            dy: G[1] - E[1],
            dispatch: X
          }),
          A
        );
      };
  }
  return h.filter = function(w) {
    return arguments.length ? (t = typeof w == "function" ? w : mr(!!w), h) : t;
  }, h.container = function(w) {
    return arguments.length ? (e = typeof w == "function" ? w : mr(w), h) : e;
  }, h.subject = function(w) {
    return arguments.length ? (n = typeof w == "function" ? w : mr(w), h) : n;
  }, h.touchable = function(w) {
    return arguments.length ? (r = typeof w == "function" ? w : mr(!!w), h) : r;
  }, h.on = function() {
    var w = o.on.apply(o, arguments);
    return w === o ? h : w;
  }, h.clickDistance = function(w) {
    return arguments.length ? (d = (w = +w) * w, h) : Math.sqrt(d);
  }, h;
}
function qi(t, e, n) {
  t.prototype = e.prototype = n, n.constructor = t;
}
function na(t, e) {
  var n = Object.create(t.prototype);
  for (var r in e) n[r] = e[r];
  return n;
}
function fr() {
}
var tr = 0.7, Lr = 1 / tr, xn = "\\s*([+-]?\\d+)\\s*", er = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", le = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Oh = /^#([0-9a-f]{3,8})$/, Dh = new RegExp(`^rgb\\(${xn},${xn},${xn}\\)$`), Yh = new RegExp(`^rgb\\(${le},${le},${le}\\)$`), Hh = new RegExp(`^rgba\\(${xn},${xn},${xn},${er}\\)$`), Bh = new RegExp(`^rgba\\(${le},${le},${le},${er}\\)$`), Vh = new RegExp(`^hsl\\(${er},${le},${le}\\)$`), Xh = new RegExp(`^hsla\\(${er},${le},${le},${er}\\)$`), ko = {
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
qi(fr, nr, {
  copy(t) {
    return Object.assign(new this.constructor(), this, t);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: Eo,
  // Deprecated! Use color.formatHex.
  formatHex: Eo,
  formatHex8: qh,
  formatHsl: Uh,
  formatRgb: So,
  toString: So
});
function Eo() {
  return this.rgb().formatHex();
}
function qh() {
  return this.rgb().formatHex8();
}
function Uh() {
  return ra(this).formatHsl();
}
function So() {
  return this.rgb().formatRgb();
}
function nr(t) {
  var e, n;
  return t = (t + "").trim().toLowerCase(), (e = Oh.exec(t)) ? (n = e[1].length, e = parseInt(e[1], 16), n === 6 ? No(e) : n === 3 ? new Rt(e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, (e & 15) << 4 | e & 15, 1) : n === 8 ? pr(e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, (e & 255) / 255) : n === 4 ? pr(e >> 12 & 15 | e >> 8 & 240, e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, ((e & 15) << 4 | e & 15) / 255) : null) : (e = Dh.exec(t)) ? new Rt(e[1], e[2], e[3], 1) : (e = Yh.exec(t)) ? new Rt(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, 1) : (e = Hh.exec(t)) ? pr(e[1], e[2], e[3], e[4]) : (e = Bh.exec(t)) ? pr(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, e[4]) : (e = Vh.exec(t)) ? Po(e[1], e[2] / 100, e[3] / 100, 1) : (e = Xh.exec(t)) ? Po(e[1], e[2] / 100, e[3] / 100, e[4]) : ko.hasOwnProperty(t) ? No(ko[t]) : t === "transparent" ? new Rt(NaN, NaN, NaN, 0) : null;
}
function No(t) {
  return new Rt(t >> 16 & 255, t >> 8 & 255, t & 255, 1);
}
function pr(t, e, n, r) {
  return r <= 0 && (t = e = n = NaN), new Rt(t, e, n, r);
}
function Gh(t) {
  return t instanceof fr || (t = nr(t)), t ? (t = t.rgb(), new Rt(t.r, t.g, t.b, t.opacity)) : new Rt();
}
function yi(t, e, n, r) {
  return arguments.length === 1 ? Gh(t) : new Rt(t, e, n, r ?? 1);
}
function Rt(t, e, n, r) {
  this.r = +t, this.g = +e, this.b = +n, this.opacity = +r;
}
qi(Rt, yi, na(fr, {
  brighter(t) {
    return t = t == null ? Lr : Math.pow(Lr, t), new Rt(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? tr : Math.pow(tr, t), new Rt(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rt($e(this.r), $e(this.g), $e(this.b), Fr(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && -0.5 <= this.g && this.g < 255.5 && -0.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
  },
  hex: Mo,
  // Deprecated! Use color.formatHex.
  formatHex: Mo,
  formatHex8: Wh,
  formatRgb: Ao,
  toString: Ao
}));
function Mo() {
  return `#${Ue(this.r)}${Ue(this.g)}${Ue(this.b)}`;
}
function Wh() {
  return `#${Ue(this.r)}${Ue(this.g)}${Ue(this.b)}${Ue((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function Ao() {
  const t = Fr(this.opacity);
  return `${t === 1 ? "rgb(" : "rgba("}${$e(this.r)}, ${$e(this.g)}, ${$e(this.b)}${t === 1 ? ")" : `, ${t})`}`;
}
function Fr(t) {
  return isNaN(t) ? 1 : Math.max(0, Math.min(1, t));
}
function $e(t) {
  return Math.max(0, Math.min(255, Math.round(t) || 0));
}
function Ue(t) {
  return t = $e(t), (t < 16 ? "0" : "") + t.toString(16);
}
function Po(t, e, n, r) {
  return r <= 0 ? t = e = n = NaN : n <= 0 || n >= 1 ? t = e = NaN : e <= 0 && (t = NaN), new $t(t, e, n, r);
}
function ra(t) {
  if (t instanceof $t) return new $t(t.h, t.s, t.l, t.opacity);
  if (t instanceof fr || (t = nr(t)), !t) return new $t();
  if (t instanceof $t) return t;
  t = t.rgb();
  var e = t.r / 255, n = t.g / 255, r = t.b / 255, i = Math.min(e, n, r), o = Math.max(e, n, r), s = NaN, a = o - i, u = (o + i) / 2;
  return a ? (e === o ? s = (n - r) / a + (n < r) * 6 : n === o ? s = (r - e) / a + 2 : s = (e - n) / a + 4, a /= u < 0.5 ? o + i : 2 - o - i, s *= 60) : a = u > 0 && u < 1 ? 0 : s, new $t(s, a, u, t.opacity);
}
function Kh(t, e, n, r) {
  return arguments.length === 1 ? ra(t) : new $t(t, e, n, r ?? 1);
}
function $t(t, e, n, r) {
  this.h = +t, this.s = +e, this.l = +n, this.opacity = +r;
}
qi($t, Kh, na(fr, {
  brighter(t) {
    return t = t == null ? Lr : Math.pow(Lr, t), new $t(this.h, this.s, this.l * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? tr : Math.pow(tr, t), new $t(this.h, this.s, this.l * t, this.opacity);
  },
  rgb() {
    var t = this.h % 360 + (this.h < 0) * 360, e = isNaN(t) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < 0.5 ? n : 1 - n) * e, i = 2 * n - r;
    return new Rt(
      ei(t >= 240 ? t - 240 : t + 120, i, r),
      ei(t, i, r),
      ei(t < 120 ? t + 240 : t - 120, i, r),
      this.opacity
    );
  },
  clamp() {
    return new $t(Io(this.h), _r(this.s), _r(this.l), Fr(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
  },
  formatHsl() {
    const t = Fr(this.opacity);
    return `${t === 1 ? "hsl(" : "hsla("}${Io(this.h)}, ${_r(this.s) * 100}%, ${_r(this.l) * 100}%${t === 1 ? ")" : `, ${t})`}`;
  }
}));
function Io(t) {
  return t = (t || 0) % 360, t < 0 ? t + 360 : t;
}
function _r(t) {
  return Math.max(0, Math.min(1, t || 0));
}
function ei(t, e, n) {
  return (t < 60 ? e + (n - e) * t / 60 : t < 180 ? n : t < 240 ? e + (n - e) * (240 - t) / 60 : e) * 255;
}
const ia = (t) => () => t;
function Zh(t, e) {
  return function(n) {
    return t + n * e;
  };
}
function Jh(t, e, n) {
  return t = Math.pow(t, n), e = Math.pow(e, n) - t, n = 1 / n, function(r) {
    return Math.pow(t + r * e, n);
  };
}
function Qh(t) {
  return (t = +t) == 1 ? oa : function(e, n) {
    return n - e ? Jh(e, n, t) : ia(isNaN(e) ? n : e);
  };
}
function oa(t, e) {
  var n = e - t;
  return n ? Zh(t, n) : ia(isNaN(t) ? e : t);
}
const zo = (function t(e) {
  var n = Qh(e);
  function r(i, o) {
    var s = n((i = yi(i)).r, (o = yi(o)).r), a = n(i.g, o.g), u = n(i.b, o.b), c = oa(i.opacity, o.opacity);
    return function(f) {
      return i.r = s(f), i.g = a(f), i.b = u(f), i.opacity = c(f), i + "";
    };
  }
  return r.gamma = t, r;
})(1);
function Ie(t, e) {
  return t = +t, e = +e, function(n) {
    return t * (1 - n) + e * n;
  };
}
var wi = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, ni = new RegExp(wi.source, "g");
function jh(t) {
  return function() {
    return t;
  };
}
function $h(t) {
  return function(e) {
    return t(e) + "";
  };
}
function td(t, e) {
  var n = wi.lastIndex = ni.lastIndex = 0, r, i, o, s = -1, a = [], u = [];
  for (t = t + "", e = e + ""; (r = wi.exec(t)) && (i = ni.exec(e)); )
    (o = i.index) > n && (o = e.slice(n, o), a[s] ? a[s] += o : a[++s] = o), (r = r[0]) === (i = i[0]) ? a[s] ? a[s] += i : a[++s] = i : (a[++s] = null, u.push({ i: s, x: Ie(r, i) })), n = ni.lastIndex;
  return n < e.length && (o = e.slice(n), a[s] ? a[s] += o : a[++s] = o), a.length < 2 ? u[0] ? $h(u[0].x) : jh(e) : (e = u.length, function(c) {
    for (var f = 0, d; f < e; ++f) a[(d = u[f]).i] = d.x(c);
    return a.join("");
  });
}
var To = 180 / Math.PI, xi = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function sa(t, e, n, r, i, o) {
  var s, a, u;
  return (s = Math.sqrt(t * t + e * e)) && (t /= s, e /= s), (u = t * n + e * r) && (n -= t * u, r -= e * u), (a = Math.sqrt(n * n + r * r)) && (n /= a, r /= a, u /= a), t * r < e * n && (t = -t, e = -e, u = -u, s = -s), {
    translateX: i,
    translateY: o,
    rotate: Math.atan2(e, t) * To,
    skewX: Math.atan(u) * To,
    scaleX: s,
    scaleY: a
  };
}
var yr;
function ed(t) {
  const e = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(t + "");
  return e.isIdentity ? xi : sa(e.a, e.b, e.c, e.d, e.e, e.f);
}
function nd(t) {
  return t == null || (yr || (yr = document.createElementNS("http://www.w3.org/2000/svg", "g")), yr.setAttribute("transform", t), !(t = yr.transform.baseVal.consolidate())) ? xi : (t = t.matrix, sa(t.a, t.b, t.c, t.d, t.e, t.f));
}
function aa(t, e, n, r) {
  function i(c) {
    return c.length ? c.pop() + " " : "";
  }
  function o(c, f, d, h, g, p) {
    if (c !== d || f !== h) {
      var _ = g.push("translate(", null, e, null, n);
      p.push({ i: _ - 4, x: Ie(c, d) }, { i: _ - 2, x: Ie(f, h) });
    } else (d || h) && g.push("translate(" + d + e + h + n);
  }
  function s(c, f, d, h) {
    c !== f ? (c - f > 180 ? f += 360 : f - c > 180 && (c += 360), h.push({ i: d.push(i(d) + "rotate(", null, r) - 2, x: Ie(c, f) })) : f && d.push(i(d) + "rotate(" + f + r);
  }
  function a(c, f, d, h) {
    c !== f ? h.push({ i: d.push(i(d) + "skewX(", null, r) - 2, x: Ie(c, f) }) : f && d.push(i(d) + "skewX(" + f + r);
  }
  function u(c, f, d, h, g, p) {
    if (c !== d || f !== h) {
      var _ = g.push(i(g) + "scale(", null, ",", null, ")");
      p.push({ i: _ - 4, x: Ie(c, d) }, { i: _ - 2, x: Ie(f, h) });
    } else (d !== 1 || h !== 1) && g.push(i(g) + "scale(" + d + "," + h + ")");
  }
  return function(c, f) {
    var d = [], h = [];
    return c = t(c), f = t(f), o(c.translateX, c.translateY, f.translateX, f.translateY, d, h), s(c.rotate, f.rotate, d, h), a(c.skewX, f.skewX, d, h), u(c.scaleX, c.scaleY, f.scaleX, f.scaleY, d, h), c = f = null, function(g) {
      for (var p = -1, _ = h.length, R; ++p < _; ) d[(R = h[p]).i] = R.x(g);
      return d.join("");
    };
  };
}
var rd = aa(ed, "px, ", "px)", "deg)"), id = aa(nd, ", ", ")", ")"), od = 1e-12;
function Co(t) {
  return ((t = Math.exp(t)) + 1 / t) / 2;
}
function sd(t) {
  return ((t = Math.exp(t)) - 1 / t) / 2;
}
function ad(t) {
  return ((t = Math.exp(2 * t)) - 1) / (t + 1);
}
const ld = (function t(e, n, r) {
  function i(o, s) {
    var a = o[0], u = o[1], c = o[2], f = s[0], d = s[1], h = s[2], g = f - a, p = d - u, _ = g * g + p * p, R, N;
    if (_ < od)
      N = Math.log(h / c) / e, R = function(A) {
        return [
          a + A * g,
          u + A * p,
          c * Math.exp(e * A * N)
        ];
      };
    else {
      var V = Math.sqrt(_), C = (h * h - c * c + r * _) / (2 * c * n * V), w = (h * h - c * c - r * _) / (2 * h * n * V), T = Math.log(Math.sqrt(C * C + 1) - C), k = Math.log(Math.sqrt(w * w + 1) - w);
      N = (k - T) / e, R = function(A) {
        var O = A * N, H = Co(T), X = c / (n * V) * (H * ad(e * O + T) - sd(T));
        return [
          a + X * g,
          u + X * p,
          c * H / Co(e * O + T)
        ];
      };
    }
    return R.duration = N * 1e3 * e / Math.SQRT2, R;
  }
  return i.rho = function(o) {
    var s = Math.max(1e-3, +o), a = s * s, u = a * a;
    return t(s, a, u);
  }, i;
})(Math.SQRT2, 2, 4);
var Fn = 0, qn = 0, Yn = 0, la = 1e3, Or, Un, Dr = 0, on = 0, Wr = 0, rr = typeof performance == "object" && performance.now ? performance : Date, ua = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(t) {
  setTimeout(t, 17);
};
function Ui() {
  return on || (ua(ud), on = rr.now() + Wr);
}
function ud() {
  on = 0;
}
function Yr() {
  this._call = this._time = this._next = null;
}
Yr.prototype = ca.prototype = {
  constructor: Yr,
  restart: function(t, e, n) {
    if (typeof t != "function") throw new TypeError("callback is not a function");
    n = (n == null ? Ui() : +n) + (e == null ? 0 : +e), !this._next && Un !== this && (Un ? Un._next = this : Or = this, Un = this), this._call = t, this._time = n, bi();
  },
  stop: function() {
    this._call && (this._call = null, this._time = 1 / 0, bi());
  }
};
function ca(t, e, n) {
  var r = new Yr();
  return r.restart(t, e, n), r;
}
function cd() {
  Ui(), ++Fn;
  for (var t = Or, e; t; )
    (e = on - t._time) >= 0 && t._call.call(void 0, e), t = t._next;
  --Fn;
}
function Ro() {
  on = (Dr = rr.now()) + Wr, Fn = qn = 0;
  try {
    cd();
  } finally {
    Fn = 0, hd(), on = 0;
  }
}
function fd() {
  var t = rr.now(), e = t - Dr;
  e > la && (Wr -= e, Dr = t);
}
function hd() {
  for (var t, e = Or, n, r = 1 / 0; e; )
    e._call ? (r > e._time && (r = e._time), t = e, e = e._next) : (n = e._next, e._next = null, e = t ? t._next = n : Or = n);
  Un = t, bi(r);
}
function bi(t) {
  if (!Fn) {
    qn && (qn = clearTimeout(qn));
    var e = t - on;
    e > 24 ? (t < 1 / 0 && (qn = setTimeout(Ro, t - rr.now() - Wr)), Yn && (Yn = clearInterval(Yn))) : (Yn || (Dr = rr.now(), Yn = setInterval(fd, la)), Fn = 1, ua(Ro));
  }
}
function Lo(t, e, n) {
  var r = new Yr();
  return e = e == null ? 0 : +e, r.restart((i) => {
    r.stop(), t(i + e);
  }, e, n), r;
}
var dd = Ur("start", "end", "cancel", "interrupt"), gd = [], fa = 0, Fo = 1, ki = 2, Nr = 3, Oo = 4, Ei = 5, Mr = 6;
function Kr(t, e, n, r, i, o) {
  var s = t.__transition;
  if (!s) t.__transition = {};
  else if (n in s) return;
  vd(t, n, {
    name: e,
    index: r,
    // For context during callback.
    group: i,
    // For context during callback.
    on: dd,
    tween: gd,
    time: o.time,
    delay: o.delay,
    duration: o.duration,
    ease: o.ease,
    timer: null,
    state: fa
  });
}
function Gi(t, e) {
  var n = ee(t, e);
  if (n.state > fa) throw new Error("too late; already scheduled");
  return n;
}
function fe(t, e) {
  var n = ee(t, e);
  if (n.state > Nr) throw new Error("too late; already running");
  return n;
}
function ee(t, e) {
  var n = t.__transition;
  if (!n || !(n = n[e])) throw new Error("transition not found");
  return n;
}
function vd(t, e, n) {
  var r = t.__transition, i;
  r[e] = n, n.timer = ca(o, 0, n.time);
  function o(c) {
    n.state = Fo, n.timer.restart(s, n.delay, n.time), n.delay <= c && s(c - n.delay);
  }
  function s(c) {
    var f, d, h, g;
    if (n.state !== Fo) return u();
    for (f in r)
      if (g = r[f], g.name === n.name) {
        if (g.state === Nr) return Lo(s);
        g.state === Oo ? (g.state = Mr, g.timer.stop(), g.on.call("interrupt", t, t.__data__, g.index, g.group), delete r[f]) : +f < e && (g.state = Mr, g.timer.stop(), g.on.call("cancel", t, t.__data__, g.index, g.group), delete r[f]);
      }
    if (Lo(function() {
      n.state === Nr && (n.state = Oo, n.timer.restart(a, n.delay, n.time), a(c));
    }), n.state = ki, n.on.call("start", t, t.__data__, n.index, n.group), n.state === ki) {
      for (n.state = Nr, i = new Array(h = n.tween.length), f = 0, d = -1; f < h; ++f)
        (g = n.tween[f].value.call(t, t.__data__, n.index, n.group)) && (i[++d] = g);
      i.length = d + 1;
    }
  }
  function a(c) {
    for (var f = c < n.duration ? n.ease.call(null, c / n.duration) : (n.timer.restart(u), n.state = Ei, 1), d = -1, h = i.length; ++d < h; )
      i[d].call(t, f);
    n.state === Ei && (n.on.call("end", t, t.__data__, n.index, n.group), u());
  }
  function u() {
    n.state = Mr, n.timer.stop(), delete r[e];
    for (var c in r) return;
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
      i = r.state > ki && r.state < Ei, r.state = Mr, r.timer.stop(), r.on.call(i ? "interrupt" : "cancel", t, t.__data__, r.index, r.group), delete n[s];
    }
    o && delete t.__transition;
  }
}
function md(t) {
  return this.each(function() {
    Ar(this, t);
  });
}
function pd(t, e) {
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
function _d(t, e, n) {
  var r, i;
  if (typeof n != "function") throw new Error();
  return function() {
    var o = fe(this, t), s = o.tween;
    if (s !== r) {
      i = (r = s).slice();
      for (var a = { name: e, value: n }, u = 0, c = i.length; u < c; ++u)
        if (i[u].name === e) {
          i[u] = a;
          break;
        }
      u === c && i.push(a);
    }
    o.tween = i;
  };
}
function yd(t, e) {
  var n = this._id;
  if (t += "", arguments.length < 2) {
    for (var r = ee(this.node(), n).tween, i = 0, o = r.length, s; i < o; ++i)
      if ((s = r[i]).name === t)
        return s.value;
    return null;
  }
  return this.each((e == null ? pd : _d)(n, t, e));
}
function Wi(t, e, n) {
  var r = t._id;
  return t.each(function() {
    var i = fe(this, r);
    (i.value || (i.value = {}))[e] = n.apply(this, arguments);
  }), function(i) {
    return ee(i, r).value[e];
  };
}
function ha(t, e) {
  var n;
  return (typeof e == "number" ? Ie : e instanceof nr ? zo : (n = nr(e)) ? (e = n, zo) : td)(t, e);
}
function wd(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function xd(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function bd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttribute(t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function kd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttributeNS(t.space, t.local);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function Ed(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttribute(t) : (s = this.getAttribute(t), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function Sd(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttributeNS(t.space, t.local) : (s = this.getAttributeNS(t.space, t.local), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function Nd(t, e) {
  var n = Gr(t), r = n === "transform" ? id : ha;
  return this.attrTween(t, typeof e == "function" ? (n.local ? Sd : Ed)(n, r, Wi(this, "attr." + t, e)) : e == null ? (n.local ? xd : wd)(n) : (n.local ? kd : bd)(n, r, e));
}
function Md(t, e) {
  return function(n) {
    this.setAttribute(t, e.call(this, n));
  };
}
function Ad(t, e) {
  return function(n) {
    this.setAttributeNS(t.space, t.local, e.call(this, n));
  };
}
function Pd(t, e) {
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
    return o !== r && (n = (r = o) && Md(t, o)), n;
  }
  return i._value = e, i;
}
function zd(t, e) {
  var n = "attr." + t;
  if (arguments.length < 2) return (n = this.tween(n)) && n._value;
  if (e == null) return this.tween(n, null);
  if (typeof e != "function") throw new Error();
  var r = Gr(t);
  return this.tween(n, (r.local ? Pd : Id)(r, e));
}
function Td(t, e) {
  return function() {
    Gi(this, t).delay = +e.apply(this, arguments);
  };
}
function Cd(t, e) {
  return e = +e, function() {
    Gi(this, t).delay = e;
  };
}
function Rd(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Td : Cd)(e, t)) : ee(this.node(), e).delay;
}
function Ld(t, e) {
  return function() {
    fe(this, t).duration = +e.apply(this, arguments);
  };
}
function Fd(t, e) {
  return e = +e, function() {
    fe(this, t).duration = e;
  };
}
function Od(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Ld : Fd)(e, t)) : ee(this.node(), e).duration;
}
function Dd(t, e) {
  if (typeof e != "function") throw new Error();
  return function() {
    fe(this, t).ease = e;
  };
}
function Yd(t) {
  var e = this._id;
  return arguments.length ? this.each(Dd(e, t)) : ee(this.node(), e).ease;
}
function Hd(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    if (typeof n != "function") throw new Error();
    fe(this, t).ease = n;
  };
}
function Bd(t) {
  if (typeof t != "function") throw new Error();
  return this.each(Hd(this._id, t));
}
function Vd(t) {
  typeof t != "function" && (t = qs(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, c = 0; c < s; ++c)
      (u = o[c]) && t.call(u, u.__data__, c, o) && a.push(u);
  return new xe(r, this._parents, this._name, this._id);
}
function Xd(t) {
  if (t._id !== this._id) throw new Error();
  for (var e = this._groups, n = t._groups, r = e.length, i = n.length, o = Math.min(r, i), s = new Array(r), a = 0; a < o; ++a)
    for (var u = e[a], c = n[a], f = u.length, d = s[a] = new Array(f), h, g = 0; g < f; ++g)
      (h = u[g] || c[g]) && (d[g] = h);
  for (; a < r; ++a)
    s[a] = e[a];
  return new xe(s, this._parents, this._name, this._id);
}
function qd(t) {
  return (t + "").trim().split(/^|\s+/).every(function(e) {
    var n = e.indexOf(".");
    return n >= 0 && (e = e.slice(0, n)), !e || e === "start";
  });
}
function Ud(t, e, n) {
  var r, i, o = qd(e) ? Gi : fe;
  return function() {
    var s = o(this, t), a = s.on;
    a !== r && (i = (r = a).copy()).on(e, n), s.on = i;
  };
}
function Gd(t, e) {
  var n = this._id;
  return arguments.length < 2 ? ee(this.node(), n).on.on(t) : this.each(Ud(n, t, e));
}
function Wd(t) {
  return function() {
    var e = this.parentNode;
    for (var n in this.__transition) if (+n !== t) return;
    e && e.removeChild(this);
  };
}
function Kd() {
  return this.on("end.remove", Wd(this._id));
}
function Zd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Vi(t));
  for (var r = this._groups, i = r.length, o = new Array(i), s = 0; s < i; ++s)
    for (var a = r[s], u = a.length, c = o[s] = new Array(u), f, d, h = 0; h < u; ++h)
      (f = a[h]) && (d = t.call(f, f.__data__, h, a)) && ("__data__" in f && (d.__data__ = f.__data__), c[h] = d, Kr(c[h], e, n, h, c, ee(f, n)));
  return new xe(o, this._parents, e, n);
}
function Jd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Xs(t));
  for (var r = this._groups, i = r.length, o = [], s = [], a = 0; a < i; ++a)
    for (var u = r[a], c = u.length, f, d = 0; d < c; ++d)
      if (f = u[d]) {
        for (var h = t.call(f, f.__data__, d, u), g, p = ee(f, n), _ = 0, R = h.length; _ < R; ++_)
          (g = h[_]) && Kr(g, e, n, _, h, p);
        o.push(h), s.push(f);
      }
  return new xe(o, s, e, n);
}
var Qd = cr.prototype.constructor;
function jd() {
  return new Qd(this._groups, this._parents);
}
function $d(t, e) {
  var n, r, i;
  return function() {
    var o = Ln(this, t), s = (this.style.removeProperty(t), Ln(this, t));
    return o === s ? null : o === n && s === r ? i : i = e(n = o, r = s);
  };
}
function da(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function t0(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = Ln(this, t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function e0(t, e, n) {
  var r, i, o;
  return function() {
    var s = Ln(this, t), a = n(this), u = a + "";
    return a == null && (u = a = (this.style.removeProperty(t), Ln(this, t))), s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a));
  };
}
function n0(t, e) {
  var n, r, i, o = "style." + e, s = "end." + o, a;
  return function() {
    var u = fe(this, t), c = u.on, f = u.value[o] == null ? a || (a = da(e)) : void 0;
    (c !== n || i !== f) && (r = (n = c).copy()).on(s, i = f), u.on = r;
  };
}
function r0(t, e, n) {
  var r = (t += "") == "transform" ? rd : ha;
  return e == null ? this.styleTween(t, $d(t, r)).on("end.style." + t, da(t)) : typeof e == "function" ? this.styleTween(t, e0(t, r, Wi(this, "style." + t, e))).each(n0(this._id, t)) : this.styleTween(t, t0(t, r, e), n).on("end.style." + t, null);
}
function i0(t, e, n) {
  return function(r) {
    this.style.setProperty(t, e.call(this, r), n);
  };
}
function o0(t, e, n) {
  var r, i;
  function o() {
    var s = e.apply(this, arguments);
    return s !== i && (r = (i = s) && i0(t, s, n)), r;
  }
  return o._value = e, o;
}
function s0(t, e, n) {
  var r = "style." + (t += "");
  if (arguments.length < 2) return (r = this.tween(r)) && r._value;
  if (e == null) return this.tween(r, null);
  if (typeof e != "function") throw new Error();
  return this.tween(r, o0(t, e, n ?? ""));
}
function a0(t) {
  return function() {
    this.textContent = t;
  };
}
function l0(t) {
  return function() {
    var e = t(this);
    this.textContent = e ?? "";
  };
}
function u0(t) {
  return this.tween("text", typeof t == "function" ? l0(Wi(this, "text", t)) : a0(t == null ? "" : t + ""));
}
function c0(t) {
  return function(e) {
    this.textContent = t.call(this, e);
  };
}
function f0(t) {
  var e, n;
  function r() {
    var i = t.apply(this, arguments);
    return i !== n && (e = (n = i) && c0(i)), e;
  }
  return r._value = t, r;
}
function h0(t) {
  var e = "text";
  if (arguments.length < 1) return (e = this.tween(e)) && e._value;
  if (t == null) return this.tween(e, null);
  if (typeof t != "function") throw new Error();
  return this.tween(e, f0(t));
}
function d0() {
  for (var t = this._name, e = this._id, n = ga(), r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, c = 0; c < a; ++c)
      if (u = s[c]) {
        var f = ee(u, e);
        Kr(u, t, n, c, s, {
          time: f.time + f.delay + f.duration,
          delay: 0,
          duration: f.duration,
          ease: f.ease
        });
      }
  return new xe(r, this._parents, t, n);
}
function g0() {
  var t, e, n = this, r = n._id, i = n.size();
  return new Promise(function(o, s) {
    var a = { value: s }, u = { value: function() {
      --i === 0 && o();
    } };
    n.each(function() {
      var c = fe(this, r), f = c.on;
      f !== t && (e = (t = f).copy(), e._.cancel.push(a), e._.interrupt.push(a), e._.end.push(u)), c.on = e;
    }), i === 0 && o();
  });
}
var v0 = 0;
function xe(t, e, n, r) {
  this._groups = t, this._parents = e, this._name = n, this._id = r;
}
function ga() {
  return ++v0;
}
var de = cr.prototype;
xe.prototype = {
  constructor: xe,
  select: Zd,
  selectAll: Jd,
  selectChild: de.selectChild,
  selectChildren: de.selectChildren,
  filter: Vd,
  merge: Xd,
  selection: jd,
  transition: d0,
  call: de.call,
  nodes: de.nodes,
  node: de.node,
  size: de.size,
  empty: de.empty,
  each: de.each,
  on: Gd,
  attr: Nd,
  attrTween: zd,
  style: r0,
  styleTween: s0,
  text: u0,
  textTween: h0,
  remove: Kd,
  tween: yd,
  delay: Rd,
  duration: Od,
  ease: Yd,
  easeVarying: Bd,
  end: g0,
  [Symbol.iterator]: de[Symbol.iterator]
};
function m0(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}
var p0 = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: m0
};
function _0(t, e) {
  for (var n; !(n = t.__transition) || !(n = n[e]); )
    if (!(t = t.parentNode))
      throw new Error(`transition ${e} not found`);
  return n;
}
function y0(t) {
  var e, n;
  t instanceof xe ? (e = t._id, t = t._name) : (e = ga(), (n = p0).time = Ui(), t = t == null ? null : t + "");
  for (var r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, c = 0; c < a; ++c)
      (u = s[c]) && Kr(u, t, e, c, s, n || _0(u, e));
  return new xe(r, this._parents, t, e);
}
cr.prototype.interrupt = md;
cr.prototype.transition = y0;
const wr = (t) => () => t;
function w0(t, {
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
var va = new _e(1, 0, 0);
_e.prototype;
function ri(t) {
  t.stopImmediatePropagation();
}
function Hn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function x0(t) {
  return (!t.ctrlKey || t.type === "wheel") && !t.button;
}
function b0() {
  var t = this;
  return t instanceof SVGElement ? (t = t.ownerSVGElement || t, t.hasAttribute("viewBox") ? (t = t.viewBox.baseVal, [[t.x, t.y], [t.x + t.width, t.y + t.height]]) : [[0, 0], [t.width.baseVal.value, t.height.baseVal.value]]) : [[0, 0], [t.clientWidth, t.clientHeight]];
}
function Do() {
  return this.__zoom || va;
}
function k0(t) {
  return -t.deltaY * (t.deltaMode === 1 ? 0.05 : t.deltaMode ? 1 : 2e-3) * (t.ctrlKey ? 10 : 1);
}
function E0() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function S0(t, e, n) {
  var r = t.invertX(e[0][0]) - n[0][0], i = t.invertX(e[1][0]) - n[1][0], o = t.invertY(e[0][1]) - n[0][1], s = t.invertY(e[1][1]) - n[1][1];
  return t.translate(
    i > r ? (r + i) / 2 : Math.min(0, r) || Math.max(0, i),
    s > o ? (o + s) / 2 : Math.min(0, o) || Math.max(0, s)
  );
}
function N0() {
  var t = x0, e = b0, n = S0, r = k0, i = E0, o = [0, 1 / 0], s = [[-1 / 0, -1 / 0], [1 / 0, 1 / 0]], a = 250, u = ld, c = Ur("start", "zoom", "end"), f, d, h, g = 500, p = 150, _ = 0, R = 10;
  function N(m) {
    m.property("__zoom", Do).on("wheel.zoom", O, { passive: !1 }).on("mousedown.zoom", H).on("dblclick.zoom", X).filter(i).on("touchstart.zoom", G).on("touchmove.zoom", rt).on("touchend.zoom touchcancel.zoom", D).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  N.transform = function(m, S, x, I) {
    var L = m.selection ? m.selection() : m;
    L.property("__zoom", Do), m !== L ? T(m, S, x, I) : L.interrupt().each(function() {
      k(this, arguments).event(I).start().zoom(null, typeof S == "function" ? S.apply(this, arguments) : S).end();
    });
  }, N.scaleBy = function(m, S, x, I) {
    N.scaleTo(m, function() {
      var L = this.__zoom.k, E = typeof S == "function" ? S.apply(this, arguments) : S;
      return L * E;
    }, x, I);
  }, N.scaleTo = function(m, S, x, I) {
    N.transform(m, function() {
      var L = e.apply(this, arguments), E = this.__zoom, b = x == null ? w(L) : typeof x == "function" ? x.apply(this, arguments) : x, P = E.invert(b), z = typeof S == "function" ? S.apply(this, arguments) : S;
      return n(C(V(E, z), b, P), L, s);
    }, x, I);
  }, N.translateBy = function(m, S, x, I) {
    N.transform(m, function() {
      return n(this.__zoom.translate(
        typeof S == "function" ? S.apply(this, arguments) : S,
        typeof x == "function" ? x.apply(this, arguments) : x
      ), e.apply(this, arguments), s);
    }, null, I);
  }, N.translateTo = function(m, S, x, I, L) {
    N.transform(m, function() {
      var E = e.apply(this, arguments), b = this.__zoom, P = I == null ? w(E) : typeof I == "function" ? I.apply(this, arguments) : I;
      return n(va.translate(P[0], P[1]).scale(b.k).translate(
        typeof S == "function" ? -S.apply(this, arguments) : -S,
        typeof x == "function" ? -x.apply(this, arguments) : -x
      ), E, s);
    }, I, L);
  };
  function V(m, S) {
    return S = Math.max(o[0], Math.min(o[1], S)), S === m.k ? m : new _e(S, m.x, m.y);
  }
  function C(m, S, x) {
    var I = S[0] - x[0] * m.k, L = S[1] - x[1] * m.k;
    return I === m.x && L === m.y ? m : new _e(m.k, I, L);
  }
  function w(m) {
    return [(+m[0][0] + +m[1][0]) / 2, (+m[0][1] + +m[1][1]) / 2];
  }
  function T(m, S, x, I) {
    m.on("start.zoom", function() {
      k(this, arguments).event(I).start();
    }).on("interrupt.zoom end.zoom", function() {
      k(this, arguments).event(I).end();
    }).tween("zoom", function() {
      var L = this, E = arguments, b = k(L, E).event(I), P = e.apply(L, E), z = x == null ? w(P) : typeof x == "function" ? x.apply(L, E) : x, U = Math.max(P[1][0] - P[0][0], P[1][1] - P[0][1]), q = L.__zoom, W = typeof S == "function" ? S.apply(L, E) : S, it = u(q.invert(z).concat(U / q.k), W.invert(z).concat(U / W.k));
      return function(M) {
        if (M === 1) M = W;
        else {
          var F = it(M), Z = U / F[2];
          M = new _e(Z, z[0] - F[0] * Z, z[1] - F[1] * Z);
        }
        b.zoom(null, M);
      };
    });
  }
  function k(m, S, x) {
    return !x && m.__zooming || new A(m, S);
  }
  function A(m, S) {
    this.that = m, this.args = S, this.active = 0, this.sourceEvent = null, this.extent = e.apply(m, S), this.taps = 0;
  }
  A.prototype = {
    event: function(m) {
      return m && (this.sourceEvent = m), this;
    },
    start: function() {
      return ++this.active === 1 && (this.that.__zooming = this, this.emit("start")), this;
    },
    zoom: function(m, S) {
      return this.mouse && m !== "mouse" && (this.mouse[1] = S.invert(this.mouse[0])), this.touch0 && m !== "touch" && (this.touch0[1] = S.invert(this.touch0[0])), this.touch1 && m !== "touch" && (this.touch1[1] = S.invert(this.touch1[0])), this.that.__zoom = S, this.emit("zoom"), this;
    },
    end: function() {
      return --this.active === 0 && (delete this.that.__zooming, this.emit("end")), this;
    },
    emit: function(m) {
      var S = Tt(this.that).datum();
      c.call(
        m,
        this.that,
        new w0(m, {
          sourceEvent: this.sourceEvent,
          target: N,
          transform: this.that.__zoom,
          dispatch: c
        }),
        S
      );
    }
  };
  function O(m, ...S) {
    if (!t.apply(this, arguments)) return;
    var x = k(this, S).event(m), I = this.__zoom, L = Math.max(o[0], Math.min(o[1], I.k * Math.pow(2, r.apply(this, arguments)))), E = ve(m);
    if (x.wheel)
      (x.mouse[0][0] !== E[0] || x.mouse[0][1] !== E[1]) && (x.mouse[1] = I.invert(x.mouse[0] = E)), clearTimeout(x.wheel);
    else {
      if (I.k === L) return;
      x.mouse = [E, I.invert(E)], Ar(this), x.start();
    }
    Hn(m), x.wheel = setTimeout(b, p), x.zoom("mouse", n(C(V(I, L), x.mouse[0], x.mouse[1]), x.extent, s));
    function b() {
      x.wheel = null, x.end();
    }
  }
  function H(m, ...S) {
    if (h || !t.apply(this, arguments)) return;
    var x = m.currentTarget, I = k(this, S, !0).event(m), L = Tt(m.view).on("mousemove.zoom", z, !0).on("mouseup.zoom", U, !0), E = ve(m, x), b = m.clientX, P = m.clientY;
    ta(m.view), ri(m), I.mouse = [E, this.__zoom.invert(E)], Ar(this), I.start();
    function z(q) {
      if (Hn(q), !I.moved) {
        var W = q.clientX - b, it = q.clientY - P;
        I.moved = W * W + it * it > _;
      }
      I.event(q).zoom("mouse", n(C(I.that.__zoom, I.mouse[0] = ve(q, x), I.mouse[1]), I.extent, s));
    }
    function U(q) {
      L.on("mousemove.zoom mouseup.zoom", null), ea(q.view, I.moved), Hn(q), I.event(q).end();
    }
  }
  function X(m, ...S) {
    if (t.apply(this, arguments)) {
      var x = this.__zoom, I = ve(m.changedTouches ? m.changedTouches[0] : m, this), L = x.invert(I), E = x.k * (m.shiftKey ? 0.5 : 2), b = n(C(V(x, E), I, L), e.apply(this, S), s);
      Hn(m), a > 0 ? Tt(this).transition().duration(a).call(T, b, I, m) : Tt(this).call(N.transform, b, I, m);
    }
  }
  function G(m, ...S) {
    if (t.apply(this, arguments)) {
      var x = m.touches, I = x.length, L = k(this, S, m.changedTouches.length === I).event(m), E, b, P, z;
      for (ri(m), b = 0; b < I; ++b)
        P = x[b], z = ve(P, this), z = [z, this.__zoom.invert(z), P.identifier], L.touch0 ? !L.touch1 && L.touch0[2] !== z[2] && (L.touch1 = z, L.taps = 0) : (L.touch0 = z, E = !0, L.taps = 1 + !!f);
      f && (f = clearTimeout(f)), E && (L.taps < 2 && (d = z[0], f = setTimeout(function() {
        f = null;
      }, g)), Ar(this), L.start());
    }
  }
  function rt(m, ...S) {
    if (this.__zooming) {
      var x = k(this, S).event(m), I = m.changedTouches, L = I.length, E, b, P, z;
      for (Hn(m), E = 0; E < L; ++E)
        b = I[E], P = ve(b, this), x.touch0 && x.touch0[2] === b.identifier ? x.touch0[0] = P : x.touch1 && x.touch1[2] === b.identifier && (x.touch1[0] = P);
      if (b = x.that.__zoom, x.touch1) {
        var U = x.touch0[0], q = x.touch0[1], W = x.touch1[0], it = x.touch1[1], M = (M = W[0] - U[0]) * M + (M = W[1] - U[1]) * M, F = (F = it[0] - q[0]) * F + (F = it[1] - q[1]) * F;
        b = V(b, Math.sqrt(M / F)), P = [(U[0] + W[0]) / 2, (U[1] + W[1]) / 2], z = [(q[0] + it[0]) / 2, (q[1] + it[1]) / 2];
      } else if (x.touch0) P = x.touch0[0], z = x.touch0[1];
      else return;
      x.zoom("touch", n(C(b, P, z), x.extent, s));
    }
  }
  function D(m, ...S) {
    if (this.__zooming) {
      var x = k(this, S).event(m), I = m.changedTouches, L = I.length, E, b;
      for (ri(m), h && clearTimeout(h), h = setTimeout(function() {
        h = null;
      }, g), E = 0; E < L; ++E)
        b = I[E], x.touch0 && x.touch0[2] === b.identifier ? delete x.touch0 : x.touch1 && x.touch1[2] === b.identifier && delete x.touch1;
      if (x.touch1 && !x.touch0 && (x.touch0 = x.touch1, delete x.touch1), x.touch0) x.touch0[1] = this.__zoom.invert(x.touch0[0]);
      else if (x.end(), x.taps === 2 && (b = ve(b, this), Math.hypot(d[0] - b[0], d[1] - b[1]) < R)) {
        var P = Tt(this).on("dblclick.zoom");
        P && P.apply(this, arguments);
      }
    }
  }
  return N.wheelDelta = function(m) {
    return arguments.length ? (r = typeof m == "function" ? m : wr(+m), N) : r;
  }, N.filter = function(m) {
    return arguments.length ? (t = typeof m == "function" ? m : wr(!!m), N) : t;
  }, N.touchable = function(m) {
    return arguments.length ? (i = typeof m == "function" ? m : wr(!!m), N) : i;
  }, N.extent = function(m) {
    return arguments.length ? (e = typeof m == "function" ? m : wr([[+m[0][0], +m[0][1]], [+m[1][0], +m[1][1]]]), N) : e;
  }, N.scaleExtent = function(m) {
    return arguments.length ? (o[0] = +m[0], o[1] = +m[1], N) : [o[0], o[1]];
  }, N.translateExtent = function(m) {
    return arguments.length ? (s[0][0] = +m[0][0], s[1][0] = +m[1][0], s[0][1] = +m[0][1], s[1][1] = +m[1][1], N) : [[s[0][0], s[0][1]], [s[1][0], s[1][1]]];
  }, N.constrain = function(m) {
    return arguments.length ? (n = m, N) : n;
  }, N.duration = function(m) {
    return arguments.length ? (a = +m, N) : a;
  }, N.interpolate = function(m) {
    return arguments.length ? (u = m, N) : u;
  }, N.on = function() {
    var m = c.on.apply(c, arguments);
    return m === c ? N : m;
  }, N.clickDistance = function(m) {
    return arguments.length ? (_ = (m = +m) * m, N) : Math.sqrt(_);
  }, N.tapDistance = function(m) {
    return arguments.length ? (R = +m, N) : R;
  }, N;
}
function M0(t) {
  if (t.length === 0) return "";
  const [e, ...n] = t;
  if (!e) return "";
  let r = `M ${e.x} ${e.y}`;
  for (const i of n)
    r += ` L ${i.x} ${i.y}`;
  return r;
}
const Bn = 12;
function A0(t) {
  const e = t.absolutePosition.x, n = t.absolutePosition.y;
  switch (t.side) {
    case "top":
      return { x: e, y: n - Bn, textAnchor: "middle" };
    case "bottom":
      return { x: e, y: n + Bn + 4, textAnchor: "middle" };
    case "left":
      return { x: e - Bn, y: n, textAnchor: "end" };
    case "right":
      return { x: e + Bn, y: n, textAnchor: "start" };
    default:
      return { x: e, y: n - Bn, textAnchor: "middle" };
  }
}
const Yo = [
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
function P0(t) {
  if (!t || t.length === 0) return;
  const e = t.reduce((n, r) => n + r, 0);
  return Yo[e % Yo.length];
}
var I0 = /* @__PURE__ */ lt('<path fill="none" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke="white" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke-linecap="round" pointer-events="none"></path>', 1), z0 = /* @__PURE__ */ lt('<path class="link" fill="none" stroke-linecap="round" pointer-events="none"></path>'), T0 = /* @__PURE__ */ lt('<text class="link-label" text-anchor="middle"> </text>'), C0 = /* @__PURE__ */ lt('<text class="link-label" text-anchor="middle"> </text>'), R0 = /* @__PURE__ */ lt("<!><!>", 1), L0 = /* @__PURE__ */ lt('<g class="link-group"><!><path fill="none" stroke="transparent" stroke-linecap="round" class="link-hit"></path><!></g>');
function F0(t, e) {
  an(e, !0);
  let n = kt(e, "selected", 3, !1), r = kt(e, "interactive", 3, !1);
  const i = /* @__PURE__ */ Y(() => M0(e.edge.points)), o = /* @__PURE__ */ Y(() => e.edge.link), s = /* @__PURE__ */ Y(() => {
    var k;
    return ((k = l(o)) == null ? void 0 : k.type) ?? "solid";
  }), a = /* @__PURE__ */ Y(() => () => {
    var k, A;
    switch (l(s)) {
      case "dashed":
        return "5 3";
      default:
        return ((A = (k = l(o)) == null ? void 0 : k.style) == null ? void 0 : A.strokeDasharray) ?? "";
    }
  }), u = /* @__PURE__ */ Y(() => {
    var k, A, O;
    return n() ? e.colors.selection : ((A = (k = l(o)) == null ? void 0 : k.style) == null ? void 0 : A.stroke) ?? P0((O = l(o)) == null ? void 0 : O.vlan) ?? e.colors.linkStroke;
  }), c = /* @__PURE__ */ Y(() => l(s) === "double"), f = /* @__PURE__ */ Y(() => () => {
    var A;
    return (A = l(o)) != null && A.label ? [Array.isArray(l(o).label) ? l(o).label.join(" / ") : l(o).label] : [];
  }), d = /* @__PURE__ */ Y(() => () => {
    var k;
    return !((k = l(o)) != null && k.vlan) || l(o).vlan.length === 0 ? "" : l(o).vlan.length === 1 ? `VLAN ${l(o).vlan[0]}` : `VLAN ${l(o).vlan.join(", ")}`;
  }), h = /* @__PURE__ */ Y(() => () => {
    if (e.edge.points.length < 2) return null;
    const k = Math.floor(e.edge.points.length / 2), A = e.edge.points[k - 1], O = e.edge.points[k];
    return !A || !O ? null : { x: (A.x + O.x) / 2, y: (A.y + O.y) / 2 };
  });
  function g(k) {
    var A;
    r() && (k.stopPropagation(), (A = e.onselect) == null || A.call(e, e.edge.id));
  }
  function p(k) {
    var A, O;
    r() && (k.preventDefault(), k.stopPropagation(), (A = e.onselect) == null || A.call(e, e.edge.id), (O = e.oncontextmenu) == null || O.call(e, e.edge.id, k));
  }
  var _ = L0(), R = dt(_);
  {
    var N = (k) => {
      const A = /* @__PURE__ */ Y(() => Math.max(3, Math.round(e.edge.width * 0.9)));
      var O = I0(), H = It(O), X = et(H), G = et(X);
      at(
        (rt, D) => {
          v(H, "d", l(i)), v(H, "stroke", l(u)), v(H, "stroke-width", e.edge.width + l(A) * 2), v(X, "d", l(i)), v(X, "stroke-width", rt), v(G, "d", l(i)), v(G, "stroke", l(u)), v(G, "stroke-width", D);
        },
        [
          () => Math.max(1, e.edge.width),
          () => Math.max(1, e.edge.width - Math.round(l(A) * 0.8))
        ]
      ), $(k, O);
    }, V = (k) => {
      var A = z0();
      at(
        (O) => {
          v(A, "d", l(i)), v(A, "stroke", l(u)), v(A, "stroke-width", e.edge.width), v(A, "stroke-dasharray", O);
        },
        [() => l(a)() || void 0]
      ), $(k, A);
    };
    _t(R, (k) => {
      l(c) ? k(N) : k(V, !1);
    });
  }
  var C = et(R);
  C.__click = g, C.__contextmenu = p;
  var w = et(C);
  {
    var T = (k) => {
      const A = /* @__PURE__ */ Y(() => l(h)());
      var O = ge(), H = It(O);
      {
        var X = (G) => {
          const rt = /* @__PURE__ */ Y(() => l(f)()), D = /* @__PURE__ */ Y(() => l(d)());
          var m = R0(), S = It(m);
          Ve(S, 17, () => l(rt), As, (L, E, b) => {
            var P = T0(), z = dt(P);
            at(() => {
              v(P, "x", l(A).x), v(P, "y", l(A).y - 8 + b * 12), Qn(z, l(E));
            }), $(L, P);
          });
          var x = et(S);
          {
            var I = (L) => {
              var E = C0(), b = dt(E);
              at(() => {
                v(E, "x", l(A).x), v(E, "y", l(A).y - 8 + l(rt).length * 12), Qn(b, l(D));
              }), $(L, E);
            };
            _t(x, (L) => {
              l(D) && L(I);
            });
          }
          $(G, m);
        };
        _t(H, (G) => {
          l(A) && G(X);
        });
      }
      $(k, O);
    };
    _t(w, (k) => {
      l(h)() && k(T);
    });
  }
  at(
    (k) => {
      v(_, "data-link-id", e.edge.id), v(C, "d", l(i)), v(C, "stroke-width", k);
    },
    [() => Math.max(e.edge.width + 12, 16)]
  ), $(t, _), ln();
}
ur(["click", "contextmenu"]);
var O0 = /* @__PURE__ */ lt('<line stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"></line>');
function D0(t, e) {
  var n = O0();
  at(() => {
    v(n, "x1", e.fromX), v(n, "y1", e.fromY), v(n, "x2", e.toX), v(n, "y2", e.toY);
  }), $(t, n);
}
var Y0 = /* @__PURE__ */ lt('<rect rx="8" ry="8"></rect>'), H0 = /* @__PURE__ */ lt("<rect></rect>"), B0 = /* @__PURE__ */ lt("<circle></circle>"), V0 = /* @__PURE__ */ lt("<polygon></polygon>"), X0 = /* @__PURE__ */ lt("<polygon></polygon>"), q0 = /* @__PURE__ */ lt('<g><ellipse></ellipse><rect stroke="none"></rect><line></line><line></line><ellipse></ellipse></g>'), U0 = /* @__PURE__ */ lt("<rect></rect>"), G0 = /* @__PURE__ */ lt("<polygon></polygon>"), W0 = /* @__PURE__ */ lt('<rect rx="8" ry="8"></rect>'), K0 = /* @__PURE__ */ lt('<g class="node-icon"><svg viewBox="0 0 24 24" fill="currentColor"><!></svg></g>'), Z0 = /* @__PURE__ */ lt('<text text-anchor="middle"> </text>'), J0 = /* @__PURE__ */ lt('<rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect>', 1), Q0 = /* @__PURE__ */ lt('<circle r="7" fill="#3b82f6" opacity="0.8" pointer-events="none"></circle><text text-anchor="middle" dominant-baseline="central" font-size="11" fill="white" pointer-events="none">+</text>', 1), j0 = /* @__PURE__ */ lt('<g class="node"><g class="node-bg"><!></g><g class="node-fg" pointer-events="none"><!><!></g><!><!></g>');
function $0(t, e) {
  an(e, !0);
  let n = kt(e, "shadowFilterId", 3, "node-shadow"), r = kt(e, "selected", 3, !1), i = kt(e, "interactive", 3, !1);
  const o = /* @__PURE__ */ Y(() => e.node.position.x), s = /* @__PURE__ */ Y(() => e.node.position.y), a = /* @__PURE__ */ Y(() => e.node.size.width / 2), u = /* @__PURE__ */ Y(() => e.node.size.height / 2), c = /* @__PURE__ */ Y(() => e.node.node.shape ?? "rounded");
  let f = /* @__PURE__ */ ct(!1);
  const d = /* @__PURE__ */ Y(() => r() || l(f)), h = /* @__PURE__ */ Y(() => {
    var M;
    return ((M = e.node.node.style) == null ? void 0 : M.fill) ?? (l(d) ? e.colors.nodeHoverFill : e.colors.nodeFill);
  }), g = /* @__PURE__ */ Y(() => {
    var M;
    return r() ? e.colors.selection : ((M = e.node.node.style) == null ? void 0 : M.stroke) ?? (l(f) ? e.colors.nodeHoverStroke : e.colors.nodeStroke);
  }), p = /* @__PURE__ */ Y(() => {
    var M;
    return r() ? 2.5 : ((M = e.node.node.style) == null ? void 0 : M.strokeWidth) ?? (l(f) ? 2 : 1.5);
  }), _ = /* @__PURE__ */ Y(() => {
    var M;
    return ((M = e.node.node.style) == null ? void 0 : M.strokeDasharray) ?? "";
  }), R = /* @__PURE__ */ Y(() => iu(e.node.node.type)), N = $l, V = /* @__PURE__ */ Y(() => Array.isArray(e.node.node.label) ? e.node.node.label : [e.node.node.label ?? ""]), C = /* @__PURE__ */ Y(() => l(V).map((M, F) => {
    const Z = M.includes("<b>") || M.includes("<strong>"), J = M.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, ""), ut = F > 0 && !Z;
    return { text: J, className: Z ? "node-label node-label-bold" : ut ? "node-label-secondary" : "node-label" };
  })), w = /* @__PURE__ */ Y(() => l(R) ? N : 0), T = /* @__PURE__ */ Y(() => l(w) > 0 ? tu : 0), k = /* @__PURE__ */ Y(() => l(C).length * jr), A = /* @__PURE__ */ Y(() => l(w) + l(T) + l(k)), O = /* @__PURE__ */ Y(() => l(s) - l(A) / 2), H = /* @__PURE__ */ Y(() => l(O) + l(w) + l(T) + jr * 0.7);
  let X = /* @__PURE__ */ ct(null);
  function G(M, F) {
    const Z = F.currentTarget.getBoundingClientRect();
    if (M === "top" || M === "bottom") {
      const J = Math.max(0, Math.min(1, (F.clientX - Z.left) / Z.width));
      B(
        X,
        {
          side: M,
          x: l(o) - l(a) + J * e.node.size.width,
          y: M === "top" ? l(s) - l(u) : l(s) + l(u)
        },
        !0
      );
    } else {
      const J = Math.max(0, Math.min(1, (F.clientY - Z.top) / Z.height));
      B(
        X,
        {
          side: M,
          x: M === "left" ? l(o) - l(a) : l(o) + l(a),
          y: l(s) - l(u) + J * e.node.size.height
        },
        !0
      );
    }
  }
  function rt(M) {
    var F;
    l(X) && (M.stopPropagation(), M.preventDefault(), (F = e.onaddport) == null || F.call(e, e.node.id, l(X).side));
  }
  function D(M) {
    var F;
    i() && (M.preventDefault(), M.stopPropagation(), (F = e.oncontextmenu) == null || F.call(e, e.node.id, M));
  }
  var m = j0();
  m.__contextmenu = D;
  var S = dt(m), x = dt(S);
  {
    var I = (M) => {
      var F = Y0();
      at(() => {
        v(F, "x", l(o) - l(a)), v(F, "y", l(s) - l(u)), v(F, "width", e.node.size.width), v(F, "height", e.node.size.height), v(F, "fill", l(h)), v(F, "stroke", l(g)), v(F, "stroke-width", l(p)), v(F, "stroke-dasharray", l(_) || void 0);
      }), $(M, F);
    }, L = (M) => {
      var F = ge(), Z = It(F);
      {
        var J = (ht) => {
          var ot = H0();
          at(() => {
            v(ot, "x", l(o) - l(a)), v(ot, "y", l(s) - l(u)), v(ot, "width", e.node.size.width), v(ot, "height", e.node.size.height), v(ot, "fill", l(h)), v(ot, "stroke", l(g)), v(ot, "stroke-width", l(p)), v(ot, "stroke-dasharray", l(_) || void 0);
          }), $(ht, ot);
        }, ut = (ht) => {
          var ot = ge(), xt = It(ot);
          {
            var Zr = (cn) => {
              var ne = B0();
              at(
                (Jr) => {
                  v(ne, "cx", l(o)), v(ne, "cy", l(s)), v(ne, "r", Jr), v(ne, "fill", l(h)), v(ne, "stroke", l(g)), v(ne, "stroke-width", l(p));
                },
                [() => Math.min(l(a), l(u))]
              ), $(cn, ne);
            }, un = (cn) => {
              var ne = ge(), Jr = It(ne);
              {
                var ma = (fn) => {
                  var Ne = V0();
                  at(() => {
                    v(Ne, "points", `${l(o) ?? ""},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) ?? ""},${l(s) + l(u)} ${l(o) - l(a)},${l(s) ?? ""}`), v(Ne, "fill", l(h)), v(Ne, "stroke", l(g)), v(Ne, "stroke-width", l(p));
                  }), $(fn, Ne);
                }, pa = (fn) => {
                  var Ne = ge(), _a = It(Ne);
                  {
                    var ya = (hn) => {
                      const Ye = /* @__PURE__ */ Y(() => l(a) * 0.866);
                      var He = X0();
                      at(() => {
                        v(He, "points", `${l(o) - l(a)},${l(s) ?? ""} ${l(o) - l(Ye)},${l(s) - l(u)} ${l(o) + l(Ye)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) + l(Ye)},${l(s) + l(u)} ${l(o) - l(Ye)},${l(s) + l(u)}`), v(He, "fill", l(h)), v(He, "stroke", l(g)), v(He, "stroke-width", l(p));
                      }), $(hn, He);
                    }, wa = (hn) => {
                      var Ye = ge(), He = It(Ye);
                      {
                        var xa = (dn) => {
                          const Ot = /* @__PURE__ */ Y(() => e.node.size.height * 0.15);
                          var hr = q0(), re = dt(hr), Me = et(re), At = et(Me), ft = et(At), he = et(ft);
                          at(() => {
                            v(re, "cx", l(o)), v(re, "cy", l(s) + l(u) - l(Ot)), v(re, "rx", l(a)), v(re, "ry", l(Ot)), v(re, "fill", l(h)), v(re, "stroke", l(g)), v(re, "stroke-width", l(p)), v(Me, "x", l(o) - l(a)), v(Me, "y", l(s) - l(u) + l(Ot)), v(Me, "width", e.node.size.width), v(Me, "height", e.node.size.height - l(Ot) * 2), v(Me, "fill", l(h)), v(At, "x1", l(o) - l(a)), v(At, "y1", l(s) - l(u) + l(Ot)), v(At, "x2", l(o) - l(a)), v(At, "y2", l(s) + l(u) - l(Ot)), v(At, "stroke", l(g)), v(At, "stroke-width", l(p)), v(ft, "x1", l(o) + l(a)), v(ft, "y1", l(s) - l(u) + l(Ot)), v(ft, "x2", l(o) + l(a)), v(ft, "y2", l(s) + l(u) - l(Ot)), v(ft, "stroke", l(g)), v(ft, "stroke-width", l(p)), v(he, "cx", l(o)), v(he, "cy", l(s) - l(u) + l(Ot)), v(he, "rx", l(a)), v(he, "ry", l(Ot)), v(he, "fill", l(h)), v(he, "stroke", l(g)), v(he, "stroke-width", l(p));
                          }), $(dn, hr);
                        }, ba = (dn) => {
                          var Ot = ge(), hr = It(Ot);
                          {
                            var re = (At) => {
                              var ft = U0();
                              at(() => {
                                v(ft, "x", l(o) - l(a)), v(ft, "y", l(s) - l(u)), v(ft, "width", e.node.size.width), v(ft, "height", e.node.size.height), v(ft, "rx", l(u)), v(ft, "ry", l(u)), v(ft, "fill", l(h)), v(ft, "stroke", l(g)), v(ft, "stroke-width", l(p));
                              }), $(At, ft);
                            }, Me = (At) => {
                              var ft = ge(), he = It(ft);
                              {
                                var ka = (gn) => {
                                  const Zt = /* @__PURE__ */ Y(() => e.node.size.width * 0.15);
                                  var Dn = G0();
                                  at(() => {
                                    v(Dn, "points", `${l(o) - l(a) + l(Zt)},${l(s) - l(u)} ${l(o) + l(a) - l(Zt)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) + l(u)} ${l(o) - l(a)},${l(s) + l(u)}`), v(Dn, "fill", l(h)), v(Dn, "stroke", l(g)), v(Dn, "stroke-width", l(p));
                                  }), $(gn, Dn);
                                }, Ea = (gn) => {
                                  var Zt = W0();
                                  at(() => {
                                    v(Zt, "x", l(o) - l(a)), v(Zt, "y", l(s) - l(u)), v(Zt, "width", e.node.size.width), v(Zt, "height", e.node.size.height), v(Zt, "fill", l(h)), v(Zt, "stroke", l(g)), v(Zt, "stroke-width", l(p));
                                  }), $(gn, Zt);
                                };
                                _t(
                                  he,
                                  (gn) => {
                                    l(c) === "trapezoid" ? gn(ka) : gn(Ea, !1);
                                  },
                                  !0
                                );
                              }
                              $(At, ft);
                            };
                            _t(
                              hr,
                              (At) => {
                                l(c) === "stadium" ? At(re) : At(Me, !1);
                              },
                              !0
                            );
                          }
                          $(dn, Ot);
                        };
                        _t(
                          He,
                          (dn) => {
                            l(c) === "cylinder" ? dn(xa) : dn(ba, !1);
                          },
                          !0
                        );
                      }
                      $(hn, Ye);
                    };
                    _t(
                      _a,
                      (hn) => {
                        l(c) === "hexagon" ? hn(ya) : hn(wa, !1);
                      },
                      !0
                    );
                  }
                  $(fn, Ne);
                };
                _t(
                  Jr,
                  (fn) => {
                    l(c) === "diamond" ? fn(ma) : fn(pa, !1);
                  },
                  !0
                );
              }
              $(cn, ne);
            };
            _t(
              xt,
              (cn) => {
                l(c) === "circle" ? cn(Zr) : cn(un, !1);
              },
              !0
            );
          }
          $(ht, ot);
        };
        _t(
          Z,
          (ht) => {
            l(c) === "rect" ? ht(J) : ht(ut, !1);
          },
          !0
        );
      }
      $(M, F);
    };
    _t(x, (M) => {
      l(c) === "rounded" ? M(I) : M(L, !1);
    });
  }
  var E = et(S), b = dt(E);
  {
    var P = (M) => {
      var F = K0(), Z = dt(F), J = dt(Z);
      Ps(J, () => l(R), !0), at(() => {
        v(F, "transform", `translate(${l(o) - N / 2}, ${l(O) ?? ""})`), v(Z, "width", N), v(Z, "height", N);
      }), $(M, F);
    };
    _t(b, (M) => {
      l(R) && M(P);
    });
  }
  var z = et(b);
  Ve(z, 17, () => l(C), As, (M, F, Z) => {
    var J = Z0(), ut = dt(J);
    at(() => {
      v(J, "x", l(o)), v(J, "y", l(H) + Z * jr), Di(J, 0, Vl(l(F).className)), Qn(ut, l(F).text);
    }), $(M, J);
  });
  var U = et(E);
  {
    var q = (M) => {
      const F = /* @__PURE__ */ Y(() => 10);
      var Z = J0(), J = It(Z);
      v(J, "height", l(F)), J.__pointermove = (xt) => G("top", xt), J.__pointerdown = rt;
      var ut = et(J);
      v(ut, "height", l(F)), ut.__pointermove = (xt) => G("bottom", xt), ut.__pointerdown = rt;
      var ht = et(ut);
      v(ht, "width", l(F)), ht.__pointermove = (xt) => G("left", xt), ht.__pointerdown = rt;
      var ot = et(ht);
      v(ot, "width", l(F)), ot.__pointermove = (xt) => G("right", xt), ot.__pointerdown = rt, at(() => {
        v(J, "x", l(o) - l(a)), v(J, "y", l(s) - l(u) - l(F) / 2), v(J, "width", e.node.size.width), v(ut, "x", l(o) - l(a)), v(ut, "y", l(s) + l(u) - l(F) / 2), v(ut, "width", e.node.size.width), v(ht, "x", l(o) - l(a) - l(F) / 2), v(ht, "y", l(s) - l(u)), v(ht, "height", e.node.size.height), v(ot, "x", l(o) + l(a) - l(F) / 2), v(ot, "y", l(s) - l(u)), v(ot, "height", e.node.size.height);
      }), Pe("pointerleave", J, () => {
        B(X, null);
      }), Pe("pointerleave", ut, () => {
        B(X, null);
      }), Pe("pointerleave", ht, () => {
        B(X, null);
      }), Pe("pointerleave", ot, () => {
        B(X, null);
      }), $(M, Z);
    };
    _t(U, (M) => {
      i() && l(f) && M(q);
    });
  }
  var W = et(U);
  {
    var it = (M) => {
      var F = Q0(), Z = It(F), J = et(Z);
      at(() => {
        v(Z, "cx", l(X).x), v(Z, "cy", l(X).y), v(J, "x", l(X).x), v(J, "y", l(X).y);
      }), $(M, F);
    };
    _t(W, (M) => {
      l(X) && M(it);
    });
  }
  at(() => {
    v(m, "data-id", e.node.id), v(m, "data-device-type", e.node.node.type ?? ""), v(m, "filter", `url(#${n() ?? ""})`);
  }), Pe("pointerenter", m, () => {
    i() && B(f, !0);
  }), Pe("pointerleave", m, () => {
    B(f, !1);
  }), $(t, m), ln();
}
ur(["contextmenu", "pointermove", "pointerdown"]);
var tg = /* @__PURE__ */ lt('<rect class="port-label-bg" rx="2" pointer-events="none"></rect><text class="port-label-text" font-size="9"> </text>', 1), eg = /* @__PURE__ */ lt('<g class="port"><rect fill="transparent"></rect><rect class="port-box" rx="2" pointer-events="none"></rect><!></g>');
function ng(t, e) {
  an(e, !0);
  let n = kt(e, "hideLabel", 3, !1), r = kt(e, "selected", 3, !1), i = kt(e, "interactive", 3, !1), o = kt(e, "linked", 3, !1);
  const s = /* @__PURE__ */ Y(() => e.port.absolutePosition.x), a = /* @__PURE__ */ Y(() => e.port.absolutePosition.y), u = /* @__PURE__ */ Y(() => e.port.size.width), c = /* @__PURE__ */ Y(() => e.port.size.height), f = /* @__PURE__ */ Y(() => A0(e.port)), d = /* @__PURE__ */ Y(() => e.port.label.length * eu + 4), h = 12, g = /* @__PURE__ */ Y(() => () => l(f).textAnchor === "middle" ? l(f).x - l(d) / 2 : l(f).textAnchor === "end" ? l(f).x - l(d) + 2 : l(f).x - 2), p = /* @__PURE__ */ Y(() => l(f).y - h + 3);
  let _ = /* @__PURE__ */ ct(!1);
  function R(O) {
    var H, X;
    !i() || O.button !== 0 || (O.stopPropagation(), O.preventDefault(), o() ? (H = e.onselect) == null || H.call(e, e.port.id) : (X = e.onlinkstart) == null || X.call(e, e.port.id, l(s), l(a)));
  }
  function N(O) {
    var H;
    i() && (O.stopPropagation(), (H = e.onlinkend) == null || H.call(e, e.port.id));
  }
  function V(O) {
    var H;
    i() && (O.preventDefault(), O.stopPropagation(), (H = e.oncontextmenu) == null || H.call(e, e.port.id, O));
  }
  var C = eg();
  C.__contextmenu = V;
  var w = dt(C);
  v(w, "width", 24), v(w, "height", 24), w.__pointerdown = R, w.__pointerup = N;
  var T = et(w), k = et(T);
  {
    var A = (O) => {
      var H = tg(), X = It(H);
      v(X, "height", h);
      var G = et(X);
      G.__click = (D) => {
        var m;
        i() && (D.stopPropagation(), (m = e.onlabeledit) == null || m.call(e, e.port.id, e.port.label, D.clientX, D.clientY));
      };
      var rt = dt(G);
      at(
        (D) => {
          v(X, "x", D), v(X, "y", l(p)), v(X, "width", l(d)), v(X, "fill", e.colors.portLabelBg), v(G, "x", l(f).x), v(G, "y", l(f).y), v(G, "text-anchor", l(f).textAnchor), v(G, "fill", e.colors.portLabelColor), Qn(rt, e.port.label);
        },
        [() => l(g)()]
      ), $(O, H);
    };
    _t(k, (O) => {
      n() || O(A);
    });
  }
  at(() => {
    v(C, "data-port", e.port.id), v(C, "data-port-device", e.port.nodeId), Di(w, 0, `port-hit ${o() ? "linked" : ""}`), v(w, "x", l(s) - 12), v(w, "y", l(a) - 12), v(T, "x", l(s) - l(u) / 2 - (r() || l(_) ? 2 : 0)), v(T, "y", l(a) - l(c) / 2 - (r() || l(_) ? 2 : 0)), v(T, "width", l(u) + (r() || l(_) ? 4 : 0)), v(T, "height", l(c) + (r() || l(_) ? 4 : 0)), v(T, "fill", r() ? e.colors.selection : l(_) ? "#3b82f6" : e.colors.portFill), v(T, "stroke", r() ? e.colors.selection : l(_) ? "#2563eb" : e.colors.portStroke), v(T, "stroke-width", r() || l(_) ? 2 : 1);
  }), Pe("pointerenter", C, () => {
    B(_, i());
  }), Pe("pointerleave", C, () => {
    B(_, !1);
  }), $(t, C), ln();
}
ur(["contextmenu", "pointerdown", "pointerup", "click"]);
var rg = /* @__PURE__ */ lt('<g class="subgraph"><rect class="subgraph-bg" rx="12" ry="12"></rect><rect fill="transparent"></rect><text class="subgraph-label" text-anchor="start" pointer-events="none"> </text></g>');
function ig(t, e) {
  an(e, !0);
  let n = kt(e, "selected", 3, !1);
  const r = /* @__PURE__ */ Y(() => e.subgraph.subgraph.style ?? {}), i = [
    "surface-1",
    "surface-2",
    "surface-3",
    "accent-blue",
    "accent-green",
    "accent-red",
    "accent-amber",
    "accent-purple"
  ], o = /* @__PURE__ */ Y(() => () => {
    const g = l(r).fill, p = l(r).stroke;
    if (g && i.includes(g) && e.theme) {
      const _ = e.theme.colors.surfaces[g];
      return {
        fill: _.fill,
        stroke: p ?? _.stroke,
        text: _.text
      };
    }
    return {
      fill: g ?? e.colors.subgraphFill,
      stroke: p ?? e.colors.subgraphStroke,
      text: e.colors.subgraphText
    };
  }), s = /* @__PURE__ */ Y(() => l(r).strokeWidth ?? 3), a = /* @__PURE__ */ Y(() => l(r).strokeDasharray ?? "");
  var u = rg(), c = dt(u);
  c.__click = (g) => {
    var p;
    g.stopPropagation(), (p = e.onselect) == null || p.call(e, e.subgraph.id);
  };
  var f = et(c);
  v(f, "height", 28);
  var d = et(f), h = dt(d);
  at(
    (g, p, _) => {
      v(u, "data-id", e.subgraph.id), v(c, "x", e.subgraph.bounds.x), v(c, "y", e.subgraph.bounds.y), v(c, "width", e.subgraph.bounds.width), v(c, "height", e.subgraph.bounds.height), v(c, "fill", g), v(c, "stroke", p), v(c, "stroke-width", n() ? 3 : l(s)), v(c, "stroke-dasharray", n() ? void 0 : l(a) || void 0), v(f, "data-sg-drag", e.subgraph.id), v(f, "x", e.subgraph.bounds.x), v(f, "y", e.subgraph.bounds.y), v(f, "width", e.subgraph.bounds.width), v(d, "x", e.subgraph.bounds.x + 10), v(d, "y", e.subgraph.bounds.y + 20), v(d, "fill", _), Qn(h, e.subgraph.subgraph.label);
    },
    [
      () => l(o)().fill,
      () => n() ? "#3b82f6" : l(o)().stroke,
      () => l(o)().text
    ]
  ), $(t, u), ln();
}
ur(["click"]);
var og = /* @__PURE__ */ lt('<svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7"></polygon></marker><filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"></feDropShadow></filter><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke-width="0.5"></path></pattern></defs><!><g class="viewport"><rect class="canvas-bg" x="-99999" y="-99999" width="199998" height="199998" fill="url(#grid)"></rect><!><!><!><!><!></g></svg>');
function sg(t, e) {
  an(e, !0);
  let n = kt(e, "interactive", 3, !1), r = kt(e, "selection", 19, () => /* @__PURE__ */ new Set()), i = kt(e, "linkedPorts", 19, () => /* @__PURE__ */ new Set()), o = kt(e, "linkPreview", 3, null), s = kt(e, "svgEl", 15, null);
  const a = /* @__PURE__ */ Y(() => `${e.bounds.x - 50} ${e.bounds.y - 50} ${e.bounds.width + 100} ${e.bounds.height + 100}`), u = /* @__PURE__ */ Y(() => [...e.nodes.values()]), c = /* @__PURE__ */ Y(() => [...e.edges.values()]), f = /* @__PURE__ */ Y(() => [...e.subgraphs.values()]), d = /* @__PURE__ */ Y(() => {
    const D = /* @__PURE__ */ new Map();
    for (const m of e.ports.values()) {
      const S = D.get(m.nodeId);
      S ? S.push(m) : D.set(m.nodeId, [m]);
    }
    return D;
  });
  let h = /* @__PURE__ */ ct(void 0);
  Be(() => {
    if (!s() || !l(h)) return;
    const D = Tt(s()), m = N0().scaleExtent([0.2, 10]).filter((S) => S.type === "wheel" ? !0 : S.type === "mousedown" || S.type === "pointerdown" ? S.button === 1 || S.altKey : !1).on("zoom", (S) => {
      l(h) && l(h).setAttribute("transform", S.transform.toString());
    });
    return D.call(m), D.on("contextmenu.zoom", null), () => {
      D.on(".zoom", null);
    };
  }), Be(() => {
    if (l(u).length, l(f).length, !s() || !n()) return;
    const D = bo().filter((S) => {
      const x = S.target;
      return x.closest(".port") || x.closest("[data-droplet]") ? !1 : S.button === 0;
    }).on("drag", function(S) {
      var L;
      const x = this.getAttribute("data-id");
      if (!x) return;
      const I = e.nodes.get(x);
      I && ((L = e.onnodedragmove) == null || L.call(e, x, I.position.x + S.dx, I.position.y + S.dy));
    });
    Tt(s()).selectAll(".node[data-id]").call(D);
    const m = bo().on("drag", function(S) {
      var L;
      const x = this.getAttribute("data-sg-drag");
      if (!x) return;
      const I = e.subgraphs.get(x);
      I && ((L = e.onsubgraphmove) == null || L.call(e, x, I.bounds.x + S.dx, I.bounds.y + S.dy));
    });
    return Tt(s()).selectAll("[data-sg-drag]").call(m), () => {
      Tt(s()).selectAll(".node[data-id]").on(".drag", null), Tt(s()).selectAll("[data-sg-drag]").on(".drag", null);
    };
  });
  var g = og();
  let p;
  var _ = dt(g), R = dt(_), N = dt(R), V = et(R, 2), C = dt(V), w = et(_);
  Ps(
    w,
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
    svg.interactive .port-label-text { pointer-events: fill; cursor: text; }
  </style>`,
    !0
  );
  var T = et(w), k = dt(T);
  k.__click = () => {
    var D;
    return (D = e.onbackgroundclick) == null ? void 0 : D.call(e);
  };
  var A = et(k);
  Ve(A, 17, () => l(f), (D) => D.id, (D, m) => {
    {
      let S = /* @__PURE__ */ Y(() => r().has(l(m).id));
      ig(D, {
        get subgraph() {
          return l(m);
        },
        get colors() {
          return e.colors;
        },
        get theme() {
          return e.theme;
        },
        get selected() {
          return l(S);
        },
        get onselect() {
          return e.onsubgraphselect;
        }
      });
    }
  });
  var O = et(A);
  Ve(O, 17, () => l(c), (D) => D.id, (D, m) => {
    {
      let S = /* @__PURE__ */ Y(() => r().has(l(m).id));
      F0(D, {
        get edge() {
          return l(m);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(S);
        },
        get interactive() {
          return n();
        },
        get onselect() {
          return e.onedgeselect;
        },
        oncontextmenu: (x, I) => {
          var L;
          return (L = e.oncontextmenu) == null ? void 0 : L.call(e, x, "edge", I);
        }
      });
    }
  });
  var H = et(O);
  Ve(H, 17, () => l(u), (D) => D.id, (D, m) => {
    {
      let S = /* @__PURE__ */ Y(() => r().has(l(m).id));
      $0(D, {
        get node() {
          return l(m);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(S);
        },
        get interactive() {
          return n();
        },
        get onaddport() {
          return e.onaddport;
        },
        oncontextmenu: (x, I) => {
          var L;
          return (L = e.oncontextmenu) == null ? void 0 : L.call(e, x, "node", I);
        }
      });
    }
  });
  var X = et(H);
  Ve(X, 17, () => l(u), (D) => D.id, (D, m) => {
    var S = ge(), x = It(S);
    Ve(x, 17, () => l(d).get(l(m).id) ?? [], (I) => I.id, (I, L) => {
      {
        let E = /* @__PURE__ */ Y(() => r().has(l(L).id)), b = /* @__PURE__ */ Y(() => i().has(l(L).id));
        ng(I, {
          get port() {
            return l(L);
          },
          get colors() {
            return e.colors;
          },
          get selected() {
            return l(E);
          },
          get interactive() {
            return n();
          },
          get linked() {
            return l(b);
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
          get onlabeledit() {
            return e.onlabeledit;
          },
          oncontextmenu: (P, z) => {
            var U;
            return (U = e.oncontextmenu) == null ? void 0 : U.call(e, P, "port", z);
          }
        });
      }
    }), $(D, S);
  });
  var G = et(X);
  {
    var rt = (D) => {
      D0(D, {
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
    _t(G, (D) => {
      o() && D(rt);
    });
  }
  lo(T, (D) => B(h, D), () => l(h)), lo(g, (D) => s(D), () => s()), at(() => {
    v(g, "viewBox", l(a)), Ul(g, `width: 100%; height: 100%; user-select: none; background: ${e.colors.background ?? ""};`), p = Di(g, 0, "", null, p, { interactive: n() }), v(N, "fill", e.colors.linkStroke), v(C, "stroke", e.colors.grid), v(k, "pointer-events", n() ? "fill" : "none");
  }), $(t, g), ln();
}
ur(["click"]);
var ag = /* @__PURE__ */ Cl('<div style="width: 100%; height: 100%; outline: none;"><!></div>');
function lg(t, e) {
  var L;
  an(e, !0);
  let n = kt(e, "mode", 3, "view"), r = /* @__PURE__ */ ct(Nt(e.theme));
  const i = /* @__PURE__ */ Y(() => Kc(l(r)));
  let o = /* @__PURE__ */ ct(Nt(n()));
  const s = /* @__PURE__ */ Y(() => l(o) === "edit");
  let a = /* @__PURE__ */ ct(Nt(new Map(e.layout.nodes))), u = /* @__PURE__ */ ct(Nt(new Map(e.layout.ports))), c = /* @__PURE__ */ ct(Nt(new Map(e.layout.edges))), f = /* @__PURE__ */ ct(Nt(new Map(e.layout.subgraphs))), d = Nt(e.layout.bounds), h = /* @__PURE__ */ ct(Nt((L = e.graph) != null && L.links ? [...e.graph.links] : [])), g = /* @__PURE__ */ ct(Nt(/* @__PURE__ */ new Set())), p = /* @__PURE__ */ ct(null), _ = /* @__PURE__ */ ct(null);
  const R = /* @__PURE__ */ Y(() => {
    const E = /* @__PURE__ */ new Set();
    for (const b of l(c).values())
      b.fromPortId && E.add(b.fromPortId), b.toPortId && E.add(b.toPortId);
    return E;
  });
  Be(() => {
    if (!l(s) || !l(_)) return;
    const E = l(_);
    return E.addEventListener("keydown", S), () => E.removeEventListener("keydown", S);
  }), Be(() => {
    if (!l(_)) return;
    const b = l(_).getRootNode().host;
    if (!b) return;
    function P(U) {
      var W;
      const q = (W = U.detail) == null ? void 0 : W.mode;
      (q === "edit" || q === "view") && B(o, q, !0);
    }
    function z(U) {
      var W;
      const q = (W = U.detail) == null ? void 0 : W.theme;
      q && B(r, q, !0);
    }
    return b.addEventListener("shumoku-mode-change", P), b.addEventListener("shumoku-theme-change", z), () => {
      b.removeEventListener("shumoku-mode-change", P), b.removeEventListener("shumoku-theme-change", z);
    };
  }), Be(() => {
    if (!l(_)) return;
    const b = l(_).getRootNode().host;
    if (!b) return;
    function P(z) {
      const U = {
        nodes: l(a),
        ports: l(u),
        edges: l(c),
        subgraphs: l(f),
        bounds: d
      };
      b.dispatchEvent(new CustomEvent("shumoku-snapshot", {
        detail: { layout: U, links: l(h) },
        bubbles: !0,
        composed: !0
      }));
    }
    return b.addEventListener("shumoku-get-snapshot", P), () => b.removeEventListener("shumoku-get-snapshot", P);
  }), Be(() => {
    var E, b;
    if (l(g).size === 0)
      (E = e.onselect) == null || E.call(e, null, null);
    else {
      const P = [...l(g)][0] ?? null;
      if (!P) return;
      let z = "node";
      l(c).has(P) ? z = "edge" : l(u).has(P) ? z = "port" : l(f).has(P) && (z = "subgraph"), (b = e.onselect) == null || b.call(e, P, z);
    }
  });
  async function N(E, b, P) {
    const z = await bu(
      E,
      b,
      P,
      {
        nodes: l(a),
        ports: l(u),
        subgraphs: l(f)
      },
      l(h)
    );
    z && (B(a, z.nodes, !0), B(u, z.ports, !0), B(c, z.edges, !0), z.subgraphs && B(f, z.subgraphs, !0));
  }
  async function V(E, b) {
    const P = Pu(E, b, l(a), l(u), l(h));
    P && (B(a, P.nodes, !0), B(u, P.ports, !0), B(c, await Kn(P.nodes, P.ports, l(h)), !0));
  }
  async function C(E, b, P) {
    const z = await ku(
      E,
      b,
      P,
      {
        nodes: l(a),
        ports: l(u),
        subgraphs: l(f)
      },
      l(h)
    );
    z && (B(a, z.nodes, !0), B(u, z.ports, !0), B(c, z.edges, !0), B(f, z.subgraphs, !0));
  }
  let w = null;
  function T(E, b, P) {
    var W, it;
    B(p, { fromPortId: E, fromX: b, fromY: P, toX: b, toY: P }, !0);
    function z(M) {
      if (!l(p) || !l(_)) return;
      const Z = (l(_).querySelector(".viewport") ?? l(_)).getScreenCTM();
      if (!Z) return;
      const J = new DOMPoint(M.clientX, M.clientY).matrixTransform(Z.inverse());
      B(p, { ...l(p), toX: J.x, toY: J.y }, !0);
    }
    function U(M) {
      M.target.closest(".port") || q();
    }
    function q() {
      var M, F;
      (M = l(_)) == null || M.removeEventListener("pointermove", z), (F = l(_)) == null || F.removeEventListener("pointerup", U), B(p, null), w = null;
    }
    w = q, (W = l(_)) == null || W.addEventListener("pointermove", z), (it = l(_)) == null || it.addEventListener("pointerup", U);
  }
  function k(E) {
    if (!l(p)) return;
    const b = l(p).fromPortId;
    if (w == null || w(), b === E) return;
    const P = l(u).get(b), z = l(u).get(E);
    P && z && P.nodeId === z.nodeId || A(b, E);
  }
  async function A(E, b) {
    var Z;
    const P = E.split(":"), z = b.split(":");
    let U = P[0] ?? "", q = P.slice(1).join(":"), W = z[0] ?? "", it = z.slice(1).join(":");
    if (!U || !q || !W || !it || Eu(l(h), U, q, W, it)) return;
    const M = l(a).get(U), F = l(a).get(W);
    M && F && M.position.y > F.position.y && ([U, W] = [W, U], [q, it] = [it, q]), B(
      h,
      [
        ...l(h),
        {
          id: `link-${Date.now()}`,
          from: { node: U, port: q },
          to: { node: W, port: it }
        }
      ],
      !0
    ), B(c, await Kn(l(a), l(u), l(h)), !0), (Z = e.onchange) == null || Z.call(e, l(h));
  }
  Be(() => {
    if (!l(_)) return;
    const b = l(_).getRootNode().host;
    function P(q) {
      const { label: W, position: it } = q.detail ?? {}, M = `node-${Date.now()}`, F = 180, Z = 80, J = [...l(g)].find((un) => l(f).has(un)), ut = J ? l(f).get(J) : void 0;
      let ht, ot;
      ut ? (ht = J, ot = it ?? {
        x: ut.bounds.x + ut.bounds.width / 2,
        y: ut.bounds.y + ut.bounds.height / 2
      }) : ot = it ?? {
        x: d.x + d.width + 20 + F / 2,
        y: d.y + d.height / 2
      };
      const xt = new Map(l(a));
      xt.set(M, {
        id: M,
        position: ot,
        size: { width: F, height: Z },
        node: { id: M, label: W ?? "New Node", shape: "rounded", parent: ht }
      });
      const Zr = Fs(M, ot.x, ot.y, xt, 8, l(f));
      if (xt.set(M, { ...xt.get(M), position: Zr }), B(a, xt, !0), ht) {
        const un = new Map(l(f));
        Cr(xt, un, l(u)), B(f, un, !0);
      }
      B(g, /* @__PURE__ */ new Set([M]), !0);
    }
    function z(q) {
      const { label: W, position: it } = q.detail ?? {}, M = `sg-${Date.now()}`, F = 200, Z = 120, J = it ?? {
        x: d.x + d.width + 20 + F / 2,
        y: d.y + d.height / 2
      }, ut = new Map(l(f));
      ut.set(M, {
        id: M,
        bounds: {
          x: J.x - F / 2,
          y: J.y - Z / 2,
          width: F,
          height: Z
        },
        subgraph: { id: M, label: W ?? "New Group" }
      }), Cr(l(a), ut, l(u)), B(f, ut, !0);
    }
    function U(q) {
      const { portId: W, label: it } = q.detail ?? {};
      W && it && rt(W, it);
    }
    return b == null || b.addEventListener("shumoku-add-node", P), b == null || b.addEventListener("shumoku-add-subgraph", z), b == null || b.addEventListener("shumoku-label-commit", U), () => {
      b == null || b.removeEventListener("shumoku-add-node", P), b == null || b.removeEventListener("shumoku-add-subgraph", z), b == null || b.removeEventListener("shumoku-label-commit", U);
    };
  });
  function O(E) {
    B(g, /* @__PURE__ */ new Set([E]), !0);
  }
  function H(E) {
    B(g, /* @__PURE__ */ new Set([E]), !0);
  }
  function X(E) {
    B(g, /* @__PURE__ */ new Set([E]), !0);
  }
  function G(E, b, P, z) {
    if (!l(_)) return;
    const q = l(_).getRootNode().host;
    q == null || q.dispatchEvent(new CustomEvent("shumoku-label-edit", {
      detail: { portId: E, label: b, screenX: P, screenY: z },
      bubbles: !0,
      composed: !0
    }));
  }
  function rt(E, b) {
    const P = l(u).get(E);
    if (!P || b === P.label) return;
    const z = new Map(l(u));
    z.set(E, { ...P, label: b }), B(u, z, !0);
  }
  function D() {
    B(g, /* @__PURE__ */ new Set(), !0);
  }
  function m(E, b, P) {
    var z;
    B(g, /* @__PURE__ */ new Set([E]), !0), (z = e.oncontextmenu) == null || z.call(e, E, b, P.clientX, P.clientY);
  }
  function S(E) {
    var b, P;
    if (E.key === "Delete" || E.key === "Backspace") {
      for (const z of l(g))
        if (l(c).has(z)) {
          const U = l(c).get(z);
          (b = U == null ? void 0 : U.link) != null && b.id && B(h, l(h).filter((q) => {
            var W;
            return q.id !== ((W = U.link) == null ? void 0 : W.id);
          }), !0);
        } else if (l(u).has(z)) {
          const U = Iu(z, l(a), l(u), l(h));
          U && (B(a, U.nodes, !0), B(u, U.ports, !0), B(h, U.links, !0));
        }
      Kn(l(a), l(u), l(h)).then((z) => {
        B(c, z, !0);
      }), B(g, /* @__PURE__ */ new Set(), !0), (P = e.onchange) == null || P.call(e, l(h));
    }
    E.key === "Escape" && (B(g, /* @__PURE__ */ new Set(), !0), B(p, null));
  }
  var x = ag(), I = dt(x);
  sg(I, {
    get nodes() {
      return l(a);
    },
    get ports() {
      return l(u);
    },
    get edges() {
      return l(c);
    },
    get subgraphs() {
      return l(f);
    },
    get bounds() {
      return d;
    },
    get colors() {
      return l(i);
    },
    get theme() {
      return l(r);
    },
    get interactive() {
      return l(s);
    },
    get selection() {
      return l(g);
    },
    get linkedPorts() {
      return l(R);
    },
    get linkPreview() {
      return l(p);
    },
    onnodedragmove: N,
    onaddport: V,
    onlinkstart: T,
    onlinkend: k,
    onedgeselect: O,
    onportselect: H,
    onlabeledit: G,
    onsubgraphselect: X,
    onsubgraphmove: C,
    oncontextmenu: m,
    onbackgroundclick: D,
    get svgEl() {
      return l(_);
    },
    set svgEl(E) {
      B(_, E, !0);
    }
  }), $(t, x), ln();
}
class ug extends HTMLElement {
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
    this._instance && (ro(this._instance), this._instance = null);
  }
  _tryRender() {
    !this.shadowRoot || !this._layout || (this._instance && (ro(this._instance), this._instance = null), this._instance = Ll(lg, {
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
typeof window < "u" && (customElements.get("shumoku-renderer") || customElements.define("shumoku-renderer", ug));
export {
  ug as ShumokuRendererElement
};
