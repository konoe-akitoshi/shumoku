var Ra = Object.defineProperty;
var to = (t) => {
  throw TypeError(t);
};
var La = (t, e, n) => e in t ? Ra(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var Ot = (t, e, n) => La(t, typeof e != "symbol" ? e + "" : e, n), jr = (t, e, n) => e.has(t) || to("Cannot " + n);
var _ = (t, e, n) => (jr(t, e, "read from private field"), n ? n.call(t) : e.get(t)), $ = (t, e, n) => e.has(t) ? to("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, n), j = (t, e, n, r) => (jr(t, e, "write to private field"), r ? r.call(t, n) : e.set(t, n), n), bt = (t, e, n) => (jr(t, e, "access private method"), n);
const pt = Symbol(), Oa = "http://www.w3.org/1999/xhtml", oi = !1;
var qo = Array.isArray, Fa = Array.prototype.indexOf, Br = Array.from, Da = Object.defineProperty, yn = Object.getOwnPropertyDescriptor, Go = Object.getOwnPropertyDescriptors, Ya = Object.prototype, Ha = Array.prototype, Ii = Object.getPrototypeOf, eo = Object.isExtensible;
function Ba(t) {
  for (var e = 0; e < t.length; e++)
    t[e]();
}
function Wo() {
  var t, e, n = new Promise((r, i) => {
    t = r, e = i;
  });
  return { promise: n, resolve: t, reject: e };
}
const xt = 2, Ar = 4, Vr = 8, Ko = 1 << 24, be = 16, ke = 32, sn = 64, Ti = 128, Wt = 512, kt = 1024, Nt = 2048, Ee = 4096, Ht = 8192, ye = 16384, zi = 32768, Tn = 65536, no = 1 << 17, Zo = 1 << 18, Fn = 1 << 19, Va = 1 << 20, Re = 1 << 25, tn = 32768, si = 1 << 21, Ci = 1 << 22, Le = 1 << 23, je = Symbol("$state"), Xa = Symbol("legacy props"), Ua = Symbol(""), mn = new class extends Error {
  constructor() {
    super(...arguments);
    Ot(this, "name", "StaleReactionError");
    Ot(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function qa() {
  throw new Error("https://svelte.dev/e/async_derived_orphan");
}
function Ga(t) {
  throw new Error("https://svelte.dev/e/effect_in_teardown");
}
function Wa() {
  throw new Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function Ka(t) {
  throw new Error("https://svelte.dev/e/effect_orphan");
}
function Za() {
  throw new Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function ja(t) {
  throw new Error("https://svelte.dev/e/props_invalid_value");
}
function Ja() {
  throw new Error("https://svelte.dev/e/state_descriptors_fixed");
}
function Qa() {
  throw new Error("https://svelte.dev/e/state_prototype_fixed");
}
function $a() {
  throw new Error("https://svelte.dev/e/state_unsafe_mutation");
}
function tl() {
  throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
function el() {
  console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
function jo(t) {
  return t === this.v;
}
function Jo(t, e) {
  return t != t ? e == e : t !== e || t !== null && typeof t == "object" || typeof t == "function";
}
function Qo(t) {
  return !Jo(t, this.v);
}
let nl = !1, Kt = null;
function zn(t) {
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
      ms(r);
  }
  return t !== void 0 && (e.x = t), e.i = !0, Kt = e.p, t ?? /** @type {T} */
  {};
}
function $o() {
  return !0;
}
let pn = [];
function rl() {
  var t = pn;
  pn = [], Ba(t);
}
function Oe(t) {
  if (pn.length === 0) {
    var e = pn;
    queueMicrotask(() => {
      e === pn && rl();
    });
  }
  pn.push(t);
}
function ts(t) {
  var e = rt;
  if (e === null)
    return J.f |= Le, t;
  if ((e.f & zi) === 0) {
    if ((e.f & Ti) === 0)
      throw t;
    e.b.error(t);
  } else
    Cn(t, e);
}
function Cn(t, e) {
  for (; e !== null; ) {
    if ((e.f & Ti) !== 0)
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
function mt(t, e) {
  t.f = t.f & il | e;
}
function Ri(t) {
  (t.f & Wt) !== 0 || t.deps === null ? mt(t, kt) : mt(t, Ee);
}
function es(t) {
  if (t !== null)
    for (const e of t)
      (e.f & xt) === 0 || (e.f & tn) === 0 || (e.f ^= tn, es(
        /** @type {Derived} */
        e.deps
      ));
}
function ns(t, e, n) {
  (t.f & Nt) !== 0 ? e.add(t) : (t.f & Ee) !== 0 && n.add(t), es(t.deps), mt(t, kt);
}
const hr = /* @__PURE__ */ new Set();
let st = null, yt = null, Jt = [], Li = null, ai = !1;
var bn, kn, qe, En, rr, Sn, Nn, Mn, fe, li, ui, rs;
const $i = class $i {
  constructor() {
    $(this, fe);
    Ot(this, "committed", !1);
    /**
     * The current values of any sources that are updated in this batch
     * They keys of this map are identical to `this.#previous`
     * @type {Map<Source, any>}
     */
    Ot(this, "current", /* @__PURE__ */ new Map());
    /**
     * The values of any sources that are updated in this batch _before_ those updates took place.
     * They keys of this map are identical to `this.#current`
     * @type {Map<Source, any>}
     */
    Ot(this, "previous", /* @__PURE__ */ new Map());
    /**
     * When the batch is committed (and the DOM is updated), we need to remove old branches
     * and append new ones by calling the functions added inside (if/each/key/etc) blocks
     * @type {Set<() => void>}
     */
    $(this, bn, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    $(this, kn, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    $(this, qe, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    $(this, En, 0);
    /**
     * A deferred that resolves when the batch is committed, used with `settled()`
     * TODO replace with Promise.withResolvers once supported widely enough
     * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
     */
    $(this, rr, null);
    /**
     * Deferred effects (which run after async work has completed) that are DIRTY
     * @type {Set<Effect>}
     */
    $(this, Sn, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    $(this, Nn, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    Ot(this, "skipped_effects", /* @__PURE__ */ new Set());
    Ot(this, "is_fork", !1);
    $(this, Mn, !1);
  }
  is_deferred() {
    return this.is_fork || _(this, En) > 0;
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
      bt(this, fe, li).call(this, o, n, r);
    if (this.is_deferred())
      bt(this, fe, ui).call(this, r), bt(this, fe, ui).call(this, n);
    else {
      for (const o of _(this, bn)) o();
      _(this, bn).clear(), _(this, qe) === 0 && bt(this, fe, rs).call(this), st = null, ro(r), ro(n), (i = _(this, rr)) == null || i.resolve();
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
    n !== pt && !this.previous.has(e) && this.previous.set(e, n), (e.f & Le) === 0 && (this.current.set(e, e.v), yt == null || yt.set(e, e.v));
  }
  activate() {
    st = this, this.apply();
  }
  deactivate() {
    st === this && (st = null, yt = null);
  }
  flush() {
    if (this.activate(), Jt.length > 0) {
      if (ol(), st !== null && st !== this)
        return;
    } else _(this, qe) === 0 && this.process([]);
    this.deactivate();
  }
  discard() {
    for (const e of _(this, kn)) e(this);
    _(this, kn).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(e) {
    j(this, qe, _(this, qe) + 1), e && j(this, En, _(this, En) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(e) {
    j(this, qe, _(this, qe) - 1), e && j(this, En, _(this, En) - 1), !_(this, Mn) && (j(this, Mn, !0), Oe(() => {
      j(this, Mn, !1), this.is_deferred() ? Jt.length > 0 && this.flush() : this.revive();
    }));
  }
  revive() {
    for (const e of _(this, Sn))
      _(this, Nn).delete(e), mt(e, Nt), we(e);
    for (const e of _(this, Nn))
      mt(e, Ee), we(e);
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(e) {
    _(this, bn).add(e);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(e) {
    _(this, kn).add(e);
  }
  settled() {
    return (_(this, rr) ?? j(this, rr, Wo())).promise;
  }
  static ensure() {
    if (st === null) {
      const e = st = new $i();
      hr.add(st), Oe(() => {
        st === e && e.flush();
      });
    }
    return st;
  }
  apply() {
  }
};
bn = new WeakMap(), kn = new WeakMap(), qe = new WeakMap(), En = new WeakMap(), rr = new WeakMap(), Sn = new WeakMap(), Nn = new WeakMap(), Mn = new WeakMap(), fe = new WeakSet(), /**
 * Traverse the effect tree, executing effects or stashing
 * them for later execution as appropriate
 * @param {Effect} root
 * @param {Effect[]} effects
 * @param {Effect[]} render_effects
 */
li = function(e, n, r) {
  e.f ^= kt;
  for (var i = e.first, o = null; i !== null; ) {
    var s = i.f, a = (s & (ke | sn)) !== 0, u = a && (s & kt) !== 0, f = u || (s & Ht) !== 0 || this.skipped_effects.has(i);
    if (!f && i.fn !== null) {
      a ? i.f ^= kt : o !== null && (s & (Ar | Vr | Ko)) !== 0 ? o.b.defer_effect(i) : (s & Ar) !== 0 ? n.push(i) : ar(i) && ((s & be) !== 0 && _(this, Sn).add(i), Kn(i));
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
ui = function(e) {
  for (var n = 0; n < e.length; n += 1)
    ns(e[n], _(this, Sn), _(this, Nn));
}, rs = function() {
  var i;
  if (hr.size > 1) {
    this.previous.clear();
    var e = yt, n = !0;
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
          is(c, a, u, f);
        if (Jt.length > 0) {
          st = o, o.apply();
          for (const c of Jt)
            bt(i = o, fe, li).call(i, c, [], []);
          o.deactivate();
        }
        Jt = r;
      }
    }
    st = null, yt = e;
  }
  this.committed = !0, hr.delete(this);
};
let Fe = $i;
function ol() {
  ai = !0;
  var t = null;
  try {
    for (var e = 0; Jt.length > 0; ) {
      var n = Fe.ensure();
      if (e++ > 1e3) {
        var r, i;
        sl();
      }
      n.process(Jt), De.clear();
    }
  } finally {
    ai = !1, Li = null;
  }
}
function sl() {
  try {
    Za();
  } catch (t) {
    Cn(t, Li);
  }
}
let jt = null;
function ro(t) {
  var e = t.length;
  if (e !== 0) {
    for (var n = 0; n < e; ) {
      var r = t[n++];
      if ((r.f & (ye | Ht)) === 0 && ar(r) && (jt = /* @__PURE__ */ new Set(), Kn(r), r.deps === null && r.first === null && r.nodes === null && (r.teardown === null && r.ac === null ? xs(r) : r.fn = null), (jt == null ? void 0 : jt.size) > 0)) {
        De.clear();
        for (const i of jt) {
          if ((i.f & (ye | Ht)) !== 0) continue;
          const o = [i];
          let s = i.parent;
          for (; s !== null; )
            jt.has(s) && (jt.delete(s), o.push(s)), s = s.parent;
          for (let a = o.length - 1; a >= 0; a--) {
            const u = o[a];
            (u.f & (ye | Ht)) === 0 && Kn(u);
          }
        }
        jt.clear();
      }
    }
    jt = null;
  }
}
function is(t, e, n, r) {
  if (!n.has(t) && (n.add(t), t.reactions !== null))
    for (const i of t.reactions) {
      const o = i.f;
      (o & xt) !== 0 ? is(
        /** @type {Derived} */
        i,
        e,
        n,
        r
      ) : (o & (Ci | be)) !== 0 && (o & Nt) === 0 && os(i, e, r) && (mt(i, Nt), we(
        /** @type {Effect} */
        i
      ));
    }
}
function os(t, e, n) {
  const r = n.get(t);
  if (r !== void 0) return r;
  if (t.deps !== null)
    for (const i of t.deps) {
      if (e.includes(i))
        return !0;
      if ((i.f & xt) !== 0 && os(
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
  for (var e = Li = t; e.parent !== null; ) {
    e = e.parent;
    var n = e.f;
    if (ai && e === rt && (n & be) !== 0 && (n & Zo) === 0)
      return;
    if ((n & (sn | ke)) !== 0) {
      if ((n & kt) === 0) return;
      e.f ^= kt;
    }
  }
  Jt.push(e);
}
function al(t) {
  let e = 0, n = en(0), r;
  return () => {
    Di() && (l(n), Yi(() => (e === 0 && (r = Ur(() => t(() => Gn(n)))), e += 1, () => {
      Oe(() => {
        e -= 1, e === 0 && (r == null || r(), r = void 0, Gn(n));
      });
    })));
  };
}
var ll = Tn | Fn | Ti;
function ul(t, e, n) {
  new fl(t, e, n);
}
var Xt, Pi, ie, Ge, oe, Ut, At, se, me, ze, We, Ce, An, Ke, Pn, In, pe, Yr, vt, cl, hl, fi, wr, xr, ci;
class fl {
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(e, n, r) {
    $(this, vt);
    /** @type {Boundary | null} */
    Ot(this, "parent");
    Ot(this, "is_pending", !1);
    /** @type {TemplateNode} */
    $(this, Xt);
    /** @type {TemplateNode | null} */
    $(this, Pi, null);
    /** @type {BoundaryProps} */
    $(this, ie);
    /** @type {((anchor: Node) => void)} */
    $(this, Ge);
    /** @type {Effect} */
    $(this, oe);
    /** @type {Effect | null} */
    $(this, Ut, null);
    /** @type {Effect | null} */
    $(this, At, null);
    /** @type {Effect | null} */
    $(this, se, null);
    /** @type {DocumentFragment | null} */
    $(this, me, null);
    /** @type {TemplateNode | null} */
    $(this, ze, null);
    $(this, We, 0);
    $(this, Ce, 0);
    $(this, An, !1);
    $(this, Ke, !1);
    /** @type {Set<Effect>} */
    $(this, Pn, /* @__PURE__ */ new Set());
    /** @type {Set<Effect>} */
    $(this, In, /* @__PURE__ */ new Set());
    /**
     * A source containing the number of pending async deriveds/expressions.
     * Only created if `$effect.pending()` is used inside the boundary,
     * otherwise updating the source results in needless `Batch.ensure()`
     * calls followed by no-op flushes
     * @type {Source<number> | null}
     */
    $(this, pe, null);
    $(this, Yr, al(() => (j(this, pe, en(_(this, We))), () => {
      j(this, pe, null);
    })));
    j(this, Xt, e), j(this, ie, n), j(this, Ge, r), this.parent = /** @type {Effect} */
    rt.b, this.is_pending = !!_(this, ie).pending, j(this, oe, Hi(() => {
      rt.b = this;
      {
        var i = bt(this, vt, fi).call(this);
        try {
          j(this, Ut, qt(() => r(i)));
        } catch (o) {
          this.error(o);
        }
        _(this, Ce) > 0 ? bt(this, vt, xr).call(this) : this.is_pending = !1;
      }
      return () => {
        var o;
        (o = _(this, ze)) == null || o.remove();
      };
    }, ll));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(e) {
    ns(e, _(this, Pn), _(this, In));
  }
  /**
   * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
   * @returns {boolean}
   */
  is_rendered() {
    return !this.is_pending && (!this.parent || this.parent.is_rendered());
  }
  has_pending_snippet() {
    return !!_(this, ie).pending;
  }
  /**
   * Update the source that powers `$effect.pending()` inside this boundary,
   * and controls when the current `pending` snippet (if any) is removed.
   * Do not call from inside the class
   * @param {1 | -1} d
   */
  update_pending_count(e) {
    bt(this, vt, ci).call(this, e), j(this, We, _(this, We) + e), !(!_(this, pe) || _(this, An)) && (j(this, An, !0), Oe(() => {
      j(this, An, !1), _(this, pe) && Rn(_(this, pe), _(this, We));
    }));
  }
  get_effect_pending() {
    return _(this, Yr).call(this), l(
      /** @type {Source<number>} */
      _(this, pe)
    );
  }
  /** @param {unknown} error */
  error(e) {
    var n = _(this, ie).onerror;
    let r = _(this, ie).failed;
    if (_(this, Ke) || !n && !r)
      throw e;
    _(this, Ut) && (Rt(_(this, Ut)), j(this, Ut, null)), _(this, At) && (Rt(_(this, At)), j(this, At, null)), _(this, se) && (Rt(_(this, se)), j(this, se, null));
    var i = !1, o = !1;
    const s = () => {
      if (i) {
        el();
        return;
      }
      i = !0, o && tl(), Fe.ensure(), j(this, We, 0), _(this, se) !== null && Je(_(this, se), () => {
        j(this, se, null);
      }), this.is_pending = this.has_pending_snippet(), j(this, Ut, bt(this, vt, wr).call(this, () => (j(this, Ke, !1), qt(() => _(this, Ge).call(this, _(this, Xt)))))), _(this, Ce) > 0 ? bt(this, vt, xr).call(this) : this.is_pending = !1;
    };
    var a = J;
    try {
      zt(null), o = !0, n == null || n(e, s), o = !1;
    } catch (u) {
      Cn(u, _(this, oe) && _(this, oe).parent);
    } finally {
      zt(a);
    }
    r && Oe(() => {
      j(this, se, bt(this, vt, wr).call(this, () => {
        Fe.ensure(), j(this, Ke, !0);
        try {
          return qt(() => {
            r(
              _(this, Xt),
              () => e,
              () => s
            );
          });
        } catch (u) {
          return Cn(
            u,
            /** @type {Effect} */
            _(this, oe).parent
          ), null;
        } finally {
          j(this, Ke, !1);
        }
      }));
    });
  }
}
Xt = new WeakMap(), Pi = new WeakMap(), ie = new WeakMap(), Ge = new WeakMap(), oe = new WeakMap(), Ut = new WeakMap(), At = new WeakMap(), se = new WeakMap(), me = new WeakMap(), ze = new WeakMap(), We = new WeakMap(), Ce = new WeakMap(), An = new WeakMap(), Ke = new WeakMap(), Pn = new WeakMap(), In = new WeakMap(), pe = new WeakMap(), Yr = new WeakMap(), vt = new WeakSet(), cl = function() {
  try {
    j(this, Ut, qt(() => _(this, Ge).call(this, _(this, Xt))));
  } catch (e) {
    this.error(e);
  }
}, hl = function() {
  const e = _(this, ie).pending;
  e && (j(this, At, qt(() => e(_(this, Xt)))), Oe(() => {
    var n = bt(this, vt, fi).call(this);
    j(this, Ut, bt(this, vt, wr).call(this, () => (Fe.ensure(), qt(() => _(this, Ge).call(this, n))))), _(this, Ce) > 0 ? bt(this, vt, xr).call(this) : (Je(
      /** @type {Effect} */
      _(this, At),
      () => {
        j(this, At, null);
      }
    ), this.is_pending = !1);
  }));
}, fi = function() {
  var e = _(this, Xt);
  return this.is_pending && (j(this, ze, nn()), _(this, Xt).before(_(this, ze)), e = _(this, ze)), e;
}, /**
 * @param {() => Effect | null} fn
 */
wr = function(e) {
  var n = rt, r = J, i = Kt;
  ue(_(this, oe)), zt(_(this, oe)), zn(_(this, oe).ctx);
  try {
    return e();
  } catch (o) {
    return ts(o), null;
  } finally {
    ue(n), zt(r), zn(i);
  }
}, xr = function() {
  const e = (
    /** @type {(anchor: Node) => void} */
    _(this, ie).pending
  );
  _(this, Ut) !== null && (j(this, me, document.createDocumentFragment()), _(this, me).append(
    /** @type {TemplateNode} */
    _(this, ze)
  ), Es(_(this, Ut), _(this, me))), _(this, At) === null && j(this, At, qt(() => e(_(this, Xt))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
ci = function(e) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && bt(n = this.parent, vt, ci).call(n, e);
    return;
  }
  if (j(this, Ce, _(this, Ce) + e), _(this, Ce) === 0) {
    this.is_pending = !1;
    for (const r of _(this, Pn))
      mt(r, Nt), we(r);
    for (const r of _(this, In))
      mt(r, Ee), we(r);
    _(this, Pn).clear(), _(this, In).clear(), _(this, At) && Je(_(this, At), () => {
      j(this, At, null);
    }), _(this, me) && (_(this, Xt).before(_(this, me)), j(this, me, null));
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
    rt
  ), u = gl(), f = o.length === 1 ? o[0].promise : o.length > 1 ? Promise.all(o.map((h) => h.promise)) : null;
  function c(h) {
    u();
    try {
      r(h);
    } catch (g) {
      (a.f & ye) === 0 && Cn(g, a);
    }
    s == null || s.deactivate(), hi();
  }
  if (n.length === 0) {
    f.then(() => c(e.map(i)));
    return;
  }
  function d() {
    u(), Promise.all(n.map((h) => /* @__PURE__ */ vl(h))).then((h) => c([...e.map(i), ...h])).catch((h) => Cn(h, a));
  }
  f ? f.then(d) : d();
}
function gl() {
  var t = rt, e = J, n = Kt, r = st;
  return function(o = !0) {
    ue(t), zt(e), zn(n), o && (r == null || r.activate());
  };
}
function hi() {
  ue(null), zt(null), zn(null);
}
// @__NO_SIDE_EFFECTS__
function Xr(t) {
  var e = xt | Nt, n = J !== null && (J.f & xt) !== 0 ? (
    /** @type {Derived} */
    J
  ) : null;
  return rt !== null && (rt.f |= Fn), {
    ctx: Kt,
    deps: null,
    effects: null,
    equals: jo,
    f: e,
    fn: t,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      pt
    ),
    wv: 0,
    parent: n ?? rt,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function vl(t, e, n) {
  let r = (
    /** @type {Effect | null} */
    rt
  );
  r === null && qa();
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
  ), a = !J, u = /* @__PURE__ */ new Map();
  return El(() => {
    var g;
    var f = Wo();
    o = f.promise;
    try {
      Promise.resolve(t()).then(f.resolve, f.reject).then(() => {
        c === st && c.committed && c.deactivate(), hi();
      });
    } catch (p) {
      f.reject(p), hi();
    }
    var c = (
      /** @type {Batch} */
      st
    );
    if (a) {
      var d = i.is_rendered();
      i.update_pending_count(1), c.increment(d), (g = u.get(c)) == null || g.reject(mn), u.delete(c), u.set(c, f);
    }
    const h = (p, w = void 0) => {
      if (c.activate(), w)
        w !== mn && (s.f |= Le, Rn(s, w));
      else {
        (s.f & Le) !== 0 && (s.f ^= Le), Rn(s, p);
        for (const [T, k] of u) {
          if (u.delete(T), T === c) break;
          k.reject(mn);
        }
      }
      a && (i.update_pending_count(-1), c.decrement(d));
    };
    f.promise.then(h, (p) => h(null, p || "unknown"));
  }), vs(() => {
    for (const f of u.values())
      f.reject(mn);
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
  return Ss(e), e;
}
// @__NO_SIDE_EFFECTS__
function ss(t) {
  const e = /* @__PURE__ */ Xr(t);
  return e.equals = Qo, e;
}
function as(t) {
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
function ml(t) {
  for (var e = t.parent; e !== null; ) {
    if ((e.f & xt) === 0)
      return (e.f & ye) === 0 ? (
        /** @type {Effect} */
        e
      ) : null;
    e = e.parent;
  }
  return null;
}
function Oi(t) {
  var e, n = rt;
  ue(ml(t));
  try {
    t.f &= ~tn, as(t), e = Ps(t);
  } finally {
    ue(n);
  }
  return e;
}
function ls(t) {
  var e = Oi(t);
  if (!t.equals(e) && (t.wv = Ms(), (!(st != null && st.is_fork) || t.deps === null) && (t.v = e, t.deps === null))) {
    mt(t, kt);
    return;
  }
  Ye || (yt !== null ? (Di() || st != null && st.is_fork) && yt.set(t, e) : Ri(t));
}
let di = /* @__PURE__ */ new Set();
const De = /* @__PURE__ */ new Map();
let us = !1;
function en(t, e) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: t,
    reactions: null,
    equals: jo,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function ht(t, e) {
  const n = en(t);
  return Ss(n), n;
}
// @__NO_SIDE_EFFECTS__
function pl(t, e = !1, n = !0) {
  const r = en(t);
  return e || (r.equals = Qo), r;
}
function X(t, e, n = !1) {
  J !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!te || (J.f & no) !== 0) && $o() && (J.f & (xt | be | Ci | no)) !== 0 && !(St != null && St.includes(t)) && $a();
  let r = n ? It(e) : e;
  return Rn(t, r);
}
function Rn(t, e) {
  if (!t.equals(e)) {
    var n = t.v;
    Ye ? De.set(t, e) : De.set(t, n), t.v = e;
    var r = Fe.ensure();
    if (r.capture(t, n), (t.f & xt) !== 0) {
      const i = (
        /** @type {Derived} */
        t
      );
      (t.f & Nt) !== 0 && Oi(i), Ri(i);
    }
    t.wv = Ms(), fs(t, Nt), rt !== null && (rt.f & kt) !== 0 && (rt.f & (ke | sn)) === 0 && (Vt === null ? Nl([t]) : Vt.push(t)), !r.is_fork && di.size > 0 && !us && _l();
  }
  return e;
}
function _l() {
  us = !1;
  for (const t of di)
    (t.f & kt) !== 0 && mt(t, Ee), ar(t) && Kn(t);
  di.clear();
}
function Gn(t) {
  X(t, t.v + 1);
}
function fs(t, e) {
  var n = t.reactions;
  if (n !== null)
    for (var r = n.length, i = 0; i < r; i++) {
      var o = n[i], s = o.f, a = (s & Nt) === 0;
      if (a && mt(o, e), (s & xt) !== 0) {
        var u = (
          /** @type {Derived} */
          o
        );
        yt == null || yt.delete(u), (s & tn) === 0 && (s & Wt && (o.f |= tn), fs(u, Ee));
      } else a && ((s & be) !== 0 && jt !== null && jt.add(
        /** @type {Effect} */
        o
      ), we(
        /** @type {Effect} */
        o
      ));
    }
}
function It(t) {
  if (typeof t != "object" || t === null || je in t)
    return t;
  const e = Ii(t);
  if (e !== Ya && e !== Ha)
    return t;
  var n = /* @__PURE__ */ new Map(), r = qo(t), i = /* @__PURE__ */ ht(0), o = Qe, s = (a) => {
    if (Qe === o)
      return a();
    var u = J, f = Qe;
    zt(null), so(o);
    var c = a();
    return zt(u), so(f), c;
  };
  return r && n.set("length", /* @__PURE__ */ ht(
    /** @type {any[]} */
    t.length
  )), new Proxy(
    /** @type {any} */
    t,
    {
      defineProperty(a, u, f) {
        (!("value" in f) || f.configurable === !1 || f.enumerable === !1 || f.writable === !1) && Ja();
        var c = n.get(u);
        return c === void 0 ? c = s(() => {
          var d = /* @__PURE__ */ ht(f.value);
          return n.set(u, d), d;
        }) : X(c, f.value, !0), !0;
      },
      deleteProperty(a, u) {
        var f = n.get(u);
        if (f === void 0) {
          if (u in a) {
            const c = s(() => /* @__PURE__ */ ht(pt));
            n.set(u, c), Gn(i);
          }
        } else
          X(f, pt), Gn(i);
        return !0;
      },
      get(a, u, f) {
        var g;
        if (u === je)
          return t;
        var c = n.get(u), d = u in a;
        if (c === void 0 && (!d || (g = yn(a, u)) != null && g.writable) && (c = s(() => {
          var p = It(d ? a[u] : pt), w = /* @__PURE__ */ ht(p);
          return w;
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
        if (u === je)
          return !0;
        var f = n.get(u), c = f !== void 0 && f.v !== pt || Reflect.has(a, u);
        if (f !== void 0 || rt !== null && (!c || (h = yn(a, u)) != null && h.writable)) {
          f === void 0 && (f = s(() => {
            var g = c ? It(a[u]) : pt, p = /* @__PURE__ */ ht(g);
            return p;
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
            var p = n.get(g + "");
            p !== void 0 ? X(p, pt) : g in a && (p = s(() => /* @__PURE__ */ ht(pt)), n.set(g + "", p));
          }
        if (d === void 0)
          (!h || (P = yn(a, u)) != null && P.writable) && (d = s(() => /* @__PURE__ */ ht(void 0)), X(d, It(f)), n.set(u, d));
        else {
          h = d.v !== pt;
          var w = s(() => It(f));
          X(d, w);
        }
        var T = Reflect.getOwnPropertyDescriptor(a, u);
        if (T != null && T.set && T.set.call(c, f), !h) {
          if (r && typeof u == "string") {
            var k = (
              /** @type {Source<number>} */
              n.get("length")
            ), V = Number(u);
            Number.isInteger(V) && V >= k.v && X(k, V + 1);
          }
          Gn(i);
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
        Qa();
      }
    }
  );
}
var io, cs, hs, ds;
function yl() {
  if (io === void 0) {
    io = window, cs = /Firefox/.test(navigator.userAgent);
    var t = Element.prototype, e = Node.prototype, n = Text.prototype;
    hs = yn(e, "firstChild").get, ds = yn(e, "nextSibling").get, eo(t) && (t.__click = void 0, t.__className = void 0, t.__attributes = null, t.__style = void 0, t.__e = void 0), eo(n) && (n.__t = void 0);
  }
}
function nn(t = "") {
  return document.createTextNode(t);
}
// @__NO_SIDE_EFFECTS__
function Gt(t) {
  return (
    /** @type {TemplateNode | null} */
    hs.call(t)
  );
}
// @__NO_SIDE_EFFECTS__
function sr(t) {
  return (
    /** @type {TemplateNode | null} */
    ds.call(t)
  );
}
function dt(t, e) {
  return /* @__PURE__ */ Gt(t);
}
function Yt(t, e = !1) {
  {
    var n = /* @__PURE__ */ Gt(t);
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
function wl(t) {
  t.textContent = "";
}
function gs() {
  return !1;
}
function Fi(t) {
  var e = J, n = rt;
  zt(null), ue(null);
  try {
    return t();
  } finally {
    zt(e), ue(n);
  }
}
function xl(t) {
  rt === null && (J === null && Ka(), Wa()), Ye && Ga();
}
function bl(t, e) {
  var n = e.last;
  n === null ? e.last = e.first = t : (n.next = t, t.prev = n, e.last = t);
}
function Se(t, e, n) {
  var r = rt;
  r !== null && (r.f & Ht) !== 0 && (t |= Ht);
  var i = {
    ctx: Kt,
    deps: null,
    nodes: null,
    f: t | Nt | Wt,
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
      Kn(i), i.f |= zi;
    } catch (a) {
      throw Rt(i), a;
    }
  else e !== null && we(i);
  var o = i;
  if (n && o.deps === null && o.teardown === null && o.nodes === null && o.first === o.last && // either `null`, or a singular child
  (o.f & Fn) === 0 && (o = o.first, (t & be) !== 0 && (t & Tn) !== 0 && o !== null && (o.f |= Tn)), o !== null && (o.parent = r, r !== null && bl(o, r), J !== null && (J.f & xt) !== 0 && (t & sn) === 0)) {
    var s = (
      /** @type {Derived} */
      J
    );
    (s.effects ?? (s.effects = [])).push(o);
  }
  return i;
}
function Di() {
  return J !== null && !te;
}
function vs(t) {
  const e = Se(Vr, null, !1);
  return mt(e, kt), e.teardown = t, e;
}
function gi(t) {
  xl();
  var e = (
    /** @type {Effect} */
    rt.f
  ), n = !J && (e & ke) !== 0 && (e & zi) === 0;
  if (n) {
    var r = (
      /** @type {ComponentContext} */
      Kt
    );
    (r.e ?? (r.e = [])).push(t);
  } else
    return ms(t);
}
function ms(t) {
  return Se(Ar | Va, t, !1);
}
function kl(t) {
  Fe.ensure();
  const e = Se(sn | Fn, t, !0);
  return (n = {}) => new Promise((r) => {
    n.outro ? Je(e, () => {
      Rt(e), r(void 0);
    }) : (Rt(e), r(void 0));
  });
}
function ps(t) {
  return Se(Ar, t, !1);
}
function El(t) {
  return Se(Ci | Fn, t, !0);
}
function Yi(t, e = 0) {
  return Se(Vr | e, t, !0);
}
function lt(t, e = [], n = [], r = []) {
  dl(r, e, n, (i) => {
    Se(Vr, () => t(...i.map(l)), !0);
  });
}
function Hi(t, e = 0) {
  var n = Se(be | e, t, !0);
  return n;
}
function qt(t) {
  return Se(ke | Fn, t, !0);
}
function _s(t) {
  var e = t.teardown;
  if (e !== null) {
    const n = Ye, r = J;
    oo(!0), zt(null);
    try {
      e.call(null);
    } finally {
      oo(n), zt(r);
    }
  }
}
function ys(t, e = !1) {
  var n = t.first;
  for (t.first = t.last = null; n !== null; ) {
    const i = n.ac;
    i !== null && Fi(() => {
      i.abort(mn);
    });
    var r = n.next;
    (n.f & sn) !== 0 ? n.parent = null : Rt(n, e), n = r;
  }
}
function Sl(t) {
  for (var e = t.first; e !== null; ) {
    var n = e.next;
    (e.f & ke) === 0 && Rt(e), e = n;
  }
}
function Rt(t, e = !0) {
  var n = !1;
  (e || (t.f & Zo) !== 0) && t.nodes !== null && t.nodes.end !== null && (ws(
    t.nodes.start,
    /** @type {TemplateNode} */
    t.nodes.end
  ), n = !0), ys(t, e && !n), Pr(t, 0), mt(t, ye);
  var r = t.nodes && t.nodes.t;
  if (r !== null)
    for (const o of r)
      o.stop();
  _s(t);
  var i = t.parent;
  i !== null && i.first !== null && xs(t), t.next = t.prev = t.teardown = t.ctx = t.deps = t.fn = t.nodes = t.ac = null;
}
function ws(t, e) {
  for (; t !== null; ) {
    var n = t === e ? null : /* @__PURE__ */ sr(t);
    t.remove(), t = n;
  }
}
function xs(t) {
  var e = t.parent, n = t.prev, r = t.next;
  n !== null && (n.next = r), r !== null && (r.prev = n), e !== null && (e.first === t && (e.first = r), e.last === t && (e.last = n));
}
function Je(t, e, n = !0) {
  var r = [];
  bs(t, r, !0);
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
function bs(t, e, n) {
  if ((t.f & Ht) === 0) {
    t.f ^= Ht;
    var r = t.nodes && t.nodes.t;
    if (r !== null)
      for (const a of r)
        (a.is_global || n) && e.push(a);
    for (var i = t.first; i !== null; ) {
      var o = i.next, s = (i.f & Tn) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (i.f & ke) !== 0 && (t.f & be) !== 0;
      bs(i, e, s ? n : !1), i = o;
    }
  }
}
function Bi(t) {
  ks(t, !0);
}
function ks(t, e) {
  if ((t.f & Ht) !== 0) {
    t.f ^= Ht, (t.f & kt) === 0 && (mt(t, Nt), we(t));
    for (var n = t.first; n !== null; ) {
      var r = n.next, i = (n.f & Tn) !== 0 || (n.f & ke) !== 0;
      ks(n, i ? e : !1), n = r;
    }
    var o = t.nodes && t.nodes.t;
    if (o !== null)
      for (const s of o)
        (s.is_global || e) && s.in();
  }
}
function Es(t, e) {
  if (t.nodes)
    for (var n = t.nodes.start, r = t.nodes.end; n !== null; ) {
      var i = n === r ? null : /* @__PURE__ */ sr(n);
      e.append(n), n = i;
    }
}
let br = !1, Ye = !1;
function oo(t) {
  Ye = t;
}
let J = null, te = !1;
function zt(t) {
  J = t;
}
let rt = null;
function ue(t) {
  rt = t;
}
let St = null;
function Ss(t) {
  J !== null && (St === null ? St = [t] : St.push(t));
}
let Pt = null, Ft = 0, Vt = null;
function Nl(t) {
  Vt = t;
}
let Ns = 1, Xe = 0, Qe = Xe;
function so(t) {
  Qe = t;
}
function Ms() {
  return ++Ns;
}
function ar(t) {
  var e = t.f;
  if ((e & Nt) !== 0)
    return !0;
  if (e & xt && (t.f &= ~tn), (e & Ee) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      t.deps
    ), r = n.length, i = 0; i < r; i++) {
      var o = n[i];
      if (ar(
        /** @type {Derived} */
        o
      ) && ls(
        /** @type {Derived} */
        o
      ), o.wv > t.wv)
        return !0;
    }
    (e & Wt) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    yt === null && mt(t, kt);
  }
  return !1;
}
function As(t, e, n = !0) {
  var r = t.reactions;
  if (r !== null && !(St != null && St.includes(t)))
    for (var i = 0; i < r.length; i++) {
      var o = r[i];
      (o.f & xt) !== 0 ? As(
        /** @type {Derived} */
        o,
        e,
        !1
      ) : e === o && (n ? mt(o, Nt) : (o.f & kt) !== 0 && mt(o, Ee), we(
        /** @type {Effect} */
        o
      ));
    }
}
function Ps(t) {
  var p;
  var e = Pt, n = Ft, r = Vt, i = J, o = St, s = Kt, a = te, u = Qe, f = t.f;
  Pt = /** @type {null | Value[]} */
  null, Ft = 0, Vt = null, J = (f & (ke | sn)) === 0 ? t : null, St = null, zn(t.ctx), te = !1, Qe = ++Xe, t.ac !== null && (Fi(() => {
    t.ac.abort(mn);
  }), t.ac = null);
  try {
    t.f |= si;
    var c = (
      /** @type {Function} */
      t.fn
    ), d = c(), h = t.deps;
    if (Pt !== null) {
      var g;
      if (Pr(t, Ft), h !== null && Ft > 0)
        for (h.length = Ft + Pt.length, g = 0; g < Pt.length; g++)
          h[Ft + g] = Pt[g];
      else
        t.deps = h = Pt;
      if (Di() && (t.f & Wt) !== 0)
        for (g = Ft; g < h.length; g++)
          ((p = h[g]).reactions ?? (p.reactions = [])).push(t);
    } else h !== null && Ft < h.length && (Pr(t, Ft), h.length = Ft);
    if ($o() && Vt !== null && !te && h !== null && (t.f & (xt | Ee | Nt)) === 0)
      for (g = 0; g < /** @type {Source[]} */
      Vt.length; g++)
        As(
          Vt[g],
          /** @type {Effect} */
          t
        );
    if (i !== null && i !== t) {
      if (Xe++, i.deps !== null)
        for (let w = 0; w < n; w += 1)
          i.deps[w].rv = Xe;
      if (e !== null)
        for (const w of e)
          w.rv = Xe;
      Vt !== null && (r === null ? r = Vt : r.push(.../** @type {Source[]} */
      Vt));
    }
    return (t.f & Le) !== 0 && (t.f ^= Le), d;
  } catch (w) {
    return ts(w);
  } finally {
    t.f ^= si, Pt = e, Ft = n, Vt = r, J = i, St = o, zn(s), te = a, Qe = u;
  }
}
function Ml(t, e) {
  let n = e.reactions;
  if (n !== null) {
    var r = Fa.call(n, t);
    if (r !== -1) {
      var i = n.length - 1;
      i === 0 ? n = e.reactions = null : (n[r] = n[i], n.pop());
    }
  }
  if (n === null && (e.f & xt) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (Pt === null || !Pt.includes(e))) {
    var o = (
      /** @type {Derived} */
      e
    );
    (o.f & Wt) !== 0 && (o.f ^= Wt, o.f &= ~tn), Ri(o), as(o), Pr(o, 0);
  }
}
function Pr(t, e) {
  var n = t.deps;
  if (n !== null)
    for (var r = e; r < n.length; r++)
      Ml(t, n[r]);
}
function Kn(t) {
  var e = t.f;
  if ((e & ye) === 0) {
    mt(t, kt);
    var n = rt, r = br;
    rt = t, br = !0;
    try {
      (e & (be | Ko)) !== 0 ? Sl(t) : ys(t), _s(t);
      var i = Ps(t);
      t.teardown = typeof i == "function" ? i : null, t.wv = Ns;
      var o;
      oi && nl && (t.f & Nt) !== 0 && t.deps;
    } finally {
      br = r, rt = n;
    }
  }
}
function l(t) {
  var e = t.f, n = (e & xt) !== 0;
  if (J !== null && !te) {
    var r = rt !== null && (rt.f & ye) !== 0;
    if (!r && !(St != null && St.includes(t))) {
      var i = J.deps;
      if ((J.f & si) !== 0)
        t.rv < Xe && (t.rv = Xe, Pt === null && i !== null && i[Ft] === t ? Ft++ : Pt === null ? Pt = [t] : Pt.push(t));
      else {
        (J.deps ?? (J.deps = [])).push(t);
        var o = t.reactions;
        o === null ? t.reactions = [J] : o.includes(J) || o.push(J);
      }
    }
  }
  if (Ye && De.has(t))
    return De.get(t);
  if (n) {
    var s = (
      /** @type {Derived} */
      t
    );
    if (Ye) {
      var a = s.v;
      return ((s.f & kt) === 0 && s.reactions !== null || Ts(s)) && (a = Oi(s)), De.set(s, a), a;
    }
    var u = (s.f & Wt) === 0 && !te && J !== null && (br || (J.f & Wt) !== 0), f = s.deps === null;
    ar(s) && (u && (s.f |= Wt), ls(s)), u && !f && Is(s);
  }
  if (yt != null && yt.has(t))
    return yt.get(t);
  if ((t.f & Le) !== 0)
    throw t.v;
  return t.v;
}
function Is(t) {
  if (t.deps !== null) {
    t.f |= Wt;
    for (const e of t.deps)
      (e.reactions ?? (e.reactions = [])).push(t), (e.f & xt) !== 0 && (e.f & Wt) === 0 && Is(
        /** @type {Derived} */
        e
      );
  }
}
function Ts(t) {
  if (t.v === pt) return !0;
  if (t.deps === null) return !1;
  for (const e of t.deps)
    if (De.has(e) || (e.f & xt) !== 0 && Ts(
      /** @type {Derived} */
      e
    ))
      return !0;
  return !1;
}
function Ur(t) {
  var e = te;
  try {
    return te = !0, t();
  } finally {
    te = e;
  }
}
function Al(t) {
  if (!(typeof t != "object" || !t || t instanceof EventTarget)) {
    if (je in t)
      vi(t);
    else if (!Array.isArray(t))
      for (let e in t) {
        const n = t[e];
        typeof n == "object" && n && je in n && vi(n);
      }
  }
}
function vi(t, e = /* @__PURE__ */ new Set()) {
  if (typeof t == "object" && t !== null && // We don't want to traverse DOM elements
  !(t instanceof EventTarget) && !e.has(t)) {
    e.add(t), t instanceof Date && t.getTime();
    for (let r in t)
      try {
        vi(t[r], e);
      } catch {
      }
    const n = Ii(t);
    if (n !== Object.prototype && n !== Array.prototype && n !== Map.prototype && n !== Set.prototype && n !== Date.prototype) {
      const r = Go(n);
      for (let i in r) {
        const o = r[i].get;
        if (o)
          try {
            o.call(t);
          } catch {
          }
      }
    }
  }
}
const zs = /* @__PURE__ */ new Set(), mi = /* @__PURE__ */ new Set();
function Pl(t, e, n, r = {}) {
  function i(o) {
    if (r.capture || Vn.call(e, o), !o.cancelBubble)
      return Fi(() => n == null ? void 0 : n.call(this, o));
  }
  return t.startsWith("pointer") || t.startsWith("touch") || t === "wheel" ? Oe(() => {
    e.addEventListener(t, i, r);
  }) : e.addEventListener(t, i, r), i;
}
function Ie(t, e, n, r, i) {
  var o = { capture: r, passive: i }, s = Pl(t, e, n, o);
  (e === document.body || // @ts-ignore
  e === window || // @ts-ignore
  e === document || // Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
  e instanceof HTMLMediaElement) && vs(() => {
    e.removeEventListener(t, s, o);
  });
}
function lr(t) {
  for (var e = 0; e < t.length; e++)
    zs.add(t[e]);
  for (var n of mi)
    n(t);
}
let ao = null;
function Vn(t) {
  var T;
  var e = this, n = (
    /** @type {Node} */
    e.ownerDocument
  ), r = t.type, i = ((T = t.composedPath) == null ? void 0 : T.call(t)) || [], o = (
    /** @type {null | Element} */
    i[0] || t.target
  );
  ao = t;
  var s = 0, a = ao === t && t.__root;
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
    Da(t, "currentTarget", {
      configurable: !0,
      get() {
        return o || n;
      }
    });
    var c = J, d = rt;
    zt(null), ue(null);
    try {
      for (var h, g = []; o !== null; ) {
        var p = o.assignedSlot || o.parentNode || /** @type {any} */
        o.host || null;
        try {
          var w = o["__" + r];
          w != null && (!/** @type {any} */
          o.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
          // -> the target could not have been disabled because it emits the event in the first place
          t.target === o) && w.call(o, t);
        } catch (k) {
          h ? g.push(k) : h = k;
        }
        if (t.cancelBubble || p === e || p === null)
          break;
        o = p;
      }
      if (h) {
        for (let k of g)
          queueMicrotask(() => {
            throw k;
          });
        throw h;
      }
    } finally {
      t.__root = e, delete t.currentTarget, zt(c), ue(d);
    }
  }
}
function Vi(t) {
  var e = document.createElement("template");
  return e.innerHTML = t.replaceAll("<!>", "<!---->"), e.content;
}
function Zn(t, e) {
  var n = (
    /** @type {Effect} */
    rt
  );
  n.nodes === null && (n.nodes = { start: t, end: e, a: null, t: null });
}
// @__NO_SIDE_EFFECTS__
function Il(t, e) {
  var n = (e & 2) !== 0, r, i = !t.startsWith("<!>");
  return () => {
    r === void 0 && (r = Vi(i ? t : "<!>" + t), r = /** @type {TemplateNode} */
    /* @__PURE__ */ Gt(r));
    var o = (
      /** @type {TemplateNode} */
      n || cs ? document.importNode(r, !0) : r.cloneNode(!0)
    );
    return Zn(o, o), o;
  };
}
// @__NO_SIDE_EFFECTS__
function Tl(t, e, n = "svg") {
  var r = !t.startsWith("<!>"), i = (e & 1) !== 0, o = `<${n}>${r ? t : "<!>" + t}</${n}>`, s;
  return () => {
    if (!s) {
      var a = (
        /** @type {DocumentFragment} */
        Vi(o)
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
    var f = (
      /** @type {TemplateNode} */
      s.cloneNode(!0)
    );
    if (i) {
      var c = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ Gt(f)
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
function ut(t, e) {
  return /* @__PURE__ */ Tl(t, e, "svg");
}
function Pe() {
  var t = document.createDocumentFragment(), e = document.createComment(""), n = nn();
  return t.append(e, n), Zn(e, n), t;
}
function et(t, e) {
  t !== null && t.before(
    /** @type {Node} */
    e
  );
}
const zl = ["touchstart", "touchmove"];
function Cl(t) {
  return zl.includes(t);
}
function jn(t, e) {
  var n = e == null ? "" : typeof e == "object" ? e + "" : e;
  n !== (t.__t ?? (t.__t = t.nodeValue)) && (t.__t = n, t.nodeValue = n + "");
}
function Rl(t, e) {
  return Ll(t, e);
}
const gn = /* @__PURE__ */ new Map();
function Ll(t, { target: e, anchor: n, props: r = {}, events: i, context: o, intro: s = !0 }) {
  yl();
  var a = /* @__PURE__ */ new Set(), u = (d) => {
    for (var h = 0; h < d.length; h++) {
      var g = d[h];
      if (!a.has(g)) {
        a.add(g);
        var p = Cl(g);
        e.addEventListener(g, Vn, { passive: p });
        var w = gn.get(g);
        w === void 0 ? (document.addEventListener(g, Vn, { passive: p }), gn.set(g, 1)) : gn.set(g, w + 1);
      }
    }
  };
  u(Br(zs)), mi.add(u);
  var f = void 0, c = kl(() => {
    var d = n ?? e.appendChild(nn());
    return ul(
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
        i && (r.$$events = i), f = t(h, r) || {}, o && ln();
      }
    ), () => {
      var p;
      for (var h of a) {
        e.removeEventListener(h, Vn);
        var g = (
          /** @type {number} */
          gn.get(h)
        );
        --g === 0 ? (document.removeEventListener(h, Vn), gn.delete(h)) : gn.set(h, g);
      }
      mi.delete(u), d !== n && ((p = d.parentNode) == null || p.removeChild(d));
    };
  });
  return pi.set(f, c), f;
}
let pi = /* @__PURE__ */ new WeakMap();
function lo(t, e) {
  const n = pi.get(t);
  return n ? (pi.delete(t), n(e)) : Promise.resolve();
}
var Qt, ae, Dt, Ze, ir, or, Hr;
class Ol {
  /**
   * @param {TemplateNode} anchor
   * @param {boolean} transition
   */
  constructor(e, n = !0) {
    /** @type {TemplateNode} */
    Ot(this, "anchor");
    /** @type {Map<Batch, Key>} */
    $(this, Qt, /* @__PURE__ */ new Map());
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
    $(this, ae, /* @__PURE__ */ new Map());
    /**
     * Similar to #onscreen with respect to the keys, but contains branches that are not yet
     * in the DOM, because their insertion is deferred.
     * @type {Map<Key, Branch>}
     */
    $(this, Dt, /* @__PURE__ */ new Map());
    /**
     * Keys of effects that are currently outroing
     * @type {Set<Key>}
     */
    $(this, Ze, /* @__PURE__ */ new Set());
    /**
     * Whether to pause (i.e. outro) on change, or destroy immediately.
     * This is necessary for `<svelte:element>`
     */
    $(this, ir, !0);
    $(this, or, () => {
      var e = (
        /** @type {Batch} */
        st
      );
      if (_(this, Qt).has(e)) {
        var n = (
          /** @type {Key} */
          _(this, Qt).get(e)
        ), r = _(this, ae).get(n);
        if (r)
          Bi(r), _(this, Ze).delete(n);
        else {
          var i = _(this, Dt).get(n);
          i && (_(this, ae).set(n, i.effect), _(this, Dt).delete(n), i.fragment.lastChild.remove(), this.anchor.before(i.fragment), r = i.effect);
        }
        for (const [o, s] of _(this, Qt)) {
          if (_(this, Qt).delete(o), o === e)
            break;
          const a = _(this, Dt).get(s);
          a && (Rt(a.effect), _(this, Dt).delete(s));
        }
        for (const [o, s] of _(this, ae)) {
          if (o === n || _(this, Ze).has(o)) continue;
          const a = () => {
            if (Array.from(_(this, Qt).values()).includes(o)) {
              var f = document.createDocumentFragment();
              Es(s, f), f.append(nn()), _(this, Dt).set(o, { effect: s, fragment: f });
            } else
              Rt(s);
            _(this, Ze).delete(o), _(this, ae).delete(o);
          };
          _(this, ir) || !r ? (_(this, Ze).add(o), Je(s, a, !1)) : a();
        }
      }
    });
    /**
     * @param {Batch} batch
     */
    $(this, Hr, (e) => {
      _(this, Qt).delete(e);
      const n = Array.from(_(this, Qt).values());
      for (const [r, i] of _(this, Dt))
        n.includes(r) || (Rt(i.effect), _(this, Dt).delete(r));
    });
    this.anchor = e, j(this, ir, n);
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
    ), i = gs();
    if (n && !_(this, ae).has(e) && !_(this, Dt).has(e))
      if (i) {
        var o = document.createDocumentFragment(), s = nn();
        o.append(s), _(this, Dt).set(e, {
          effect: qt(() => n(s)),
          fragment: o
        });
      } else
        _(this, ae).set(
          e,
          qt(() => n(this.anchor))
        );
    if (_(this, Qt).set(r, e), i) {
      for (const [a, u] of _(this, ae))
        a === e ? r.skipped_effects.delete(u) : r.skipped_effects.add(u);
      for (const [a, u] of _(this, Dt))
        a === e ? r.skipped_effects.delete(u.effect) : r.skipped_effects.add(u.effect);
      r.oncommit(_(this, or)), r.ondiscard(_(this, Hr));
    } else
      _(this, or).call(this);
  }
}
Qt = new WeakMap(), ae = new WeakMap(), Dt = new WeakMap(), Ze = new WeakMap(), ir = new WeakMap(), or = new WeakMap(), Hr = new WeakMap();
function _t(t, e, n = !1) {
  var r = new Ol(t), i = n ? Tn : 0;
  function o(s, a) {
    r.ensure(s, a);
  }
  Hi(() => {
    var s = !1;
    e((a, u = !0) => {
      s = !0, o(u, a);
    }), s || o(!1, null);
  }, i);
}
function Cs(t, e) {
  return e;
}
function Fl(t, e, n) {
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
            _i(Br(o.done)), h.delete(o), h.size === 0 && (t.outrogroups = null);
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
    _i(e, !u);
  } else
    o = {
      pending: new Set(e),
      done: /* @__PURE__ */ new Set()
    }, (t.outrogroups ?? (t.outrogroups = /* @__PURE__ */ new Set())).add(o);
}
function _i(t, e = !0) {
  for (var n = 0; n < t.length; n++)
    Rt(t[n], e);
}
var uo;
function _n(t, e, n, r, i, o = null) {
  var s = t, a = /* @__PURE__ */ new Map(), u = null, f = /* @__PURE__ */ ss(() => {
    var w = n();
    return qo(w) ? w : w == null ? [] : Br(w);
  }), c, d = !0;
  function h() {
    p.fallback = u, Dl(p, c, s, e, r), u !== null && (c.length === 0 ? (u.f & Re) === 0 ? Bi(u) : (u.f ^= Re, Xn(u, null, s)) : Je(u, () => {
      u = null;
    }));
  }
  var g = Hi(() => {
    c = /** @type {V[]} */
    l(f);
    for (var w = c.length, T = /* @__PURE__ */ new Set(), k = (
      /** @type {Batch} */
      st
    ), V = gs(), P = 0; P < w; P += 1) {
      var y = c[P], I = r(y, P), b = d ? null : a.get(I);
      b ? (b.v && Rn(b.v, y), b.i && Rn(b.i, P), V && k.skipped_effects.delete(b.e)) : (b = Yl(
        a,
        d ? s : uo ?? (uo = nn()),
        y,
        I,
        P,
        i,
        e,
        n
      ), d || (b.e.f |= Re), a.set(I, b)), T.add(I);
    }
    if (w === 0 && o && !u && (d ? u = qt(() => o(s)) : (u = qt(() => o(uo ?? (uo = nn()))), u.f |= Re)), !d)
      if (V) {
        for (const [N, C] of a)
          T.has(N) || k.skipped_effects.add(C.e);
        k.oncommit(h), k.ondiscard(() => {
        });
      } else
        h();
    l(f);
  }), p = { effect: g, items: a, outrogroups: null, fallback: u };
  d = !1;
}
function Dl(t, e, n, r, i) {
  var C;
  var o = e.length, s = t.items, a = t.effect.first, u, f = null, c = [], d = [], h, g, p, w;
  for (w = 0; w < o; w += 1) {
    if (h = e[w], g = i(h, w), p = /** @type {EachItem} */
    s.get(g).e, t.outrogroups !== null)
      for (const Y of t.outrogroups)
        Y.pending.delete(p), Y.done.delete(p);
    if ((p.f & Re) !== 0)
      if (p.f ^= Re, p === a)
        Xn(p, null, n);
      else {
        var T = f ? f.next : a;
        p === t.effect.last && (t.effect.last = p.prev), p.prev && (p.prev.next = p.next), p.next && (p.next.prev = p.prev), Ae(t, f, p), Ae(t, p, T), Xn(p, T, n), f = p, c = [], d = [], a = f.next;
        continue;
      }
    if ((p.f & Ht) !== 0 && Bi(p), p !== a) {
      if (u !== void 0 && u.has(p)) {
        if (c.length < d.length) {
          var k = d[0], V;
          f = k.prev;
          var P = c[0], y = c[c.length - 1];
          for (V = 0; V < c.length; V += 1)
            Xn(c[V], k, n);
          for (V = 0; V < d.length; V += 1)
            u.delete(d[V]);
          Ae(t, P.prev, y.next), Ae(t, f, P), Ae(t, y, k), a = k, f = y, w -= 1, c = [], d = [];
        } else
          u.delete(p), Xn(p, a, n), Ae(t, p.prev, p.next), Ae(t, p, f === null ? t.effect.first : f.next), Ae(t, f, p), f = p;
        continue;
      }
      for (c = [], d = []; a !== null && a !== p; )
        (u ?? (u = /* @__PURE__ */ new Set())).add(a), d.push(a), a = a.next;
      if (a === null)
        continue;
    }
    (p.f & Re) === 0 && c.push(p), f = p, a = p.next;
  }
  if (t.outrogroups !== null) {
    for (const Y of t.outrogroups)
      Y.pending.size === 0 && (_i(Br(Y.done)), (C = t.outrogroups) == null || C.delete(Y));
    t.outrogroups.size === 0 && (t.outrogroups = null);
  }
  if (a !== null || u !== void 0) {
    var I = [];
    if (u !== void 0)
      for (p of u)
        (p.f & Ht) === 0 && I.push(p);
    for (; a !== null; )
      (a.f & Ht) === 0 && a !== t.fallback && I.push(a), a = a.next;
    var b = I.length;
    if (b > 0) {
      var N = null;
      Fl(t, I, N);
    }
  }
}
function Yl(t, e, n, r, i, o, s, a) {
  var u = (s & 1) !== 0 ? (s & 16) === 0 ? /* @__PURE__ */ pl(n, !1, !1) : en(n) : null, f = (s & 2) !== 0 ? en(i) : null;
  return {
    v: u,
    i: f,
    e: qt(() => (o(e, u ?? n, f ?? i, a), () => {
      t.delete(r);
    }))
  };
}
function Xn(t, e, n) {
  if (t.nodes)
    for (var r = t.nodes.start, i = t.nodes.end, o = e && (e.f & Re) === 0 ? (
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
function Rs(t, e, n = !1, r = !1, i = !1) {
  var o = t, s = "";
  lt(() => {
    var a = (
      /** @type {Effect} */
      rt
    );
    if (s !== (s = e() ?? "") && (a.nodes !== null && (ws(
      a.nodes.start,
      /** @type {TemplateNode} */
      a.nodes.end
    ), a.nodes = null), s !== "")) {
      var u = s + "";
      n ? u = `<svg>${u}</svg>` : r && (u = `<math>${u}</math>`);
      var f = Vi(u);
      if ((n || r) && (f = /** @type {Element} */
      /* @__PURE__ */ Gt(f)), Zn(
        /** @type {TemplateNode} */
        /* @__PURE__ */ Gt(f),
        /** @type {TemplateNode} */
        f.lastChild
      ), n || r)
        for (; /* @__PURE__ */ Gt(f); )
          o.before(
            /** @type {TemplateNode} */
            /* @__PURE__ */ Gt(f)
          );
      else
        o.before(f);
    }
  });
}
function Ls(t, e, n) {
  ps(() => {
    var r = Ur(() => e(t, n == null ? void 0 : n()) || {});
    if (n && (r != null && r.update)) {
      var i = !1, o = (
        /** @type {any} */
        {}
      );
      Yi(() => {
        var s = n();
        Al(s), i && Jo(o, s) && (o = s, r.update(s));
      }), i = !0;
    }
    if (r != null && r.destroy)
      return () => (
        /** @type {Function} */
        r.destroy()
      );
  });
}
function Os(t) {
  var e, n, r = "";
  if (typeof t == "string" || typeof t == "number") r += t;
  else if (typeof t == "object") if (Array.isArray(t)) {
    var i = t.length;
    for (e = 0; e < i; e++) t[e] && (n = Os(t[e])) && (r && (r += " "), r += n);
  } else for (n in t) t[n] && (r && (r += " "), r += n);
  return r;
}
function Hl() {
  for (var t, e, n = 0, r = "", i = arguments.length; n < i; n++) (t = arguments[n]) && (e = Os(t)) && (r && (r += " "), r += e);
  return r;
}
function Bl(t) {
  return typeof t == "object" ? Hl(t) : t ?? "";
}
const fo = [...` 	
\r\f \v\uFEFF`];
function Vl(t, e, n) {
  var r = t == null ? "" : "" + t;
  if (e && (r = r ? r + " " + e : e), n) {
    for (var i in n)
      if (n[i])
        r = r ? r + " " + i : i;
      else if (r.length)
        for (var o = i.length, s = 0; (s = r.indexOf(i, s)) >= 0; ) {
          var a = s + o;
          (s === 0 || fo.includes(r[s - 1])) && (a === r.length || fo.includes(r[a])) ? r = (s === 0 ? "" : r.substring(0, s)) + r.substring(a + 1) : s = a;
        }
  }
  return r === "" ? null : r;
}
function Xl(t, e) {
  return t == null ? null : String(t);
}
function Xi(t, e, n, r, i, o) {
  var s = t.__className;
  if (s !== n || s === void 0) {
    var a = Vl(n, r, o);
    a == null ? t.removeAttribute("class") : t.setAttribute("class", a), t.__className = n;
  } else if (o && i !== o)
    for (var u in o) {
      var f = !!o[u];
      (i == null || f !== !!i[u]) && t.classList.toggle(u, f);
    }
  return o;
}
function Ul(t, e, n, r) {
  var i = t.__style;
  if (i !== e) {
    var o = Xl(e);
    o == null ? t.removeAttribute("style") : t.style.cssText = o, t.__style = e;
  }
  return r;
}
const ql = Symbol("is custom element"), Gl = Symbol("is html");
function v(t, e, n, r) {
  var i = Wl(t);
  i[e] !== (i[e] = n) && (e === "loading" && (t[Ua] = n), n == null ? t.removeAttribute(e) : typeof n != "string" && Kl(t).includes(e) ? t[e] = n : t.setAttribute(e, n));
}
function Wl(t) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    t.__attributes ?? (t.__attributes = {
      [ql]: t.nodeName.includes("-"),
      [Gl]: t.namespaceURI === Oa
    })
  );
}
var co = /* @__PURE__ */ new Map();
function Kl(t) {
  var e = t.getAttribute("is") || t.nodeName, n = co.get(e);
  if (n) return n;
  co.set(e, n = []);
  for (var r, i = t, o = Element.prototype; o !== i; ) {
    r = Go(i);
    for (var s in r)
      r[s].set && n.push(s);
    i = Ii(i);
  }
  return n;
}
function ho(t, e) {
  return t === e || (t == null ? void 0 : t[je]) === e;
}
function go(t = {}, e, n, r) {
  return ps(() => {
    var i, o;
    return Yi(() => {
      i = o, o = [], Ur(() => {
        t !== n(...o) && (e(t, ...o), i && ho(n(...i), t) && e(null, ...i));
      });
    }), () => {
      Oe(() => {
        o && ho(n(...o), t) && e(null, ...o);
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
function wt(t, e, n, r) {
  var V;
  var i = (n & 8) !== 0, o = (n & 16) !== 0, s = (
    /** @type {V} */
    r
  ), a = !0, u = () => (a && (a = !1, s = o ? Ur(
    /** @type {() => V} */
    r
  ) : (
    /** @type {V} */
    r
  )), s), f;
  if (i) {
    var c = je in t || Xa in t;
    f = ((V = yn(t, e)) == null ? void 0 : V.set) ?? (c && e in t ? (P) => t[e] = P : void 0);
  }
  var d, h = !1;
  i ? [d, h] = Zl(() => (
    /** @type {V} */
    t[e]
  )) : d = /** @type {V} */
  t[e], d === void 0 && r !== void 0 && (d = u(), f && (ja(), f(d)));
  var g;
  if (g = () => {
    var P = (
      /** @type {V} */
      t[e]
    );
    return P === void 0 ? u() : (a = !0, P);
  }, (n & 4) === 0)
    return g;
  if (f) {
    var p = t.$$legacy;
    return (
      /** @type {() => V} */
      (function(P, y) {
        return arguments.length > 0 ? ((!y || p || h) && f(y ? g() : P), P) : g();
      })
    );
  }
  var w = !1, T = ((n & 1) !== 0 ? Xr : ss)(() => (w = !1, g()));
  i && l(T);
  var k = (
    /** @type {Effect} */
    rt
  );
  return (
    /** @type {() => V} */
    (function(P, y) {
      if (arguments.length > 0) {
        const I = y ? l(T) : i ? It(P) : P;
        return X(T, I), w = !0, s !== void 0 && (s = I), P;
      }
      return Ye && w || (k.f & ye) !== 0 ? T.v : l(T);
    })
  );
}
const jl = "5";
var Uo;
typeof window < "u" && ((Uo = window.__svelte ?? (window.__svelte = {})).v ?? (Uo.v = /* @__PURE__ */ new Set())).add(jl);
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
const Ql = 40, $l = 8, Jr = 16, tu = 5.5;
var tt;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(tt || (tt = {}));
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
const ou = 1, Fs = 2, su = 4, au = 8;
function lu(t) {
  switch (t) {
    case "top":
      return ou;
    case "bottom":
      return Fs;
    case "left":
      return su;
    case "right":
      return au;
  }
}
function Ir(t) {
  return typeof t == "string" ? t : t.node;
}
function Tr(t) {
  return typeof t == "string" ? void 0 : t.port;
}
function vo(t) {
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
let Qr = null;
async function fu() {
  if (!Qr) {
    const { AvoidLib: t } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await t.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await t.load(process.env.LIBAVOID_WASM_PATH) : await t.load(), Qr = t.getInstance();
  }
  return Qr;
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
    const d = (a.absolutePosition.x - (f.position.x - f.size.width / 2)) / f.size.width, h = (a.absolutePosition.y - (f.position.y - f.size.height / 2)) / f.size.height, g = a.side === "top" || a.side === "bottom" ? Fs : lu(a.side);
    new t.ShapeConnectionPin(u, c, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, h)), !0, 0, g).setExclusive(!1);
  }
  return i;
}
function du(t, e, n, r, i, o, s, a) {
  const u = /* @__PURE__ */ new Map();
  for (const [f, c] of s.entries()) {
    const d = c.id ?? `__link_${f}`, h = Ir(c.from), g = Ir(c.to);
    if (!n.has(h) || !n.has(g))
      continue;
    const p = Tr(c.from), w = Tr(c.to), T = p ? `${h}:${p}` : null, k = w ? `${g}:${w}` : null, V = T ? r.get(T) : void 0;
    let P;
    if (V !== void 0)
      P = new t.ConnEnd(n.get(h), V);
    else {
      const U = T ? o.get(T) : void 0, G = i.get(h), it = (U == null ? void 0 : U.absolutePosition) ?? (G == null ? void 0 : G.position);
      if (!it)
        continue;
      P = new t.ConnEnd(new t.Point(it.x, it.y));
    }
    const y = k ? o.get(k) : void 0, I = i.get(g), b = (y == null ? void 0 : y.absolutePosition) ?? (I == null ? void 0 : I.position);
    if (!b)
      continue;
    const N = new t.ConnEnd(new t.Point(b.x, b.y)), C = new t.ConnRef(e, P, N), Y = k ? o.get(k) : null;
    if (Y != null && Y.side) {
      const G = Math.max(Y.size.width, Y.size.height) / 2 + 16;
      let it = Y.absolutePosition.x, H = Y.absolutePosition.y;
      switch (Y.side) {
        case "top":
          H -= G;
          break;
        case "bottom":
          H += G;
          break;
        case "left":
          it -= G;
          break;
        case "right":
          it += G;
          break;
      }
      if (!uu(it, H, i, a)) {
        const m = new t.CheckpointVector();
        m.push_back(new t.Checkpoint(new t.Point(it, H))), C.setRoutingCheckpoints(m);
      }
    }
    u.set(d, C);
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
    for (let b = 0; b < f.size(); b++) {
      const N = f.at(b);
      c.push({ x: N.x, y: N.y });
    }
    const d = Ir(s.from), h = Ir(s.to), g = Tr(s.from), p = Tr(s.to), w = g ? `${d}:${g}` : null, T = p ? `${h}:${p}` : null, k = w ? e.get(w) : void 0, V = T ? e.get(T) : void 0;
    k && c.length > 0 && (c[0] = { x: k.absolutePosition.x, y: k.absolutePosition.y }), V && c.length > 0 && (c[c.length - 1] = {
      x: V.absolutePosition.x,
      y: V.absolutePosition.y
    });
    const P = c[0], y = c[c.length - 1], I = r === "straight" && c.length > 2 && P && y ? [P, y] : c;
    i.set(a, {
      id: a,
      fromPortId: g ? `${d}:${g}` : null,
      toPortId: p ? `${h}:${p}` : null,
      fromNodeId: d,
      toNodeId: h,
      fromEndpoint: vo(s.from),
      toEndpoint: vo(s.to),
      points: I,
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
  mo(n, e, "y");
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
  return mo(r, e, "x"), e;
}
function mo(t, e, n) {
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
      po(e, i, -f, n), po(e, o, f, n), i.fixed -= f, o.fixed += f;
    }
  }
}
function po(t, e, n, r) {
  const i = t.get(e.edgeId);
  if (!i)
    return;
  const o = i.points[e.pointIndex], s = i.points[e.pointIndex + 1];
  !o || !s || (r === "y" ? (o.y += n, s.y += n) : (o.x += n, s.x += n));
}
const pu = 8, _o = 6;
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
    const h = (a.x - s.x) / f, g = (a.y - s.y) / f, p = (u.x - s.x) / c, w = (u.y - s.y) / c, T = h * w - g * p;
    if (Math.abs(T) < 1e-3) {
      n.push({ ...s });
      continue;
    }
    const k = s.x + h * d, V = s.y + g * d, P = s.x + p * d, y = s.y + w * d;
    for (let I = 0; I <= _o; I++) {
      const b = I / _o, N = 1 - b, C = N * N * k + 2 * N * b * s.x + b * b * P, Y = N * N * V + 2 * N * b * s.y + b * b * y;
      n.push({ x: C, y: Y });
    }
  }
  const i = t[t.length - 1];
  return i && n.push({ ...i }), n;
}
const rn = 8;
function Ds(t, e, n = rn) {
  return t.x - t.w / 2 - n < e.x + e.w / 2 && t.x + t.w / 2 + n > e.x - e.w / 2 && t.y - t.h / 2 - n < e.y + e.h / 2 && t.y + t.h / 2 + n > e.y - e.h / 2;
}
function Ys(t, e, n = rn) {
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
function Hs(t, e, n, r) {
  const i = [];
  for (const [o, s] of n)
    o !== t && i.push({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height });
  if (r)
    for (const [o, s] of r)
      o !== t && (e && wu(e, o, r) || i.push(yi(s.bounds)));
  return i;
}
function Bs(t, e, n = rn) {
  let r = t.x, i = t.y;
  for (const o of e) {
    const s = { x: r, y: i, w: t.w, h: t.h };
    if (Ds(s, o, n)) {
      const a = Ys(s, o, n);
      r = a.x, i = a.y;
    }
  }
  return { x: r, y: i };
}
function Vs(t, e, n, r, i = rn, o) {
  const s = r.get(t);
  if (!s)
    return { x: e, y: n };
  const a = Hs(t, s.node.parent, r, o);
  return Bs({ x: e, y: n, w: s.size.width, h: s.size.height }, a, i);
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
const gr = 20, yo = 28;
function yi(t) {
  return { x: t.x + t.width / 2, y: t.y + t.height / 2, w: t.width, h: t.height };
}
function Ui(t, e, n, r, i, o) {
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
    }), Ui(s, e, n, r, i, o));
}
function zr(t, e, n) {
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
      const g = h.size.width / 2, p = h.size.height / 2;
      a = Math.min(a, h.position.x - g), u = Math.min(u, h.position.y - p), f = Math.max(f, h.position.x + g), c = Math.max(c, h.position.y + p);
    }
    for (const h of e.values())
      h.subgraph.parent === o && (d = !0, a = Math.min(a, h.bounds.x), u = Math.min(u, h.bounds.y), f = Math.max(f, h.bounds.x + h.bounds.width), c = Math.max(c, h.bounds.y + h.bounds.height));
    d && e.set(o, {
      ...s,
      bounds: {
        x: a - gr,
        y: u - gr - yo,
        width: f - a + gr * 2,
        height: c - u + gr * 2 + yo
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
      const c = yi(s.bounds), d = yi(f.bounds);
      if (!Ds(c, d, rn))
        continue;
      const h = Ys(d, c, rn), g = h.x - d.x, p = h.y - d.y;
      g === 0 && p === 0 || (e.set(u, {
        ...f,
        bounds: { ...f.bounds, x: f.bounds.x + g, y: f.bounds.y + p }
      }), Ui(u, g, p, t, e, n));
    }
  }
  for (const [o, s] of t) {
    const a = Hs(o, s.node.parent, t, e), u = Bs({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height }, a);
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
async function xu(t, e, n, r, i, o = rn) {
  const s = r.nodes.get(t);
  if (!s)
    return null;
  const { x: a, y: u } = Vs(t, e, n, r.nodes, o, r.subgraphs), f = a - s.position.x, c = u - s.position.y;
  if (f === 0 && c === 0)
    return null;
  const d = new Map(r.nodes);
  d.set(t, { ...s, position: { x: a, y: u } });
  const h = new Map(r.ports);
  for (const [w, T] of r.ports)
    T.nodeId === t && h.set(w, {
      ...T,
      absolutePosition: {
        x: T.absolutePosition.x + f,
        y: T.absolutePosition.y + c
      }
    });
  let g;
  r.subgraphs && (g = new Map(r.subgraphs), zr(d, g, h));
  const p = await Wn(d, h, i);
  return { nodes: d, ports: h, edges: p, subgraphs: g };
}
async function bu(t, e, n, r, i) {
  const o = r.subgraphs.get(t);
  if (!o)
    return null;
  const s = e - o.bounds.x, a = n - o.bounds.y;
  if (s === 0 && a === 0)
    return null;
  const u = new Map(r.nodes), f = new Map(r.ports), c = new Map(r.subgraphs);
  c.set(t, { ...o, bounds: { ...o.bounds, x: e, y: n } }), Ui(t, s, a, u, c, f), zr(u, c, f);
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
const wo = 8, xo = 24;
function Su(t, e) {
  const n = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const r of e.values())
    r.nodeId === t && r.side && n[r.side]++;
  return n;
}
function Nu(t, e) {
  const n = Math.max(t.top, t.bottom), r = Math.max(t.left, t.right);
  return {
    width: Math.max(e.width, (n + 1) * xo),
    height: Math.max(e.height, (r + 1) * xo)
  };
}
function Mu(t, e, n, r) {
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
function Xs(t, e, n) {
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
    Mu(t, u, s, n);
}
function Au(t, e, n, r, i) {
  if (!n.get(t))
    return null;
  const s = Eu(t, i, r), a = `${t}:${s}`, u = new Map(r);
  u.set(a, {
    id: a,
    nodeId: t,
    label: s,
    absolutePosition: { x: 0, y: 0 },
    side: e,
    size: { width: wo, height: wo }
  });
  const f = new Map(n);
  return Xs(t, f, u), { nodes: f, ports: u, portId: a };
}
function Pu(t, e, n, r) {
  const i = n.get(t);
  if (!i)
    return null;
  const o = i.nodeId, s = i.label, a = r.filter((c) => {
    const d = typeof c.from == "string" ? { node: c.from } : c.from, h = typeof c.to == "string" ? { node: c.to } : c.to;
    return !(d.node === o && d.port === s || h.node === o && h.port === s);
  }), u = new Map(n);
  u.delete(t);
  const f = new Map(e);
  return Xs(o, f, u), { nodes: f, ports: u, links: a };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function Us(t) {
  return typeof t > "u" || t === null;
}
function Iu(t) {
  return typeof t == "object" && t !== null;
}
function Tu(t) {
  return Array.isArray(t) ? t : Us(t) ? [] : [t];
}
function zu(t, e) {
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
var Lu = Us, Ou = Iu, Fu = Tu, Du = Cu, Yu = Ru, Hu = zu, qi = {
  isNothing: Lu,
  isObject: Ou,
  toArray: Fu,
  repeat: Du,
  isNegativeZero: Yu,
  extend: Hu
};
function qs(t, e) {
  var n = "", r = t.reason || "(unknown reason)";
  return t.mark ? (t.mark.name && (n += 'in "' + t.mark.name + '" '), n += "(" + (t.mark.line + 1) + ":" + (t.mark.column + 1) + ")", !e && t.mark.snippet && (n += `

` + t.mark.snippet), r + " " + n) : r;
}
function Jn(t, e) {
  Error.call(this), this.name = "YAMLException", this.reason = t, this.mark = e, this.message = qs(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
Jn.prototype = Object.create(Error.prototype);
Jn.prototype.constructor = Jn;
Jn.prototype.toString = function(e) {
  return this.name + ": " + qs(this, e);
};
var Ve = Jn, Bu = [
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
function Uu(t, e) {
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
var Et = Uu;
function bo(t, e) {
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
function wi(t) {
  return this.extend(t);
}
wi.prototype.extend = function(e) {
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
  var i = Object.create(wi.prototype);
  return i.implicit = (this.implicit || []).concat(n), i.explicit = (this.explicit || []).concat(r), i.compiledImplicit = bo(i, "implicit"), i.compiledExplicit = bo(i, "explicit"), i.compiledTypeMap = qu(i.compiledImplicit, i.compiledExplicit), i;
};
var Gu = wi, Wu = new Et("tag:yaml.org,2002:str", {
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
}), ju = new Gu({
  explicit: [
    Wu,
    Ku,
    Zu
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
function $u(t) {
  return t === null;
}
var tf = new Et("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Ju,
  construct: Qu,
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
  return Object.prototype.toString.call(t) === "[object Number]" && t % 1 === 0 && !qi.isNegativeZero(t);
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
  else if (qi.isNegativeZero(t))
    return "-0.0";
  return n = t.toString(10), mf.test(n) ? n.replace("e", ".e") : n;
}
function _f(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && (t % 1 !== 0 || qi.isNegativeZero(t));
}
var yf = new Et("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: gf,
  construct: vf,
  predicate: _f,
  represent: pf,
  defaultStyle: "lowercase"
}), wf = ju.extend({
  implicit: [
    tf,
    of,
    hf,
    yf
  ]
}), xf = wf, Gs = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Ws = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function bf(t) {
  return t === null ? !1 : Gs.exec(t) !== null || Ws.exec(t) !== null;
}
function kf(t) {
  var e, n, r, i, o, s, a, u = 0, f = null, c, d, h;
  if (e = Gs.exec(t), e === null && (e = Ws.exec(t)), e === null) throw new Error("Date resolve error");
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
var Mf = new Et("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: Nf
}), Gi = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function Af(t) {
  if (t === null) return !1;
  var e, n, r = 0, i = t.length, o = Gi;
  for (n = 0; n < i; n++)
    if (e = o.indexOf(t.charAt(n)), !(e > 64)) {
      if (e < 0) return !1;
      r += 6;
    }
  return r % 8 === 0;
}
function Pf(t) {
  var e, n, r = t.replace(/[\r\n=]/g, ""), i = r.length, o = Gi, s = 0, a = [];
  for (e = 0; e < i; e++)
    e % 4 === 0 && e && (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)), s = s << 6 | o.indexOf(r.charAt(e));
  return n = i % 4 * 6, n === 0 ? (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)) : n === 18 ? (a.push(s >> 10 & 255), a.push(s >> 2 & 255)) : n === 12 && a.push(s >> 4 & 255), new Uint8Array(a);
}
function If(t) {
  var e = "", n = 0, r, i, o = t.length, s = Gi;
  for (r = 0; r < o; r++)
    r % 3 === 0 && r && (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]), n = (n << 8) + t[r];
  return i = o % 3, i === 0 ? (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]) : i === 2 ? (e += s[n >> 10 & 63], e += s[n >> 4 & 63], e += s[n << 2 & 63], e += s[64]) : i === 1 && (e += s[n >> 2 & 63], e += s[n << 4 & 63], e += s[64], e += s[64]), e;
}
function Tf(t) {
  return Object.prototype.toString.call(t) === "[object Uint8Array]";
}
var zf = new Et("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: Af,
  construct: Pf,
  predicate: Tf,
  represent: If
}), Cf = Object.prototype.hasOwnProperty, Rf = Object.prototype.toString;
function Lf(t) {
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
function Of(t) {
  return t !== null ? t : [];
}
var Ff = new Et("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: Lf,
  construct: Of
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
function Uf(t) {
  return t !== null ? t : {};
}
var qf = new Et("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Xf,
  construct: Uf
});
xf.extend({
  implicit: [
    Sf,
    Mf
  ],
  explicit: [
    zf,
    Ff,
    Bf,
    qf
  ]
});
function ko(t) {
  return t === 48 ? "\0" : t === 97 ? "\x07" : t === 98 ? "\b" : t === 116 || t === 9 ? "	" : t === 110 ? `
` : t === 118 ? "\v" : t === 102 ? "\f" : t === 114 ? "\r" : t === 101 ? "\x1B" : t === 32 ? " " : t === 34 ? '"' : t === 47 ? "/" : t === 92 ? "\\" : t === 78 ? "" : t === 95 ? " " : t === 76 ? "\u2028" : t === 80 ? "\u2029" : "";
}
var Gf = new Array(256), Wf = new Array(256);
for (var vn = 0; vn < 256; vn++)
  Gf[vn] = ko(vn) ? 1 : 0, Wf[vn] = ko(vn);
var Eo;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(Eo || (Eo = {}));
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
  ...kr,
  colors: {
    ...kr.colors,
    // Device colors (adjusted for dark)
    devices: (tt.Router + "", tt.L3Switch + "", tt.L2Switch + "", tt.Firewall + "", tt.LoadBalancer + "", tt.Server + "", tt.AccessPoint + "", tt.Cloud + "", tt.Internet + "", tt.Generic + "")
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
    selection: t.colors.primary,
    grid: t.colors.grid ?? (t.variant === "dark" ? "#334155" : "#e2e8f0")
  };
}
var xi = "http://www.w3.org/1999/xhtml";
const So = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: xi,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function qr(t) {
  var e = t += "", n = e.indexOf(":");
  return n >= 0 && (e = t.slice(0, n)) !== "xmlns" && (t = t.slice(n + 1)), So.hasOwnProperty(e) ? { space: So[e], local: t } : t;
}
function Zf(t) {
  return function() {
    var e = this.ownerDocument, n = this.namespaceURI;
    return n === xi && e.documentElement.namespaceURI === xi ? e.createElement(t) : e.createElementNS(n, t);
  };
}
function jf(t) {
  return function() {
    return this.ownerDocument.createElementNS(t.space, t.local);
  };
}
function Ks(t) {
  var e = qr(t);
  return (e.local ? jf : Zf)(e);
}
function Jf() {
}
function Wi(t) {
  return t == null ? Jf : function() {
    return this.querySelector(t);
  };
}
function Qf(t) {
  typeof t != "function" && (t = Wi(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = new Array(s), u, f, c = 0; c < s; ++c)
      (u = o[c]) && (f = t.call(u, u.__data__, c, o)) && ("__data__" in u && (f.__data__ = u.__data__), a[c] = f);
  return new Bt(r, this._parents);
}
function $f(t) {
  return t == null ? [] : Array.isArray(t) ? t : Array.from(t);
}
function tc() {
  return [];
}
function Zs(t) {
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
  typeof t == "function" ? t = ec(t) : t = Zs(t);
  for (var e = this._groups, n = e.length, r = [], i = [], o = 0; o < n; ++o)
    for (var s = e[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && (r.push(t.call(u, u.__data__, f, s)), i.push(u));
  return new Bt(r, i);
}
function js(t) {
  return function() {
    return this.matches(t);
  };
}
function Js(t) {
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
  return this.select(t == null ? oc : ic(typeof t == "function" ? t : Js(t)));
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
  return this.selectAll(t == null ? lc : uc(typeof t == "function" ? t : Js(t)));
}
function cc(t) {
  typeof t != "function" && (t = js(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new Bt(r, this._parents);
}
function Qs(t) {
  return new Array(t.length);
}
function hc() {
  return new Bt(this._enter || this._groups.map(Qs), this._parents);
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
function dc(t) {
  return function() {
    return t;
  };
}
function gc(t, e, n, r, i, o) {
  for (var s = 0, a, u = e.length, f = o.length; s < f; ++s)
    (a = e[s]) ? (a.__data__ = o[s], r[s] = a) : n[s] = new Cr(t, o[s]);
  for (; s < u; ++s)
    (a = e[s]) && (i[s] = a);
}
function vc(t, e, n, r, i, o, s) {
  var a, u, f = /* @__PURE__ */ new Map(), c = e.length, d = o.length, h = new Array(c), g;
  for (a = 0; a < c; ++a)
    (u = e[a]) && (h[a] = g = s.call(u, u.__data__, a, e) + "", f.has(g) ? i[a] = u : f.set(g, u));
  for (a = 0; a < d; ++a)
    g = s.call(t, o[a], a, o) + "", (u = f.get(g)) ? (r[a] = u, u.__data__ = o[a], f.delete(g)) : n[a] = new Cr(t, o[a]);
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
    var c = r[f], d = i[f], h = d.length, g = _c(t.call(c, c && c.__data__, f, r)), p = g.length, w = a[f] = new Array(p), T = s[f] = new Array(p), k = u[f] = new Array(h);
    n(c, d, w, T, k, g, e);
    for (var V = 0, P = 0, y, I; V < p; ++V)
      if (y = w[V]) {
        for (V >= P && (P = V + 1); !(I = T[P]) && ++P < p; ) ;
        y._next = I || null;
      }
  }
  return s = new Bt(s, r), s._enter = a, s._exit = u, s;
}
function _c(t) {
  return typeof t == "object" && "length" in t ? t : Array.from(t);
}
function yc() {
  return new Bt(this._exit || this._groups.map(Qs), this._parents);
}
function wc(t, e, n) {
  var r = this.enter(), i = this, o = this.exit();
  return typeof t == "function" ? (r = t(r), r && (r = r.selection())) : r = r.append(t + ""), e != null && (i = e(i), i && (i = i.selection())), n == null ? o.remove() : n(o), r && i ? r.merge(i).order() : i;
}
function xc(t) {
  for (var e = t.selection ? t.selection() : t, n = this._groups, r = e._groups, i = n.length, o = r.length, s = Math.min(i, o), a = new Array(i), u = 0; u < s; ++u)
    for (var f = n[u], c = r[u], d = f.length, h = a[u] = new Array(d), g, p = 0; p < d; ++p)
      (g = f[p] || c[p]) && (h[p] = g);
  for (; u < i; ++u)
    a[u] = n[u];
  return new Bt(a, this._parents);
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
  return new Bt(i, this._parents).order();
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
function Mc() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length; i < o; ++i) {
      var s = r[i];
      if (s) return s;
    }
  return null;
}
function Ac() {
  let t = 0;
  for (const e of this) ++t;
  return t;
}
function Pc() {
  return !this.node();
}
function Ic(t) {
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
function Lc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttribute(t) : this.setAttribute(t, n);
  };
}
function Oc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttributeNS(t.space, t.local) : this.setAttributeNS(t.space, t.local, n);
  };
}
function Fc(t, e) {
  var n = qr(t);
  if (arguments.length < 2) {
    var r = this.node();
    return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n);
  }
  return this.each((e == null ? n.local ? zc : Tc : typeof e == "function" ? n.local ? Oc : Lc : n.local ? Rc : Cc)(n, e));
}
function $s(t) {
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
  return arguments.length > 1 ? this.each((e == null ? Dc : typeof e == "function" ? Hc : Yc)(t, e, n ?? "")) : Ln(this.node(), t);
}
function Ln(t, e) {
  return t.style.getPropertyValue(e) || $s(t).getComputedStyle(t, null).getPropertyValue(e);
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
function Uc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? delete this[t] : this[t] = n;
  };
}
function qc(t, e) {
  return arguments.length > 1 ? this.each((e == null ? Vc : typeof e == "function" ? Uc : Xc)(t, e)) : this.node()[t];
}
function ta(t) {
  return t.trim().split(/^|\s+/);
}
function Ki(t) {
  return t.classList || new ea(t);
}
function ea(t) {
  this._node = t, this._names = ta(t.getAttribute("class") || "");
}
ea.prototype = {
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
function na(t, e) {
  for (var n = Ki(t), r = -1, i = e.length; ++r < i; ) n.add(e[r]);
}
function ra(t, e) {
  for (var n = Ki(t), r = -1, i = e.length; ++r < i; ) n.remove(e[r]);
}
function Gc(t) {
  return function() {
    na(this, t);
  };
}
function Wc(t) {
  return function() {
    ra(this, t);
  };
}
function Kc(t, e) {
  return function() {
    (e.apply(this, arguments) ? na : ra)(this, t);
  };
}
function Zc(t, e) {
  var n = ta(t + "");
  if (arguments.length < 2) {
    for (var r = Ki(this.node()), i = -1, o = n.length; ++i < o; ) if (!r.contains(n[i])) return !1;
    return !0;
  }
  return this.each((typeof e == "function" ? Kc : e ? Gc : Wc)(n, e));
}
function jc() {
  this.textContent = "";
}
function Jc(t) {
  return function() {
    this.textContent = t;
  };
}
function Qc(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.textContent = e ?? "";
  };
}
function $c(t) {
  return arguments.length ? this.each(t == null ? jc : (typeof t == "function" ? Qc : Jc)(t)) : this.node().textContent;
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
  var e = typeof t == "function" ? t : Ks(t);
  return this.select(function() {
    return this.appendChild(e.apply(this, arguments));
  });
}
function uh() {
  return null;
}
function fh(t, e) {
  var n = typeof t == "function" ? t : Ks(t), r = e == null ? uh : typeof e == "function" ? e : Wi(e);
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
function ia(t, e, n) {
  var r = $s(t), i = r.CustomEvent;
  typeof i == "function" ? i = new i(e, n) : (i = r.document.createEvent("Event"), n ? (i.initEvent(e, n.bubbles, n.cancelable), i.detail = n.detail) : i.initEvent(e, !1, !1)), t.dispatchEvent(i);
}
function bh(t, e) {
  return function() {
    return ia(this, t, e);
  };
}
function kh(t, e) {
  return function() {
    return ia(this, t, e.apply(this, arguments));
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
var oa = [null];
function Bt(t, e) {
  this._groups = t, this._parents = e;
}
function ur() {
  return new Bt([[document.documentElement]], oa);
}
function Nh() {
  return this;
}
Bt.prototype = ur.prototype = {
  constructor: Bt,
  select: Qf,
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
  node: Mc,
  size: Ac,
  empty: Pc,
  each: Ic,
  attr: Fc,
  style: Bc,
  property: qc,
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
function Tt(t) {
  return typeof t == "string" ? new Bt([[document.querySelector(t)]], [document.documentElement]) : new Bt([[t]], oa);
}
function Mh(t) {
  let e;
  for (; e = t.sourceEvent; ) t = e;
  return t;
}
function ve(t, e) {
  if (t = Mh(t), e === void 0 && (e = t.currentTarget), e) {
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
var Ah = { value: () => {
} };
function Gr() {
  for (var t = 0, e = arguments.length, n = {}, r; t < e; ++t) {
    if (!(r = arguments[t] + "") || r in n || /[\s.]/.test(r)) throw new Error("illegal type: " + r);
    n[r] = [];
  }
  return new Er(n);
}
function Er(t) {
  this._ = t;
}
function Ph(t, e) {
  return t.trim().split(/^|\s+/).map(function(n) {
    var r = "", i = n.indexOf(".");
    if (i >= 0 && (r = n.slice(i + 1), n = n.slice(0, i)), n && !e.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    return { type: n, name: r };
  });
}
Er.prototype = Gr.prototype = {
  constructor: Er,
  on: function(t, e) {
    var n = this._, r = Ph(t + "", n), i, o = -1, s = r.length;
    if (arguments.length < 2) {
      for (; ++o < s; ) if ((i = (t = r[o]).type) && (i = Ih(n[i], t.name))) return i;
      return;
    }
    if (e != null && typeof e != "function") throw new Error("invalid callback: " + e);
    for (; ++o < s; )
      if (i = (t = r[o]).type) n[i] = No(n[i], t.name, e);
      else if (e == null) for (i in n) n[i] = No(n[i], t.name, null);
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
function Ih(t, e) {
  for (var n = 0, r = t.length, i; n < r; ++n)
    if ((i = t[n]).name === e)
      return i.value;
}
function No(t, e, n) {
  for (var r = 0, i = t.length; r < i; ++r)
    if (t[r].name === e) {
      t[r] = Ah, t = t.slice(0, r).concat(t.slice(r + 1));
      break;
    }
  return n != null && t.push({ name: e, value: n }), t;
}
const Th = { passive: !1 }, Qn = { capture: !0, passive: !1 };
function $r(t) {
  t.stopImmediatePropagation();
}
function wn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function sa(t) {
  var e = t.document.documentElement, n = Tt(t).on("dragstart.drag", wn, Qn);
  "onselectstart" in e ? n.on("selectstart.drag", wn, Qn) : (e.__noselect = e.style.MozUserSelect, e.style.MozUserSelect = "none");
}
function aa(t, e) {
  var n = t.document.documentElement, r = Tt(t).on("dragstart.drag", null);
  e && (r.on("click.drag", wn, Qn), setTimeout(function() {
    r.on("click.drag", null);
  }, 0)), "onselectstart" in n ? r.on("selectstart.drag", null) : (n.style.MozUserSelect = n.__noselect, delete n.__noselect);
}
const vr = (t) => () => t;
function bi(t, {
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
bi.prototype.on = function() {
  var t = this._.on.apply(this._, arguments);
  return t === this._ ? this : t;
};
function zh(t) {
  return !t.ctrlKey && !t.button;
}
function Ch() {
  return this.parentNode;
}
function Rh(t, e) {
  return e ?? { x: t.x, y: t.y };
}
function Lh() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function la() {
  var t = zh, e = Ch, n = Rh, r = Lh, i = {}, o = Gr("start", "drag", "end"), s = 0, a, u, f, c, d = 0;
  function h(y) {
    y.on("mousedown.drag", g).filter(r).on("touchstart.drag", T).on("touchmove.drag", k, Th).on("touchend.drag touchcancel.drag", V).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function g(y, I) {
    if (!(c || !t.call(this, y, I))) {
      var b = P(this, e.call(this, y, I), y, I, "mouse");
      b && (Tt(y.view).on("mousemove.drag", p, Qn).on("mouseup.drag", w, Qn), sa(y.view), $r(y), f = !1, a = y.clientX, u = y.clientY, b("start", y));
    }
  }
  function p(y) {
    if (wn(y), !f) {
      var I = y.clientX - a, b = y.clientY - u;
      f = I * I + b * b > d;
    }
    i.mouse("drag", y);
  }
  function w(y) {
    Tt(y.view).on("mousemove.drag mouseup.drag", null), aa(y.view, f), wn(y), i.mouse("end", y);
  }
  function T(y, I) {
    if (t.call(this, y, I)) {
      var b = y.changedTouches, N = e.call(this, y, I), C = b.length, Y, U;
      for (Y = 0; Y < C; ++Y)
        (U = P(this, N, y, I, b[Y].identifier, b[Y])) && ($r(y), U("start", y, b[Y]));
    }
  }
  function k(y) {
    var I = y.changedTouches, b = I.length, N, C;
    for (N = 0; N < b; ++N)
      (C = i[I[N].identifier]) && (wn(y), C("drag", y, I[N]));
  }
  function V(y) {
    var I = y.changedTouches, b = I.length, N, C;
    for (c && clearTimeout(c), c = setTimeout(function() {
      c = null;
    }, 500), N = 0; N < b; ++N)
      (C = i[I[N].identifier]) && ($r(y), C("end", y, I[N]));
  }
  function P(y, I, b, N, C, Y) {
    var U = o.copy(), G = ve(Y || b, I), it, H, m;
    if ((m = n.call(y, new bi("beforestart", {
      sourceEvent: b,
      target: h,
      identifier: C,
      active: s,
      x: G[0],
      y: G[1],
      dx: 0,
      dy: 0,
      dispatch: U
    }), N)) != null)
      return it = m.x - G[0] || 0, H = m.y - G[1] || 0, function M(x, z, O) {
        var B = G, q;
        switch (x) {
          case "start":
            i[C] = M, q = s++;
            break;
          case "end":
            delete i[C], --s;
          // falls through
          case "drag":
            G = ve(O || z, I), q = s;
            break;
        }
        U.call(
          x,
          y,
          new bi(x, {
            sourceEvent: z,
            subject: m,
            target: h,
            identifier: C,
            active: q,
            x: G[0] + it,
            y: G[1] + H,
            dx: G[0] - B[0],
            dy: G[1] - B[1],
            dispatch: U
          }),
          N
        );
      };
  }
  return h.filter = function(y) {
    return arguments.length ? (t = typeof y == "function" ? y : vr(!!y), h) : t;
  }, h.container = function(y) {
    return arguments.length ? (e = typeof y == "function" ? y : vr(y), h) : e;
  }, h.subject = function(y) {
    return arguments.length ? (n = typeof y == "function" ? y : vr(y), h) : n;
  }, h.touchable = function(y) {
    return arguments.length ? (r = typeof y == "function" ? y : vr(!!y), h) : r;
  }, h.on = function() {
    var y = o.on.apply(o, arguments);
    return y === o ? h : y;
  }, h.clickDistance = function(y) {
    return arguments.length ? (d = (y = +y) * y, h) : Math.sqrt(d);
  }, h;
}
function Zi(t, e, n) {
  t.prototype = e.prototype = n, n.constructor = t;
}
function ua(t, e) {
  var n = Object.create(t.prototype);
  for (var r in e) n[r] = e[r];
  return n;
}
function fr() {
}
var $n = 0.7, Rr = 1 / $n, xn = "\\s*([+-]?\\d+)\\s*", tr = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", le = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Oh = /^#([0-9a-f]{3,8})$/, Fh = new RegExp(`^rgb\\(${xn},${xn},${xn}\\)$`), Dh = new RegExp(`^rgb\\(${le},${le},${le}\\)$`), Yh = new RegExp(`^rgba\\(${xn},${xn},${xn},${tr}\\)$`), Hh = new RegExp(`^rgba\\(${le},${le},${le},${tr}\\)$`), Bh = new RegExp(`^hsl\\(${tr},${le},${le}\\)$`), Vh = new RegExp(`^hsla\\(${tr},${le},${le},${tr}\\)$`), Mo = {
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
Zi(fr, er, {
  copy(t) {
    return Object.assign(new this.constructor(), this, t);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: Ao,
  // Deprecated! Use color.formatHex.
  formatHex: Ao,
  formatHex8: Xh,
  formatHsl: Uh,
  formatRgb: Po,
  toString: Po
});
function Ao() {
  return this.rgb().formatHex();
}
function Xh() {
  return this.rgb().formatHex8();
}
function Uh() {
  return fa(this).formatHsl();
}
function Po() {
  return this.rgb().formatRgb();
}
function er(t) {
  var e, n;
  return t = (t + "").trim().toLowerCase(), (e = Oh.exec(t)) ? (n = e[1].length, e = parseInt(e[1], 16), n === 6 ? Io(e) : n === 3 ? new Ct(e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, (e & 15) << 4 | e & 15, 1) : n === 8 ? mr(e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, (e & 255) / 255) : n === 4 ? mr(e >> 12 & 15 | e >> 8 & 240, e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, ((e & 15) << 4 | e & 15) / 255) : null) : (e = Fh.exec(t)) ? new Ct(e[1], e[2], e[3], 1) : (e = Dh.exec(t)) ? new Ct(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, 1) : (e = Yh.exec(t)) ? mr(e[1], e[2], e[3], e[4]) : (e = Hh.exec(t)) ? mr(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, e[4]) : (e = Bh.exec(t)) ? Co(e[1], e[2] / 100, e[3] / 100, 1) : (e = Vh.exec(t)) ? Co(e[1], e[2] / 100, e[3] / 100, e[4]) : Mo.hasOwnProperty(t) ? Io(Mo[t]) : t === "transparent" ? new Ct(NaN, NaN, NaN, 0) : null;
}
function Io(t) {
  return new Ct(t >> 16 & 255, t >> 8 & 255, t & 255, 1);
}
function mr(t, e, n, r) {
  return r <= 0 && (t = e = n = NaN), new Ct(t, e, n, r);
}
function qh(t) {
  return t instanceof fr || (t = er(t)), t ? (t = t.rgb(), new Ct(t.r, t.g, t.b, t.opacity)) : new Ct();
}
function ki(t, e, n, r) {
  return arguments.length === 1 ? qh(t) : new Ct(t, e, n, r ?? 1);
}
function Ct(t, e, n, r) {
  this.r = +t, this.g = +e, this.b = +n, this.opacity = +r;
}
Zi(Ct, ki, ua(fr, {
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
    return new Ct($e(this.r), $e(this.g), $e(this.b), Lr(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && -0.5 <= this.g && this.g < 255.5 && -0.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
  },
  hex: To,
  // Deprecated! Use color.formatHex.
  formatHex: To,
  formatHex8: Gh,
  formatRgb: zo,
  toString: zo
}));
function To() {
  return `#${Ue(this.r)}${Ue(this.g)}${Ue(this.b)}`;
}
function Gh() {
  return `#${Ue(this.r)}${Ue(this.g)}${Ue(this.b)}${Ue((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function zo() {
  const t = Lr(this.opacity);
  return `${t === 1 ? "rgb(" : "rgba("}${$e(this.r)}, ${$e(this.g)}, ${$e(this.b)}${t === 1 ? ")" : `, ${t})`}`;
}
function Lr(t) {
  return isNaN(t) ? 1 : Math.max(0, Math.min(1, t));
}
function $e(t) {
  return Math.max(0, Math.min(255, Math.round(t) || 0));
}
function Ue(t) {
  return t = $e(t), (t < 16 ? "0" : "") + t.toString(16);
}
function Co(t, e, n, r) {
  return r <= 0 ? t = e = n = NaN : n <= 0 || n >= 1 ? t = e = NaN : e <= 0 && (t = NaN), new $t(t, e, n, r);
}
function fa(t) {
  if (t instanceof $t) return new $t(t.h, t.s, t.l, t.opacity);
  if (t instanceof fr || (t = er(t)), !t) return new $t();
  if (t instanceof $t) return t;
  t = t.rgb();
  var e = t.r / 255, n = t.g / 255, r = t.b / 255, i = Math.min(e, n, r), o = Math.max(e, n, r), s = NaN, a = o - i, u = (o + i) / 2;
  return a ? (e === o ? s = (n - r) / a + (n < r) * 6 : n === o ? s = (r - e) / a + 2 : s = (e - n) / a + 4, a /= u < 0.5 ? o + i : 2 - o - i, s *= 60) : a = u > 0 && u < 1 ? 0 : s, new $t(s, a, u, t.opacity);
}
function Wh(t, e, n, r) {
  return arguments.length === 1 ? fa(t) : new $t(t, e, n, r ?? 1);
}
function $t(t, e, n, r) {
  this.h = +t, this.s = +e, this.l = +n, this.opacity = +r;
}
Zi($t, Wh, ua(fr, {
  brighter(t) {
    return t = t == null ? Rr : Math.pow(Rr, t), new $t(this.h, this.s, this.l * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? $n : Math.pow($n, t), new $t(this.h, this.s, this.l * t, this.opacity);
  },
  rgb() {
    var t = this.h % 360 + (this.h < 0) * 360, e = isNaN(t) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < 0.5 ? n : 1 - n) * e, i = 2 * n - r;
    return new Ct(
      ti(t >= 240 ? t - 240 : t + 120, i, r),
      ti(t, i, r),
      ti(t < 120 ? t + 240 : t - 120, i, r),
      this.opacity
    );
  },
  clamp() {
    return new $t(Ro(this.h), pr(this.s), pr(this.l), Lr(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
  },
  formatHsl() {
    const t = Lr(this.opacity);
    return `${t === 1 ? "hsl(" : "hsla("}${Ro(this.h)}, ${pr(this.s) * 100}%, ${pr(this.l) * 100}%${t === 1 ? ")" : `, ${t})`}`;
  }
}));
function Ro(t) {
  return t = (t || 0) % 360, t < 0 ? t + 360 : t;
}
function pr(t) {
  return Math.max(0, Math.min(1, t || 0));
}
function ti(t, e, n) {
  return (t < 60 ? e + (n - e) * t / 60 : t < 180 ? n : t < 240 ? e + (n - e) * (240 - t) / 60 : e) * 255;
}
const ca = (t) => () => t;
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
function jh(t) {
  return (t = +t) == 1 ? ha : function(e, n) {
    return n - e ? Zh(e, n, t) : ca(isNaN(e) ? n : e);
  };
}
function ha(t, e) {
  var n = e - t;
  return n ? Kh(t, n) : ca(isNaN(t) ? e : t);
}
const Lo = (function t(e) {
  var n = jh(e);
  function r(i, o) {
    var s = n((i = ki(i)).r, (o = ki(o)).r), a = n(i.g, o.g), u = n(i.b, o.b), f = ha(i.opacity, o.opacity);
    return function(c) {
      return i.r = s(c), i.g = a(c), i.b = u(c), i.opacity = f(c), i + "";
    };
  }
  return r.gamma = t, r;
})(1);
function Te(t, e) {
  return t = +t, e = +e, function(n) {
    return t * (1 - n) + e * n;
  };
}
var Ei = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, ei = new RegExp(Ei.source, "g");
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
function $h(t, e) {
  var n = Ei.lastIndex = ei.lastIndex = 0, r, i, o, s = -1, a = [], u = [];
  for (t = t + "", e = e + ""; (r = Ei.exec(t)) && (i = ei.exec(e)); )
    (o = i.index) > n && (o = e.slice(n, o), a[s] ? a[s] += o : a[++s] = o), (r = r[0]) === (i = i[0]) ? a[s] ? a[s] += i : a[++s] = i : (a[++s] = null, u.push({ i: s, x: Te(r, i) })), n = ei.lastIndex;
  return n < e.length && (o = e.slice(n), a[s] ? a[s] += o : a[++s] = o), a.length < 2 ? u[0] ? Qh(u[0].x) : Jh(e) : (e = u.length, function(f) {
    for (var c = 0, d; c < e; ++c) a[(d = u[c]).i] = d.x(f);
    return a.join("");
  });
}
var Oo = 180 / Math.PI, Si = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function da(t, e, n, r, i, o) {
  var s, a, u;
  return (s = Math.sqrt(t * t + e * e)) && (t /= s, e /= s), (u = t * n + e * r) && (n -= t * u, r -= e * u), (a = Math.sqrt(n * n + r * r)) && (n /= a, r /= a, u /= a), t * r < e * n && (t = -t, e = -e, u = -u, s = -s), {
    translateX: i,
    translateY: o,
    rotate: Math.atan2(e, t) * Oo,
    skewX: Math.atan(u) * Oo,
    scaleX: s,
    scaleY: a
  };
}
var _r;
function td(t) {
  const e = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(t + "");
  return e.isIdentity ? Si : da(e.a, e.b, e.c, e.d, e.e, e.f);
}
function ed(t) {
  return t == null || (_r || (_r = document.createElementNS("http://www.w3.org/2000/svg", "g")), _r.setAttribute("transform", t), !(t = _r.transform.baseVal.consolidate())) ? Si : (t = t.matrix, da(t.a, t.b, t.c, t.d, t.e, t.f));
}
function ga(t, e, n, r) {
  function i(f) {
    return f.length ? f.pop() + " " : "";
  }
  function o(f, c, d, h, g, p) {
    if (f !== d || c !== h) {
      var w = g.push("translate(", null, e, null, n);
      p.push({ i: w - 4, x: Te(f, d) }, { i: w - 2, x: Te(c, h) });
    } else (d || h) && g.push("translate(" + d + e + h + n);
  }
  function s(f, c, d, h) {
    f !== c ? (f - c > 180 ? c += 360 : c - f > 180 && (f += 360), h.push({ i: d.push(i(d) + "rotate(", null, r) - 2, x: Te(f, c) })) : c && d.push(i(d) + "rotate(" + c + r);
  }
  function a(f, c, d, h) {
    f !== c ? h.push({ i: d.push(i(d) + "skewX(", null, r) - 2, x: Te(f, c) }) : c && d.push(i(d) + "skewX(" + c + r);
  }
  function u(f, c, d, h, g, p) {
    if (f !== d || c !== h) {
      var w = g.push(i(g) + "scale(", null, ",", null, ")");
      p.push({ i: w - 4, x: Te(f, d) }, { i: w - 2, x: Te(c, h) });
    } else (d !== 1 || h !== 1) && g.push(i(g) + "scale(" + d + "," + h + ")");
  }
  return function(f, c) {
    var d = [], h = [];
    return f = t(f), c = t(c), o(f.translateX, f.translateY, c.translateX, c.translateY, d, h), s(f.rotate, c.rotate, d, h), a(f.skewX, c.skewX, d, h), u(f.scaleX, f.scaleY, c.scaleX, c.scaleY, d, h), f = c = null, function(g) {
      for (var p = -1, w = h.length, T; ++p < w; ) d[(T = h[p]).i] = T.x(g);
      return d.join("");
    };
  };
}
var nd = ga(td, "px, ", "px)", "deg)"), rd = ga(ed, ", ", ")", ")"), id = 1e-12;
function Fo(t) {
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
    var a = o[0], u = o[1], f = o[2], c = s[0], d = s[1], h = s[2], g = c - a, p = d - u, w = g * g + p * p, T, k;
    if (w < id)
      k = Math.log(h / f) / e, T = function(N) {
        return [
          a + N * g,
          u + N * p,
          f * Math.exp(e * N * k)
        ];
      };
    else {
      var V = Math.sqrt(w), P = (h * h - f * f + r * w) / (2 * f * n * V), y = (h * h - f * f - r * w) / (2 * h * n * V), I = Math.log(Math.sqrt(P * P + 1) - P), b = Math.log(Math.sqrt(y * y + 1) - y);
      k = (b - I) / e, T = function(N) {
        var C = N * k, Y = Fo(I), U = f / (n * V) * (Y * sd(e * C + I) - od(I));
        return [
          a + U * g,
          u + U * p,
          f * Y / Fo(e * C + I)
        ];
      };
    }
    return T.duration = k * 1e3 * e / Math.SQRT2, T;
  }
  return i.rho = function(o) {
    var s = Math.max(1e-3, +o), a = s * s, u = a * a;
    return t(s, a, u);
  }, i;
})(Math.SQRT2, 2, 4);
var On = 0, Un = 0, Yn = 0, va = 1e3, Or, qn, Fr = 0, on = 0, Wr = 0, nr = typeof performance == "object" && performance.now ? performance : Date, ma = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(t) {
  setTimeout(t, 17);
};
function ji() {
  return on || (ma(ld), on = nr.now() + Wr);
}
function ld() {
  on = 0;
}
function Dr() {
  this._call = this._time = this._next = null;
}
Dr.prototype = pa.prototype = {
  constructor: Dr,
  restart: function(t, e, n) {
    if (typeof t != "function") throw new TypeError("callback is not a function");
    n = (n == null ? ji() : +n) + (e == null ? 0 : +e), !this._next && qn !== this && (qn ? qn._next = this : Or = this, qn = this), this._call = t, this._time = n, Ni();
  },
  stop: function() {
    this._call && (this._call = null, this._time = 1 / 0, Ni());
  }
};
function pa(t, e, n) {
  var r = new Dr();
  return r.restart(t, e, n), r;
}
function ud() {
  ji(), ++On;
  for (var t = Or, e; t; )
    (e = on - t._time) >= 0 && t._call.call(void 0, e), t = t._next;
  --On;
}
function Do() {
  on = (Fr = nr.now()) + Wr, On = Un = 0;
  try {
    ud();
  } finally {
    On = 0, cd(), on = 0;
  }
}
function fd() {
  var t = nr.now(), e = t - Fr;
  e > va && (Wr -= e, Fr = t);
}
function cd() {
  for (var t, e = Or, n, r = 1 / 0; e; )
    e._call ? (r > e._time && (r = e._time), t = e, e = e._next) : (n = e._next, e._next = null, e = t ? t._next = n : Or = n);
  qn = t, Ni(r);
}
function Ni(t) {
  if (!On) {
    Un && (Un = clearTimeout(Un));
    var e = t - on;
    e > 24 ? (t < 1 / 0 && (Un = setTimeout(Do, t - nr.now() - Wr)), Yn && (Yn = clearInterval(Yn))) : (Yn || (Fr = nr.now(), Yn = setInterval(fd, va)), On = 1, ma(Do));
  }
}
function Yo(t, e, n) {
  var r = new Dr();
  return e = e == null ? 0 : +e, r.restart((i) => {
    r.stop(), t(i + e);
  }, e, n), r;
}
var hd = Gr("start", "end", "cancel", "interrupt"), dd = [], _a = 0, Ho = 1, Mi = 2, Sr = 3, Bo = 4, Ai = 5, Nr = 6;
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
    state: _a
  });
}
function Ji(t, e) {
  var n = ee(t, e);
  if (n.state > _a) throw new Error("too late; already scheduled");
  return n;
}
function ce(t, e) {
  var n = ee(t, e);
  if (n.state > Sr) throw new Error("too late; already running");
  return n;
}
function ee(t, e) {
  var n = t.__transition;
  if (!n || !(n = n[e])) throw new Error("transition not found");
  return n;
}
function gd(t, e, n) {
  var r = t.__transition, i;
  r[e] = n, n.timer = pa(o, 0, n.time);
  function o(f) {
    n.state = Ho, n.timer.restart(s, n.delay, n.time), n.delay <= f && s(f - n.delay);
  }
  function s(f) {
    var c, d, h, g;
    if (n.state !== Ho) return u();
    for (c in r)
      if (g = r[c], g.name === n.name) {
        if (g.state === Sr) return Yo(s);
        g.state === Bo ? (g.state = Nr, g.timer.stop(), g.on.call("interrupt", t, t.__data__, g.index, g.group), delete r[c]) : +c < e && (g.state = Nr, g.timer.stop(), g.on.call("cancel", t, t.__data__, g.index, g.group), delete r[c]);
      }
    if (Yo(function() {
      n.state === Sr && (n.state = Bo, n.timer.restart(a, n.delay, n.time), a(f));
    }), n.state = Mi, n.on.call("start", t, t.__data__, n.index, n.group), n.state === Mi) {
      for (n.state = Sr, i = new Array(h = n.tween.length), c = 0, d = -1; c < h; ++c)
        (g = n.tween[c].value.call(t, t.__data__, n.index, n.group)) && (i[++d] = g);
      i.length = d + 1;
    }
  }
  function a(f) {
    for (var c = f < n.duration ? n.ease.call(null, f / n.duration) : (n.timer.restart(u), n.state = Ai, 1), d = -1, h = i.length; ++d < h; )
      i[d].call(t, c);
    n.state === Ai && (n.on.call("end", t, t.__data__, n.index, n.group), u());
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
      i = r.state > Mi && r.state < Ai, r.state = Nr, r.timer.stop(), r.on.call(i ? "interrupt" : "cancel", t, t.__data__, r.index, r.group), delete n[s];
    }
    o && delete t.__transition;
  }
}
function vd(t) {
  return this.each(function() {
    Mr(this, t);
  });
}
function md(t, e) {
  var n, r;
  return function() {
    var i = ce(this, t), o = i.tween;
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
    var o = ce(this, t), s = o.tween;
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
    for (var r = ee(this.node(), n).tween, i = 0, o = r.length, s; i < o; ++i)
      if ((s = r[i]).name === t)
        return s.value;
    return null;
  }
  return this.each((e == null ? md : pd)(n, t, e));
}
function Qi(t, e, n) {
  var r = t._id;
  return t.each(function() {
    var i = ce(this, r);
    (i.value || (i.value = {}))[e] = n.apply(this, arguments);
  }), function(i) {
    return ee(i, r).value[e];
  };
}
function ya(t, e) {
  var n;
  return (typeof e == "number" ? Te : e instanceof er ? Lo : (n = er(e)) ? (e = n, Lo) : $h)(t, e);
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
  var n = qr(t), r = n === "transform" ? rd : ya;
  return this.attrTween(t, typeof e == "function" ? (n.local ? Ed : kd)(n, r, Qi(this, "attr." + t, e)) : e == null ? (n.local ? wd : yd)(n) : (n.local ? bd : xd)(n, r, e));
}
function Nd(t, e) {
  return function(n) {
    this.setAttribute(t, e.call(this, n));
  };
}
function Md(t, e) {
  return function(n) {
    this.setAttributeNS(t.space, t.local, e.call(this, n));
  };
}
function Ad(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && Md(t, o)), n;
  }
  return i._value = e, i;
}
function Pd(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && Nd(t, o)), n;
  }
  return i._value = e, i;
}
function Id(t, e) {
  var n = "attr." + t;
  if (arguments.length < 2) return (n = this.tween(n)) && n._value;
  if (e == null) return this.tween(n, null);
  if (typeof e != "function") throw new Error();
  var r = qr(t);
  return this.tween(n, (r.local ? Ad : Pd)(r, e));
}
function Td(t, e) {
  return function() {
    Ji(this, t).delay = +e.apply(this, arguments);
  };
}
function zd(t, e) {
  return e = +e, function() {
    Ji(this, t).delay = e;
  };
}
function Cd(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Td : zd)(e, t)) : ee(this.node(), e).delay;
}
function Rd(t, e) {
  return function() {
    ce(this, t).duration = +e.apply(this, arguments);
  };
}
function Ld(t, e) {
  return e = +e, function() {
    ce(this, t).duration = e;
  };
}
function Od(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Rd : Ld)(e, t)) : ee(this.node(), e).duration;
}
function Fd(t, e) {
  if (typeof e != "function") throw new Error();
  return function() {
    ce(this, t).ease = e;
  };
}
function Dd(t) {
  var e = this._id;
  return arguments.length ? this.each(Fd(e, t)) : ee(this.node(), e).ease;
}
function Yd(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    if (typeof n != "function") throw new Error();
    ce(this, t).ease = n;
  };
}
function Hd(t) {
  if (typeof t != "function") throw new Error();
  return this.each(Yd(this._id, t));
}
function Bd(t) {
  typeof t != "function" && (t = js(t));
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
function Ud(t, e, n) {
  var r, i, o = Xd(e) ? Ji : ce;
  return function() {
    var s = o(this, t), a = s.on;
    a !== r && (i = (r = a).copy()).on(e, n), s.on = i;
  };
}
function qd(t, e) {
  var n = this._id;
  return arguments.length < 2 ? ee(this.node(), n).on.on(t) : this.each(Ud(n, t, e));
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
  typeof t != "function" && (t = Wi(t));
  for (var r = this._groups, i = r.length, o = new Array(i), s = 0; s < i; ++s)
    for (var a = r[s], u = a.length, f = o[s] = new Array(u), c, d, h = 0; h < u; ++h)
      (c = a[h]) && (d = t.call(c, c.__data__, h, a)) && ("__data__" in c && (d.__data__ = c.__data__), f[h] = d, Kr(f[h], e, n, h, f, ee(c, n)));
  return new xe(o, this._parents, e, n);
}
function Zd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Zs(t));
  for (var r = this._groups, i = r.length, o = [], s = [], a = 0; a < i; ++a)
    for (var u = r[a], f = u.length, c, d = 0; d < f; ++d)
      if (c = u[d]) {
        for (var h = t.call(c, c.__data__, d, u), g, p = ee(c, n), w = 0, T = h.length; w < T; ++w)
          (g = h[w]) && Kr(g, e, n, w, h, p);
        o.push(h), s.push(c);
      }
  return new xe(o, s, e, n);
}
var jd = ur.prototype.constructor;
function Jd() {
  return new jd(this._groups, this._parents);
}
function Qd(t, e) {
  var n, r, i;
  return function() {
    var o = Ln(this, t), s = (this.style.removeProperty(t), Ln(this, t));
    return o === s ? null : o === n && s === r ? i : i = e(n = o, r = s);
  };
}
function wa(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function $d(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = Ln(this, t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function t0(t, e, n) {
  var r, i, o;
  return function() {
    var s = Ln(this, t), a = n(this), u = a + "";
    return a == null && (u = a = (this.style.removeProperty(t), Ln(this, t))), s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a));
  };
}
function e0(t, e) {
  var n, r, i, o = "style." + e, s = "end." + o, a;
  return function() {
    var u = ce(this, t), f = u.on, c = u.value[o] == null ? a || (a = wa(e)) : void 0;
    (f !== n || i !== c) && (r = (n = f).copy()).on(s, i = c), u.on = r;
  };
}
function n0(t, e, n) {
  var r = (t += "") == "transform" ? nd : ya;
  return e == null ? this.styleTween(t, Qd(t, r)).on("end.style." + t, wa(t)) : typeof e == "function" ? this.styleTween(t, t0(t, r, Qi(this, "style." + t, e))).each(e0(this._id, t)) : this.styleTween(t, $d(t, r, e), n).on("end.style." + t, null);
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
  return this.tween("text", typeof t == "function" ? a0(Qi(this, "text", t)) : s0(t == null ? "" : t + ""));
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
  for (var t = this._name, e = this._id, n = xa(), r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, f = 0; f < a; ++f)
      if (u = s[f]) {
        var c = ee(u, e);
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
      var f = ce(this, r), c = f.on;
      c !== t && (e = (t = c).copy(), e._.cancel.push(a), e._.interrupt.push(a), e._.end.push(u)), f.on = e;
    }), i === 0 && o();
  });
}
var g0 = 0;
function xe(t, e, n, r) {
  this._groups = t, this._parents = e, this._name = n, this._id = r;
}
function xa() {
  return ++g0;
}
var ge = ur.prototype;
xe.prototype = {
  constructor: xe,
  select: Kd,
  selectAll: Zd,
  selectChild: ge.selectChild,
  selectChildren: ge.selectChildren,
  filter: Bd,
  merge: Vd,
  selection: Jd,
  transition: h0,
  call: ge.call,
  nodes: ge.nodes,
  node: ge.node,
  size: ge.size,
  empty: ge.empty,
  each: ge.each,
  on: qd,
  attr: Sd,
  attrTween: Id,
  style: n0,
  styleTween: o0,
  text: l0,
  textTween: c0,
  remove: Wd,
  tween: _d,
  delay: Cd,
  duration: Od,
  ease: Dd,
  easeVarying: Hd,
  end: d0,
  [Symbol.iterator]: ge[Symbol.iterator]
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
  t instanceof xe ? (e = t._id, t = t._name) : (e = xa(), (n = m0).time = ji(), t = t == null ? null : t + "");
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
var ba = new _e(1, 0, 0);
_e.prototype;
function ni(t) {
  t.stopImmediatePropagation();
}
function Hn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function w0(t) {
  return (!t.ctrlKey || t.type === "wheel") && !t.button;
}
function x0() {
  var t = this;
  return t instanceof SVGElement ? (t = t.ownerSVGElement || t, t.hasAttribute("viewBox") ? (t = t.viewBox.baseVal, [[t.x, t.y], [t.x + t.width, t.y + t.height]]) : [[0, 0], [t.width.baseVal.value, t.height.baseVal.value]]) : [[0, 0], [t.clientWidth, t.clientHeight]];
}
function Vo() {
  return this.__zoom || ba;
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
  var t = w0, e = x0, n = E0, r = b0, i = k0, o = [0, 1 / 0], s = [[-1 / 0, -1 / 0], [1 / 0, 1 / 0]], a = 250, u = ad, f = Gr("start", "zoom", "end"), c, d, h, g = 500, p = 150, w = 0, T = 10;
  function k(m) {
    m.property("__zoom", Vo).on("wheel.zoom", C, { passive: !1 }).on("mousedown.zoom", Y).on("dblclick.zoom", U).filter(i).on("touchstart.zoom", G).on("touchmove.zoom", it).on("touchend.zoom touchcancel.zoom", H).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  k.transform = function(m, M, x, z) {
    var O = m.selection ? m.selection() : m;
    O.property("__zoom", Vo), m !== O ? I(m, M, x, z) : O.interrupt().each(function() {
      b(this, arguments).event(z).start().zoom(null, typeof M == "function" ? M.apply(this, arguments) : M).end();
    });
  }, k.scaleBy = function(m, M, x, z) {
    k.scaleTo(m, function() {
      var O = this.__zoom.k, B = typeof M == "function" ? M.apply(this, arguments) : M;
      return O * B;
    }, x, z);
  }, k.scaleTo = function(m, M, x, z) {
    k.transform(m, function() {
      var O = e.apply(this, arguments), B = this.__zoom, q = x == null ? y(O) : typeof x == "function" ? x.apply(this, arguments) : x, Q = B.invert(q), S = typeof M == "function" ? M.apply(this, arguments) : M;
      return n(P(V(B, S), q, Q), O, s);
    }, x, z);
  }, k.translateBy = function(m, M, x, z) {
    k.transform(m, function() {
      return n(this.__zoom.translate(
        typeof M == "function" ? M.apply(this, arguments) : M,
        typeof x == "function" ? x.apply(this, arguments) : x
      ), e.apply(this, arguments), s);
    }, null, z);
  }, k.translateTo = function(m, M, x, z, O) {
    k.transform(m, function() {
      var B = e.apply(this, arguments), q = this.__zoom, Q = z == null ? y(B) : typeof z == "function" ? z.apply(this, arguments) : z;
      return n(ba.translate(Q[0], Q[1]).scale(q.k).translate(
        typeof M == "function" ? -M.apply(this, arguments) : -M,
        typeof x == "function" ? -x.apply(this, arguments) : -x
      ), B, s);
    }, z, O);
  };
  function V(m, M) {
    return M = Math.max(o[0], Math.min(o[1], M)), M === m.k ? m : new _e(M, m.x, m.y);
  }
  function P(m, M, x) {
    var z = M[0] - x[0] * m.k, O = M[1] - x[1] * m.k;
    return z === m.x && O === m.y ? m : new _e(m.k, z, O);
  }
  function y(m) {
    return [(+m[0][0] + +m[1][0]) / 2, (+m[0][1] + +m[1][1]) / 2];
  }
  function I(m, M, x, z) {
    m.on("start.zoom", function() {
      b(this, arguments).event(z).start();
    }).on("interrupt.zoom end.zoom", function() {
      b(this, arguments).event(z).end();
    }).tween("zoom", function() {
      var O = this, B = arguments, q = b(O, B).event(z), Q = e.apply(O, B), S = x == null ? y(Q) : typeof x == "function" ? x.apply(O, B) : x, F = Math.max(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), R = O.__zoom, D = typeof M == "function" ? M.apply(O, B) : M, Z = u(R.invert(S).concat(F / R.k), D.invert(S).concat(F / D.k));
      return function(E) {
        if (E === 1) E = D;
        else {
          var A = Z(E), K = F / A[2];
          E = new _e(K, S[0] - A[0] * K, S[1] - A[1] * K);
        }
        q.zoom(null, E);
      };
    });
  }
  function b(m, M, x) {
    return !x && m.__zooming || new N(m, M);
  }
  function N(m, M) {
    this.that = m, this.args = M, this.active = 0, this.sourceEvent = null, this.extent = e.apply(m, M), this.taps = 0;
  }
  N.prototype = {
    event: function(m) {
      return m && (this.sourceEvent = m), this;
    },
    start: function() {
      return ++this.active === 1 && (this.that.__zooming = this, this.emit("start")), this;
    },
    zoom: function(m, M) {
      return this.mouse && m !== "mouse" && (this.mouse[1] = M.invert(this.mouse[0])), this.touch0 && m !== "touch" && (this.touch0[1] = M.invert(this.touch0[0])), this.touch1 && m !== "touch" && (this.touch1[1] = M.invert(this.touch1[0])), this.that.__zoom = M, this.emit("zoom"), this;
    },
    end: function() {
      return --this.active === 0 && (delete this.that.__zooming, this.emit("end")), this;
    },
    emit: function(m) {
      var M = Tt(this.that).datum();
      f.call(
        m,
        this.that,
        new y0(m, {
          sourceEvent: this.sourceEvent,
          target: k,
          transform: this.that.__zoom,
          dispatch: f
        }),
        M
      );
    }
  };
  function C(m, ...M) {
    if (!t.apply(this, arguments)) return;
    var x = b(this, M).event(m), z = this.__zoom, O = Math.max(o[0], Math.min(o[1], z.k * Math.pow(2, r.apply(this, arguments)))), B = ve(m);
    if (x.wheel)
      (x.mouse[0][0] !== B[0] || x.mouse[0][1] !== B[1]) && (x.mouse[1] = z.invert(x.mouse[0] = B)), clearTimeout(x.wheel);
    else {
      if (z.k === O) return;
      x.mouse = [B, z.invert(B)], Mr(this), x.start();
    }
    Hn(m), x.wheel = setTimeout(q, p), x.zoom("mouse", n(P(V(z, O), x.mouse[0], x.mouse[1]), x.extent, s));
    function q() {
      x.wheel = null, x.end();
    }
  }
  function Y(m, ...M) {
    if (h || !t.apply(this, arguments)) return;
    var x = m.currentTarget, z = b(this, M, !0).event(m), O = Tt(m.view).on("mousemove.zoom", S, !0).on("mouseup.zoom", F, !0), B = ve(m, x), q = m.clientX, Q = m.clientY;
    sa(m.view), ni(m), z.mouse = [B, this.__zoom.invert(B)], Mr(this), z.start();
    function S(R) {
      if (Hn(R), !z.moved) {
        var D = R.clientX - q, Z = R.clientY - Q;
        z.moved = D * D + Z * Z > w;
      }
      z.event(R).zoom("mouse", n(P(z.that.__zoom, z.mouse[0] = ve(R, x), z.mouse[1]), z.extent, s));
    }
    function F(R) {
      O.on("mousemove.zoom mouseup.zoom", null), aa(R.view, z.moved), Hn(R), z.event(R).end();
    }
  }
  function U(m, ...M) {
    if (t.apply(this, arguments)) {
      var x = this.__zoom, z = ve(m.changedTouches ? m.changedTouches[0] : m, this), O = x.invert(z), B = x.k * (m.shiftKey ? 0.5 : 2), q = n(P(V(x, B), z, O), e.apply(this, M), s);
      Hn(m), a > 0 ? Tt(this).transition().duration(a).call(I, q, z, m) : Tt(this).call(k.transform, q, z, m);
    }
  }
  function G(m, ...M) {
    if (t.apply(this, arguments)) {
      var x = m.touches, z = x.length, O = b(this, M, m.changedTouches.length === z).event(m), B, q, Q, S;
      for (ni(m), q = 0; q < z; ++q)
        Q = x[q], S = ve(Q, this), S = [S, this.__zoom.invert(S), Q.identifier], O.touch0 ? !O.touch1 && O.touch0[2] !== S[2] && (O.touch1 = S, O.taps = 0) : (O.touch0 = S, B = !0, O.taps = 1 + !!c);
      c && (c = clearTimeout(c)), B && (O.taps < 2 && (d = S[0], c = setTimeout(function() {
        c = null;
      }, g)), Mr(this), O.start());
    }
  }
  function it(m, ...M) {
    if (this.__zooming) {
      var x = b(this, M).event(m), z = m.changedTouches, O = z.length, B, q, Q, S;
      for (Hn(m), B = 0; B < O; ++B)
        q = z[B], Q = ve(q, this), x.touch0 && x.touch0[2] === q.identifier ? x.touch0[0] = Q : x.touch1 && x.touch1[2] === q.identifier && (x.touch1[0] = Q);
      if (q = x.that.__zoom, x.touch1) {
        var F = x.touch0[0], R = x.touch0[1], D = x.touch1[0], Z = x.touch1[1], E = (E = D[0] - F[0]) * E + (E = D[1] - F[1]) * E, A = (A = Z[0] - R[0]) * A + (A = Z[1] - R[1]) * A;
        q = V(q, Math.sqrt(E / A)), Q = [(F[0] + D[0]) / 2, (F[1] + D[1]) / 2], S = [(R[0] + Z[0]) / 2, (R[1] + Z[1]) / 2];
      } else if (x.touch0) Q = x.touch0[0], S = x.touch0[1];
      else return;
      x.zoom("touch", n(P(q, Q, S), x.extent, s));
    }
  }
  function H(m, ...M) {
    if (this.__zooming) {
      var x = b(this, M).event(m), z = m.changedTouches, O = z.length, B, q;
      for (ni(m), h && clearTimeout(h), h = setTimeout(function() {
        h = null;
      }, g), B = 0; B < O; ++B)
        q = z[B], x.touch0 && x.touch0[2] === q.identifier ? delete x.touch0 : x.touch1 && x.touch1[2] === q.identifier && delete x.touch1;
      if (x.touch1 && !x.touch0 && (x.touch0 = x.touch1, delete x.touch1), x.touch0) x.touch0[1] = this.__zoom.invert(x.touch0[0]);
      else if (x.end(), x.taps === 2 && (q = ve(q, this), Math.hypot(d[0] - q[0], d[1] - q[1]) < T)) {
        var Q = Tt(this).on("dblclick.zoom");
        Q && Q.apply(this, arguments);
      }
    }
  }
  return k.wheelDelta = function(m) {
    return arguments.length ? (r = typeof m == "function" ? m : yr(+m), k) : r;
  }, k.filter = function(m) {
    return arguments.length ? (t = typeof m == "function" ? m : yr(!!m), k) : t;
  }, k.touchable = function(m) {
    return arguments.length ? (i = typeof m == "function" ? m : yr(!!m), k) : i;
  }, k.extent = function(m) {
    return arguments.length ? (e = typeof m == "function" ? m : yr([[+m[0][0], +m[0][1]], [+m[1][0], +m[1][1]]]), k) : e;
  }, k.scaleExtent = function(m) {
    return arguments.length ? (o[0] = +m[0], o[1] = +m[1], k) : [o[0], o[1]];
  }, k.translateExtent = function(m) {
    return arguments.length ? (s[0][0] = +m[0][0], s[1][0] = +m[1][0], s[0][1] = +m[0][1], s[1][1] = +m[1][1], k) : [[s[0][0], s[0][1]], [s[1][0], s[1][1]]];
  }, k.constrain = function(m) {
    return arguments.length ? (n = m, k) : n;
  }, k.duration = function(m) {
    return arguments.length ? (a = +m, k) : a;
  }, k.interpolate = function(m) {
    return arguments.length ? (u = m, k) : u;
  }, k.on = function() {
    var m = f.on.apply(f, arguments);
    return m === f ? k : m;
  }, k.clickDistance = function(m) {
    return arguments.length ? (w = (m = +m) * m, k) : Math.sqrt(w);
  }, k.tapDistance = function(m) {
    return arguments.length ? (T = +m, k) : T;
  }, k;
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
const Bn = 12;
function M0(t) {
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
const Xo = [
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
function A0(t) {
  if (!t || t.length === 0) return;
  const e = t.reduce((n, r) => n + r, 0);
  return Xo[e % Xo.length];
}
var P0 = /* @__PURE__ */ ut('<path fill="none" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke="white" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke-linecap="round" pointer-events="none"></path>', 1), I0 = /* @__PURE__ */ ut('<path class="link" fill="none" stroke-linecap="round" pointer-events="none"></path>'), T0 = /* @__PURE__ */ ut('<text class="link-label" text-anchor="middle"> </text>'), z0 = /* @__PURE__ */ ut('<text class="link-label" text-anchor="middle"> </text>'), C0 = /* @__PURE__ */ ut("<!><!>", 1), R0 = /* @__PURE__ */ ut('<g class="link-group"><!><path fill="none" stroke="transparent" stroke-linecap="round" class="link-hit"></path><!></g>');
function L0(t, e) {
  an(e, !0);
  let n = wt(e, "selected", 3, !1), r = wt(e, "interactive", 3, !1);
  const i = /* @__PURE__ */ L(() => N0(e.edge.points)), o = /* @__PURE__ */ L(() => e.edge.link), s = /* @__PURE__ */ L(() => {
    var b;
    return ((b = l(o)) == null ? void 0 : b.type) ?? "solid";
  }), a = /* @__PURE__ */ L(() => () => {
    var b, N;
    switch (l(s)) {
      case "dashed":
        return "5 3";
      default:
        return ((N = (b = l(o)) == null ? void 0 : b.style) == null ? void 0 : N.strokeDasharray) ?? "";
    }
  }), u = /* @__PURE__ */ L(() => {
    var b, N, C;
    return n() ? e.colors.selection : ((N = (b = l(o)) == null ? void 0 : b.style) == null ? void 0 : N.stroke) ?? A0((C = l(o)) == null ? void 0 : C.vlan) ?? e.colors.linkStroke;
  }), f = /* @__PURE__ */ L(() => l(s) === "double"), c = /* @__PURE__ */ L(() => () => {
    var N;
    return (N = l(o)) != null && N.label ? [Array.isArray(l(o).label) ? l(o).label.join(" / ") : l(o).label] : [];
  }), d = /* @__PURE__ */ L(() => () => {
    var b;
    return !((b = l(o)) != null && b.vlan) || l(o).vlan.length === 0 ? "" : l(o).vlan.length === 1 ? `VLAN ${l(o).vlan[0]}` : `VLAN ${l(o).vlan.join(", ")}`;
  }), h = /* @__PURE__ */ L(() => () => {
    if (e.edge.points.length < 2) return null;
    const b = Math.floor(e.edge.points.length / 2), N = e.edge.points[b - 1], C = e.edge.points[b];
    return !N || !C ? null : { x: (N.x + C.x) / 2, y: (N.y + C.y) / 2 };
  });
  function g(b) {
    var N;
    r() && (b.stopPropagation(), (N = e.onselect) == null || N.call(e, e.edge.id));
  }
  function p(b) {
    var N, C;
    r() && (b.preventDefault(), b.stopPropagation(), (N = e.onselect) == null || N.call(e, e.edge.id), (C = e.oncontextmenu) == null || C.call(e, e.edge.id, b));
  }
  var w = R0(), T = dt(w);
  {
    var k = (b) => {
      const N = /* @__PURE__ */ L(() => Math.max(3, Math.round(e.edge.width * 0.9)));
      var C = P0(), Y = Yt(C), U = nt(Y), G = nt(U);
      lt(
        (it, H) => {
          v(Y, "d", l(i)), v(Y, "stroke", l(u)), v(Y, "stroke-width", e.edge.width + l(N) * 2), v(U, "d", l(i)), v(U, "stroke-width", it), v(G, "d", l(i)), v(G, "stroke", l(u)), v(G, "stroke-width", H);
        },
        [
          () => Math.max(1, e.edge.width),
          () => Math.max(1, e.edge.width - Math.round(l(N) * 0.8))
        ]
      ), et(b, C);
    }, V = (b) => {
      var N = I0();
      lt(
        (C) => {
          v(N, "d", l(i)), v(N, "stroke", l(u)), v(N, "stroke-width", e.edge.width), v(N, "stroke-dasharray", C);
        },
        [() => l(a)() || void 0]
      ), et(b, N);
    };
    _t(T, (b) => {
      l(f) ? b(k) : b(V, !1);
    });
  }
  var P = nt(T);
  P.__click = g, P.__contextmenu = p;
  var y = nt(P);
  {
    var I = (b) => {
      const N = /* @__PURE__ */ L(() => l(h)());
      var C = Pe(), Y = Yt(C);
      {
        var U = (G) => {
          const it = /* @__PURE__ */ L(() => l(c)()), H = /* @__PURE__ */ L(() => l(d)());
          var m = C0(), M = Yt(m);
          _n(M, 17, () => l(it), Cs, (O, B, q) => {
            var Q = T0(), S = dt(Q);
            lt(() => {
              v(Q, "x", l(N).x), v(Q, "y", l(N).y - 8 + q * 12), jn(S, l(B));
            }), et(O, Q);
          });
          var x = nt(M);
          {
            var z = (O) => {
              var B = z0(), q = dt(B);
              lt(() => {
                v(B, "x", l(N).x), v(B, "y", l(N).y - 8 + l(it).length * 12), jn(q, l(H));
              }), et(O, B);
            };
            _t(x, (O) => {
              l(H) && O(z);
            });
          }
          et(G, m);
        };
        _t(Y, (G) => {
          l(N) && G(U);
        });
      }
      et(b, C);
    };
    _t(y, (b) => {
      l(h)() && b(I);
    });
  }
  lt(
    (b) => {
      v(w, "data-link-id", e.edge.id), v(P, "d", l(i)), v(P, "stroke-width", b);
    },
    [() => Math.max(e.edge.width + 12, 16)]
  ), et(t, w), ln();
}
lr(["click", "contextmenu"]);
var O0 = /* @__PURE__ */ ut('<line stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"></line>');
function F0(t, e) {
  var n = O0();
  lt(() => {
    v(n, "x1", e.fromX), v(n, "y1", e.fromY), v(n, "x2", e.toX), v(n, "y2", e.toY);
  }), et(t, n);
}
function ri(t, e) {
  function n() {
    const { filter: r, onDrag: i } = e(), o = la();
    r && o.filter(r), o.on("drag", (s) => i(s.dx, s.dy)), Tt(t).call(o);
  }
  return n(), {
    update() {
      n();
    },
    destroy() {
      Tt(t).on(".drag", null);
    }
  };
}
function ii(t, e) {
  function n() {
    const { onDrag: r } = e(), i = la().on("drag", (o) => r(o.dx, o.dy));
    Tt(t).call(i);
  }
  return n(), {
    update() {
      n();
    },
    destroy() {
      Tt(t).on(".drag", null);
    }
  };
}
var D0 = /* @__PURE__ */ ut('<rect rx="8" ry="8"></rect>'), Y0 = /* @__PURE__ */ ut("<rect></rect>"), H0 = /* @__PURE__ */ ut("<circle></circle>"), B0 = /* @__PURE__ */ ut("<polygon></polygon>"), V0 = /* @__PURE__ */ ut("<polygon></polygon>"), X0 = /* @__PURE__ */ ut('<g><ellipse></ellipse><rect stroke="none"></rect><line></line><line></line><ellipse></ellipse></g>'), U0 = /* @__PURE__ */ ut("<rect></rect>"), q0 = /* @__PURE__ */ ut("<polygon></polygon>"), G0 = /* @__PURE__ */ ut('<rect rx="8" ry="8"></rect>'), W0 = /* @__PURE__ */ ut('<g class="node-icon"><svg viewBox="0 0 24 24" fill="currentColor"><!></svg></g>'), K0 = /* @__PURE__ */ ut('<text text-anchor="middle"> </text>'), Z0 = /* @__PURE__ */ ut('<rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect>', 1), j0 = /* @__PURE__ */ ut('<circle r="7" fill="#3b82f6" opacity="0.8" pointer-events="none"></circle><text text-anchor="middle" dominant-baseline="central" font-size="11" fill="white" pointer-events="none">+</text>', 1), J0 = /* @__PURE__ */ ut('<g class="node"><g class="node-bg"><!></g><g class="node-fg" pointer-events="none"><!><!></g><!><!></g>');
function Q0(t, e) {
  an(e, !0);
  let n = wt(e, "shadowFilterId", 3, "node-shadow"), r = wt(e, "selected", 3, !1), i = wt(e, "interactive", 3, !1);
  const o = /* @__PURE__ */ L(() => e.node.position.x), s = /* @__PURE__ */ L(() => e.node.position.y), a = /* @__PURE__ */ L(() => e.node.size.width / 2), u = /* @__PURE__ */ L(() => e.node.size.height / 2), f = /* @__PURE__ */ L(() => e.node.node.shape ?? "rounded");
  let c = /* @__PURE__ */ ht(!1);
  const d = /* @__PURE__ */ L(() => r() || l(c)), h = /* @__PURE__ */ L(() => {
    var E;
    return ((E = e.node.node.style) == null ? void 0 : E.fill) ?? (l(d) ? e.colors.nodeHoverFill : e.colors.nodeFill);
  }), g = /* @__PURE__ */ L(() => {
    var E;
    return r() ? e.colors.selection : ((E = e.node.node.style) == null ? void 0 : E.stroke) ?? (l(c) ? e.colors.nodeHoverStroke : e.colors.nodeStroke);
  }), p = /* @__PURE__ */ L(() => {
    var E;
    return r() ? 2.5 : ((E = e.node.node.style) == null ? void 0 : E.strokeWidth) ?? (l(c) ? 2 : 1.5);
  }), w = /* @__PURE__ */ L(() => {
    var E;
    return ((E = e.node.node.style) == null ? void 0 : E.strokeDasharray) ?? "";
  }), T = /* @__PURE__ */ L(() => ru(e.node.node.type)), k = Ql, V = /* @__PURE__ */ L(() => Array.isArray(e.node.node.label) ? e.node.node.label : [e.node.node.label ?? ""]), P = /* @__PURE__ */ L(() => l(V).map((E, A) => {
    const K = E.includes("<b>") || E.includes("<strong>"), W = E.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, ""), ft = A > 0 && !K;
    return { text: W, className: K ? "node-label node-label-bold" : ft ? "node-label-secondary" : "node-label" };
  })), y = /* @__PURE__ */ L(() => l(T) ? k : 0), I = /* @__PURE__ */ L(() => l(y) > 0 ? $l : 0), b = /* @__PURE__ */ L(() => l(P).length * Jr), N = /* @__PURE__ */ L(() => l(y) + l(I) + l(b)), C = /* @__PURE__ */ L(() => l(s) - l(N) / 2), Y = /* @__PURE__ */ L(() => l(C) + l(y) + l(I) + Jr * 0.7);
  let U = /* @__PURE__ */ ht(null);
  function G(E, A) {
    const K = A.currentTarget.getBoundingClientRect();
    if (E === "top" || E === "bottom") {
      const W = Math.max(0, Math.min(1, (A.clientX - K.left) / K.width));
      X(
        U,
        {
          side: E,
          x: l(o) - l(a) + W * e.node.size.width,
          y: E === "top" ? l(s) - l(u) : l(s) + l(u)
        },
        !0
      );
    } else {
      const W = Math.max(0, Math.min(1, (A.clientY - K.top) / K.height));
      X(
        U,
        {
          side: E,
          x: E === "left" ? l(o) - l(a) : l(o) + l(a),
          y: l(s) - l(u) + W * e.node.size.height
        },
        !0
      );
    }
  }
  function it(E) {
    var A;
    l(U) && (E.stopPropagation(), E.preventDefault(), (A = e.onaddport) == null || A.call(e, e.node.id, l(U).side));
  }
  function H(E) {
    var A;
    i() && (E.preventDefault(), E.stopPropagation(), (A = e.oncontextmenu) == null || A.call(e, e.node.id, E));
  }
  var m = J0();
  m.__contextmenu = H;
  var M = dt(m), x = dt(M);
  {
    var z = (E) => {
      var A = D0();
      lt(() => {
        v(A, "x", l(o) - l(a)), v(A, "y", l(s) - l(u)), v(A, "width", e.node.size.width), v(A, "height", e.node.size.height), v(A, "fill", l(h)), v(A, "stroke", l(g)), v(A, "stroke-width", l(p)), v(A, "stroke-dasharray", l(w) || void 0);
      }), et(E, A);
    }, O = (E) => {
      var A = Pe(), K = Yt(A);
      {
        var W = (at) => {
          var ot = Y0();
          lt(() => {
            v(ot, "x", l(o) - l(a)), v(ot, "y", l(s) - l(u)), v(ot, "width", e.node.size.width), v(ot, "height", e.node.size.height), v(ot, "fill", l(h)), v(ot, "stroke", l(g)), v(ot, "stroke-width", l(p)), v(ot, "stroke-dasharray", l(w) || void 0);
          }), et(at, ot);
        }, ft = (at) => {
          var ot = Pe(), he = Yt(ot);
          {
            var ka = (un) => {
              var ne = H0();
              lt(
                (Zr) => {
                  v(ne, "cx", l(o)), v(ne, "cy", l(s)), v(ne, "r", Zr), v(ne, "fill", l(h)), v(ne, "stroke", l(g)), v(ne, "stroke-width", l(p));
                },
                [() => Math.min(l(a), l(u))]
              ), et(un, ne);
            }, Ea = (un) => {
              var ne = Pe(), Zr = Yt(ne);
              {
                var Sa = (fn) => {
                  var Ne = B0();
                  lt(() => {
                    v(Ne, "points", `${l(o) ?? ""},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) ?? ""},${l(s) + l(u)} ${l(o) - l(a)},${l(s) ?? ""}`), v(Ne, "fill", l(h)), v(Ne, "stroke", l(g)), v(Ne, "stroke-width", l(p));
                  }), et(fn, Ne);
                }, Na = (fn) => {
                  var Ne = Pe(), Ma = Yt(Ne);
                  {
                    var Aa = (cn) => {
                      const He = /* @__PURE__ */ L(() => l(a) * 0.866);
                      var Be = V0();
                      lt(() => {
                        v(Be, "points", `${l(o) - l(a)},${l(s) ?? ""} ${l(o) - l(He)},${l(s) - l(u)} ${l(o) + l(He)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) + l(He)},${l(s) + l(u)} ${l(o) - l(He)},${l(s) + l(u)}`), v(Be, "fill", l(h)), v(Be, "stroke", l(g)), v(Be, "stroke-width", l(p));
                      }), et(cn, Be);
                    }, Pa = (cn) => {
                      var He = Pe(), Be = Yt(He);
                      {
                        var Ia = (hn) => {
                          const Lt = /* @__PURE__ */ L(() => e.node.size.height * 0.15);
                          var cr = X0(), re = dt(cr), Me = nt(re), Mt = nt(Me), ct = nt(Mt), de = nt(ct);
                          lt(() => {
                            v(re, "cx", l(o)), v(re, "cy", l(s) + l(u) - l(Lt)), v(re, "rx", l(a)), v(re, "ry", l(Lt)), v(re, "fill", l(h)), v(re, "stroke", l(g)), v(re, "stroke-width", l(p)), v(Me, "x", l(o) - l(a)), v(Me, "y", l(s) - l(u) + l(Lt)), v(Me, "width", e.node.size.width), v(Me, "height", e.node.size.height - l(Lt) * 2), v(Me, "fill", l(h)), v(Mt, "x1", l(o) - l(a)), v(Mt, "y1", l(s) - l(u) + l(Lt)), v(Mt, "x2", l(o) - l(a)), v(Mt, "y2", l(s) + l(u) - l(Lt)), v(Mt, "stroke", l(g)), v(Mt, "stroke-width", l(p)), v(ct, "x1", l(o) + l(a)), v(ct, "y1", l(s) - l(u) + l(Lt)), v(ct, "x2", l(o) + l(a)), v(ct, "y2", l(s) + l(u) - l(Lt)), v(ct, "stroke", l(g)), v(ct, "stroke-width", l(p)), v(de, "cx", l(o)), v(de, "cy", l(s) - l(u) + l(Lt)), v(de, "rx", l(a)), v(de, "ry", l(Lt)), v(de, "fill", l(h)), v(de, "stroke", l(g)), v(de, "stroke-width", l(p));
                          }), et(hn, cr);
                        }, Ta = (hn) => {
                          var Lt = Pe(), cr = Yt(Lt);
                          {
                            var re = (Mt) => {
                              var ct = U0();
                              lt(() => {
                                v(ct, "x", l(o) - l(a)), v(ct, "y", l(s) - l(u)), v(ct, "width", e.node.size.width), v(ct, "height", e.node.size.height), v(ct, "rx", l(u)), v(ct, "ry", l(u)), v(ct, "fill", l(h)), v(ct, "stroke", l(g)), v(ct, "stroke-width", l(p));
                              }), et(Mt, ct);
                            }, Me = (Mt) => {
                              var ct = Pe(), de = Yt(ct);
                              {
                                var za = (dn) => {
                                  const Zt = /* @__PURE__ */ L(() => e.node.size.width * 0.15);
                                  var Dn = q0();
                                  lt(() => {
                                    v(Dn, "points", `${l(o) - l(a) + l(Zt)},${l(s) - l(u)} ${l(o) + l(a) - l(Zt)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) + l(u)} ${l(o) - l(a)},${l(s) + l(u)}`), v(Dn, "fill", l(h)), v(Dn, "stroke", l(g)), v(Dn, "stroke-width", l(p));
                                  }), et(dn, Dn);
                                }, Ca = (dn) => {
                                  var Zt = G0();
                                  lt(() => {
                                    v(Zt, "x", l(o) - l(a)), v(Zt, "y", l(s) - l(u)), v(Zt, "width", e.node.size.width), v(Zt, "height", e.node.size.height), v(Zt, "fill", l(h)), v(Zt, "stroke", l(g)), v(Zt, "stroke-width", l(p));
                                  }), et(dn, Zt);
                                };
                                _t(
                                  de,
                                  (dn) => {
                                    l(f) === "trapezoid" ? dn(za) : dn(Ca, !1);
                                  },
                                  !0
                                );
                              }
                              et(Mt, ct);
                            };
                            _t(
                              cr,
                              (Mt) => {
                                l(f) === "stadium" ? Mt(re) : Mt(Me, !1);
                              },
                              !0
                            );
                          }
                          et(hn, Lt);
                        };
                        _t(
                          Be,
                          (hn) => {
                            l(f) === "cylinder" ? hn(Ia) : hn(Ta, !1);
                          },
                          !0
                        );
                      }
                      et(cn, He);
                    };
                    _t(
                      Ma,
                      (cn) => {
                        l(f) === "hexagon" ? cn(Aa) : cn(Pa, !1);
                      },
                      !0
                    );
                  }
                  et(fn, Ne);
                };
                _t(
                  Zr,
                  (fn) => {
                    l(f) === "diamond" ? fn(Sa) : fn(Na, !1);
                  },
                  !0
                );
              }
              et(un, ne);
            };
            _t(
              he,
              (un) => {
                l(f) === "circle" ? un(ka) : un(Ea, !1);
              },
              !0
            );
          }
          et(at, ot);
        };
        _t(
          K,
          (at) => {
            l(f) === "rect" ? at(W) : at(ft, !1);
          },
          !0
        );
      }
      et(E, A);
    };
    _t(x, (E) => {
      l(f) === "rounded" ? E(z) : E(O, !1);
    });
  }
  var B = nt(M), q = dt(B);
  {
    var Q = (E) => {
      var A = W0(), K = dt(A), W = dt(K);
      Rs(W, () => l(T), !0), lt(() => {
        v(A, "transform", `translate(${l(o) - k / 2}, ${l(C) ?? ""})`), v(K, "width", k), v(K, "height", k);
      }), et(E, A);
    };
    _t(q, (E) => {
      l(T) && E(Q);
    });
  }
  var S = nt(q);
  _n(S, 17, () => l(P), Cs, (E, A, K) => {
    var W = K0(), ft = dt(W);
    lt(() => {
      v(W, "x", l(o)), v(W, "y", l(Y) + K * Jr), Xi(W, 0, Bl(l(A).className)), jn(ft, l(A).text);
    }), et(E, W);
  });
  var F = nt(B);
  {
    var R = (E) => {
      const A = /* @__PURE__ */ L(() => 10);
      var K = Z0(), W = Yt(K);
      v(W, "height", l(A)), W.__pointermove = (he) => G("top", he), W.__pointerdown = it;
      var ft = nt(W);
      v(ft, "height", l(A)), ft.__pointermove = (he) => G("bottom", he), ft.__pointerdown = it;
      var at = nt(ft);
      v(at, "width", l(A)), at.__pointermove = (he) => G("left", he), at.__pointerdown = it;
      var ot = nt(at);
      v(ot, "width", l(A)), ot.__pointermove = (he) => G("right", he), ot.__pointerdown = it, lt(() => {
        v(W, "x", l(o) - l(a)), v(W, "y", l(s) - l(u) - l(A) / 2), v(W, "width", e.node.size.width), v(ft, "x", l(o) - l(a)), v(ft, "y", l(s) + l(u) - l(A) / 2), v(ft, "width", e.node.size.width), v(at, "x", l(o) - l(a) - l(A) / 2), v(at, "y", l(s) - l(u)), v(at, "height", e.node.size.height), v(ot, "x", l(o) + l(a) - l(A) / 2), v(ot, "y", l(s) - l(u)), v(ot, "height", e.node.size.height);
      }), Ie("pointerleave", W, () => {
        X(U, null);
      }), Ie("pointerleave", ft, () => {
        X(U, null);
      }), Ie("pointerleave", at, () => {
        X(U, null);
      }), Ie("pointerleave", ot, () => {
        X(U, null);
      }), et(E, K);
    };
    _t(F, (E) => {
      i() && l(c) && E(R);
    });
  }
  var D = nt(F);
  {
    var Z = (E) => {
      var A = j0(), K = Yt(A), W = nt(K);
      lt(() => {
        v(K, "cx", l(U).x), v(K, "cy", l(U).y), v(W, "x", l(U).x), v(W, "y", l(U).y);
      }), et(E, A);
    };
    _t(D, (E) => {
      l(U) && E(Z);
    });
  }
  Ls(m, (E, A) => ri == null ? void 0 : ri(E, A), () => () => ({
    filter: (E) => {
      const A = E.target;
      return !A.closest(".port") && !A.closest(".edge-zone") && E.button === 0 && i();
    },
    onDrag: (E, A) => {
      var K;
      return (K = e.ondragmove) == null ? void 0 : K.call(e, e.node.id, e.node.position.x + E, e.node.position.y + A);
    }
  })), lt(() => {
    v(m, "data-id", e.node.id), v(m, "data-device-type", e.node.node.type ?? ""), v(m, "filter", `url(#${n() ?? ""})`);
  }), Ie("pointerenter", m, () => {
    i() && X(c, !0);
  }), Ie("pointerleave", m, () => {
    X(c, !1);
  }), et(t, m), ln();
}
lr(["contextmenu", "pointermove", "pointerdown"]);
var $0 = /* @__PURE__ */ ut('<rect class="port-label-bg" rx="2" pointer-events="none"></rect><text class="port-label-text" font-size="9"> </text>', 1), tg = /* @__PURE__ */ ut('<g class="port"><rect fill="transparent"></rect><rect class="port-box" rx="2" pointer-events="none"></rect><!></g>');
function eg(t, e) {
  an(e, !0);
  let n = wt(e, "hideLabel", 3, !1), r = wt(e, "selected", 3, !1), i = wt(e, "interactive", 3, !1), o = wt(e, "linked", 3, !1);
  const s = /* @__PURE__ */ L(() => e.port.absolutePosition.x), a = /* @__PURE__ */ L(() => e.port.absolutePosition.y), u = /* @__PURE__ */ L(() => e.port.size.width), f = /* @__PURE__ */ L(() => e.port.size.height), c = /* @__PURE__ */ L(() => M0(e.port)), d = /* @__PURE__ */ L(() => e.port.label.length * tu + 4), h = 12, g = /* @__PURE__ */ L(() => () => l(c).textAnchor === "middle" ? l(c).x - l(d) / 2 : l(c).textAnchor === "end" ? l(c).x - l(d) + 2 : l(c).x - 2), p = /* @__PURE__ */ L(() => l(c).y - h + 3);
  let w = /* @__PURE__ */ ht(!1);
  function T(C) {
    var Y, U;
    !i() || C.button !== 0 || (C.stopPropagation(), C.preventDefault(), o() ? (Y = e.onselect) == null || Y.call(e, e.port.id) : (U = e.onlinkstart) == null || U.call(e, e.port.id, l(s), l(a)));
  }
  function k(C) {
    var Y;
    i() && (C.stopPropagation(), (Y = e.onlinkend) == null || Y.call(e, e.port.id));
  }
  function V(C) {
    var Y;
    i() && (C.preventDefault(), C.stopPropagation(), (Y = e.oncontextmenu) == null || Y.call(e, e.port.id, C));
  }
  var P = tg();
  P.__contextmenu = V;
  var y = dt(P);
  v(y, "width", 24), v(y, "height", 24), y.__pointerdown = T, y.__pointerup = k;
  var I = nt(y), b = nt(I);
  {
    var N = (C) => {
      var Y = $0(), U = Yt(Y);
      v(U, "height", h);
      var G = nt(U);
      G.__click = (H) => {
        var m;
        i() && (H.stopPropagation(), (m = e.onlabeledit) == null || m.call(e, e.port.id, e.port.label, H.clientX, H.clientY));
      };
      var it = dt(G);
      lt(
        (H) => {
          v(U, "x", H), v(U, "y", l(p)), v(U, "width", l(d)), v(U, "fill", e.colors.portLabelBg), v(G, "x", l(c).x), v(G, "y", l(c).y), v(G, "text-anchor", l(c).textAnchor), v(G, "fill", e.colors.portLabelColor), jn(it, e.port.label);
        },
        [() => l(g)()]
      ), et(C, Y);
    };
    _t(b, (C) => {
      n() || C(N);
    });
  }
  lt(() => {
    v(P, "data-port", e.port.id), v(P, "data-port-device", e.port.nodeId), Xi(y, 0, `port-hit ${o() ? "linked" : ""}`), v(y, "x", l(s) - 12), v(y, "y", l(a) - 12), v(I, "x", l(s) - l(u) / 2 - (r() || l(w) ? 2 : 0)), v(I, "y", l(a) - l(f) / 2 - (r() || l(w) ? 2 : 0)), v(I, "width", l(u) + (r() || l(w) ? 4 : 0)), v(I, "height", l(f) + (r() || l(w) ? 4 : 0)), v(I, "fill", r() ? e.colors.selection : l(w) ? "#3b82f6" : e.colors.portFill), v(I, "stroke", r() ? e.colors.selection : l(w) ? "#2563eb" : e.colors.portStroke), v(I, "stroke-width", r() || l(w) ? 2 : 1);
  }), Ie("pointerenter", P, () => {
    X(w, i());
  }), Ie("pointerleave", P, () => {
    X(w, !1);
  }), et(t, P), ln();
}
lr(["contextmenu", "pointerdown", "pointerup", "click"]);
var ng = /* @__PURE__ */ ut('<g class="subgraph"><rect class="subgraph-bg" rx="12" ry="12"></rect><rect fill="transparent"></rect><text class="subgraph-label" text-anchor="start" pointer-events="none"> </text></g>');
function rg(t, e) {
  an(e, !0);
  let n = wt(e, "selected", 3, !1);
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
    const g = l(r).fill, p = l(r).stroke;
    if (g && i.includes(g) && e.theme) {
      const w = e.theme.colors.surfaces[g];
      return {
        fill: w.fill,
        stroke: p ?? w.stroke,
        text: w.text
      };
    }
    return {
      fill: g ?? e.colors.subgraphFill,
      stroke: p ?? e.colors.subgraphStroke,
      text: e.colors.subgraphText
    };
  }), s = /* @__PURE__ */ L(() => l(r).strokeWidth ?? 3), a = /* @__PURE__ */ L(() => l(r).strokeDasharray ?? "");
  var u = ng(), f = dt(u);
  f.__click = (g) => {
    var p;
    g.stopPropagation(), (p = e.onselect) == null || p.call(e, e.subgraph.id);
  };
  var c = nt(f);
  v(c, "height", 28), Ls(c, (g, p) => ii == null ? void 0 : ii(g, p), () => () => ({
    onDrag: (g, p) => {
      var w;
      return (w = e.ondragmove) == null ? void 0 : w.call(e, e.subgraph.id, e.subgraph.bounds.x + g, e.subgraph.bounds.y + p);
    }
  }));
  var d = nt(c), h = dt(d);
  lt(
    (g, p, w) => {
      v(u, "data-id", e.subgraph.id), v(f, "x", e.subgraph.bounds.x), v(f, "y", e.subgraph.bounds.y), v(f, "width", e.subgraph.bounds.width), v(f, "height", e.subgraph.bounds.height), v(f, "fill", g), v(f, "stroke", p), v(f, "stroke-width", n() ? 3 : l(s)), v(f, "stroke-dasharray", n() ? void 0 : l(a) || void 0), v(c, "data-sg-drag", e.subgraph.id), v(c, "x", e.subgraph.bounds.x), v(c, "y", e.subgraph.bounds.y), v(c, "width", e.subgraph.bounds.width), v(d, "x", e.subgraph.bounds.x + 10), v(d, "y", e.subgraph.bounds.y + 20), v(d, "fill", w), jn(h, e.subgraph.subgraph.label);
    },
    [
      () => l(o)().fill,
      () => n() ? "#3b82f6" : l(o)().stroke,
      () => l(o)().text
    ]
  ), et(t, u), ln();
}
lr(["click"]);
var ig = /* @__PURE__ */ ut('<svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7"></polygon></marker><filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"></feDropShadow></filter><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke-width="0.5"></path></pattern></defs><!><g class="viewport"><rect class="canvas-bg" x="-99999" y="-99999" width="199998" height="199998" fill="url(#grid)"></rect><!><!><!><!><!></g></svg>');
function og(t, e) {
  an(e, !0);
  let n = wt(e, "interactive", 3, !1), r = wt(e, "selection", 19, () => /* @__PURE__ */ new Set()), i = wt(e, "linkedPorts", 19, () => /* @__PURE__ */ new Set()), o = wt(e, "linkPreview", 3, null), s = wt(e, "svgEl", 15, null);
  const a = /* @__PURE__ */ L(() => `${e.bounds.x - 50} ${e.bounds.y - 50} ${e.bounds.width + 100} ${e.bounds.height + 100}`), u = /* @__PURE__ */ L(() => [...e.nodes.values()]), f = /* @__PURE__ */ L(() => [...e.ports.values()]), c = /* @__PURE__ */ L(() => [...e.edges.values()]), d = /* @__PURE__ */ L(() => [...e.subgraphs.values()]);
  let h = /* @__PURE__ */ ht(void 0);
  gi(() => {
    if (!s() || !l(h)) return;
    const H = Tt(s()), m = S0().scaleExtent([0.2, 10]).filter((M) => M.type === "wheel" ? !0 : M.type === "mousedown" || M.type === "pointerdown" ? M.button === 1 || M.altKey : !1).on("zoom", (M) => {
      l(h) && l(h).setAttribute("transform", M.transform.toString());
    });
    return H.call(m), H.on("contextmenu.zoom", null), () => {
      H.on(".zoom", null);
    };
  });
  var g = ig();
  let p;
  var w = dt(g), T = dt(w), k = dt(T), V = nt(T, 2), P = dt(V), y = nt(w);
  Rs(
    y,
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
  var I = nt(y), b = dt(I);
  b.__click = () => {
    var H;
    return (H = e.onbackgroundclick) == null ? void 0 : H.call(e);
  };
  var N = nt(b);
  _n(N, 17, () => l(d), (H) => H.id, (H, m) => {
    {
      let M = /* @__PURE__ */ L(() => r().has(l(m).id));
      rg(H, {
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
          return l(M);
        },
        get ondragmove() {
          return e.onsubgraphmove;
        },
        get onselect() {
          return e.onsubgraphselect;
        }
      });
    }
  });
  var C = nt(N);
  _n(C, 17, () => l(c), (H) => H.id, (H, m) => {
    {
      let M = /* @__PURE__ */ L(() => r().has(l(m).id));
      L0(H, {
        get edge() {
          return l(m);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(M);
        },
        get interactive() {
          return n();
        },
        get onselect() {
          return e.onedgeselect;
        },
        oncontextmenu: (x, z) => {
          var O;
          return (O = e.oncontextmenu) == null ? void 0 : O.call(e, x, "edge", z);
        }
      });
    }
  });
  var Y = nt(C);
  _n(Y, 17, () => l(u), (H) => H.id, (H, m) => {
    {
      let M = /* @__PURE__ */ L(() => r().has(l(m).id));
      Q0(H, {
        get node() {
          return l(m);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(M);
        },
        get interactive() {
          return n();
        },
        get ondragmove() {
          return e.onnodedragmove;
        },
        get onaddport() {
          return e.onaddport;
        },
        oncontextmenu: (x, z) => {
          var O;
          return (O = e.oncontextmenu) == null ? void 0 : O.call(e, x, "node", z);
        }
      });
    }
  });
  var U = nt(Y);
  _n(U, 17, () => l(f), (H) => H.id, (H, m) => {
    {
      let M = /* @__PURE__ */ L(() => r().has(l(m).id)), x = /* @__PURE__ */ L(() => i().has(l(m).id));
      eg(H, {
        get port() {
          return l(m);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(M);
        },
        get interactive() {
          return n();
        },
        get linked() {
          return l(x);
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
        oncontextmenu: (z, O) => {
          var B;
          return (B = e.oncontextmenu) == null ? void 0 : B.call(e, z, "port", O);
        }
      });
    }
  });
  var G = nt(U);
  {
    var it = (H) => {
      F0(H, {
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
    _t(G, (H) => {
      o() && H(it);
    });
  }
  go(I, (H) => X(h, H), () => l(h)), go(g, (H) => s(H), () => s()), lt(() => {
    v(g, "viewBox", l(a)), Ul(g, `width: 100%; height: 100%; user-select: none; background: ${e.colors.background ?? ""};`), p = Xi(g, 0, "", null, p, { interactive: n() }), v(k, "fill", e.colors.linkStroke), v(P, "stroke", e.colors.grid), v(b, "pointer-events", n() ? "fill" : "none");
  }), et(t, g), ln();
}
lr(["click"]);
var sg = /* @__PURE__ */ Il('<div style="width: 100%; height: 100%; outline: none;"><!></div>');
function ag(t, e) {
  var Q;
  an(e, !0);
  let n = wt(e, "theme", 3, void 0), r = wt(e, "mode", 3, "view");
  const i = /* @__PURE__ */ L(() => Kf(n())), o = /* @__PURE__ */ L(() => r() === "edit");
  let s = /* @__PURE__ */ ht(It(new Map(e.layout.nodes))), a = /* @__PURE__ */ ht(It(new Map(e.layout.ports))), u = /* @__PURE__ */ ht(It(new Map(e.layout.edges))), f = /* @__PURE__ */ ht(It(new Map(e.layout.subgraphs))), c = It(e.layout.bounds), d = /* @__PURE__ */ ht(It((Q = e.graph) != null && Q.links ? [...e.graph.links] : [])), h = /* @__PURE__ */ ht(It(/* @__PURE__ */ new Set())), g = /* @__PURE__ */ ht(null), p = /* @__PURE__ */ ht(null);
  const w = /* @__PURE__ */ L(() => {
    const S = /* @__PURE__ */ new Set();
    for (const F of l(u).values())
      F.fromPortId && S.add(F.fromPortId), F.toPortId && S.add(F.toPortId);
    return S;
  });
  gi(() => {
    if (!l(o) || !l(p)) return;
    const S = l(p);
    return S.addEventListener("keydown", z), () => S.removeEventListener("keydown", z);
  }), gi(() => {
    var S, F;
    if (l(h).size === 0)
      (S = e.onselect) == null || S.call(e, null, null);
    else {
      const R = [...l(h)][0] ?? null;
      if (!R) return;
      let D = "node";
      l(u).has(R) ? D = "edge" : l(a).has(R) ? D = "port" : l(f).has(R) && (D = "subgraph"), (F = e.onselect) == null || F.call(e, R, D);
    }
  });
  async function T(S, F, R) {
    const D = await xu(
      S,
      F,
      R,
      {
        nodes: l(s),
        ports: l(a),
        subgraphs: l(f)
      },
      l(d)
    );
    D && (X(s, D.nodes, !0), X(a, D.ports, !0), X(u, D.edges, !0), D.subgraphs && X(f, D.subgraphs, !0));
  }
  async function k(S, F) {
    const R = Au(S, F, l(s), l(a), l(d));
    R && (X(s, R.nodes, !0), X(a, R.ports, !0), X(u, await Wn(R.nodes, R.ports, l(d)), !0));
  }
  async function V(S, F, R) {
    const D = await bu(
      S,
      F,
      R,
      {
        nodes: l(s),
        ports: l(a),
        subgraphs: l(f)
      },
      l(d)
    );
    D && (X(s, D.nodes, !0), X(a, D.ports, !0), X(u, D.edges, !0), X(f, D.subgraphs, !0));
  }
  let P = null;
  function y(S, F, R) {
    var A, K;
    X(g, { fromPortId: S, fromX: F, fromY: R, toX: F, toY: R }, !0);
    function D(W) {
      if (!l(g) || !l(p)) return;
      const at = (l(p).querySelector(".viewport") ?? l(p)).getScreenCTM();
      if (!at) return;
      const ot = new DOMPoint(W.clientX, W.clientY).matrixTransform(at.inverse());
      X(g, { ...l(g), toX: ot.x, toY: ot.y }, !0);
    }
    function Z(W) {
      W.target.closest(".port") || E();
    }
    function E() {
      var W, ft;
      (W = l(p)) == null || W.removeEventListener("pointermove", D), (ft = l(p)) == null || ft.removeEventListener("pointerup", Z), X(g, null), P = null;
    }
    P = E, (A = l(p)) == null || A.addEventListener("pointermove", D), (K = l(p)) == null || K.addEventListener("pointerup", Z);
  }
  function I(S) {
    if (!l(g)) return;
    const F = l(g).fromPortId;
    if (P == null || P(), F === S) return;
    const R = l(a).get(F), D = l(a).get(S);
    R && D && R.nodeId === D.nodeId || b(F, S);
  }
  async function b(S, F) {
    var at;
    const R = S.split(":"), D = F.split(":");
    let Z = R[0] ?? "", E = R.slice(1).join(":"), A = D[0] ?? "", K = D.slice(1).join(":");
    if (!Z || !E || !A || !K || ku(l(d), Z, E, A, K)) return;
    const W = l(s).get(Z), ft = l(s).get(A);
    W && ft && W.position.y > ft.position.y && ([Z, A] = [A, Z], [E, K] = [K, E]), X(
      d,
      [
        ...l(d),
        {
          id: `link-${Date.now()}`,
          from: { node: Z, port: E },
          to: { node: A, port: K }
        }
      ],
      !0
    ), X(u, await Wn(l(s), l(a), l(d)), !0), (at = e.onchange) == null || at.call(e, l(d));
  }
  function N(S) {
    X(h, /* @__PURE__ */ new Set([S]), !0);
  }
  function C(S) {
    X(h, /* @__PURE__ */ new Set([S]), !0);
  }
  function Y(S) {
    X(h, /* @__PURE__ */ new Set([S]), !0);
  }
  function U() {
    X(h, /* @__PURE__ */ new Set(), !0);
  }
  function G(S, F, R, D) {
    var Z;
    (Z = e.onlabeledit) == null || Z.call(e, S, F, R, D);
  }
  function it(S, F, R) {
    var D;
    X(h, /* @__PURE__ */ new Set([S]), !0), (D = e.oncontextmenu) == null || D.call(e, S, F, R.clientX, R.clientY);
  }
  function H(S) {
    const F = `node-${Date.now()}`, R = 180, D = 80, Z = [...l(h)].find((ot) => l(f).has(ot)), E = Z ? l(f).get(Z) : void 0;
    let A, K;
    E ? (A = Z, K = (S == null ? void 0 : S.position) ?? {
      x: E.bounds.x + E.bounds.width / 2,
      y: E.bounds.y + E.bounds.height / 2
    }) : K = (S == null ? void 0 : S.position) ?? {
      x: c.x + c.width + 20 + R / 2,
      y: c.y + c.height / 2
    };
    const W = new Map(l(s));
    W.set(F, {
      id: F,
      position: K,
      size: { width: R, height: D },
      node: {
        id: F,
        label: (S == null ? void 0 : S.label) ?? "New Node",
        shape: "rounded",
        parent: A
      }
    });
    const ft = Vs(F, K.x, K.y, W, 8, l(f)), at = W.get(F);
    if (at && W.set(F, { ...at, position: ft }), X(s, W, !0), A) {
      const ot = new Map(l(f));
      zr(W, ot, l(a)), X(f, ot, !0);
    }
    return X(h, /* @__PURE__ */ new Set([F]), !0), F;
  }
  function m(S) {
    const F = `sg-${Date.now()}`, R = 200, D = 120, Z = (S == null ? void 0 : S.position) ?? {
      x: c.x + c.width + 20 + R / 2,
      y: c.y + c.height / 2
    }, E = new Map(l(f));
    return E.set(F, {
      id: F,
      bounds: {
        x: Z.x - R / 2,
        y: Z.y - D / 2,
        width: R,
        height: D
      },
      subgraph: { id: F, label: (S == null ? void 0 : S.label) ?? "New Group" }
    }), zr(l(s), E, l(a)), X(f, E, !0), F;
  }
  function M(S, F) {
    const R = l(a).get(S);
    if (!R || F === R.label) return;
    const D = new Map(l(a));
    D.set(S, { ...R, label: F }), X(a, D, !0);
  }
  function x() {
    return {
      layout: {
        nodes: l(s),
        ports: l(a),
        edges: l(u),
        subgraphs: l(f),
        bounds: c
      },
      links: l(d)
    };
  }
  function z(S) {
    var F, R;
    if (S.key === "Delete" || S.key === "Backspace") {
      for (const D of l(h))
        if (l(u).has(D)) {
          const Z = l(u).get(D);
          (F = Z == null ? void 0 : Z.link) != null && F.id && X(d, l(d).filter((E) => {
            var A;
            return E.id !== ((A = Z.link) == null ? void 0 : A.id);
          }), !0);
        } else if (l(a).has(D)) {
          const Z = Pu(D, l(s), l(a), l(d));
          Z && (X(s, Z.nodes, !0), X(a, Z.ports, !0), X(d, Z.links, !0));
        }
      Wn(l(s), l(a), l(d)).then((D) => {
        X(u, D, !0);
      }), X(h, /* @__PURE__ */ new Set(), !0), (R = e.onchange) == null || R.call(e, l(d));
    }
    S.key === "Escape" && (X(h, /* @__PURE__ */ new Set(), !0), X(g, null));
  }
  var O = { addNewNode: H, addNewSubgraph: m, commitLabel: M, getSnapshot: x }, B = sg(), q = dt(B);
  return og(q, {
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
      return l(i);
    },
    get theme() {
      return n();
    },
    get interactive() {
      return l(o);
    },
    get selection() {
      return l(h);
    },
    get linkedPorts() {
      return l(w);
    },
    get linkPreview() {
      return l(g);
    },
    onnodedragmove: T,
    onaddport: k,
    onlinkstart: y,
    onlinkend: I,
    onedgeselect: N,
    onportselect: C,
    onlabeledit: G,
    onsubgraphselect: Y,
    onsubgraphmove: V,
    oncontextmenu: it,
    onbackgroundclick: U,
    get svgEl() {
      return l(p);
    },
    set svgEl(S) {
      X(p, S, !0);
    }
  }), et(t, B), ln(O);
}
const gt = It({
  layout: {
    nodes: /* @__PURE__ */ new Map(),
    ports: /* @__PURE__ */ new Map(),
    edges: /* @__PURE__ */ new Map(),
    subgraphs: /* @__PURE__ */ new Map(),
    bounds: { x: 0, y: 0, width: 0, height: 0 }
  }
});
class lg extends HTMLElement {
  constructor() {
    super();
    Ot(this, "_instance", null);
    Ot(this, "_mounted", !1);
    this.attachShadow({ mode: "open" });
  }
  // --- Props (setter updates $state, Svelte auto-reacts, no remount) ---
  set layout(n) {
    gt.layout = n, this._mounted || this._mount();
  }
  get layout() {
    return gt.layout;
  }
  set graph(n) {
    gt.graph = n ? { links: n.links } : void 0;
  }
  get graph() {
    return gt.graph;
  }
  set theme(n) {
    gt.theme = n;
  }
  get theme() {
    return gt.theme;
  }
  set mode(n) {
    gt.mode = n;
  }
  get mode() {
    return gt.mode ?? "view";
  }
  // --- Callbacks (prefixed to avoid HTMLElement conflicts) ---
  set onshumokuselect(n) {
    gt.onselect = n;
  }
  get onshumokuselect() {
    return gt.onselect;
  }
  set onshumokuchange(n) {
    gt.onchange = n;
  }
  get onshumokuchange() {
    return gt.onchange;
  }
  set onshumokucontextmenu(n) {
    gt.oncontextmenu = n;
  }
  get onshumokucontextmenu() {
    return gt.oncontextmenu;
  }
  set onshumokulabeledit(n) {
    gt.onlabeledit = n;
  }
  get onshumokulabeledit() {
    return gt.onlabeledit;
  }
  // --- Methods (delegate to Svelte component exports) ---
  // biome-ignore lint/suspicious/noExplicitAny: Svelte mount exports
  addNewNode(n) {
    var r, i;
    return (i = (r = this._instance) == null ? void 0 : r.addNewNode) == null ? void 0 : i.call(r, n);
  }
  // biome-ignore lint/suspicious/noExplicitAny: Svelte mount exports
  addNewSubgraph(n) {
    var r, i;
    return (i = (r = this._instance) == null ? void 0 : r.addNewSubgraph) == null ? void 0 : i.call(r, n);
  }
  commitLabel(n, r) {
    var i, o;
    (o = (i = this._instance) == null ? void 0 : i.commitLabel) == null || o.call(i, n, r);
  }
  getSnapshot() {
    var n, r;
    return ((r = (n = this._instance) == null ? void 0 : n.getSnapshot) == null ? void 0 : r.call(n)) ?? null;
  }
  // --- SVG ---
  get svgElement() {
    var n;
    return ((n = this.shadowRoot) == null ? void 0 : n.querySelector("svg")) ?? null;
  }
  // --- Lifecycle ---
  connectedCallback() {
    for (const n of [
      "layout",
      "graph",
      "theme",
      "mode",
      "onshumokuselect",
      "onshumokuchange",
      "onshumokucontextmenu",
      "onshumokulabeledit"
    ])
      if (Object.hasOwn(this, n)) {
        const r = this[n];
        delete this[n], this[n] = r;
      }
    gt.layout.nodes.size > 0 && !this._mounted && this._mount();
  }
  disconnectedCallback() {
    this._instance && (lo(this._instance), this._instance = null, this._mounted = !1);
  }
  _mount() {
    this.shadowRoot && (this._instance && lo(this._instance), this._instance = Rl(ag, { target: this.shadowRoot, props: gt }), this._mounted = !0);
  }
}
typeof window < "u" && (customElements.get("shumoku-renderer") || customElements.define("shumoku-renderer", lg));
export {
  lg as ShumokuRendererElement
};
