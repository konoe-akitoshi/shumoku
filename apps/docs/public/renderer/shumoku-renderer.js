var Ma = Object.defineProperty;
var Zi = (t) => {
  throw TypeError(t);
};
var Aa = (t, e, n) => e in t ? Ma(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var Ot = (t, e, n) => Aa(t, typeof e != "symbol" ? e + "" : e, n), Jr = (t, e, n) => e.has(t) || Zi("Cannot " + n);
var p = (t, e, n) => (Jr(t, e, "read from private field"), n ? n.call(t) : e.get(t)), $ = (t, e, n) => e.has(t) ? Zi("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, n), J = (t, e, n, r) => (Jr(t, e, "write to private field"), r ? r.call(t, n) : e.set(t, n), n), bt = (t, e, n) => (Jr(t, e, "access private method"), n);
const _t = Symbol(), Ia = "http://www.w3.org/1999/xhtml", ri = !1;
var Bo = Array.isArray, Pa = Array.prototype.indexOf, Vr = Array.from, Ta = Object.defineProperty, pn = Object.getOwnPropertyDescriptor, za = Object.getOwnPropertyDescriptors, Ca = Object.prototype, Ra = Array.prototype, Vo = Object.getPrototypeOf, Ji = Object.isExtensible;
function La(t) {
  for (var e = 0; e < t.length; e++)
    t[e]();
}
function Xo() {
  var t, e, n = new Promise((r, i) => {
    t = r, e = i;
  });
  return { promise: n, resolve: t, reject: e };
}
const xt = 2, Ar = 4, Xr = 8, Uo = 1 << 24, ke = 16, Ee = 32, sn = 64, Ni = 128, Wt = 512, kt = 1024, Nt = 2048, Se = 4096, Ht = 8192, we = 16384, Mi = 32768, Pn = 65536, Qi = 1 << 17, qo = 1 << 18, Fn = 1 << 19, Fa = 1 << 20, Re = 1 << 25, tn = 32768, ii = 1 << 21, Ai = 1 << 22, Le = 1 << 23, qn = Symbol("$state"), Oa = Symbol("legacy props"), Da = Symbol(""), mn = new class extends Error {
  constructor() {
    super(...arguments);
    Ot(this, "name", "StaleReactionError");
    Ot(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function Ya() {
  throw new Error("https://svelte.dev/e/async_derived_orphan");
}
function Ha(t) {
  throw new Error("https://svelte.dev/e/effect_in_teardown");
}
function Ba() {
  throw new Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function Va(t) {
  throw new Error("https://svelte.dev/e/effect_orphan");
}
function Xa() {
  throw new Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Ua(t) {
  throw new Error("https://svelte.dev/e/props_invalid_value");
}
function qa() {
  throw new Error("https://svelte.dev/e/state_descriptors_fixed");
}
function Ga() {
  throw new Error("https://svelte.dev/e/state_prototype_fixed");
}
function Wa() {
  throw new Error("https://svelte.dev/e/state_unsafe_mutation");
}
function Ka() {
  throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
function Za() {
  console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
function Go(t) {
  return t === this.v;
}
function Ja(t, e) {
  return t != t ? e == e : t !== e || t !== null && typeof t == "object" || typeof t == "function";
}
function Wo(t) {
  return !Ja(t, this.v);
}
let Qa = !1, Kt = null;
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
      cs(r);
  }
  return t !== void 0 && (e.x = t), e.i = !0, Kt = e.p, t ?? /** @type {T} */
  {};
}
function Ko() {
  return !0;
}
let _n = [];
function ja() {
  var t = _n;
  _n = [], La(t);
}
function Fe(t) {
  if (_n.length === 0) {
    var e = _n;
    queueMicrotask(() => {
      e === _n && ja();
    });
  }
  _n.push(t);
}
function Zo(t) {
  var e = rt;
  if (e === null)
    return j.f |= Le, t;
  if ((e.f & Mi) === 0) {
    if ((e.f & Ni) === 0)
      throw t;
    e.b.error(t);
  } else
    zn(t, e);
}
function zn(t, e) {
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
const $a = -7169;
function mt(t, e) {
  t.f = t.f & $a | e;
}
function Ii(t) {
  (t.f & Wt) !== 0 || t.deps === null ? mt(t, kt) : mt(t, Se);
}
function Jo(t) {
  if (t !== null)
    for (const e of t)
      (e.f & xt) === 0 || (e.f & tn) === 0 || (e.f ^= tn, Jo(
        /** @type {Derived} */
        e.deps
      ));
}
function Qo(t, e, n) {
  (t.f & Nt) !== 0 ? e.add(t) : (t.f & Se) !== 0 && n.add(t), Jo(t.deps), mt(t, kt);
}
const hr = /* @__PURE__ */ new Set();
let st = null, yt = null, Qt = [], Pi = null, oi = !1;
var xn, bn, Ge, kn, rr, En, Sn, Nn, fe, si, ai, jo;
const Ki = class Ki {
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
    $(this, xn, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    $(this, bn, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    $(this, Ge, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    $(this, kn, 0);
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
    $(this, En, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    $(this, Sn, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    Ot(this, "skipped_effects", /* @__PURE__ */ new Set());
    Ot(this, "is_fork", !1);
    $(this, Nn, !1);
  }
  is_deferred() {
    return this.is_fork || p(this, kn) > 0;
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
      bt(this, fe, si).call(this, o, n, r);
    if (this.is_deferred())
      bt(this, fe, ai).call(this, r), bt(this, fe, ai).call(this, n);
    else {
      for (const o of p(this, xn)) o();
      p(this, xn).clear(), p(this, Ge) === 0 && bt(this, fe, jo).call(this), st = null, ji(r), ji(n), (i = p(this, rr)) == null || i.resolve();
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
    n !== _t && !this.previous.has(e) && this.previous.set(e, n), (e.f & Le) === 0 && (this.current.set(e, e.v), yt == null || yt.set(e, e.v));
  }
  activate() {
    st = this, this.apply();
  }
  deactivate() {
    st === this && (st = null, yt = null);
  }
  flush() {
    if (this.activate(), Qt.length > 0) {
      if (tl(), st !== null && st !== this)
        return;
    } else p(this, Ge) === 0 && this.process([]);
    this.deactivate();
  }
  discard() {
    for (const e of p(this, bn)) e(this);
    p(this, bn).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(e) {
    J(this, Ge, p(this, Ge) + 1), e && J(this, kn, p(this, kn) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(e) {
    J(this, Ge, p(this, Ge) - 1), e && J(this, kn, p(this, kn) - 1), !p(this, Nn) && (J(this, Nn, !0), Fe(() => {
      J(this, Nn, !1), this.is_deferred() ? Qt.length > 0 && this.flush() : this.revive();
    }));
  }
  revive() {
    for (const e of p(this, En))
      p(this, Sn).delete(e), mt(e, Nt), xe(e);
    for (const e of p(this, Sn))
      mt(e, Se), xe(e);
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(e) {
    p(this, xn).add(e);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(e) {
    p(this, bn).add(e);
  }
  settled() {
    return (p(this, rr) ?? J(this, rr, Xo())).promise;
  }
  static ensure() {
    if (st === null) {
      const e = st = new Ki();
      hr.add(st), Fe(() => {
        st === e && e.flush();
      });
    }
    return st;
  }
  apply() {
  }
};
xn = new WeakMap(), bn = new WeakMap(), Ge = new WeakMap(), kn = new WeakMap(), rr = new WeakMap(), En = new WeakMap(), Sn = new WeakMap(), Nn = new WeakMap(), fe = new WeakSet(), /**
 * Traverse the effect tree, executing effects or stashing
 * them for later execution as appropriate
 * @param {Effect} root
 * @param {Effect[]} effects
 * @param {Effect[]} render_effects
 */
si = function(e, n, r) {
  e.f ^= kt;
  for (var i = e.first, o = null; i !== null; ) {
    var s = i.f, a = (s & (Ee | sn)) !== 0, u = a && (s & kt) !== 0, f = u || (s & Ht) !== 0 || this.skipped_effects.has(i);
    if (!f && i.fn !== null) {
      a ? i.f ^= kt : o !== null && (s & (Ar | Xr | Uo)) !== 0 ? o.b.defer_effect(i) : (s & Ar) !== 0 ? n.push(i) : ar(i) && ((s & ke) !== 0 && p(this, En).add(i), Kn(i));
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
ai = function(e) {
  for (var n = 0; n < e.length; n += 1)
    Qo(e[n], p(this, En), p(this, Sn));
}, jo = function() {
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
        var r = Qt;
        Qt = [];
        const u = /* @__PURE__ */ new Set(), f = /* @__PURE__ */ new Map();
        for (const c of s)
          $o(c, a, u, f);
        if (Qt.length > 0) {
          st = o, o.apply();
          for (const c of Qt)
            bt(i = o, fe, si).call(i, c, [], []);
          o.deactivate();
        }
        Qt = r;
      }
    }
    st = null, yt = e;
  }
  this.committed = !0, hr.delete(this);
};
let Oe = Ki;
function tl() {
  oi = !0;
  var t = null;
  try {
    for (var e = 0; Qt.length > 0; ) {
      var n = Oe.ensure();
      if (e++ > 1e3) {
        var r, i;
        el();
      }
      n.process(Qt), De.clear();
    }
  } finally {
    oi = !1, Pi = null;
  }
}
function el() {
  try {
    Xa();
  } catch (t) {
    zn(t, Pi);
  }
}
let Jt = null;
function ji(t) {
  var e = t.length;
  if (e !== 0) {
    for (var n = 0; n < e; ) {
      var r = t[n++];
      if ((r.f & (we | Ht)) === 0 && ar(r) && (Jt = /* @__PURE__ */ new Set(), Kn(r), r.deps === null && r.first === null && r.nodes === null && (r.teardown === null && r.ac === null ? ms(r) : r.fn = null), (Jt == null ? void 0 : Jt.size) > 0)) {
        De.clear();
        for (const i of Jt) {
          if ((i.f & (we | Ht)) !== 0) continue;
          const o = [i];
          let s = i.parent;
          for (; s !== null; )
            Jt.has(s) && (Jt.delete(s), o.push(s)), s = s.parent;
          for (let a = o.length - 1; a >= 0; a--) {
            const u = o[a];
            (u.f & (we | Ht)) === 0 && Kn(u);
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
      (o & xt) !== 0 ? $o(
        /** @type {Derived} */
        i,
        e,
        n,
        r
      ) : (o & (Ai | ke)) !== 0 && (o & Nt) === 0 && ts(i, e, r) && (mt(i, Nt), xe(
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
      if ((i.f & xt) !== 0 && ts(
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
function xe(t) {
  for (var e = Pi = t; e.parent !== null; ) {
    e = e.parent;
    var n = e.f;
    if (oi && e === rt && (n & ke) !== 0 && (n & qo) === 0)
      return;
    if ((n & (sn | Ee)) !== 0) {
      if ((n & kt) === 0) return;
      e.f ^= kt;
    }
  }
  Qt.push(e);
}
function nl(t) {
  let e = 0, n = en(0), r;
  return () => {
    Ci() && (l(n), hs(() => (e === 0 && (r = Fi(() => t(() => Gn(n)))), e += 1, () => {
      Fe(() => {
        e -= 1, e === 0 && (r == null || r(), r = void 0, Gn(n));
      });
    })));
  };
}
var rl = Pn | Fn | Ni;
function il(t, e, n) {
  new ol(t, e, n);
}
var Xt, Si, ie, We, oe, Ut, At, se, _e, ze, Ke, Ce, Mn, Ze, An, In, pe, Hr, vt, sl, al, li, wr, xr, ui;
class ol {
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
    $(this, Si, null);
    /** @type {BoundaryProps} */
    $(this, ie);
    /** @type {((anchor: Node) => void)} */
    $(this, We);
    /** @type {Effect} */
    $(this, oe);
    /** @type {Effect | null} */
    $(this, Ut, null);
    /** @type {Effect | null} */
    $(this, At, null);
    /** @type {Effect | null} */
    $(this, se, null);
    /** @type {DocumentFragment | null} */
    $(this, _e, null);
    /** @type {TemplateNode | null} */
    $(this, ze, null);
    $(this, Ke, 0);
    $(this, Ce, 0);
    $(this, Mn, !1);
    $(this, Ze, !1);
    /** @type {Set<Effect>} */
    $(this, An, /* @__PURE__ */ new Set());
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
    $(this, Hr, nl(() => (J(this, pe, en(p(this, Ke))), () => {
      J(this, pe, null);
    })));
    J(this, Xt, e), J(this, ie, n), J(this, We, r), this.parent = /** @type {Effect} */
    rt.b, this.is_pending = !!p(this, ie).pending, J(this, oe, Ri(() => {
      rt.b = this;
      {
        var i = bt(this, vt, li).call(this);
        try {
          J(this, Ut, qt(() => r(i)));
        } catch (o) {
          this.error(o);
        }
        p(this, Ce) > 0 ? bt(this, vt, xr).call(this) : this.is_pending = !1;
      }
      return () => {
        var o;
        (o = p(this, ze)) == null || o.remove();
      };
    }, rl));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(e) {
    Qo(e, p(this, An), p(this, In));
  }
  /**
   * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
   * @returns {boolean}
   */
  is_rendered() {
    return !this.is_pending && (!this.parent || this.parent.is_rendered());
  }
  has_pending_snippet() {
    return !!p(this, ie).pending;
  }
  /**
   * Update the source that powers `$effect.pending()` inside this boundary,
   * and controls when the current `pending` snippet (if any) is removed.
   * Do not call from inside the class
   * @param {1 | -1} d
   */
  update_pending_count(e) {
    bt(this, vt, ui).call(this, e), J(this, Ke, p(this, Ke) + e), !(!p(this, pe) || p(this, Mn)) && (J(this, Mn, !0), Fe(() => {
      J(this, Mn, !1), p(this, pe) && Cn(p(this, pe), p(this, Ke));
    }));
  }
  get_effect_pending() {
    return p(this, Hr).call(this), l(
      /** @type {Source<number>} */
      p(this, pe)
    );
  }
  /** @param {unknown} error */
  error(e) {
    var n = p(this, ie).onerror;
    let r = p(this, ie).failed;
    if (p(this, Ze) || !n && !r)
      throw e;
    p(this, Ut) && (Lt(p(this, Ut)), J(this, Ut, null)), p(this, At) && (Lt(p(this, At)), J(this, At, null)), p(this, se) && (Lt(p(this, se)), J(this, se, null));
    var i = !1, o = !1;
    const s = () => {
      if (i) {
        Za();
        return;
      }
      i = !0, o && Ka(), Oe.ensure(), J(this, Ke, 0), p(this, se) !== null && Qe(p(this, se), () => {
        J(this, se, null);
      }), this.is_pending = this.has_pending_snippet(), J(this, Ut, bt(this, vt, wr).call(this, () => (J(this, Ze, !1), qt(() => p(this, We).call(this, p(this, Xt)))))), p(this, Ce) > 0 ? bt(this, vt, xr).call(this) : this.is_pending = !1;
    };
    var a = j;
    try {
      Ct(null), o = !0, n == null || n(e, s), o = !1;
    } catch (u) {
      zn(u, p(this, oe) && p(this, oe).parent);
    } finally {
      Ct(a);
    }
    r && Fe(() => {
      J(this, se, bt(this, vt, wr).call(this, () => {
        Oe.ensure(), J(this, Ze, !0);
        try {
          return qt(() => {
            r(
              p(this, Xt),
              () => e,
              () => s
            );
          });
        } catch (u) {
          return zn(
            u,
            /** @type {Effect} */
            p(this, oe).parent
          ), null;
        } finally {
          J(this, Ze, !1);
        }
      }));
    });
  }
}
Xt = new WeakMap(), Si = new WeakMap(), ie = new WeakMap(), We = new WeakMap(), oe = new WeakMap(), Ut = new WeakMap(), At = new WeakMap(), se = new WeakMap(), _e = new WeakMap(), ze = new WeakMap(), Ke = new WeakMap(), Ce = new WeakMap(), Mn = new WeakMap(), Ze = new WeakMap(), An = new WeakMap(), In = new WeakMap(), pe = new WeakMap(), Hr = new WeakMap(), vt = new WeakSet(), sl = function() {
  try {
    J(this, Ut, qt(() => p(this, We).call(this, p(this, Xt))));
  } catch (e) {
    this.error(e);
  }
}, al = function() {
  const e = p(this, ie).pending;
  e && (J(this, At, qt(() => e(p(this, Xt)))), Fe(() => {
    var n = bt(this, vt, li).call(this);
    J(this, Ut, bt(this, vt, wr).call(this, () => (Oe.ensure(), qt(() => p(this, We).call(this, n))))), p(this, Ce) > 0 ? bt(this, vt, xr).call(this) : (Qe(
      /** @type {Effect} */
      p(this, At),
      () => {
        J(this, At, null);
      }
    ), this.is_pending = !1);
  }));
}, li = function() {
  var e = p(this, Xt);
  return this.is_pending && (J(this, ze, nn()), p(this, Xt).before(p(this, ze)), e = p(this, ze)), e;
}, /**
 * @param {() => Effect | null} fn
 */
wr = function(e) {
  var n = rt, r = j, i = Kt;
  ue(p(this, oe)), Ct(p(this, oe)), Tn(p(this, oe).ctx);
  try {
    return e();
  } catch (o) {
    return Zo(o), null;
  } finally {
    ue(n), Ct(r), Tn(i);
  }
}, xr = function() {
  const e = (
    /** @type {(anchor: Node) => void} */
    p(this, ie).pending
  );
  p(this, Ut) !== null && (J(this, _e, document.createDocumentFragment()), p(this, _e).append(
    /** @type {TemplateNode} */
    p(this, ze)
  ), ys(p(this, Ut), p(this, _e))), p(this, At) === null && J(this, At, qt(() => e(p(this, Xt))));
}, /**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
ui = function(e) {
  var n;
  if (!this.has_pending_snippet()) {
    this.parent && bt(n = this.parent, vt, ui).call(n, e);
    return;
  }
  if (J(this, Ce, p(this, Ce) + e), p(this, Ce) === 0) {
    this.is_pending = !1;
    for (const r of p(this, An))
      mt(r, Nt), xe(r);
    for (const r of p(this, In))
      mt(r, Se), xe(r);
    p(this, An).clear(), p(this, In).clear(), p(this, At) && Qe(p(this, At), () => {
      J(this, At, null);
    }), p(this, _e) && (p(this, Xt).before(p(this, _e)), J(this, _e, null));
  }
};
function ll(t, e, n, r) {
  const i = Ur;
  var o = t.filter((h) => !h.settled);
  if (n.length === 0 && o.length === 0) {
    r(e.map(i));
    return;
  }
  var s = st, a = (
    /** @type {Effect} */
    rt
  ), u = ul(), f = o.length === 1 ? o[0].promise : o.length > 1 ? Promise.all(o.map((h) => h.promise)) : null;
  function c(h) {
    u();
    try {
      r(h);
    } catch (g) {
      (a.f & we) === 0 && zn(g, a);
    }
    s == null || s.deactivate(), fi();
  }
  if (n.length === 0) {
    f.then(() => c(e.map(i)));
    return;
  }
  function d() {
    u(), Promise.all(n.map((h) => /* @__PURE__ */ fl(h))).then((h) => c([...e.map(i), ...h])).catch((h) => zn(h, a));
  }
  f ? f.then(d) : d();
}
function ul() {
  var t = rt, e = j, n = Kt, r = st;
  return function(o = !0) {
    ue(t), Ct(e), Tn(n), o && (r == null || r.activate());
  };
}
function fi() {
  ue(null), Ct(null), Tn(null);
}
// @__NO_SIDE_EFFECTS__
function Ur(t) {
  var e = xt | Nt, n = j !== null && (j.f & xt) !== 0 ? (
    /** @type {Derived} */
    j
  ) : null;
  return rt !== null && (rt.f |= Fn), {
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
      _t
    ),
    wv: 0,
    parent: n ?? rt,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function fl(t, e, n) {
  let r = (
    /** @type {Effect | null} */
    rt
  );
  r === null && Ya();
  var i = (
    /** @type {Boundary} */
    r.b
  ), o = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  ), s = en(
    /** @type {V} */
    _t
  ), a = !j, u = /* @__PURE__ */ new Map();
  return wl(() => {
    var g;
    var f = Xo();
    o = f.promise;
    try {
      Promise.resolve(t()).then(f.resolve, f.reject).then(() => {
        c === st && c.committed && c.deactivate(), fi();
      });
    } catch (_) {
      f.reject(_), fi();
    }
    var c = (
      /** @type {Batch} */
      st
    );
    if (a) {
      var d = i.is_rendered();
      i.update_pending_count(1), c.increment(d), (g = u.get(c)) == null || g.reject(mn), u.delete(c), u.set(c, f);
    }
    const h = (_, x = void 0) => {
      if (c.activate(), x)
        x !== mn && (s.f |= Le, Cn(s, x));
      else {
        (s.f & Le) !== 0 && (s.f ^= Le), Cn(s, _);
        for (const [T, E] of u) {
          if (u.delete(T), T === c) break;
          E.reject(mn);
        }
      }
      a && (i.update_pending_count(-1), c.decrement(d));
    };
    f.promise.then(h, (_) => h(null, _ || "unknown"));
  }), fs(() => {
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
function D(t) {
  const e = /* @__PURE__ */ Ur(t);
  return ws(e), e;
}
// @__NO_SIDE_EFFECTS__
function es(t) {
  const e = /* @__PURE__ */ Ur(t);
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
function cl(t) {
  for (var e = t.parent; e !== null; ) {
    if ((e.f & xt) === 0)
      return (e.f & we) === 0 ? (
        /** @type {Effect} */
        e
      ) : null;
    e = e.parent;
  }
  return null;
}
function Ti(t) {
  var e, n = rt;
  ue(cl(t));
  try {
    t.f &= ~tn, ns(t), e = Es(t);
  } finally {
    ue(n);
  }
  return e;
}
function rs(t) {
  var e = Ti(t);
  if (!t.equals(e) && (t.wv = bs(), (!(st != null && st.is_fork) || t.deps === null) && (t.v = e, t.deps === null))) {
    mt(t, kt);
    return;
  }
  Ye || (yt !== null ? (Ci() || st != null && st.is_fork) && yt.set(t, e) : Ii(t));
}
let ci = /* @__PURE__ */ new Set();
const De = /* @__PURE__ */ new Map();
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
function ht(t, e) {
  const n = en(t);
  return ws(n), n;
}
// @__NO_SIDE_EFFECTS__
function hl(t, e = !1, n = !0) {
  const r = en(t);
  return e || (r.equals = Wo), r;
}
function X(t, e, n = !1) {
  j !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!te || (j.f & Qi) !== 0) && Ko() && (j.f & (xt | ke | Ai | Qi)) !== 0 && !(St != null && St.includes(t)) && Wa();
  let r = n ? Tt(e) : e;
  return Cn(t, r);
}
function Cn(t, e) {
  if (!t.equals(e)) {
    var n = t.v;
    Ye ? De.set(t, e) : De.set(t, n), t.v = e;
    var r = Oe.ensure();
    if (r.capture(t, n), (t.f & xt) !== 0) {
      const i = (
        /** @type {Derived} */
        t
      );
      (t.f & Nt) !== 0 && Ti(i), Ii(i);
    }
    t.wv = bs(), os(t, Nt), rt !== null && (rt.f & kt) !== 0 && (rt.f & (Ee | sn)) === 0 && (Vt === null ? bl([t]) : Vt.push(t)), !r.is_fork && ci.size > 0 && !is && dl();
  }
  return e;
}
function dl() {
  is = !1;
  for (const t of ci)
    (t.f & kt) !== 0 && mt(t, Se), ar(t) && Kn(t);
  ci.clear();
}
function Gn(t) {
  X(t, t.v + 1);
}
function os(t, e) {
  var n = t.reactions;
  if (n !== null)
    for (var r = n.length, i = 0; i < r; i++) {
      var o = n[i], s = o.f, a = (s & Nt) === 0;
      if (a && mt(o, e), (s & xt) !== 0) {
        var u = (
          /** @type {Derived} */
          o
        );
        yt == null || yt.delete(u), (s & tn) === 0 && (s & Wt && (o.f |= tn), os(u, Se));
      } else a && ((s & ke) !== 0 && Jt !== null && Jt.add(
        /** @type {Effect} */
        o
      ), xe(
        /** @type {Effect} */
        o
      ));
    }
}
function Tt(t) {
  if (typeof t != "object" || t === null || qn in t)
    return t;
  const e = Vo(t);
  if (e !== Ca && e !== Ra)
    return t;
  var n = /* @__PURE__ */ new Map(), r = Bo(t), i = /* @__PURE__ */ ht(0), o = je, s = (a) => {
    if (je === o)
      return a();
    var u = j, f = je;
    Ct(null), eo(o);
    var c = a();
    return Ct(u), eo(f), c;
  };
  return r && n.set("length", /* @__PURE__ */ ht(
    /** @type {any[]} */
    t.length
  )), new Proxy(
    /** @type {any} */
    t,
    {
      defineProperty(a, u, f) {
        (!("value" in f) || f.configurable === !1 || f.enumerable === !1 || f.writable === !1) && qa();
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
            const c = s(() => /* @__PURE__ */ ht(_t));
            n.set(u, c), Gn(i);
          }
        } else
          X(f, _t), Gn(i);
        return !0;
      },
      get(a, u, f) {
        var g;
        if (u === qn)
          return t;
        var c = n.get(u), d = u in a;
        if (c === void 0 && (!d || (g = pn(a, u)) != null && g.writable) && (c = s(() => {
          var _ = Tt(d ? a[u] : _t), x = /* @__PURE__ */ ht(_);
          return x;
        }), n.set(u, c)), c !== void 0) {
          var h = l(c);
          return h === _t ? void 0 : h;
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
          if (d !== void 0 && h !== _t)
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
        var f = n.get(u), c = f !== void 0 && f.v !== _t || Reflect.has(a, u);
        if (f !== void 0 || rt !== null && (!c || (h = pn(a, u)) != null && h.writable)) {
          f === void 0 && (f = s(() => {
            var g = c ? Tt(a[u]) : _t, _ = /* @__PURE__ */ ht(g);
            return _;
          }), n.set(u, f));
          var d = l(f);
          if (d === _t)
            return !1;
        }
        return c;
      },
      set(a, u, f, c) {
        var I;
        var d = n.get(u), h = u in a;
        if (r && u === "length")
          for (var g = f; g < /** @type {Source<number>} */
          d.v; g += 1) {
            var _ = n.get(g + "");
            _ !== void 0 ? X(_, _t) : g in a && (_ = s(() => /* @__PURE__ */ ht(_t)), n.set(g + "", _));
          }
        if (d === void 0)
          (!h || (I = pn(a, u)) != null && I.writable) && (d = s(() => /* @__PURE__ */ ht(void 0)), X(d, Tt(f)), n.set(u, d));
        else {
          h = d.v !== _t;
          var x = s(() => Tt(f));
          X(d, x);
        }
        var T = Reflect.getOwnPropertyDescriptor(a, u);
        if (T != null && T.set && T.set.call(c, f), !h) {
          if (r && typeof u == "string") {
            var E = (
              /** @type {Source<number>} */
              n.get("length")
            ), B = Number(u);
            Number.isInteger(B) && B >= E.v && X(E, B + 1);
          }
          Gn(i);
        }
        return !0;
      },
      ownKeys(a) {
        l(i);
        var u = Reflect.ownKeys(a).filter((d) => {
          var h = n.get(d);
          return h === void 0 || h.v !== _t;
        });
        for (var [f, c] of n)
          c.v !== _t && !(f in a) && u.push(f);
        return u;
      },
      setPrototypeOf() {
        Ga();
      }
    }
  );
}
var $i, ss, as, ls;
function gl() {
  if ($i === void 0) {
    $i = window, ss = /Firefox/.test(navigator.userAgent);
    var t = Element.prototype, e = Node.prototype, n = Text.prototype;
    as = pn(e, "firstChild").get, ls = pn(e, "nextSibling").get, Ji(t) && (t.__click = void 0, t.__className = void 0, t.__attributes = null, t.__style = void 0, t.__e = void 0), Ji(n) && (n.__t = void 0);
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
function sr(t) {
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
function vl(t) {
  t.textContent = "";
}
function us() {
  return !1;
}
function zi(t) {
  var e = j, n = rt;
  Ct(null), ue(null);
  try {
    return t();
  } finally {
    Ct(e), ue(n);
  }
}
function ml(t) {
  rt === null && (j === null && Va(), Ba()), Ye && Ha();
}
function _l(t, e) {
  var n = e.last;
  n === null ? e.last = e.first = t : (n.next = t, t.prev = n, e.last = t);
}
function Ne(t, e, n) {
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
      Kn(i), i.f |= Mi;
    } catch (a) {
      throw Lt(i), a;
    }
  else e !== null && xe(i);
  var o = i;
  if (n && o.deps === null && o.teardown === null && o.nodes === null && o.first === o.last && // either `null`, or a singular child
  (o.f & Fn) === 0 && (o = o.first, (t & ke) !== 0 && (t & Pn) !== 0 && o !== null && (o.f |= Pn)), o !== null && (o.parent = r, r !== null && _l(o, r), j !== null && (j.f & xt) !== 0 && (t & sn) === 0)) {
    var s = (
      /** @type {Derived} */
      j
    );
    (s.effects ?? (s.effects = [])).push(o);
  }
  return i;
}
function Ci() {
  return j !== null && !te;
}
function fs(t) {
  const e = Ne(Xr, null, !1);
  return mt(e, kt), e.teardown = t, e;
}
function Ir(t) {
  ml();
  var e = (
    /** @type {Effect} */
    rt.f
  ), n = !j && (e & Ee) !== 0 && (e & Mi) === 0;
  if (n) {
    var r = (
      /** @type {ComponentContext} */
      Kt
    );
    (r.e ?? (r.e = [])).push(t);
  } else
    return cs(t);
}
function cs(t) {
  return Ne(Ar | Fa, t, !1);
}
function pl(t) {
  Oe.ensure();
  const e = Ne(sn | Fn, t, !0);
  return (n = {}) => new Promise((r) => {
    n.outro ? Qe(e, () => {
      Lt(e), r(void 0);
    }) : (Lt(e), r(void 0));
  });
}
function yl(t) {
  return Ne(Ar, t, !1);
}
function wl(t) {
  return Ne(Ai | Fn, t, !0);
}
function hs(t, e = 0) {
  return Ne(Xr | e, t, !0);
}
function at(t, e = [], n = [], r = []) {
  ll(r, e, n, (i) => {
    Ne(Xr, () => t(...i.map(l)), !0);
  });
}
function Ri(t, e = 0) {
  var n = Ne(ke | e, t, !0);
  return n;
}
function qt(t) {
  return Ne(Ee | Fn, t, !0);
}
function ds(t) {
  var e = t.teardown;
  if (e !== null) {
    const n = Ye, r = j;
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
    i !== null && zi(() => {
      i.abort(mn);
    });
    var r = n.next;
    (n.f & sn) !== 0 ? n.parent = null : Lt(n, e), n = r;
  }
}
function xl(t) {
  for (var e = t.first; e !== null; ) {
    var n = e.next;
    (e.f & Ee) === 0 && Lt(e), e = n;
  }
}
function Lt(t, e = !0) {
  var n = !1;
  (e || (t.f & qo) !== 0) && t.nodes !== null && t.nodes.end !== null && (vs(
    t.nodes.start,
    /** @type {TemplateNode} */
    t.nodes.end
  ), n = !0), gs(t, e && !n), Pr(t, 0), mt(t, we);
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
    var n = t === e ? null : /* @__PURE__ */ sr(t);
    t.remove(), t = n;
  }
}
function ms(t) {
  var e = t.parent, n = t.prev, r = t.next;
  n !== null && (n.next = r), r !== null && (r.prev = n), e !== null && (e.first === t && (e.first = r), e.last === t && (e.last = n));
}
function Qe(t, e, n = !0) {
  var r = [];
  _s(t, r, !0);
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
function _s(t, e, n) {
  if ((t.f & Ht) === 0) {
    t.f ^= Ht;
    var r = t.nodes && t.nodes.t;
    if (r !== null)
      for (const a of r)
        (a.is_global || n) && e.push(a);
    for (var i = t.first; i !== null; ) {
      var o = i.next, s = (i.f & Pn) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (i.f & Ee) !== 0 && (t.f & ke) !== 0;
      _s(i, e, s ? n : !1), i = o;
    }
  }
}
function Li(t) {
  ps(t, !0);
}
function ps(t, e) {
  if ((t.f & Ht) !== 0) {
    t.f ^= Ht, (t.f & kt) === 0 && (mt(t, Nt), xe(t));
    for (var n = t.first; n !== null; ) {
      var r = n.next, i = (n.f & Pn) !== 0 || (n.f & Ee) !== 0;
      ps(n, i ? e : !1), n = r;
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
      var i = n === r ? null : /* @__PURE__ */ sr(n);
      e.append(n), n = i;
    }
}
let br = !1, Ye = !1;
function to(t) {
  Ye = t;
}
let j = null, te = !1;
function Ct(t) {
  j = t;
}
let rt = null;
function ue(t) {
  rt = t;
}
let St = null;
function ws(t) {
  j !== null && (St === null ? St = [t] : St.push(t));
}
let Pt = null, Dt = 0, Vt = null;
function bl(t) {
  Vt = t;
}
let xs = 1, Ue = 0, je = Ue;
function eo(t) {
  je = t;
}
function bs() {
  return ++xs;
}
function ar(t) {
  var e = t.f;
  if ((e & Nt) !== 0)
    return !0;
  if (e & xt && (t.f &= ~tn), (e & Se) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      t.deps
    ), r = n.length, i = 0; i < r; i++) {
      var o = n[i];
      if (ar(
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
    yt === null && mt(t, kt);
  }
  return !1;
}
function ks(t, e, n = !0) {
  var r = t.reactions;
  if (r !== null && !(St != null && St.includes(t)))
    for (var i = 0; i < r.length; i++) {
      var o = r[i];
      (o.f & xt) !== 0 ? ks(
        /** @type {Derived} */
        o,
        e,
        !1
      ) : e === o && (n ? mt(o, Nt) : (o.f & kt) !== 0 && mt(o, Se), xe(
        /** @type {Effect} */
        o
      ));
    }
}
function Es(t) {
  var _;
  var e = Pt, n = Dt, r = Vt, i = j, o = St, s = Kt, a = te, u = je, f = t.f;
  Pt = /** @type {null | Value[]} */
  null, Dt = 0, Vt = null, j = (f & (Ee | sn)) === 0 ? t : null, St = null, Tn(t.ctx), te = !1, je = ++Ue, t.ac !== null && (zi(() => {
    t.ac.abort(mn);
  }), t.ac = null);
  try {
    t.f |= ii;
    var c = (
      /** @type {Function} */
      t.fn
    ), d = c(), h = t.deps;
    if (Pt !== null) {
      var g;
      if (Pr(t, Dt), h !== null && Dt > 0)
        for (h.length = Dt + Pt.length, g = 0; g < Pt.length; g++)
          h[Dt + g] = Pt[g];
      else
        t.deps = h = Pt;
      if (Ci() && (t.f & Wt) !== 0)
        for (g = Dt; g < h.length; g++)
          ((_ = h[g]).reactions ?? (_.reactions = [])).push(t);
    } else h !== null && Dt < h.length && (Pr(t, Dt), h.length = Dt);
    if (Ko() && Vt !== null && !te && h !== null && (t.f & (xt | Se | Nt)) === 0)
      for (g = 0; g < /** @type {Source[]} */
      Vt.length; g++)
        ks(
          Vt[g],
          /** @type {Effect} */
          t
        );
    if (i !== null && i !== t) {
      if (Ue++, i.deps !== null)
        for (let x = 0; x < n; x += 1)
          i.deps[x].rv = Ue;
      if (e !== null)
        for (const x of e)
          x.rv = Ue;
      Vt !== null && (r === null ? r = Vt : r.push(.../** @type {Source[]} */
      Vt));
    }
    return (t.f & Le) !== 0 && (t.f ^= Le), d;
  } catch (x) {
    return Zo(x);
  } finally {
    t.f ^= ii, Pt = e, Dt = n, Vt = r, j = i, St = o, Tn(s), te = a, je = u;
  }
}
function kl(t, e) {
  let n = e.reactions;
  if (n !== null) {
    var r = Pa.call(n, t);
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
    (o.f & Wt) !== 0 && (o.f ^= Wt, o.f &= ~tn), Ii(o), ns(o), Pr(o, 0);
  }
}
function Pr(t, e) {
  var n = t.deps;
  if (n !== null)
    for (var r = e; r < n.length; r++)
      kl(t, n[r]);
}
function Kn(t) {
  var e = t.f;
  if ((e & we) === 0) {
    mt(t, kt);
    var n = rt, r = br;
    rt = t, br = !0;
    try {
      (e & (ke | Uo)) !== 0 ? xl(t) : gs(t), ds(t);
      var i = Es(t);
      t.teardown = typeof i == "function" ? i : null, t.wv = xs;
      var o;
      ri && Qa && (t.f & Nt) !== 0 && t.deps;
    } finally {
      br = r, rt = n;
    }
  }
}
function l(t) {
  var e = t.f, n = (e & xt) !== 0;
  if (j !== null && !te) {
    var r = rt !== null && (rt.f & we) !== 0;
    if (!r && !(St != null && St.includes(t))) {
      var i = j.deps;
      if ((j.f & ii) !== 0)
        t.rv < Ue && (t.rv = Ue, Pt === null && i !== null && i[Dt] === t ? Dt++ : Pt === null ? Pt = [t] : Pt.push(t));
      else {
        (j.deps ?? (j.deps = [])).push(t);
        var o = t.reactions;
        o === null ? t.reactions = [j] : o.includes(j) || o.push(j);
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
      return ((s.f & kt) === 0 && s.reactions !== null || Ns(s)) && (a = Ti(s)), De.set(s, a), a;
    }
    var u = (s.f & Wt) === 0 && !te && j !== null && (br || (j.f & Wt) !== 0), f = s.deps === null;
    ar(s) && (u && (s.f |= Wt), rs(s)), u && !f && Ss(s);
  }
  if (yt != null && yt.has(t))
    return yt.get(t);
  if ((t.f & Le) !== 0)
    throw t.v;
  return t.v;
}
function Ss(t) {
  if (t.deps !== null) {
    t.f |= Wt;
    for (const e of t.deps)
      (e.reactions ?? (e.reactions = [])).push(t), (e.f & xt) !== 0 && (e.f & Wt) === 0 && Ss(
        /** @type {Derived} */
        e
      );
  }
}
function Ns(t) {
  if (t.v === _t) return !0;
  if (t.deps === null) return !1;
  for (const e of t.deps)
    if (De.has(e) || (e.f & xt) !== 0 && Ns(
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
const Ms = /* @__PURE__ */ new Set(), hi = /* @__PURE__ */ new Set();
function El(t, e, n, r = {}) {
  function i(o) {
    if (r.capture || Bn.call(e, o), !o.cancelBubble)
      return zi(() => n == null ? void 0 : n.call(this, o));
  }
  return t.startsWith("pointer") || t.startsWith("touch") || t === "wheel" ? Fe(() => {
    e.addEventListener(t, i, r);
  }) : e.addEventListener(t, i, r), i;
}
function Pe(t, e, n, r, i) {
  var o = { capture: r, passive: i }, s = El(t, e, n, o);
  (e === document.body || // @ts-ignore
  e === window || // @ts-ignore
  e === document || // Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
  e instanceof HTMLMediaElement) && fs(() => {
    e.removeEventListener(t, s, o);
  });
}
function lr(t) {
  for (var e = 0; e < t.length; e++)
    Ms.add(t[e]);
  for (var n of hi)
    n(t);
}
let no = null;
function Bn(t) {
  var T;
  var e = this, n = (
    /** @type {Node} */
    e.ownerDocument
  ), r = t.type, i = ((T = t.composedPath) == null ? void 0 : T.call(t)) || [], o = (
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
    var f = i.indexOf(e);
    if (f === -1)
      return;
    u <= f && (s = u);
  }
  if (o = /** @type {Element} */
  i[s] || t.target, o !== e) {
    Ta(t, "currentTarget", {
      configurable: !0,
      get() {
        return o || n;
      }
    });
    var c = j, d = rt;
    Ct(null), ue(null);
    try {
      for (var h, g = []; o !== null; ) {
        var _ = o.assignedSlot || o.parentNode || /** @type {any} */
        o.host || null;
        try {
          var x = o["__" + r];
          x != null && (!/** @type {any} */
          o.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
          // -> the target could not have been disabled because it emits the event in the first place
          t.target === o) && x.call(o, t);
        } catch (E) {
          h ? g.push(E) : h = E;
        }
        if (t.cancelBubble || _ === e || _ === null)
          break;
        o = _;
      }
      if (h) {
        for (let E of g)
          queueMicrotask(() => {
            throw E;
          });
        throw h;
      }
    } finally {
      t.__root = e, delete t.currentTarget, Ct(c), ue(d);
    }
  }
}
function Oi(t) {
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
function Sl(t, e) {
  var n = (e & 2) !== 0, r, i = !t.startsWith("<!>");
  return () => {
    r === void 0 && (r = Oi(i ? t : "<!>" + t), r = /** @type {TemplateNode} */
    /* @__PURE__ */ Gt(r));
    var o = (
      /** @type {TemplateNode} */
      n || ss ? document.importNode(r, !0) : r.cloneNode(!0)
    );
    return Zn(o, o), o;
  };
}
// @__NO_SIDE_EFFECTS__
function Nl(t, e, n = "svg") {
  var r = !t.startsWith("<!>"), i = (e & 1) !== 0, o = `<${n}>${r ? t : "<!>" + t}</${n}>`, s;
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
function lt(t, e) {
  return /* @__PURE__ */ Nl(t, e, "svg");
}
function ve() {
  var t = document.createDocumentFragment(), e = document.createComment(""), n = nn();
  return t.append(e, n), Zn(e, n), t;
}
function tt(t, e) {
  t !== null && t.before(
    /** @type {Node} */
    e
  );
}
const Ml = ["touchstart", "touchmove"];
function Al(t) {
  return Ml.includes(t);
}
function Jn(t, e) {
  var n = e == null ? "" : typeof e == "object" ? e + "" : e;
  n !== (t.__t ?? (t.__t = t.nodeValue)) && (t.__t = n, t.nodeValue = n + "");
}
function Il(t, e) {
  return Pl(t, e);
}
const gn = /* @__PURE__ */ new Map();
function Pl(t, { target: e, anchor: n, props: r = {}, events: i, context: o, intro: s = !0 }) {
  gl();
  var a = /* @__PURE__ */ new Set(), u = (d) => {
    for (var h = 0; h < d.length; h++) {
      var g = d[h];
      if (!a.has(g)) {
        a.add(g);
        var _ = Al(g);
        e.addEventListener(g, Bn, { passive: _ });
        var x = gn.get(g);
        x === void 0 ? (document.addEventListener(g, Bn, { passive: _ }), gn.set(g, 1)) : gn.set(g, x + 1);
      }
    }
  };
  u(Vr(Ms)), hi.add(u);
  var f = void 0, c = pl(() => {
    var d = n ?? e.appendChild(nn());
    return il(
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
      var _;
      for (var h of a) {
        e.removeEventListener(h, Bn);
        var g = (
          /** @type {number} */
          gn.get(h)
        );
        --g === 0 ? (document.removeEventListener(h, Bn), gn.delete(h)) : gn.set(h, g);
      }
      hi.delete(u), d !== n && ((_ = d.parentNode) == null || _.removeChild(d));
    };
  });
  return di.set(f, c), f;
}
let di = /* @__PURE__ */ new WeakMap();
function ro(t, e) {
  const n = di.get(t);
  return n ? (di.delete(t), n(e)) : Promise.resolve();
}
var jt, ae, Yt, Je, ir, or, Br;
class Tl {
  /**
   * @param {TemplateNode} anchor
   * @param {boolean} transition
   */
  constructor(e, n = !0) {
    /** @type {TemplateNode} */
    Ot(this, "anchor");
    /** @type {Map<Batch, Key>} */
    $(this, jt, /* @__PURE__ */ new Map());
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
    $(this, Yt, /* @__PURE__ */ new Map());
    /**
     * Keys of effects that are currently outroing
     * @type {Set<Key>}
     */
    $(this, Je, /* @__PURE__ */ new Set());
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
      if (p(this, jt).has(e)) {
        var n = (
          /** @type {Key} */
          p(this, jt).get(e)
        ), r = p(this, ae).get(n);
        if (r)
          Li(r), p(this, Je).delete(n);
        else {
          var i = p(this, Yt).get(n);
          i && (p(this, ae).set(n, i.effect), p(this, Yt).delete(n), i.fragment.lastChild.remove(), this.anchor.before(i.fragment), r = i.effect);
        }
        for (const [o, s] of p(this, jt)) {
          if (p(this, jt).delete(o), o === e)
            break;
          const a = p(this, Yt).get(s);
          a && (Lt(a.effect), p(this, Yt).delete(s));
        }
        for (const [o, s] of p(this, ae)) {
          if (o === n || p(this, Je).has(o)) continue;
          const a = () => {
            if (Array.from(p(this, jt).values()).includes(o)) {
              var f = document.createDocumentFragment();
              ys(s, f), f.append(nn()), p(this, Yt).set(o, { effect: s, fragment: f });
            } else
              Lt(s);
            p(this, Je).delete(o), p(this, ae).delete(o);
          };
          p(this, ir) || !r ? (p(this, Je).add(o), Qe(s, a, !1)) : a();
        }
      }
    });
    /**
     * @param {Batch} batch
     */
    $(this, Br, (e) => {
      p(this, jt).delete(e);
      const n = Array.from(p(this, jt).values());
      for (const [r, i] of p(this, Yt))
        n.includes(r) || (Lt(i.effect), p(this, Yt).delete(r));
    });
    this.anchor = e, J(this, ir, n);
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
    if (n && !p(this, ae).has(e) && !p(this, Yt).has(e))
      if (i) {
        var o = document.createDocumentFragment(), s = nn();
        o.append(s), p(this, Yt).set(e, {
          effect: qt(() => n(s)),
          fragment: o
        });
      } else
        p(this, ae).set(
          e,
          qt(() => n(this.anchor))
        );
    if (p(this, jt).set(r, e), i) {
      for (const [a, u] of p(this, ae))
        a === e ? r.skipped_effects.delete(u) : r.skipped_effects.add(u);
      for (const [a, u] of p(this, Yt))
        a === e ? r.skipped_effects.delete(u.effect) : r.skipped_effects.add(u.effect);
      r.oncommit(p(this, or)), r.ondiscard(p(this, Br));
    } else
      p(this, or).call(this);
  }
}
jt = new WeakMap(), ae = new WeakMap(), Yt = new WeakMap(), Je = new WeakMap(), ir = new WeakMap(), or = new WeakMap(), Br = new WeakMap();
function pt(t, e, n = !1) {
  var r = new Tl(t), i = n ? Pn : 0;
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
function zl(t, e, n) {
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
      var f = (
        /** @type {Element} */
        n
      ), c = (
        /** @type {Element} */
        f.parentNode
      );
      vl(c), c.append(f), t.items.clear();
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
  var s = t, a = /* @__PURE__ */ new Map(), u = null, f = /* @__PURE__ */ es(() => {
    var x = n();
    return Bo(x) ? x : x == null ? [] : Vr(x);
  }), c, d = !0;
  function h() {
    _.fallback = u, Cl(_, c, s, e, r), u !== null && (c.length === 0 ? (u.f & Re) === 0 ? Li(u) : (u.f ^= Re, Vn(u, null, s)) : Qe(u, () => {
      u = null;
    }));
  }
  var g = Ri(() => {
    c = /** @type {V[]} */
    l(f);
    for (var x = c.length, T = /* @__PURE__ */ new Set(), E = (
      /** @type {Batch} */
      st
    ), B = us(), I = 0; I < x; I += 1) {
      var y = c[I], P = r(y, I), b = d ? null : a.get(P);
      b ? (b.v && Cn(b.v, y), b.i && Cn(b.i, I), B && E.skipped_effects.delete(b.e)) : (b = Rl(
        a,
        d ? s : io ?? (io = nn()),
        y,
        P,
        I,
        i,
        e,
        n
      ), d || (b.e.f |= Re), a.set(P, b)), T.add(P);
    }
    if (x === 0 && o && !u && (d ? u = qt(() => o(s)) : (u = qt(() => o(io ?? (io = nn()))), u.f |= Re)), !d)
      if (B) {
        for (const [N, R] of a)
          T.has(N) || E.skipped_effects.add(R.e);
        E.oncommit(h), E.ondiscard(() => {
        });
      } else
        h();
    l(f);
  }), _ = { effect: g, items: a, outrogroups: null, fallback: u };
  d = !1;
}
function Cl(t, e, n, r, i) {
  var R;
  var o = e.length, s = t.items, a = t.effect.first, u, f = null, c = [], d = [], h, g, _, x;
  for (x = 0; x < o; x += 1) {
    if (h = e[x], g = i(h, x), _ = /** @type {EachItem} */
    s.get(g).e, t.outrogroups !== null)
      for (const H of t.outrogroups)
        H.pending.delete(_), H.done.delete(_);
    if ((_.f & Re) !== 0)
      if (_.f ^= Re, _ === a)
        Vn(_, null, n);
      else {
        var T = f ? f.next : a;
        _ === t.effect.last && (t.effect.last = _.prev), _.prev && (_.prev.next = _.next), _.next && (_.next.prev = _.prev), Ie(t, f, _), Ie(t, _, T), Vn(_, T, n), f = _, c = [], d = [], a = f.next;
        continue;
      }
    if ((_.f & Ht) !== 0 && Li(_), _ !== a) {
      if (u !== void 0 && u.has(_)) {
        if (c.length < d.length) {
          var E = d[0], B;
          f = E.prev;
          var I = c[0], y = c[c.length - 1];
          for (B = 0; B < c.length; B += 1)
            Vn(c[B], E, n);
          for (B = 0; B < d.length; B += 1)
            u.delete(d[B]);
          Ie(t, I.prev, y.next), Ie(t, f, I), Ie(t, y, E), a = E, f = y, x -= 1, c = [], d = [];
        } else
          u.delete(_), Vn(_, a, n), Ie(t, _.prev, _.next), Ie(t, _, f === null ? t.effect.first : f.next), Ie(t, f, _), f = _;
        continue;
      }
      for (c = [], d = []; a !== null && a !== _; )
        (u ?? (u = /* @__PURE__ */ new Set())).add(a), d.push(a), a = a.next;
      if (a === null)
        continue;
    }
    (_.f & Re) === 0 && c.push(_), f = _, a = _.next;
  }
  if (t.outrogroups !== null) {
    for (const H of t.outrogroups)
      H.pending.size === 0 && (gi(Vr(H.done)), (R = t.outrogroups) == null || R.delete(H));
    t.outrogroups.size === 0 && (t.outrogroups = null);
  }
  if (a !== null || u !== void 0) {
    var P = [];
    if (u !== void 0)
      for (_ of u)
        (_.f & Ht) === 0 && P.push(_);
    for (; a !== null; )
      (a.f & Ht) === 0 && a !== t.fallback && P.push(a), a = a.next;
    var b = P.length;
    if (b > 0) {
      var N = null;
      zl(t, P, N);
    }
  }
}
function Rl(t, e, n, r, i, o, s, a) {
  var u = (s & 1) !== 0 ? (s & 16) === 0 ? /* @__PURE__ */ hl(n, !1, !1) : en(n) : null, f = (s & 2) !== 0 ? en(i) : null;
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
function Ie(t, e, n) {
  e === null ? t.effect.first = n : e.next = n, n === null ? t.effect.last = e : n.prev = e;
}
function Is(t, e, n = !1, r = !1, i = !1) {
  var o = t, s = "";
  at(() => {
    var a = (
      /** @type {Effect} */
      rt
    );
    if (s !== (s = e() ?? "") && (a.nodes !== null && (vs(
      a.nodes.start,
      /** @type {TemplateNode} */
      a.nodes.end
    ), a.nodes = null), s !== "")) {
      var u = s + "";
      n ? u = `<svg>${u}</svg>` : r && (u = `<math>${u}</math>`);
      var f = Oi(u);
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
function Ps(t) {
  var e, n, r = "";
  if (typeof t == "string" || typeof t == "number") r += t;
  else if (typeof t == "object") if (Array.isArray(t)) {
    var i = t.length;
    for (e = 0; e < i; e++) t[e] && (n = Ps(t[e])) && (r && (r += " "), r += n);
  } else for (n in t) t[n] && (r && (r += " "), r += n);
  return r;
}
function Ll() {
  for (var t, e, n = 0, r = "", i = arguments.length; n < i; n++) (t = arguments[n]) && (e = Ps(t)) && (r && (r += " "), r += e);
  return r;
}
function Fl(t) {
  return typeof t == "object" ? Ll(t) : t ?? "";
}
const oo = [...` 	
\r\f \v\uFEFF`];
function Ol(t, e, n) {
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
function Dl(t, e) {
  return t == null ? null : String(t);
}
function Di(t, e, n, r, i, o) {
  var s = t.__className;
  if (s !== n || s === void 0) {
    var a = Ol(n, r, o);
    a == null ? t.removeAttribute("class") : t.setAttribute("class", a), t.__className = n;
  } else if (o && i !== o)
    for (var u in o) {
      var f = !!o[u];
      (i == null || f !== !!i[u]) && t.classList.toggle(u, f);
    }
  return o;
}
function Yl(t, e, n, r) {
  var i = t.__style;
  if (i !== e) {
    var o = Dl(e);
    o == null ? t.removeAttribute("style") : t.style.cssText = o, t.__style = e;
  }
  return r;
}
const Hl = Symbol("is custom element"), Bl = Symbol("is html");
function v(t, e, n, r) {
  var i = Vl(t);
  i[e] !== (i[e] = n) && (e === "loading" && (t[Da] = n), n == null ? t.removeAttribute(e) : typeof n != "string" && Xl(t).includes(e) ? t[e] = n : t.setAttribute(e, n));
}
function Vl(t) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    t.__attributes ?? (t.__attributes = {
      [Hl]: t.nodeName.includes("-"),
      [Bl]: t.namespaceURI === Ia
    })
  );
}
var so = /* @__PURE__ */ new Map();
function Xl(t) {
  var e = t.getAttribute("is") || t.nodeName, n = so.get(e);
  if (n) return n;
  so.set(e, n = []);
  for (var r, i = t, o = Element.prototype; o !== i; ) {
    r = za(i);
    for (var s in r)
      r[s].set && n.push(s);
    i = Vo(i);
  }
  return n;
}
function ao(t, e) {
  return t === e || (t == null ? void 0 : t[qn]) === e;
}
function lo(t = {}, e, n, r) {
  return yl(() => {
    var i, o;
    return hs(() => {
      i = o, o = [], Fi(() => {
        t !== n(...o) && (e(t, ...o), i && ao(n(...i), t) && e(null, ...i));
      });
    }), () => {
      Fe(() => {
        o && ao(n(...o), t) && e(null, ...o);
      });
    };
  }), t;
}
let dr = !1;
function Ul(t) {
  var e = dr;
  try {
    return dr = !1, [t(), dr];
  } finally {
    dr = e;
  }
}
function wt(t, e, n, r) {
  var B;
  var i = (n & 8) !== 0, o = (n & 16) !== 0, s = (
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
    var c = qn in t || Oa in t;
    f = ((B = pn(t, e)) == null ? void 0 : B.set) ?? (c && e in t ? (I) => t[e] = I : void 0);
  }
  var d, h = !1;
  i ? [d, h] = Ul(() => (
    /** @type {V} */
    t[e]
  )) : d = /** @type {V} */
  t[e], d === void 0 && r !== void 0 && (d = u(), f && (Ua(), f(d)));
  var g;
  if (g = () => {
    var I = (
      /** @type {V} */
      t[e]
    );
    return I === void 0 ? u() : (a = !0, I);
  }, (n & 4) === 0)
    return g;
  if (f) {
    var _ = t.$$legacy;
    return (
      /** @type {() => V} */
      (function(I, y) {
        return arguments.length > 0 ? ((!y || _ || h) && f(y ? g() : I), I) : g();
      })
    );
  }
  var x = !1, T = ((n & 1) !== 0 ? Ur : es)(() => (x = !1, g()));
  i && l(T);
  var E = (
    /** @type {Effect} */
    rt
  );
  return (
    /** @type {() => V} */
    (function(I, y) {
      if (arguments.length > 0) {
        const P = y ? l(T) : i ? Tt(I) : I;
        return X(T, P), x = !0, s !== void 0 && (s = P), I;
      }
      return Ye && x || (E.f & we) !== 0 ? T.v : l(T);
    })
  );
}
const ql = "5";
var Ho;
typeof window < "u" && ((Ho = window.__svelte ?? (window.__svelte = {})).v ?? (Ho.v = /* @__PURE__ */ new Set())).add(ql);
const Gl = [
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
Gl.map(([t, e]) => [t.slice().sort((n, r) => r.length - n.length), e]);
const Wl = 40, Kl = 8, Qr = 16, Zl = 5.5;
var et;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(et || (et = {}));
const Jl = {
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
}, Ql = {
  [et.Router]: "router",
  [et.L3Switch]: "l3-switch",
  [et.L2Switch]: "l2-switch",
  [et.Firewall]: "firewall",
  [et.LoadBalancer]: "load-balancer",
  [et.Server]: "server",
  [et.AccessPoint]: "access-point",
  [et.CPE]: "cpe",
  [et.Cloud]: "cloud",
  [et.Internet]: "internet",
  [et.VPN]: "vpn",
  [et.Database]: "database",
  [et.Generic]: "generic"
};
function jl(t) {
  if (!t)
    return;
  const e = Ql[t];
  if (e)
    return Jl[e];
}
function $l(t) {
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
const tu = 1, Ts = 2, eu = 4, nu = 8;
function ru(t) {
  switch (t) {
    case "top":
      return tu;
    case "bottom":
      return Ts;
    case "left":
      return eu;
    case "right":
      return nu;
  }
}
function Tr(t) {
  return typeof t == "string" ? t : t.node;
}
function zr(t) {
  return typeof t == "string" ? void 0 : t.port;
}
function uo(t) {
  return typeof t == "string" ? { node: t } : t;
}
function iu(t, e, n, r = 2) {
  for (const i of n.values()) {
    const o = i.size.width / 2 + r, s = i.size.height / 2 + r;
    if (t > i.position.x - o && t < i.position.x + o && e > i.position.y - s && e < i.position.y + s)
      return !0;
  }
  return !1;
}
let jr = null;
async function ou() {
  if (!jr) {
    const { AvoidLib: t } = await import("./index-Cx45Ndi2.js");
    typeof window < "u" ? await t.load(`${window.location.origin}/libavoid.wasm`) : process.env.LIBAVOID_WASM_PATH ? await t.load(process.env.LIBAVOID_WASM_PATH) : await t.load(), jr = t.getInstance();
  }
  return jr;
}
async function Wn(t, e, n, r) {
  const i = await ou(), o = {
    edgeStyle: "orthogonal",
    shapeBufferDistance: 10,
    idealNudgingDistance: 20,
    ...r
  }, s = o.edgeStyle === "polyline" ? i.RouterFlag.PolyLineRouting.value : i.RouterFlag.OrthogonalRouting.value, a = new i.Router(s);
  a.setRoutingParameter(i.RoutingParameter.shapeBufferDistance.value, o.shapeBufferDistance), a.setRoutingParameter(i.RoutingParameter.idealNudgingDistance.value, o.idealNudgingDistance), a.setRoutingParameter(i.RoutingParameter.reverseDirectionPenalty.value, 500), a.setRoutingParameter(i.RoutingParameter.segmentPenalty.value, 50), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes.value, !0), a.setRoutingOption(i.RoutingOption.nudgeOrthogonalTouchingColinearSegments.value, !0), a.setRoutingOption(i.RoutingOption.performUnifyingNudgingPreprocessingStep.value, !0), a.setRoutingOption(i.RoutingOption.nudgeSharedPathsWithCommonEndPoint.value, !0);
  try {
    return fu(i, a, t, e, n, o.edgeStyle, o.shapeBufferDistance);
  } finally {
    a.delete();
  }
}
function su(t, e, n) {
  const r = /* @__PURE__ */ new Map();
  for (const [i, o] of n)
    r.set(i, new t.ShapeRef(e, new t.Rectangle(new t.Point(o.position.x, o.position.y), o.size.width, o.size.height)));
  return r;
}
function au(t, e, n, r) {
  const i = /* @__PURE__ */ new Map();
  let o = 1;
  for (const [s, a] of r) {
    const u = e.get(a.nodeId), f = n.get(a.nodeId);
    if (!u || !f)
      continue;
    const c = o++;
    i.set(s, c);
    const d = (a.absolutePosition.x - (f.position.x - f.size.width / 2)) / f.size.width, h = (a.absolutePosition.y - (f.position.y - f.size.height / 2)) / f.size.height, g = a.side === "top" || a.side === "bottom" ? Ts : ru(a.side);
    new t.ShapeConnectionPin(u, c, Math.max(0, Math.min(1, d)), Math.max(0, Math.min(1, h)), !0, 0, g).setExclusive(!1);
  }
  return i;
}
function lu(t, e, n, r, i, o, s, a) {
  const u = /* @__PURE__ */ new Map();
  for (const [f, c] of s.entries()) {
    const d = c.id ?? `__link_${f}`, h = Tr(c.from), g = Tr(c.to);
    if (!n.has(h) || !n.has(g))
      continue;
    const _ = zr(c.from), x = zr(c.to), T = _ ? `${h}:${_}` : null, E = x ? `${g}:${x}` : null, B = T ? r.get(T) : void 0;
    let I;
    if (B !== void 0)
      I = new t.ConnEnd(n.get(h), B);
    else {
      const U = T ? o.get(T) : void 0, G = i.get(h), it = (U == null ? void 0 : U.absolutePosition) ?? (G == null ? void 0 : G.position);
      if (!it)
        continue;
      I = new t.ConnEnd(new t.Point(it.x, it.y));
    }
    const y = E ? o.get(E) : void 0, P = i.get(g), b = (y == null ? void 0 : y.absolutePosition) ?? (P == null ? void 0 : P.position);
    if (!b)
      continue;
    const N = new t.ConnEnd(new t.Point(b.x, b.y)), R = new t.ConnRef(e, I, N), H = E ? o.get(E) : null;
    if (H != null && H.side) {
      const G = Math.max(H.size.width, H.size.height) / 2 + 16;
      let it = H.absolutePosition.x, O = H.absolutePosition.y;
      switch (H.side) {
        case "top":
          O -= G;
          break;
        case "bottom":
          O += G;
          break;
        case "left":
          it -= G;
          break;
        case "right":
          it += G;
          break;
      }
      if (!iu(it, O, i, a)) {
        const m = new t.CheckpointVector();
        m.push_back(new t.Checkpoint(new t.Point(it, O))), R.setRoutingCheckpoints(m);
      }
    }
    u.set(d, R);
  }
  return e.processTransaction(), u;
}
function uu(t, e, n, r) {
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
    const d = Tr(s.from), h = Tr(s.to), g = zr(s.from), _ = zr(s.to), x = g ? `${d}:${g}` : null, T = _ ? `${h}:${_}` : null, E = x ? e.get(x) : void 0, B = T ? e.get(T) : void 0;
    E && c.length > 0 && (c[0] = { x: E.absolutePosition.x, y: E.absolutePosition.y }), B && c.length > 0 && (c[c.length - 1] = {
      x: B.absolutePosition.x,
      y: B.absolutePosition.y
    });
    const I = c[0], y = c[c.length - 1], P = r === "straight" && c.length > 2 && I && y ? [I, y] : c;
    i.set(a, {
      id: a,
      fromPortId: g ? `${d}:${g}` : null,
      toPortId: _ ? `${h}:${_}` : null,
      fromNodeId: d,
      toNodeId: h,
      fromEndpoint: uo(s.from),
      toEndpoint: uo(s.to),
      points: P,
      width: $l(s),
      link: s
    });
  }
  return i;
}
function fu(t, e, n, r, i, o, s) {
  const a = su(t, e, n), u = au(t, a, n, r), f = lu(t, e, a, u, n, r, i, s), c = uu(f, r, i, o), d = cu(c);
  return du(d);
}
function cu(t) {
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
  fo(n, e, "y");
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
  return fo(r, e, "x"), e;
}
function fo(t, e, n) {
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
      co(e, i, -f, n), co(e, o, f, n), i.fixed -= f, o.fixed += f;
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
const hu = 8, ho = 6;
function du(t) {
  const e = /* @__PURE__ */ new Map();
  for (const [n, r] of t)
    e.set(n, {
      ...r,
      points: gu(r.points, hu)
    });
  return e;
}
function gu(t, e) {
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
    const h = (a.x - s.x) / f, g = (a.y - s.y) / f, _ = (u.x - s.x) / c, x = (u.y - s.y) / c, T = h * x - g * _;
    if (Math.abs(T) < 1e-3) {
      n.push({ ...s });
      continue;
    }
    const E = s.x + h * d, B = s.y + g * d, I = s.x + _ * d, y = s.y + x * d;
    for (let P = 0; P <= ho; P++) {
      const b = P / ho, N = 1 - b, R = N * N * E + 2 * N * b * s.x + b * b * I, H = N * N * B + 2 * N * b * s.y + b * b * y;
      n.push({ x: R, y: H });
    }
  }
  const i = t[t.length - 1];
  return i && n.push({ ...i }), n;
}
const rn = 8;
function zs(t, e, n = rn) {
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
      o !== t && (e && vu(e, o, r) || i.push(vi(s.bounds)));
  return i;
}
function Ls(t, e, n = rn) {
  let r = t.x, i = t.y;
  for (const o of e) {
    const s = { x: r, y: i, w: t.w, h: t.h };
    if (zs(s, o, n)) {
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
function vu(t, e, n) {
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
const gr = 20, go = 28;
function vi(t) {
  return { x: t.x + t.width / 2, y: t.y + t.height / 2, w: t.width, h: t.height };
}
function Yi(t, e, n, r, i, o) {
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
        y: u - gr - go,
        width: f - a + gr * 2,
        height: c - u + gr * 2 + go
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
      const c = vi(s.bounds), d = vi(f.bounds);
      if (!zs(c, d, rn))
        continue;
      const h = Cs(d, c, rn), g = h.x - d.x, _ = h.y - d.y;
      g === 0 && _ === 0 || (e.set(u, {
        ...f,
        bounds: { ...f.bounds, x: f.bounds.x + g, y: f.bounds.y + _ }
      }), Yi(u, g, _, t, e, n));
    }
  }
  for (const [o, s] of t) {
    const a = Rs(o, s.node.parent, t, e), u = Ls({ x: s.position.x, y: s.position.y, w: s.size.width, h: s.size.height }, a);
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
async function mu(t, e, n, r, i, o = rn) {
  const s = r.nodes.get(t);
  if (!s)
    return null;
  const { x: a, y: u } = Fs(t, e, n, r.nodes, o, r.subgraphs), f = a - s.position.x, c = u - s.position.y;
  if (f === 0 && c === 0)
    return null;
  const d = new Map(r.nodes);
  d.set(t, { ...s, position: { x: a, y: u } });
  const h = new Map(r.ports);
  for (const [x, T] of r.ports)
    T.nodeId === t && h.set(x, {
      ...T,
      absolutePosition: {
        x: T.absolutePosition.x + f,
        y: T.absolutePosition.y + c
      }
    });
  let g;
  r.subgraphs && (g = new Map(r.subgraphs), Cr(d, g, h));
  const _ = await Wn(d, h, i);
  return { nodes: d, ports: h, edges: _, subgraphs: g };
}
async function _u(t, e, n, r, i) {
  const o = r.subgraphs.get(t);
  if (!o)
    return null;
  const s = e - o.bounds.x, a = n - o.bounds.y;
  if (s === 0 && a === 0)
    return null;
  const u = new Map(r.nodes), f = new Map(r.ports), c = new Map(r.subgraphs);
  c.set(t, { ...o, bounds: { ...o.bounds, x: e, y: n } }), Yi(t, s, a, u, c, f), Cr(u, c, f);
  const d = await Wn(u, f, i);
  return { nodes: u, ports: f, edges: d, subgraphs: c };
}
function pu(t, e, n, r, i) {
  return t.some((o) => {
    const s = typeof o.from == "string" ? { node: o.from } : o.from, a = typeof o.to == "string" ? { node: o.to } : o.to;
    return s.node === e && s.port === n && a.node === r && a.port === i || s.node === r && s.port === i && a.node === e && a.port === n;
  });
}
function yu(t, e, n) {
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
function wu(t, e) {
  const n = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const r of e.values())
    r.nodeId === t && r.side && n[r.side]++;
  return n;
}
function xu(t, e) {
  const n = Math.max(t.top, t.bottom), r = Math.max(t.left, t.right);
  return {
    width: Math.max(e.width, (n + 1) * mo),
    height: Math.max(e.height, (r + 1) * mo)
  };
}
function bu(t, e, n, r) {
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
function Os(t, e, n) {
  const r = e.get(t);
  if (!r)
    return;
  const i = wu(t, n), o = xu(i, r.size);
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
    bu(t, u, s, n);
}
function ku(t, e, n, r, i) {
  if (!n.get(t))
    return null;
  const s = yu(t, i, r), a = `${t}:${s}`, u = new Map(r);
  u.set(a, {
    id: a,
    nodeId: t,
    label: s,
    absolutePosition: { x: 0, y: 0 },
    side: e,
    size: { width: vo, height: vo }
  });
  const f = new Map(n);
  return Os(t, f, u), { nodes: f, ports: u, portId: a };
}
function Eu(t, e, n, r) {
  const i = n.get(t);
  if (!i)
    return null;
  const o = i.nodeId, s = i.label, a = r.filter((c) => {
    const d = typeof c.from == "string" ? { node: c.from } : c.from, h = typeof c.to == "string" ? { node: c.to } : c.to;
    return !(d.node === o && d.port === s || h.node === o && h.port === s);
  }), u = new Map(n);
  u.delete(t);
  const f = new Map(e);
  return Os(o, f, u), { nodes: f, ports: u, links: a };
}
/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function Ds(t) {
  return typeof t > "u" || t === null;
}
function Su(t) {
  return typeof t == "object" && t !== null;
}
function Nu(t) {
  return Array.isArray(t) ? t : Ds(t) ? [] : [t];
}
function Mu(t, e) {
  var n, r, i, o;
  if (e)
    for (o = Object.keys(e), n = 0, r = o.length; n < r; n += 1)
      i = o[n], t[i] = e[i];
  return t;
}
function Au(t, e) {
  var n = "", r;
  for (r = 0; r < e; r += 1)
    n += t;
  return n;
}
function Iu(t) {
  return t === 0 && Number.NEGATIVE_INFINITY === 1 / t;
}
var Pu = Ds, Tu = Su, zu = Nu, Cu = Au, Ru = Iu, Lu = Mu, Hi = {
  isNothing: Pu,
  isObject: Tu,
  toArray: zu,
  repeat: Cu,
  isNegativeZero: Ru,
  extend: Lu
};
function Ys(t, e) {
  var n = "", r = t.reason || "(unknown reason)";
  return t.mark ? (t.mark.name && (n += 'in "' + t.mark.name + '" '), n += "(" + (t.mark.line + 1) + ":" + (t.mark.column + 1) + ")", !e && t.mark.snippet && (n += `

` + t.mark.snippet), r + " " + n) : r;
}
function Qn(t, e) {
  Error.call(this), this.name = "YAMLException", this.reason = t, this.mark = e, this.message = Ys(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
}
Qn.prototype = Object.create(Error.prototype);
Qn.prototype.constructor = Qn;
Qn.prototype.toString = function(e) {
  return this.name + ": " + Ys(this, e);
};
var Xe = Qn, Fu = [
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
], Ou = [
  "scalar",
  "sequence",
  "mapping"
];
function Du(t) {
  var e = {};
  return t !== null && Object.keys(t).forEach(function(n) {
    t[n].forEach(function(r) {
      e[String(r)] = n;
    });
  }), e;
}
function Yu(t, e) {
  if (e = e || {}, Object.keys(e).forEach(function(n) {
    if (Fu.indexOf(n) === -1)
      throw new Xe('Unknown option "' + n + '" is met in definition of "' + t + '" YAML type.');
  }), this.options = e, this.tag = t, this.kind = e.kind || null, this.resolve = e.resolve || function() {
    return !0;
  }, this.construct = e.construct || function(n) {
    return n;
  }, this.instanceOf = e.instanceOf || null, this.predicate = e.predicate || null, this.represent = e.represent || null, this.representName = e.representName || null, this.defaultStyle = e.defaultStyle || null, this.multi = e.multi || !1, this.styleAliases = Du(e.styleAliases || null), Ou.indexOf(this.kind) === -1)
    throw new Xe('Unknown kind "' + this.kind + '" is specified for "' + t + '" YAML type.');
}
var Et = Yu;
function _o(t, e) {
  var n = [];
  return t[e].forEach(function(r) {
    var i = n.length;
    n.forEach(function(o, s) {
      o.tag === r.tag && o.kind === r.kind && o.multi === r.multi && (i = s);
    }), n[i] = r;
  }), n;
}
function Hu() {
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
  var i = Object.create(mi.prototype);
  return i.implicit = (this.implicit || []).concat(n), i.explicit = (this.explicit || []).concat(r), i.compiledImplicit = _o(i, "implicit"), i.compiledExplicit = _o(i, "explicit"), i.compiledTypeMap = Hu(i.compiledImplicit, i.compiledExplicit), i;
};
var Bu = mi, Vu = new Et("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(t) {
    return t !== null ? t : "";
  }
}), Xu = new Et("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(t) {
    return t !== null ? t : [];
  }
}), Uu = new Et("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(t) {
    return t !== null ? t : {};
  }
}), qu = new Bu({
  explicit: [
    Vu,
    Xu,
    Uu
  ]
});
function Gu(t) {
  if (t === null) return !0;
  var e = t.length;
  return e === 1 && t === "~" || e === 4 && (t === "null" || t === "Null" || t === "NULL");
}
function Wu() {
  return null;
}
function Ku(t) {
  return t === null;
}
var Zu = new Et("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: Gu,
  construct: Wu,
  predicate: Ku,
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
function Ju(t) {
  if (t === null) return !1;
  var e = t.length;
  return e === 4 && (t === "true" || t === "True" || t === "TRUE") || e === 5 && (t === "false" || t === "False" || t === "FALSE");
}
function Qu(t) {
  return t === "true" || t === "True" || t === "TRUE";
}
function ju(t) {
  return Object.prototype.toString.call(t) === "[object Boolean]";
}
var $u = new Et("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: Ju,
  construct: Qu,
  predicate: ju,
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
function tf(t) {
  return 48 <= t && t <= 57 || 65 <= t && t <= 70 || 97 <= t && t <= 102;
}
function ef(t) {
  return 48 <= t && t <= 55;
}
function nf(t) {
  return 48 <= t && t <= 57;
}
function rf(t) {
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
          if (!tf(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
    if (i === "o") {
      for (n++; n < e; n++)
        if (i = t[n], i !== "_") {
          if (!ef(t.charCodeAt(n))) return !1;
          r = !0;
        }
      return r && i !== "_";
    }
  }
  if (i === "_") return !1;
  for (; n < e; n++)
    if (i = t[n], i !== "_") {
      if (!nf(t.charCodeAt(n)))
        return !1;
      r = !0;
    }
  return !(!r || i === "_");
}
function of(t) {
  var e = t, n = 1, r;
  if (e.indexOf("_") !== -1 && (e = e.replace(/_/g, "")), r = e[0], (r === "-" || r === "+") && (r === "-" && (n = -1), e = e.slice(1), r = e[0]), e === "0") return 0;
  if (r === "0") {
    if (e[1] === "b") return n * parseInt(e.slice(2), 2);
    if (e[1] === "x") return n * parseInt(e.slice(2), 16);
    if (e[1] === "o") return n * parseInt(e.slice(2), 8);
  }
  return n * parseInt(e, 10);
}
function sf(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && t % 1 === 0 && !Hi.isNegativeZero(t);
}
var af = new Et("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: rf,
  construct: of,
  predicate: sf,
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
}), lf = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function uf(t) {
  return !(t === null || !lf.test(t) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  t[t.length - 1] === "_");
}
function ff(t) {
  var e, n;
  return e = t.replace(/_/g, "").toLowerCase(), n = e[0] === "-" ? -1 : 1, "+-".indexOf(e[0]) >= 0 && (e = e.slice(1)), e === ".inf" ? n === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : e === ".nan" ? NaN : n * parseFloat(e, 10);
}
var cf = /^[-+]?[0-9]+e/;
function hf(t, e) {
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
  return n = t.toString(10), cf.test(n) ? n.replace("e", ".e") : n;
}
function df(t) {
  return Object.prototype.toString.call(t) === "[object Number]" && (t % 1 !== 0 || Hi.isNegativeZero(t));
}
var gf = new Et("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: uf,
  construct: ff,
  predicate: df,
  represent: hf,
  defaultStyle: "lowercase"
}), vf = qu.extend({
  implicit: [
    Zu,
    $u,
    af,
    gf
  ]
}), mf = vf, Hs = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
), Bs = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function _f(t) {
  return t === null ? !1 : Hs.exec(t) !== null || Bs.exec(t) !== null;
}
function pf(t) {
  var e, n, r, i, o, s, a, u = 0, f = null, c, d, h;
  if (e = Hs.exec(t), e === null && (e = Bs.exec(t)), e === null) throw new Error("Date resolve error");
  if (n = +e[1], r = +e[2] - 1, i = +e[3], !e[4])
    return new Date(Date.UTC(n, r, i));
  if (o = +e[4], s = +e[5], a = +e[6], e[7]) {
    for (u = e[7].slice(0, 3); u.length < 3; )
      u += "0";
    u = +u;
  }
  return e[9] && (c = +e[10], d = +(e[11] || 0), f = (c * 60 + d) * 6e4, e[9] === "-" && (f = -f)), h = new Date(Date.UTC(n, r, i, o, s, a, u)), f && h.setTime(h.getTime() - f), h;
}
function yf(t) {
  return t.toISOString();
}
var wf = new Et("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: _f,
  construct: pf,
  instanceOf: Date,
  represent: yf
});
function xf(t) {
  return t === "<<" || t === null;
}
var bf = new Et("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: xf
}), Bi = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
function kf(t) {
  if (t === null) return !1;
  var e, n, r = 0, i = t.length, o = Bi;
  for (n = 0; n < i; n++)
    if (e = o.indexOf(t.charAt(n)), !(e > 64)) {
      if (e < 0) return !1;
      r += 6;
    }
  return r % 8 === 0;
}
function Ef(t) {
  var e, n, r = t.replace(/[\r\n=]/g, ""), i = r.length, o = Bi, s = 0, a = [];
  for (e = 0; e < i; e++)
    e % 4 === 0 && e && (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)), s = s << 6 | o.indexOf(r.charAt(e));
  return n = i % 4 * 6, n === 0 ? (a.push(s >> 16 & 255), a.push(s >> 8 & 255), a.push(s & 255)) : n === 18 ? (a.push(s >> 10 & 255), a.push(s >> 2 & 255)) : n === 12 && a.push(s >> 4 & 255), new Uint8Array(a);
}
function Sf(t) {
  var e = "", n = 0, r, i, o = t.length, s = Bi;
  for (r = 0; r < o; r++)
    r % 3 === 0 && r && (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]), n = (n << 8) + t[r];
  return i = o % 3, i === 0 ? (e += s[n >> 18 & 63], e += s[n >> 12 & 63], e += s[n >> 6 & 63], e += s[n & 63]) : i === 2 ? (e += s[n >> 10 & 63], e += s[n >> 4 & 63], e += s[n << 2 & 63], e += s[64]) : i === 1 && (e += s[n >> 2 & 63], e += s[n << 4 & 63], e += s[64], e += s[64]), e;
}
function Nf(t) {
  return Object.prototype.toString.call(t) === "[object Uint8Array]";
}
var Mf = new Et("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: kf,
  construct: Ef,
  predicate: Nf,
  represent: Sf
}), Af = Object.prototype.hasOwnProperty, If = Object.prototype.toString;
function Pf(t) {
  if (t === null) return !0;
  var e = [], n, r, i, o, s, a = t;
  for (n = 0, r = a.length; n < r; n += 1) {
    if (i = a[n], s = !1, If.call(i) !== "[object Object]") return !1;
    for (o in i)
      if (Af.call(i, o))
        if (!s) s = !0;
        else return !1;
    if (!s) return !1;
    if (e.indexOf(o) === -1) e.push(o);
    else return !1;
  }
  return !0;
}
function Tf(t) {
  return t !== null ? t : [];
}
var zf = new Et("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: Pf,
  construct: Tf
}), Cf = Object.prototype.toString;
function Rf(t) {
  if (t === null) return !0;
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1) {
    if (r = s[e], Cf.call(r) !== "[object Object]" || (i = Object.keys(r), i.length !== 1)) return !1;
    o[e] = [i[0], r[i[0]]];
  }
  return !0;
}
function Lf(t) {
  if (t === null) return [];
  var e, n, r, i, o, s = t;
  for (o = new Array(s.length), e = 0, n = s.length; e < n; e += 1)
    r = s[e], i = Object.keys(r), o[e] = [i[0], r[i[0]]];
  return o;
}
var Ff = new Et("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: Rf,
  construct: Lf
}), Of = Object.prototype.hasOwnProperty;
function Df(t) {
  if (t === null) return !0;
  var e, n = t;
  for (e in n)
    if (Of.call(n, e) && n[e] !== null)
      return !1;
  return !0;
}
function Yf(t) {
  return t !== null ? t : {};
}
var Hf = new Et("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: Df,
  construct: Yf
});
mf.extend({
  implicit: [
    wf,
    bf
  ],
  explicit: [
    Mf,
    zf,
    Ff,
    Hf
  ]
});
function po(t) {
  return t === 48 ? "\0" : t === 97 ? "\x07" : t === 98 ? "\b" : t === 116 || t === 9 ? "	" : t === 110 ? `
` : t === 118 ? "\v" : t === 102 ? "\f" : t === 114 ? "\r" : t === 101 ? "\x1B" : t === 32 ? " " : t === 34 ? '"' : t === 47 ? "/" : t === 92 ? "\\" : t === 78 ? "" : t === 95 ? " " : t === 76 ? "\u2028" : t === 80 ? "\u2029" : "";
}
var Bf = new Array(256), Vf = new Array(256);
for (var vn = 0; vn < 256; vn++)
  Bf[vn] = po(vn) ? 1 : 0, Vf[vn] = po(vn);
var yo;
(function(t) {
  t.Router = "router", t.L3Switch = "l3-switch", t.L2Switch = "l2-switch", t.Firewall = "firewall", t.LoadBalancer = "load-balancer", t.Server = "server", t.AccessPoint = "access-point", t.CPE = "cpe", t.Cloud = "cloud", t.Internet = "internet", t.VPN = "vpn", t.Database = "database", t.Generic = "generic";
})(yo || (yo = {}));
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
      [et.Router]: "#3b82f6",
      [et.L3Switch]: "#8b5cf6",
      [et.L2Switch]: "#a78bfa",
      [et.Firewall]: "#ef4444",
      [et.LoadBalancer]: "#f59e0b",
      [et.Server]: "#10b981",
      [et.AccessPoint]: "#06b6d4",
      [et.Cloud]: "#3b82f6",
      [et.Internet]: "#6366f1",
      [et.Generic]: "#94a3b8"
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
    devices: (et.Router + "", et.L3Switch + "", et.L2Switch + "", et.Firewall + "", et.LoadBalancer + "", et.Server + "", et.AccessPoint + "", et.Cloud + "", et.Internet + "", et.Generic + "")
  },
  shadows: {
    ...kr.shadows
  }
});
function Xf(t = kr) {
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
var Uf = { value: () => {
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
function qf(t, e) {
  return t.trim().split(/^|\s+/).map(function(n) {
    var r = "", i = n.indexOf(".");
    if (i >= 0 && (r = n.slice(i + 1), n = n.slice(0, i)), n && !e.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    return { type: n, name: r };
  });
}
Er.prototype = qr.prototype = {
  constructor: Er,
  on: function(t, e) {
    var n = this._, r = qf(t + "", n), i, o = -1, s = r.length;
    if (arguments.length < 2) {
      for (; ++o < s; ) if ((i = (t = r[o]).type) && (i = Gf(n[i], t.name))) return i;
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
function Gf(t, e) {
  for (var n = 0, r = t.length, i; n < r; ++n)
    if ((i = t[n]).name === e)
      return i.value;
}
function wo(t, e, n) {
  for (var r = 0, i = t.length; r < i; ++r)
    if (t[r].name === e) {
      t[r] = Uf, t = t.slice(0, r).concat(t.slice(r + 1));
      break;
    }
  return n != null && t.push({ name: e, value: n }), t;
}
var _i = "http://www.w3.org/1999/xhtml";
const xo = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: _i,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function Gr(t) {
  var e = t += "", n = e.indexOf(":");
  return n >= 0 && (e = t.slice(0, n)) !== "xmlns" && (t = t.slice(n + 1)), xo.hasOwnProperty(e) ? { space: xo[e], local: t } : t;
}
function Wf(t) {
  return function() {
    var e = this.ownerDocument, n = this.namespaceURI;
    return n === _i && e.documentElement.namespaceURI === _i ? e.createElement(t) : e.createElementNS(n, t);
  };
}
function Kf(t) {
  return function() {
    return this.ownerDocument.createElementNS(t.space, t.local);
  };
}
function Vs(t) {
  var e = Gr(t);
  return (e.local ? Kf : Wf)(e);
}
function Zf() {
}
function Vi(t) {
  return t == null ? Zf : function() {
    return this.querySelector(t);
  };
}
function Jf(t) {
  typeof t != "function" && (t = Vi(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = new Array(s), u, f, c = 0; c < s; ++c)
      (u = o[c]) && (f = t.call(u, u.__data__, c, o)) && ("__data__" in u && (f.__data__ = u.__data__), a[c] = f);
  return new Bt(r, this._parents);
}
function Qf(t) {
  return t == null ? [] : Array.isArray(t) ? t : Array.from(t);
}
function jf() {
  return [];
}
function Xs(t) {
  return t == null ? jf : function() {
    return this.querySelectorAll(t);
  };
}
function $f(t) {
  return function() {
    return Qf(t.apply(this, arguments));
  };
}
function tc(t) {
  typeof t == "function" ? t = $f(t) : t = Xs(t);
  for (var e = this._groups, n = e.length, r = [], i = [], o = 0; o < n; ++o)
    for (var s = e[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && (r.push(t.call(u, u.__data__, f, s)), i.push(u));
  return new Bt(r, i);
}
function Us(t) {
  return function() {
    return this.matches(t);
  };
}
function qs(t) {
  return function(e) {
    return e.matches(t);
  };
}
var ec = Array.prototype.find;
function nc(t) {
  return function() {
    return ec.call(this.children, t);
  };
}
function rc() {
  return this.firstElementChild;
}
function ic(t) {
  return this.select(t == null ? rc : nc(typeof t == "function" ? t : qs(t)));
}
var oc = Array.prototype.filter;
function sc() {
  return Array.from(this.children);
}
function ac(t) {
  return function() {
    return oc.call(this.children, t);
  };
}
function lc(t) {
  return this.selectAll(t == null ? sc : ac(typeof t == "function" ? t : qs(t)));
}
function uc(t) {
  typeof t != "function" && (t = Us(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new Bt(r, this._parents);
}
function Gs(t) {
  return new Array(t.length);
}
function fc() {
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
function cc(t) {
  return function() {
    return t;
  };
}
function hc(t, e, n, r, i, o) {
  for (var s = 0, a, u = e.length, f = o.length; s < f; ++s)
    (a = e[s]) ? (a.__data__ = o[s], r[s] = a) : n[s] = new Rr(t, o[s]);
  for (; s < u; ++s)
    (a = e[s]) && (i[s] = a);
}
function dc(t, e, n, r, i, o, s) {
  var a, u, f = /* @__PURE__ */ new Map(), c = e.length, d = o.length, h = new Array(c), g;
  for (a = 0; a < c; ++a)
    (u = e[a]) && (h[a] = g = s.call(u, u.__data__, a, e) + "", f.has(g) ? i[a] = u : f.set(g, u));
  for (a = 0; a < d; ++a)
    g = s.call(t, o[a], a, o) + "", (u = f.get(g)) ? (r[a] = u, u.__data__ = o[a], f.delete(g)) : n[a] = new Rr(t, o[a]);
  for (a = 0; a < c; ++a)
    (u = e[a]) && f.get(h[a]) === u && (i[a] = u);
}
function gc(t) {
  return t.__data__;
}
function vc(t, e) {
  if (!arguments.length) return Array.from(this, gc);
  var n = e ? dc : hc, r = this._parents, i = this._groups;
  typeof t != "function" && (t = cc(t));
  for (var o = i.length, s = new Array(o), a = new Array(o), u = new Array(o), f = 0; f < o; ++f) {
    var c = r[f], d = i[f], h = d.length, g = mc(t.call(c, c && c.__data__, f, r)), _ = g.length, x = a[f] = new Array(_), T = s[f] = new Array(_), E = u[f] = new Array(h);
    n(c, d, x, T, E, g, e);
    for (var B = 0, I = 0, y, P; B < _; ++B)
      if (y = x[B]) {
        for (B >= I && (I = B + 1); !(P = T[I]) && ++I < _; ) ;
        y._next = P || null;
      }
  }
  return s = new Bt(s, r), s._enter = a, s._exit = u, s;
}
function mc(t) {
  return typeof t == "object" && "length" in t ? t : Array.from(t);
}
function _c() {
  return new Bt(this._exit || this._groups.map(Gs), this._parents);
}
function pc(t, e, n) {
  var r = this.enter(), i = this, o = this.exit();
  return typeof t == "function" ? (r = t(r), r && (r = r.selection())) : r = r.append(t + ""), e != null && (i = e(i), i && (i = i.selection())), n == null ? o.remove() : n(o), r && i ? r.merge(i).order() : i;
}
function yc(t) {
  for (var e = t.selection ? t.selection() : t, n = this._groups, r = e._groups, i = n.length, o = r.length, s = Math.min(i, o), a = new Array(i), u = 0; u < s; ++u)
    for (var f = n[u], c = r[u], d = f.length, h = a[u] = new Array(d), g, _ = 0; _ < d; ++_)
      (g = f[_] || c[_]) && (h[_] = g);
  for (; u < i; ++u)
    a[u] = n[u];
  return new Bt(a, this._parents);
}
function wc() {
  for (var t = this._groups, e = -1, n = t.length; ++e < n; )
    for (var r = t[e], i = r.length - 1, o = r[i], s; --i >= 0; )
      (s = r[i]) && (o && s.compareDocumentPosition(o) ^ 4 && o.parentNode.insertBefore(s, o), o = s);
  return this;
}
function xc(t) {
  t || (t = bc);
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
function bc(t, e) {
  return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
function kc() {
  var t = arguments[0];
  return arguments[0] = this, t.apply(null, arguments), this;
}
function Ec() {
  return Array.from(this);
}
function Sc() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length; i < o; ++i) {
      var s = r[i];
      if (s) return s;
    }
  return null;
}
function Nc() {
  let t = 0;
  for (const e of this) ++t;
  return t;
}
function Mc() {
  return !this.node();
}
function Ac(t) {
  for (var e = this._groups, n = 0, r = e.length; n < r; ++n)
    for (var i = e[n], o = 0, s = i.length, a; o < s; ++o)
      (a = i[o]) && t.call(a, a.__data__, o, i);
  return this;
}
function Ic(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function Pc(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function Tc(t, e) {
  return function() {
    this.setAttribute(t, e);
  };
}
function zc(t, e) {
  return function() {
    this.setAttributeNS(t.space, t.local, e);
  };
}
function Cc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttribute(t) : this.setAttribute(t, n);
  };
}
function Rc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? this.removeAttributeNS(t.space, t.local) : this.setAttributeNS(t.space, t.local, n);
  };
}
function Lc(t, e) {
  var n = Gr(t);
  if (arguments.length < 2) {
    var r = this.node();
    return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n);
  }
  return this.each((e == null ? n.local ? Pc : Ic : typeof e == "function" ? n.local ? Rc : Cc : n.local ? zc : Tc)(n, e));
}
function Ws(t) {
  return t.ownerDocument && t.ownerDocument.defaultView || t.document && t || t.defaultView;
}
function Fc(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function Oc(t, e, n) {
  return function() {
    this.style.setProperty(t, e, n);
  };
}
function Dc(t, e, n) {
  return function() {
    var r = e.apply(this, arguments);
    r == null ? this.style.removeProperty(t) : this.style.setProperty(t, r, n);
  };
}
function Yc(t, e, n) {
  return arguments.length > 1 ? this.each((e == null ? Fc : typeof e == "function" ? Dc : Oc)(t, e, n ?? "")) : Rn(this.node(), t);
}
function Rn(t, e) {
  return t.style.getPropertyValue(e) || Ws(t).getComputedStyle(t, null).getPropertyValue(e);
}
function Hc(t) {
  return function() {
    delete this[t];
  };
}
function Bc(t, e) {
  return function() {
    this[t] = e;
  };
}
function Vc(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    n == null ? delete this[t] : this[t] = n;
  };
}
function Xc(t, e) {
  return arguments.length > 1 ? this.each((e == null ? Hc : typeof e == "function" ? Vc : Bc)(t, e)) : this.node()[t];
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
function Uc(t) {
  return function() {
    Js(this, t);
  };
}
function qc(t) {
  return function() {
    Qs(this, t);
  };
}
function Gc(t, e) {
  return function() {
    (e.apply(this, arguments) ? Js : Qs)(this, t);
  };
}
function Wc(t, e) {
  var n = Ks(t + "");
  if (arguments.length < 2) {
    for (var r = Xi(this.node()), i = -1, o = n.length; ++i < o; ) if (!r.contains(n[i])) return !1;
    return !0;
  }
  return this.each((typeof e == "function" ? Gc : e ? Uc : qc)(n, e));
}
function Kc() {
  this.textContent = "";
}
function Zc(t) {
  return function() {
    this.textContent = t;
  };
}
function Jc(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.textContent = e ?? "";
  };
}
function Qc(t) {
  return arguments.length ? this.each(t == null ? Kc : (typeof t == "function" ? Jc : Zc)(t)) : this.node().textContent;
}
function jc() {
  this.innerHTML = "";
}
function $c(t) {
  return function() {
    this.innerHTML = t;
  };
}
function th(t) {
  return function() {
    var e = t.apply(this, arguments);
    this.innerHTML = e ?? "";
  };
}
function eh(t) {
  return arguments.length ? this.each(t == null ? jc : (typeof t == "function" ? th : $c)(t)) : this.node().innerHTML;
}
function nh() {
  this.nextSibling && this.parentNode.appendChild(this);
}
function rh() {
  return this.each(nh);
}
function ih() {
  this.previousSibling && this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function oh() {
  return this.each(ih);
}
function sh(t) {
  var e = typeof t == "function" ? t : Vs(t);
  return this.select(function() {
    return this.appendChild(e.apply(this, arguments));
  });
}
function ah() {
  return null;
}
function lh(t, e) {
  var n = typeof t == "function" ? t : Vs(t), r = e == null ? ah : typeof e == "function" ? e : Vi(e);
  return this.select(function() {
    return this.insertBefore(n.apply(this, arguments), r.apply(this, arguments) || null);
  });
}
function uh() {
  var t = this.parentNode;
  t && t.removeChild(this);
}
function fh() {
  return this.each(uh);
}
function ch() {
  var t = this.cloneNode(!1), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function hh() {
  var t = this.cloneNode(!0), e = this.parentNode;
  return e ? e.insertBefore(t, this.nextSibling) : t;
}
function dh(t) {
  return this.select(t ? hh : ch);
}
function gh(t) {
  return arguments.length ? this.property("__data__", t) : this.node().__data__;
}
function vh(t) {
  return function(e) {
    t.call(this, e, this.__data__);
  };
}
function mh(t) {
  return t.trim().split(/^|\s+/).map(function(e) {
    var n = "", r = e.indexOf(".");
    return r >= 0 && (n = e.slice(r + 1), e = e.slice(0, r)), { type: e, name: n };
  });
}
function _h(t) {
  return function() {
    var e = this.__on;
    if (e) {
      for (var n = 0, r = -1, i = e.length, o; n < i; ++n)
        o = e[n], (!t.type || o.type === t.type) && o.name === t.name ? this.removeEventListener(o.type, o.listener, o.options) : e[++r] = o;
      ++r ? e.length = r : delete this.__on;
    }
  };
}
function ph(t, e, n) {
  return function() {
    var r = this.__on, i, o = vh(e);
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
function yh(t, e, n) {
  var r = mh(t + ""), i, o = r.length, s;
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
  for (a = e ? ph : _h, i = 0; i < o; ++i) this.each(a(r[i], e, n));
  return this;
}
function js(t, e, n) {
  var r = Ws(t), i = r.CustomEvent;
  typeof i == "function" ? i = new i(e, n) : (i = r.document.createEvent("Event"), n ? (i.initEvent(e, n.bubbles, n.cancelable), i.detail = n.detail) : i.initEvent(e, !1, !1)), t.dispatchEvent(i);
}
function wh(t, e) {
  return function() {
    return js(this, t, e);
  };
}
function xh(t, e) {
  return function() {
    return js(this, t, e.apply(this, arguments));
  };
}
function bh(t, e) {
  return this.each((typeof e == "function" ? xh : wh)(t, e));
}
function* kh() {
  for (var t = this._groups, e = 0, n = t.length; e < n; ++e)
    for (var r = t[e], i = 0, o = r.length, s; i < o; ++i)
      (s = r[i]) && (yield s);
}
var $s = [null];
function Bt(t, e) {
  this._groups = t, this._parents = e;
}
function ur() {
  return new Bt([[document.documentElement]], $s);
}
function Eh() {
  return this;
}
Bt.prototype = ur.prototype = {
  constructor: Bt,
  select: Jf,
  selectAll: tc,
  selectChild: ic,
  selectChildren: lc,
  filter: uc,
  data: vc,
  enter: fc,
  exit: _c,
  join: pc,
  merge: yc,
  selection: Eh,
  order: wc,
  sort: xc,
  call: kc,
  nodes: Ec,
  node: Sc,
  size: Nc,
  empty: Mc,
  each: Ac,
  attr: Lc,
  style: Yc,
  property: Xc,
  classed: Wc,
  text: Qc,
  html: eh,
  raise: rh,
  lower: oh,
  append: sh,
  insert: lh,
  remove: fh,
  clone: dh,
  datum: gh,
  on: yh,
  dispatch: bh,
  [Symbol.iterator]: kh
};
function zt(t) {
  return typeof t == "string" ? new Bt([[document.querySelector(t)]], [document.documentElement]) : new Bt([[t]], $s);
}
function Sh(t) {
  let e;
  for (; e = t.sourceEvent; ) t = e;
  return t;
}
function me(t, e) {
  if (t = Sh(t), e === void 0 && (e = t.currentTarget), e) {
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
const Nh = { passive: !1 }, jn = { capture: !0, passive: !1 };
function $r(t) {
  t.stopImmediatePropagation();
}
function yn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function ta(t) {
  var e = t.document.documentElement, n = zt(t).on("dragstart.drag", yn, jn);
  "onselectstart" in e ? n.on("selectstart.drag", yn, jn) : (e.__noselect = e.style.MozUserSelect, e.style.MozUserSelect = "none");
}
function ea(t, e) {
  var n = t.document.documentElement, r = zt(t).on("dragstart.drag", null);
  e && (r.on("click.drag", yn, jn), setTimeout(function() {
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
function Mh(t) {
  return !t.ctrlKey && !t.button;
}
function Ah() {
  return this.parentNode;
}
function Ih(t, e) {
  return e ?? { x: t.x, y: t.y };
}
function Ph() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function bo() {
  var t = Mh, e = Ah, n = Ih, r = Ph, i = {}, o = qr("start", "drag", "end"), s = 0, a, u, f, c, d = 0;
  function h(y) {
    y.on("mousedown.drag", g).filter(r).on("touchstart.drag", T).on("touchmove.drag", E, Nh).on("touchend.drag touchcancel.drag", B).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function g(y, P) {
    if (!(c || !t.call(this, y, P))) {
      var b = I(this, e.call(this, y, P), y, P, "mouse");
      b && (zt(y.view).on("mousemove.drag", _, jn).on("mouseup.drag", x, jn), ta(y.view), $r(y), f = !1, a = y.clientX, u = y.clientY, b("start", y));
    }
  }
  function _(y) {
    if (yn(y), !f) {
      var P = y.clientX - a, b = y.clientY - u;
      f = P * P + b * b > d;
    }
    i.mouse("drag", y);
  }
  function x(y) {
    zt(y.view).on("mousemove.drag mouseup.drag", null), ea(y.view, f), yn(y), i.mouse("end", y);
  }
  function T(y, P) {
    if (t.call(this, y, P)) {
      var b = y.changedTouches, N = e.call(this, y, P), R = b.length, H, U;
      for (H = 0; H < R; ++H)
        (U = I(this, N, y, P, b[H].identifier, b[H])) && ($r(y), U("start", y, b[H]));
    }
  }
  function E(y) {
    var P = y.changedTouches, b = P.length, N, R;
    for (N = 0; N < b; ++N)
      (R = i[P[N].identifier]) && (yn(y), R("drag", y, P[N]));
  }
  function B(y) {
    var P = y.changedTouches, b = P.length, N, R;
    for (c && clearTimeout(c), c = setTimeout(function() {
      c = null;
    }, 500), N = 0; N < b; ++N)
      (R = i[P[N].identifier]) && ($r(y), R("end", y, P[N]));
  }
  function I(y, P, b, N, R, H) {
    var U = o.copy(), G = me(H || b, P), it, O, m;
    if ((m = n.call(y, new pi("beforestart", {
      sourceEvent: b,
      target: h,
      identifier: R,
      active: s,
      x: G[0],
      y: G[1],
      dx: 0,
      dy: 0,
      dispatch: U
    }), N)) != null)
      return it = m.x - G[0] || 0, O = m.y - G[1] || 0, function k(w, A, C) {
        var V = G, q;
        switch (w) {
          case "start":
            i[R] = k, q = s++;
            break;
          case "end":
            delete i[R], --s;
          // falls through
          case "drag":
            G = me(C || A, P), q = s;
            break;
        }
        U.call(
          w,
          y,
          new pi(w, {
            sourceEvent: A,
            subject: m,
            target: h,
            identifier: R,
            active: q,
            x: G[0] + it,
            y: G[1] + O,
            dx: G[0] - V[0],
            dy: G[1] - V[1],
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
function Ui(t, e, n) {
  t.prototype = e.prototype = n, n.constructor = t;
}
function na(t, e) {
  var n = Object.create(t.prototype);
  for (var r in e) n[r] = e[r];
  return n;
}
function fr() {
}
var $n = 0.7, Lr = 1 / $n, wn = "\\s*([+-]?\\d+)\\s*", tr = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", le = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", Th = /^#([0-9a-f]{3,8})$/, zh = new RegExp(`^rgb\\(${wn},${wn},${wn}\\)$`), Ch = new RegExp(`^rgb\\(${le},${le},${le}\\)$`), Rh = new RegExp(`^rgba\\(${wn},${wn},${wn},${tr}\\)$`), Lh = new RegExp(`^rgba\\(${le},${le},${le},${tr}\\)$`), Fh = new RegExp(`^hsl\\(${tr},${le},${le}\\)$`), Oh = new RegExp(`^hsla\\(${tr},${le},${le},${tr}\\)$`), ko = {
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
Ui(fr, er, {
  copy(t) {
    return Object.assign(new this.constructor(), this, t);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: Eo,
  // Deprecated! Use color.formatHex.
  formatHex: Eo,
  formatHex8: Dh,
  formatHsl: Yh,
  formatRgb: So,
  toString: So
});
function Eo() {
  return this.rgb().formatHex();
}
function Dh() {
  return this.rgb().formatHex8();
}
function Yh() {
  return ra(this).formatHsl();
}
function So() {
  return this.rgb().formatRgb();
}
function er(t) {
  var e, n;
  return t = (t + "").trim().toLowerCase(), (e = Th.exec(t)) ? (n = e[1].length, e = parseInt(e[1], 16), n === 6 ? No(e) : n === 3 ? new Rt(e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, (e & 15) << 4 | e & 15, 1) : n === 8 ? mr(e >> 24 & 255, e >> 16 & 255, e >> 8 & 255, (e & 255) / 255) : n === 4 ? mr(e >> 12 & 15 | e >> 8 & 240, e >> 8 & 15 | e >> 4 & 240, e >> 4 & 15 | e & 240, ((e & 15) << 4 | e & 15) / 255) : null) : (e = zh.exec(t)) ? new Rt(e[1], e[2], e[3], 1) : (e = Ch.exec(t)) ? new Rt(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, 1) : (e = Rh.exec(t)) ? mr(e[1], e[2], e[3], e[4]) : (e = Lh.exec(t)) ? mr(e[1] * 255 / 100, e[2] * 255 / 100, e[3] * 255 / 100, e[4]) : (e = Fh.exec(t)) ? Io(e[1], e[2] / 100, e[3] / 100, 1) : (e = Oh.exec(t)) ? Io(e[1], e[2] / 100, e[3] / 100, e[4]) : ko.hasOwnProperty(t) ? No(ko[t]) : t === "transparent" ? new Rt(NaN, NaN, NaN, 0) : null;
}
function No(t) {
  return new Rt(t >> 16 & 255, t >> 8 & 255, t & 255, 1);
}
function mr(t, e, n, r) {
  return r <= 0 && (t = e = n = NaN), new Rt(t, e, n, r);
}
function Hh(t) {
  return t instanceof fr || (t = er(t)), t ? (t = t.rgb(), new Rt(t.r, t.g, t.b, t.opacity)) : new Rt();
}
function yi(t, e, n, r) {
  return arguments.length === 1 ? Hh(t) : new Rt(t, e, n, r ?? 1);
}
function Rt(t, e, n, r) {
  this.r = +t, this.g = +e, this.b = +n, this.opacity = +r;
}
Ui(Rt, yi, na(fr, {
  brighter(t) {
    return t = t == null ? Lr : Math.pow(Lr, t), new Rt(this.r * t, this.g * t, this.b * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? $n : Math.pow($n, t), new Rt(this.r * t, this.g * t, this.b * t, this.opacity);
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
  formatHex8: Bh,
  formatRgb: Ao,
  toString: Ao
}));
function Mo() {
  return `#${qe(this.r)}${qe(this.g)}${qe(this.b)}`;
}
function Bh() {
  return `#${qe(this.r)}${qe(this.g)}${qe(this.b)}${qe((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
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
function qe(t) {
  return t = $e(t), (t < 16 ? "0" : "") + t.toString(16);
}
function Io(t, e, n, r) {
  return r <= 0 ? t = e = n = NaN : n <= 0 || n >= 1 ? t = e = NaN : e <= 0 && (t = NaN), new $t(t, e, n, r);
}
function ra(t) {
  if (t instanceof $t) return new $t(t.h, t.s, t.l, t.opacity);
  if (t instanceof fr || (t = er(t)), !t) return new $t();
  if (t instanceof $t) return t;
  t = t.rgb();
  var e = t.r / 255, n = t.g / 255, r = t.b / 255, i = Math.min(e, n, r), o = Math.max(e, n, r), s = NaN, a = o - i, u = (o + i) / 2;
  return a ? (e === o ? s = (n - r) / a + (n < r) * 6 : n === o ? s = (r - e) / a + 2 : s = (e - n) / a + 4, a /= u < 0.5 ? o + i : 2 - o - i, s *= 60) : a = u > 0 && u < 1 ? 0 : s, new $t(s, a, u, t.opacity);
}
function Vh(t, e, n, r) {
  return arguments.length === 1 ? ra(t) : new $t(t, e, n, r ?? 1);
}
function $t(t, e, n, r) {
  this.h = +t, this.s = +e, this.l = +n, this.opacity = +r;
}
Ui($t, Vh, na(fr, {
  brighter(t) {
    return t = t == null ? Lr : Math.pow(Lr, t), new $t(this.h, this.s, this.l * t, this.opacity);
  },
  darker(t) {
    return t = t == null ? $n : Math.pow($n, t), new $t(this.h, this.s, this.l * t, this.opacity);
  },
  rgb() {
    var t = this.h % 360 + (this.h < 0) * 360, e = isNaN(t) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < 0.5 ? n : 1 - n) * e, i = 2 * n - r;
    return new Rt(
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
const ia = (t) => () => t;
function Xh(t, e) {
  return function(n) {
    return t + n * e;
  };
}
function Uh(t, e, n) {
  return t = Math.pow(t, n), e = Math.pow(e, n) - t, n = 1 / n, function(r) {
    return Math.pow(t + r * e, n);
  };
}
function qh(t) {
  return (t = +t) == 1 ? oa : function(e, n) {
    return n - e ? Uh(e, n, t) : ia(isNaN(e) ? n : e);
  };
}
function oa(t, e) {
  var n = e - t;
  return n ? Xh(t, n) : ia(isNaN(t) ? e : t);
}
const To = (function t(e) {
  var n = qh(e);
  function r(i, o) {
    var s = n((i = yi(i)).r, (o = yi(o)).r), a = n(i.g, o.g), u = n(i.b, o.b), f = oa(i.opacity, o.opacity);
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
var wi = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, ei = new RegExp(wi.source, "g");
function Gh(t) {
  return function() {
    return t;
  };
}
function Wh(t) {
  return function(e) {
    return t(e) + "";
  };
}
function Kh(t, e) {
  var n = wi.lastIndex = ei.lastIndex = 0, r, i, o, s = -1, a = [], u = [];
  for (t = t + "", e = e + ""; (r = wi.exec(t)) && (i = ei.exec(e)); )
    (o = i.index) > n && (o = e.slice(n, o), a[s] ? a[s] += o : a[++s] = o), (r = r[0]) === (i = i[0]) ? a[s] ? a[s] += i : a[++s] = i : (a[++s] = null, u.push({ i: s, x: Te(r, i) })), n = ei.lastIndex;
  return n < e.length && (o = e.slice(n), a[s] ? a[s] += o : a[++s] = o), a.length < 2 ? u[0] ? Wh(u[0].x) : Gh(e) : (e = u.length, function(f) {
    for (var c = 0, d; c < e; ++c) a[(d = u[c]).i] = d.x(f);
    return a.join("");
  });
}
var zo = 180 / Math.PI, xi = {
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
    rotate: Math.atan2(e, t) * zo,
    skewX: Math.atan(u) * zo,
    scaleX: s,
    scaleY: a
  };
}
var pr;
function Zh(t) {
  const e = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(t + "");
  return e.isIdentity ? xi : sa(e.a, e.b, e.c, e.d, e.e, e.f);
}
function Jh(t) {
  return t == null || (pr || (pr = document.createElementNS("http://www.w3.org/2000/svg", "g")), pr.setAttribute("transform", t), !(t = pr.transform.baseVal.consolidate())) ? xi : (t = t.matrix, sa(t.a, t.b, t.c, t.d, t.e, t.f));
}
function aa(t, e, n, r) {
  function i(f) {
    return f.length ? f.pop() + " " : "";
  }
  function o(f, c, d, h, g, _) {
    if (f !== d || c !== h) {
      var x = g.push("translate(", null, e, null, n);
      _.push({ i: x - 4, x: Te(f, d) }, { i: x - 2, x: Te(c, h) });
    } else (d || h) && g.push("translate(" + d + e + h + n);
  }
  function s(f, c, d, h) {
    f !== c ? (f - c > 180 ? c += 360 : c - f > 180 && (f += 360), h.push({ i: d.push(i(d) + "rotate(", null, r) - 2, x: Te(f, c) })) : c && d.push(i(d) + "rotate(" + c + r);
  }
  function a(f, c, d, h) {
    f !== c ? h.push({ i: d.push(i(d) + "skewX(", null, r) - 2, x: Te(f, c) }) : c && d.push(i(d) + "skewX(" + c + r);
  }
  function u(f, c, d, h, g, _) {
    if (f !== d || c !== h) {
      var x = g.push(i(g) + "scale(", null, ",", null, ")");
      _.push({ i: x - 4, x: Te(f, d) }, { i: x - 2, x: Te(c, h) });
    } else (d !== 1 || h !== 1) && g.push(i(g) + "scale(" + d + "," + h + ")");
  }
  return function(f, c) {
    var d = [], h = [];
    return f = t(f), c = t(c), o(f.translateX, f.translateY, c.translateX, c.translateY, d, h), s(f.rotate, c.rotate, d, h), a(f.skewX, c.skewX, d, h), u(f.scaleX, f.scaleY, c.scaleX, c.scaleY, d, h), f = c = null, function(g) {
      for (var _ = -1, x = h.length, T; ++_ < x; ) d[(T = h[_]).i] = T.x(g);
      return d.join("");
    };
  };
}
var Qh = aa(Zh, "px, ", "px)", "deg)"), jh = aa(Jh, ", ", ")", ")"), $h = 1e-12;
function Co(t) {
  return ((t = Math.exp(t)) + 1 / t) / 2;
}
function td(t) {
  return ((t = Math.exp(t)) - 1 / t) / 2;
}
function ed(t) {
  return ((t = Math.exp(2 * t)) - 1) / (t + 1);
}
const nd = (function t(e, n, r) {
  function i(o, s) {
    var a = o[0], u = o[1], f = o[2], c = s[0], d = s[1], h = s[2], g = c - a, _ = d - u, x = g * g + _ * _, T, E;
    if (x < $h)
      E = Math.log(h / f) / e, T = function(N) {
        return [
          a + N * g,
          u + N * _,
          f * Math.exp(e * N * E)
        ];
      };
    else {
      var B = Math.sqrt(x), I = (h * h - f * f + r * x) / (2 * f * n * B), y = (h * h - f * f - r * x) / (2 * h * n * B), P = Math.log(Math.sqrt(I * I + 1) - I), b = Math.log(Math.sqrt(y * y + 1) - y);
      E = (b - P) / e, T = function(N) {
        var R = N * E, H = Co(P), U = f / (n * B) * (H * ed(e * R + P) - td(P));
        return [
          a + U * g,
          u + U * _,
          f * H / Co(e * R + P)
        ];
      };
    }
    return T.duration = E * 1e3 * e / Math.SQRT2, T;
  }
  return i.rho = function(o) {
    var s = Math.max(1e-3, +o), a = s * s, u = a * a;
    return t(s, a, u);
  }, i;
})(Math.SQRT2, 2, 4);
var Ln = 0, Xn = 0, Dn = 0, la = 1e3, Or, Un, Dr = 0, on = 0, Wr = 0, nr = typeof performance == "object" && performance.now ? performance : Date, ua = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(t) {
  setTimeout(t, 17);
};
function qi() {
  return on || (ua(rd), on = nr.now() + Wr);
}
function rd() {
  on = 0;
}
function Yr() {
  this._call = this._time = this._next = null;
}
Yr.prototype = fa.prototype = {
  constructor: Yr,
  restart: function(t, e, n) {
    if (typeof t != "function") throw new TypeError("callback is not a function");
    n = (n == null ? qi() : +n) + (e == null ? 0 : +e), !this._next && Un !== this && (Un ? Un._next = this : Or = this, Un = this), this._call = t, this._time = n, bi();
  },
  stop: function() {
    this._call && (this._call = null, this._time = 1 / 0, bi());
  }
};
function fa(t, e, n) {
  var r = new Yr();
  return r.restart(t, e, n), r;
}
function id() {
  qi(), ++Ln;
  for (var t = Or, e; t; )
    (e = on - t._time) >= 0 && t._call.call(void 0, e), t = t._next;
  --Ln;
}
function Ro() {
  on = (Dr = nr.now()) + Wr, Ln = Xn = 0;
  try {
    id();
  } finally {
    Ln = 0, sd(), on = 0;
  }
}
function od() {
  var t = nr.now(), e = t - Dr;
  e > la && (Wr -= e, Dr = t);
}
function sd() {
  for (var t, e = Or, n, r = 1 / 0; e; )
    e._call ? (r > e._time && (r = e._time), t = e, e = e._next) : (n = e._next, e._next = null, e = t ? t._next = n : Or = n);
  Un = t, bi(r);
}
function bi(t) {
  if (!Ln) {
    Xn && (Xn = clearTimeout(Xn));
    var e = t - on;
    e > 24 ? (t < 1 / 0 && (Xn = setTimeout(Ro, t - nr.now() - Wr)), Dn && (Dn = clearInterval(Dn))) : (Dn || (Dr = nr.now(), Dn = setInterval(od, la)), Ln = 1, ua(Ro));
  }
}
function Lo(t, e, n) {
  var r = new Yr();
  return e = e == null ? 0 : +e, r.restart((i) => {
    r.stop(), t(i + e);
  }, e, n), r;
}
var ad = qr("start", "end", "cancel", "interrupt"), ld = [], ca = 0, Fo = 1, ki = 2, Sr = 3, Oo = 4, Ei = 5, Nr = 6;
function Kr(t, e, n, r, i, o) {
  var s = t.__transition;
  if (!s) t.__transition = {};
  else if (n in s) return;
  ud(t, n, {
    name: e,
    index: r,
    // For context during callback.
    group: i,
    // For context during callback.
    on: ad,
    tween: ld,
    time: o.time,
    delay: o.delay,
    duration: o.duration,
    ease: o.ease,
    timer: null,
    state: ca
  });
}
function Gi(t, e) {
  var n = ee(t, e);
  if (n.state > ca) throw new Error("too late; already scheduled");
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
function ud(t, e, n) {
  var r = t.__transition, i;
  r[e] = n, n.timer = fa(o, 0, n.time);
  function o(f) {
    n.state = Fo, n.timer.restart(s, n.delay, n.time), n.delay <= f && s(f - n.delay);
  }
  function s(f) {
    var c, d, h, g;
    if (n.state !== Fo) return u();
    for (c in r)
      if (g = r[c], g.name === n.name) {
        if (g.state === Sr) return Lo(s);
        g.state === Oo ? (g.state = Nr, g.timer.stop(), g.on.call("interrupt", t, t.__data__, g.index, g.group), delete r[c]) : +c < e && (g.state = Nr, g.timer.stop(), g.on.call("cancel", t, t.__data__, g.index, g.group), delete r[c]);
      }
    if (Lo(function() {
      n.state === Sr && (n.state = Oo, n.timer.restart(a, n.delay, n.time), a(f));
    }), n.state = ki, n.on.call("start", t, t.__data__, n.index, n.group), n.state === ki) {
      for (n.state = Sr, i = new Array(h = n.tween.length), c = 0, d = -1; c < h; ++c)
        (g = n.tween[c].value.call(t, t.__data__, n.index, n.group)) && (i[++d] = g);
      i.length = d + 1;
    }
  }
  function a(f) {
    for (var c = f < n.duration ? n.ease.call(null, f / n.duration) : (n.timer.restart(u), n.state = Ei, 1), d = -1, h = i.length; ++d < h; )
      i[d].call(t, c);
    n.state === Ei && (n.on.call("end", t, t.__data__, n.index, n.group), u());
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
      i = r.state > ki && r.state < Ei, r.state = Nr, r.timer.stop(), r.on.call(i ? "interrupt" : "cancel", t, t.__data__, r.index, r.group), delete n[s];
    }
    o && delete t.__transition;
  }
}
function fd(t) {
  return this.each(function() {
    Mr(this, t);
  });
}
function cd(t, e) {
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
function hd(t, e, n) {
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
function dd(t, e) {
  var n = this._id;
  if (t += "", arguments.length < 2) {
    for (var r = ee(this.node(), n).tween, i = 0, o = r.length, s; i < o; ++i)
      if ((s = r[i]).name === t)
        return s.value;
    return null;
  }
  return this.each((e == null ? cd : hd)(n, t, e));
}
function Wi(t, e, n) {
  var r = t._id;
  return t.each(function() {
    var i = ce(this, r);
    (i.value || (i.value = {}))[e] = n.apply(this, arguments);
  }), function(i) {
    return ee(i, r).value[e];
  };
}
function ha(t, e) {
  var n;
  return (typeof e == "number" ? Te : e instanceof er ? To : (n = er(e)) ? (e = n, To) : Kh)(t, e);
}
function gd(t) {
  return function() {
    this.removeAttribute(t);
  };
}
function vd(t) {
  return function() {
    this.removeAttributeNS(t.space, t.local);
  };
}
function md(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttribute(t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function _d(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = this.getAttributeNS(t.space, t.local);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function pd(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttribute(t) : (s = this.getAttribute(t), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function yd(t, e, n) {
  var r, i, o;
  return function() {
    var s, a = n(this), u;
    return a == null ? void this.removeAttributeNS(t.space, t.local) : (s = this.getAttributeNS(t.space, t.local), u = a + "", s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a)));
  };
}
function wd(t, e) {
  var n = Gr(t), r = n === "transform" ? jh : ha;
  return this.attrTween(t, typeof e == "function" ? (n.local ? yd : pd)(n, r, Wi(this, "attr." + t, e)) : e == null ? (n.local ? vd : gd)(n) : (n.local ? _d : md)(n, r, e));
}
function xd(t, e) {
  return function(n) {
    this.setAttribute(t, e.call(this, n));
  };
}
function bd(t, e) {
  return function(n) {
    this.setAttributeNS(t.space, t.local, e.call(this, n));
  };
}
function kd(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && bd(t, o)), n;
  }
  return i._value = e, i;
}
function Ed(t, e) {
  var n, r;
  function i() {
    var o = e.apply(this, arguments);
    return o !== r && (n = (r = o) && xd(t, o)), n;
  }
  return i._value = e, i;
}
function Sd(t, e) {
  var n = "attr." + t;
  if (arguments.length < 2) return (n = this.tween(n)) && n._value;
  if (e == null) return this.tween(n, null);
  if (typeof e != "function") throw new Error();
  var r = Gr(t);
  return this.tween(n, (r.local ? kd : Ed)(r, e));
}
function Nd(t, e) {
  return function() {
    Gi(this, t).delay = +e.apply(this, arguments);
  };
}
function Md(t, e) {
  return e = +e, function() {
    Gi(this, t).delay = e;
  };
}
function Ad(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Nd : Md)(e, t)) : ee(this.node(), e).delay;
}
function Id(t, e) {
  return function() {
    ce(this, t).duration = +e.apply(this, arguments);
  };
}
function Pd(t, e) {
  return e = +e, function() {
    ce(this, t).duration = e;
  };
}
function Td(t) {
  var e = this._id;
  return arguments.length ? this.each((typeof t == "function" ? Id : Pd)(e, t)) : ee(this.node(), e).duration;
}
function zd(t, e) {
  if (typeof e != "function") throw new Error();
  return function() {
    ce(this, t).ease = e;
  };
}
function Cd(t) {
  var e = this._id;
  return arguments.length ? this.each(zd(e, t)) : ee(this.node(), e).ease;
}
function Rd(t, e) {
  return function() {
    var n = e.apply(this, arguments);
    if (typeof n != "function") throw new Error();
    ce(this, t).ease = n;
  };
}
function Ld(t) {
  if (typeof t != "function") throw new Error();
  return this.each(Rd(this._id, t));
}
function Fd(t) {
  typeof t != "function" && (t = Us(t));
  for (var e = this._groups, n = e.length, r = new Array(n), i = 0; i < n; ++i)
    for (var o = e[i], s = o.length, a = r[i] = [], u, f = 0; f < s; ++f)
      (u = o[f]) && t.call(u, u.__data__, f, o) && a.push(u);
  return new be(r, this._parents, this._name, this._id);
}
function Od(t) {
  if (t._id !== this._id) throw new Error();
  for (var e = this._groups, n = t._groups, r = e.length, i = n.length, o = Math.min(r, i), s = new Array(r), a = 0; a < o; ++a)
    for (var u = e[a], f = n[a], c = u.length, d = s[a] = new Array(c), h, g = 0; g < c; ++g)
      (h = u[g] || f[g]) && (d[g] = h);
  for (; a < r; ++a)
    s[a] = e[a];
  return new be(s, this._parents, this._name, this._id);
}
function Dd(t) {
  return (t + "").trim().split(/^|\s+/).every(function(e) {
    var n = e.indexOf(".");
    return n >= 0 && (e = e.slice(0, n)), !e || e === "start";
  });
}
function Yd(t, e, n) {
  var r, i, o = Dd(e) ? Gi : ce;
  return function() {
    var s = o(this, t), a = s.on;
    a !== r && (i = (r = a).copy()).on(e, n), s.on = i;
  };
}
function Hd(t, e) {
  var n = this._id;
  return arguments.length < 2 ? ee(this.node(), n).on.on(t) : this.each(Yd(n, t, e));
}
function Bd(t) {
  return function() {
    var e = this.parentNode;
    for (var n in this.__transition) if (+n !== t) return;
    e && e.removeChild(this);
  };
}
function Vd() {
  return this.on("end.remove", Bd(this._id));
}
function Xd(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Vi(t));
  for (var r = this._groups, i = r.length, o = new Array(i), s = 0; s < i; ++s)
    for (var a = r[s], u = a.length, f = o[s] = new Array(u), c, d, h = 0; h < u; ++h)
      (c = a[h]) && (d = t.call(c, c.__data__, h, a)) && ("__data__" in c && (d.__data__ = c.__data__), f[h] = d, Kr(f[h], e, n, h, f, ee(c, n)));
  return new be(o, this._parents, e, n);
}
function Ud(t) {
  var e = this._name, n = this._id;
  typeof t != "function" && (t = Xs(t));
  for (var r = this._groups, i = r.length, o = [], s = [], a = 0; a < i; ++a)
    for (var u = r[a], f = u.length, c, d = 0; d < f; ++d)
      if (c = u[d]) {
        for (var h = t.call(c, c.__data__, d, u), g, _ = ee(c, n), x = 0, T = h.length; x < T; ++x)
          (g = h[x]) && Kr(g, e, n, x, h, _);
        o.push(h), s.push(c);
      }
  return new be(o, s, e, n);
}
var qd = ur.prototype.constructor;
function Gd() {
  return new qd(this._groups, this._parents);
}
function Wd(t, e) {
  var n, r, i;
  return function() {
    var o = Rn(this, t), s = (this.style.removeProperty(t), Rn(this, t));
    return o === s ? null : o === n && s === r ? i : i = e(n = o, r = s);
  };
}
function da(t) {
  return function() {
    this.style.removeProperty(t);
  };
}
function Kd(t, e, n) {
  var r, i = n + "", o;
  return function() {
    var s = Rn(this, t);
    return s === i ? null : s === r ? o : o = e(r = s, n);
  };
}
function Zd(t, e, n) {
  var r, i, o;
  return function() {
    var s = Rn(this, t), a = n(this), u = a + "";
    return a == null && (u = a = (this.style.removeProperty(t), Rn(this, t))), s === u ? null : s === r && u === i ? o : (i = u, o = e(r = s, a));
  };
}
function Jd(t, e) {
  var n, r, i, o = "style." + e, s = "end." + o, a;
  return function() {
    var u = ce(this, t), f = u.on, c = u.value[o] == null ? a || (a = da(e)) : void 0;
    (f !== n || i !== c) && (r = (n = f).copy()).on(s, i = c), u.on = r;
  };
}
function Qd(t, e, n) {
  var r = (t += "") == "transform" ? Qh : ha;
  return e == null ? this.styleTween(t, Wd(t, r)).on("end.style." + t, da(t)) : typeof e == "function" ? this.styleTween(t, Zd(t, r, Wi(this, "style." + t, e))).each(Jd(this._id, t)) : this.styleTween(t, Kd(t, r, e), n).on("end.style." + t, null);
}
function jd(t, e, n) {
  return function(r) {
    this.style.setProperty(t, e.call(this, r), n);
  };
}
function $d(t, e, n) {
  var r, i;
  function o() {
    var s = e.apply(this, arguments);
    return s !== i && (r = (i = s) && jd(t, s, n)), r;
  }
  return o._value = e, o;
}
function t0(t, e, n) {
  var r = "style." + (t += "");
  if (arguments.length < 2) return (r = this.tween(r)) && r._value;
  if (e == null) return this.tween(r, null);
  if (typeof e != "function") throw new Error();
  return this.tween(r, $d(t, e, n ?? ""));
}
function e0(t) {
  return function() {
    this.textContent = t;
  };
}
function n0(t) {
  return function() {
    var e = t(this);
    this.textContent = e ?? "";
  };
}
function r0(t) {
  return this.tween("text", typeof t == "function" ? n0(Wi(this, "text", t)) : e0(t == null ? "" : t + ""));
}
function i0(t) {
  return function(e) {
    this.textContent = t.call(this, e);
  };
}
function o0(t) {
  var e, n;
  function r() {
    var i = t.apply(this, arguments);
    return i !== n && (e = (n = i) && i0(i)), e;
  }
  return r._value = t, r;
}
function s0(t) {
  var e = "text";
  if (arguments.length < 1) return (e = this.tween(e)) && e._value;
  if (t == null) return this.tween(e, null);
  if (typeof t != "function") throw new Error();
  return this.tween(e, o0(t));
}
function a0() {
  for (var t = this._name, e = this._id, n = ga(), r = this._groups, i = r.length, o = 0; o < i; ++o)
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
  return new be(r, this._parents, t, n);
}
function l0() {
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
var u0 = 0;
function be(t, e, n, r) {
  this._groups = t, this._parents = e, this._name = n, this._id = r;
}
function ga() {
  return ++u0;
}
var ge = ur.prototype;
be.prototype = {
  constructor: be,
  select: Xd,
  selectAll: Ud,
  selectChild: ge.selectChild,
  selectChildren: ge.selectChildren,
  filter: Fd,
  merge: Od,
  selection: Gd,
  transition: a0,
  call: ge.call,
  nodes: ge.nodes,
  node: ge.node,
  size: ge.size,
  empty: ge.empty,
  each: ge.each,
  on: Hd,
  attr: wd,
  attrTween: Sd,
  style: Qd,
  styleTween: t0,
  text: r0,
  textTween: s0,
  remove: Vd,
  tween: dd,
  delay: Ad,
  duration: Td,
  ease: Cd,
  easeVarying: Ld,
  end: l0,
  [Symbol.iterator]: ge[Symbol.iterator]
};
function f0(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}
var c0 = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: f0
};
function h0(t, e) {
  for (var n; !(n = t.__transition) || !(n = n[e]); )
    if (!(t = t.parentNode))
      throw new Error(`transition ${e} not found`);
  return n;
}
function d0(t) {
  var e, n;
  t instanceof be ? (e = t._id, t = t._name) : (e = ga(), (n = c0).time = qi(), t = t == null ? null : t + "");
  for (var r = this._groups, i = r.length, o = 0; o < i; ++o)
    for (var s = r[o], a = s.length, u, f = 0; f < a; ++f)
      (u = s[f]) && Kr(u, t, e, f, s, n || h0(u, e));
  return new be(r, this._parents, t, e);
}
ur.prototype.interrupt = fd;
ur.prototype.transition = d0;
const yr = (t) => () => t;
function g0(t, {
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
function ye(t, e, n) {
  this.k = t, this.x = e, this.y = n;
}
ye.prototype = {
  constructor: ye,
  scale: function(t) {
    return t === 1 ? this : new ye(this.k * t, this.x, this.y);
  },
  translate: function(t, e) {
    return t === 0 & e === 0 ? this : new ye(this.k, this.x + this.k * t, this.y + this.k * e);
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
var va = new ye(1, 0, 0);
ye.prototype;
function ni(t) {
  t.stopImmediatePropagation();
}
function Yn(t) {
  t.preventDefault(), t.stopImmediatePropagation();
}
function v0(t) {
  return (!t.ctrlKey || t.type === "wheel") && !t.button;
}
function m0() {
  var t = this;
  return t instanceof SVGElement ? (t = t.ownerSVGElement || t, t.hasAttribute("viewBox") ? (t = t.viewBox.baseVal, [[t.x, t.y], [t.x + t.width, t.y + t.height]]) : [[0, 0], [t.width.baseVal.value, t.height.baseVal.value]]) : [[0, 0], [t.clientWidth, t.clientHeight]];
}
function Do() {
  return this.__zoom || va;
}
function _0(t) {
  return -t.deltaY * (t.deltaMode === 1 ? 0.05 : t.deltaMode ? 1 : 2e-3) * (t.ctrlKey ? 10 : 1);
}
function p0() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function y0(t, e, n) {
  var r = t.invertX(e[0][0]) - n[0][0], i = t.invertX(e[1][0]) - n[1][0], o = t.invertY(e[0][1]) - n[0][1], s = t.invertY(e[1][1]) - n[1][1];
  return t.translate(
    i > r ? (r + i) / 2 : Math.min(0, r) || Math.max(0, i),
    s > o ? (o + s) / 2 : Math.min(0, o) || Math.max(0, s)
  );
}
function w0() {
  var t = v0, e = m0, n = y0, r = _0, i = p0, o = [0, 1 / 0], s = [[-1 / 0, -1 / 0], [1 / 0, 1 / 0]], a = 250, u = nd, f = qr("start", "zoom", "end"), c, d, h, g = 500, _ = 150, x = 0, T = 10;
  function E(m) {
    m.property("__zoom", Do).on("wheel.zoom", R, { passive: !1 }).on("mousedown.zoom", H).on("dblclick.zoom", U).filter(i).on("touchstart.zoom", G).on("touchmove.zoom", it).on("touchend.zoom touchcancel.zoom", O).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  E.transform = function(m, k, w, A) {
    var C = m.selection ? m.selection() : m;
    C.property("__zoom", Do), m !== C ? P(m, k, w, A) : C.interrupt().each(function() {
      b(this, arguments).event(A).start().zoom(null, typeof k == "function" ? k.apply(this, arguments) : k).end();
    });
  }, E.scaleBy = function(m, k, w, A) {
    E.scaleTo(m, function() {
      var C = this.__zoom.k, V = typeof k == "function" ? k.apply(this, arguments) : k;
      return C * V;
    }, w, A);
  }, E.scaleTo = function(m, k, w, A) {
    E.transform(m, function() {
      var C = e.apply(this, arguments), V = this.__zoom, q = w == null ? y(C) : typeof w == "function" ? w.apply(this, arguments) : w, Q = V.invert(q), S = typeof k == "function" ? k.apply(this, arguments) : k;
      return n(I(B(V, S), q, Q), C, s);
    }, w, A);
  }, E.translateBy = function(m, k, w, A) {
    E.transform(m, function() {
      return n(this.__zoom.translate(
        typeof k == "function" ? k.apply(this, arguments) : k,
        typeof w == "function" ? w.apply(this, arguments) : w
      ), e.apply(this, arguments), s);
    }, null, A);
  }, E.translateTo = function(m, k, w, A, C) {
    E.transform(m, function() {
      var V = e.apply(this, arguments), q = this.__zoom, Q = A == null ? y(V) : typeof A == "function" ? A.apply(this, arguments) : A;
      return n(va.translate(Q[0], Q[1]).scale(q.k).translate(
        typeof k == "function" ? -k.apply(this, arguments) : -k,
        typeof w == "function" ? -w.apply(this, arguments) : -w
      ), V, s);
    }, A, C);
  };
  function B(m, k) {
    return k = Math.max(o[0], Math.min(o[1], k)), k === m.k ? m : new ye(k, m.x, m.y);
  }
  function I(m, k, w) {
    var A = k[0] - w[0] * m.k, C = k[1] - w[1] * m.k;
    return A === m.x && C === m.y ? m : new ye(m.k, A, C);
  }
  function y(m) {
    return [(+m[0][0] + +m[1][0]) / 2, (+m[0][1] + +m[1][1]) / 2];
  }
  function P(m, k, w, A) {
    m.on("start.zoom", function() {
      b(this, arguments).event(A).start();
    }).on("interrupt.zoom end.zoom", function() {
      b(this, arguments).event(A).end();
    }).tween("zoom", function() {
      var C = this, V = arguments, q = b(C, V).event(A), Q = e.apply(C, V), S = w == null ? y(Q) : typeof w == "function" ? w.apply(C, V) : w, L = Math.max(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), F = C.__zoom, Y = typeof k == "function" ? k.apply(C, V) : k, K = u(F.invert(S).concat(L / F.k), Y.invert(S).concat(L / Y.k));
      return function(M) {
        if (M === 1) M = Y;
        else {
          var z = K(M), Z = L / z[2];
          M = new ye(Z, S[0] - z[0] * Z, S[1] - z[1] * Z);
        }
        q.zoom(null, M);
      };
    });
  }
  function b(m, k, w) {
    return !w && m.__zooming || new N(m, k);
  }
  function N(m, k) {
    this.that = m, this.args = k, this.active = 0, this.sourceEvent = null, this.extent = e.apply(m, k), this.taps = 0;
  }
  N.prototype = {
    event: function(m) {
      return m && (this.sourceEvent = m), this;
    },
    start: function() {
      return ++this.active === 1 && (this.that.__zooming = this, this.emit("start")), this;
    },
    zoom: function(m, k) {
      return this.mouse && m !== "mouse" && (this.mouse[1] = k.invert(this.mouse[0])), this.touch0 && m !== "touch" && (this.touch0[1] = k.invert(this.touch0[0])), this.touch1 && m !== "touch" && (this.touch1[1] = k.invert(this.touch1[0])), this.that.__zoom = k, this.emit("zoom"), this;
    },
    end: function() {
      return --this.active === 0 && (delete this.that.__zooming, this.emit("end")), this;
    },
    emit: function(m) {
      var k = zt(this.that).datum();
      f.call(
        m,
        this.that,
        new g0(m, {
          sourceEvent: this.sourceEvent,
          target: E,
          transform: this.that.__zoom,
          dispatch: f
        }),
        k
      );
    }
  };
  function R(m, ...k) {
    if (!t.apply(this, arguments)) return;
    var w = b(this, k).event(m), A = this.__zoom, C = Math.max(o[0], Math.min(o[1], A.k * Math.pow(2, r.apply(this, arguments)))), V = me(m);
    if (w.wheel)
      (w.mouse[0][0] !== V[0] || w.mouse[0][1] !== V[1]) && (w.mouse[1] = A.invert(w.mouse[0] = V)), clearTimeout(w.wheel);
    else {
      if (A.k === C) return;
      w.mouse = [V, A.invert(V)], Mr(this), w.start();
    }
    Yn(m), w.wheel = setTimeout(q, _), w.zoom("mouse", n(I(B(A, C), w.mouse[0], w.mouse[1]), w.extent, s));
    function q() {
      w.wheel = null, w.end();
    }
  }
  function H(m, ...k) {
    if (h || !t.apply(this, arguments)) return;
    var w = m.currentTarget, A = b(this, k, !0).event(m), C = zt(m.view).on("mousemove.zoom", S, !0).on("mouseup.zoom", L, !0), V = me(m, w), q = m.clientX, Q = m.clientY;
    ta(m.view), ni(m), A.mouse = [V, this.__zoom.invert(V)], Mr(this), A.start();
    function S(F) {
      if (Yn(F), !A.moved) {
        var Y = F.clientX - q, K = F.clientY - Q;
        A.moved = Y * Y + K * K > x;
      }
      A.event(F).zoom("mouse", n(I(A.that.__zoom, A.mouse[0] = me(F, w), A.mouse[1]), A.extent, s));
    }
    function L(F) {
      C.on("mousemove.zoom mouseup.zoom", null), ea(F.view, A.moved), Yn(F), A.event(F).end();
    }
  }
  function U(m, ...k) {
    if (t.apply(this, arguments)) {
      var w = this.__zoom, A = me(m.changedTouches ? m.changedTouches[0] : m, this), C = w.invert(A), V = w.k * (m.shiftKey ? 0.5 : 2), q = n(I(B(w, V), A, C), e.apply(this, k), s);
      Yn(m), a > 0 ? zt(this).transition().duration(a).call(P, q, A, m) : zt(this).call(E.transform, q, A, m);
    }
  }
  function G(m, ...k) {
    if (t.apply(this, arguments)) {
      var w = m.touches, A = w.length, C = b(this, k, m.changedTouches.length === A).event(m), V, q, Q, S;
      for (ni(m), q = 0; q < A; ++q)
        Q = w[q], S = me(Q, this), S = [S, this.__zoom.invert(S), Q.identifier], C.touch0 ? !C.touch1 && C.touch0[2] !== S[2] && (C.touch1 = S, C.taps = 0) : (C.touch0 = S, V = !0, C.taps = 1 + !!c);
      c && (c = clearTimeout(c)), V && (C.taps < 2 && (d = S[0], c = setTimeout(function() {
        c = null;
      }, g)), Mr(this), C.start());
    }
  }
  function it(m, ...k) {
    if (this.__zooming) {
      var w = b(this, k).event(m), A = m.changedTouches, C = A.length, V, q, Q, S;
      for (Yn(m), V = 0; V < C; ++V)
        q = A[V], Q = me(q, this), w.touch0 && w.touch0[2] === q.identifier ? w.touch0[0] = Q : w.touch1 && w.touch1[2] === q.identifier && (w.touch1[0] = Q);
      if (q = w.that.__zoom, w.touch1) {
        var L = w.touch0[0], F = w.touch0[1], Y = w.touch1[0], K = w.touch1[1], M = (M = Y[0] - L[0]) * M + (M = Y[1] - L[1]) * M, z = (z = K[0] - F[0]) * z + (z = K[1] - F[1]) * z;
        q = B(q, Math.sqrt(M / z)), Q = [(L[0] + Y[0]) / 2, (L[1] + Y[1]) / 2], S = [(F[0] + K[0]) / 2, (F[1] + K[1]) / 2];
      } else if (w.touch0) Q = w.touch0[0], S = w.touch0[1];
      else return;
      w.zoom("touch", n(I(q, Q, S), w.extent, s));
    }
  }
  function O(m, ...k) {
    if (this.__zooming) {
      var w = b(this, k).event(m), A = m.changedTouches, C = A.length, V, q;
      for (ni(m), h && clearTimeout(h), h = setTimeout(function() {
        h = null;
      }, g), V = 0; V < C; ++V)
        q = A[V], w.touch0 && w.touch0[2] === q.identifier ? delete w.touch0 : w.touch1 && w.touch1[2] === q.identifier && delete w.touch1;
      if (w.touch1 && !w.touch0 && (w.touch0 = w.touch1, delete w.touch1), w.touch0) w.touch0[1] = this.__zoom.invert(w.touch0[0]);
      else if (w.end(), w.taps === 2 && (q = me(q, this), Math.hypot(d[0] - q[0], d[1] - q[1]) < T)) {
        var Q = zt(this).on("dblclick.zoom");
        Q && Q.apply(this, arguments);
      }
    }
  }
  return E.wheelDelta = function(m) {
    return arguments.length ? (r = typeof m == "function" ? m : yr(+m), E) : r;
  }, E.filter = function(m) {
    return arguments.length ? (t = typeof m == "function" ? m : yr(!!m), E) : t;
  }, E.touchable = function(m) {
    return arguments.length ? (i = typeof m == "function" ? m : yr(!!m), E) : i;
  }, E.extent = function(m) {
    return arguments.length ? (e = typeof m == "function" ? m : yr([[+m[0][0], +m[0][1]], [+m[1][0], +m[1][1]]]), E) : e;
  }, E.scaleExtent = function(m) {
    return arguments.length ? (o[0] = +m[0], o[1] = +m[1], E) : [o[0], o[1]];
  }, E.translateExtent = function(m) {
    return arguments.length ? (s[0][0] = +m[0][0], s[1][0] = +m[1][0], s[0][1] = +m[0][1], s[1][1] = +m[1][1], E) : [[s[0][0], s[0][1]], [s[1][0], s[1][1]]];
  }, E.constrain = function(m) {
    return arguments.length ? (n = m, E) : n;
  }, E.duration = function(m) {
    return arguments.length ? (a = +m, E) : a;
  }, E.interpolate = function(m) {
    return arguments.length ? (u = m, E) : u;
  }, E.on = function() {
    var m = f.on.apply(f, arguments);
    return m === f ? E : m;
  }, E.clickDistance = function(m) {
    return arguments.length ? (x = (m = +m) * m, E) : Math.sqrt(x);
  }, E.tapDistance = function(m) {
    return arguments.length ? (T = +m, E) : T;
  }, E;
}
function x0(t) {
  if (t.length === 0) return "";
  const [e, ...n] = t;
  if (!e) return "";
  let r = `M ${e.x} ${e.y}`;
  for (const i of n)
    r += ` L ${i.x} ${i.y}`;
  return r;
}
const Hn = 12;
function b0(t) {
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
function k0(t) {
  if (!t || t.length === 0) return;
  const e = t.reduce((n, r) => n + r, 0);
  return Yo[e % Yo.length];
}
var E0 = /* @__PURE__ */ lt('<path fill="none" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke="white" stroke-linecap="round" pointer-events="none"></path><path fill="none" stroke-linecap="round" pointer-events="none"></path>', 1), S0 = /* @__PURE__ */ lt('<path class="link" fill="none" stroke-linecap="round" pointer-events="none"></path>'), N0 = /* @__PURE__ */ lt('<text class="link-label" text-anchor="middle"> </text>'), M0 = /* @__PURE__ */ lt('<text class="link-label" text-anchor="middle"> </text>'), A0 = /* @__PURE__ */ lt("<!><!>", 1), I0 = /* @__PURE__ */ lt('<g class="link-group"><!><path fill="none" stroke="transparent" stroke-linecap="round" class="link-hit"></path><!></g>');
function P0(t, e) {
  an(e, !0);
  let n = wt(e, "selected", 3, !1), r = wt(e, "interactive", 3, !1);
  const i = /* @__PURE__ */ D(() => x0(e.edge.points)), o = /* @__PURE__ */ D(() => e.edge.link), s = /* @__PURE__ */ D(() => {
    var b;
    return ((b = l(o)) == null ? void 0 : b.type) ?? "solid";
  }), a = /* @__PURE__ */ D(() => () => {
    var b, N;
    switch (l(s)) {
      case "dashed":
        return "5 3";
      default:
        return ((N = (b = l(o)) == null ? void 0 : b.style) == null ? void 0 : N.strokeDasharray) ?? "";
    }
  }), u = /* @__PURE__ */ D(() => {
    var b, N, R;
    return n() ? e.colors.selection : ((N = (b = l(o)) == null ? void 0 : b.style) == null ? void 0 : N.stroke) ?? k0((R = l(o)) == null ? void 0 : R.vlan) ?? e.colors.linkStroke;
  }), f = /* @__PURE__ */ D(() => l(s) === "double"), c = /* @__PURE__ */ D(() => () => {
    var N;
    return (N = l(o)) != null && N.label ? [Array.isArray(l(o).label) ? l(o).label.join(" / ") : l(o).label] : [];
  }), d = /* @__PURE__ */ D(() => () => {
    var b;
    return !((b = l(o)) != null && b.vlan) || l(o).vlan.length === 0 ? "" : l(o).vlan.length === 1 ? `VLAN ${l(o).vlan[0]}` : `VLAN ${l(o).vlan.join(", ")}`;
  }), h = /* @__PURE__ */ D(() => () => {
    if (e.edge.points.length < 2) return null;
    const b = Math.floor(e.edge.points.length / 2), N = e.edge.points[b - 1], R = e.edge.points[b];
    return !N || !R ? null : { x: (N.x + R.x) / 2, y: (N.y + R.y) / 2 };
  });
  function g(b) {
    var N;
    r() && (b.stopPropagation(), (N = e.onselect) == null || N.call(e, e.edge.id));
  }
  function _(b) {
    var N, R;
    r() && (b.preventDefault(), b.stopPropagation(), (N = e.onselect) == null || N.call(e, e.edge.id), (R = e.oncontextmenu) == null || R.call(e, e.edge.id, b));
  }
  var x = I0(), T = dt(x);
  {
    var E = (b) => {
      const N = /* @__PURE__ */ D(() => Math.max(3, Math.round(e.edge.width * 0.9)));
      var R = E0(), H = It(R), U = nt(H), G = nt(U);
      at(
        (it, O) => {
          v(H, "d", l(i)), v(H, "stroke", l(u)), v(H, "stroke-width", e.edge.width + l(N) * 2), v(U, "d", l(i)), v(U, "stroke-width", it), v(G, "d", l(i)), v(G, "stroke", l(u)), v(G, "stroke-width", O);
        },
        [
          () => Math.max(1, e.edge.width),
          () => Math.max(1, e.edge.width - Math.round(l(N) * 0.8))
        ]
      ), tt(b, R);
    }, B = (b) => {
      var N = S0();
      at(
        (R) => {
          v(N, "d", l(i)), v(N, "stroke", l(u)), v(N, "stroke-width", e.edge.width), v(N, "stroke-dasharray", R);
        },
        [() => l(a)() || void 0]
      ), tt(b, N);
    };
    pt(T, (b) => {
      l(f) ? b(E) : b(B, !1);
    });
  }
  var I = nt(T);
  I.__click = g, I.__contextmenu = _;
  var y = nt(I);
  {
    var P = (b) => {
      const N = /* @__PURE__ */ D(() => l(h)());
      var R = ve(), H = It(R);
      {
        var U = (G) => {
          const it = /* @__PURE__ */ D(() => l(c)()), O = /* @__PURE__ */ D(() => l(d)());
          var m = A0(), k = It(m);
          Ve(k, 17, () => l(it), As, (C, V, q) => {
            var Q = N0(), S = dt(Q);
            at(() => {
              v(Q, "x", l(N).x), v(Q, "y", l(N).y - 8 + q * 12), Jn(S, l(V));
            }), tt(C, Q);
          });
          var w = nt(k);
          {
            var A = (C) => {
              var V = M0(), q = dt(V);
              at(() => {
                v(V, "x", l(N).x), v(V, "y", l(N).y - 8 + l(it).length * 12), Jn(q, l(O));
              }), tt(C, V);
            };
            pt(w, (C) => {
              l(O) && C(A);
            });
          }
          tt(G, m);
        };
        pt(H, (G) => {
          l(N) && G(U);
        });
      }
      tt(b, R);
    };
    pt(y, (b) => {
      l(h)() && b(P);
    });
  }
  at(
    (b) => {
      v(x, "data-link-id", e.edge.id), v(I, "d", l(i)), v(I, "stroke-width", b);
    },
    [() => Math.max(e.edge.width + 12, 16)]
  ), tt(t, x), ln();
}
lr(["click", "contextmenu"]);
var T0 = /* @__PURE__ */ lt('<line stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"></line>');
function z0(t, e) {
  var n = T0();
  at(() => {
    v(n, "x1", e.fromX), v(n, "y1", e.fromY), v(n, "x2", e.toX), v(n, "y2", e.toY);
  }), tt(t, n);
}
var C0 = /* @__PURE__ */ lt('<rect rx="8" ry="8"></rect>'), R0 = /* @__PURE__ */ lt("<rect></rect>"), L0 = /* @__PURE__ */ lt("<circle></circle>"), F0 = /* @__PURE__ */ lt("<polygon></polygon>"), O0 = /* @__PURE__ */ lt("<polygon></polygon>"), D0 = /* @__PURE__ */ lt('<g><ellipse></ellipse><rect stroke="none"></rect><line></line><line></line><ellipse></ellipse></g>'), Y0 = /* @__PURE__ */ lt("<rect></rect>"), H0 = /* @__PURE__ */ lt("<polygon></polygon>"), B0 = /* @__PURE__ */ lt('<rect rx="8" ry="8"></rect>'), V0 = /* @__PURE__ */ lt('<g class="node-icon"><svg viewBox="0 0 24 24" fill="currentColor"><!></svg></g>'), X0 = /* @__PURE__ */ lt('<text text-anchor="middle"> </text>'), U0 = /* @__PURE__ */ lt('<rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect><rect fill="transparent" class="edge-zone"></rect>', 1), q0 = /* @__PURE__ */ lt('<circle r="7" fill="#3b82f6" opacity="0.8" pointer-events="none"></circle><text text-anchor="middle" dominant-baseline="central" font-size="11" fill="white" pointer-events="none">+</text>', 1), G0 = /* @__PURE__ */ lt('<g class="node"><g class="node-bg"><!></g><g class="node-fg" pointer-events="none"><!><!></g><!><!></g>');
function W0(t, e) {
  an(e, !0);
  let n = wt(e, "shadowFilterId", 3, "node-shadow"), r = wt(e, "selected", 3, !1), i = wt(e, "interactive", 3, !1);
  const o = /* @__PURE__ */ D(() => e.node.position.x), s = /* @__PURE__ */ D(() => e.node.position.y), a = /* @__PURE__ */ D(() => e.node.size.width / 2), u = /* @__PURE__ */ D(() => e.node.size.height / 2), f = /* @__PURE__ */ D(() => e.node.node.shape ?? "rounded");
  let c = /* @__PURE__ */ ht(!1);
  const d = /* @__PURE__ */ D(() => r() || l(c)), h = /* @__PURE__ */ D(() => {
    var M;
    return ((M = e.node.node.style) == null ? void 0 : M.fill) ?? (l(d) ? e.colors.nodeHoverFill : e.colors.nodeFill);
  }), g = /* @__PURE__ */ D(() => {
    var M;
    return r() ? e.colors.selection : ((M = e.node.node.style) == null ? void 0 : M.stroke) ?? (l(c) ? e.colors.nodeHoverStroke : e.colors.nodeStroke);
  }), _ = /* @__PURE__ */ D(() => {
    var M;
    return r() ? 2.5 : ((M = e.node.node.style) == null ? void 0 : M.strokeWidth) ?? (l(c) ? 2 : 1.5);
  }), x = /* @__PURE__ */ D(() => {
    var M;
    return ((M = e.node.node.style) == null ? void 0 : M.strokeDasharray) ?? "";
  }), T = /* @__PURE__ */ D(() => jl(e.node.node.type)), E = Wl, B = /* @__PURE__ */ D(() => Array.isArray(e.node.node.label) ? e.node.node.label : [e.node.node.label ?? ""]), I = /* @__PURE__ */ D(() => l(B).map((M, z) => {
    const Z = M.includes("<b>") || M.includes("<strong>"), W = M.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, ""), ut = z > 0 && !Z;
    return { text: W, className: Z ? "node-label node-label-bold" : ut ? "node-label-secondary" : "node-label" };
  })), y = /* @__PURE__ */ D(() => l(T) ? E : 0), P = /* @__PURE__ */ D(() => l(y) > 0 ? Kl : 0), b = /* @__PURE__ */ D(() => l(I).length * Qr), N = /* @__PURE__ */ D(() => l(y) + l(P) + l(b)), R = /* @__PURE__ */ D(() => l(s) - l(N) / 2), H = /* @__PURE__ */ D(() => l(R) + l(y) + l(P) + Qr * 0.7);
  let U = /* @__PURE__ */ ht(null);
  function G(M, z) {
    const Z = z.currentTarget.getBoundingClientRect();
    if (M === "top" || M === "bottom") {
      const W = Math.max(0, Math.min(1, (z.clientX - Z.left) / Z.width));
      X(
        U,
        {
          side: M,
          x: l(o) - l(a) + W * e.node.size.width,
          y: M === "top" ? l(s) - l(u) : l(s) + l(u)
        },
        !0
      );
    } else {
      const W = Math.max(0, Math.min(1, (z.clientY - Z.top) / Z.height));
      X(
        U,
        {
          side: M,
          x: M === "left" ? l(o) - l(a) : l(o) + l(a),
          y: l(s) - l(u) + W * e.node.size.height
        },
        !0
      );
    }
  }
  function it(M) {
    var z;
    l(U) && (M.stopPropagation(), M.preventDefault(), (z = e.onaddport) == null || z.call(e, e.node.id, l(U).side));
  }
  function O(M) {
    var z;
    i() && (M.preventDefault(), M.stopPropagation(), (z = e.oncontextmenu) == null || z.call(e, e.node.id, M));
  }
  var m = G0();
  m.__contextmenu = O;
  var k = dt(m), w = dt(k);
  {
    var A = (M) => {
      var z = C0();
      at(() => {
        v(z, "x", l(o) - l(a)), v(z, "y", l(s) - l(u)), v(z, "width", e.node.size.width), v(z, "height", e.node.size.height), v(z, "fill", l(h)), v(z, "stroke", l(g)), v(z, "stroke-width", l(_)), v(z, "stroke-dasharray", l(x) || void 0);
      }), tt(M, z);
    }, C = (M) => {
      var z = ve(), Z = It(z);
      {
        var W = (ot) => {
          var ft = R0();
          at(() => {
            v(ft, "x", l(o) - l(a)), v(ft, "y", l(s) - l(u)), v(ft, "width", e.node.size.width), v(ft, "height", e.node.size.height), v(ft, "fill", l(h)), v(ft, "stroke", l(g)), v(ft, "stroke-width", l(_)), v(ft, "stroke-dasharray", l(x) || void 0);
          }), tt(ot, ft);
        }, ut = (ot) => {
          var ft = ve(), he = It(ft);
          {
            var ma = (un) => {
              var ne = L0();
              at(
                (Zr) => {
                  v(ne, "cx", l(o)), v(ne, "cy", l(s)), v(ne, "r", Zr), v(ne, "fill", l(h)), v(ne, "stroke", l(g)), v(ne, "stroke-width", l(_));
                },
                [() => Math.min(l(a), l(u))]
              ), tt(un, ne);
            }, _a = (un) => {
              var ne = ve(), Zr = It(ne);
              {
                var pa = (fn) => {
                  var Me = F0();
                  at(() => {
                    v(Me, "points", `${l(o) ?? ""},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) ?? ""},${l(s) + l(u)} ${l(o) - l(a)},${l(s) ?? ""}`), v(Me, "fill", l(h)), v(Me, "stroke", l(g)), v(Me, "stroke-width", l(_));
                  }), tt(fn, Me);
                }, ya = (fn) => {
                  var Me = ve(), wa = It(Me);
                  {
                    var xa = (cn) => {
                      const He = /* @__PURE__ */ D(() => l(a) * 0.866);
                      var Be = O0();
                      at(() => {
                        v(Be, "points", `${l(o) - l(a)},${l(s) ?? ""} ${l(o) - l(He)},${l(s) - l(u)} ${l(o) + l(He)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) ?? ""} ${l(o) + l(He)},${l(s) + l(u)} ${l(o) - l(He)},${l(s) + l(u)}`), v(Be, "fill", l(h)), v(Be, "stroke", l(g)), v(Be, "stroke-width", l(_));
                      }), tt(cn, Be);
                    }, ba = (cn) => {
                      var He = ve(), Be = It(He);
                      {
                        var ka = (hn) => {
                          const Ft = /* @__PURE__ */ D(() => e.node.size.height * 0.15);
                          var cr = D0(), re = dt(cr), Ae = nt(re), Mt = nt(Ae), ct = nt(Mt), de = nt(ct);
                          at(() => {
                            v(re, "cx", l(o)), v(re, "cy", l(s) + l(u) - l(Ft)), v(re, "rx", l(a)), v(re, "ry", l(Ft)), v(re, "fill", l(h)), v(re, "stroke", l(g)), v(re, "stroke-width", l(_)), v(Ae, "x", l(o) - l(a)), v(Ae, "y", l(s) - l(u) + l(Ft)), v(Ae, "width", e.node.size.width), v(Ae, "height", e.node.size.height - l(Ft) * 2), v(Ae, "fill", l(h)), v(Mt, "x1", l(o) - l(a)), v(Mt, "y1", l(s) - l(u) + l(Ft)), v(Mt, "x2", l(o) - l(a)), v(Mt, "y2", l(s) + l(u) - l(Ft)), v(Mt, "stroke", l(g)), v(Mt, "stroke-width", l(_)), v(ct, "x1", l(o) + l(a)), v(ct, "y1", l(s) - l(u) + l(Ft)), v(ct, "x2", l(o) + l(a)), v(ct, "y2", l(s) + l(u) - l(Ft)), v(ct, "stroke", l(g)), v(ct, "stroke-width", l(_)), v(de, "cx", l(o)), v(de, "cy", l(s) - l(u) + l(Ft)), v(de, "rx", l(a)), v(de, "ry", l(Ft)), v(de, "fill", l(h)), v(de, "stroke", l(g)), v(de, "stroke-width", l(_));
                          }), tt(hn, cr);
                        }, Ea = (hn) => {
                          var Ft = ve(), cr = It(Ft);
                          {
                            var re = (Mt) => {
                              var ct = Y0();
                              at(() => {
                                v(ct, "x", l(o) - l(a)), v(ct, "y", l(s) - l(u)), v(ct, "width", e.node.size.width), v(ct, "height", e.node.size.height), v(ct, "rx", l(u)), v(ct, "ry", l(u)), v(ct, "fill", l(h)), v(ct, "stroke", l(g)), v(ct, "stroke-width", l(_));
                              }), tt(Mt, ct);
                            }, Ae = (Mt) => {
                              var ct = ve(), de = It(ct);
                              {
                                var Sa = (dn) => {
                                  const Zt = /* @__PURE__ */ D(() => e.node.size.width * 0.15);
                                  var On = H0();
                                  at(() => {
                                    v(On, "points", `${l(o) - l(a) + l(Zt)},${l(s) - l(u)} ${l(o) + l(a) - l(Zt)},${l(s) - l(u)} ${l(o) + l(a)},${l(s) + l(u)} ${l(o) - l(a)},${l(s) + l(u)}`), v(On, "fill", l(h)), v(On, "stroke", l(g)), v(On, "stroke-width", l(_));
                                  }), tt(dn, On);
                                }, Na = (dn) => {
                                  var Zt = B0();
                                  at(() => {
                                    v(Zt, "x", l(o) - l(a)), v(Zt, "y", l(s) - l(u)), v(Zt, "width", e.node.size.width), v(Zt, "height", e.node.size.height), v(Zt, "fill", l(h)), v(Zt, "stroke", l(g)), v(Zt, "stroke-width", l(_));
                                  }), tt(dn, Zt);
                                };
                                pt(
                                  de,
                                  (dn) => {
                                    l(f) === "trapezoid" ? dn(Sa) : dn(Na, !1);
                                  },
                                  !0
                                );
                              }
                              tt(Mt, ct);
                            };
                            pt(
                              cr,
                              (Mt) => {
                                l(f) === "stadium" ? Mt(re) : Mt(Ae, !1);
                              },
                              !0
                            );
                          }
                          tt(hn, Ft);
                        };
                        pt(
                          Be,
                          (hn) => {
                            l(f) === "cylinder" ? hn(ka) : hn(Ea, !1);
                          },
                          !0
                        );
                      }
                      tt(cn, He);
                    };
                    pt(
                      wa,
                      (cn) => {
                        l(f) === "hexagon" ? cn(xa) : cn(ba, !1);
                      },
                      !0
                    );
                  }
                  tt(fn, Me);
                };
                pt(
                  Zr,
                  (fn) => {
                    l(f) === "diamond" ? fn(pa) : fn(ya, !1);
                  },
                  !0
                );
              }
              tt(un, ne);
            };
            pt(
              he,
              (un) => {
                l(f) === "circle" ? un(ma) : un(_a, !1);
              },
              !0
            );
          }
          tt(ot, ft);
        };
        pt(
          Z,
          (ot) => {
            l(f) === "rect" ? ot(W) : ot(ut, !1);
          },
          !0
        );
      }
      tt(M, z);
    };
    pt(w, (M) => {
      l(f) === "rounded" ? M(A) : M(C, !1);
    });
  }
  var V = nt(k), q = dt(V);
  {
    var Q = (M) => {
      var z = V0(), Z = dt(z), W = dt(Z);
      Is(W, () => l(T), !0), at(() => {
        v(z, "transform", `translate(${l(o) - E / 2}, ${l(R) ?? ""})`), v(Z, "width", E), v(Z, "height", E);
      }), tt(M, z);
    };
    pt(q, (M) => {
      l(T) && M(Q);
    });
  }
  var S = nt(q);
  Ve(S, 17, () => l(I), As, (M, z, Z) => {
    var W = X0(), ut = dt(W);
    at(() => {
      v(W, "x", l(o)), v(W, "y", l(H) + Z * Qr), Di(W, 0, Fl(l(z).className)), Jn(ut, l(z).text);
    }), tt(M, W);
  });
  var L = nt(V);
  {
    var F = (M) => {
      const z = /* @__PURE__ */ D(() => 10);
      var Z = U0(), W = It(Z);
      v(W, "height", l(z)), W.__pointermove = (he) => G("top", he), W.__pointerdown = it;
      var ut = nt(W);
      v(ut, "height", l(z)), ut.__pointermove = (he) => G("bottom", he), ut.__pointerdown = it;
      var ot = nt(ut);
      v(ot, "width", l(z)), ot.__pointermove = (he) => G("left", he), ot.__pointerdown = it;
      var ft = nt(ot);
      v(ft, "width", l(z)), ft.__pointermove = (he) => G("right", he), ft.__pointerdown = it, at(() => {
        v(W, "x", l(o) - l(a)), v(W, "y", l(s) - l(u) - l(z) / 2), v(W, "width", e.node.size.width), v(ut, "x", l(o) - l(a)), v(ut, "y", l(s) + l(u) - l(z) / 2), v(ut, "width", e.node.size.width), v(ot, "x", l(o) - l(a) - l(z) / 2), v(ot, "y", l(s) - l(u)), v(ot, "height", e.node.size.height), v(ft, "x", l(o) + l(a) - l(z) / 2), v(ft, "y", l(s) - l(u)), v(ft, "height", e.node.size.height);
      }), Pe("pointerleave", W, () => {
        X(U, null);
      }), Pe("pointerleave", ut, () => {
        X(U, null);
      }), Pe("pointerleave", ot, () => {
        X(U, null);
      }), Pe("pointerleave", ft, () => {
        X(U, null);
      }), tt(M, Z);
    };
    pt(L, (M) => {
      i() && l(c) && M(F);
    });
  }
  var Y = nt(L);
  {
    var K = (M) => {
      var z = q0(), Z = It(z), W = nt(Z);
      at(() => {
        v(Z, "cx", l(U).x), v(Z, "cy", l(U).y), v(W, "x", l(U).x), v(W, "y", l(U).y);
      }), tt(M, z);
    };
    pt(Y, (M) => {
      l(U) && M(K);
    });
  }
  at(() => {
    v(m, "data-id", e.node.id), v(m, "data-device-type", e.node.node.type ?? ""), v(m, "filter", `url(#${n() ?? ""})`);
  }), Pe("pointerenter", m, () => {
    i() && X(c, !0);
  }), Pe("pointerleave", m, () => {
    X(c, !1);
  }), tt(t, m), ln();
}
lr(["contextmenu", "pointermove", "pointerdown"]);
var K0 = /* @__PURE__ */ lt('<rect class="port-label-bg" rx="2" pointer-events="none"></rect><text class="port-label-text" font-size="9"> </text>', 1), Z0 = /* @__PURE__ */ lt('<g class="port"><rect fill="transparent"></rect><rect class="port-box" rx="2" pointer-events="none"></rect><!></g>');
function J0(t, e) {
  an(e, !0);
  let n = wt(e, "hideLabel", 3, !1), r = wt(e, "selected", 3, !1), i = wt(e, "interactive", 3, !1), o = wt(e, "linked", 3, !1);
  const s = /* @__PURE__ */ D(() => e.port.absolutePosition.x), a = /* @__PURE__ */ D(() => e.port.absolutePosition.y), u = /* @__PURE__ */ D(() => e.port.size.width), f = /* @__PURE__ */ D(() => e.port.size.height), c = /* @__PURE__ */ D(() => b0(e.port)), d = /* @__PURE__ */ D(() => e.port.label.length * Zl + 4), h = 12, g = /* @__PURE__ */ D(() => () => l(c).textAnchor === "middle" ? l(c).x - l(d) / 2 : l(c).textAnchor === "end" ? l(c).x - l(d) + 2 : l(c).x - 2), _ = /* @__PURE__ */ D(() => l(c).y - h + 3);
  let x = /* @__PURE__ */ ht(!1);
  function T(R) {
    var H, U;
    !i() || R.button !== 0 || (R.stopPropagation(), R.preventDefault(), o() ? (H = e.onselect) == null || H.call(e, e.port.id) : (U = e.onlinkstart) == null || U.call(e, e.port.id, l(s), l(a)));
  }
  function E(R) {
    var H;
    i() && (R.stopPropagation(), (H = e.onlinkend) == null || H.call(e, e.port.id));
  }
  function B(R) {
    var H;
    i() && (R.preventDefault(), R.stopPropagation(), (H = e.oncontextmenu) == null || H.call(e, e.port.id, R));
  }
  var I = Z0();
  I.__contextmenu = B;
  var y = dt(I);
  v(y, "width", 24), v(y, "height", 24), y.__pointerdown = T, y.__pointerup = E;
  var P = nt(y), b = nt(P);
  {
    var N = (R) => {
      var H = K0(), U = It(H);
      v(U, "height", h);
      var G = nt(U);
      G.__click = (O) => {
        var m;
        i() && (O.stopPropagation(), (m = e.onlabeledit) == null || m.call(e, e.port.id, e.port.label, O.clientX, O.clientY));
      };
      var it = dt(G);
      at(
        (O) => {
          v(U, "x", O), v(U, "y", l(_)), v(U, "width", l(d)), v(U, "fill", e.colors.portLabelBg), v(G, "x", l(c).x), v(G, "y", l(c).y), v(G, "text-anchor", l(c).textAnchor), v(G, "fill", e.colors.portLabelColor), Jn(it, e.port.label);
        },
        [() => l(g)()]
      ), tt(R, H);
    };
    pt(b, (R) => {
      n() || R(N);
    });
  }
  at(() => {
    v(I, "data-port", e.port.id), v(I, "data-port-device", e.port.nodeId), Di(y, 0, `port-hit ${o() ? "linked" : ""}`), v(y, "x", l(s) - 12), v(y, "y", l(a) - 12), v(P, "x", l(s) - l(u) / 2 - (r() || l(x) ? 2 : 0)), v(P, "y", l(a) - l(f) / 2 - (r() || l(x) ? 2 : 0)), v(P, "width", l(u) + (r() || l(x) ? 4 : 0)), v(P, "height", l(f) + (r() || l(x) ? 4 : 0)), v(P, "fill", r() ? e.colors.selection : l(x) ? "#3b82f6" : e.colors.portFill), v(P, "stroke", r() ? e.colors.selection : l(x) ? "#2563eb" : e.colors.portStroke), v(P, "stroke-width", r() || l(x) ? 2 : 1);
  }), Pe("pointerenter", I, () => {
    X(x, i());
  }), Pe("pointerleave", I, () => {
    X(x, !1);
  }), tt(t, I), ln();
}
lr(["contextmenu", "pointerdown", "pointerup", "click"]);
var Q0 = /* @__PURE__ */ lt('<g class="subgraph"><rect class="subgraph-bg" rx="12" ry="12"></rect><rect fill="transparent"></rect><text class="subgraph-label" text-anchor="start" pointer-events="none"> </text></g>');
function j0(t, e) {
  an(e, !0);
  let n = wt(e, "selected", 3, !1);
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
    const g = l(r).fill, _ = l(r).stroke;
    if (g && i.includes(g) && e.theme) {
      const x = e.theme.colors.surfaces[g];
      return {
        fill: x.fill,
        stroke: _ ?? x.stroke,
        text: x.text
      };
    }
    return {
      fill: g ?? e.colors.subgraphFill,
      stroke: _ ?? e.colors.subgraphStroke,
      text: e.colors.subgraphText
    };
  }), s = /* @__PURE__ */ D(() => l(r).strokeWidth ?? 3), a = /* @__PURE__ */ D(() => l(r).strokeDasharray ?? "");
  var u = Q0(), f = dt(u);
  f.__click = (g) => {
    var _;
    g.stopPropagation(), (_ = e.onselect) == null || _.call(e, e.subgraph.id);
  };
  var c = nt(f);
  v(c, "height", 28);
  var d = nt(c), h = dt(d);
  at(
    (g, _, x) => {
      v(u, "data-id", e.subgraph.id), v(f, "x", e.subgraph.bounds.x), v(f, "y", e.subgraph.bounds.y), v(f, "width", e.subgraph.bounds.width), v(f, "height", e.subgraph.bounds.height), v(f, "fill", g), v(f, "stroke", _), v(f, "stroke-width", n() ? 3 : l(s)), v(f, "stroke-dasharray", n() ? void 0 : l(a) || void 0), v(c, "data-sg-drag", e.subgraph.id), v(c, "x", e.subgraph.bounds.x), v(c, "y", e.subgraph.bounds.y), v(c, "width", e.subgraph.bounds.width), v(d, "x", e.subgraph.bounds.x + 10), v(d, "y", e.subgraph.bounds.y + 20), v(d, "fill", x), Jn(h, e.subgraph.subgraph.label);
    },
    [
      () => l(o)().fill,
      () => n() ? "#3b82f6" : l(o)().stroke,
      () => l(o)().text
    ]
  ), tt(t, u), ln();
}
lr(["click"]);
var $0 = /* @__PURE__ */ lt('<svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7"></polygon></marker><filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"></feDropShadow></filter><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke-width="0.5"></path></pattern></defs><!><g class="viewport"><rect class="canvas-bg" x="-99999" y="-99999" width="199998" height="199998" fill="url(#grid)"></rect><!><!><!><!><!></g></svg>');
function tg(t, e) {
  an(e, !0);
  let n = wt(e, "interactive", 3, !1), r = wt(e, "selection", 19, () => /* @__PURE__ */ new Set()), i = wt(e, "linkedPorts", 19, () => /* @__PURE__ */ new Set()), o = wt(e, "linkPreview", 3, null), s = wt(e, "svgEl", 15, null);
  const a = /* @__PURE__ */ D(() => `${e.bounds.x - 50} ${e.bounds.y - 50} ${e.bounds.width + 100} ${e.bounds.height + 100}`), u = /* @__PURE__ */ D(() => [...e.nodes.values()]), f = /* @__PURE__ */ D(() => [...e.edges.values()]), c = /* @__PURE__ */ D(() => [...e.subgraphs.values()]), d = /* @__PURE__ */ D(() => {
    const O = /* @__PURE__ */ new Map();
    for (const m of e.ports.values()) {
      const k = O.get(m.nodeId);
      k ? k.push(m) : O.set(m.nodeId, [m]);
    }
    return O;
  });
  let h = /* @__PURE__ */ ht(void 0);
  Ir(() => {
    if (!s() || !l(h)) return;
    const O = zt(s()), m = w0().scaleExtent([0.2, 10]).filter((k) => k.type === "wheel" ? !0 : k.type === "mousedown" || k.type === "pointerdown" ? k.button === 1 || k.altKey : !1).on("zoom", (k) => {
      l(h) && l(h).setAttribute("transform", k.transform.toString());
    });
    return O.call(m), O.on("contextmenu.zoom", null), () => {
      O.on(".zoom", null);
    };
  }), Ir(() => {
    if (l(u).length, l(c).length, !s() || !n()) return;
    const O = bo().filter((k) => {
      const w = k.target;
      return w.closest(".port") || w.closest("[data-droplet]") ? !1 : k.button === 0;
    }).on("drag", function(k) {
      var C;
      const w = this.getAttribute("data-id");
      if (!w) return;
      const A = e.nodes.get(w);
      A && ((C = e.onnodedragmove) == null || C.call(e, w, A.position.x + k.dx, A.position.y + k.dy));
    });
    zt(s()).selectAll(".node[data-id]").call(O);
    const m = bo().on("drag", function(k) {
      var C;
      const w = this.getAttribute("data-sg-drag");
      if (!w) return;
      const A = e.subgraphs.get(w);
      A && ((C = e.onsubgraphmove) == null || C.call(e, w, A.bounds.x + k.dx, A.bounds.y + k.dy));
    });
    return zt(s()).selectAll("[data-sg-drag]").call(m), () => {
      zt(s()).selectAll(".node[data-id]").on(".drag", null), zt(s()).selectAll("[data-sg-drag]").on(".drag", null);
    };
  });
  var g = $0();
  let _;
  var x = dt(g), T = dt(x), E = dt(T), B = nt(T, 2), I = dt(B), y = nt(x);
  Is(
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
  var P = nt(y), b = dt(P);
  b.__click = () => {
    var O;
    return (O = e.onbackgroundclick) == null ? void 0 : O.call(e);
  };
  var N = nt(b);
  Ve(N, 17, () => l(c), (O) => O.id, (O, m) => {
    {
      let k = /* @__PURE__ */ D(() => r().has(l(m).id));
      j0(O, {
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
          return l(k);
        },
        get onselect() {
          return e.onsubgraphselect;
        }
      });
    }
  });
  var R = nt(N);
  Ve(R, 17, () => l(f), (O) => O.id, (O, m) => {
    {
      let k = /* @__PURE__ */ D(() => r().has(l(m).id));
      P0(O, {
        get edge() {
          return l(m);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(k);
        },
        get interactive() {
          return n();
        },
        get onselect() {
          return e.onedgeselect;
        },
        oncontextmenu: (w, A) => {
          var C;
          return (C = e.oncontextmenu) == null ? void 0 : C.call(e, w, "edge", A);
        }
      });
    }
  });
  var H = nt(R);
  Ve(H, 17, () => l(u), (O) => O.id, (O, m) => {
    {
      let k = /* @__PURE__ */ D(() => r().has(l(m).id));
      W0(O, {
        get node() {
          return l(m);
        },
        get colors() {
          return e.colors;
        },
        get selected() {
          return l(k);
        },
        get interactive() {
          return n();
        },
        get onaddport() {
          return e.onaddport;
        },
        oncontextmenu: (w, A) => {
          var C;
          return (C = e.oncontextmenu) == null ? void 0 : C.call(e, w, "node", A);
        }
      });
    }
  });
  var U = nt(H);
  Ve(U, 17, () => l(u), (O) => O.id, (O, m) => {
    var k = ve(), w = It(k);
    Ve(w, 17, () => l(d).get(l(m).id) ?? [], (A) => A.id, (A, C) => {
      {
        let V = /* @__PURE__ */ D(() => r().has(l(C).id)), q = /* @__PURE__ */ D(() => i().has(l(C).id));
        J0(A, {
          get port() {
            return l(C);
          },
          get colors() {
            return e.colors;
          },
          get selected() {
            return l(V);
          },
          get interactive() {
            return n();
          },
          get linked() {
            return l(q);
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
          oncontextmenu: (Q, S) => {
            var L;
            return (L = e.oncontextmenu) == null ? void 0 : L.call(e, Q, "port", S);
          }
        });
      }
    }), tt(O, k);
  });
  var G = nt(U);
  {
    var it = (O) => {
      z0(O, {
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
    pt(G, (O) => {
      o() && O(it);
    });
  }
  lo(P, (O) => X(h, O), () => l(h)), lo(g, (O) => s(O), () => s()), at(() => {
    v(g, "viewBox", l(a)), Yl(g, `width: 100%; height: 100%; user-select: none; background: ${e.colors.background ?? ""};`), _ = Di(g, 0, "", null, _, { interactive: n() }), v(E, "fill", e.colors.linkStroke), v(I, "stroke", e.colors.grid), v(b, "pointer-events", n() ? "fill" : "none");
  }), tt(t, g), ln();
}
lr(["click"]);
var eg = /* @__PURE__ */ Sl('<div style="width: 100%; height: 100%; outline: none;"><!></div>');
function ng(t, e) {
  var Q;
  an(e, !0);
  let n = wt(e, "theme", 3, void 0), r = wt(e, "mode", 3, "view");
  const i = /* @__PURE__ */ D(() => Xf(n())), o = /* @__PURE__ */ D(() => r() === "edit");
  let s = /* @__PURE__ */ ht(Tt(new Map(e.layout.nodes))), a = /* @__PURE__ */ ht(Tt(new Map(e.layout.ports))), u = /* @__PURE__ */ ht(Tt(new Map(e.layout.edges))), f = /* @__PURE__ */ ht(Tt(new Map(e.layout.subgraphs))), c = Tt(e.layout.bounds), d = /* @__PURE__ */ ht(Tt((Q = e.graph) != null && Q.links ? [...e.graph.links] : [])), h = /* @__PURE__ */ ht(Tt(/* @__PURE__ */ new Set())), g = /* @__PURE__ */ ht(null), _ = /* @__PURE__ */ ht(null);
  const x = /* @__PURE__ */ D(() => {
    const S = /* @__PURE__ */ new Set();
    for (const L of l(u).values())
      L.fromPortId && S.add(L.fromPortId), L.toPortId && S.add(L.toPortId);
    return S;
  });
  Ir(() => {
    if (!l(o) || !l(_)) return;
    const S = l(_);
    return S.addEventListener("keydown", A), () => S.removeEventListener("keydown", A);
  }), Ir(() => {
    var S, L;
    if (l(h).size === 0)
      (S = e.onselect) == null || S.call(e, null, null);
    else {
      const F = [...l(h)][0] ?? null;
      if (!F) return;
      let Y = "node";
      l(u).has(F) ? Y = "edge" : l(a).has(F) ? Y = "port" : l(f).has(F) && (Y = "subgraph"), (L = e.onselect) == null || L.call(e, F, Y);
    }
  });
  async function T(S, L, F) {
    const Y = await mu(
      S,
      L,
      F,
      {
        nodes: l(s),
        ports: l(a),
        subgraphs: l(f)
      },
      l(d)
    );
    Y && (X(s, Y.nodes, !0), X(a, Y.ports, !0), X(u, Y.edges, !0), Y.subgraphs && X(f, Y.subgraphs, !0));
  }
  async function E(S, L) {
    const F = ku(S, L, l(s), l(a), l(d));
    F && (X(s, F.nodes, !0), X(a, F.ports, !0), X(u, await Wn(F.nodes, F.ports, l(d)), !0));
  }
  async function B(S, L, F) {
    const Y = await _u(
      S,
      L,
      F,
      {
        nodes: l(s),
        ports: l(a),
        subgraphs: l(f)
      },
      l(d)
    );
    Y && (X(s, Y.nodes, !0), X(a, Y.ports, !0), X(u, Y.edges, !0), X(f, Y.subgraphs, !0));
  }
  let I = null;
  function y(S, L, F) {
    var z, Z;
    X(g, { fromPortId: S, fromX: L, fromY: F, toX: L, toY: F }, !0);
    function Y(W) {
      if (!l(g) || !l(_)) return;
      const ot = (l(_).querySelector(".viewport") ?? l(_)).getScreenCTM();
      if (!ot) return;
      const ft = new DOMPoint(W.clientX, W.clientY).matrixTransform(ot.inverse());
      X(g, { ...l(g), toX: ft.x, toY: ft.y }, !0);
    }
    function K(W) {
      W.target.closest(".port") || M();
    }
    function M() {
      var W, ut;
      (W = l(_)) == null || W.removeEventListener("pointermove", Y), (ut = l(_)) == null || ut.removeEventListener("pointerup", K), X(g, null), I = null;
    }
    I = M, (z = l(_)) == null || z.addEventListener("pointermove", Y), (Z = l(_)) == null || Z.addEventListener("pointerup", K);
  }
  function P(S) {
    if (!l(g)) return;
    const L = l(g).fromPortId;
    if (I == null || I(), L === S) return;
    const F = l(a).get(L), Y = l(a).get(S);
    F && Y && F.nodeId === Y.nodeId || b(L, S);
  }
  async function b(S, L) {
    var ot;
    const F = S.split(":"), Y = L.split(":");
    let K = F[0] ?? "", M = F.slice(1).join(":"), z = Y[0] ?? "", Z = Y.slice(1).join(":");
    if (!K || !M || !z || !Z || pu(l(d), K, M, z, Z)) return;
    const W = l(s).get(K), ut = l(s).get(z);
    W && ut && W.position.y > ut.position.y && ([K, z] = [z, K], [M, Z] = [Z, M]), X(
      d,
      [
        ...l(d),
        {
          id: `link-${Date.now()}`,
          from: { node: K, port: M },
          to: { node: z, port: Z }
        }
      ],
      !0
    ), X(u, await Wn(l(s), l(a), l(d)), !0), (ot = e.onchange) == null || ot.call(e, l(d));
  }
  function N(S) {
    X(h, /* @__PURE__ */ new Set([S]), !0);
  }
  function R(S) {
    X(h, /* @__PURE__ */ new Set([S]), !0);
  }
  function H(S) {
    X(h, /* @__PURE__ */ new Set([S]), !0);
  }
  function U() {
    X(h, /* @__PURE__ */ new Set(), !0);
  }
  function G(S, L, F, Y) {
    var K;
    (K = e.onlabeledit) == null || K.call(e, S, L, F, Y);
  }
  function it(S, L, F) {
    var Y;
    X(h, /* @__PURE__ */ new Set([S]), !0), (Y = e.oncontextmenu) == null || Y.call(e, S, L, F.clientX, F.clientY);
  }
  function O(S) {
    const L = `node-${Date.now()}`, F = 180, Y = 80, K = [...l(h)].find((ot) => l(f).has(ot)), M = K ? l(f).get(K) : void 0;
    let z, Z;
    M ? (z = K, Z = (S == null ? void 0 : S.position) ?? {
      x: M.bounds.x + M.bounds.width / 2,
      y: M.bounds.y + M.bounds.height / 2
    }) : Z = (S == null ? void 0 : S.position) ?? {
      x: c.x + c.width + 20 + F / 2,
      y: c.y + c.height / 2
    };
    const W = new Map(l(s));
    W.set(L, {
      id: L,
      position: Z,
      size: { width: F, height: Y },
      node: {
        id: L,
        label: (S == null ? void 0 : S.label) ?? "New Node",
        shape: "rounded",
        parent: z
      }
    });
    const ut = Fs(L, Z.x, Z.y, W, 8, l(f));
    if (W.set(L, { ...W.get(L), position: ut }), X(s, W, !0), z) {
      const ot = new Map(l(f));
      Cr(W, ot, l(a)), X(f, ot, !0);
    }
    return X(h, /* @__PURE__ */ new Set([L]), !0), L;
  }
  function m(S) {
    const L = `sg-${Date.now()}`, F = 200, Y = 120, K = (S == null ? void 0 : S.position) ?? {
      x: c.x + c.width + 20 + F / 2,
      y: c.y + c.height / 2
    }, M = new Map(l(f));
    return M.set(L, {
      id: L,
      bounds: {
        x: K.x - F / 2,
        y: K.y - Y / 2,
        width: F,
        height: Y
      },
      subgraph: { id: L, label: (S == null ? void 0 : S.label) ?? "New Group" }
    }), Cr(l(s), M, l(a)), X(f, M, !0), L;
  }
  function k(S, L) {
    const F = l(a).get(S);
    if (!F || L === F.label) return;
    const Y = new Map(l(a));
    Y.set(S, { ...F, label: L }), X(a, Y, !0);
  }
  function w() {
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
  function A(S) {
    var L, F;
    if (S.key === "Delete" || S.key === "Backspace") {
      for (const Y of l(h))
        if (l(u).has(Y)) {
          const K = l(u).get(Y);
          (L = K == null ? void 0 : K.link) != null && L.id && X(d, l(d).filter((M) => {
            var z;
            return M.id !== ((z = K.link) == null ? void 0 : z.id);
          }), !0);
        } else if (l(a).has(Y)) {
          const K = Eu(Y, l(s), l(a), l(d));
          K && (X(s, K.nodes, !0), X(a, K.ports, !0), X(d, K.links, !0));
        }
      Wn(l(s), l(a), l(d)).then((Y) => {
        X(u, Y, !0);
      }), X(h, /* @__PURE__ */ new Set(), !0), (F = e.onchange) == null || F.call(e, l(d));
    }
    S.key === "Escape" && (X(h, /* @__PURE__ */ new Set(), !0), X(g, null));
  }
  var C = { addNewNode: O, addNewSubgraph: m, commitLabel: k, getSnapshot: w }, V = eg(), q = dt(V);
  return tg(q, {
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
      return l(x);
    },
    get linkPreview() {
      return l(g);
    },
    onnodedragmove: T,
    onaddport: E,
    onlinkstart: y,
    onlinkend: P,
    onedgeselect: N,
    onportselect: R,
    onlabeledit: G,
    onsubgraphselect: H,
    onsubgraphmove: B,
    oncontextmenu: it,
    onbackgroundclick: U,
    get svgEl() {
      return l(_);
    },
    set svgEl(S) {
      X(_, S, !0);
    }
  }), tt(t, V), ln(C);
}
const gt = Tt({
  layout: {
    nodes: /* @__PURE__ */ new Map(),
    ports: /* @__PURE__ */ new Map(),
    edges: /* @__PURE__ */ new Map(),
    subgraphs: /* @__PURE__ */ new Map(),
    bounds: { x: 0, y: 0, width: 0, height: 0 }
  }
});
class rg extends HTMLElement {
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
    this._instance && (ro(this._instance), this._instance = null, this._mounted = !1);
  }
  _mount() {
    this.shadowRoot && (this._instance && ro(this._instance), this._instance = Il(ng, { target: this.shadowRoot, props: gt }), this._mounted = !0);
  }
}
typeof window < "u" && (customElements.get("shumoku-renderer") || customElements.define("shumoku-renderer", rg));
export {
  rg as ShumokuRendererElement
};
