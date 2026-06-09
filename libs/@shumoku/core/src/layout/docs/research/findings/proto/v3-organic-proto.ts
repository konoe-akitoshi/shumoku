// Round-3 A-refine: dependency-tree FOREST (not rigid tier bands).
// Each core router roots a tidy subtree; children hang directly below their parent
// (dependency reads vertically); subtrees pack via shared leaf-cursor (uses 2D space,
// not one wide row per tier). Tree edges solid; non-tree (redundancy/mesh/cross) faded.
// Deterministic. Throwaway. Run from repo root → writes tmp-test6-v3.svg
type G = { nodes: any[]; links: any[] }
const g: G = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const ids = g.nodes.map((n) => n.id)
const node = new Map(g.nodes.map((n) => [n.id, n]))
const label = (id: string) => (node.get(id)?.label || id).toString()
const dtype = (id: string) => (node.get(id)?.spec?.type || node.get(id)?.spec?.kind || '?').toString()

// ==== metadata signals (organic-friendly): location → apex hint + zone clustering ====
// location is the ONLY clean structured axis (hostGroups is all-"Backbone Routers" = useless).
// We do NOT snap nodes to location rows (that would be the macro/grid trap). location supplies just
// two things connectivity can't: which nodes are top-of-stack (apex) and which belong together (zone).
const locOf = (id: string) => (node.get(id)?.metadata?.location || '').toString()
const zoneOf = (id: string) => locOf(id) || 'unzoned'
// coarse tier ONLY to seed the apex + a gentle y-prior; the real y emerges from relaxation.
function locTier(id: string): number {
  const l = locOf(id)
  let m: RegExpMatchArray | null
  if ((m = l.match(/^NOC#N-(\d+)/))) return +m[1] // backbone spine: 1,2 top → 3 → 6 → 7 → 12
  if ((m = l.match(/^NOC#D-(\d+)/))) return 20 + +m[1] // datacenter, below backbone
  if ((m = l.match(/^NOC#S-(\d+)/))) return 30 + +m[1] // service / 5g
  if (l.startsWith('Pod#')) return 40 // access pods
  if (l.startsWith('Stage')) return 45 // staging
  return 50
}

// v3: deterministic "organic" jitter via golden-ratio additive sequence (R-sequence) — NO RNG.
// Same hierarchical FORM as v2 (Burch root-top, dependency reads vertically), but break the
// rigid grid snap so it reads hand-drawn rather than ruler-drawn. Jitter stays within bounds
// so depth bands and sibling order are preserved.
const idIndex = new Map(ids.map((id, i) => [id, i]))
const PHI = 1.618033988749895
const rseq = (id: string, salt = 0) => (((idIndex.get(id) ?? 0) + 1) * (1 / PHI) + salt * 0.3719) % 1

// collapse parallels
const ep = (x: any) => (x && x.node) || x?.source || x
const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const logical = new Map<string, { a: string; b: string; mult: number; bw: number }>()
for (const l of g.links) {
  const a = ep(l.from),
    b = ep(l.to)
  if (a == null || b == null || a === b || !node.has(a) || !node.has(b)) continue
  const k = pk(a, b)
  const bw = l.rateBps || l.metadata?.speedBps || 0
  const e = logical.get(k)
  if (e) {
    e.mult++
    e.bw += bw
  } else logical.set(k, { a: a < b ? a : b, b: a < b ? b : a, mult: 1, bw })
}
const edges = [...logical.values()]
const nbr = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]))
for (const e of edges) {
  nbr.get(e.a)!.add(e.b)
  nbr.get(e.b)!.add(e.a)
}
const bwBetween = new Map<string, number>()
for (const e of edges) bwBetween.set(pk(e.a, e.b), e.bw)

// ==== hierarchy: apex DERIVED from metadata (top-of-stack = lowest NOC#N tier), undirected BFS.
// The reference diagram puts the NOC#N-1/N-2 backbone routers at the top facing External; the spine
// (N-3) sits below. So apex = the minimum-tier NOC#N nodes — no hardcoded names. from/to unused.
const sinks = new Set(ids.filter((id) => label(id).includes('lastresort')))
const isSink = (id: string) => sinks.has(id)
const nocN = ids.filter((id) => !isSink(id) && /^NOC#N-/.test(locOf(id)))
const minNocTier = Math.min(...nocN.map(locTier))
// apex = top backbone tier (within one step of the minimum): groups NOC#N-1 & N-2 (border row),
// leaves N-3 (spine) as their children — matches the reference's two backbone rows.
let roots = nocN.filter((id) => locTier(id) <= minNocTier + 1)
const dist = new Map<string, number>(ids.map((id) => [id, Infinity]))
const q: string[] = []
for (const r of [...roots].sort()) {
  dist.set(r, 0)
  q.push(r)
}
while (q.length) {
  const u = q.shift()!
  if (isSink(u)) continue
  for (const w of [...nbr.get(u)!].sort())
    if (!isSink(w) && dist.get(w)! > dist.get(u)! + 1) {
      dist.set(w, dist.get(u)! + 1)
      q.push(w)
    }
}
for (const id of ids) if (!isSink(id) && dist.get(id)! === Infinity) dist.set(id, 0) // disconnected
// parent = lower-dist neighbor with max bandwidth (deterministic)
const parent = new Map<string, string | null>(ids.map((id) => [id, null]))
for (const id of ids) {
  if (isSink(id) || roots.includes(id)) continue
  const cands = [...nbr.get(id)!].filter((w) => !isSink(w) && dist.get(w)! < dist.get(id)!)
  if (cands.length)
    parent.set(
      id,
      cands.sort(
        (a, b) =>
          (bwBetween.get(pk(id, b)) || 0) - (bwBetween.get(pk(id, a)) || 0) ||
          dist.get(a)! - dist.get(b)! ||
          (a < b ? -1 : 1),
      )[0],
    )
}
roots = ids.filter((id) => !isSink(id) && parent.get(id) === null)
const rootSet = new Set(roots)
const children = new Map<string, string[]>(ids.map((id) => [id, []]))
for (const id of ids) {
  const p = parent.get(id)
  if (p) children.get(p)!.push(id)
}
for (const id of ids) children.get(id)!.sort()
console.log(`roots (derived: top NOC#N tier): ${roots.map((r) => `${label(r)}[${locOf(r)}]`).join(', ')}`)
{
  const zs = [...new Set(ids.filter((id) => !isSink(id)).map(zoneOf))]
  console.log(`zones: ${zs.length} (${zs.slice(0, 8).join(', ')}…)`)
}

const isTree = (e: { a: string; b: string }) => parent.get(e.a) === e.b || parent.get(e.b) === e.a

// ==== v3 PLACEMENT: local-polar growth + force relaxation (meet-in-the-middle) ====
const NODE_H = 26
const nw = (id: string) => Math.max(58, label(id).length * 6.1 + 14)
const X = new Map<string, number>(),
  Y = new Map<string, number>()
const depthOf = (id: string) => (dist.get(id) === Infinity ? 0 : dist.get(id)!)
const blocks: { ox: number; oy: number; w: number; h: number; members: string[] }[] = [] // none in organic mode

// leaf budget for angular allocation (bigger subtree → wider arc)
const leafCount = new Map<string, number>()
function countLeaves(id: string): number {
  const ch = children.get(id)!
  if (!ch.length) {
    leafCount.set(id, 1)
    return 1
  }
  let s = 0
  for (const c of ch) s += countLeaves(c)
  leafCount.set(id, s)
  return s
}
for (const r of roots) countLeaves(r)

// subtree membership — for sibling ordering by external-link barycenter (crossing reduction)
const subtree = new Map<string, Set<string>>()
function buildSubtree(id: string): Set<string> {
  const s = new Set<string>([id])
  for (const c of children.get(id)!) for (const x of buildSubtree(c)) s.add(x)
  subtree.set(id, s)
  return s
}
for (const r of roots) buildSubtree(r)

// position-independent sets (shared across all candidates)
const movable = ids.filter((id) => !rootSet.has(id) && !isSink(id))
const active = ids.filter((id) => !isSink(id))
const treeEdges = edges.filter(isTree).filter((e) => !isSink(e.a) && !isSink(e.b))
const nonTree = edges.filter((e) => !isTree(e) && !isSink(e.a) && !isSink(e.b))
const MX = 24,
  MY = 22
// zone membership (location) for organic cluster-gravity: same-zone nodes coalesce into soft blobs.
const zones = new Map<string, string[]>()
for (const id of active) (zones.get(zoneOf(id)) ?? zones.set(zoneOf(id), []).get(zoneOf(id))!).push(id)
const zoneMates = new Map<string, string[]>(active.map((id) => [id, (zones.get(zoneOf(id)) ?? []).filter((x) => x !== id)]))

// ===== MULTI-START SEARCH =====
// The named algorithms (RRT / multi-start / TSP local search) don't commit to one pass — they
// SAMPLE many candidates and keep the best by a cost function. We do the same, deterministically:
// each candidate varies the ordering strategy + force params (no RNG), is fully laid out, then
// scored. Lowest cost wins. Score punishes crossings, upward tree edges (child above its parent =
// the "不可解な線"), node-box overlaps, and total edge length.
type Params = {
  kDown: number // strength of the per-edge "child below parent" downward force (NOT a row snap)
  vgap: number // preferred vertical drop from a parent to its child
  kZone: number // zone cohesion (mutual attraction among same-location nodes → organic blobs)
  kRep: number // node repulsion
  kClear: number // node↔edge clearance (push nodes off edges they aren't endpoints of)
  kSib: number // sibling-row alignment: children of one parent share a y (local horizontal rows)
}
function segInt(ax:number,ay:number,bx:number,by:number,cx:number,cy:number,dx:number,dy:number){
  const d1=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax)
  const d2=(bx-ax)*(dy-ay)-(by-ay)*(dx-ax)
  const d3=(dx-cx)*(ay-cy)-(dy-cy)*(ax-cx)
  const d4=(dx-cx)*(by-cy)-(dy-cy)*(bx-cx)
  return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0))
}
// orient every structural edge up→down by depth-from-apex (this only tells the force WHICH WAY is
// down — it does NOT place nodes in rows). Equal-depth edges are peers (no vertical preference).
const oriented = edges
  .filter((e) => !isSink(e.a) && !isSink(e.b))
  .map((e) => {
    const da = depthOf(e.a),
      db = depthOf(e.b)
    if (da === db) return { up: e.a, dn: e.b, peer: true, bw: e.bw }
    return da < db ? { up: e.a, dn: e.b, peer: false, bw: e.bw } : { up: e.b, dn: e.a, peer: false, bw: e.bw }
  })
const REST = 132
// distance from point Q to segment P1-P2, plus the unit push direction (away from the segment).
function ptSeg(qx: number, qy: number, x1: number, y1: number, x2: number, y2: number) {
  const vx = x2 - x1,
    vy = y2 - y1
  const L2 = vx * vx + vy * vy || 1e-6
  let t = ((qx - x1) * vx + (qy - y1) * vy) / L2
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * vx,
    cy = y1 + t * vy
  const dx = qx - cx,
    dy = qy - cy
  const d = Math.hypot(dx, dy) || 1e-6
  return { d, nx: dx / d, ny: dy / d, t }
}
const CLEAR = 30 // desired clear gap between a node center and any non-incident edge
function runLayout(p: Params): { X: Map<string, number>; Y: Map<string, number>; cost: number; cr: number; up: number; ov: number; ne: number } {
  const lx = new Map<string, number>(),
    ly = new Map<string, number>()
  // organic seed: deterministic golden-angle scatter, biased downward by depth so the flow starts
  // pointing the right way; everything is free to move from here (no rows, no cells).
  for (const id of active) {
    const i = idIndex.get(id) ?? 0
    const ang = i * 2.399963 // golden angle
    const rad = 40 + 26 * Math.sqrt(i)
    lx.set(id, Math.cos(ang) * rad + (rseq(id, 2) - 0.5) * 40)
    ly.set(id, depthOf(id) * p.vgap + (rseq(id, 7) - 0.5) * 40)
  }
  // FORCE RELAX — fully organic (no snapping). Forces: edge springs, per-edge downward preference,
  // node repulsion, zone cohesion. Positions emerge from the balance, like a settling physical mesh.
  const STEP = 0.85,
    R_REP = 230
  for (let it = 0; it < 420; it++) {
    const fx = new Map(active.map((id) => [id, 0])),
      fy = new Map(active.map((id) => [id, 0]))
    // edge springs + downward preference (child wants to hang ~vgap below its parent)
    for (const e of oriented) {
      const dx = lx.get(e.dn)! - lx.get(e.up)!,
        dy = ly.get(e.dn)! - ly.get(e.up)!
      const d = Math.hypot(dx, dy) || 0.01
      const f = (0.18 * (d - REST)) / d
      fx.set(e.up, fx.get(e.up)! + f * dx)
      fy.set(e.up, fy.get(e.up)! + f * dy)
      fx.set(e.dn, fx.get(e.dn)! - f * dx)
      fy.set(e.dn, fy.get(e.dn)! - f * dy)
      if (!e.peer) {
        // pull the child down / parent up until the vertical drop ≈ vgap — continuous, not a row
        const err = p.vgap - dy
        fy.set(e.dn, fy.get(e.dn)! + err * p.kDown)
        fy.set(e.up, fy.get(e.up)! - err * p.kDown * 0.4)
      }
    }
    // BOX-AWARE repulsion (node size matters): the minimum separation along the line between two
    // nodes = their box half-extents PROJECTED onto that line + a margin. A wide-label node thus
    // claims proportionally more horizontal room. Strong linear push when boxes (+margin) overlap,
    // mild 1/d² beyond, so the field also reserves channel space for wires between clusters.
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const A = active[i],
          B = active[j]
        const dx = lx.get(B)! - lx.get(A)!,
          dy = ly.get(B)! - ly.get(A)!
        const d = Math.hypot(dx, dy) || 0.01
        if (d > R_REP) continue
        const ux = dx / d,
          uy = dy / d
        const minSep =
          (nw(A) / 2) * Math.abs(ux) + (NODE_H / 2) * Math.abs(uy) +
          (nw(B) / 2) * Math.abs(ux) + (NODE_H / 2) * Math.abs(uy) + 22
        const f = d < minSep ? 0.5 * (minSep - d) : p.kRep / (d * d)
        fx.set(A, fx.get(A)! - f * ux)
        fy.set(A, fy.get(A)! - f * uy)
        fx.set(B, fx.get(B)! + f * ux)
        fy.set(B, fy.get(B)! + f * uy)
      }
    // zone cohesion: each node drawn toward its zone-mates' centroid → organic blobs (no boxes)
    for (const id of active) {
      const mates = zoneMates.get(id)!
      if (!mates.length) continue
      let cx = 0,
        cy = 0
      for (const m of mates) {
        cx += lx.get(m)!
        cy += ly.get(m)!
      }
      cx /= mates.length
      cy /= mates.length
      fx.set(id, fx.get(id)! + (cx - lx.get(id)!) * p.kZone)
      fy.set(id, fy.get(id)! + (cy - ly.get(id)!) * p.kZone * 0.5) // softer vertically (keep flow)
    }
    // SIBLING-ROW alignment: children of one parent are pulled to a shared y → they line up in a
    // local horizontal row beneath the parent (node1 → ap1,ap2,ap3 on one level), while the overall
    // layout stays organic (each parent's row sits wherever the flow put it, no global grid).
    for (const par of ids) {
      const ch = children.get(par)!.filter((c) => !isSink(c))
      if (ch.length < 2) continue
      let my = 0
      for (const c of ch) my += ly.get(c)!
      my /= ch.length
      for (const c of ch) fy.set(c, fy.get(c)! + (my - ly.get(c)!) * p.kSib)
    }
    // WIRE-AWARE placement: keep non-incident nodes out of an edge's path. Keep-out distance is
    // BOX-AWARE — a node's extent projected onto the edge-perpendicular (wide labels → wider keep-out)
    // plus the wire's own half-thickness. The node yields most; the wire's endpoints give a little so
    // the channel opens from both sides. Integrated through relaxation so it shapes the layout, not
    // patches it. This is the placement-side answer to "lines shouldn't run under nodes".
    if (it > 120)
      for (const e of oriented) {
        const x1 = lx.get(e.up)!,
          y1 = ly.get(e.up)!,
          x2 = lx.get(e.dn)!,
          y2 = ly.get(e.dn)!
        const halfWire = 2 + 0.9 * Math.log10(e.bw / 1e9 + 1) * 2 // thick LAG bundles claim more
        for (const id of active) {
          if (id === e.up || id === e.dn) continue
          const r = ptSeg(lx.get(id)!, ly.get(id)!, x1, y1, x2, y2)
          if (r.t < 0.06 || r.t > 0.94) continue
          const clr = Math.abs(r.nx) * (nw(id) / 2) + Math.abs(r.ny) * (NODE_H / 2) + 11 + halfWire
          if (r.d >= clr) continue
          const push = (clr - r.d) * p.kClear
          fx.set(id, fx.get(id)! + r.nx * push)
          fy.set(id, fy.get(id)! + r.ny * push * 0.3) // damp vertical so sibling rows stay flat
          fx.set(e.up, fx.get(e.up)! - r.nx * push * (1 - r.t) * 0.25)
          fx.set(e.dn, fx.get(e.dn)! - r.nx * push * r.t * 0.25)
        }
      }
    for (const id of active) {
      lx.set(id, lx.get(id)! + Math.max(-16, Math.min(16, fx.get(id)! * STEP)))
      ly.set(id, ly.get(id)! + Math.max(-16, Math.min(16, fy.get(id)! * STEP)))
    }
    let cxs = 0
    for (const id of active) cxs += lx.get(id)!
    cxs /= active.length
    for (const id of active) lx.set(id, lx.get(id)! - cxs)
  }
  // overlap removal — prefer HORIZONTAL separation (×1.8) so it keeps sibling rows flat instead of
  // splitting near-aligned neighbors vertically. Only pushes down when horizontal overlap is large.
  for (let pass = 0; pass < 220; pass++) {
    let moved = false
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const A = active[i],
          B = active[j]
        const dx = lx.get(B)! - lx.get(A)!,
          dy = ly.get(B)! - ly.get(A)!
        const ox = (nw(A) + nw(B)) / 2 + 18 - Math.abs(dx)
        const oy = NODE_H + 16 - Math.abs(dy)
        if (ox <= 0 || oy <= 0) continue
        if (ox < oy * 1.8) {
          const s = (dx >= 0 ? 1 : -1) * (ox / 2) || ox / 2
          lx.set(A, lx.get(A)! - s)
          lx.set(B, lx.get(B)! + s)
        } else {
          const s = (dy >= 0 ? 1 : -1) * (oy / 2) || oy / 2
          ly.set(A, ly.get(A)! - s)
          ly.set(B, ly.get(B)! + s)
        }
        moved = true
      }
    if (!moved) break
  }
  // ---- score this candidate ----
  let cr = 0
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const e1 = edges[i],
        e2 = edges[j]
      if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue
      if (segInt(lx.get(e1.a)!, ly.get(e1.a)!, lx.get(e1.b)!, ly.get(e1.b)!, lx.get(e2.a)!, ly.get(e2.a)!, lx.get(e2.b)!, ly.get(e2.b)!)) cr++
    }
  let up = 0 // tree edge whose child is NOT clearly below its parent = visually inexplicable
  for (const e of treeEdges) {
    const child = parent.get(e.a) === e.b ? e.a : e.b
    const par = child === e.a ? e.b : e.a
    if (ly.get(child)! < ly.get(par)! + 30) up++
  }
  let len = 0
  for (const e of edges) if (!isSink(e.a) && !isSink(e.b)) len += Math.hypot(lx.get(e.a)! - lx.get(e.b)!, ly.get(e.a)! - ly.get(e.b)!)
  let ov = 0
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const A = active[i],
        B = active[j]
      if ((nw(A) + nw(B)) / 2 - Math.abs(lx.get(B)! - lx.get(A)!) > 0 && NODE_H - Math.abs(ly.get(B)! - ly.get(A)!) > 0) ov++
    }
  // node-on-edge violations (box-aware, matches the placement force): node box intrudes on a wire
  let ne = 0
  for (const e of oriented) {
    const x1 = lx.get(e.up)!,
      y1 = ly.get(e.up)!,
      x2 = lx.get(e.dn)!,
      y2 = ly.get(e.dn)!
    for (const id of active) {
      if (id === e.up || id === e.dn) continue
      const r = ptSeg(lx.get(id)!, ly.get(id)!, x1, y1, x2, y2)
      if (r.t < 0.06 || r.t > 0.94) continue
      if (r.d < Math.abs(r.nx) * (nw(id) / 2) + Math.abs(r.ny) * (NODE_H / 2) + 6) ne++
    }
  }
  const cost = cr * 1 + up * 12 + ov * 6 + ne * 3 + len / 320
  return { X: lx, Y: ly, cost, cr, up, ov, ne }
}

