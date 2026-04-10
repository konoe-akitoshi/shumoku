var Sa = Object.defineProperty;
var Ki = (t) => {
  throw TypeError(t);
};
var Na = (t, e, n) => e in t ? Sa(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var mt = (t, e, n) => Na(t, typeof e != "symbol" ? e + "" : e, n), Jr = (t, e, n) => e.has(t) || Ki("Cannot " + n);
var _ = (t, e, n) => (Jr(t, e, "read from private field"), n ? n.call(t) : e.get(t)), j = (t, e, n) => e.has(t) ? Ki("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, n), W = (t, e, n, r) => (Jr(t, e, "write to private field"), r ? r.call(t, n) : e.set(t, n), n), xt = (t, e, n) => (Jr(t, e, "access private method"), n);
var Ho = Array.isArray, Ma = Array.prototype.indexOf, Vr = Array.from, Aa = Object.defineProperty, wn = Object.getOwnPropertyDescriptor, Pa = Object.getOwnPropertyDescriptors, Ia = Object.prototype, za = Array.prototype, Bo = Object.getPrototypeOf, Zi = Object.isExtensible;
function Ta(t) {
  for (var e = 0; e < t.length; e++)
    t[e]();
}
function Vo() {
  var t, e, n = new Promise((r, i) => {
    t = r, e = i;
  });
  return { promise: n, resolve: t, reject: e };
}
const yt = 2, Pr = 4, Xr = 8, Xo = 1 << 24, be = 16, ke = 32, sn = 64, Si = 128, Gt = 512, kt = 1024, Lt = 2048, Ee = 4096, Yt = 8192, we = 16384, Ni = 32768, zn = 65536, Ji = 1 << 17, qo = 1 << 18, On = 1 << 19, Ca = 1 << 20, Ce = 1 << 25, tn = 32768, ri = 1 << 21, Mi = 1 << 22, Re = 1 << 23, Gn = Symbol("$state"), Ra = Symbol("legacy props"), La = Symbol(""), pn = new class extends Error {
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
function Uo(t) {
  return t === this.v;
}
function rl(t, e) {
  return t != t ? e == e : t !== e || t !== null && typeof t == "object" || typeof t == "function";
}
function Go(t) {
  return !rl(t, this.v);
}
let Wt = null;
function Tn(t) {
  Wt = t;
}
function an(t, e = !1, n) {
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
function ln(t) {
  var e = (
    /** @type {ComponentContext} */
    Wt
  ), n = e.e;
  if (n !== null) {
    e.e = null;
    for (var r of n)
      cs(r);
  }
  return e.i = !0, Wt = e.p, /** @type {T} */
  {};
}
function Wo() {
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
function Ko(t) {
  var e = rt;
  if (e === null)
    return J.f |= Re, t;
  if ((e.f & Ni) === 0) {
    if ((e.f & Si) === 0)
      throw t;
    e.b.error(t);
  } else
    Cn(t, e);
}
function Cn(t, e) {
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
const ol = -7169;
function vt(t, e) {
  t.f = t.f & ol | e;
}
function Ai(t) {
  (t.f & Gt) !== 0 || t.deps === null ? vt(t, kt) : vt(t, Ee);
}
function Zo(t) {
  if (t !== null)
    for (const e of t)
      (e.f & yt) === 0 || (e.f & tn) === 0 || (e.f ^= tn, Zo(
        /** @type {Derived} */
        e.deps
      ));
}
function Jo(t, e, n) {
  (t.f & Lt) !== 0 ? e.add(t) : (t.f & Ee) !== 0 && n.add(t), Zo(t.deps), vt(t, kt);
}
const dr = /* @__PURE__ */ new Set();
let st = null, wt = null, Qt = [], Pi = null, ii = !1;
var bn, kn, Ge, En, ir, Sn, Nn, Mn, ce, oi, si, Qo;
const Wi = class Wi {
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
    return this.is_fork || _(this, En) > 0;
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
      xt(this, ce, oi).call(this, o, n, r);
    if (this.is_deferred())
      xt(this, ce, si).call(this, r), xt(this, ce, si).call(this, n);
    else {
      for (const o of _(this, bn)) o();
      _(this, bn).clear(), _(this, Ge) === 0 && xt(this, ce, Qo).call(this), st = null, Qi(r), Qi(n), (i = _(this, ir)) == null || i.resolve();
    }
    wt = null;
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} value
   */
  capture(e, n) {
    n !== pt && !this.previous.has(e) && this.previous.set(e, n), (e.f & Re) === 0 && (this.current.set(e, e.v), wt == null || wt.set(e, e.v));
  }
  activate() {
    st = this, this.apply();
  }
  deactivate() {
    st === this && (st = null, wt = null);
  }
  flush() {
    if (this.activate(), Qt.length > 0) {
      if (sl(), st !== null && st !== this)
        return;
    } else _(this, Ge) === 0 && this.process([]);
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
    W(this, Ge, _(this, Ge) + 1), e && W(this, En, _(this, En) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(e) {
    W(this, Ge, _(this, Ge) - 1), e && W(this, En, _(this, En) - 1), !_(this, Mn) && (W(this, Mn, !0), Le(() => {
      W(this, Mn, !1), this.is_deferred() ? Qt.length > 0 && this.flush() : this.revive();
    }));
  }
  revive() {
    for (const e of _(this, Sn))
      _(this, Nn).delete(e), vt(e, Lt), ye(e);
    for (const e of _(this, Nn))
      vt(e, Ee), ye(e);
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
    return (_(this, ir) ?? W(this, ir, Vo())).promise;
  }
  static ensure() {
    if (st === null) {
      const e = st = new Wi();
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
oi = function(e, n, r) {
  e.f ^= kt;
  for (var i = e.first, o = null; i !== null; ) {
    var s = i.f, a = (s & (ke | sn)) !== 0, u = a && (s & kt) !== 0, c = u || (s & Yt) !== 0 || this.skipped_effects.has(i);
    if (!c && i.fn !== null) {
      a ? i.f ^= kt : o !== null && (s & (Pr | Xr | Xo)) !== 0 ? o.b.defer_effect(i) : (s & Pr) !== 0 ? n.push(i) : lr(i) && ((s & be) !== 0 && _(this, Sn).add(i), Zn(i));
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
si = function(e) {
  for (var n = 0; n < e.length; n += 1)
    Jo(e[n], _(this, Sn), _(this, Nn));
}, Qo = function() {
  var i;
  if (dr.size > 1) {
    this.previous.clear();
    var e = wt, n = !0;
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
          jo(f, a, u, c);
        if (Qt.length > 0) {
          st = o, o.apply();
          for (const f of Qt)
            xt(i = o, ce, oi).call(i, f, [], []);
          o.deactivate();
        }
        Qt = r;
      }
    }
    st = null, wt = e;
  }
  this.committed = !0, dr.delete(this);
};
let Fe = Wi;
function sl() {
  ii = !0;
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
    ii = !1, Pi = null;
  }
}
function al() {
  try {
    Ha();
  } catch (t) {
    Cn(t, Pi);
  }
}
let Jt = null;
function Qi(t) {
  var e = t.length;
  if (e !== 0) {
    for (var n = 0; n < e; ) {
      var r = t[n++];
      if ((r.f & (we | Yt)) === 0 && lr(r) && (Jt = /* @__PURE__ */ new Set(), Zn(r), r.deps === null && r.first === null && r.nodes === null && (r.teardown === null && r.ac === null ? vs(r) : r.fn = null), (Jt == null ? void 0 : Jt.size) > 0)) {
        Oe.clear();
        for (const i of Jt) {
          if ((i.f & (we | Yt)) !== 0) continue;
          const o = [i];
          let s = i.parent;
          for (; s !== null; )
            Jt.has(s) && (Jt.delete(s), o.push(s)), s = s.parent;
          for (let a = o.length - 1; a >= 0; a--) {
            const u = o[a];
            (u.f & (we | Yt)) === 0 && Zn(u);
          }
        }
        Jt.clear();
      }
    }
    Jt = null;
  }
}
function jo(t, e, n, r) {
  if (!n.has(t) && (n.add(t), t.reactions !== null))
    for (const i of t.reactions) {
      const o = i.f;
      (o & yt) !== 0 ? jo(
        /** @type {Derived} */
        i,
        e,
        n,
        r
      ) : (o & (Mi | be)) !== 0 && (o & Lt) === 0 && $o(i, e, r) && (vt(i, Lt), ye(
        /** @type {Effect} */
        i
      ));
    }
}
function $o(t, e, n) {
  const r = n.get(t);
  if (r !== void 0) return r;
  if (t.deps !== null)
    for (const i of t.deps) {
      if (e.includes(i))
        return !0;
      if ((i.f & yt) !== 0 && $o(
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
function ye(t) {
  for (var e = Pi = t; e.parent !== null; ) {
    e = e.parent;
    var n = e.f;
    if (ii && e === rt && (n & be) !== 0 && (n & qo) === 0)
      return;
    if ((n & (sn | ke)) !== 0) {
      if ((n & kt) === 0) return;
      e.f ^= kt;
    }
  }
  Qt.push(e);
}
function ll(t) {
  let e = 0, n = en(0), r;
  return () => {
    Ti() && (l(n), fs(() => (e === 0 && (r = Li(() => t(() => Wn(n)))), e += 1, () => {
      Le(() => {
        e -= 1, e === 0 && (r == null || r(), r = void 0, Wn(n));
      });
    })));
  };
}
var ul = zn | On | Si;
function cl(t, e, n) {
  new fl(t, e, n);
}
var Vt, Ei, ie, We, oe, Xt, Mt, se, me, ze, Ke, Te, An, Ze, Pn, In, pe, Hr, gt, hl, dl, ai, xr, br, li;
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
    j(this, Vt);
    /** @type {TemplateNode | null} */
    j(this, Ei, null);
    /** @type {BoundaryProps} */
    j(this, ie);
    /** @type {((anchor: Node) => void)} */
    j(this, We);
    /** @type {Effect} */
    j(this, oe);
    /** @type {Effect | null} */
    j(this, Xt, null);
    /** @type {Effect | null} */
    j(this, Mt, null);
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
    j(this, Hr, ll(() => (W(this, pe, en(_(this, Ke))), () => {
      W(this, pe, null);
    })));
    W(this, Vt, e), W(this, ie, n), W(this, We, r), this.parent = /** @type {Effect} */
    rt.b, this.is_pending = !!_(this, ie).pending, W(this, oe, Ci(() => {
      rt.b = this;
      {
        var i = xt(this, gt, ai).call(this);
        try {
          W(this, Xt, qt(() => r(i)));
        } catch (o) {
          this.error(o);
        }
        _(this, Te) > 0 ? xt(this, gt, br).call(this) : this.is_pending = !1;
      }
      return () => {
        var o;
        (o = _(this, ze)) == null || o.remove();
      };
    }, ul));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(e) {
    Jo(e, _(this, Pn), _(this, In));
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
    xt(this, gt, li).call(this, e), W(this, Ke, _(this, Ke) + e), !(!_(this, pe) || _(this, An)) && (W(this, An, !0), Le(() => {
      W(this, An, !1), _(this, pe) && Rn(_(this, pe), _(this, Ke));
    }));
  }
  get_effect_pending() {
    return _(this, Hr).call(this), l(
      /** @type {Source<number>} */
      _(this, pe)
    );
  }
  /** @param {unknown} error */
  error(e) {
    var n = _(this, ie).onerror;
    let r = _(this, ie).failed;
    if (_(this, Ze) || !n && !r)
      throw e;
    _(this, Xt) && (Rt(_(this, Xt)), W(this, Xt, null)), _(this, Mt) && (Rt(_(this, Mt)), W(this, Mt, null)), _(this, se) && (Rt(_(this, se)), W(this, se, null));
    var i = !1, o = !1;
    const s = () => {
      if (i) {
        nl();
        return;
      }
      i = !0, o && Ua(), Fe.ensure(), W(this, Ke, 0), _(this, se) !== null && Qe(_(this, se), () => {
        W(this, se, null);
      }), this.is_pending = this.has_pending_snippet(), W(this, Xt, xt(this, gt, xr).call(this, () => (W(this, Ze, !1), qt(() => _(this, We).call(this, _(this, Vt)))))), _(this, Te) > 0 ? xt(this, gt, br).call(this) : this.is_pending = !1;
    };
    var a = J;
    try {
      Tt(null), o = !0, n == null || n(e, s), o = !1;
    } catch (u) {
      Cn(u, _(this, oe) && _(this, oe).parent);
    } finally {
      Tt(a);
    }
    r && Le(() => {
      W(this, se, xt(this, gt, xr).call(this, () => {
        Fe.ensure(), W(this, Ze, !0);
        try {
          return qt(() => {
            r(
              _(this, Vt),
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
          W(this, Ze, !1);
        }
      }));
    });
  }
}
Vt = new WeakMap(), Ei = new WeakMap(), ie = new WeakMap(), We = new WeakMap(), oe = new WeakMap(), Xt = new WeakMap(), Mt = new WeakMap(), se = new WeakMap(), me = new WeakMap(), ze = new WeakMap(), Ke = new WeakMap(), Te = new WeakMap(), An = new WeakMap(), Ze = new WeakMap(), Pn = new WeakMap(), In = new WeakMap(), pe = new WeakMap(), Hr = new WeakMap(), gt = new WeakSet(), hl = function() {
  try {
    W(this, Xt, qt(() => _(this, We).call(this, _(this, Vt))));
  } catch (e) {
    this.error(e);
  }
}, dl = function() {
  const e = _(this, ie).pending;
  e && (W(this, Mt, qt(() => e(_(this, Vt)))), Le(() => {
    var n = xt(this, gt, ai).call(this);
    W(this, Xt, xt(this, gt, xr).call(this, () => (Fe.ensure(), qt(() => _(this, We).call(this, n))))), _(this, Te) > 0 ? xt(this, gt, br).call(this) : (Qe(
      /** @type {Effect} */
      _(this, Mt),
      () => {
        W(this, Mt, null);
      }
    ), this.is_pending = !1);
  }));
}, ai = function() {
  var e = _(this, Vt);
  return this.is_pending && (W(this, ze, nn()), _(this, Vt).before(_(this, ze)), e = _(this, ze)), e;
}, /**
 * @param {() => Effect | null} fn
 */
xr = function(e) {
  var n = rt, r = J, i = Wt;
  ue(_(this, oe)), Tt(_(this, oe)), Tn(_(this, oe).ctx);
  try {
    return e();
  } catch (o) {
    return Ko(o), null;
  } finally {
    ue(n), Tt(r), Tn(i);
  }
}, br = function() {
  const e = (
    /** @type {(anchor: Node) => void} */
    _(this, ie).pending
  );
  _(this, Xt) !== null && (W(this, me, document.createDocumentFragment()), _(this, me).append(
    /** @type {TemplateNode} */
    _(this, ze)
  ), _s(_(this, Xt), _(this, me))), _(this, Mt) === null && W(this, Mt, qt(() => e(_(this, Vt))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
li = function(e) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && xt(n = this.parent, gt, li).call(n, e);
    return;
  }
  if (W(this, Te, _(this, Te) + e), _(this, Te) === 0) {
    this.is_pending = !1;
    for (const r of _(this, Pn))
      vt(r, Lt), ye(r);
    for (const r of _(this, In))
      vt(r, Ee), ye(r);
    _(this, Pn).clear(), _(this, In).clear(), _(this, Mt) && Qe(_(this, Mt), () => {
      W(this, Mt, null);
    }), _(this, me) && (_(this, Vt).before(_(this, me)), W(this, me, null));
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
    rt
  ), u = vl(), c = o.length === 1 ? o[0].promise : o.length > 1 ? Promise.all(o.map((h) => h.promise)) : null;
  function f(h) {
    u();
    try {
      r(h);
    } catch (g) {
      (a.f & we) === 0 && Cn(g, a);
    }
    s == null || s.deactivate(), ui();
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
  var t = rt, e = J, n = Wt, r = st;
  return function(o = !0) {
    ue(t), Tt(e), Tn(n), o && (r == null || r.activate());
  };
}
function ui() {
  ue(null), Tt(null), Tn(null);
}
// @__NO_SIDE_EFFECTS__
function qr(t) {
  var e = yt | Lt, n = J !== null && (J.f & yt) !== 0 ? (
    /** @type {Derived} */
    J
  ) : null;
  return rt !== null && (rt.f |= On), {
    ctx: Wt,
    deps: null,
    effects: null,
    equals: Uo,
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
function ml(t, e, n) {
  let r = (
    /** @type {Effect | null} */
    rt
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
  ), a = !J, u = /* @__PURE__ */ new Map();
  return Nl(() => {
    var g;
    var c = Vo();
    o = c.promise;
    try {
      Promise.resolve(t()).then(c.resolve, c.reject).then(() => {
        f === st && f.committed && f.deactivate(), ui();
      });
    } catch (m) {
      c.reject(m), ui();
    }
    var f = (
      /** @type {Batch} */
      st
    );
    if (a) {
      var d = i.is_rendered();
      i.update_pending_count(1), f.increment(d), (g = u.get(f)) == null || g.reject(pn), u.delete(f), u.set(f, c);
    }
    const h = (m, b = void 0) => {
      if (f.activate(), b)
        b !== pn && (s.f |= Re, Rn(s, b));
      else {
        (s.f & Re) !== 0 && (s.f ^= Re), Rn(s, m);
        for (const [R, N] of u) {
          if (u.delete(R), R === f) break;
          N.reject(pn);
        }
      }
      a && (i.update_pending_count(-1), f.decrement(d));
    };
    c.promise.then(h, (m) => h(null, m || "unknown"));
  }), us(() => {
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
function D(t) {
  const e = /* @__PURE__ */ qr(t);
  return ws(e), e;
}
// @__NO_SIDE_EFFECTS__
function ts(t) {
  const e = /* @__PURE__ */ qr(t);
  return e.equals = Go, e;
}
function es(t) {
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
      return (e.f & we) === 0 ? (
        /** @type {Effect} */
        e
      ) : null;
    e = e.parent;
  }
  return null;
}
function Ii(t) {
  var e, n = rt;
  ue(pl(t));
  try {
    t.f &= ~tn, es(t), e = ks(t);
  } finally {
    ue(n);
  }
  return e;
}
function ns(t) {
  var e = Ii(t);
  if (!t.equals(e) && (t.wv = xs(), (!(st != null && st.is_fork) || t.deps === null) && (t.v = e, t.deps === null))) {
    vt(t, kt);
    return;
  }
  De || (wt !== null ? (Ti() || st != null && st.is_fork) && wt.set(t, e) : Ai(t));
}
let ci = /* @__PURE__ */ new Set();
const Oe = /* @__PURE__ */ new Map();
let rs = !1;
function en(t, e) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: t,
    reactions: null,
    equals: Uo,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function ft(t, e) {
  const n = en(t);
  return ws(n), n;
}
// @__NO_SIDE_EFFECTS__
function _l(t, e = !1, n = !0) {
  const r = en(t);
  return e || (r.equals = Go), r;
}
function V(t, e, n = !1) {
  J !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!te || (J.f & Ji) !== 0) && Wo() && (J.f & (yt | be | Mi | Ji)) !== 0 && !(St != null && St.includes(t)) && qa();
  let r = n ? Pt(e) : e;
  return Rn(t, r);
}
function Rn(t, e) {
  if (!t.equals(e)) {
    var n = t.v;
    De ? Oe.set(t, e) : Oe.set(t, n), t.v = e;
    var r = Fe.ensure();
    if (r.capture(t, n), (t.f & yt) !== 0) {
      const i = (
        /** @type {Derived} */
        t
      );
      (t.f & Lt) !== 0 && Ii(i), Ai(i);
    }
    t.wv = xs(), is(t, Lt), rt !== null && (rt.f & kt) !== 0 && (rt.f & (ke | sn)) === 0 && (Bt === null ? Al([t]) : Bt.push(t)), !r.is_fork && ci.size > 0 && !rs && wl();
  }
  return e;
}
function wl() {
  rs = !1;
  for (const t of ci)
    (t.f & kt) !== 0 && vt(t, Ee), lr(t) && Zn(t);
  ci.clear();
}
function Wn(t) {
  V(t, t.v + 1);
}
function is(t, e) {
  var n = t.reactions;
  if (n !== null)
    for (var r = n.length, i = 0; i < r; i++) {
      var o = n[i], s = o.f, a = (s & Lt) === 0;
      if (a && vt(o, e), (s & yt) !== 0) {
        var u = (
          /** @type {Derived} */
          o
        );
        wt == null || wt.delete(u), (s & tn) === 0 && (s & Gt && (o.f |= tn), is(u, Ee));
      } else a && ((s & be) !== 0 && Jt !== null && Jt.add(
        /** @type {Effect} */
        o
      ), ye(
        /** @type {Effect} */
        o
      ));
    }
}
function Pt(t) {
  if (typeof t != "object" || t === null || Gn in t)
    return t;
  const e = Bo(t);
  if (e !== Ia && e !== za)
    return t;
  var n = /* @__PURE__ */ new Map(), r = Ho(t), i = /* @__PURE__ */ ft(0), o = je, s = (a) => {
    if (je === o)
      return a();
    var u = J, c = je;
    Tt(null), to(o);
    var f = a();
    return Tt(u), to(c), f;
  };
  return r && n.set("length", /* @__PURE__ */ ft(
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
          var d = /* @__PURE__ */ ft(c.value);
          return n.set(u, d), d;
        }) : V(f, c.value, !0), !0;
      },
      deleteProperty(a, u) {
        var c = n.get(u);
        if (c === void 0) {
          if (u in a) {
            const f = s(() => /* @__PURE__ */ ft(pt));
            n.set(u, f), Wn(i);
          }
        } else
          V(c, pt), Wn(i);
        return !0;
      },
      get(a, u, c) {
        var g;
        if (u === Gn)
          return t;
        var f = n.get(u), d = u in a;
        if (f === void 0 && (!d || (g = wn(a, u)) != null && g.writable) && (f = s(() => {
          var m = Pt(d ? a[u] : pt), b = /* @__PURE__ */ ft(m);
          return b;
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
        if (c !== void 0 || rt !== null && (!f || (h = wn(a, u)) != null && h.writable)) {
          c === void 0 && (c = s(() => {
            var g = f ? Pt(a[u]) : pt, m = /* @__PURE__ */ ft(g);
            return m;
          }), n.set(u, c));
          var d = l(c);
          if (d === pt)
            return !1;
        }
        return f;
      },
      set(a, u, c, f) {
        var z;
        var d = n.get(u), h = u in a;
        if (r && u === "length")
          for (var g = c; g < /** @type {Source<number>} */
          d.v; g += 1) {
            var m = n.get(g + "");
            m !== void 0 ? V(m, pt) : g in a && (m = s(() => /* @__PURE__ */ ft(pt)), n.set(g + "", m));
          }
        if (d === void 0)
          (!h || (z = wn(a, u)) != null && z.writable) && (d = s(() => /* @__PURE__ */ ft(void 0)), V(d, Pt(c)), n.set(u, d));
        else {
          h = d.v !== pt;
          var b = s(() => Pt(c));
          V(d, b);
        }
        var R = Reflect.getOwnPropertyDescriptor(a, u);
        if (R != null && R.set && R.set.call(f, c), !h) {
          if (r && typeof u == "string") {
            var N = (
              /** @type {Source<number>} */
              n.get("length")
            ), H = Number(u);
            Number.isInteger(H) && H >= N.v && V(N, H + 1);
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
var ji, os, ss, as;
function yl() {
  if (ji === void 0) {
    ji = window, os = /Firefox/.test(navigator.userAgent);
    var t = Element.prototype, e = Node.prototype, n = Text.prototype;
    ss = wn(e, "firstChild").get, as = wn(e, "nextSibling").get, Zi(t) && (t.__click = void 0, t.__className = void 0, t.__attributes = null, t.__style = void 0, t.__e = void 0), Zi(n) && (n.__t = void 0);
  }
}
function nn(t = "") {
  return document.createTextNode(t);
}
// @__NO_SIDE_EFFECTS__
function Ut(t) {
  return (
    /** @type {TemplateNode | null} */
    ss.call(t)
  );
}
// @__NO_SIDE_EFFECTS__
function ar(t) {
  return (
    /** @type {TemplateNode | null} */
    as.call(t)
  );
}
function ht(t, e) {
  return /* @__PURE__ */ Ut(t);
}
function At(t, e = !1) {
  {
    var n = /* @__PURE__ */ Ut(t);
    return n instanceof Comment && n.data === "" ? /* @__PURE__ */ ar(n) : n;
  }
}
function it(t, e = 1, n = !1) {
  let r = t;
  for (; e--; )
    r = /** @type {TemplateNode} */
    /* @__PURE__ */ ar(r);
  return r;
}
function xl(t) {
  t.textContent = "";
}
function ls() {
  return !1;
}
function zi(t) {
  var e = J, n = rt;
  Tt(null), ue(null);
  try {
    return t();
  } finally {
    Tt(e), ue(n);
  }
}
function bl(t) {
  rt === null && (J === null && Ya(), Da()), De && Oa();
}
function kl(t, e) {
  var n = e.last;
  n === null ? e.last = e.first = t : (n.next = t, t.prev = n, e.last = t);
}
function Se(t, e, n) {
  var r = rt;
  r !== null && (r.f & Yt) !== 0 && (t |= Yt);
  var i = {
    ctx: Wt,
    deps: null,
    nodes: null,
    f: t | Lt | Gt,
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
      Zn(i), i.f |= Ni;
    } catch (a) {
      throw Rt(i), a;
    }
  else e !== null && ye(i);
  var o = i;
  if (n && o.deps === null && o.teardown === null && o.nodes === null && o.first === o.last && // either `null`, or a singular child
  (o.f & On) === 0 && (o = o.first, (t & be) !== 0 && (t & zn) !== 0 && o !== null && (o.f |= zn)), o !== null && (o.parent = r, r !== null && kl(o, r), J !== null && (J.f & yt) !== 0 && (t & sn) === 0)) {
    var s = (
      /** @type {Derived} */
      J
    );
    (s.effects ?? (s.effects = [])).push(o);
  }
  return i;
}
function Ti() {
  return J !== null && !te;
}
function us(t) {
  const e = Se(Xr, null, !1);
  return vt(e, kt), e.teardown = t, e;
}
function Be(t) {
  bl();
  var e = (
    /** @type {Effect} */
    rt.f
  ), n = !J && (e & ke) !== 0 && (e & Ni) === 0;
  if (n) {
    var r = (
      /** @type {ComponentContext} */
      Wt
    );
    (r.e ?? (r.e = [])).push(t);
  } else
    return cs(t);
}
function cs(t) {
  return Se(Pr | Ca, t, !1);
}
function El(t) {
  Fe.ensure();
  const e = Se(sn | On, t, !0);
  return (n = {}) => new Promise((r) => {
    n.outro ? Qe(e, () => {
      Rt(e), r(void 0);
    }) : (Rt(e), r(void 0));
  });
}
function Sl(t) {
  return Se(Pr, t, !1);
}
function Nl(t) {
  return Se(Mi | On, t, !0);
}
function fs(t, e = 0) {
  return Se(Xr | e, t, !0);
}
function at(t, e = [], n = [], r = []) {
  gl(r, e, n, (i) => {
    Se(Xr, () => t(...i.map(l)), !0);
  });
}
function Ci(t, e = 0) {
  var n = Se(be | e, t, !0);
  return n;
}
function qt(t) {
  return Se(ke | On, t, !0);
}
function hs(t) {
  var e = t.teardown;
  if (e !== null) {
    const n = De, r = J;
    $i(!0), Tt(null);
    try {
      e.call(null);
    } finally {
      $i(n), Tt(r);
    }
  }
}
function ds(t, e = !1) {
  var n = t.first;
  for (t.first = t.last = null; n !== null; ) {
    const i = n.ac;
    i !== null && zi(() => {
      i.abort(pn);
    });
    var r = n.next;
    (n.f & sn) !== 0 ? n.parent = null : Rt(n, e), n = r;
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
  (e || (t.f & qo) !== 0) && t.nodes !== null && t.nodes.end !== null && (gs(
    t.nodes.start,
    /** @type {TemplateNode} */
    t.nodes.end
  ), n = !0), ds(t, e && !n), Ir(t, 0), vt(t, we);
  var r = t.nodes && t.nodes.t;
  if (r !== null)
    for (const o of r)
      o.stop();
  hs(t);
  var i = t.parent;
  i !== null && i.first !== null && vs(t), t.next = t.prev = t.teardown = t.ctx = t.deps = t.fn = t.nodes = t.ac = null;
}
function gs(t, e) {
  for (; t !== null; ) {
    var n = t === e ? null : /* @__PURE__ */ ar(t);
    t.remove(), t = n;
  }
}
function vs(t) {
  var e = t.parent, n = t.prev, r = t.next;
  n !== null && (n.next = r), r !== null && (r.prev = n), e !== null && (e.first === t && (e.first = r), e.last === t && (e.last = n));
}
function Qe(t, e, n = !0) {
  var r = [];
  ms(t, r, !0);
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
function ms(t, e, n) {
  if ((t.f & Yt) === 0) {
    t.f ^= Yt;
    var r = t.nodes && t.nodes.t;
    if (r !== null)
      for (const a of r)
        (a.is_global || n) && e.push(a);
    for (var i = t.first; i !== null; ) {
      var o = i.next, s = (i.f & zn) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (i.f & ke) !== 0 && (t.f & be) !== 0;
      ms(i, e, s ? n : !1), i = o;
    }
  }
}
function Ri(t) {
  ps(t, !0);
}
function ps(t, e) {
  if ((t.f & Yt) !== 0) {
    t.f ^= Yt, (t.f & kt) === 0 && (vt(t, Lt), ye(t));
    for (var n = t.first; n !== null; ) {
      var r = n.next, i = (n.f & zn) !== 0 || (n.f & ke) !== 0;
      ps(n, i ? e : !1), n = r;
    }
    var o = t.nodes && t.nodes.t;
    if (o !== null)
      for (const s of o)
        (s.is_global || e) && s.in();
  }
}
function _s(t, e) {
  if (t.nodes)
    for (var n = t.nodes.start, r = t.nodes.end; n !== null; ) {
      var i = n === r ? null : /* @__PURE__ */ ar(n);
      e.append(n), n = i;
    }
}
let kr = !1, De = !1;
function $i(t) {
  De = t;
}
let J = null, te = !1;
function Tt(t) {
  J = t;
}
let rt = null;
function ue(t) {
  rt = t;
}
let St = null;
function ws(t) {
  J !== null && (St === null ? St = [t] : St.push(t));
}
let It = null, Ot = 0, Bt = null;
function Al(t) {
  Bt = t;
}
let ys = 1, qe = 0, je = qe;
function to(t) {
  je = t;
}
function xs() {
  return ++ys;
}
function lr(t) {
  var e = t.f;
  if ((e & Lt) !== 0)
    return !0;
  if (e & yt && (t.f &= ~tn), (e & Ee) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      t.deps
    ), r = n.length, i = 0; i < r; i++) {
      var o = n[i];
      if (lr(
        /** @type {Derived} */
        o
      ) && ns(
        /** @type {Derived} */
        o
      ), o.wv > t.wv)
        return !0;
    }
    (e & Gt) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    wt === null && vt(t, kt);
  }
  return !1;
}
function bs(t, e, n = !0) {
  var r = t.reactions;
  if (r !== null && !(St != null && St.includes(t)))
    for (var i = 0; i < r.length; i++) {
      var o = r[i];
      (o.f & yt) !== 0 ? bs(
        /** @type {Derived} */
        o,
        e,
        !1
      ) : e === o && (n ? vt(o, Lt) : (o.f & kt) !== 0 && vt(o, Ee), ye(
        /** @type {Effect} */
        o
      ));
    }
}
function ks(t) {
  var m;
  var e = It, n = Ot, r = Bt, i = J, o = St, s = Wt, a = te, u = je, c = t.f;
  It = /** @type {null | Value[]} */
  null, Ot = 0, Bt = null, J = (c & (ke | sn)) === 0 ? t : null, St = null, Tn(t.ctx), te = !1, je = ++qe, t.ac !== null && (zi(() => {
    t.ac.abort(pn);
  }), t.ac = null);
  try {
    t.f |= ri;
    var f = (
      /** @type {Function} */
      t.fn
    ), d = f(), h = t.deps;
    if (It !== null) {
      var g;
      if (Ir(t, Ot), h !== null && Ot > 0)
        for (h.length = Ot + It.length, g = 0; g < It.length; g++)
          h[Ot + g] = It[g];
      else
        t.deps = h = It;
      if (Ti() && (t.f & Gt) !== 0)
        for (g = Ot; g < h.length; g++)
          ((m = h[g]).reactions ?? (m.reactions = [])).push(t);
    } else h !== null && Ot < h.length && (Ir(t, Ot), h.length = Ot);
    if (Wo() && Bt !== null && !te && h !== null && (t.f & (yt | Ee | Lt)) === 0)
      for (g = 0; g < /** @type {Source[]} */
      Bt.length; g++)
        bs(
          Bt[g],
          /** @type {Effect} */
          t
        );
    if (i !== null && i !== t) {
      if (qe++, i.deps !== null)
        for (let b = 0; b < n; b += 1)
          i.deps[b].rv = qe;
      if (e !== null)
        for (const b of e)
          b.rv = qe;
      Bt !== null && (r === null ? r = Bt : r.push(.../** @type {Source[]} */
      Bt));
    }
    return (t.f & Re) !== 0 && (t.f ^= Re), d;
  } catch (b) {
    return Ko(b);
  } finally {
    t.f ^= ri, It = e, Ot = n, Bt = r, J = i, St = o, Tn(s), te = a, je = u;
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
  if (n === null && (e.f & yt) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (It === null || !It.includes(e))) {
    var o = (
      /** @type {Derived} */
      e
    );
    (o.f & Gt) !== 0 && (o.f ^= Gt, o.f &= ~tn), Ai(o), es(o), Ir(o, 0);
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
  if ((e & we) === 0) {
    vt(t, kt);
    var n = rt, r = kr;
    rt = t, kr = !0;
    try {
      (e & (be | Xo)) !== 0 ? Ml(t) : ds(t), hs(t);
      var i = ks(t);
      t.teardown = typeof i == "function" ? i : null, t.wv = ys;
      var o;
    } finally {
      kr = r, rt = n;
    }
  }
}
function l(t) {
  var e = t.f, n = (e & yt) !== 0;
  if (J !== null && !te) {
    var r = rt !== null && (rt.f & we) !== 0;
    if (!r && !(St != null && St.includes(t))) {
      var i = J.deps;
      if ((J.f & ri) !== 0)
        t.rv < qe && (t.rv = qe, It === null && i !== null && i[Ot] === t ? Ot++ : It === null ? It = [t] : It.push(t));
      else {
        (J.deps ?? (J.deps = [])).push(t);
        var o = t.reactions;
        o === null ? t.reactions = [J] : o.includes(J) || o.push(J);
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
      return ((s.f & kt) === 0 && s.reactions !== null || Ss(s)) && (a = Ii(s)), Oe.set(s, a), a;
    }
    var u = (s.f & Gt) === 0 && !te && J !== null && (kr || (J.f & Gt) !== 0), c = s.deps === null;
    lr(s) && (u && (s.f |= Gt), ns(s)), u && !c && Es(s);
  }
  if (wt != null && wt.has(t))
    return wt.get(t);
  if ((t.f & Re) !== 0)
    throw t.v;
  return t.v;
}
function Es(t) {
  if (t.deps !== null) {
    t.f |= Gt;
    for (const e of t.deps)
      (e.reactions ?? (e.reactions = [])).push(t), (e.f & yt) !== 0 && (e.f & Gt) === 0 && Es(
        /** @type {Derived} */
        e
      );
  }
}
function Ss(t) {
  if (t.v === pt) return !0;
  if (t.deps === null) return !1;
  for (const e of t.deps)
    if (Oe.has(e) || (e.f & yt) !== 0 && Ss(
      /** @type {Derived} */
      e
    ))
      return !0;
  return !1;
}
function Li(t) {
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
const Ns = /* @__PURE__ */ new Set(), fi = /* @__PURE__ */ new Set();
function Tl(t, e, n, r = {}) {
  function i(o) {
    if (r.capture || Vn.call(e, o), !o.cancelBubble)
      return zi(() => n == null ? void 0 : n.call(this, o));
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
  e instanceof HTMLMediaElement) && us(() => {
    e.removeEventListener(t, s, o);
  });
}
function ur(t) {
  for (var e = 0; e < t.length; e++)
    Ns.add(t[e]);
  for (var n of fi)
    n(t);
}
let eo = null;
function Vn(t) {
  var R;
  var e = this, n = (
    /** @type {Node} */
    e.ownerDocument
  ), r = t.type, i = ((R = t.composedPath) == null ? void 0 : R.call(t)) || [], o = (
    /** @type {null | Element} */
    i[0] || t.target
  );
  eo = t;
  var s = 0, a = eo === t && t.__root;
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
    var f = J, d = rt;
    Tt(null), ue(null);
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
        } catch (N) {
          h ? g.push(N) : h = N;
        }
        if (t.cancelBubble || m === e || m === null)
          break;
        o = m;
      }
      if (h) {
        for (let N of g)
          queueMicrotask(() => {
            throw N;
          });
        throw h;
      }
    } finally {
      t.__root = e, delete t.currentTarget, Tt(f), ue(d);
    }
  }
}
function Fi(t) {
  var e = document.createElement("template");
  return e.innerHTML = t.replaceAll("<!>", "<!---->"), e.content;
}
function Jn(t, e) {
  var n = (
    /** @type {Effect} */
    rt
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
      n || os ? document.importNode(r, !0) : r.cloneNode(!0)
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
    var c = (
      /** @type {TemplateNode} */
      s.cloneNode(!0)
    );
    if (i) {
      var f = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ Ut(c)
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
  yl();
  var a = /* @__PURE__ */ new Set(), u = (d) => {
    for (var h = 0; h < d.length; h++) {
      var g = d[h];
      if (!a.has(g)) {
        a.add(g);
        var m = zl(g);
        e.addEventListener(g, Vn, { passive: m });
        var b = vn.get(g);
        b === void 0 ? (document.addEventListener(g, Vn, { passive: m }), vn.set(g, 1)) : vn.set(g, b + 1);
      }
    }
  };
  u(Vr(Ns)), fi.add(u);
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
            Wt
          );
          g.c = o;
        }
        i && (r.$$events = i), c = t(h, r) || {}, o && ln();
      }
    ), () => {
      var m;
      for (var h of a) {
        e.removeEventListener(h, Vn);
        var g = (
          /** @type {number} */
          vn.get(h)
        );
        --g === 0 ? (document.removeEventListener(h, Vn), vn.delete(h)) : vn.set(h, g);
      }
      fi.delete(u), d !== n && ((m = d.parentNode) == null || m.removeChild(d));
    };
  });
  return hi.set(c, f), c;
}
let hi = /* @__PURE__ */ new WeakMap();
function no(t, e) {
  const n = hi.get(t);
  return n ? (hi.delete(t), n(e)) : Promise.resolve();
}
var jt, ae, Dt, Je, or, sr, Br;
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
    j(this, Dt, /* @__PURE__ */ new Map());
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
      if (_(this, jt).has(e)) {
        var n = (
          /** @type {Key} */
          _(this, jt).get(e)
        ), r = _(this, ae).get(n);
        if (r)
          Ri(r), _(this, Je).delete(n);
        else {
          var i = _(this, Dt).get(n);
          i && (_(this, ae).set(n, i.effect), _(this, Dt).delete(n), i.fragment.lastChild.remove(), this.anchor.before(i.fragment), r = i.effect);
        }
        for (const [o, s] of _(this, jt)) {
          if (_(this, jt).delete(o), o === e)
            break;
          const a = _(this, Dt).get(s);
          a && (Rt(a.effect), _(this, Dt).delete(s));
        }
        for (const [o, s] of _(this, ae)) {
          if (o === n || _(this, Je).has(o)) continue;
          const a = () => {
            if (Array.from(_(this, jt).values()).includes(o)) {
              var c = document.createDocumentFragment();
              _s(s, c), c.append(nn()), _(this, Dt).set(o, { effect: s, fragment: c });
            } else
              Rt(s);
            _(this, Je).delete(o), _(this, ae).delete(o);
          };
          _(this, or) || !r ? (_(this, Je).add(o), Qe(s, a, !1)) : a();
        }
      }
    });
    /**
     * @param {Batch} batch
     */
    j(this, Br, (e) => {
      _(this, jt).delete(e);
      const n = Array.from(_(this, jt).values());
      for (const [r, i] of _(this, Dt))
        n.includes(r) || (Rt(i.effect), _(this, Dt).delete(r));
    });
    this.anchor = e, W(this, or, n);
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
    ), i = ls();
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
    if (_(this, jt).set(r, e), i) {
      for (const [a, u] of _(this, ae))
        a === e ? r.skipped_effects.delete(u) : r.skipped_effects.add(u);
      for (const [a, u] of _(this, Dt))
        a === e ? r.skipped_effects.delete(u.effect) : r.skipped_effects.add(u.effect);
      r.oncommit(_(this, sr)), r.ondiscard(_(this, Br));
    } else
      _(this, sr).call(this);
  }
}
jt = new WeakMap(), ae = new WeakMap(), Dt = new WeakMap(), Je = new WeakMap(), or = new WeakMap(), sr = new WeakMap(), Br = new WeakMap();
function _t(t, e, n = !1) {
  var r = new Ol(t), i = n ? zn : 0;
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
function Ms(t, e) {
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
            di(Vr(o.done)), h.delete(o), h.size === 0 && (t.outrogroups = null);
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
    di(e, !u);
  } else
    o = {
      pending: new Set(e),
      done: /* @__PURE__ */ new Set()
    }, (t.outrogroups ?? (t.outrogroups = /* @__PURE__ */ new Set())).add(o);
}
function di(t, e = !0) {
  for (var n = 0; n < t.length; n++)
    Rt(t[n], e);
}
var ro;
function Ve(t, e, n, r, i, o = null) {
  var s = t, a = /* @__PURE__ */ new Map(), u = null, c = /* @__PURE__ */ ts(() => {
    var b = n();
    return Ho(b) ? b : b == null ? [] : Vr(b);
  }), f, d = !0;
  function h() {
    m.fallback = u, Yl(m, f, s, e, r), u !== null && (f.length === 0 ? (u.f & Ce) === 0 ? Ri(u) : (u.f ^= Ce, Xn(u, null, s)) : Qe(u, () => {
      u = null;
    }));
  }
  var g = Ci(() => {
    f = /** @type {V[]} */
    l(c);
    for (var b = f.length, R = /* @__PURE__ */ new Set(), N = (
      /** @type {Batch} */
      st
    ), H = ls(), z = 0; z < b; z += 1) {
      var w = f[z], C = r(w, z), k = d ? null : a.get(C);
      k ? (k.v && Rn(k.v, w), k.i && Rn(k.i, z), H && N.skipped_effects.delete(k.e)) : (k = Hl(
        a,
        d ? s : ro ?? (ro = nn()),
        w,
        C,
        z,
        i,
        e,
        n
      ), d || (k.e.f |= Ce), a.set(C, k)), R.add(C);
    }
    if (b === 0 && o && !u && (d ? u = qt(() => o(s)) : (u = qt(() => o(ro ?? (ro = nn()))), u.f |= Ce)), !d)
      if (H) {
        for (const [M, L] of a)
          R.has(M) || N.skipped_effects.add(L.e);
        N.oncommit(h), N.ondiscard(() => {
        });
      } else
        h();
    l(c);
  }), m = { effect: g, items: a, outrogroups: null, fallback: u };
  d = !1;
}
function Yl(t, e, n, r, i) {
  var L;
  var o = e.length, s = t.items, a = t.effect.first, u, c = null, f = [], d = [], h, g, m, b;
  for (b = 0; b < o; b += 1) {
    if (h = e[b], g = i(h, b), m = /** @type {EachItem} */
    s.get(g).e, t.outrogroups !== null)
      for (const Y of t.outrogroups)
        Y.pending.delete(m), Y.done.delete(m);
    if ((m.f & Ce) !== 0)
      if (m.f ^= Ce, m === a)
        Xn(m, null, n);
      else {
        var R = c ? c.next : a;
        m === t.effect.last && (t.effect.last = m.prev), m.prev && (m.prev.next = m.next), m.next && (m.next.prev = m.prev), Ae(t, c, m), Ae(t, m, R), Xn(m, R, n), c = m, f = [], d = [], a = c.next;
        continue;
      }
    if ((m.f & Yt) !== 0 && Ri(m), m !== a) {
      if (u !== void 0 && u.has(m)) {
        if (f.length < d.length) {
          var N = d[0], H;
          c = N.prev;
          var z = f[0], w = f[f.length - 1];
          for (H = 0; H < f.length; H += 1)
            Xn(f[H], N, n);
          for (H = 0; H < d.length; H += 1)
            u.delete(d[H]);
          Ae(t, z.prev, w.next), Ae(t, c, z), Ae(t, w, N), a = N, c = w, b -= 1, f = [], d = [];
        } else
          u.delete(m), Xn(m, a, n), Ae(t, m.prev, m.next), Ae(t, m, c === null ? t.effect.first : c.next), Ae(t, c, m), c = m;
        continue;
      }
      for (f = [], d = []; a !== null && a !== m; )
        (u ?? (u = /* @__PURE__ */ new Set())).add(a), d.push(a), a = a.next;
      if (a === null)
        continue;
    }
    (m.f & Ce) === 0 && f.push(m), c = m, a = m.next;
  }
  if (t.outrogroups !== null) {
    for (const Y of t.outrogroups)
      Y.pending.size === 0 && (di(Vr(Y.done)), (L = t.outrogroups) == null || L.delete(Y));
    t.outrogroups.size === 0 && (t.outrogroups = null);
  }
  if (a !== null || u !== void 0) {
    var C = [];
    if (u !== void 0)
      for (m of u)
        (m.f & Yt) === 0 && C.push(m);
    for (; a !== null; )
      (a.f & Yt) === 0 && a !== t.fallback && C.push(a), a = a.next;
    var k = C.length;
    if (k > 0) {
      var M = null;
      Dl(t, C, M);
    }
  }
}
function Hl(t, e, n, r, i, o, s, a) {
  var u = (s & Ga) !== 0 ? (s & Ka) === 0 ? /* @__PURE__ */ _l(n, !1, !1) : en(n) : null, c = (s & Wa) !== 0 ? en(i) : null;
  return {
    v: u,
    i: c,
    e: qt(() => (o(e, u ?? n, c ?? i, a), () => {
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
function As(t, e, n = !1, r = !1, i = !1) {
  var o = t, s = "";
  at(() => {
    var a = (
      /** @type {Effect} */
      rt
    );
    if (s !== (s = e() ?? "") && (a.nodes !== null && (gs(
      a.nodes.start,
      /** @type {TemplateNode} */
      a.nodes.end
    ), a.nodes = null), s !== "")) {
      var u = s + "";
      n ? u = `<svg>${u}</svg>` : r && (u = `<math>${u}</math>`);
      var c = Fi(u);
      if ((n || r) && (c = /** @type {Element} */
      /* @__PURE__ */ Ut(c)), Jn(
        /** @type {TemplateNode} */
        /* @__PURE__ */ Ut(c),
        /** @type {TemplateNode} */
        c.lastChild
      ), n || r)
        for (; /* @__PURE__ */ Ut(c); )
          o.before(
            /** @type {TemplateNode} */
            /* @__PURE__ */ Ut(c)
          );
      else
        o.before(c);
    }
  });
}
function Ps(t) {
  var e, n, r = "";
  if (typeof t == "string" || typeof t == "number") r += t;
  else if (typeof t == "object") if (Array.isArray(t)) {
    var i = t.length;
    for (e = 0; e < i; e++) t[e] && (n = Ps(t[e])) && (r && (r += " "), r += n);
  } else for (n in t) t[n] && (r && (r += " "), r += n);
  return r;
}
function Bl() {
  for (var t, e, n = 0, r = "", i = arguments.length; n < i; n++) (t = arguments[n]) && (e = Ps(t)) && (r && (r += " "), r += e);
  return r;
}
function Vl(t) {
  return typeof t == "object" ? Bl(t) : t ?? "";
}
const io = [...` 	
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
          (s === 0 || io.includes(r[s - 1])) && (a === r.length || io.includes(r[a])) ? r = (s === 0 ? "" : r.substring(0, s)) + r.substring(a + 1) : s = a;
        }
  }
  return r === "" ? null : r;
}
function Oi(t, e, n, r, i, o) {
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
const ql = Symbol("is custom element"), Ul = Symbol("is html");
function v(t, e, n, r) {
  var i = Gl(t);
  i[e] !== (i[e] = n) && (e === "loading" && (t[La] = n), n == null ? t.removeAttribute(e) : typeof n != "string" && Wl(t).includes(e) ? t[e] = n : t.setAttribute(e, n));
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
var oo = /* @__PURE__ */ new Map();
function Wl(t) {
  var e = t.getAttribute("is") || t.nodeName, n = oo.get(e);
  if (n) return n;
  oo.set(e, n = []);
  for (var r, i = t, o = Element.prototype; o !== i; ) {
    r = Pa(i);
    for (var s in r)
      r[s].set && n.push(s);
    i = Bo(i);
  }
  return n;
}
function so(t, e) {
  return t === e || (t == null ? void 0 : t[Gn]) === e;
}
function ao(t = {}, e, n, r) {
  return Sl(() => {
    var i, o;
    return fs(() => {
      i = o, o = [], Li(() => {
        t !== n(...o) && (e(t, ...o), i && so(n(...i), t) && e(null, ...i));
      });
    }), () => {
      Le(() => {
        o && so(n(...o), t) && e(null, ...o);
      });
    };
  }), t;
}
let gr = !1;
function Kl(t) {
  var e = gr;
  try {
    return gr = !1, [t(), gr];
  } finally {
    gr = e;
  }
}
function bt(t, e, n, r) {
  var H;
  var i = (n & Qa) !== 0, o = (n & ja) !== 0, s = (
    /** @type {V} */
    r
  ), a = !0, u = () => (a && (a = !1, s = o ? Li(
    /** @type {() => V} */
    r
  ) : (
    /** @type {V} */
    r
  )), s), c;
  if (i) {
    var f = Gn in t || Ra in t;
    c = ((H = wn(t, e)) == null ? void 0 : H.set) ?? (f && e in t ? (z) => t[e] = z : void 0);
  }
  var d, h = !1;
  i ? [d, h] = Kl(() => (
    /** @type {V} */
    t[e]
  )) : d = /** @type {V} */
  t[e], d === void 0 && r !== void 0 && (d = u(), c && (Ba(), c(d)));
  var g;
  if (g = () => {
    var z = (
      /** @type {V} */
      t[e]
    );
    return z === void 0 ? u() : (a = !0, z);
  }, (n & Ja) === 0)
    return g;
  if (c) {
    var m = t.$$legacy;
    return (
      /** @type {() => V} */
      (function(z, w) {
        return arguments.length > 0 ? ((!w || m || h) && c(w ? g() : z), z) : g();
      })
    );
  }
  var b = !1, R = ((n & Za) !== 0 ? qr : ts)(() => (b = !1, g()));
  i && l(R);
  var N = (
    /** @type {Effect} */
    rt
  );
  return (
    /** @type {() => V} */
    (function(z, w) {
      if (arguments.length > 0) {
        const C = w ? l(R) : i ? Pt(z) : z;
        return V(R, C), b = !0, s !== void 0 && (s = C), z;
      }
      return De && b || (N.f & we) !== 0 ? R.v : l(R);
    })
  );
}
const Zl = "5";
var Yo;
typeof window < "u" && ((Yo = window.__svelte ?? (window.__svelte = {})).v ?? (Yo.v = /* @__PURE__ */ new Set())).add(Zl);
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
const Ql = 40, jl = 8, Qr = 16, $l = 5.5;
var tt;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(tt || (tt = {}));
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
function zr(t) {
  return typeof t == "string" ? t : t.node;
}
function Tr(t) {
  return typeof t == "string" ? void 0 : t.port;
}
function lo(t) {
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
let jr = null;
async function uu() {
  if (!jr) {
    const { AvoidLib: t } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await t.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await t.load(process.env.LIBAVOID_WASM_PATH) : await t.load(), jr = t.getInstance();
  }
  return jr;
}
async function Kn(t, e, n, r) {
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
function cu(t, e, n) {
  const r = /* @__PURE__ */ new Map();
  for (const [i, o] of n)
    r.set(i, new t.ShapeRef(e, new t.Rectangle(new t.Point(o.position.x, o.position.y), o.size.width, o.size.height)));
  return r;
}
function fu(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  let o = 1;
  for (const [s, a] of r) {
    const u = e.get(a.nodeId), c = n.get(a.nodeId);
    if (!u || !c)
      continue;
    const f = o++;
    i.set(s, f);
    const d = (a.absolutePosition.x - (c.position.x - c.size.width / 2)) / c.size.width, h = (a.absolutePosition.y - (c.position.y - c.size.height / 2)) / c.size.height, g = a.side === "top" || a.side === "bottom" ? Is : au(a.side);
    new t.ShapeConnectionPin(u, f, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, h)), !0, 0, g).setExclusive(!1);
  }
  return i;
}
function hu(t, e, n, r, i, o, s, a) {
  const u = /* @__PURE__ */ new Map();
  for (const [c, f] of s.entries()) {
    const d = f.id ?? `__link_${c}`, h = zr(f.from), g = zr(f.to);
    if (!n.has(h) || !n.has(g))
      continue;
    const m = Tr(f.from), b = Tr(f.to), R = m ? `${h}:${m}` : null, N = b ? `${g}:${b}` : null, H = R ? r.get(R) : void 0;
    let z;
    if (H !== void 0)
      z = new t.ConnEnd(n.get(h), H);
    else {
      const q = R ? o.get(R) : void 0, I = i.get(h), U = (q == null ? void 0 : q.absolutePosition) ?? (I == null ? void 0 : I.position);
      if (!U)
        continue;
      z = new t.ConnEnd(new t.Point(U.x, U.y));
    }
    const w = N ? o.get(N) : void 0, C = i.get(g), k = (w == null ? void 0 : w.absolutePosition) ?? (C == null ? void 0 : C.position);
    if (!k)
      continue;
    const M = new t.ConnEnd(new t.Point(k.x, k.y)), L = new t.ConnRef(e, z, M), Y = N ? o.get(N) : null;
    if (Y != null && Y.side) {
      const I = Math.max(Y.size.width, Y.size.height) / 2 + 16;
      let U = Y.absolutePosition.x, X = Y.absolutePosition.y;
      switch (Y.side) {
        case "top":
          X -= I;
          break;
        case "bottom":
          X += I;
          break;
        case "left":
          U -= I;
          break;
        case "right":
          U += I;
          break;
      }
      if (!lu(U, X, i, a)) {
        const p = new t.CheckpointVector();
        p.push_back(new t.Checkpoint(new t.Point(U, X))), L.setRoutingCheckpoints(p);
      }
    }
    u.set(d, L);
  }
  return e.processTransaction(), u;
}
function du(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  for (const [o, s] of n.entries()) {
    const a = s.id ?? `__link_${o}`, u = t.get(a);
    if (!u)
      continue;
    const c = u.displayRoute(), f = [];
    for (let k = 0; k < c.size(); k++) {
      const M = c.at(k);
      f.push({ x: M.x, y: M.y });
    }
    const d = zr(s.from), h = zr(s.to), g = Tr(s.from), m = Tr(s.to), b = g ? `${d}:${g}` : null, R = m ? `${h}:${m}` : null, N = b ? e.get(b) : void 0, H = R ? e.get(R) : void 0;
    N && f.length > 0 && (f[0] = { x: N.absolutePosition.x, y: N.absolutePosition.y }), H && f.length > 0 && (f[f.length - 1] = {
      x: H.absolutePosition.x,
      y: H.absolutePosition.y
    });
    const z = f[0], w = f[f.length - 1], C = r === "straight" && f.length > 2 && z && w ? [z, w] : f;
    i.set(a, {
      id: a,
      fromPortId: g ? `${d}:${g}` : null,
      toPortId: m ? `${h}:${m}` : null,
      fromNodeId: d,
      toNodeId: h,
      fromEndpoint: lo(s.from),
      toEndpoint: lo(s.to),
      points: C,
      width: ru(s),
      link: s
    });
  }
  return i;
}
function gu(t, e, n, r, i, o, s) {
  const a = cu(t, e, n), u = fu(t, a, n, r), c = hu(t, e, a, u, n, r, i, s), f = du(c, r, i, o), d = vu(f);
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
  uo(n, e, "y");
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
  return uo(r, e, "x"), e;
}
function uo(t, e, n) {
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
      co(e, i, -c, n), co(e, o, c, n), i.fixed -= c, o.fixed += c;
    }
  }
}
function co(t, e, n, r) {
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
    const c = Math.hypot(s.x - a.x, s.y - a.y), f = Math.hypot(u.x - s.x, u.y - s.y), d = Math.min(e, c / 2, f / 2);
    if (d < 1) {
      n.push({ ...s });
      continue;
    }
    const h = (a.x - s.x) / c, g = (a.y - s.y) / c, m = (u.x - s.x) / f, b = (u.y - s.y) / f, R = h * b - g * m;
    if (Math.abs(R) < 1e-3) {
      n.push({ ...s });
      continue;
    }
    const N = s.x + h * d, H = s.y + g * d, z = s.x + m * d, w = s.y + b * d;
    for (let C = 0; C <= fo; C++) {
      const k = C / fo, M = 1 - k, L = M * M * N + 2 * M * k * s.x + k * k * z, Y = M * M * H + 2 * M * k * s.y + k * k * w;
      n.push({ x: L, y: Y });
    }
  }
  const i = t[t.length - 1];
  return i && n.push({ ...i }), n;
}
const rn = 8;
function zs(t, e, n = rn) {
  return t.x - t.w / 2 - n < e.x + e.w / 2 && t.x + t.w / 2 + n > e.x - e.w / 2 && t.y - t.h / 2 - n < e.y + e.h / 2 && t.y + t.h / 2 + n > e.y - e.h / 2;
}
function Ts(t, e, n = rn) {
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
function Cs(t, e, n, r) {
  const i = [];
  for (const [o, s] of n)
    o !== t && i.push({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height });
  if (r)
    for (const [o, s] of r)
      o !== t && (e && wu(e, o, r) || i.push(gi(s.bounds)));
  return i;
}
function Rs(t, e, n = rn) {
  let r = t.x, i = t.y;
  for (const o of e) {
    const s = { x: r, y: i, w: t.w, h: t.h };
    if (zs(s, o, n)) {
      const a = Ts(s, o, n);
      r = a.x, i = a.y;
    }
  }
  return { x: r, y: i };
}
function Ls(t, e, n, r, i = rn, o) {
  const s = r.get(t);
  if (!s)
    return { x: e, y: n };
  const a = Cs(t, s.node.parent, r, o);
  return Rs({ x: e, y: n, w: s.size.width, h: s.size.height }, a, i);
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
const vr = 20, ho = 28;
function gi(t) {
  return { x: t.x + t.width / 2, y: t.y + t.height / 2, w: t.width, h: t.height };
}
function Di(t, e, n, r, i, o) {
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
    }), Di(s, e, n, r, i, o));
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
      const g = h.size.width / 2, m = h.size.height / 2;
      a = Math.min(a, h.position.x - g), u = Math.min(u, h.position.y - m), c = Math.max(c, h.position.x + g), f = Math.max(f, h.position.y + m);
    }
    for (const h of e.values())
      h.subgraph.parent === o && (d = !0, a = Math.min(a, h.bounds.x), u = Math.min(u, h.bounds.y), c = Math.max(c, h.bounds.x + h.bounds.width), f = Math.max(f, h.bounds.y + h.bounds.height));
    d && e.set(o, {
      ...s,
      bounds: {
        x: a - vr,
        y: u - vr - ho,
        width: c - a + vr * 2,
        height: f - u + vr * 2 + ho
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
      const f = gi(s.bounds), d = gi(c.bounds);
      if (!zs(f, d, rn))
        continue;
      const h = Ts(d, f, rn), g = h.x - d.x, m = h.y - d.y;
      g === 0 && m === 0 || (e.set(u, {
        ...c,
        bounds: { ...c.bounds, x: c.bounds.x + g, y: c.bounds.y + m }
      }), Di(u, g, m, t, e, n));
    }
  }
  for (const [o, s] of t) {
    const a = Cs(o, s.node.parent, t, e), u = Rs({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height }, a);
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
async function yu(t, e, n, r, i, o = rn) {
  const s = r.nodes.get(t);
  if (!s)
    return null;
  const { x: a, y: u } = Ls(t, e, n, r.nodes, o, r.subgraphs), c = a - s.position.x, f = u - s.position.y;
  if (c === 0 && f === 0)
    return null;
  const d = new Map(r.nodes);
  d.set(t, { ...s, position: { x: a, y: u } });
  const h = new Map(r.ports);
  for (const [b, R] of r.ports)
    R.nodeId === t && h.set(b, {
      ...R,
      absolutePosition: {
        x: R.absolutePosition.x + c,
        y: R.absolutePosition.y + f
      }
    });
  let g;
  r.subgraphs && (g = new Map(r.subgraphs), Cr(d, g, h));
  const m = await Kn(d, h, i);
  return { nodes: d, ports: h, edges: m, subgraphs: g };
}
async function xu(t, e, n, r, i) {
  const o = r.subgraphs.get(t);
  if (!o)
    return null;
  const s = e - o.bounds.x, a = n - o.bounds.y;
  if (s === 0 && a === 0)
    return null;
  const u = new Map(r.nodes), c = new Map(r.ports), f = new Map(r.subgraphs);
  f.set(t, { ...o, bounds: { ...o.bounds, x: e, y: n } }), Di(t, s, a, u, f, c), Cr(u, f, c);
  const d = await Kn(u, c, i);
  return { nodes: u, ports: c, edges: d, subgraphs: f };
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
const go = 8, vo = 24;
function Eu(t, e) {
  const n = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const r of e.values())
    r.nodeId === t && r.side && n[r.side]++;
  return n;
}
function Su(t, e) {
  const n = Math.max(t.top, t.bottom), r = Math.max(t.left, t.right);
  return {
    width: Math.max(e.width, (n + 1) * vo),
    height: Math.max(e.height, (r + 1) * vo)
  };
}
function Nu(t, e, n, r) {
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
    size: { width: go, height: go }
  });
  const c = new Map(n);
  return Fs(t, c, u), { nodes: c, ports: u, portId: a };
}
function Au(t, e, n, r) {
  const i = n.get(t);
  if (!i)
    return null;
  const o = i.nodeId, s = i.label, a = r.filter((f) => {
    const d = typeof f.from == "string" ? { node: f.from } : f.from, h = typeof f.to == "string" ? { node: f.to } : f.to;
    return !(d.node === o && d.port === s || h.node === o && h.port === s);
  }), u = new Map(n);
  u.delete(t);
  const c = new Map(e);
  return Fs(o, c, u), { nodes: c, ports: u, links: a };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function Os(t) {
  return typeof t > "u" || t === null;
}
function Pu(t) {
  return typeof t == "object" && t !== null;
}
function Iu(t) {
  return Array.isArray(t) ? t : Os(t) ? [] : [t];
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
var Ru = Os, Lu = Pu, Fu = Iu, Ou = Tu, Du = Cu, Yu = zu, Yi = {
  isNothing: Ru,
  isObject: Lu,
  toArray: Fu,
  repeat: Ou,
  isNegativeZero: Du,
  extend: Yu
};
function Ds(t, e) {
  var n = "", r = t.reason || "(unknown reason)";
  return t.mark ? (t.mark.name && (n += 'in "' + t.mark.name + '" '), n += "(" + (t.mark.line + 1) + ":" + (t.mark.column + 1) + ")", !e && t.mark.snippet && (n += `

` + t.mark.snippet), r + " " + n) : r;
}
function jn(t, e) {
  Error.call(this), this.name = "YAMLException", this.reason = t, this.mark = e, this.message = Ds(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
jn.prototype = Object.create(Error.prototype);
jn.prototype.constructor = jn;
jn.prototype.toString = function(e) {
  return this.name + ": " + Ds(this, e);
};
var Xe = jn, Hu = [
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
      throw new Xe('Unknown option "' + n + '" is met in definition of "' + t + '" YAML type.');
  }), this.options = e, this.tag = t, this.kind = e.kind || null, this.resolve = e.resolve || function() {
    return !0;
  }, this.construct = e.construct || function(n) {
    return n;
  }, this.instanceOf = e.instanceOf || null, this.predicate = e.predicate || null, this.represent = e.represent || null, this.representName = e.representName || null, this.defaultStyle = e.defaultStyle || null, this.multi = e.multi || !1, this.styleAliases = Vu(e.styleAliases || null), Bu.indexOf(this.kind) === -1)
    throw new Xe('Unknown kind "' + this.kind + '" is specified for "' + t + '" YAML type.');
}
var Et = Xu;
function mo(t, e) {
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
    throw new Xe("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  n.forEach(function(o) {
    if (!(o instanceof Et))
      throw new Xe("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    if (o.loadKind && o.loadKind !== "scalar")
      throw new Xe("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    if (o.multi)
      throw new Xe("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
  }), r.forEach(function(o) {
    if (!(o instanceof Et))
      throw new Xe("Specified list of YAML types (or a single Type object) contains a non-Type object.");
  });
  var i = Object.create(vi.prototype);
  return i.implicit = (this.implicit || []).concat(n), i.explicit = (this.explicit || []).concat(r), i.compiledImplicit = mo(i, "implicit"), i.compiledExplicit = mo(i, "explicit"), i.compiledTypeMap = qu(i.compiledImplicit, i.compiledExplicit), i;
};
var Uu = vi, Gu = new Et("tag:yaml.org,2002:str", {
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
function tc(t) {
  if (t === null) return !1;
  var e = t.length;
  return e === 4 && (t === "true" || t === "True" || t === "TRUE") || e === 5 && (t === "false" || t === "False" || t === "FALSE");
}
function ec(t) {
  return t === "true" || t === "True" || t === "TRUE";
}
function nc(t) {
  return Object.prototype.toString.call(t) === "[object Boolean]";
}
var rc = new Et("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: tc,
  construct: ec,
  predicate: nc,
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
function ic(t) {
  return 48 <= t && t <= 57 || 65 <= t && t <= 70 || 97 <= t && t <= 102;
}
function oc(t) {
  return 48 <= t && t <= 55;
}
function sc(t) {
  return 48 <= t && t <= 57;
}
function ac(t) {
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
          if (!ic(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
    if (i === "o") {
      for (n++; n < e; n++)
        if (i = t[n], i !== "_") {
          if (!oc(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; n < e; n++)
    if (i = t[n], i !== "_") {
      if (!sc(t.charCodeAt(n)))
        return !1;
      r = !0;
    }
  return !(!r || i === "_");
}
function lc(t) {
  var e = t, n = 1, r;
  if (e.indexOf("_") !== -1 && (e = e.replace(/_/g, "")), r = e[0], (r === "-" || r === "+") && (r === "-" && (n = -1), e = e.slice(1), r = e[0]), e === "0") return 0;
  if (r === "0") {
    if (e[1] === "b") return n * parseInt(e.slice(2), 2);
    if (e[1] === "x") return n * parseInt(e.slice(2), 16);
    if (e[1] === "o") return n * parseInt(e.slice(2), 8);
  }
  return n * parseInt(e, 10);
}
function uc(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && t % 1 === 0 && !Yi.isNegativeZero(t);
}
var cc = new Et("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: ac,
  construct: lc,
  predicate: uc,
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
}), fc = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function hc(t) {
  return !(t === null || !fc.test(t) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  t[t.length - 1] === "_");
}
function dc(t) {
  var e, n;
  return e = t.replace(/_/g, "").toLowerCase(), n = e[0] === "-" ? -1 : 1, "+-".indexOf(e[0]) >= 0 && (e = e.slice(1)), e === ".inf" ? n === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : e === ".nan" ? NaN : n * parseFloat(e, 10);
}
var gc = /^[-+]?[0-9]+e/;
function vc(t, e) {
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
  else if (Yi.isNegativeZero(t))
    return "-0.0";
  return n = t.toString(10), gc.test(n) ? n.replace("e", ".e") : n;
}
function mc(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && (t % 1 !== 0 || Yi.isNegativeZero(t));
}
var pc = new Et("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: hc,
  construct: dc,
  predicate: mc,
  represent: vc,
  defaultStyle: "lowercase"
}), _c = Zu.extend({
  implicit: [
    $u,
    rc,
    cc,
    pc
  ]
}), wc = _c, Ys = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Hs = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function yc(t) {
  return t === null ? !1 : Ys.exec(t) !== null || Hs.exec(t) !== null;
}
function xc(t) {
  var e, n, r, i, o, s, a, u = 0, c = null, f, d, h;
  if (e = Ys.exec(t), e === null && (e = Hs.exec(t)), e === null) throw new Error("Date resolve error");
  if (n = +e[1], r = +e[2] - 1, i = +e[3], !e[4])
    return new Date(Date.UTC(n, r, i));
  if (o = +e[4], s = +e[5], a = +e[6], e[7]) {
    for (u = e[7].slice(0, 3); u.length < 3; )
      u += "0";
    u = +u;
  }
  return e[9] && (f = +e[10], d = +(e[11] || 0), c = (f * 60 + d) * 6e4, e[9] === "-" && (c = -c)), h = new Date(Date.UTC(n, r, i, o, s, a, u)), c && h.setTime(h.getTime() - c), h;
}
function bc(t) {
  return t.toISOString();
}
var kc = new Et("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: yc,
  construct: xc,
  instanceOf: Date,
  represent: bc
});
function Ec(t) {
  return t === "<<" || t === null;
}
var Sc = new Et("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: Ec
}), Hi = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function Nc(t) {
  if (t === null) return !1;
  var e, n, r = 0, i = t.length, o = Hi;
  for (n = 0; n < i; n++)
    if (e = o.indexOf(t.charAt(n)), !(e > 64)) {
      if (e < 0) return !1;
      r += 6;
    }
  return r % 8 === 0;
}
function Mc(t) {
  var e, n, r = t.replace(/[\r\n=]/g, ""), i = r.length, o = Hi, s = 0, a = [];
  for (e = 0; e < i; e++)
    e % 4 === 0 && e && (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)), s = s << 6 | o.indexOf(r.charAt(e));
  return n = i % 4 * 6, n === 0 ? (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)) : n === 18 ? (a.push(s >> 10 & 255), a.push(s >> 2 & 255)) : n === 12 && a.push(s >> 4 & 255), new Uint8Array(a);
}
function Ac(t) {
  var e = "", n = 0, r, i, o = t.length, s = Hi;
  for (r = 0; r < o; r++)
    r % 3 === 0 && r && (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]), n = (n << 8) + t[r];
  return i = o % 3, i === 0 ? (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]) : i === 2 ? (e += s[n >> 10 & 63], e += s[n >> 4 & 63], e += s[n << 2 & 63], e += s[64]) : i === 1 && (e += s[n >> 2 & 63], e += s[n << 4 & 63], e += s[64], e += s[64]), e;
}
function Pc(t) {
  return Object.prototype.toString.call(t) === "[object Uint8Array]";
}
var Ic = new Et("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: Nc,
  construct: Mc,
  predicate: Pc,
  represent: Ac
}), zc = Object.prototype.hasOwnProperty, Tc = Object.prototype.toString;
function Cc(t) {
  if (t === null) return !0;
  var e = [], n, r, i, o, s, a = t;
  for (n = 0, r = a.length; n < r; n += 1) {
    if (i = a[n], s = !1, Tc.call(i) !== "[object Object]") return !1;
    for (o in i)
      if (zc.call(i, o))
        if (!s) s = !0;
        else return !1;
    if (!s) return !1;
    if (e.indexOf(o) === -1) e.push(o);
    else return !1;
  }
  return !0;
}
function Rc(t) {
  return t !== null ? t : [];
}
var Lc = new Et("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: Cc,
  construct: Rc
}), Fc = Object.prototype.toString;
function Oc(t) {
  if (t === null) return !0;
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1) {
    if (r = s[e], Fc.call(r) !== "[object Object]" || (i = Object.keys(r), i.length !== 1)) return !1;
    o[e] = [i[0], r[i[0]]];
  }
  return !0;
}
function Dc(t) {
  if (t === null) return [];
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1)
    r = s[e], i = Object.keys(r), o[e] = [i[0], r[i[0]]];
  return o;
}
var Yc = new Et("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: Oc,
  construct: Dc
}), Hc = Object.prototype.hasOwnProperty;
function Bc(t) {
  if (t === null) return !0;
  var e, n = t;
  for (e in n)
    if (Hc.call(n, e) && n[e] !== null)
      return !1;
  return !0;
}
function Vc(t) {
  return t !== null ? t : {};
}
var Xc = new Et("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Bc,
  construct: Vc
});
wc.extend({
  implicit: [
    kc,
    Sc
  ],
  explicit: [
    Ic,
    Lc,
    Yc,
    Xc
  ]
});
function po(t) {
  return t === 48 ? "\0" : t === 97 ? "\x07" : t === 98 ? "\b" : t === 116 || t === 9 ? "	" : t === 110 ? `
` : t === 118 ? "\v" : t === 102 ? "\f" : t === 114 ? "\r" : t === 101 ? "\x1B" : t === 32 ? " " : t === 34 ? '"' : t === 47 ? "/" : t === 92 ? "\\" : t === 78 ? "" : t === 95 ? " " : t === 76 ? "\u2028" : t === 80 ? "\u2029" : "";
}
var qc = new Array(256), Uc = new Array(256);
for (var mn = 0; mn < 256; mn++)
  qc[mn] = po(mn) ? 1 : 0, Uc[mn] = po(mn);
var _o;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(_o || (_o = {}));
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
function Gc(t = Er) {
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
var Wc = { value: () => {
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
function Kc(t, e) {
  return t.trim().split(/^|\s+/).map(function(n) {
    var r = "", i = n.indexOf(".");
    if (i >= 0 && (r = n.slice(i + 1), n = n.slice(0, i)), n && !e.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    return { type: n, name: r };
  });
}
Sr.prototype = Ur.prototype = {
  constructor: Sr,
  on: function(t, e) {
    var n = this._, r = Kc(t + "", n), i, o = -1, s = r.length;
    if (arguments.length < 2) {
      for (; ++o < s; ) if ((i = (t = r[o]).type) && (i = Zc(n[i], t.name))) return i;
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
function Zc(t, e) {
  for (var n = 0, r = t.length, i; n < r; ++n)
    if ((i = t[n]).name === e)
      return i.value;
}
function wo(t, e, n) {
  for (var r = 0, i = t.length; r < i; ++r)
    if (t[r].name === e) {
      t[r] = Wc, t = t.slice(0, r).concat(t.slice(r + 1));
      break;
    }
  return n != null && t.push({ name: e, value: n }), t;
}
var mi = "http://www.w3.org/1999/xhtml";
const yo = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: mi,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function Gr(t) {
  var e = t += "", n = e.indexOf(":");
  return n >= 0 && (e = t.slice(0, n)) !== "xmlns" && (t = t.slice(n + 1)), yo.hasOwnProperty(e) ? { space: yo[e], local: t } : t;
}
function Jc(t) {
  return function() {
    var e = this.ownerDocument, n = this.namespaceURI;
    return n === mi && e.documentElement.namespaceURI === mi ? e.createElement(t) : e.createElementNS(n, t);
  };
}
function Qc(t) {
  return function() {
    return this.ownerDocument.createElementNS(t.space, t.local);
  };
}
function Bs(t) {
  var e = Gr(t);
  return (e.local ? Qc : Jc)(e);
}
function jc() {
}
function Bi(t) {
  return t == null ? jc : function() {
    return this.querySelector(t);
  };
}
function $c(t) {
  typeof t != "function" && (t = Bi(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = new Array(s), u, c, f = 0; f < s; ++f)
      (u = o[f]) && (c = t.call(u, u.__data__, f, o)) && ("__data__" in u && (c.__data__ = u.__data__), a[f] = c);
  return new Ht(r, this._parents);
}
function tf(t) {
  return t == null ? [] : Array.isArray(t) ? t : Array.from(t);
}
function ef() {
  return [];
}
function Vs(t) {
  return t == null ? ef : function() {
    return this.querySelectorAll(t);
  };
}
function nf(t) {
  return function() {
    return tf(t.apply(this, arguments));
  };
}
function rf(t) {
  typeof t == "function" ? t = nf(t) : t = Vs(t);
  for (var e = this._groups, n = e.length, r = [], i = [], o = 0; o < n; ++o)
    for (var s = e[o], a = s.length, u, c = 0; c < a; ++c)
      (u = s[c]) && (r.push(t.call(u, u.__data__, c, s)), i.push(u));
  return new Ht(r, i);
}
function Xs(t) {
  return function() {
    return this.matches(t);
  };
}
function qs(t) {
  return function(e) {
    return e.matches(t);
  };
}
var of = Array.prototype.find;
function sf(t) {
  return function() {
    return of.call(this.children, t);
  };
}
function af() {
  return this.firstElementChild;
}
function lf(t) {
  return this.select(t == null ? af : sf(typeof t == "function" ? t : qs(t)));
}
var uf = Array.prototype.filter;
function cf() {
  return Array.from(this.children);
}
function ff(t) {
  return function() {
    return uf.call(this.children, t);
  };
}
function hf(t) {
  return this.selectAll(t == null ? cf : ff(typeof t == "function" ? t : qs(t)));
}
function df(t) {
  typeof t != "function" && (t = Xs(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, c = 0; c < s; ++c)
      (u = o[c]) && t.call(u, u.__data__, c, o) && a.push(u);
  return new Ht(r, this._parents);
}
function Us(t) {
  return new Array(t.length);
}
function gf() {
  return new Ht(this._enter || this._groups.map(Us), this._parents);
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
function vf(t) {
  return function() {
    return t;
  };
}
function mf(t, e, n, r, i, o) {
  for (var s = 0, a, u = e.length, c = o.length; s < c; ++s)
    (a = e[s]) ? (a.__data__ = o[s], r[s] = a) : n[s] = new Rr(t, o[s]);
  for (; s < u; ++s)
    (a = e[s]) && (i[s] = a);
}
function pf(t, e, n, r, i, o, s) {
  var a, u, c = /* @__PURE__ */ new Map(), f = e.length, d = o.length, h = new Array(f), g;
  for (a = 0; a < f; ++a)
    (u = e[a]) && (h[a] = g = s.call(u, u.__data__, a, e) + "", c.has(g) ? i[a] = u : c.set(g, u));
  for (a = 0; a < d; ++a)
    g = s.call(t, o[a], a, o) + "", (u = c.get(g)) ? (r[a] = u, u.__data__ = o[a], c.delete(g)) : n[a] = new Rr(t, o[a]);
  for (a = 0; a < f; ++a)
    (u = e[a]) && c.get(h[a]) === u && (i[a] = u);
}
function _f(t) {
  return t.__data__;
}
function wf(t, e) {
  if (!arguments.length) return Array.from(this, _f);
  var n = e ? pf : mf, r = this._parents, i = this._groups;
  typeof t != "function" && (t = vf(t));
  for (var o = i.length, s = new Array(o), a = new Array(o), u = new Array(o), c = 0; c < o; ++c) {
    var f = r[c], d = i[c], h = d.length, g = yf(t.call(f, f && f.__data__, c, r)), m = g.length, b = a[c] = new Array(m), R = s[c] = new Array(m), N = u[c] = new Array(h);
    n(f, d, b, R, N, g, e);
    for (var H = 0, z = 0, w, C; H < m; ++H)
      if (w = b[H]) {
        for (H >= z && (z = H + 1); !(C = R[z]) && ++z < m; ) ;
        w._next = C || null;
      }
  }
  return s = new Ht(s, r), s._enter = a, s._exit = u, s;
}
function yf(t) {
  return typeof t == "object" && "length" in t ? t : Array.from(t);
}
function xf() {
  return new Ht(this._exit || this._groups.map(Us), this._parents);
}
function bf(t, e, n) {
  var r = this.enter(), i = this, o = this.exit();
  return typeof t == "function" ? (r = t(r), r && (r = r.selection())) : r = r.append(t + ""), e != null && (i = e(i), i && (i = i.selection())), n == null ? o.remove() : n(o), r && i ? r.merge(i).order() : i;
}
function kf(t) {
  for (var e = t.selection ? t.selection() : t, n = this._groups, r = e._groups, i = n.length, o = r.length, s = Math.min(i, o), a = new Array(i), u = 0; u < s; ++u)
    for (var c = n[u], f = r[u], d = c.length, h = a[u] = new Array(d), g, m = 0; m < d; ++m)
      (g = c[m] || f[m]) && (h[m] = g);
  for (; u < i; ++u)
    a[u] = n[u];
  return new Ht(a, this._parents);
}
function Ef() {
  for (var t = this._groups, e = -1, n = t.length; ++e < n; )
    for (var r = t[e], i = r.length - 1, o = r[i], s; --i >= 0; )
      (s = r[i]) && (o && s.compareDocumentPosition(o) ^ 4 && o.parentNode.insertBefore(s, o), o = s);
  return this;
}
function Sf(t) {
  t || (t = Nf);
  function e(d, h) {
    return d && h ? t(d.__data__, h.__data__) : !d - !h;
  }
  for (var n = this._groups, r = n.length, i = new Array(r), o = 0; o < r; ++o) {
    for (var s = n[o], a = s.length, u = i[o] = new Array(a), c, f = 0; f < a; ++f)
      (c = s[f]) && (u[f] = c);
    u.sort(e);
  }
  return new Ht(i, this._parents).order();
}
function Nf(t, e) {
  return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
function Mf() {
  var t = arguments[0];
  return arguments[0] = this, t.apply(null, arguments), this;
}
function Af() {
  return Array.from(this);
}
function Pf() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length; i < o; ++i) {
      var s = r[i];
      if (s) return s;
    }
  return null;
}
function If() {
  let t = 0;
  for (const e of this) ++t;
  return t;
}
function zf() {
  return !this.node();
}
function Tf(t) {
  for (var e = this._groups, n = 0, r = e.length; n < r; ++n)
    for (var i = e[n], o = 0, s = i.length, a; o < s; ++o)
      (a = i[o]) && t.call(a, a.__data__, o, i);
  return this;
}
function Cf(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function Rf(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function Lf(t, e) {
  return function() {
    this.setAttribute(t, e);
  };
}
function Ff(t, e) {
  return function() {
    this.setAttributeNS(t.space, t.local, e);
  };
}
function Of(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttribute(t) : this.setAttribute(t, n);
  };
}
function Df(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttributeNS(t.space, t.local) : this.setAttributeNS(t.space, t.local, n);
  };
}
function Yf(t, e) {
  var n = Gr(t);
  if (arguments.length < 2) {
    var r = this.node();
    return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n);
  }
  return this.each((e == null ? n.local ? Rf : Cf : typeof e == "function" ? n.local ? Df : Of : n.local ? Ff : Lf)(n, e));
}
function Gs(t) {
  return t.ownerDocument && t.ownerDocument.defaultView || t.document && t || t.defaultView;
}
function Hf(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function Bf(t, e, n) {
  return function() {
    this.style.setProperty(t, e, n);
  };
}
function Vf(t, e, n) {
  return function() {
    var r = e.apply(this, arguments);
    r == null ? this.style.removeProperty(t) : this.style.setProperty(t, r, n);
  };
}
function Xf(t, e, n) {
  return arguments.length > 1 ? this.each((e == null ? Hf : typeof e == "function" ? Vf : Bf)(t, e, n ?? "")) : Ln(this.node(), t);
}
function Ln(t, e) {
  return t.style.getPropertyValue(e) || Gs(t).getComputedStyle(t, null).getPropertyValue(e);
}
function qf(t) {
  return function() {
    delete this[t];
  };
}
function Uf(t, e) {
  return function() {
    this[t] = e;
  };
}
function Gf(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? delete this[t] : this[t] = n;
  };
}
function Wf(t, e) {
  return arguments.length > 1 ? this.each((e == null ? qf : typeof e == "function" ? Gf : Uf)(t, e)) : this.node()[t];
}
function Ws(t) {
  return t.trim().split(/^|\s+/);
}
function Vi(t) {
  return t.classList || new Ks(t);
}
function Ks(t) {
  this._node = t, this._names = Ws(t.getAttribute("class") || "");
}
Ks.prototype = {
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
function Zs(t, e) {
  for (var n = Vi(t), r = -1, i = e.length; ++r < i; ) n.add(e[r]);
}
function Js(t, e) {
  for (var n = Vi(t), r = -1, i = e.length; ++r < i; ) n.remove(e[r]);
}
function Kf(t) {
  return function() {
    Zs(this, t);
  };
}
function Zf(t) {
  return function() {
    Js(this, t);
  };
}
function Jf(t, e) {
  return function() {
    (e.apply(this, arguments) ? Zs : Js)(this, t);
  };
}
function Qf(t, e) {
  var n = Ws(t + "");
  if (arguments.length < 2) {
    for (var r = Vi(this.node()), i = -1, o = n.length; ++i < o; ) if (!r.contains(n[i])) return !1;
    return !0;
  }
  return this.each((typeof e == "function" ? Jf : e ? Kf : Zf)(n, e));
}
function jf() {
  this.textContent = "";
}
function $f(t) {
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
  return arguments.length ? this.each(t == null ? jf : (typeof t == "function" ? th : $f)(t)) : this.node().textContent;
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
function ch(t) {
  var e = typeof t == "function" ? t : Bs(t);
  return this.select(function() {
    return this.appendChild(e.apply(this, arguments));
  });
}
function fh() {
  return null;
}
function hh(t, e) {
  var n = typeof t == "function" ? t : Bs(t), r = e == null ? fh : typeof e == "function" ? e : Bi(e);
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
function wh(t) {
  return function(e) {
    t.call(this, e, this.__data__);
  };
}
function yh(t) {
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
function kh(t, e, n) {
  var r = yh(t + ""), i, o = r.length, s;
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
  for (a = e ? bh : xh, i = 0; i < o; ++i) this.each(a(r[i], e, n));
  return this;
}
function Qs(t, e, n) {
  var r = Gs(t), i = r.CustomEvent;
  typeof i == "function" ? i = new i(e, n) : (i = r.document.createEvent("Event"), n ? (i.initEvent(e, n.bubbles, n.cancelable), i.detail = n.detail) : i.initEvent(e, !1, !1)), t.dispatchEvent(i);
}
function Eh(t, e) {
  return function() {
    return Qs(this, t, e);
  };
}
function Sh(t, e) {
  return function() {
    return Qs(this, t, e.apply(this, arguments));
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
var js = [null];
function Ht(t, e) {
  this._groups = t, this._parents = e;
}
function cr() {
  return new Ht([[document.documentElement]], js);
}
function Ah() {
  return this;
}
Ht.prototype = cr.prototype = {
  constructor: Ht,
  select: $c,
  selectAll: rf,
  selectChild: lf,
  selectChildren: hf,
  filter: df,
  data: wf,
  enter: gf,
  exit: xf,
  join: bf,
  merge: kf,
  selection: Ah,
  order: Ef,
  sort: Sf,
  call: Mf,
  nodes: Af,
  node: Pf,
  size: If,
  empty: zf,
  each: Tf,
  attr: Yf,
  style: Xf,
  property: Wf,
  classed: Qf,
  text: eh,
  html: oh,
  raise: ah,
  lower: uh,
  append: ch,
  insert: hh,
  remove: gh,
  clone: ph,
  datum: _h,
  on: kh,
  dispatch: Nh,
  [Symbol.iterator]: Mh
};
function zt(t) {
  return typeof t == "string" ? new Ht([[document.querySelector(t)]], [document.documentElement]) : new Ht([[t]], js);
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
const Ih = { passive: !1 }, $n = { capture: !0, passive: !1 };
function $r(t) {
  t.stopImmediatePropagation();
}
function yn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function $s(t) {
  var e = t.document.documentElement, n = zt(t).on("dragstart.drag", yn, $n);
  "onselectstart" in e ? n.on("selectstart.drag", yn, $n) : (e.__noselect = e.style.MozUserSelect, e.style.MozUserSelect = "none");
}
function ta(t, e) {
  var n = t.document.documentElement, r = zt(t).on("dragstart.drag", null);
  e && (r.on("click.drag", yn, $n), setTimeout(function() {
    r.on("click.drag", null);
  }, 0)), "onselectstart" in n ? r.on("selectstart.drag", null) : (n.style.MozUserSelect = n.__noselect, delete n.__noselect);
}
const mr = (t) => () => t;
function pi(t, {
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
pi.prototype.on = function() {
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
function xo() {
  var t = zh, e = Th, n = Ch, r = Rh, i = {}, o = Ur("start", "drag", "end"), s = 0, a, u, c, f, d = 0;
  function h(w) {
    w.on("mousedown.drag", g).filter(r).on("touchstart.drag", R).on("touchmove.drag", N, Ih).on("touchend.drag touchcancel.drag", H).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function g(w, C) {
    if (!(f || !t.call(this, w, C))) {
      var k = z(this, e.call(this, w, C), w, C, "mouse");
      k && (zt(w.view).on("mousemove.drag", m, $n).on("mouseup.drag", b, $n), $s(w.view), $r(w), c = !1, a = w.clientX, u = w.clientY, k("start", w));
    }
  }
  function m(w) {
    if (yn(w), !c) {
      var C = w.clientX - a, k = w.clientY - u;
      c = C * C + k * k > d;
    }
    i.mouse("drag", w);
  }
  function b(w) {
    zt(w.view).on("mousemove.drag mouseup.drag", null), ta(w.view, c), yn(w), i.mouse("end", w);
  }
  function R(w, C) {
    if (t.call(this, w, C)) {
      var k = w.changedTouches, M = e.call(this, w, C), L = k.length, Y, q;
      for (Y = 0; Y < L; ++Y)
        (q = z(this, M, w, C, k[Y].identifier, k[Y])) && ($r(w), q("start", w, k[Y]));
    }
  }
  function N(w) {
    var C = w.changedTouches, k = C.length, M, L;
    for (M = 0; M < k; ++M)
      (L = i[C[M].identifier]) && (yn(w), L("drag", w, C[M]));
  }
  function H(w) {
    var C = w.changedTouches, k = C.length, M, L;
    for (f && clearTimeout(f), f = setTimeout(function() {
      f = null;
    }, 500), M = 0; M < k; ++M)
      (L = i[C[M].identifier]) && ($r(w), L("end", w, C[M]));
  }
  function z(w, C, k, M, L, Y) {
    var q = o.copy(), I = ve(Y || k, C), U, X, p;
    if ((p = n.call(w, new pi("beforestart", {
      sourceEvent: k,
      target: h,
      identifier: L,
      active: s,
      x: I[0],
      y: I[1],
      dx: 0,
      dy: 0,
      dispatch: q
    }), M)) != null)
      return U = p.x - I[0] || 0, X = p.y - I[1] || 0, function P(y, F, E) {
        var x = I, S;
        switch (y) {
          case "start":
            i[L] = P, S = s++;
            break;
          case "end":
            delete i[L], --s;
          // falls through
          case "drag":
            I = ve(E || F, C), S = s;
            break;
        }
        q.call(
          y,
          w,
          new pi(y, {
            sourceEvent: F,
            subject: p,
            target: h,
            identifier: L,
            active: S,
            x: I[0] + U,
            y: I[1] + X,
            dx: I[0] - x[0],
            dy: I[1] - x[1],
            dispatch: q
          }),
          M
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
function Xi(t, e, n) {
  t.prototype = e.prototype = n, n.constructor = t;
}
function ea(t, e) {
  var n = Object.create(t.prototype);
  for (var r in e) n[r] = e[r];
  return n;
}
function fr() {
}
var tr = 0.7, Lr = 1 / tr, xn = "\\s*([+-]?\\d+)\\s*", er = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", le = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Lh = /^#([0-9a-f]{3,8})$/, Fh = new RegExp(`^rgb\\(${xn},${xn},${xn}\\)$`), Oh = new RegExp(`^rgb\\(${le},${le},${le}\\)$`), Dh = new RegExp(`^rgba\\(${xn},${xn},${xn},${er}\\)$`), Yh = new RegExp(`^rgba\\(${le},${le},${le},${er}\\)$`), Hh = new RegExp(`^hsl\\(${er},${le},${le}\\)$`), Bh = new RegExp(`^hsla\\(${er},${le},${le},${er}\\)$`), bo = {
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
Xi(fr, nr, {
  copy(t) {
    return Object.assign(new this.constructor(), this, t);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: ko,
  // Deprecated! Use color.formatHex.
  formatHex: ko,
  formatHex8: Vh,
  formatHsl: Xh,
  formatRgb: Eo,
  toString: Eo
});
function ko() {
  return this.rgb().formatHex();
}
function Vh() {
  return this.rgb().formatHex8();
}
function Xh() {
  return na(this).formatHsl();
}
function Eo() {
  return this.rgb().formatRgb();
}
function nr(t) {
  var e, n;
  return t = (t + "").trim().toLowerCase(), (e = Lh.exec(t)) ? (n = e[1].length, e = parseInt(e[1], 16), n === 6 ? So(e) : n === 3 ? new Ct(e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, (e & 15) << 4 | e & 15, 1) : n === 8 ? pr(e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, (e & 255) / 255) : n === 4 ? pr(e >> 12 & 15 | e >> 8 & 240, e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, ((e & 15) << 4 | e & 15) / 255) : null) : (e = Fh.exec(t)) ? new Ct(e[1], e[2], e[3], 1) : (e = Oh.exec(t)) ? new Ct(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, 1) : (e = Dh.exec(t)) ? pr(e[1], e[2], e[3], e[4]) : (e = Yh.exec(t)) ? pr(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, e[4]) : (e = Hh.exec(t)) ? Ao(e[1], e[2] / 100, e[3] / 100, 1) : (e = Bh.exec(t)) ? Ao(e[1], e[2] / 100, e[3] / 100, e[4]) : bo.hasOwnProperty(t) ? So(bo[t]) : t === "transparent" ? new Ct(NaN, NaN, NaN, 0) : null;
}
function So(t) {
  return new Ct(t >> 16 & 255, t >> 8 & 255, t & 255, 1);
}
function pr(t, e, n, r) {
  return r <= 0 && (t = e = n = NaN), new Ct(t, e, n, r);
}
function qh(t) {
  return t instanceof fr || (t = nr(t)), t ? (t = t.rgb(), new Ct(t.r, t.g, t.b, t.opacity)) : new Ct();
}
function _i(t, e, n, r) {
  return arguments.length === 1 ? qh(t) : new Ct(t, e, n, r ?? 1);
}
function Ct(t, e, n, r) {
  this.r = +t, this.g = +e, this.b = +n, this.opacity = +r;
}
Xi(Ct, _i, ea(fr, {
  brighter(t) {
    return t = t == null ? Lr : Math.pow(Lr, t), new Ct(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? tr : Math.pow(tr, t), new Ct(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Ct($e(this.r), $e(this.g), $e(this.b), Fr(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && -0.5 <= this.g && this.g < 255.5 && -0.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
  },
  hex: No,
  // Deprecated! Use color.formatHex.
  formatHex: No,
  formatHex8: Uh,
  formatRgb: Mo,
  toString: Mo
}));
function No() {
  return `#${Ue(this.r)}${Ue(this.g)}${Ue(this.b)}`;
}
function Uh() {
  return `#${Ue(this.r)}${Ue(this.g)}${Ue(this.b)}${Ue((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function Mo() {
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
function Ao(t, e, n, r) {
  return r <= 0 ? t = e = n = NaN : n <= 0 || n >= 1 ? t = e = NaN : e <= 0 && (t = NaN), new $t(t, e, n, r);
}
function na(t) {
  if (t instanceof $t) return new $t(t.h, t.s, t.l, t.opacity);
  if (t instanceof fr || (t = nr(t)), !t) return new $t();
  if (t instanceof $t) return t;
  t = t.rgb();
  var e = t.r / 255, n = t.g / 255, r = t.b / 255, i = Math.min(e, n, r), o = Math.max(e, n, r), s = NaN, a = o - i, u = (o + i) / 2;
  return a ? (e === o ? s = (n - r) / a + (n < r) * 6 : n === o ? s = (r - e) / a + 2 : s = (e - n) / a + 4, a /= u < 0.5 ? o + i : 2 - o - i, s *= 60) : a = u > 0 && u < 1 ? 0 : s, new $t(s, a, u, t.opacity);
}
function Gh(t, e, n, r) {
  return arguments.length === 1 ? na(t) : new $t(t, e, n, r ?? 1);
}
function $t(t, e, n, r) {
  this.h = +t, this.s = +e, this.l = +n, this.opacity = +r;
}
Xi($t, Gh, ea(fr, {
  brighter(t) {
    return t = t == null ? Lr : Math.pow(Lr, t), new $t(this.h, this.s, this.l * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? tr : Math.pow(tr, t), new $t(this.h, this.s, this.l * t, this.opacity);
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
    return new $t(Po(this.h), _r(this.s), _r(this.l), Fr(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
  },
  formatHsl() {
    const t = Fr(this.opacity);
    return `${t === 1 ? "hsl(" : "hsla("}${Po(this.h)}, ${_r(this.s) * 100}%, ${_r(this.l) * 100}%${t === 1 ? ")" : `, ${t})`}`;
  }
}));
function Po(t) {
  return t = (t || 0) % 360, t < 0 ? t + 360 : t;
}
function _r(t) {
  return Math.max(0, Math.min(1, t || 0));
}
function ti(t, e, n) {
  return (t < 60 ? e + (n - e) * t / 60 : t < 180 ? n : t < 240 ? e + (n - e) * (240 - t) / 60 : e) * 255;
}
const ra = (t) => () => t;
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
  return (t = +t) == 1 ? ia : function(e, n) {
    return n - e ? Kh(e, n, t) : ra(isNaN(e) ? n : e);
  };
}
function ia(t, e) {
  var n = e - t;
  return n ? Wh(t, n) : ra(isNaN(t) ? e : t);
}
const Io = (function t(e) {
  var n = Zh(e);
  function r(i, o) {
    var s = n((i = _i(i)).r, (o = _i(o)).r), a = n(i.g, o.g), u = n(i.b, o.b), c = ia(i.opacity, o.opacity);
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
var wi = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, ei = new RegExp(wi.source, "g");
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
  var n = wi.lastIndex = ei.lastIndex = 0, r, i, o, s = -1, a = [], u = [];
  for (t = t + "", e = e + ""; (r = wi.exec(t)) && (i = ei.exec(e)); )
    (o = i.index) > n && (o = e.slice(n, o), a[s] ? a[s] += o : a[++s] = o), (r = r[0]) === (i = i[0]) ? a[s] ? a[s] += i : a[++s] = i : (a[++s] = null, u.push({ i: s, x: Ie(r, i) })), n = ei.lastIndex;
  return n < e.length && (o = e.slice(n), a[s] ? a[s] += o : a[++s] = o), a.length < 2 ? u[0] ? Qh(u[0].x) : Jh(e) : (e = u.length, function(c) {
    for (var f = 0, d; f < e; ++f) a[(d = u[f]).i] = d.x(c);
    return a.join("");
  });
}
var zo = 180 / Math.PI, yi = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function oa(t, e, n, r, i, o) {
  var s, a, u;
  return (s = Math.sqrt(t * t + e * e)) && (t /= s, e /= s), (u = t * n + e * r) && (n -= t * u, r -= e * u), (a = Math.sqrt(n * n + r * r)) && (n /= a, r /= a, u /= a), t * r < e * n && (t = -t, e = -e, u = -u, s = -s), {
    translateX: i,
    translateY: o,
    rotate: Math.atan2(e, t) * zo,
    skewX: Math.atan(u) * zo,
    scaleX: s,
    scaleY: a
  };
}
var wr;
function $h(t) {
  const e = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(t + "");
  return e.isIdentity ? yi : oa(e.a, e.b, e.c, e.d, e.e, e.f);
}
function td(t) {
  return t == null || (wr || (wr = document.createElementNS("http://www.w3.org/2000/svg", "g")), wr.setAttribute("transform", t), !(t = wr.transform.baseVal.consolidate())) ? yi : (t = t.matrix, oa(t.a, t.b, t.c, t.d, t.e, t.f));
}
function sa(t, e, n, r) {
  function i(c) {
    return c.length ? c.pop() + " " : "";
  }
  function o(c, f, d, h, g, m) {
    if (c !== d || f !== h) {
      var b = g.push("translate(", null, e, null, n);
      m.push({ i: b - 4, x: Ie(c, d) }, { i: b - 2, x: Ie(f, h) });
    } else (d || h) && g.push("translate(" + d + e + h + n);
  }
  function s(c, f, d, h) {
    c !== f ? (c - f > 180 ? f += 360 : f - c > 180 && (c += 360), h.push({ i: d.push(i(d) + "rotate(", null, r) - 2, x: Ie(c, f) })) : f && d.push(i(d) + "rotate(" + f + r);
  }
  function a(c, f, d, h) {
    c !== f ? h.push({ i: d.push(i(d) + "skewX(", null, r) - 2, x: Ie(c, f) }) : f && d.push(i(d) + "skewX(" + f + r);
  }
  function u(c, f, d, h, g, m) {
    if (c !== d || f !== h) {
      var b = g.push(i(g) + "scale(", null, ",", null, ")");
      m.push({ i: b - 4, x: Ie(c, d) }, { i: b - 2, x: Ie(f, h) });
    } else (d !== 1 || h !== 1) && g.push(i(g) + "scale(" + d + "," + h + ")");
  }
  return function(c, f) {
    var d = [], h = [];
    return c = t(c), f = t(f), o(c.translateX, c.translateY, f.translateX, f.translateY, d, h), s(c.rotate, f.rotate, d, h), a(c.skewX, f.skewX, d, h), u(c.scaleX, c.scaleY, f.scaleX, f.scaleY, d, h), c = f = null, function(g) {
      for (var m = -1, b = h.length, R; ++m < b; ) d[(R = h[m]).i] = R.x(g);
      return d.join("");
    };
  };
}
var ed = sa($h, "px, ", "px)", "deg)"), nd = sa(td, ", ", ")", ")"), rd = 1e-12;
function To(t) {
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
    var a = o[0], u = o[1], c = o[2], f = s[0], d = s[1], h = s[2], g = f - a, m = d - u, b = g * g + m * m, R, N;
    if (b < rd)
      N = Math.log(h / c) / e, R = function(M) {
        return [
          a + M * g,
          u + M * m,
          c * Math.exp(e * M * N)
        ];
      };
    else {
      var H = Math.sqrt(b), z = (h * h - c * c + r * b) / (2 * c * n * H), w = (h * h - c * c - r * b) / (2 * h * n * H), C = Math.log(Math.sqrt(z * z + 1) - z), k = Math.log(Math.sqrt(w * w + 1) - w);
      N = (k - C) / e, R = function(M) {
        var L = M * N, Y = To(C), q = c / (n * H) * (Y * od(e * L + C) - id(C));
        return [
          a + q * g,
          u + q * m,
          c * Y / To(e * L + C)
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
var Fn = 0, qn = 0, Yn = 0, aa = 1e3, Or, Un, Dr = 0, on = 0, Wr = 0, rr = typeof performance == "object" && performance.now ? performance : Date, la = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(t) {
  setTimeout(t, 17);
};
function qi() {
  return on || (la(ad), on = rr.now() + Wr);
}
function ad() {
  on = 0;
}
function Yr() {
  this._call = this._time = this._next = null;
}
Yr.prototype = ua.prototype = {
  constructor: Yr,
  restart: function(t, e, n) {
    if (typeof t != "function") throw new TypeError("callback is not a function");
    n = (n == null ? qi() : +n) + (e == null ? 0 : +e), !this._next && Un !== this && (Un ? Un._next = this : Or = this, Un = this), this._call = t, this._time = n, xi();
  },
  stop: function() {
    this._call && (this._call = null, this._time = 1 / 0, xi());
  }
};
function ua(t, e, n) {
  var r = new Yr();
  return r.restart(t, e, n), r;
}
function ld() {
  qi(), ++Fn;
  for (var t = Or, e; t; )
    (e = on - t._time) >= 0 && t._call.call(void 0, e), t = t._next;
  --Fn;
}
function Co() {
  on = (Dr = rr.now()) + Wr, Fn = qn = 0;
  try {
    ld();
  } finally {
    Fn = 0, cd(), on = 0;
  }
}
function ud() {
  var t = rr.now(), e = t - Dr;
  e > aa && (Wr -= e, Dr = t);
}
function cd() {
  for (var t, e = Or, n, r = 1 / 0; e; )
    e._call ? (r > e._time && (r = e._time), t = e, e = e._next) : (n = e._next, e._next = null, e = t ? t._next = n : Or = n);
  Un = t, xi(r);
}
function xi(t) {
  if (!Fn) {
    qn && (qn = clearTimeout(qn));
    var e = t - on;
    e > 24 ? (t < 1 / 0 && (qn = setTimeout(Co, t - rr.now() - Wr)), Yn && (Yn = clearInterval(Yn))) : (Yn || (Dr = rr.now(), Yn = setInterval(ud, aa)), Fn = 1, la(Co));
  }
}
function Ro(t, e, n) {
  var r = new Yr();
  return e = e == null ? 0 : +e, r.restart((i) => {
    r.stop(), t(i + e);
  }, e, n), r;
}
var fd = Ur("start", "end", "cancel", "interrupt"), hd = [], ca = 0, Lo = 1, bi = 2, Nr = 3, Fo = 4, ki = 5, Mr = 6;
function Kr(t, e, n, r, i, o) {
  var s = t.__transition;
  if (!s) t.__transition = {};
  else if (n in s) return;
  dd(t, n, {
    name: e,
    index: r,
    // For context during callback.
    group: i,
    // For context during callback.
    on: fd,
    tween: hd,
    time: o.time,
    delay: o.delay,
    duration: o.duration,
    ease: o.ease,
    timer: null,
    state: ca
  });
}
function Ui(t, e) {
  var n = ee(t, e);
  if (n.state > ca) throw new Error("too late; already scheduled");
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
function dd(t, e, n) {
  var r = t.__transition, i;
  r[e] = n, n.timer = ua(o, 0, n.time);
  function o(c) {
    n.state = Lo, n.timer.restart(s, n.delay, n.time), n.delay <= c && s(c - n.delay);
  }
  function s(c) {
    var f, d, h, g;
    if (n.state !== Lo) return u();
    for (f in r)
      if (g = r[f], g.name === n.name) {
        if (g.state === Nr) return Ro(s);
        g.state === Fo ? (g.state = Mr, g.timer.stop(), g.on.call("interrupt", t, t.__data__, g.index, g.group), delete r[f]) : +f < e && (g.state = Mr, g.timer.stop(), g.on.call("cancel", t, t.__data__, g.index, g.group), delete r[f]);
      }
    if (Ro(function() {
      n.state === Nr && (n.state = Fo, n.timer.restart(a, n.delay, n.time), a(c));
    }), n.state = bi, n.on.call("start", t, t.__data__, n.index, n.group), n.state === bi) {
      for (n.state = Nr, i = new Array(h = n.tween.length), f = 0, d = -1; f < h; ++f)
        (g = n.tween[f].value.call(t, t.__data__, n.index, n.group)) && (i[++d] = g);
      i.length = d + 1;
    }
  }
  function a(c) {
    for (var f = c < n.duration ? n.ease.call(null, c / n.duration) : (n.timer.restart(u), n.state = ki, 1), d = -1, h = i.length; ++d < h; )
      i[d].call(t, f);
    n.state === ki && (n.on.call("end", t, t.__data__, n.index, n.group), u());
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
      i = r.state > bi && r.state < ki, r.state = Mr, r.timer.stop(), r.on.call(i ? "interrupt" : "cancel", t, t.__data__, r.index, r.group), delete n[s];
    }
    o && delete t.__transition;
  }
}
function gd(t) {
  return this.each(function() {
    Ar(this, t);
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
function pd(t, e) {
  var n = this._id;
  if (t += "", arguments.length < 2) {
    for (var r = ee(this.node(), n).tween, i = 0, o = r.length, s; i < o; ++i)
      if ((s = r[i]).name === t)
        return s.value;
    return null;
  }
  return this.each((e == null ? vd : md)(n, t, e));
}
function Gi(t, e, n) {
  var r = t._id;
  return t.each(function() {
    var i = fe(this, r);
    (i.value || (i.value = {}))[e] = n.apply(this, arguments);
  }), function(i) {
    return ee(i, r).value[e];
  };
}
function fa(t, e) {
  var n;
  return (typeof e == "number" ? Ie : e instanceof nr ? Io : (n = nr(e)) ? (e = n, Io) : jh)(t, e);
}
function _d(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function wd(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function yd(t, e, n) {
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
  var n = Gr(t), r = n === "transform" ? nd : fa;
  return this.attrTween(t, typeof e == "function" ? (n.local ? kd : bd)(n, r, Gi(this, "attr." + t, e)) : e == null ? (n.local ? wd : _d)(n) : (n.local ? xd : yd)(n, r, e));
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
function Pd(t, e) {
  var n = "attr." + t;
  if (arguments.length < 2) return (n = this.tween(n)) && n._value;
  if (e == null) return this.tween(n, null);
  if (typeof e != "function") throw new Error();
  var r = Gr(t);
  return this.tween(n, (r.local ? Md : Ad)(r, e));
}
function Id(t, e) {
  return function() {
    Ui(this, t).delay = +e.apply(this, arguments);
  };
}
function zd(t, e) {
  return e = +e, function() {
    Ui(this, t).delay = e;
  };
}
function Td(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Id : zd)(e, t)) : ee(this.node(), e).delay;
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
function Ld(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Cd : Rd)(e, t)) : ee(this.node(), e).duration;
}
function Fd(t, e) {
  if (typeof e != "function") throw new Error();
  return function() {
    fe(this, t).ease = e;
  };
}
function Od(t) {
  var e = this._id;
  return arguments.length ? this.each(Fd(e, t)) : ee(this.node(), e).ease;
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
  typeof t != "function" && (t = Xs(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, c = 0; c < s; ++c)
      (u = o[c]) && t.call(u, u.__data__, c, o) && a.push(u);
  return new xe(r, this._parents, this._name, this._id);
}
function Bd(t) {
  if (t._id !== this._id) throw new Error();
  for (var e = this._groups, n = t._groups, r = e.length, i = n.length, o = Math.min(r, i), s = new Array(r), a = 0; a < o; ++a)
    for (var u = e[a], c = n[a], f = u.length, d = s[a] = new Array(f), h, g = 0; g < f; ++g)
      (h = u[g] || c[g]) && (d[g] = h);
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
  var r, i, o = Vd(e) ? Ui : fe;
  return function() {
    var s = o(this, t), a = s.on;
    a !== r && (i = (r = a).copy()).on(e, n), s.on = i;
  };
}
function qd(t, e) {
  var n = this._id;
  return arguments.length < 2 ? ee(this.node(), n).on.on(t) : this.each(Xd(n, t, e));
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
  typeof t != "function" && (t = Bi(t));
  for (var r = this._groups, i = r.length, o = new Array(i), s = 0; s < i; ++s)
    for (var a = r[s], u = a.length, c = o[s] = new Array(u), f, d, h = 0; h < u; ++h)
      (f = a[h]) && (d = t.call(f, f.__data__, h, a)) && ("__data__" in f && (d.__data__ = f.__data__), c[h] = d, Kr(c[h], e, n, h, c, ee(f, n)));
  return new xe(o, this._parents, e, n);
}
function Kd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Vs(t));
  for (var r = this._groups, i = r.length, o = [], s = [], a = 0; a < i; ++a)
    for (var u = r[a], c = u.length, f, d = 0; d < c; ++d)
      if (f = u[d]) {
        for (var h = t.call(f, f.__data__, d, u), g, m = ee(f, n), b = 0, R = h.length; b < R; ++b)
          (g = h[b]) && Kr(g, e, n, b, h, m);
        o.push(h), s.push(f);
      }
  return new xe(o, s, e, n);
}
var Zd = cr.prototype.constructor;
function Jd() {
  return new Zd(this._groups, this._parents);
}
function Qd(t, e) {
  var n, r, i;
  return function() {
    var o = Ln(this, t), s = (this.style.removeProperty(t), Ln(this, t));
    return o === s ? null : o === n && s === r ? i : i = e(n = o, r = s);
  };
}
function ha(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function jd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = Ln(this, t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function $d(t, e, n) {
  var r, i, o;
  return function() {
    var s = Ln(this, t), a = n(this), u = a + "";
    return a == null && (u = a = (this.style.removeProperty(t), Ln(this, t))), s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a));
  };
}
function t0(t, e) {
  var n, r, i, o = "style." + e, s = "end." + o, a;
  return function() {
    var u = fe(this, t), c = u.on, f = u.value[o] == null ? a || (a = ha(e)) : void 0;
    (c !== n || i !== f) && (r = (n = c).copy()).on(s, i = f), u.on = r;
  };
}
function e0(t, e, n) {
  var r = (t += "") == "transform" ? ed : fa;
  return e == null ? this.styleTween(t, Qd(t, r)).on("end.style." + t, ha(t)) : typeof e == "function" ? this.styleTween(t, $d(t, r, Gi(this, "style." + t, e))).each(t0(this._id, t)) : this.styleTween(t, jd(t, r, e), n).on("end.style." + t, null);
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
  return this.tween("text", typeof t == "function" ? s0(Gi(this, "text", t)) : o0(t == null ? "" : t + ""));
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
function c0(t) {
  var e = "text";
  if (arguments.length < 1) return (e = this.tween(e)) && e._value;
  if (t == null) return this.tween(e, null);
  if (typeof t != "function") throw new Error();
  return this.tween(e, u0(t));
}
function f0() {
  for (var t = this._name, e = this._id, n = da(), r = this._groups, i = r.length, o = 0; o < i; ++o)
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
function h0() {
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
var d0 = 0;
function xe(t, e, n, r) {
  this._groups = t, this._parents = e, this._name = n, this._id = r;
}
function da() {
  return ++d0;
}
var de = cr.prototype;
xe.prototype = {
  constructor: xe,
  select: Wd,
  selectAll: Kd,
  selectChild: de.selectChild,
  selectChildren: de.selectChildren,
  filter: Hd,
  merge: Bd,
  selection: Jd,
  transition: f0,
  call: de.call,
  nodes: de.nodes,
  node: de.node,
  size: de.size,
  empty: de.empty,
  each: de.each,
  on: qd,
  attr: Ed,
  attrTween: Pd,
  style: e0,
  styleTween: i0,
  text: a0,
  textTween: c0,
  remove: Gd,
  tween: pd,
  delay: Td,
  duration: Ld,
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
  t instanceof xe ? (e = t._id, t = t._name) : (e = da(), (n = v0).time = qi(), t = t == null ? null : t + "");
  for (var r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, c = 0; c < a; ++c)
      (u = s[c]) && Kr(u, t, e, c, s, n || m0(u, e));
  return new xe(r, this._parents, t, e);
}
cr.prototype.interrupt = gd;
cr.prototype.transition = p0;
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
var ga = new _e(1, 0, 0);
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
function y0() {
  var t = this;
  return t instanceof SVGElement ? (t = t.ownerSVGElement || t, t.hasAttribute("viewBox") ? (t = t.viewBox.baseVal, [[t.x, t.y], [t.x + t.width, t.y + t.height]]) : [[0, 0], [t.width.baseVal.value, t.height.baseVal.value]]) : [[0, 0], [t.clientWidth, t.clientHeight]];
}
function Oo() {
  return this.__zoom || ga;
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
  var t = w0, e = y0, n = k0, r = x0, i = b0, o = [0, 1 / 0], s = [[-1 / 0, -1 / 0], [1 / 0, 1 / 0]], a = 250, u = sd, c = Ur("start", "zoom", "end"), f, d, h, g = 500, m = 150, b = 0, R = 10;
  function N(p) {
    p.property("__zoom", Oo).on("wheel.zoom", L, { passive: !1 }).on("mousedown.zoom", Y).on("dblclick.zoom", q).filter(i).on("touchstart.zoom", I).on("touchmove.zoom", U).on("touchend.zoom touchcancel.zoom", X).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  N.transform = function(p, P, y, F) {
    var E = p.selection ? p.selection() : p;
    E.property("__zoom", Oo), p !== E ? C(p, P, y, F) : E.interrupt().each(function() {
      k(this, arguments).event(F).start().zoom(null, typeof P == "function" ? P.apply(this, arguments) : P).end();
    });
  }, N.scaleBy = function(p, P, y, F) {
    N.scaleTo(p, function() {
      var E = this.__zoom.k, x = typeof P == "function" ? P.apply(this, arguments) : P;
      return E * x;
    }, y, F);
  }, N.scaleTo = function(p, P, y, F) {
    N.transform(p, function() {
      var E = e.apply(this, arguments), x = this.__zoom, S = y == null ? w(E) : typeof y == "function" ? y.apply(this, arguments) : y, A = x.invert(S), B = typeof P == "function" ? P.apply(this, arguments) : P;
      return n(z(H(x, B), S, A), E, s);
    }, y, F);
  }, N.translateBy = function(p, P, y, F) {
    N.transform(p, function() {
      return n(this.__zoom.translate(
        typeof P == "function" ? P.apply(this, arguments) : P,
        typeof y == "function" ? y.apply(this, arguments) : y
      ), e.apply(this, arguments), s);
    }, null, F);
  }, N.translateTo = function(p, P, y, F, E) {
    N.transform(p, function() {
      var x = e.apply(this, arguments), S = this.__zoom, A = F == null ? w(x) : typeof F == "function" ? F.apply(this, arguments) : F;
      return n(ga.translate(A[0], A[1]).scale(S.k).translate(
        typeof P == "function" ? -P.apply(this, arguments) : -P,
        typeof y == "function" ? -y.apply(this, arguments) : -y
      ), x, s);
    }, F, E);
  };
  function H(p, P) {
    return P = Math.max(o[0], Math.min(o[1], P)), P === p.k ? p : new _e(P, p.x, p.y);
  }
  function z(p, P, y) {
    var F = P[0] - y[0] * p.k, E = P[1] - y[1] * p.k;
    return F === p.x && E === p.y ? p : new _e(p.k, F, E);
  }
  function w(p) {
    return [(+p[0][0] + +p[1][0]) / 2, (+p[0][1] + +p[1][1]) / 2];
  }
  function C(p, P, y, F) {
    p.on("start.zoom", function() {
      k(this, arguments).event(F).start();
    }).on("interrupt.zoom end.zoom", function() {
      k(this, arguments).event(F).end();
    }).tween("zoom", function() {
      var E = this, x = arguments, S = k(E, x).event(F), A = e.apply(E, x), B = y == null ? w(A) : typeof y == "function" ? y.apply(E, x) : y, K = Math.max(A[1][0] - A[0][0], A[1][1] - A[0][1]), G = E.__zoom, nt = typeof P == "function" ? P.apply(E, x) : P, et = u(G.invert(B).concat(K / G.k), nt.invert(B).concat(K / nt.k));
      return function(T) {
        if (T === 1) T = nt;
        else {
          var O = et(T), Q = K / O[2];
          T = new _e(Q, B[0] - O[0] * Q, B[1] - O[1] * Q);
        }
        S.zoom(null, T);
      };
    });
  }
  function k(p, P, y) {
    return !y && p.__zooming || new M(p, P);
  }
  function M(p, P) {
    this.that = p, this.args = P, this.active = 0, this.sourceEvent = null, this.extent = e.apply(p, P), this.taps = 0;
  }
  M.prototype = {
    event: function(p) {
      return p && (this.sourceEvent = p), this;
    },
    start: function() {
      return ++this.active === 1 && (this.that.__zooming = this, this.emit("start")), this;
    },
    zoom: function(p, P) {
      return this.mouse && p !== "mouse" && (this.mouse[1] = P.invert(this.mouse[0])), this.touch0 && p !== "touch" && (this.touch0[1] = P.invert(this.touch0[0])), this.touch1 && p !== "touch" && (this.touch1[1] = P.invert(this.touch1[0])), this.that.__zoom = P, this.emit("zoom"), this;
    },
    end: function() {
      return --this.active === 0 && (delete this.that.__zooming, this.emit("end")), this;
    },
    emit: function(p) {
      var P = zt(this.that).datum();
      c.call(
        p,
        this.that,
        new _0(p, {
          sourceEvent: this.sourceEvent,
          target: N,
          transform: this.that.__zoom,
          dispatch: c
        }),
        P
      );
    }
  };
  function L(p, ...P) {
    if (!t.apply(this, arguments)) return;
    var y = k(this, P).event(p), F = this.__zoom, E = Math.max(o[0], Math.min(o[1], F.k * Math.pow(2, r.apply(this, arguments)))), x = ve(p);
    if (y.wheel)
      (y.mouse[0][0] !== x[0] || y.mouse[0][1] !== x[1]) && (y.mouse[1] = F.invert(y.mouse[0] = x)), clearTimeout(y.wheel);
    else {
      if (F.k === E) return;
      y.mouse = [x, F.invert(x)], Ar(this), y.start();
    }
    Hn(p), y.wheel = setTimeout(S, m), y.zoom("mouse", n(z(H(F, E), y.mouse[0], y.mouse[1]), y.extent, s));
    function S() {
      y.wheel = null, y.end();
    }
  }
  function Y(p, ...P) {
    if (h || !t.apply(this, arguments)) return;
    var y = p.currentTarget, F = k(this, P, !0).event(p), E = zt(p.view).on("mousemove.zoom", B, !0).on("mouseup.zoom", K, !0), x = ve(p, y), S = p.clientX, A = p.clientY;
    $s(p.view), ni(p), F.mouse = [x, this.__zoom.invert(x)], Ar(this), F.start();
    function B(G) {
      if (Hn(G), !F.moved) {
        var nt = G.clientX - S, et = G.clientY - A;
        F.moved = nt * nt + et * et > b;
      }
      F.event(G).zoom("mouse", n(z(F.that.__zoom, F.mouse[0] = ve(G, y), F.mouse[1]), F.extent, s));
    }
    function K(G) {
      E.on("mousemove.zoom mouseup.zoom", null), ta(G.view, F.moved), Hn(G), F.event(G).end();
    }
  }
  function q(p, ...P) {
    if (t.apply(this, arguments)) {
      var y = this.__zoom, F = ve(p.changedTouches ? p.changedTouches[0] : p, this), E = y.invert(F), x = y.k * (p.shiftKey ? 0.5 : 2), S = n(z(H(y, x), F, E), e.apply(this, P), s);
      Hn(p), a > 0 ? zt(this).transition().duration(a).call(C, S, F, p) : zt(this).call(N.transform, S, F, p);
    }
  }
  function I(p, ...P) {
    if (t.apply(this, arguments)) {
      var y = p.touches, F = y.length, E = k(this, P, p.changedTouches.length === F).event(p), x, S, A, B;
      for (ni(p), S = 0; S < F; ++S)
        A = y[S], B = ve(A, this), B = [B, this.__zoom.invert(B), A.identifier], E.touch0 ? !E.touch1 && E.touch0[2] !== B[2] && (E.touch1 = B, E.taps = 0) : (E.touch0 = B, x = !0, E.taps = 1 + !!f);
      f && (f = clearTimeout(f)), x && (E.taps < 2 && (d = B[0], f = setTimeout(function() {
        f = null;
      }, g)), Ar(this), E.start());
    }
  }
  function U(p, ...P) {
    if (this.__zooming) {
      var y = k(this, P).event(p), F = p.changedTouches, E = F.length, x, S, A, B;
      for (Hn(p), x = 0; x < E; ++x)
        S = F[x], A = ve(S, this), y.touch0 && y.touch0[2] === S.identifier ? y.touch0[0] = A : y.touch1 && y.touch1[2] === S.identifier && (y.touch1[0] = A);
      if (S = y.that.__zoom, y.touch1) {
        var K = y.touch0[0], G = y.touch0[1], nt = y.touch1[0], et = y.touch1[1], T = (T = nt[0] - K[0]) * T + (T = nt[1] - K[1]) * T, O = (O = et[0] - G[0]) * O + (O = et[1] - G[1]) * O;
        S = H(S, Math.sqrt(T / O)), A = [(K[0] + nt[0]) / 2, (K[1] + nt[1]) / 2], B = [(G[0] + et[0]) / 2, (G[1] + et[1]) / 2];
      } else if (y.touch0) A = y.touch0[0], B = y.touch0[1];
      else return;
      y.zoom("touch", n(z(S, A, B), y.extent, s));
    }
  }
  function X(p, ...P) {
    if (this.__zooming) {
      var y = k(this, P).event(p), F = p.changedTouches, E = F.length, x, S;
      for (ni(p), h && clearTimeout(h), h = setTimeout(function() {
        h = null;
      }, g), x = 0; x < E; ++x)
        S = F[x], y.touch0 && y.touch0[2] === S.identifier ? delete y.touch0 : y.touch1 && y.touch1[2] === S.identifier && delete y.touch1;
      if (y.touch1 && !y.touch0 && (y.touch0 = y.touch1, delete y.touch1), y.touch0) y.touch0[1] = this.__zoom.invert(y.touch0[0]);
      else if (y.end(), y.taps === 2 && (S = ve(S, this), Math.hypot(d[0] - S[0], d[1] - S[1]) < R)) {
        var A = zt(this).on("dblclick.zoom");
        A && A.apply(this, arguments);
      }
    }
  }
  return N.wheelDelta = function(p) {
    return arguments.length ? (r = typeof p == "function" ? p : yr(+p), N) : r;
  }, N.filter = function(p) {
    return arguments.length ? (t = typeof p == "function" ? p : yr(!!p), N) : t;
  }, N.touchable = function(p) {
    return arguments.length ? (i = typeof p == "function" ? p : yr(!!p), N) : i;
  }, N.extent = function(p) {
    return arguments.length ? (e = typeof p == "function" ? p : yr([[+p[0][0], +p[0][1]], [+p[1][0], +p[1][1]]]), N) : e;
  }, N.scaleExtent = function(p) {
    return arguments.length ? (o[0] = +p[0], o[1] = +p[1], N) : [o[0], o[1]];
  }, N.translateExtent = function(p) {
    return arguments.length ? (s[0][0] = +p[0][0], s[1][0] = +p[1][0], s[0][1] = +p[0][1], s[1][1] = +p[1][1], N) : [[s[0][0], s[0][1]], [s[1][0], s[1][1]]];
  }, N.constrain = function(p) {
    return arguments.length ? (n = p, N) : n;
  }, N.duration = function(p) {
    return arguments.length ? (a = +p, N) : a;
  }, N.interpolate = function(p) {
    return arguments.length ? (u = p, N) : u;
  }, N.on = function() {
    var p = c.on.apply(c, arguments);
    return p === c ? N : p;
  }, N.clickDistance = function(p) {
    return arguments.length ? (b = (p = +p) * p, N) : Math.sqrt(b);
  }, N.tapDistance = function(p) {
    return arguments.length ? (R = +p, N) : R;
  }, N;
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
const Bn = 12;
function N0(t) {
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
const Do = [
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
  return Do[e % Do.length];
}
var A0 = /* @__PURE__ */ lt('<path fill="none" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke="white" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke-linecap="round" pointer-events="none"></path>', 1), P0 = /* @__PURE__ */ lt('<path class="link" fill="none" stroke-linecap="round" pointer-events="none"></path>'), I0 = /* @__PURE__ */ lt('<text class="link-label" text-anchor="middle"> </text>'), z0 = /* @__PURE__ */ lt('<text class="link-label" text-anchor="middle"> </text>'), T0 = /* @__PURE__ */ lt("<!><!>", 1), C0 = /* @__PURE__ */ lt('<g class="link-group"><!><path fill="none" stroke="transparent" stroke-linecap="round" class="link-hit"></path><!></g>');
function R0(t, e) {
  an(e, !0);
  let n = bt(e, "selected", 3, !1), r = bt(e, "interactive", 3, !1);
  const i = /* @__PURE__ */ D(() => S0(e.edge.points)), o = /* @__PURE__ */ D(() => e.edge.link), s = /* @__PURE__ */ D(() => {
    var k;
    return ((k = l(o)) == null ? void 0 : k.type) ?? "solid";
  }), a = /* @__PURE__ */ D(() => () => {
    var k, M;
    switch (l(s)) {
      case "dashed":
        return "5 3";
      default:
        return ((M = (k = l(o)) == null ? void 0 : k.style) == null ? void 0 : M.strokeDasharray) ?? "";
    }
  }), u = /* @__PURE__ */ D(() => {
    var k, M, L;
    return n() ? e.colors.selection : ((M = (k = l(o)) == null ? void 0 : k.style) == null ? void 0 : M.stroke) ?? M0((L = l(o)) == null ? void 0 : L.vlan) ?? e.colors.linkStroke;
  }), c = /* @__PURE__ */ D(() => l(s) === "double"), f = /* @__PURE__ */ D(() => () => {
    var M;
    return (M = l(o)) != null && M.label ? [Array.isArray(l(o).label) ? l(o).label.join(" / ") : l(o).label] : [];
  }), d = /* @__PURE__ */ D(() => () => {
    var k;
    return !((k = l(o)) != null && k.vlan) || l(o).vlan.length === 0 ? "" : l(o).vlan.length === 1 ? `VLAN ${l(o).vlan[0]}` : `VLAN ${l(o).vlan.join(", ")}`;
  }), h = /* @__PURE__ */ D(() => () => {
    if (e.edge.points.length < 2) return null;
    const k = Math.floor(e.edge.points.length / 2), M = e.edge.points[k - 1], L = e.edge.points[k];
    return !M || !L ? null : { x: (M.x + L.x) / 2, y: (M.y + L.y) / 2 };
  });
  function g(k) {
    var M;
    r() && (k.stopPropagation(), (M = e.onselect) == null || M.call(e, e.edge.id));
  }
  function m(k) {
    var M, L;
    r() && (k.preventDefault(), k.stopPropagation(), (M = e.onselect) == null || M.call(e, e.edge.id), (L = e.oncontextmenu) == null || L.call(e, e.edge.id, k));
  }
  var b = C0(), R = ht(b);
  {
    var N = (k) => {
      const M = /* @__PURE__ */ D(() => Math.max(3, Math.round(e.edge.width * 0.9)));
      var L = A0(), Y = At(L), q = it(Y), I = it(q);
      at(
        (U, X) => {
          v(Y, "d", l(i)), v(Y, "stroke", l(u)), v(Y, "stroke-width", e.edge.width + l(M) * 2), v(q, "d", l(i)), v(q, "stroke-width", U), v(I, "d", l(i)), v(I, "stroke", l(u)), v(I, "stroke-width", X);
        },
        [
          () => Math.max(1, e.edge.width),
          () => Math.max(1, e.edge.width - Math.round(l(M) * 0.8))
        ]
      ), $(k, L);
    }, H = (k) => {
      var M = P0();
      at(
        (L) => {
          v(M, "d", l(i)), v(M, "stroke", l(u)), v(M, "stroke-width", e.edge.width), v(M, "stroke-dasharray", L);
        },
        [() => l(a)() || void 0]
      ), $(k, M);
    };
    _t(R, (k) => {
      l(c) ? k(N) : k(H, !1);
    });
  }
  var z = it(R);
  z.__click = g, z.__contextmenu = m;
  var w = it(z);
  {
    var C = (k) => {
      const M = /* @__PURE__ */ D(() => l(h)());
      var L = ge(), Y = At(L);
      {
        var q = (I) => {
          const U = /* @__PURE__ */ D(() => l(f)()), X = /* @__PURE__ */ D(() => l(d)());
          var p = T0(), P = At(p);
          Ve(P, 17, () => l(U), Ms, (E, x, S) => {
            var A = I0(), B = ht(A);
            at(() => {
              v(A, "x", l(M).x), v(A, "y", l(M).y - 8 + S * 12), Qn(B, l(x));
            }), $(E, A);
          });
          var y = it(P);
          {
            var F = (E) => {
              var x = z0(), S = ht(x);
              at(() => {
                v(x, "x", l(M).x), v(x, "y", l(M).y - 8 + l(U).length * 12), Qn(S, l(X));
              }), $(E, x);
            };
            _t(y, (E) => {
              l(X) && E(F);
            });
          }
          $(I, p);
        };
        _t(Y, (I) => {
          l(M) && I(q);
        });
      }
      $(k, L);
    };
    _t(w, (k) => {
      l(h)() && k(C);
    });
  }
  at(
    (k) => {
      v(b, "data-link-id", e.edge.id), v(z, "d", l(i)), v(z, "stroke-width", k);
    },
    [() => Math.max(e.edge.width + 12, 16)]
  ), $(t, b), ln();
}
ur(["click", "contextmenu"]);
var L0 = /* @__PURE__ */ lt('<line stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"></line>');
function F0(t, e) {
  var n = L0();
  at(() => {
    v(n, "x1", e.fromX), v(n, "y1", e.fromY), v(n, "x2", e.toX), v(n, "y2", e.toY);
  }), $(t, n);
}
var O0 = /* @__PURE__ */ lt('<rect rx="8" ry="8"></rect>'), D0 = /* @__PURE__ */ lt("<rect></rect>"), Y0 = /* @__PURE__ */ lt("<circle></circle>"), H0 = /* @__PURE__ */ lt("<polygon></polygon>"), B0 = /* @__PURE__ */ lt("<polygon></polygon>"), V0 = /* @__PURE__ */ lt('<g><ellipse></ellipse><rect stroke="none"></rect><line></line><line></line><ellipse></ellipse></g>'), X0 = /* @__PURE__ */ lt("<rect></rect>"), q0 = /* @__PURE__ */ lt("<polygon></polygon>"), U0 = /* @__PURE__ */ lt('<rect rx="8" ry="8"></rect>'), G0 = /* @__PURE__ */ lt('<g class="node-icon"><svg viewBox="0 0 24 24" fill="currentColor"><!></svg></g>'), W0 = /* @__PURE__ */ lt('<text text-anchor="middle"> </text>'), K0 = /* @__PURE__ */ lt('<rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect>', 1), Z0 = /* @__PURE__ */ lt('<circle r="7" fill="#3b82f6" opacity="0.8" pointer-events="none"></circle><text text-anchor="middle" dominant-baseline="central" font-size="11" fill="white" pointer-events="none">+</text>', 1), J0 = /* @__PURE__ */ lt('<g class="node"><g class="node-bg"><!></g><g class="node-fg" pointer-events="none"><!><!></g><!><!></g>');
function Q0(t, e) {
  an(e, !0);
  let n = bt(e, "shadowFilterId", 3, "node-shadow"), r = bt(e, "selected", 3, !1), i = bt(e, "interactive", 3, !1);
  const o = /* @__PURE__ */ D(() => e.node.position.x), s = /* @__PURE__ */ D(() => e.node.position.y), a = /* @__PURE__ */ D(() => e.node.size.width / 2), u = /* @__PURE__ */ D(() => e.node.size.height / 2), c = /* @__PURE__ */ D(() => e.node.node.shape ?? "rounded");
  let f = /* @__PURE__ */ ft(!1);
  const d = /* @__PURE__ */ D(() => r() || l(f)), h = /* @__PURE__ */ D(() => {
    var T;
    return ((T = e.node.node.style) == null ? void 0 : T.fill) ?? (l(d) ? e.colors.nodeHoverFill : e.colors.nodeFill);
  }), g = /* @__PURE__ */ D(() => {
    var T;
    return r() ? e.colors.selection : ((T = e.node.node.style) == null ? void 0 : T.stroke) ?? (l(f) ? e.colors.nodeHoverStroke : e.colors.nodeStroke);
  }), m = /* @__PURE__ */ D(() => {
    var T;
    return r() ? 2.5 : ((T = e.node.node.style) == null ? void 0 : T.strokeWidth) ?? (l(f) ? 2 : 1.5);
  }), b = /* @__PURE__ */ D(() => {
    var T;
    return ((T = e.node.node.style) == null ? void 0 : T.strokeDasharray) ?? "";
  }), R = /* @__PURE__ */ D(() => nu(e.node.node.type)), N = Ql, H = /* @__PURE__ */ D(() => Array.isArray(e.node.node.label) ? e.node.node.label : [e.node.node.label ?? ""]), z = /* @__PURE__ */ D(() => l(H).map((T, O) => {
    const Q = T.includes("<b>") || T.includes("<strong>"), Z = T.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, ""), dt = O > 0 && !Q;
    return { text: Z, className: Q ? "node-label node-label-bold" : dt ? "node-label-secondary" : "node-label" };
  })), w = /* @__PURE__ */ D(() => l(R) ? N : 0), C = /* @__PURE__ */ D(() => l(w) > 0 ? jl : 0), k = /* @__PURE__ */ D(() => l(z).length * Qr), M = /* @__PURE__ */ D(() => l(w) + l(C) + l(k)), L = /* @__PURE__ */ D(() => l(s) - l(M) / 2), Y = /* @__PURE__ */ D(() => l(L) + l(w) + l(C) + Qr * 0.7);
  let q = /* @__PURE__ */ ft(null);
  function I(T, O) {
    const Q = O.currentTarget.getBoundingClientRect();
    if (T === "top" || T === "bottom") {
      const Z = Math.max(0, Math.min(1, (O.clientX - Q.left) / Q.width));
      V(
        q,
        {
          side: T,
          x: l(o) - l(a) + Z * e.node.size.width,
          y: T === "top" ? l(s) - l(u) : l(s) + l(u)
        },
        !0
      );
    } else {
      const Z = Math.max(0, Math.min(1, (O.clientY - Q.top) / Q.height));
      V(
        q,
        {
          side: T,
          x: T === "left" ? l(o) - l(a) : l(o) + l(a),
          y: l(s) - l(u) + Z * e.node.size.height
        },
        !0
      );
    }
  }
  function U(T) {
    var O;
    l(q) && (T.stopPropagation(), T.preventDefault(), (O = e.onaddport) == null || O.call(e, e.node.id, l(q).side));
  }
  function X(T) {
    var O;
    i() && (T.preventDefault(), T.stopPropagation(), (O = e.oncontextmenu) == null || O.call(e, e.node.id, T));
  }
  var p = J0();
  p.__contextmenu = X;
  var P = ht(p), y = ht(P);
  {
    var F = (T) => {
      var O = O0();
      at(() => {
        v(O, "x", l(o) - l(a)), v(O, "y", l(s) - l(u)), v(O, "width", e.node.size.width), v(O, "height", e.node.size.height), v(O, "fill", l(h)), v(O, "stroke", l(g)), v(O, "stroke-width", l(m)), v(O, "stroke-dasharray", l(b) || void 0);
      }), $(T, O);
    }, E = (T) => {
      var O = ge(), Q = At(O);
      {
        var Z = (ut) => {
          var ot = D0();
          at(() => {
            v(ot, "x", l(o) - l(a)), v(ot, "y", l(s) - l(u)), v(ot, "width", e.node.size.width), v(ot, "height", e.node.size.height), v(ot, "fill", l(h)), v(ot, "stroke", l(g)), v(ot, "stroke-width", l(m)), v(ot, "stroke-dasharray", l(b) || void 0);
          }), $(ut, ot);
        }, dt = (ut) => {
          var ot = ge(), Kt = At(ot);
          {
            var un = (cn) => {
              var ne = Y0();
              at(
                (Zr) => {
                  v(ne, "cx", l(o)), v(ne, "cy", l(s)), v(ne, "r", Zr), v(ne, "fill", l(h)), v(ne, "stroke", l(g)), v(ne, "stroke-width", l(m));
                },
                [() => Math.min(l(a), l(u))]
              ), $(cn, ne);
            }, va = (cn) => {
              var ne = ge(), Zr = At(ne);
              {
                var ma = (fn) => {
                  var Ne = H0();
                  at(() => {
                    v(Ne, "points", `${l(o) ?? ""},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) ?? ""},${l(s) + l(u)} ${l(o) - l(a)},${l(s) ?? ""}`), v(Ne, "fill", l(h)), v(Ne, "stroke", l(g)), v(Ne, "stroke-width", l(m));
                  }), $(fn, Ne);
                }, pa = (fn) => {
                  var Ne = ge(), _a = At(Ne);
                  {
                    var wa = (hn) => {
                      const Ye = /* @__PURE__ */ D(() => l(a) * 0.866);
                      var He = B0();
                      at(() => {
                        v(He, "points", `${l(o) - l(a)},${l(s) ?? ""} ${l(o) - l(Ye)},${l(s) - l(u)} ${l(o) + l(Ye)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) + l(Ye)},${l(s) + l(u)} ${l(o) - l(Ye)},${l(s) + l(u)}`), v(He, "fill", l(h)), v(He, "stroke", l(g)), v(He, "stroke-width", l(m));
                      }), $(hn, He);
                    }, ya = (hn) => {
                      var Ye = ge(), He = At(Ye);
                      {
                        var xa = (dn) => {
                          const Ft = /* @__PURE__ */ D(() => e.node.size.height * 0.15);
                          var hr = V0(), re = ht(hr), Me = it(re), Nt = it(Me), ct = it(Nt), he = it(ct);
                          at(() => {
                            v(re, "cx", l(o)), v(re, "cy", l(s) + l(u) - l(Ft)), v(re, "rx", l(a)), v(re, "ry", l(Ft)), v(re, "fill", l(h)), v(re, "stroke", l(g)), v(re, "stroke-width", l(m)), v(Me, "x", l(o) - l(a)), v(Me, "y", l(s) - l(u) + l(Ft)), v(Me, "width", e.node.size.width), v(Me, "height", e.node.size.height - l(Ft) * 2), v(Me, "fill", l(h)), v(Nt, "x1", l(o) - l(a)), v(Nt, "y1", l(s) - l(u) + l(Ft)), v(Nt, "x2", l(o) - l(a)), v(Nt, "y2", l(s) + l(u) - l(Ft)), v(Nt, "stroke", l(g)), v(Nt, "stroke-width", l(m)), v(ct, "x1", l(o) + l(a)), v(ct, "y1", l(s) - l(u) + l(Ft)), v(ct, "x2", l(o) + l(a)), v(ct, "y2", l(s) + l(u) - l(Ft)), v(ct, "stroke", l(g)), v(ct, "stroke-width", l(m)), v(he, "cx", l(o)), v(he, "cy", l(s) - l(u) + l(Ft)), v(he, "rx", l(a)), v(he, "ry", l(Ft)), v(he, "fill", l(h)), v(he, "stroke", l(g)), v(he, "stroke-width", l(m));
                          }), $(dn, hr);
                        }, ba = (dn) => {
                          var Ft = ge(), hr = At(Ft);
                          {
                            var re = (Nt) => {
                              var ct = X0();
                              at(() => {
                                v(ct, "x", l(o) - l(a)), v(ct, "y", l(s) - l(u)), v(ct, "width", e.node.size.width), v(ct, "height", e.node.size.height), v(ct, "rx", l(u)), v(ct, "ry", l(u)), v(ct, "fill", l(h)), v(ct, "stroke", l(g)), v(ct, "stroke-width", l(m));
                              }), $(Nt, ct);
                            }, Me = (Nt) => {
                              var ct = ge(), he = At(ct);
                              {
                                var ka = (gn) => {
                                  const Zt = /* @__PURE__ */ D(() => e.node.size.width * 0.15);
                                  var Dn = q0();
                                  at(() => {
                                    v(Dn, "points", `${l(o) - l(a) + l(Zt)},${l(s) - l(u)} ${l(o) + l(a) - l(Zt)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) + l(u)} ${l(o) - l(a)},${l(s) + l(u)}`), v(Dn, "fill", l(h)), v(Dn, "stroke", l(g)), v(Dn, "stroke-width", l(m));
                                  }), $(gn, Dn);
                                }, Ea = (gn) => {
                                  var Zt = U0();
                                  at(() => {
                                    v(Zt, "x", l(o) - l(a)), v(Zt, "y", l(s) - l(u)), v(Zt, "width", e.node.size.width), v(Zt, "height", e.node.size.height), v(Zt, "fill", l(h)), v(Zt, "stroke", l(g)), v(Zt, "stroke-width", l(m));
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
                              $(Nt, ct);
                            };
                            _t(
                              hr,
                              (Nt) => {
                                l(c) === "stadium" ? Nt(re) : Nt(Me, !1);
                              },
                              !0
                            );
                          }
                          $(dn, Ft);
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
                        l(c) === "hexagon" ? hn(wa) : hn(ya, !1);
                      },
                      !0
                    );
                  }
                  $(fn, Ne);
                };
                _t(
                  Zr,
                  (fn) => {
                    l(c) === "diamond" ? fn(ma) : fn(pa, !1);
                  },
                  !0
                );
              }
              $(cn, ne);
            };
            _t(
              Kt,
              (cn) => {
                l(c) === "circle" ? cn(un) : cn(va, !1);
              },
              !0
            );
          }
          $(ut, ot);
        };
        _t(
          Q,
          (ut) => {
            l(c) === "rect" ? ut(Z) : ut(dt, !1);
          },
          !0
        );
      }
      $(T, O);
    };
    _t(y, (T) => {
      l(c) === "rounded" ? T(F) : T(E, !1);
    });
  }
  var x = it(P), S = ht(x);
  {
    var A = (T) => {
      var O = G0(), Q = ht(O), Z = ht(Q);
      As(Z, () => l(R), !0), at(() => {
        v(O, "transform", `translate(${l(o) - N / 2}, ${l(L) ?? ""})`), v(Q, "width", N), v(Q, "height", N);
      }), $(T, O);
    };
    _t(S, (T) => {
      l(R) && T(A);
    });
  }
  var B = it(S);
  Ve(B, 17, () => l(z), Ms, (T, O, Q) => {
    var Z = W0(), dt = ht(Z);
    at(() => {
      v(Z, "x", l(o)), v(Z, "y", l(Y) + Q * Qr), Oi(Z, 0, Vl(l(O).className)), Qn(dt, l(O).text);
    }), $(T, Z);
  });
  var K = it(x);
  {
    var G = (T) => {
      const O = /* @__PURE__ */ D(() => 10);
      var Q = K0(), Z = At(Q);
      v(Z, "height", l(O)), Z.__pointermove = (Kt) => I("top", Kt), Z.__pointerdown = U;
      var dt = it(Z);
      v(dt, "height", l(O)), dt.__pointermove = (Kt) => I("bottom", Kt), dt.__pointerdown = U;
      var ut = it(dt);
      v(ut, "width", l(O)), ut.__pointermove = (Kt) => I("left", Kt), ut.__pointerdown = U;
      var ot = it(ut);
      v(ot, "width", l(O)), ot.__pointermove = (Kt) => I("right", Kt), ot.__pointerdown = U, at(() => {
        v(Z, "x", l(o) - l(a)), v(Z, "y", l(s) - l(u) - l(O) / 2), v(Z, "width", e.node.size.width), v(dt, "x", l(o) - l(a)), v(dt, "y", l(s) + l(u) - l(O) / 2), v(dt, "width", e.node.size.width), v(ut, "x", l(o) - l(a) - l(O) / 2), v(ut, "y", l(s) - l(u)), v(ut, "height", e.node.size.height), v(ot, "x", l(o) + l(a) - l(O) / 2), v(ot, "y", l(s) - l(u)), v(ot, "height", e.node.size.height);
      }), Pe("pointerleave", Z, () => {
        V(q, null);
      }), Pe("pointerleave", dt, () => {
        V(q, null);
      }), Pe("pointerleave", ut, () => {
        V(q, null);
      }), Pe("pointerleave", ot, () => {
        V(q, null);
      }), $(T, Q);
    };
    _t(K, (T) => {
      i() && l(f) && T(G);
    });
  }
  var nt = it(K);
  {
    var et = (T) => {
      var O = Z0(), Q = At(O), Z = it(Q);
      at(() => {
        v(Q, "cx", l(q).x), v(Q, "cy", l(q).y), v(Z, "x", l(q).x), v(Z, "y", l(q).y);
      }), $(T, O);
    };
    _t(nt, (T) => {
      l(q) && T(et);
    });
  }
  at(() => {
    v(p, "data-id", e.node.id), v(p, "data-device-type", e.node.node.type ?? ""), v(p, "filter", `url(#${n() ?? ""})`);
  }), Pe("pointerenter", p, () => {
    i() && V(f, !0);
  }), Pe("pointerleave", p, () => {
    V(f, !1);
  }), $(t, p), ln();
}
ur(["contextmenu", "pointermove", "pointerdown"]);
var j0 = /* @__PURE__ */ lt('<rect class="port-label-bg" rx="2" pointer-events="none"></rect><text class="port-label-text" font-size="9"> </text>', 1), $0 = /* @__PURE__ */ lt('<g class="port"><rect fill="transparent"></rect><rect class="port-box" rx="2" pointer-events="none"></rect><!></g>');
function tg(t, e) {
  an(e, !0);
  let n = bt(e, "hideLabel", 3, !1), r = bt(e, "selected", 3, !1), i = bt(e, "interactive", 3, !1), o = bt(e, "linked", 3, !1);
  const s = /* @__PURE__ */ D(() => e.port.absolutePosition.x), a = /* @__PURE__ */ D(() => e.port.absolutePosition.y), u = /* @__PURE__ */ D(() => e.port.size.width), c = /* @__PURE__ */ D(() => e.port.size.height), f = /* @__PURE__ */ D(() => N0(e.port)), d = /* @__PURE__ */ D(() => e.port.label.length * $l + 4), h = 12, g = /* @__PURE__ */ D(() => () => l(f).textAnchor === "middle" ? l(f).x - l(d) / 2 : l(f).textAnchor === "end" ? l(f).x - l(d) + 2 : l(f).x - 2), m = /* @__PURE__ */ D(() => l(f).y - h + 3);
  let b = /* @__PURE__ */ ft(!1);
  function R(L) {
    var Y, q;
    !i() || L.button !== 0 || (L.stopPropagation(), L.preventDefault(), o() ? (Y = e.onselect) == null || Y.call(e, e.port.id) : (q = e.onlinkstart) == null || q.call(e, e.port.id, l(s), l(a)));
  }
  function N(L) {
    var Y;
    i() && (L.stopPropagation(), (Y = e.onlinkend) == null || Y.call(e, e.port.id));
  }
  function H(L) {
    var Y;
    i() && (L.preventDefault(), L.stopPropagation(), (Y = e.oncontextmenu) == null || Y.call(e, e.port.id, L));
  }
  var z = $0();
  z.__contextmenu = H;
  var w = ht(z);
  v(w, "width", 24), v(w, "height", 24), w.__pointerdown = R, w.__pointerup = N;
  var C = it(w), k = it(C);
  {
    var M = (L) => {
      var Y = j0(), q = At(Y);
      v(q, "height", h);
      var I = it(q);
      I.__click = (X) => {
        var p;
        i() && (X.stopPropagation(), (p = e.onlabeledit) == null || p.call(e, e.port.id, e.port.label, X.clientX, X.clientY));
      };
      var U = ht(I);
      at(
        (X) => {
          v(q, "x", X), v(q, "y", l(m)), v(q, "width", l(d)), v(q, "fill", e.colors.portLabelBg), v(I, "x", l(f).x), v(I, "y", l(f).y), v(I, "text-anchor", l(f).textAnchor), v(I, "fill", e.colors.portLabelColor), Qn(U, e.port.label);
        },
        [() => l(g)()]
      ), $(L, Y);
    };
    _t(k, (L) => {
      n() || L(M);
    });
  }
  at(() => {
    v(z, "data-port", e.port.id), v(z, "data-port-device", e.port.nodeId), Oi(w, 0, `port-hit ${o() ? "linked" : ""}`), v(w, "x", l(s) - 12), v(w, "y", l(a) - 12), v(C, "x", l(s) - l(u) / 2 - (r() || l(b) ? 2 : 0)), v(C, "y", l(a) - l(c) / 2 - (r() || l(b) ? 2 : 0)), v(C, "width", l(u) + (r() || l(b) ? 4 : 0)), v(C, "height", l(c) + (r() || l(b) ? 4 : 0)), v(C, "fill", r() ? e.colors.selection : l(b) ? "#3b82f6" : e.colors.portFill), v(C, "stroke", r() ? e.colors.selection : l(b) ? "#2563eb" : e.colors.portStroke), v(C, "stroke-width", r() || l(b) ? 2 : 1);
  }), Pe("pointerenter", z, () => {
    V(b, i());
  }), Pe("pointerleave", z, () => {
    V(b, !1);
  }), $(t, z), ln();
}
ur(["contextmenu", "pointerdown", "pointerup", "click"]);
var eg = /* @__PURE__ */ lt('<g class="subgraph"><rect class="subgraph-bg" rx="12" ry="12"></rect><rect fill="transparent"></rect><text class="subgraph-label" text-anchor="start" pointer-events="none"> </text></g>');
function ng(t, e) {
  an(e, !0);
  let n = bt(e, "selected", 3, !1);
  const r = /* @__PURE__ */ D(() => e.subgraph.subgraph.style ?? {}), i = [
    "surface-1",
    "surface-2",
    "surface-3",
    "accent-blue",
    "accent-green",
    "accent-red",
    "accent-amber",
    "accent-purple"
  ], o = /* @__PURE__ */ D(() => () => {
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
  }), s = /* @__PURE__ */ D(() => l(r).strokeWidth ?? 3), a = /* @__PURE__ */ D(() => l(r).strokeDasharray ?? "");
  var u = eg(), c = ht(u);
  c.__click = (g) => {
    var m;
    g.stopPropagation(), (m = e.onselect) == null || m.call(e, e.subgraph.id);
  };
  var f = it(c);
  v(f, "height", 28);
  var d = it(f), h = ht(d);
  at(
    (g, m, b) => {
      v(u, "data-id", e.subgraph.id), v(c, "x", e.subgraph.bounds.x), v(c, "y", e.subgraph.bounds.y), v(c, "width", e.subgraph.bounds.width), v(c, "height", e.subgraph.bounds.height), v(c, "fill", g), v(c, "stroke", m), v(c, "stroke-width", n() ? 3 : l(s)), v(c, "stroke-dasharray", n() ? void 0 : l(a) || void 0), v(f, "data-sg-drag", e.subgraph.id), v(f, "x", e.subgraph.bounds.x), v(f, "y", e.subgraph.bounds.y), v(f, "width", e.subgraph.bounds.width), v(d, "x", e.subgraph.bounds.x + 10), v(d, "y", e.subgraph.bounds.y + 20), v(d, "fill", b), Qn(h, e.subgraph.subgraph.label);
    },
    [
      () => l(o)().fill,
      () => n() ? "#3b82f6" : l(o)().stroke,
      () => l(o)().text
    ]
  ), $(t, u), ln();
}
ur(["click"]);
var rg = /* @__PURE__ */ lt('<svg xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; user-select: none; background: #f8fafc;"><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7"></polygon></marker><filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"></feDropShadow></filter><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5"></path></pattern></defs><!><g class="viewport"><rect class="canvas-bg" x="-99999" y="-99999" width="199998" height="199998" fill="url(#grid)"></rect><!><!><!><!><!></g></svg>');
function ig(t, e) {
  an(e, !0);
  let n = bt(e, "interactive", 3, !1), r = bt(e, "selection", 19, () => /* @__PURE__ */ new Set()), i = bt(e, "linkedPorts", 19, () => /* @__PURE__ */ new Set()), o = bt(e, "linkPreview", 3, null), s = bt(e, "svgEl", 15, null);
  const a = /* @__PURE__ */ D(() => `${e.bounds.x - 50} ${e.bounds.y - 50} ${e.bounds.width + 100} ${e.bounds.height + 100}`), u = /* @__PURE__ */ D(() => [...e.nodes.values()]), c = /* @__PURE__ */ D(() => [...e.edges.values()]), f = /* @__PURE__ */ D(() => [...e.subgraphs.values()]), d = /* @__PURE__ */ D(() => {
    const I = /* @__PURE__ */ new Map();
    for (const U of e.ports.values()) {
      const X = I.get(U.nodeId);
      X ? X.push(U) : I.set(U.nodeId, [U]);
    }
    return I;
  });
  let h = /* @__PURE__ */ ft(void 0);
  Be(() => {
    if (!s() || !l(h)) return;
    const I = zt(s()), U = E0().scaleExtent([0.1, 5]).filter((X) => X.type === "wheel" ? !0 : X.type === "mousedown" || X.type === "pointerdown" ? X.button === 1 || X.altKey : !1).on("zoom", (X) => {
      l(h) && l(h).setAttribute("transform", X.transform.toString());
    });
    return I.call(U), I.on("contextmenu.zoom", null), () => {
      I.on(".zoom", null);
    };
  }), Be(() => {
    if (l(u).length, l(f).length, !s() || !n()) return;
    const I = xo().filter((X) => {
      const p = X.target;
      return p.closest(".port") || p.closest("[data-droplet]") ? !1 : X.button === 0;
    }).on("drag", function(X) {
      var y;
      const p = this.getAttribute("data-id");
      if (!p) return;
      const P = e.nodes.get(p);
      P && ((y = e.onnodedragmove) == null || y.call(e, p, P.position.x + X.dx, P.position.y + X.dy));
    });
    zt(s()).selectAll(".node[data-id]").call(I);
    const U = xo().on("drag", function(X) {
      var y;
      const p = this.getAttribute("data-sg-drag");
      if (!p) return;
      const P = e.subgraphs.get(p);
      P && ((y = e.onsubgraphmove) == null || y.call(e, p, P.bounds.x + X.dx, P.bounds.y + X.dy));
    });
    return zt(s()).selectAll("[data-sg-drag]").call(U), () => {
      zt(s()).selectAll(".node[data-id]").on(".drag", null), zt(s()).selectAll("[data-sg-drag]").on(".drag", null);
    };
  });
  var g = rg();
  let m;
  var b = ht(g), R = ht(b), N = ht(R), H = it(b);
  As(
    H,
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
  var z = it(H), w = ht(z);
  w.__click = () => {
    var I;
    return (I = e.onbackgroundclick) == null ? void 0 : I.call(e);
  };
  var C = it(w);
  Ve(C, 17, () => l(f), (I) => I.id, (I, U) => {
    {
      let X = /* @__PURE__ */ D(() => r().has(l(U).id));
      ng(I, {
        get subgraph() {
          return l(U);
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
  var k = it(C);
  Ve(k, 17, () => l(c), (I) => I.id, (I, U) => {
    {
      let X = /* @__PURE__ */ D(() => r().has(l(U).id));
      R0(I, {
        get edge() {
          return l(U);
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
        oncontextmenu: (p, P) => {
          var y;
          return (y = e.oncontextmenu) == null ? void 0 : y.call(e, p, "edge", P);
        }
      });
    }
  });
  var M = it(k);
  Ve(M, 17, () => l(u), (I) => I.id, (I, U) => {
    {
      let X = /* @__PURE__ */ D(() => r().has(l(U).id));
      Q0(I, {
        get node() {
          return l(U);
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
        oncontextmenu: (p, P) => {
          var y;
          return (y = e.oncontextmenu) == null ? void 0 : y.call(e, p, "node", P);
        }
      });
    }
  });
  var L = it(M);
  Ve(L, 17, () => l(u), (I) => I.id, (I, U) => {
    var X = ge(), p = At(X);
    Ve(p, 17, () => l(d).get(l(U).id) ?? [], (P) => P.id, (P, y) => {
      {
        let F = /* @__PURE__ */ D(() => r().has(l(y).id)), E = /* @__PURE__ */ D(() => i().has(l(y).id));
        tg(P, {
          get port() {
            return l(y);
          },
          get colors() {
            return e.colors;
          },
          get selected() {
            return l(F);
          },
          get interactive() {
            return n();
          },
          get linked() {
            return l(E);
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
          oncontextmenu: (x, S) => {
            var A;
            return (A = e.oncontextmenu) == null ? void 0 : A.call(e, x, "port", S);
          }
        });
      }
    }), $(I, X);
  });
  var Y = it(L);
  {
    var q = (I) => {
      F0(I, {
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
    _t(Y, (I) => {
      o() && I(q);
    });
  }
  ao(z, (I) => V(h, I), () => l(h)), ao(g, (I) => s(I), () => s()), at(() => {
    v(g, "viewBox", l(a)), m = Oi(g, 0, "", null, m, { interactive: n() }), v(N, "fill", e.colors.linkStroke), v(w, "pointer-events", n() ? "fill" : "none");
  }), $(t, g), ln();
}
ur(["click"]);
var og = /* @__PURE__ */ Cl('<div style="width: 100%; height: 100%; outline: none;"><!></div>');
function sg(t, e) {
  var F;
  an(e, !0);
  let n = bt(e, "mode", 3, "view");
  const r = /* @__PURE__ */ D(() => Gc(e.theme));
  let i = /* @__PURE__ */ ft(Pt(n()));
  const o = /* @__PURE__ */ D(() => l(i) === "edit");
  let s = /* @__PURE__ */ ft(Pt(new Map(e.layout.nodes))), a = /* @__PURE__ */ ft(Pt(new Map(e.layout.ports))), u = /* @__PURE__ */ ft(Pt(new Map(e.layout.edges))), c = /* @__PURE__ */ ft(Pt(new Map(e.layout.subgraphs))), f = Pt(e.layout.bounds), d = /* @__PURE__ */ ft(Pt((F = e.graph) != null && F.links ? [...e.graph.links] : [])), h = /* @__PURE__ */ ft(Pt(/* @__PURE__ */ new Set())), g = /* @__PURE__ */ ft(null), m = /* @__PURE__ */ ft(null);
  const b = /* @__PURE__ */ D(() => {
    const E = /* @__PURE__ */ new Set();
    for (const x of l(u).values())
      x.fromPortId && E.add(x.fromPortId), x.toPortId && E.add(x.toPortId);
    return E;
  });
  Be(() => {
    if (!l(o) || !l(m)) return;
    const E = l(m);
    return E.addEventListener("keydown", p), () => E.removeEventListener("keydown", p);
  }), Be(() => {
    if (!l(m)) return;
    const x = l(m).getRootNode().host;
    if (!x) return;
    function S(A) {
      var K;
      const B = (K = A.detail) == null ? void 0 : K.mode;
      (B === "edit" || B === "view") && V(i, B, !0);
    }
    return x.addEventListener("shumoku-mode-change", S), () => x.removeEventListener("shumoku-mode-change", S);
  }), Be(() => {
    if (!l(m)) return;
    const x = l(m).getRootNode().host;
    if (!x) return;
    function S(A) {
      const B = {
        nodes: l(s),
        ports: l(a),
        edges: l(u),
        subgraphs: l(c),
        bounds: f
      };
      x.dispatchEvent(new CustomEvent("shumoku-snapshot", {
        detail: { layout: B, links: l(d) },
        bubbles: !0,
        composed: !0
      }));
    }
    return x.addEventListener("shumoku-get-snapshot", S), () => x.removeEventListener("shumoku-get-snapshot", S);
  }), Be(() => {
    var E, x;
    if (l(h).size === 0)
      (E = e.onselect) == null || E.call(e, null, null);
    else {
      const S = [...l(h)][0] ?? null;
      if (!S) return;
      let A = "node";
      l(u).has(S) ? A = "edge" : l(a).has(S) ? A = "port" : l(c).has(S) && (A = "subgraph"), (x = e.onselect) == null || x.call(e, S, A);
    }
  });
  async function R(E, x, S) {
    const A = await yu(
      E,
      x,
      S,
      {
        nodes: l(s),
        ports: l(a),
        subgraphs: l(c)
      },
      l(d)
    );
    A && (V(s, A.nodes, !0), V(a, A.ports, !0), V(u, A.edges, !0), A.subgraphs && V(c, A.subgraphs, !0));
  }
  async function N(E, x) {
    const S = Mu(E, x, l(s), l(a), l(d));
    S && (V(s, S.nodes, !0), V(a, S.ports, !0), V(u, await Kn(S.nodes, S.ports, l(d)), !0));
  }
  async function H(E, x, S) {
    const A = await xu(
      E,
      x,
      S,
      {
        nodes: l(s),
        ports: l(a),
        subgraphs: l(c)
      },
      l(d)
    );
    A && (V(s, A.nodes, !0), V(a, A.ports, !0), V(u, A.edges, !0), V(c, A.subgraphs, !0));
  }
  let z = null;
  function w(E, x, S) {
    var G, nt;
    V(g, { fromPortId: E, fromX: x, fromY: S, toX: x, toY: S }, !0);
    function A(et) {
      if (!l(g) || !l(m)) return;
      const O = (l(m).querySelector(".viewport") ?? l(m)).getScreenCTM();
      if (!O) return;
      const Q = new DOMPoint(et.clientX, et.clientY).matrixTransform(O.inverse());
      V(g, { ...l(g), toX: Q.x, toY: Q.y }, !0);
    }
    function B(et) {
      et.target.closest(".port") || K();
    }
    function K() {
      var et, T;
      (et = l(m)) == null || et.removeEventListener("pointermove", A), (T = l(m)) == null || T.removeEventListener("pointerup", B), V(g, null), z = null;
    }
    z = K, (G = l(m)) == null || G.addEventListener("pointermove", A), (nt = l(m)) == null || nt.addEventListener("pointerup", B);
  }
  function C(E) {
    if (!l(g)) return;
    const x = l(g).fromPortId;
    if (z == null || z(), x === E) return;
    const S = l(a).get(x), A = l(a).get(E);
    S && A && S.nodeId === A.nodeId || k(x, E);
  }
  async function k(E, x) {
    var O;
    const S = E.split(":"), A = x.split(":");
    let B = S[0] ?? "", K = S.slice(1).join(":"), G = A[0] ?? "", nt = A.slice(1).join(":");
    if (!B || !K || !G || !nt || bu(l(d), B, K, G, nt)) return;
    const et = l(s).get(B), T = l(s).get(G);
    et && T && et.position.y > T.position.y && ([B, G] = [G, B], [K, nt] = [nt, K]), V(
      d,
      [
        ...l(d),
        {
          id: `link-${Date.now()}`,
          from: { node: B, port: K },
          to: { node: G, port: nt }
        }
      ],
      !0
    ), V(u, await Kn(l(s), l(a), l(d)), !0), (O = e.onchange) == null || O.call(e, l(d));
  }
  Be(() => {
    if (!l(m)) return;
    const x = l(m).getRootNode().host;
    function S(K) {
      const { label: G, position: nt } = K.detail ?? {}, et = `node-${Date.now()}`, T = 180, O = 80, Q = [...l(h)].find((un) => l(c).has(un)), Z = Q ? l(c).get(Q) : void 0;
      let dt, ut;
      Z ? (dt = Q, ut = nt ?? {
        x: Z.bounds.x + Z.bounds.width / 2,
        y: Z.bounds.y + Z.bounds.height / 2
      }) : ut = nt ?? {
        x: f.x + f.width + 20 + T / 2,
        y: f.y + f.height / 2
      };
      const ot = new Map(l(s));
      ot.set(et, {
        id: et,
        position: ut,
        size: { width: T, height: O },
        node: { id: et, label: G ?? "New Node", shape: "rounded", parent: dt }
      });
      const Kt = Ls(et, ut.x, ut.y, ot, 8, l(c));
      if (ot.set(et, { ...ot.get(et), position: Kt }), V(s, ot, !0), dt) {
        const un = new Map(l(c));
        Cr(ot, un, l(a)), V(c, un, !0);
      }
      V(h, /* @__PURE__ */ new Set([et]), !0);
    }
    function A(K) {
      const { label: G, position: nt } = K.detail ?? {}, et = `sg-${Date.now()}`, T = 200, O = 120, Q = nt ?? {
        x: f.x + f.width + 20 + T / 2,
        y: f.y + f.height / 2
      }, Z = new Map(l(c));
      Z.set(et, {
        id: et,
        bounds: {
          x: Q.x - T / 2,
          y: Q.y - O / 2,
          width: T,
          height: O
        },
        subgraph: { id: et, label: G ?? "New Group" }
      }), Cr(l(s), Z, l(a)), V(c, Z, !0);
    }
    function B(K) {
      const { portId: G, label: nt } = K.detail ?? {};
      G && nt && I(G, nt);
    }
    return x == null || x.addEventListener("shumoku-add-node", S), x == null || x.addEventListener("shumoku-add-subgraph", A), x == null || x.addEventListener("shumoku-label-commit", B), () => {
      x == null || x.removeEventListener("shumoku-add-node", S), x == null || x.removeEventListener("shumoku-add-subgraph", A), x == null || x.removeEventListener("shumoku-label-commit", B);
    };
  });
  function M(E) {
    V(h, /* @__PURE__ */ new Set([E]), !0);
  }
  function L(E) {
    V(h, /* @__PURE__ */ new Set([E]), !0);
  }
  function Y(E) {
    V(h, /* @__PURE__ */ new Set([E]), !0);
  }
  function q(E, x, S, A) {
    if (!l(m)) return;
    const K = l(m).getRootNode().host;
    K == null || K.dispatchEvent(new CustomEvent("shumoku-label-edit", {
      detail: { portId: E, label: x, screenX: S, screenY: A },
      bubbles: !0,
      composed: !0
    }));
  }
  function I(E, x) {
    const S = l(a).get(E);
    if (!S || x === S.label) return;
    const A = new Map(l(a));
    A.set(E, { ...S, label: x }), V(a, A, !0);
  }
  function U() {
    V(h, /* @__PURE__ */ new Set(), !0);
  }
  function X(E, x, S) {
    var A;
    V(h, /* @__PURE__ */ new Set([E]), !0), (A = e.oncontextmenu) == null || A.call(e, E, x, S.clientX, S.clientY);
  }
  function p(E) {
    var x, S;
    if (E.key === "Delete" || E.key === "Backspace") {
      for (const A of l(h))
        if (l(u).has(A)) {
          const B = l(u).get(A);
          (x = B == null ? void 0 : B.link) != null && x.id && V(d, l(d).filter((K) => {
            var G;
            return K.id !== ((G = B.link) == null ? void 0 : G.id);
          }), !0);
        } else if (l(a).has(A)) {
          const B = Au(A, l(s), l(a), l(d));
          B && (V(s, B.nodes, !0), V(a, B.ports, !0), V(d, B.links, !0));
        }
      Kn(l(s), l(a), l(d)).then((A) => {
        V(u, A, !0);
      }), V(h, /* @__PURE__ */ new Set(), !0), (S = e.onchange) == null || S.call(e, l(d));
    }
    E.key === "Escape" && (V(h, /* @__PURE__ */ new Set(), !0), V(g, null));
  }
  var P = og(), y = ht(P);
  ig(y, {
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
      return l(c);
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
    onaddport: N,
    onlinkstart: w,
    onlinkend: C,
    onedgeselect: M,
    onportselect: L,
    onlabeledit: q,
    onsubgraphselect: Y,
    onsubgraphmove: H,
    oncontextmenu: X,
    onbackgroundclick: U,
    get svgEl() {
      return l(m);
    },
    set svgEl(E) {
      V(m, E, !0);
    }
  }), $(t, P), ln();
}
class ag extends HTMLElement {
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
    this._instance && (no(this._instance), this._instance = null);
  }
  _tryRender() {
    !this.shadowRoot || !this._layout || (this._instance && (no(this._instance), this._instance = null), this._instance = Ll(sg, {
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
