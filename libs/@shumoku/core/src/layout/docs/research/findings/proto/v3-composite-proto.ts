// v3 COMPOSITE prototype (engine-v3-design.md §23, findings/06+07).
// Macro = quotient of ~23 zones placed in few discrete bands (layered over ZONES, not nodes).
// Micro = local layout inside each zone (sibling rows + jitter), redundant pairs collapsed
// and re-expanded side-by-side. Deterministic (R-seq only). Throwaway.
// Run from repo root → writes tmp-test6-v3.svg + tmp-test6-v3-pos.json
type G = { nodes: any[]; links: any[] }
const g: G = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const ids = g.nodes.map((n) => n.id)
const node = new Map(g.nodes.map((n) => [n.id, n]))
const label = (id: string) => (node.get(id)?.label || id).toString()
const dtype = (id: string) => (node.get(id)?.spec?.type || node.get(id)?.spec?.kind || '?').toString()
const idIndex = new Map(ids.map((id, i) => [id, i]))
const PHI = 1.618033988749895
const rseq = (id: string, salt = 0) => (((idIndex.get(id) ?? 0) + 1) * (1 / PHI) + salt * 0.3719) % 1

// ---- collapse parallel links ----
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

// ---- metadata: zone + apex (location is the one clean axis; hostGroups is useless on test6) ----
const locOf = (id: string) => (node.get(id)?.metadata?.location || '').toString()
const zoneOf = (id: string) => locOf(id) || 'unzoned'
function locTier(id: string): number {
  const l = locOf(id)
  let m: RegExpMatchArray | null
  if ((m = l.match(/^NOC#N-(\d+)/))) return +m[1]
  if ((m = l.match(/^NOC#D-(\d+)/))) return 20 + +m[1]
  if ((m = l.match(/^NOC#S-(\d+)/))) return 30 + +m[1]
  if (l.startsWith('Pod#')) return 40
  if (l.startsWith('Stage')) return 45
  return 50
}
const sinks = new Set(ids.filter((id) => label(id).includes('lastresort')))
const isSink = (id: string) => sinks.has(id)
const nocN = ids.filter((id) => !isSink(id) && /^NOC#N-/.test(locOf(id)))
const minNocTier = Math.min(...nocN.map(locTier))
const roots = nocN.filter((id) => locTier(id) <= minNocTier + 1)
const rootSet = new Set(roots)
// BFS depth from apex (down-direction orientation only — never a row assignment)
const depth = new Map<string, number>(ids.map((id) => [id, Infinity]))
{
  const q: string[] = []
  for (const r of [...roots].sort()) {
    depth.set(r, 0)
    q.push(r)
  }
  while (q.length) {
    const u = q.shift()!
    if (isSink(u)) continue
    for (const w of [...nbr.get(u)!].sort())
      if (!isSink(w) && depth.get(w)! > depth.get(u)! + 1) {
        depth.set(w, depth.get(u)! + 1)
        q.push(w)
      }
  }
  for (const id of ids) if (depth.get(id)! === Infinity) depth.set(id, 0)
}
const depthOf = (id: string) => depth.get(id)!

// ---- STEP 1: redundant-pair (twin) detection & collapse (findings/06 §4) ----
// near-twins: same zone + neighbor-set Jaccard (modulo each other) ≥ 0.5. Greedy, deterministic.
const jac = (u: string, v: string) => {
  const A = [...nbr.get(u)!].filter((x) => x !== v)
  const B = new Set([...nbr.get(v)!].filter((x) => x !== u))
  const inter = A.filter((x) => B.has(x)).length
  const uni = new Set([...A, ...B]).size
  return uni ? inter / uni : 1
}
type Unit = { id: string; members: string[]; w: number; zone: string; depth: number }
const NODE_H = 26
const nw = (id: string) => Math.max(58, label(id).length * 6.1 + 14)
const paired = new Map<string, string>()
{
  // HA pairs: same LABEL STEM (thunder8665s-1/-2 → thunder8665s; operator naming intent — hardware
  // model is too generic, e.g. "Nexus9000" spans different boxes) AND structural evidence:
  // direct interconnect OR a shared uplink. Note Jaccard alone fails — true HA pairs often uplink
  // to DIFFERENT routers on purpose (thunder-1→mx304, thunder-2→ne8000: zero shared neighbors).
  const stem = (id: string) => label(id).replace(/-\d+(?=\.)/, '')
  const cands: { u: string; v: string; q: number }[] = []
  for (const u of ids)
    for (const v of ids)
      if (u < v && !isSink(u) && !isSink(v) && zoneOf(u) === zoneOf(v) && stem(u) === stem(v)) {
        const direct = nbr.get(u)!.has(v)
        const q = jac(u, v)
        if (direct || q >= 0.34) cands.push({ u, v, q: q + (direct ? 1 : 0) })
      }
  cands.sort((a, b) => b.q - a.q || (a.u < b.u ? -1 : 1))
  for (const c of cands) if (!paired.has(c.u) && !paired.has(c.v)) {
    paired.set(c.u, c.v)
    paired.set(c.v, c.u)
  }
}
const PAIR_GAP = 14
const units: Unit[] = []
const unitOf = new Map<string, string>()
for (const id of ids) {
  if (isSink(id)) continue
  const p = paired.get(id)
  if (p && p < id) continue // emitted with the lower partner
  const members = p ? [id, p].sort() : [id]
  const uid = members.join('+')
  const w = members.reduce((s, m) => s + nw(m), 0) + (members.length - 1) * PAIR_GAP
  units.push({ id: uid, members, w, zone: zoneOf(id), depth: Math.min(...members.map(depthOf)) })
  for (const m of members) unitOf.set(m, uid)
}
const unit = new Map(units.map((u) => [u.id, u]))
// unit-level edges (skip intra-pair)
const uEdges = new Map<string, { a: string; b: string; bw: number; mult: number }>()
for (const e of edges) {
  if (isSink(e.a) || isSink(e.b)) continue
  const ua = unitOf.get(e.a)!,
    ub = unitOf.get(e.b)!
  if (ua === ub) continue
  const k = pk(ua, ub)
  const x = uEdges.get(k)
  if (x) {
    x.bw += e.bw
    x.mult += e.mult
  } else uEdges.set(k, { a: ua < ub ? ua : ub, b: ua < ub ? ub : ua, bw: e.bw, mult: e.mult })
}
console.log(`pairs collapsed: ${[...paired.keys()].length / 2} → ${units.length} units; pairs: ${units.filter((u) => u.members.length === 2).map((u) => u.members.map(label).join('/')).join(', ')}`)

// ==== HA AS A SEPARATE FIELD (hardcoded for testing — production reads link.redundancy) ====
// HA interconnects are NOT wires: they leave the wiring edge set entirely and render as a
// "glasses" coupling (double bridge) between the two member devices. Placement still uses the
// pairing as an adjacency signal (collapse/zone-adjacency), wiring never draws them as lines.
const stemOf = (id: string) => label(id).replace(/-\d+(?=\.)/, '')
const hostpart = (id: string) => label(id).split('.')[0]
const zoneBase = (id: string) => zoneOf(id).replace(/(\d)[YU]$/i, '$1') // Pod#3Y/3U → same rack pair
const isHaEdge = (e: { a: string; b: string }) =>
  !isSink(e.a) &&
  !isSink(e.b) &&
  depthOf(e.a) === depthOf(e.b) &&
  zoneBase(e.a) === zoneBase(e.b) && // ex4400.noc—ex4400.pod4 is an uplink, not a pair
  (stemOf(e.a) === stemOf(e.b) || hostpart(e.a) === hostpart(e.b))
const haPairs = new Map<string, [string, string]>()
for (const e of edges) if (isHaEdge(e)) haPairs.set(pk(e.a, e.b), [e.a, e.b])
for (const [u, v] of paired) if (u < v) haPairs.set(pk(u, v), [u, v])
const isHaKey = (a: string, b: string) => haPairs.has(pk(a, b))
console.log(`HA couplings (separate field): ${[...haPairs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, [a, b]]) => `${label(a)}⌒${label(b)}`).join(', ')}`)

// ---- PRIMARY DEPENDENCY: each unit's single strongest uplink (max bw to a lower-depth unit).
// This is the edge human cognition needs to trace instantly; it gets org-chart trunk routing and
// dominates placement. All other links are context and get demoted visually.
const prim = new Map<string, string>() // unit -> primary parent unit
for (const u of units) {
  let best: { p: string; bw: number } | null = null
  for (const e of uEdges.values()) {
    const o = e.a === u.id ? e.b : e.b === u.id ? e.a : null
    if (!o) continue
    if (unit.get(o)!.depth >= u.depth) continue
    if (!best || e.bw > best.bw || (e.bw === best.bw && o < best.p)) best = { p: o, bw: e.bw }
  }
  if (best) prim.set(u.id, best.p)
}
const primChildren = new Map<string, string[]>()
for (const [c, p] of prim) (primChildren.get(p) ?? primChildren.set(p, []).get(p)!).push(c)
for (const [, cs] of primChildren) cs.sort()

// ---- STEP 2: per-zone LOCAL layout (sibling rows + jitter; zones are 1–7 units) ----
// rows = relative depth inside the zone (the §22 sibling-row request, applied zone-locally);
// jitter keeps it hand-drawn. Output: local coords + zone box.
const zoneIds = [...new Set(units.map((u) => u.zone))]
const zUnits = new Map<string, Unit[]>(zoneIds.map((z) => [z, units.filter((u) => u.zone === z)]))
const ROW_H = NODE_H + 36
const localX = new Map<string, number>(),
  localY = new Map<string, number>()
const zBox = new Map<string, { w: number; h: number }>()
type ZParams = { gapX: number; pad: number }
function layoutZone(z: string, p: ZParams) {
  const us = zUnits.get(z)!
  const minD = Math.min(...us.map((u) => u.depth))
  const rows = new Map<number, Unit[]>()
  for (const u of us) {
    const r = u.depth - minD
    ;(rows.get(r) ?? rows.set(r, []).get(r)!).push(u)
  }
  // order within a row by intra-zone connectivity barycenter (2 sweeps), seeded by R-seq
  const xOf = new Map<string, number>()
  const rks = [...rows.keys()].sort((a, b) => a - b)
  for (const r of rks) rows.get(r)!.sort((a, b) => rseq(a.members[0], 1) - rseq(b.members[0], 1))
  for (let s = 0; s < 2; s++)
    for (const r of rks) {
      const row = rows.get(r)!
      const want = (u: Unit) => {
        let sx = 0,
          n = 0
        for (const e of uEdges.values()) {
          const o = e.a === u.id ? e.b : e.b === u.id ? e.a : null
          if (!o || unit.get(o)!.zone !== z) continue
          if (xOf.has(o)) {
            sx += xOf.get(o)!
            n++
          }
        }
        return n ? sx / n : (xOf.get(u.id) ?? 0)
      }
      row.sort((a, b) => want(a) - want(b) || (a.id < b.id ? -1 : 1))
      let cx = 0
      const totW = row.reduce((s2, u) => s2 + u.w, 0) + p.gapX * (row.length - 1)
      cx = -totW / 2
      for (const u of row) {
        xOf.set(u.id, cx + u.w / 2)
        cx += u.w + p.gapX
      }
    }
  let maxW = 0
  for (const r of rks) {
    const row = rows.get(r)!
    const totW = row.reduce((s2, u) => s2 + u.w, 0) + p.gapX * (row.length - 1)
    maxW = Math.max(maxW, totW)
  }
  for (const [ri, r] of rks.entries())
    for (const u of rows.get(r)!) {
      localX.set(u.id, xOf.get(u.id)! + maxW / 2 + p.pad + (rseq(u.members[0], 3) - 0.5) * 8)
      // ROW INDEX, not raw depth delta — depth gaps (0,2,…) must not push members below the box
      localY.set(u.id, ri * ROW_H + NODE_H / 2 + p.pad + (rseq(u.members[0], 7) - 0.5) * 7)
    }
  zBox.set(z, { w: maxW + p.pad * 2, h: rks.length * ROW_H - (ROW_H - NODE_H) + p.pad * 2 })
}

// ---- STEP 3: quotient layered placement (the ONLY global pass — over ~23 zones, not nodes) ----
const zRank = new Map<string, number>(zoneIds.map((z) => [z, Math.min(...zUnits.get(z)!.map((u) => u.depth))]))
const zAdj = new Map<string, Map<string, number>>(zoneIds.map((z) => [z, new Map()]))
for (const e of uEdges.values()) {
  const za = unit.get(e.a)!.zone,
    zb = unit.get(e.b)!.zone
  if (za === zb) continue
  // primary dependency edges weigh 3× — zones land under the zone they actually depend on
  const w = prim.get(e.a) === e.b || prim.get(e.b) === e.a ? 3 : 1
  zAdj.get(za)!.set(zb, (zAdj.get(za)!.get(zb) ?? 0) + w)
  zAdj.get(zb)!.set(za, (zAdj.get(zb)!.get(za) ?? 0) + w)
}
const zX = new Map<string, number>(),
  zY = new Map<string, number>() // zone box origin (top-left)
let bandReorders = 0 // how often routing overruled the barycenter order (place-and-route diagnostics)
// congestion feedback: extra gap inserted BEFORE band i when its upper channel overflowed with
// wire tracks on the previous iteration (width-aware placement: thick traffic widens the road bed)
const bandExtra = new Map<number, number>()
const bandRanges: { top: number; bottom: number }[] = []
type QParams = { zoneGap: number; bandGap: number; init: 'size' | 'rseq'; maxBandW: number }
function quotientLayout(p: QParams) {
  const bands = [...new Set(zoneIds.map((z) => zRank.get(z)!))].sort((a, b) => a - b)
  const zCx = new Map<string, number>(zoneIds.map((z) => [z, 0]))
  const order = new Map<number, string[]>()
  for (const b of bands) {
    const zl = zoneIds.filter((z) => zRank.get(z) === b)
    zl.sort((a, b2) =>
      p.init === 'size'
        ? zUnits.get(b2)!.length - zUnits.get(a)!.length || (a < b2 ? -1 : 1)
        : rseq(a, 5) - rseq(b2, 5),
    )
    order.set(b, zl)
  }
  // barycenter sweeps over the quotient (down then up), then place each band centered on 0
  for (let sweep = 0; sweep < 6; sweep++) {
    const seq = sweep % 2 === 0 ? bands : [...bands].reverse()
    for (const b of seq) {
      const zl = order.get(b)!
      const want = (z: string) => {
        let s = 0,
          w = 0
        for (const [o, ww] of zAdj.get(z)!) {
          s += zCx.get(o)! * ww
          w += ww
        }
        return w ? s / w : zCx.get(z)!
      }
      zl.sort((a, b2) => want(a) - want(b2) || (a < b2 ? -1 : 1))
      const totW = zl.reduce((s, z) => s + zBox.get(z)!.w, 0) + p.zoneGap * (zl.length - 1)
      let cx = -totW / 2
      for (const z of zl) {
        zCx.set(z, cx + zBox.get(z)!.w / 2)
        cx += zBox.get(z)!.w + p.zoneGap
      }
    }
  }
  // place bands top→down with CHILD-BLOCK PACKING: zones that share a primary-parent zone are
  // packed as a compact grid block CENTERED UNDER that parent (the reference's pod block). This is
  // the placement-side fix for hub fans — children sit near their feeder, so each individual
  // dependency line is short and steep instead of a long shallow diagonal across the page.
  const zParent = new Map<string, string | null>()
  for (const z of zoneIds) {
    const cnt = new Map<string, number>()
    for (const u of zUnits.get(z)!) {
      const pr = prim.get(u.id)
      if (!pr) continue
      const pz = unit.get(pr)!.zone
      if (pz === z) continue
      cnt.set(pz, (cnt.get(pz) ?? 0) + 1)
    }
    let bestZ: string | null = null,
      bn = 0
    for (const [pz, n] of [...cnt].sort()) if (n > bn) {
      bestZ = pz
      bn = n
    }
    zParent.set(z, bestZ)
  }
  let y = 0
  bandRanges.length = 0
  const placedCenter = new Map<string, number>()
  for (const [bi, b] of bands.entries()) {
    y += bandExtra.get(bi) ?? 0
    const zl = order.get(b)!
    const groups = new Map<string, string[]>()
    for (const z of zl) {
      const pz = zParent.get(z)
      const key = pz && placedCenter.has(pz) ? pz : `~${z}`
      ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(z)
    }
    type GP = { key: string; zs: string[]; w: number; h: number; off: Map<string, { x: number; y: number }>; desired: number }
    const gps: GP[] = []
    for (const [key, zs] of [...groups].sort()) {
      const off = new Map<string, { x: number; y: number }>()
      if (!key.startsWith('~') && zs.length >= 2) {
        // grid block under the parent: row-major, ~sqrt cols
        zs.sort((a, b) => zCx.get(a)! - zCx.get(b)! || (a < b ? -1 : 1))
        const cols = Math.min(4, Math.ceil(Math.sqrt(zs.length * 1.7)))
        const gapI = Math.round(p.zoneGap * 0.55)
        let gy = 0,
          gw = 0
        for (let r0 = 0; r0 < zs.length; r0 += cols) {
          const row = zs.slice(r0, r0 + cols)
          let gx = 0
          let rh = 0
          for (const z of row) {
            off.set(z, { x: gx, y: gy })
            gx += zBox.get(z)!.w + gapI
            rh = Math.max(rh, zBox.get(z)!.h)
          }
          gw = Math.max(gw, gx - gapI)
          gy += rh + gapI
        }
        gps.push({ key, zs, w: gw, h: gy - gapI, off, desired: placedCenter.get(key)! })
      } else {
        for (const z of zs) {
          const o = new Map([[z, { x: 0, y: 0 }]])
          gps.push({ key: `~${z}`, zs: [z], w: zBox.get(z)!.w, h: zBox.get(z)!.h, off: o, desired: zCx.get(z)! })
        }
      }
    }
    gps.sort((a, b) => a.desired - b.desired || (a.key < b.key ? -1 : 1))
    // place one candidate ordering of this band's groups (1D pack at desired, then center)
    const placeBand = (ord: GP[]) => {
      const xs: number[] = []
      let cur = -Infinity
      for (const g of ord) {
        let x = g.desired - g.w / 2
        if (x < cur) x = cur
        xs.push(x)
        cur = x + g.w + p.zoneGap
      }
      const shift = -(xs[0] + xs[xs.length - 1] + ord[ord.length - 1].w) / 2
      for (const [i, g] of ord.entries()) {
        const gx = xs[i] + shift
        for (const z of g.zs) {
          const o = g.off.get(z)!
          zX.set(z, gx + o.x)
          zY.set(z, y + o.y)
          zCx.set(z, gx + o.x + zBox.get(z)!.w / 2)
        }
      }
    }
    // SIMULTANEOUS place-and-route: the band's ordering is decided by ACTUAL ROUTING against the
    // bands placed so far (routability-driven placement) — wiring participates from band 0, not
    // after placement is done. Candidates = barycenter order + every adjacent transposition.
    const bandZones = gps.flatMap((g) => g.zs)
    const orderings: GP[][] = [gps]
    for (let s = 0; s + 1 < gps.length; s++) {
      const alt = gps.slice()
      ;[alt[s], alt[s + 1]] = [alt[s + 1], alt[s]]
      orderings.push(alt)
    }
    let bestOrd = gps
    if (orderings.length > 1) {
      let bestCost = Infinity
      const visible = new Set([...placedCenter.keys(), ...bandZones])
      for (const ord of orderings) {
        placeBand(ord)
        compose()
        const sc = routedScore(computeWiring(false, (e) => visible.has(zoneOf(e.a)) && visible.has(zoneOf(e.b))))
        if (sc.cost < bestCost - 1e-9) {
          bestCost = sc.cost
          bestOrd = ord
        }
      }
    }
    if (bestOrd !== gps) bandReorders++
    placeBand(bestOrd)
    for (const z of bandZones) placedCenter.set(z, zCx.get(z)!)
    const bandH = Math.max(...gps.map((g) => g.h))
    bandRanges.push({ top: y, bottom: y + bandH })
    y += bandH + p.bandGap
  }
}

// ---- STEP 4: port refinement — pull each unit toward its cross-zone neighbors' x ----
function portRefine() {
  for (let pass = 0; pass < 2; pass++)
    for (const z of zoneIds) {
      const us = zUnits.get(z)!
      const minD = Math.min(...us.map((u) => u.depth))
      const byRow = new Map<number, Unit[]>()
      for (const u of us) (byRow.get(u.depth - minD) ?? byRow.set(u.depth - minD, []).get(u.depth - minD)!).push(u)
      for (const [, row] of byRow) {
        for (const u of row) {
          let s = 0,
            n = 0
          for (const e of uEdges.values()) {
            const o = e.a === u.id ? e.b : e.b === u.id ? e.a : null
            if (!o) continue
            const oz = unit.get(o)!.zone
            if (oz === z) continue
            // primary parent (and primary children) pull 4× — a unit sits under its dependency
            const w = prim.get(u.id) === o || prim.get(o) === u.id ? 4 : 1
            s += (zX.get(oz)! + localX.get(o)!) * w
            n += w
          }
          if (!n) continue
          const target = s / n - zX.get(z)!
          const minX = u.w / 2 + 8,
            maxX = zBox.get(z)!.w - u.w / 2 - 8
          localX.set(u.id, Math.max(minX, Math.min(maxX, localX.get(u.id)! + (target - localX.get(u.id)!) * 0.6)))
        }
        // resolve intra-row overlaps left→right (keep the row a row)
        row.sort((a, b) => localX.get(a.id)! - localX.get(b.id)!)
        for (let i = 1; i < row.length; i++) {
          const prev = row[i - 1],
            cur = row[i]
          const minX = localX.get(prev.id)! + prev.w / 2 + 18 + cur.w / 2
          if (localX.get(cur.id)! < minX) localX.set(cur.id, minX)
        }
        const last = row[row.length - 1]
        const over = localX.get(last.id)! + last.w / 2 + 8 - zBox.get(last.zone)!.w
        if (over > 0) {
          // shift back inside — but never past the LEFT edge (this pushed thunder-1 out of its box)
          const slack = Math.max(0, localX.get(row[0].id)! - (row[0].w / 2 + 8))
          const shift = Math.min(over, slack)
          for (const u of row) localX.set(u.id, localX.get(u.id)! - shift)
          if (over > slack) {
            // row genuinely wider than the gap budget: re-pack left→right inside the box
            let cx2 = row[0].w / 2 + 8
            for (const u of row) {
              localX.set(u.id, Math.max(localX.get(u.id)! - (over - slack), cx2))
              cx2 = localX.get(u.id)! + u.w / 2 + 18 + (row[row.indexOf(u) + 1]?.w ?? 0) / 2
            }
          }
        }
      }
    }
}

// ---- vertical snap: if a unit sits nearly under its primary parent, align exactly (metro look:
// perfect verticals wherever the structure allows; the eye reads exact alignment as "same line") ----
function snapVerticals() {
  const byDepth = [...units].sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1))
  for (const u of byDepth) {
    const p = prim.get(u.id)
    if (!p) continue
    const pg = zX.get(unit.get(p)!.zone)! + localX.get(p)!
    const ug = zX.get(u.zone)! + localX.get(u.id)!
    const diff = pg - ug
    if (Math.abs(diff) > 0.5 && Math.abs(diff) < 38) {
      const minX = u.w / 2 + 8,
        maxX = zBox.get(u.zone)!.w - u.w / 2 - 8
      localX.set(u.id, Math.max(minX, Math.min(maxX, localX.get(u.id)! + diff)))
    }
  }
}

// ---- intra-row overlap resolution (zone-local). snapVerticals moves units without collision
// checks, so this must run AFTER it — same separation rule as portRefine's. ----
function resolveRowOverlaps() {
  for (const z of zoneIds) {
    const us = zUnits.get(z)!
    const minD = Math.min(...us.map((u) => u.depth))
    const byRow = new Map<number, Unit[]>()
    for (const u of us) (byRow.get(u.depth - minD) ?? byRow.set(u.depth - minD, []).get(u.depth - minD)!).push(u)
    for (const [, row] of byRow) {
      row.sort((a, b) => localX.get(a.id)! - localX.get(b.id)! || (a.id < b.id ? -1 : 1))
      for (let i = 1; i < row.length; i++) {
        const minX = localX.get(row[i - 1].id)! + row[i - 1].w / 2 + 18 + row[i].w / 2
        if (localX.get(row[i].id)! < minX) localX.set(row[i].id, minX)
      }
      const last = row[row.length - 1]
      const over = localX.get(last.id)! + last.w / 2 + 8 - zBox.get(z)!.w
      if (over > 0) {
        const slack = Math.max(0, localX.get(row[0].id)! - (row[0].w / 2 + 8))
        const shift = Math.min(over, slack)
        for (const u of row) localX.set(u.id, localX.get(u.id)! - shift)
      }
    }
  }
}

// ---- compose: node positions from unit positions (expand pairs side-by-side) ----
const X = new Map<string, number>(),
  Y = new Map<string, number>()
function compose() {
  for (const u of units) {
    const gx = zX.get(u.zone)! + localX.get(u.id)!,
      gy = zY.get(u.zone)! + localY.get(u.id)!
    if (u.members.length === 1) {
      X.set(u.members[0], gx)
      Y.set(u.members[0], gy)
    } else {
      const [a, b] = u.members
      X.set(a, gx - (nw(b) + PAIR_GAP) / 2)
      X.set(b, gx + (nw(a) + PAIR_GAP) / 2)
      Y.set(a, gy)
      Y.set(b, gy)
    }
  }
}

// ---- scoring (now includes the metrics that were missing: flow + levels) ----
function segInt(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax)
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)
  const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx)
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0
}
const isStructural = (e: { a: string; b: string }) =>
  !isSink(e.a) && !isSink(e.b) && Math.abs(depthOf(e.a) - depthOf(e.b)) >= 1
// ===== WIRING MODULE — placement and wiring SEE EACH OTHER: routing runs INSIDE the search, and
// candidates/moves are scored on the REAL routed geometry, not a straight-line proxy. =====
const isPrimaryNodeEdge = (e: { a: string; b: string }) => {
  const ua = unitOf.get(e.a),
    ub = unitOf.get(e.b)
  if (!ua || !ub || ua === ub) return false
  return prim.get(ua) === ub || prim.get(ub) === ua
}
type Route =
  | { k: 'sink'; nx: number; ny: number; sx: number; sty: number; lane: number; jxs?: number }
  | { k: 'ramp'; x1: number; y1: number; x2: number; y2: number; busY: number }
  | { k: 'straight'; x1: number; y1: number; x2: number; y2: number; xs?: number }
  | { k: 'orth'; x1: number; y1: number; x2: number; y2: number; ty: number; xs?: number } // V → H(track) → V
  | { k: 'gutter'; x1: number; y1: number; x2: number; y2: number; gx: number; ty1: number; ty2: number } // bypass via inter-zone gutter
let railY = 0 // set after the sink rail exists; scoring runs without sink edges
const edgeByKey = new Map(edges.map((e) => [pk(e.a, e.b), e]))
const ew = (bw: number) => {
  const gb = bw / 1e9
  return gb <= 0 ? 1.5 : Math.max(1.5, Math.min(8, 1.5 + 1.6 * Math.log10(gb + 1)))
}
const ec = (bw: number) => {
  const gb = bw / 1e9
  return gb >= 400 ? '#e06c9f' : gb >= 100 ? '#e0a96c' : gb >= 25 ? '#6ca9e0' : '#6ce0a0'
}
// per-strand width: 'class' = discrete road classes (§37) vs 'continuous' = log curve (like the
// current production engine). Toggle to compare the two impressions.
const WIDTH_MODE: 'class' | 'continuous' | 'linear' = 'linear' // user pick: width ∝ bandwidth
const strandW = (bwEach: number) => {
  const gb = bwEach / 1e9
  if (WIDTH_MODE === 'class') return gb >= 400 ? 6.5 : gb >= 100 ? 4 : gb >= 25 ? 2.6 : gb >= 10 ? 1.7 : 1.1
  if (WIDTH_MODE === 'linear') return Math.max(0.4, gb * 0.04) // base 0.04px/G: 25G=1px, 400G=16px
  return gb <= 0 ? 1.1 : Math.max(1.1, Math.min(8, 1.1 + 1.65 * Math.log10(gb + 1)))
}
// half-width of an edge's strand BUNDLE (k parallel lines) — allocators must separate bundles,
// not centerlines (4-strand LAGs are ~16px wide; centerline clearance caused residual overlaps)
function bundleHalf(key: string): number {
  const e = edgeByKey.get(key)
  if (!e) return 2
  const k = Math.min(e.mult || 1, 4)
  const w = strandW(e.bw / (e.mult || 1))
  return ((k - 1) / 2) * (w + 1.8) + w / 2
}
function computeWiring(includeSink: boolean, filter?: (e: { a: string; b: string }) => boolean): Map<string, Route> {
  // ports: each incident logical edge gets a distinct x slot on the node's top/bottom edge
  const portOff = new Map<string, number>()
  {
    const bySide = new Map<string, { key: string; px: number }[]>()
    for (const e of edges) {
      if (isHaKey(e.a, e.b)) continue
      if (!includeSink && (isSink(e.a) || isSink(e.b))) continue
      if (filter && !filter(e)) continue
      const key = pk(e.a, e.b)
      for (const [me, other] of [
        [e.a, e.b],
        [e.b, e.a],
      ] as const) {
        const dy = Y.get(other)! - Y.get(me)!
        const side = dy < -13 ? 't' : 'b'
        const sk = `${me}|${side}`
        ;(bySide.get(sk) ?? bySide.set(sk, []).get(sk)!).push({ key, px: X.get(other)! })
      }
    }
    for (const [sk, list] of bySide) {
      const id = sk.split('|')[0]
      list.sort((a, b) => a.px - b.px || (a.key < b.key ? -1 : 1))
      // WIDTH-AWARE ports: each edge's slot is as wide as its strand bundle (+3px), scaled down
      // only if the node face can't fit the sum — thick ribbons get thick berths.
      const widths = list.map((inc) => bundleHalf(inc.key) * 2 + 3)
      const total = widths.reduce((s, w) => s + w, 0)
      const span = nw(id) - 10
      const scale = Math.min(1, span / Math.max(1, total))
      let cx = (-total * scale) / 2
      for (const [i, inc] of list.entries()) {
        portOff.set(`${sk}|${inc.key}`, cx + (widths[i] * scale) / 2)
        cx += widths[i] * scale
      }
    }
  }
  const port = (id: string, side: 't' | 'b', key: string) => ({
    x: X.get(id)! + (portOff.get(`${id}|${side}|${key}`) ?? 0),
    y: Y.get(id)! + (side === 'b' ? NODE_H / 2 : -NODE_H / 2),
  })
  const sinkLane = new Map<string, number>()
  if (includeSink) {
    const list = edges.filter((e) => isSink(e.a) || isSink(e.b)).map((e) => pk(e.a, e.b)).sort()
    list.forEach((k, i) => sinkLane.set(k, i))
  }
  const routes = new Map<string, Route>()
  for (const e of edges) {
    if (isHaKey(e.a, e.b)) continue
    if (filter && !filter(e)) continue
    const key = pk(e.a, e.b)
    if (isSink(e.a) || isSink(e.b)) {
      if (!includeSink) continue
      const nodeId = isSink(e.a) ? e.b : e.a
      const sId = isSink(e.a) ? e.a : e.b
      const np = port(nodeId, 'b', key)
      routes.set(key, { k: 'sink', nx: np.x, ny: np.y, sx: port(sId, 't', key).x, sty: Y.get(sId)! - NODE_H / 2, lane: sinkLane.get(key) ?? 0 })
      continue
    }
    if (depthOf(e.a) === depthOf(e.b)) {
      const p1 = port(e.a, 'b', key),
        p2 = port(e.b, 'b', key)
      routes.set(key, { k: 'ramp', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, busY: 0 })
      continue
    }
    const topId = Y.get(e.a)! <= Y.get(e.b)! ? e.a : e.b,
      botId = topId === e.a ? e.b : e.a
    const p1 = port(topId, 'b', key),
      p2 = port(botId, 't', key)
    const dx = Math.abs(p2.x - p1.x)
    // ORTHOGONAL-DOMINANT grammar: long diagonals crossing at shallow angles were the residual
    // unreadability (Purchase: near-90° crossings are far less harmful). Everything non-vertical
    // becomes V → H(allocated track) → V — all crossings become 90°; corners get 45° chamfers
    // at render time for the metro look.
    if (dx <= 16) routes.set(key, { k: 'straight', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
    else if (p2.y - p1.y > 240)
      // LONG edge (spans intermediate bands): route through an inter-zone GUTTER — through-traffic
      // takes the bypass, not the city streets. V → H → gutter V → H → V (all 90°).
      routes.set(key, { k: 'gutter', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, gx: (p1.x + p2.x) / 2, ty1: 0, ty2: 0 })
    else routes.set(key, { k: 'orth', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, ty: 0 })
  }
  // GUTTER SELECTION: for each long edge pick a vertical corridor x that is free of node boxes
  // across the intermediate y-range; nearest free slot to the edge's midpoint; dodge other gutters.
  {
    const gutters = [...routes.entries()].filter(([, r]) => r.k === 'gutter').sort((a, b) => (a[0] < b[0] ? -1 : 1))
    const placedG: { x: number; y1: number; y2: number; half: number }[] = []
    for (const [key, r] of gutters) {
      if (r.k !== 'gutter') continue
      const half = bundleHalf(key)
      const yLo = r.y1 + 20,
        yHi = r.y2 - 20
      const blocks: [number, number][] = []
      for (const id of ids) {
        if (isSink(id)) continue
        const ny = Y.get(id)!
        if (ny + NODE_H / 2 < yLo || ny - NODE_H / 2 > yHi) continue
        blocks.push([X.get(id)! - nw(id) / 2 - 6, X.get(id)! + nw(id) / 2 + 6])
      }
      blocks.sort((a, b) => a[0] - b[0])
      const merged: [number, number][] = []
      for (const b of blocks) {
        const last = merged[merged.length - 1]
        if (last && b[0] <= last[1] + 4) last[1] = Math.max(last[1], b[1])
        else merged.push([b[0], b[1]])
      }
      const desired = (r.x1 + r.x2) / 2
      const cands: number[] = []
      for (let i = 0; i <= merged.length; i++) {
        const lo = i === 0 ? -1e9 : merged[i - 1][1]
        const hi = i === merged.length ? 1e9 : merged[i][0]
        if (hi - lo < half * 2 + 12) continue
        cands.push(Math.max(lo + half + 6, Math.min(hi - half - 6, desired)))
      }
      cands.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired) || a - b)
      let gx = cands[0] ?? desired
      for (let guard = 0; guard < 40; guard++) {
        const hit = placedG.some((p) => Math.abs(p.x - gx) < p.half + half + 3 && Math.min(p.y2, yHi) - Math.max(p.y1, yLo) > 12)
        if (!hit) break
        gx += 5
      }
      r.gx = gx
      placedG.push({ x: gx, y1: yLo, y2: yHi, half })
    }
  }
  // GLOBAL greedy horizontal-track placement (no two horizontals share a track)
  {
    // each request carries floor AND ceiling — the allocator must stay inside the edge's feasible
    // band, otherwise per-edge clamping in ptsOf silently squashes distinct tracks onto one y
    // (that was the residual-overlap bug: allocator said 154/160/166, clamp said 166/166/166).
    type Req = { key: string; lo: number; hi: number; want: number; floor: number; ceil: number; which?: 't' | 'b' }
    const reqs2: Req[] = []
    for (const [key, r] of routes) {
      if (r.k === 'orth')
        // org-chart convention: turn NEAR THE CHILD (the horizontal run sits just above the target)
        reqs2.push({ key, lo: Math.min(r.x1, r.x2), hi: Math.max(r.x1, r.x2), want: r.y2 - 26, floor: r.y1 + 10, ceil: r.y2 - 10 })
      else if (r.k === 'gutter') {
        reqs2.push({ key, which: 't', lo: Math.min(r.x1, r.gx), hi: Math.max(r.x1, r.gx), want: r.y1 + 26, floor: r.y1 + 10, ceil: r.y2 - 26 })
        reqs2.push({ key, which: 'b', lo: Math.min(r.gx, r.x2), hi: Math.max(r.gx, r.x2), want: r.y2 - 34, floor: r.y1 + 24, ceil: r.y2 - 10 })
      } else if (r.k === 'ramp') {
        const bot = Math.max(r.y1, r.y2)
        reqs2.push({ key, lo: Math.min(r.x1, r.x2), hi: Math.max(r.x1, r.x2), want: bot + 20, floor: bot + 14, ceil: 1e9 })
      }
    }
    reqs2.sort((a, b) => a.want - b.want || (a.key < b.key ? -1 : 1))
    const placed: { y: number; lo: number; hi: number; half: number }[] = []
    for (const q of reqs2) {
      const half = bundleHalf(q.key)
      const conflicts = (yy: number) => placed.some((p) => Math.abs(p.y - yy) < p.half + half + 3 && q.lo < p.hi + 12 && q.hi > p.lo - 12)
      let y = Math.max(q.floor, Math.min(q.ceil, q.want))
      // bidirectional spiral within [floor, ceil]
      for (let step = 6; step <= 240; step += 6) {
        if (!conflicts(y)) break
        const down = Math.max(q.floor, Math.min(q.ceil, q.want + step))
        const up = Math.max(q.floor, Math.min(q.ceil, q.want - step))
        if (down !== y && !conflicts(down)) {
          y = down
          break
        }
        if (up !== y && !conflicts(up)) {
          y = up
          break
        }
      }
      placed.push({ y, lo: q.lo, hi: q.hi, half })
      const r = routes.get(q.key)!
      if (r.k === 'orth') r.ty = y
      else if (r.k === 'gutter') {
        if (q.which === 't') r.ty1 = y
        else r.ty2 = y
      } else if (r.k === 'ramp') r.busY = y
    }
  }
  // VERTICAL corridor allocation: two vertical runs may share an x (ports align across nodes).
  // Same global-greedy idea as horizontals: per edge, pick the smallest x-shift that clears all
  // placed verticals. Geometry-level (the score sees it), not a render-time epsilon.
  {
    const placedV: { x: number; y1: number; y2: number; half: number }[] = []
    // gutter columns FIRST (fixed by gutter selection) so sink drops dodge them, then sinks,
    // then orth/straight dodge both
    for (const [key, r] of routes)
      if (r.k === 'gutter') placedV.push({ x: r.gx, y1: r.y1, y2: r.y2, half: bundleHalf(key) })
    // sink drops get ALLOCATED shifts too (fixed lane jitter still collided across nodes)
    for (const [key, r] of [...routes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
      if (r.k === 'sink') {
        const jx = r.lane * 2 - 16
        const ly = railY - r.lane * 3
        const half = bundleHalf(key)
        const y1 = Math.min(r.ny, ly),
          y2 = Math.max(r.ny, ly)
        let chosen = 0
        outer2: for (const cand of [0, 2.6, -2.6, 5.2, -5.2, 7.8, -7.8, 10.4, -10.4, 13, -13]) {
          for (const p of placedV)
            if (Math.abs(r.nx + jx + cand - p.x) < p.half + half + 2 && Math.min(p.y2, y2) - Math.max(p.y1, y1) > 12) continue outer2
          chosen = cand
          break
        }
        r.jxs = chosen
        placedV.push({ x: r.nx + jx + chosen, y1, y2, half })
        placedV.push({ x: r.sx, y1: Math.min(ly, r.sty), y2: Math.max(ly, r.sty), half })
      }
    const items = [...routes.entries()].filter(([, r]) => r.k === 'orth' || r.k === 'straight').sort((a, b) => (a[0] < b[0] ? -1 : 1))
    for (const [key, r] of items) {
      if (r.k !== 'orth' && r.k !== 'straight') continue
      const half = bundleHalf(key)
      const ty = r.k === 'orth' ? Math.max(r.y1 + 8, Math.min(r.y2 - 8, r.ty)) : 0
      const vsegs =
        r.k === 'straight'
          ? [{ x: (r.x1 + r.x2) / 2, y1: r.y1, y2: r.y2 }]
          : [
              { x: r.x1, y1: r.y1, y2: ty },
              { x: r.x2, y1: ty, y2: r.y2 },
            ]
      let chosen = 0
      outer: for (const cand of [0, 4, -4, 8, -8, 12, -12, 16, -16, 22, -22, 28, -28, 36, -36]) {
        for (const s of vsegs)
          for (const p of placedV)
            if (Math.abs(s.x + cand - p.x) < p.half + half + 3 && Math.min(Math.max(s.y1, s.y2), p.y2) - Math.max(Math.min(s.y1, s.y2), p.y1) > 12)
              continue outer
        chosen = cand
        break
      }
      r.xs = chosen
      for (const s of vsegs) placedV.push({ x: s.x + chosen, y1: Math.min(s.y1, s.y2), y2: Math.max(s.y1, s.y2), half })
    }
  }
  return routes
}
function octiVert(x1: number, y1: number, x2: number, y2: number): [number, number][] {
  if (y2 < y1) {
    const t = x1
    x1 = x2
    x2 = t
    const s = y1
    y1 = y2
    y2 = s
  }
  const dx = x2 - x1,
    dy = y2 - y1
  if (Math.abs(dx) < 3) return [[x1, y1], [x2, y2]]
  if (Math.abs(dx) <= dy - 6) {
    const yA = y1 + (dy - Math.abs(dx)) / 2
    return [[x1, y1], [x1, yA], [x2, yA + Math.abs(dx)], [x2, y2]]
  }
  const h = dy / 2
  const sl = x2 > x1 ? 1 : -1
  return [[x1, y1], [x1 + sl * h, y1 + h], [x2 - sl * h, y1 + h], [x2, y2]]
}
function ptsOf(r: Route): [number, number][] {
  switch (r.k) {
    case 'sink': {
      const jx = r.lane * 2 - 16 + (r.jxs ?? 0) // lane spread + allocated collision-free shift
      const ly = railY - r.lane * 3
      return [[r.nx + jx, r.ny], [r.nx + jx, ly], [r.sx, ly], [r.sx, r.sty]]
    }
    case 'ramp': {
      const b = r.busY
      const sl = r.x1 < r.x2 ? 1 : -1
      if (Math.abs(r.x2 - r.x1) < (b - Math.max(r.y1, r.y2)) * 2 + 6) return [[r.x1, r.y1], [r.x2, r.y2]]
      return [[r.x1, r.y1], [r.x1 + sl * (b - r.y1), b], [r.x2 - sl * (b - r.y2), b], [r.x2, r.y2]]
    }
    case 'straight': {
      const s = r.xs ?? 0
      return [[r.x1 + s, r.y1], [r.x2 + s, r.y2]]
    }
    case 'orth': {
      const s = r.xs ?? 0
      const ty = Math.max(r.y1 + 8, Math.min(r.y2 - 8, r.ty))
      return [[r.x1 + s, r.y1], [r.x1 + s, ty], [r.x2 + s, ty], [r.x2 + s, r.y2]]
    }
    case 'gutter': {
      const t1 = Math.max(r.y1 + 8, Math.min(r.y2 - 24, r.ty1))
      const t2 = Math.max(t1 + 12, Math.min(r.y2 - 8, r.ty2))
      return [[r.x1, r.y1], [r.x1, t1], [r.gx, t1], [r.gx, t2], [r.x2, t2], [r.x2, r.y2]]
    }
  }
}
// score the REAL routed geometry: crossings, collinear overlaps, node-box piercing, bends, length
function routedScore(routes: Map<string, Route>) {
  type Poly = { a: string; b: string; pts: [number, number][]; half: number }
  const polys: Poly[] = []
  for (const [key, r] of routes) {
    const e = edgeByKey.get(key)!
    polys.push({ a: e.a, b: e.b, pts: ptsOf(r), half: bundleHalf(key) })
  }
  let cr = 0,
    ov = 0,
    pierce = 0,
    bends = 0,
    len = 0
  for (const p of polys) {
    bends += p.pts.length - 2
    for (let s = 1; s < p.pts.length; s++) len += Math.hypot(p.pts[s][0] - p.pts[s - 1][0], p.pts[s][1] - p.pts[s - 1][1])
  }
  for (let i = 0; i < polys.length; i++)
    for (let j = i + 1; j < polys.length; j++) {
      const A = polys[i],
        B = polys[j]
      const shared = A.a === B.a || A.a === B.b || A.b === B.a || A.b === B.b
      for (let s = 1; s < A.pts.length; s++)
        for (let t = 1; t < B.pts.length; t++) {
          const a1 = A.pts[s - 1],
            a2 = A.pts[s],
            b1 = B.pts[t - 1],
            b2 = B.pts[t]
          if (!shared && segInt(a1[0], a1[1], a2[0], a2[1], b1[0], b1[1], b2[0], b2[1])) cr++
          // collinear overlap (same math as the SVG probe)
          const vax = a2[0] - a1[0],
            vay = a2[1] - a1[1],
            vbx = b2[0] - b1[0],
            vby = b2[1] - b1[1]
          const la = Math.hypot(vax, vay),
            lb = Math.hypot(vbx, vby)
          if (la < 13 || lb < 13) continue
          if (Math.abs(vax * vby - vay * vbx) / (la * lb) > 0.02) continue
          const dx0 = b1[0] - a1[0],
            dy0 = b1[1] - a1[1]
          if (Math.abs(dx0 * vay - dy0 * vax) / la > A.half + B.half + 0.5) continue // bundle-aware
          const t1 = (dx0 * vax + dy0 * vay) / la
          const t2 = ((b2[0] - a1[0]) * vax + (b2[1] - a1[1]) * vay) / la
          const lo = Math.max(0, Math.min(t1, t2)),
            hi = Math.min(la, Math.max(t1, t2))
          if (hi - lo > 12) ov++
        }
    }
  // node-box piercing: a wire running through an unrelated device box
  for (const p of polys)
    for (const id of ids) {
      if (id === p.a || id === p.b || isSink(id)) continue
      const bx = X.get(id)! - nw(id) / 2 - 2,
        by = Y.get(id)! - NODE_H / 2 - 2,
        bw2 = nw(id) + 4,
        bh = NODE_H + 4
      for (let s = 1; s < p.pts.length; s++) {
        const [x1, y1] = p.pts[s - 1],
          [x2, y2] = p.pts[s]
        if (Math.max(x1, x2) < bx || Math.min(x1, x2) > bx + bw2 || Math.max(y1, y2) < by || Math.min(y1, y2) > by + bh) continue
        const hit =
          segInt(x1, y1, x2, y2, bx, by, bx + bw2, by) ||
          segInt(x1, y1, x2, y2, bx, by + bh, bx + bw2, by + bh) ||
          segInt(x1, y1, x2, y2, bx, by, bx, by + bh) ||
          segInt(x1, y1, x2, y2, bx + bw2, by, bx + bw2, by + bh)
        if (hit) {
          pierce++
          break
        }
      }
    }
  let up = 0
  for (const e of edges) {
    if (!isStructural(e)) continue
    const top = depthOf(e.a) < depthOf(e.b) ? e.a : e.b
    const bot = top === e.a ? e.b : e.a
    if (Y.get(bot)! < Y.get(top)! + 10) up++
  }
  const cost = cr * 1 + ov * 8 + pierce * 2 + bends * 0.5 + len / 400 + up * 12
  return { cost, cr, ov, pierce, bends, up }
}

// ---- multi-start over the parameter grid, scored on ROUTED geometry ----
const CANDS: { z: ZParams; q: QParams }[] = []
for (const gapX of [24, 40])
  for (const zoneGap of [60, 84])
    for (const maxBandW of [1250, 1600])
      CANDS.push({ z: { gapX, pad: 18 }, q: { zoneGap, bandGap: 92, init: 'size', maxBandW } })
type Best = {
  sc: ReturnType<typeof routedScore>
  X: Map<string, number>
  Y: Map<string, number>
  zx: Map<string, number>
  zy: Map<string, number>
  zb: Map<string, { w: number; h: number }>
  lx: Map<string, number>
  ly: Map<string, number>
}
let best: Best | null = null
let bestI = 0
for (let i = 0; i < CANDS.length; i++) {
  // two passes: pass 0 measures channel congestion from REAL tracks, pass 1 re-places with the
  // road bed widened where wire traffic overflowed (congestion-driven place & route)
  bandExtra.clear()
  for (let it2 = 0; it2 < 3; it2++) {
    for (const z of zoneIds) layoutZone(z, CANDS[i].z)
    quotientLayout(CANDS[i].q)
    portRefine()
    snapVerticals()
    resolveRowOverlaps()
    compose()
    if (it2 === 2) break
    // DEMAND-based congestion (measuring placed spans underestimates: the allocator clamps to the
    // channel, so a full channel looks "fitting" while edges were silently stacked). Demand = sum
    // of bundle heights of all H runs wanting this gap; widen the gap by the shortfall.
    const r0 = computeWiring(false)
    const demand = new Map<number, number>()
    const gapOf = (yy: number) => {
      for (let gi = 0; gi + 1 < bandRanges.length; gi++)
        if (yy >= bandRanges[gi].bottom - 4 && yy <= bandRanges[gi + 1].top + 4) return gi
      return -1
    }
    for (const [key, r] of r0) {
      const h = bundleHalf(key) * 2 + 4
      if (r.k === 'orth') {
        const gi = gapOf(r.y2 - 26)
        if (gi >= 0) demand.set(gi, (demand.get(gi) ?? 0) + h)
      } else if (r.k === 'gutter') {
        for (const w of [r.y1 + 26, r.y2 - 34]) {
          const gi = gapOf(w)
          if (gi >= 0) demand.set(gi, (demand.get(gi) ?? 0) + h)
        }
      } else if (r.k === 'ramp') {
        const gi = gapOf(Math.max(r.y1, r.y2) + 20)
        if (gi >= 0) demand.set(gi, (demand.get(gi) ?? 0) + h)
      }
    }
    for (const [gi, dem] of demand) {
      const avail = bandRanges[gi + 1].top - bandRanges[gi].bottom - 24
      if (dem > avail) bandExtra.set(gi + 1, (bandExtra.get(gi + 1) ?? 0) + (dem - avail))
    }
  }
  const sc = routedScore(computeWiring(false))
  console.log(`  #${i} gapX=${CANDS[i].z.gapX} zoneGap=${CANDS[i].q.zoneGap} maxW=${CANDS[i].q.maxBandW}  cost=${sc.cost.toFixed(0)} (cr=${sc.cr} ov=${sc.ov} pierce=${sc.pierce} bends=${sc.bends} up=${sc.up})`)
  if (!best || sc.cost < best.sc.cost) {
    best = { sc, X: new Map(X), Y: new Map(Y), zx: new Map(zX), zy: new Map(zY), zb: new Map(zBox), lx: new Map(localX), ly: new Map(localY) }
    bestI = i
  }
}
for (const [k, v] of best!.X) X.set(k, v)
for (const [k, v] of best!.Y) Y.set(k, v)
for (const [k, v] of best!.zx) zX.set(k, v)
for (const [k, v] of best!.zy) zY.set(k, v)
for (const [k, v] of best!.zb) zBox.set(k, v)
for (const [k, v] of best!.lx) localX.set(k, v)
for (const [k, v] of best!.ly) localY.set(k, v)
console.log(`[MULTI-START routed] ${CANDS.length} candidates, picked #${bestI}: cr=${best!.sc.cr} ov=${best!.sc.ov} pierce=${best!.sc.pierce} bends=${best!.sc.bends} up=${best!.sc.up}; routing overruled barycenter in ${bandReorders} band decisions`)

// ---- HILL-CLIMB: placement proposes a move → wiring re-routes → real geometry decides.
// This is the 突き合わせ loop: neither side is master; the routed score arbitrates every move.
{
  let cur = best!.sc.cost
  let accepted = 0
  const flips: string[] = []
  for (let pass2 = 0; pass2 < 2; pass2++) {
    for (const u of [...units].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      for (const d of [-26, 26]) {
        const snapL = new Map(localX)
        const minX = u.w / 2 + 8,
          maxX = zBox.get(u.zone)!.w - u.w / 2 - 8
        localX.set(u.id, Math.max(minX, Math.min(maxX, localX.get(u.id)! + d)))
        resolveRowOverlaps()
        compose()
        const sc2 = routedScore(computeWiring(false))
        if (sc2.cost < cur - 0.5) {
          cur = sc2.cost
          accepted++
        } else {
          localX.clear()
          for (const [k, v] of snapL) localX.set(k, v)
          compose()
        }
      }
      // PAIR FLIP move (user insight: qfx5120-48y-1/-2 looked wired backwards): the left/right
      // order inside an HA pair was frozen alphabetically at collapse time — let the routed
      // score decide which member faces which side.
      if (u.members.length === 2) {
        u.members.reverse()
        compose()
        const sc2 = routedScore(computeWiring(false))
        if (sc2.cost < cur - 0.5) {
          cur = sc2.cost
          accepted++
          flips.push(u.members.map(label).join('⇄'))
        } else {
          u.members.reverse()
          compose()
        }
      }
    }
  }
  console.log(`[HILL-CLIMB] ${accepted} moves accepted, cost ${best!.sc.cost.toFixed(0)} → ${cur.toFixed(0)}${flips.length ? `; pair flips: ${flips.join(', ')}` : '; no pair flips paid off'}`)
}

// ---- normalize + sink rail ----
let minX = Infinity,
  minY = Infinity,
  maxX = -Infinity,
  maxY = -Infinity
for (const z of zoneIds) {
  minX = Math.min(minX, zX.get(z)!)
  maxX = Math.max(maxX, zX.get(z)! + zBox.get(z)!.w)
  minY = Math.min(minY, zY.get(z)!)
  maxY = Math.max(maxY, zY.get(z)! + zBox.get(z)!.h)
}
for (const z of zoneIds) {
  zX.set(z, zX.get(z)! - minX)
  zY.set(z, zY.get(z)! - minY)
}
for (const id of ids) {
  if (isSink(id)) continue
  X.set(id, X.get(id)! - minX)
  Y.set(id, Y.get(id)! - minY)
}
maxX -= minX
maxY -= minY
const sinkArr = [...sinks].sort()
{
  let sx = 0
  for (const s of sinkArr) {
    X.set(s, sx + nw(s) / 2)
    Y.set(s, maxY + 60)
    sx += nw(s) + 20
  }
  if (sinkArr.length) maxY += 60 + NODE_H
}

// ---- render ----
const PAD = 56
const W = maxX + PAD * 2,
  H = maxY + PAD * 2
const fill: Record<string, string> = { router: '#1b3a5c', firewall: '#5c1b2b', 'l3-switch': '#1b4c4c', hardware: '#2a2f3a' }
const P: string[] = []
P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${W} ${H}" font-family="ui-sans-serif" font-size="11">`)
P.push(`<rect x="${-PAD}" y="${-PAD}" width="${W}" height="${H}" fill="#0d1117"/>`)
// zone regions (explicit region > whitespace alone, Saket 2014); singletons stay unboxed
for (const z of zoneIds) {
  if (zUnits.get(z)!.length < 2) continue
  const b = zBox.get(z)!
  P.push(`<rect x="${zX.get(z)}" y="${zY.get(z)}" width="${b.w}" height="${b.h}" rx="10" fill="#141b26" stroke="#2c3648" stroke-width="1" stroke-dasharray="5 4"/>`)
  P.push(`<text x="${zX.get(z)! + 8}" y="${zY.get(z)! - 5}" fill="#7a8595" font-size="9">${z}</text>`)
}
if (sinkArr.length) P.push(`<text x="${-PAD + 8}" y="${Y.get(sinkArr[0])! - 18}" fill="#7a8595" font-size="11">shared services</text>`)
// EDGE RENDERING — same wiring engine the search optimized against (computeWiring), now with sink.
railY = sinkArr.length ? Y.get(sinkArr[0])! - 30 : maxY + 30
const routes = computeWiring(true)
// draw one logical edge as k parallel strands (k = physical multiplicity, capped at 4 + ×N label).
// Per-strand width/color come from the PER-LINK bandwidth — honest road classes.
function drawStrands(e: { bw: number; mult: number }, mk: (d: number) => string, op: number) {
  const k = Math.min(e.mult || 1, 4)
  const bwEach = e.bw / (e.mult || 1)
  const w = strandW(bwEach)
  const gap = w + 1.8
  for (let i = 0; i < k; i++) {
    const d = (i - (k - 1) / 2) * gap
    P.push(`<path d="${mk(d)}" fill="none" stroke="${ec(bwEach)}" stroke-width="${w.toFixed(1)}" stroke-opacity="${op}" stroke-linejoin="round" stroke-linecap="round"/>`)
  }
  return k
}
// vertical corridors: snapped verticals from DIFFERENT edges can land on the same x. A tiny
// deterministic per-edge epsilon keeps them visually parallel instead of perfectly collinear.
const vEpsRank = new Map<string, number>()
{
  const ks = [...routes.keys()].sort()
  for (const [i, k] of ks.entries()) vEpsRank.set(k, ((i % 7) - 3) * 1.4) // rank-based: no hash collisions
}
const vEps = (key: string) => vEpsRank.get(key) ?? 0
// path string from the SAME geometry the score saw (ptsOf), with per-strand offset: x for all
// points; horizontal runs (ramp/orth/sink lane) also shift in y so strands never merge.
// 90° corners get 45° CHAMFERS (9px) — the metro look without the long-diagonal cost.
function pathOf(r: Route, off: number): string {
  const raw = ptsOf(r)
  // 2-point straight runs: offset strands PERPENDICULAR to the line (x-only offset collapses
  // strands of near-horizontal straights onto each other)
  if (raw.length === 2) {
    const [p1, p2] = raw
    const dxl = p2[0] - p1[0],
      dyl = p2[1] - p1[1]
    const L = Math.hypot(dxl, dyl) || 1
    const px = (-dyl / L) * off,
      py = (dxl / L) * off
    return `M${(p1[0] + px).toFixed(1)} ${(p1[1] + py).toFixed(1)} L ${(p2[0] + px).toFixed(1)} ${(p2[1] + py).toFixed(1)}`
  }
  const pts = raw.map(([x, y]) => [x + off, y] as [number, number])
  // every horizontal run shifts by off in y too, so strands stay parallel on all segments
  if (r.k !== 'straight') {
    const hIdx = new Set<number>()
    for (let i = 0; i + 1 < pts.length; i++)
      if (Math.abs(pts[i][1] - pts[i + 1][1]) < 0.01) {
        hIdx.add(i)
        hIdx.add(i + 1)
      }
    for (const i of hIdx) pts[i][1] += off
  }
  const C = 9
  const out: [number, number][] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1],
      [cx, cy] = pts[i],
      [nx2, ny2] = pts[i + 1]
    const inV = [cx - px, cy - py],
      outV = [nx2 - cx, ny2 - cy]
    const li = Math.hypot(inV[0], inV[1]) || 1,
      lo = Math.hypot(outV[0], outV[1]) || 1
    const isCorner = Math.abs((inV[0] * outV[0] + inV[1] * outV[1]) / (li * lo)) < 0.7 // ~90°
    const c = Math.min(C, li / 2, lo / 2)
    if (isCorner && c > 2) {
      out.push([cx - (inV[0] / li) * c, cy - (inV[1] / li) * c])
      out.push([cx + (outV[0] / lo) * c, cy + (outV[1] / lo) * c])
    } else out.push([cx, cy])
  }
  out.push(pts[pts.length - 1])
  return `M${out.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')}`
}
// pass 0: non-primary (behind, subdued); pass 1: primary tree (front, strong)
for (const pass of [0, 1]) {
  for (const e of edges) {
    if (isHaKey(e.a, e.b)) continue
    const prim = isPrimaryNodeEdge(e)
    if ((pass === 1) !== prim) continue
    const r = routes.get(pk(e.a, e.b))
    if (!r) continue
    const sink = r.k === 'sink'
    const k = drawStrands(e, (d) => pathOf(r, d), sink ? 0.16 : prim ? 0.92 : 0.42)
    if (prim && (e.mult || 1) > k)
      P.push(`<text x="${(r as any).x2 + 6}" y="${((r as any).y1 + (r as any).y2) / 2}" fill="#9fb0c0" font-size="9">×${e.mult}</text>`)
  }
}
for (const id of ids) {
  const x = X.get(id)!,
    y = Y.get(id)!,
    w = nw(id)
  P.push(`<rect x="${x - w / 2}" y="${y - NODE_H / 2}" width="${w}" height="${NODE_H}" rx="6" fill="${fill[dtype(id)] || '#22272e'}" stroke="${rootSet.has(id) ? '#e0a96c' : isSink(id) ? '#c0506e' : '#3d4555'}" stroke-width="${rootSet.has(id) || isSink(id) ? 1.6 : 0.8}"/>`)
  P.push(`<text x="${x}" y="${y + 3.5}" fill="#d9e0e8" text-anchor="middle">${label(id).slice(0, 18)}</text>`)
}
// HA coupling — GLASSES notation (メガネ型): the pair is one logical device built from two boxes,
// joined by a double bridge between their facing edges. Not a wire; drawn above nodes.
for (const [, [a, b]] of [...haPairs.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
  const [l, r] = X.get(a)! <= X.get(b)! ? [a, b] : [b, a]
  const x1 = X.get(l)! + nw(l) / 2,
    x2 = X.get(r)! - nw(r) / 2
  const y = (Y.get(l)! + Y.get(r)!) / 2
  if (x2 - x1 < 4) continue
  if (x2 - x1 > 100) console.log(`[glasses] LONG bridge ${(x2 - x1).toFixed(0)}px: ${label(l)} ⌒ ${label(r)} @y=${y.toFixed(0)}`)
  for (const o of [-3.5, 3.5]) P.push(`<path d="M${x1} ${y + o} H ${x2}" stroke="#9fb0c4" stroke-width="2" stroke-opacity="0.9" fill="none"/>`)
  // lens hint: echo each member's outline so the pair reads as one coupled appliance
  for (const m of [l, r])
    P.push(`<rect x="${X.get(m)! - nw(m) / 2 - 3}" y="${Y.get(m)! - NODE_H / 2 - 3}" width="${nw(m) + 6}" height="${NODE_H + 6}" rx="8" fill="none" stroke="#9fb0c4" stroke-width="1" stroke-opacity="0.55"/>`)
}
P.push('</svg>')
await Bun.write('tmp-test6-v3.svg', P.join('\n'))
await Bun.write(
  'tmp-test6-v3-pos.json',
  JSON.stringify({
    pos: Object.fromEntries(ids.map((id) => [id, { x: X.get(id), y: Y.get(id), w: nw(id), label: label(id), zone: zoneOf(id), depth: depthOf(id) }])),
    edges: edges.map((e) => ({ a: e.a, b: e.b, bw: e.bw, structural: isStructural(e) })),
  }),
)
console.log(`wrote tmp-test6-v3.svg (viewBox ${Math.round(W)}x${Math.round(H)})  zones=${zoneIds.length} (boxed=${zoneIds.filter((z) => zUnits.get(z)!.length >= 2).length})`)
// readability report (the metrics from the §23 diagnosis)
{
  const act = ids.filter((id) => !isSink(id))
  const ys = [...new Set(zoneIds.map((z) => zY.get(z)!))].sort((a, b) => a - b)
  let bands = 1
  for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > 18) bands++
  let pure = 0,
    tot = 0
  for (const id of act) {
    const z = zoneOf(id)
    const mates = act.filter((o) => o !== id && zoneOf(o) === z)
    if (!mates.length) continue
    const near = act
      .filter((o) => o !== id)
      .sort((a, b) => Math.hypot(X.get(a)! - X.get(id)!, Y.get(a)! - Y.get(id)!) - Math.hypot(X.get(b)! - X.get(id)!, Y.get(b)! - Y.get(id)!))
      .slice(0, Math.min(3, mates.length))
    for (const n of near) {
      tot++
      if (zoneOf(n) === z) pure++
    }
  }
  const devs: number[] = []
  for (const e of edges) {
    if (!isStructural(e)) continue
    devs.push((Math.atan2(Math.abs(X.get(e.a)! - X.get(e.b)!), Math.abs(Y.get(e.a)! - Y.get(e.b)!)) * 180) / Math.PI)
  }
  devs.sort((a, b) => a - b)
  const within30 = devs.filter((d) => d <= 30).length
  console.log(`[readability] bands=${bands} zonePurity=${((pure / tot) * 100).toFixed(0)}% flow-within-30°=${((within30 / devs.length) * 100).toFixed(0)}% (median dev ${devs[Math.floor(devs.length / 2)].toFixed(0)}°)`)
}