// candidate parameter sets (deterministic — no RNG). Vary the organic force balance, pick the best.
const CANDIDATES: Params[] = []
for (const kDown of [0.06, 0.12])
  for (const vgap of [130, 160])
    for (const kZone of [0.04, 0.09])
      for (const kClear of [0.12, 0.22])
        CANDIDATES.push({ kDown, vgap, kZone, kRep: 4200, kClear, kSib: 0.85 })

let best = runLayout(CANDIDATES[0])
let bestI = 0
const scoreboard: string[] = []
for (let i = 0; i < CANDIDATES.length; i++) {
  const r = i === 0 ? best : runLayout(CANDIDATES[i])
  scoreboard.push(`  #${i} kDown=${CANDIDATES[i].kDown} vgap=${CANDIDATES[i].vgap} kZone=${CANDIDATES[i].kZone}  cost=${r.cost.toFixed(0)} (cr=${r.cr} up=${r.up} ov=${r.ov} ne=${r.ne})`)
  if (r.cost < best.cost) {
    best = r
    bestI = i
  }
}
console.log(`\n[MULTI-START SEARCH] ${CANDIDATES.length} candidates, picked #${bestI} (cost ${best.cost.toFixed(0)}, crossings ${best.cr}, upward ${best.up}, overlaps ${best.ov})`)
console.log(scoreboard.join('\n'))
for (const id of active) {
  X.set(id, best.X.get(id)!)
  Y.set(id, best.Y.get(id)!)
}

// normalize + sink rail
let minX = Infinity,
  minY = Infinity,
  maxX = -Infinity,
  maxY = -Infinity
for (const id of active) {
  minX = Math.min(minX, X.get(id)! - nw(id) / 2)
  maxX = Math.max(maxX, X.get(id)! + nw(id) / 2)
  minY = Math.min(minY, Y.get(id)! - NODE_H / 2)
  maxY = Math.max(maxY, Y.get(id)! + NODE_H / 2)
}
for (const id of active) {
  X.set(id, X.get(id)! - minX)
  Y.set(id, Y.get(id)! - minY)
}
maxY -= minY
let W0 = maxX - minX
const sinkArr = [...sinks].sort()
{
  let sx = 0
  for (const s of sinkArr) {
    X.set(s, sx + nw(s) / 2)
    Y.set(s, maxY + 50)
    sx += nw(s) + 20
  }
  if (sinkArr.length) {
    maxY += 50
    W0 = Math.max(W0, sx)
  }
}

// ---- edge style ----
const ew = (bw: number) => {
  const gb = bw / 1e9
  return gb <= 0 ? 1.5 : Math.max(1.5, Math.min(8, 1.5 + 1.6 * Math.log10(gb + 1)))
}
const ec = (bw: number) => {
  const gb = bw / 1e9
  return gb >= 400 ? '#e06c9f' : gb >= 100 ? '#e0a96c' : gb >= 25 ? '#6ca9e0' : '#6ce0a0'
}

// ---- render ----
const PAD = 60
const W = W0 + PAD * 2,
  H = maxY + NODE_H + PAD * 2
const fill: Record<string, string> = { router: '#1b3a5c', firewall: '#5c1b2b', 'l3-switch': '#1b4c4c', hardware: '#2a2f3a' }
const P: string[] = []
P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${W} ${H}" font-family="ui-sans-serif" font-size="11">`)
P.push(`<rect x="${-PAD}" y="${-PAD}" width="${W}" height="${H}" fill="#0d1117"/>`)
if (sinkArr.length)
  P.push(`<text x="${-PAD + 8}" y="${Y.get(sinkArr[0])! - 18}" fill="#7a8595" font-size="11">shared services</text>`)
// LCA for hierarchical edge bundling of non-tree links (Holten): bow toward common ancestor
function lca(a: string, b: string): string | null {
  let x = a,
    y = b,
    dx = depthOf(x),
    dy = depthOf(y)
  while (dx > dy) {
    const p = parent.get(x)
    if (!p) break
    x = p
    dx--
  }
  while (dy > dx) {
    const p = parent.get(y)
    if (!p) break
    y = p
    dy--
  }
  for (let g = 0; x !== y && g < 100; g++) {
    const px = parent.get(x),
      py = parent.get(y)
    if (!px || !py) return null
    x = px
    y = py
  }
  return x === y ? x : null
}
// Style by TIER, not by spanning-tree: an edge that crosses tiers (depth differs) is STRUCTURAL
// (hierarchy, drawn prominent & vertical); a same-tier edge is a PEER/redundancy link (faded, bowed).
// This is what makes a top-tier router like cisco8712 read as "feeding the spine" rather than empty:
// its uplinks to the spine cross a tier, so they're drawn bold downward — regardless of tree parent.
const isStructural = (e: { a: string; b: string }) =>
  !isSink(e.a) && !isSink(e.b) && Math.abs(depthOf(e.a) - depthOf(e.b)) >= 1
for (const pass of [0, 1]) {
  for (const e of edges) {
    const structural = isStructural(e)
    if ((pass === 0) === structural) continue // pass 0 = peer/sink (behind), pass 1 = structural (front)
    const x1 = X.get(e.a)!,
      y1 = Y.get(e.a)!,
      x2 = X.get(e.b)!,
      y2 = Y.get(e.b)!
    let d: string
    if (structural) {
      const my = (y1 + y2) / 2 // straight-ish vertical curve; placement already left room for it
      d = `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
    } else {
      const mx = (x1 + x2) / 2,
        my = Math.max(y1, y2) + Math.min(46, Math.abs(x2 - x1) * 0.16 + 12) // peer link bows down
      d = `M${x1} ${y1} Q ${mx} ${my}, ${x2} ${y2}`
    }
    const sink = isSink(e.a) || isSink(e.b)
    const op = sink ? 0.22 : structural ? 0.9 : 0.38
    const sw = structural ? ew(e.bw) : Math.max(1, ew(e.bw) * 0.6)
    P.push(`<path d="${d}" fill="none" stroke="${ec(e.bw)}" stroke-width="${sw.toFixed(1)}" stroke-opacity="${op}" stroke-linecap="round"/>`)
    if (e.mult >= 2 && structural) P.push(`<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" fill="#9fb0c0" font-size="9" text-anchor="middle">×${e.mult}</text>`)
  }
}
for (const id of ids) {
  const x = X.get(id)!,
    y = Y.get(id)!,
    w = nw(id)
  P.push(`<rect x="${x - w / 2}" y="${y - NODE_H / 2}" width="${w}" height="${NODE_H}" rx="6" fill="${fill[dtype(id)] || '#22272e'}" stroke="${rootSet.has(id) ? "#e0a96c" : isSink(id) ? '#c0506e' : '#3d4555'}" stroke-width="${rootSet.has(id) || isSink(id) ? 1.6 : 0.8}"/>`)
  P.push(`<text x="${x}" y="${y + 3.5}" fill="#d9e0e8" text-anchor="middle">${label(id).slice(0, 18)}</text>`)
}
P.push('</svg>')
await Bun.write('tmp-test6-v3.svg', P.join('\n'))
await Bun.write(
  'tmp-test6-v3-pos.json',
  JSON.stringify({
    pos: Object.fromEntries(ids.map((id) => [id, { x: X.get(id), y: Y.get(id), w: nw(id), label: label(id), zone: zoneOf(id), depth: depthOf(id) }])),
    edges: edges.map((e) => ({ a: e.a, b: e.b, bw: e.bw, tree: isTree(e), structural: isStructural(e) })),
  }),
)
console.log(`roots ${roots.length}, sinks ${sinks.size}, blocks ${blocks.length} sizes [${blocks.map((b) => b.members.length).join(',')}]`)
console.log(`wrote tmp-test6-v3.svg (viewBox ${Math.round(W)}x${Math.round(H)})  tree-edges=${edges.filter(isTree).length}/${edges.length}`)
{
  // sibling-row tightness: for each parent with ≥3 children, how flat is the children row (y-spread)?
  console.log('\n[sibling rows] parent → children y-spread (smaller = flatter row)')
  for (const par of ids) {
    const ch = children.get(par)!.filter((c) => !isSink(c))
    if (ch.length < 3) continue
    const ys = ch.map((c) => Y.get(c)!)
    const spread = Math.max(...ys) - Math.min(...ys)
    console.log(`  ${label(par).slice(0, 20).padEnd(20)} ×${ch.length}  Δy=${spread.toFixed(0)}px`)
  }
}

// ---- classify NON-TREE edges: are the horizontal ones all "redundancy"? ----
{
  const cat = (e: { a: string; b: string }) => {
    if (isSink(e.a) || isSink(e.b)) return 'sink'
    if (rootSet.has(e.a) && rootSet.has(e.b)) return 'core-mesh(peer)'
    // redundancy = a 2nd uplink: one endpoint is closer-to-core (a valid alt-parent) of the other
    const da = dist.get(e.a)!, db = dist.get(e.b)!
    if (da !== db) return 'redundancy(2nd-uplink)'
    // same distance from core, not core → sibling/peer
    const shared = [...nbr.get(e.a)!].filter((w) => nbr.get(e.b)!.has(w)).length
    return shared >= 1 ? 'twin/peer-pair' : 'cross-pod(east-west)'
  }
  const groups: Record<string, { horiz: number; diag: number }> = {}
  for (const e of edges) {
    if (isTree(e)) continue
    const c = cat(e)
    const horiz = Math.abs(Y.get(e.a)! - Y.get(e.b)!) < 12
    groups[c] ||= { horiz: 0, diag: 0 }
    groups[c][horiz ? 'horiz' : 'diag']++
  }
  console.log('\n[NON-TREE edge classes]  (horiz = drawn roughly horizontal)')
  for (const [c, v] of Object.entries(groups).sort((a, b) => b[1].horiz + b[1].diag - a[1].horiz - a[1].diag))
    console.log(`  ${c.padEnd(24)} horizontal=${v.horiz}  diagonal=${v.diag}`)
}

// name the east-west / cross-pod non-tree edges to see what they really are
{
  console.log('\n[east-west / cross non-tree edges, by bandwidth]')
  const list = edges
    .filter((e) => !isTree(e) && !isSink(e.a) && !isSink(e.b) && !(rootSet.has(e.a) && rootSet.has(e.b)))
    .sort((a, b) => b.bw - a.bw)
  for (const e of list.slice(0, 16)) {
    const gb = (e.bw / 1e9).toFixed(0)
    const sameDist = dist.get(e.a)! === dist.get(e.b)! ? 'same-tier' : '2nd-uplink'
    console.log(`  ${label(e.a).slice(0, 20).padEnd(20)} — ${label(e.b).slice(0, 20).padEnd(20)} ${gb.padStart(4)}G  ${sameDist}`)
  }
}

// ---- crossing count (straight-segment approximation of the drawn edges) — segInt defined above ----
let crossings=0
for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
  const e1=edges[i],e2=edges[j]
  if(e1.a===e2.a||e1.a===e2.b||e1.b===e2.a||e1.b===e2.b)continue
  if(segInt(X.get(e1.a)!,Y.get(e1.a)!,X.get(e1.b)!,Y.get(e1.b)!,X.get(e2.a)!,Y.get(e2.a)!,X.get(e2.b)!,Y.get(e2.b)!))crossings++
}
console.log(`CROSSINGS (all edges): ${crossings}`)

// crossings broken down by tree vs non-tree
{
  let tt=0, tn=0, nn=0
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const e1=edges[i],e2=edges[j]
    if(e1.a===e2.a||e1.a===e2.b||e1.b===e2.a||e1.b===e2.b)continue
    if(!segInt(X.get(e1.a)!,Y.get(e1.a)!,X.get(e1.b)!,Y.get(e1.b)!,X.get(e2.a)!,Y.get(e2.a)!,X.get(e2.b)!,Y.get(e2.b)!))continue
    const t1=isTree(e1),t2=isTree(e2)
    if(t1&&t2)tt++; else if(t1||t2)tn++; else nn++
  }
  console.log(`  breakdown: tree×tree=${tt}  tree×nontree=${tn}  nontree×nontree=${nn}`)
}
