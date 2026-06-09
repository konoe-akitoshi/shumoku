// Round 3 prototype: structure-aware end-to-end layout + SVG render for test6.
// Tests: k-core backbone tiering + BFS distance tiers + LAG collapse + log-capped
// edge width + barycenter ordering + mesh-core compaction. Deterministic. Throwaway.
// Run from repo root: bun run <this> ; reads tmp-test6-graph.json ; writes tmp-test6-proto.svg
type G = { nodes: any[]; links: any[] }
const g: G = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const ids = g.nodes.map((n) => n.id)
const node = new Map(g.nodes.map((n) => [n.id, n]))
const label = (id: string) => (node.get(id)?.label || id).toString()
const dtype = (id: string) => (node.get(id)?.spec?.type || node.get(id)?.spec?.kind || '?').toString()

// ---- collapse parallels, aggregate bandwidth ----
const ep = (x: any) => (x && x.node) || x?.source || x
const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
type LE = { a: string; b: string; mult: number; bw: number }
const logical = new Map<string, LE>()
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
const deg = (id: string) => nbr.get(id)!.size

// ---- k-core coreness ----
function coreness() {
  const d = new Map(ids.map((id) => [id, deg(id)]))
  const core = new Map<string, number>()
  const remaining = new Set(ids)
  while (remaining.size) {
    // find min current degree (deterministic: min then id)
    let mv = Infinity
    for (const id of remaining) mv = Math.min(mv, d.get(id)!)
    const batch = [...remaining].filter((id) => d.get(id)! <= mv).sort()
    for (const id of batch) {
      core.set(id, mv)
      remaining.delete(id)
      for (const w of nbr.get(id)!) if (remaining.has(w)) d.set(w, d.get(w)! - 1)
    }
  }
  return core
}
const core = coreness()
const maxCore = Math.max(...core.values())

// ---- betweenness (Brandes) to tighten the core ----
function brandes() {
  const Cb = new Map(ids.map((id) => [id, 0]))
  for (const s of ids) {
    const S: string[] = [],
      P = new Map<string, string[]>(ids.map((id) => [id, []]))
    const sig = new Map(ids.map((id) => [id, 0]))
    sig.set(s, 1)
    const d = new Map(ids.map((id) => [id, -1]))
    d.set(s, 0)
    const Q = [s]
    while (Q.length) {
      const v = Q.shift()!
      S.push(v)
      for (const w of nbr.get(v)!) {
        if (d.get(w)! < 0) {
          Q.push(w)
          d.set(w, d.get(v)! + 1)
        }
        if (d.get(w)! === d.get(v)! + 1) {
          sig.set(w, sig.get(w)! + sig.get(v)!)
          P.get(w)!.push(v)
        }
      }
    }
    const dl = new Map(ids.map((id) => [id, 0]))
    while (S.length) {
      const w = S.pop()!
      for (const v of P.get(w)!) dl.set(v, dl.get(v)! + (sig.get(v)! / sig.get(w)!) * (1 + dl.get(w)!))
      if (w !== s) Cb.set(w, Cb.get(w)! + dl.get(w)!)
    }
  }
  return Cb
}
const Cb = brandes()
// core = densest SMALL cluster among router/l3/fw nodes (the true backbone partial-mesh).
// k-core==max over-includes pod-pairs on sparse nets; greedy-by-internal-degree while
// density stays >= 0.45 isolates the genuinely interconnected routers (test6: 6 nodes).
const bbTypes = new Set(['router', 'firewall', 'l3-switch'])
const bbAll = new Set(ids.filter((id) => bbTypes.has(dtype(id))))
const intDeg = (id: string, set: Set<string>) => [...nbr.get(id)!].filter((w) => set.has(w)).length
const densOf = (set: Set<string>) => {
  let e = 0
  for (const x of set) e += intDeg(x, set)
  e /= 2
  const n = set.size
  return n < 2 ? 1 : e / ((n * (n - 1)) / 2)
}
const sortedBB = [...bbAll].sort((a, b) => intDeg(b, bbAll) - intDeg(a, bbAll) || (a < b ? -1 : 1))
const coreSet = new Set<string>()
for (const id of sortedBB) {
  const t = new Set(coreSet)
  t.add(id)
  if (coreSet.size < 2 || densOf(t) >= 0.45) coreSet.add(id)
}
// sink: default-route / shared service (high fan-out, not in core). Parked to a side rail
// so its many edges don't distort the tier flow.
const SINK = ids.find((id) => label(id).includes('lastresort')) || ''
console.log(
  `core (${coreSet.size}, density ${densOf(coreSet).toFixed(2)}): ${[...coreSet].map(label).join(', ')}  | sink=${SINK ? label(SINK) : 'none'}`,
)

// ---- tiers: 0 = backbone k-core, else BFS hop distance (capped 3) ----
const tier = new Map<string, number>(ids.map((id) => [id, 99]))
const q: string[] = []
for (const id of [...coreSet].sort()) {
  tier.set(id, 0)
  q.push(id)
}
while (q.length) {
  const u = q.shift()!
  if (u === SINK) continue // sink doesn't propagate tiers (it connects to everything)
  for (const w of [...nbr.get(u)!].sort())
    if (w !== SINK && tier.get(w)! > tier.get(u)! + 1) {
      tier.set(w, Math.min(tier.get(u)! + 1, 3))
      q.push(w)
    }
}
for (const id of ids) if (id !== SINK && tier.get(id)! === 99) tier.set(id, 3) // disconnected → bottom

const tierOf = (id: string) => tier.get(id)!

// ---- DIAGNOSTIC: does the tiering reflect upstream>downstream dependency? ----
// (1) edge tier-delta distribution: |Δtier|=1 is "clean adjacent layering",
//     =0 intra-tier (direction lost), >=2 skip-level (long crossing).
{
  let intra = 0,
    adj = 0,
    skip = 0
  for (const e of edges) {
    const d = Math.abs(tierOf(e.a) - tierOf(e.b))
    if (d === 0) intra++
    else if (d === 1) adj++
    else skip++
  }
  console.log(
    `\n[DEP CHECK] edge tier-delta: adjacent(|Δ|=1)=${adj}  intra(Δ=0)=${intra}  skip(|Δ|>=2)=${skip}  of ${edges.length}`,
  )
  // list the intra-tier (horizontal) edges — what do same-tier links represent?
  console.log('[INTRA-TIER edges] (the horizontal lines):')
  const intraByTier: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [] }
  for (const e of edges) {
    if (tierOf(e.a) === tierOf(e.b)) intraByTier[tierOf(e.a)].push(e)
  }
  for (const t of [0, 1, 2, 3]) {
    const es = intraByTier[t]
    if (!es.length) continue
    console.log(`  tier${t}: ${es.length} intra edges`)
    for (const e of es
      .slice()
      .sort((a, b) => b.bw - a.bw)
      .slice(0, 8)) {
      const gb = (e.bw / 1e9).toFixed(0)
      console.log(
        `    ${label(e.a).slice(0, 20)} — ${label(e.b).slice(0, 20)}  ${gb}G x${e.mult}`,
      )
    }
  }
  // (2) does each non-core node have a clear single upstream (lower tier neighbor)?
  let single = 0,
    multi = 0,
    none = 0
  for (const id of ids) {
    if (tierOf(id) === 0) continue
    const ups = [...nbr.get(id)!].filter((w) => tierOf(w) < tierOf(id))
    if (ups.length === 0) none++
    else if (ups.length === 1) single++
    else multi++
  }
  console.log(
    `[DEP CHECK] non-core nodes: single-upstream=${single}  multi-upstream(redundant)=${multi}  no-upstream(sideways/intra)=${none}`,
  )
}
const tiers = [0, 1, 2, 3]
const byTier = new Map<number, string[]>(tiers.map((t) => [t, ids.filter((id) => tierOf(id) === t && id !== SINK)]))

console.log('maxCoreness=', maxCore, 'coreSet=', coreSet.size)
for (const t of tiers)
  console.log(
    `tier${t}: ${byTier.get(t)!.length} nodes  e.g. ${byTier
      .get(t)!
      .slice(0, 6)
      .map((id) => `${label(id)}(d${deg(id)})`)
      .join(', ')}`,
  )

// ---- placement: structural tiers + dependency-tree x (under primary upstream) ----
const NODE_H = 26,
  COL_GAP = 28,
  GRID_VGAP = 40,
  PAD = 60
const nw = (id: string) => Math.max(60, label(id).length * 6.2 + 18)
const X = new Map<string, number>(),
  Y = new Map<string, number>()

// aggregate bandwidth per logical edge, for primary-upstream selection
const bwBetween = new Map<string, number>()
for (const e of edges) bwBetween.set(pk(e.a, e.b), e.bw)
const upstreams = (id: string) => [...nbr.get(id)!].filter((w) => tierOf(w) < tierOf(id))

// ---- group same-tier connected nodes (union-find over intra-tier edges).
// This bundles ① redundancy twins, ② core peers, ③ pod east-west, ④ flattened fabric
// into contiguous groups so they sit together instead of scattering. ----
const uf = new Map<string, string>(ids.map((id) => [id, id]))
const find = (x: string): string => {
  let r = x
  while (uf.get(r)! !== r) r = uf.get(r)!
  while (uf.get(x)! !== r) {
    const n = uf.get(x)!
    uf.set(x, r)
    x = n
  }
  return r
}
for (const e of edges)
  if (tierOf(e.a) === tierOf(e.b)) uf.set(find(e.a), find(e.b))
const groupId = (id: string) => find(id)

const NODE_H_ = NODE_H,
  ROW_GAP = 150
// small core (true backbone) → single row so downlinks are vertical, not crossing a grid
const cols = byTier.get(0)!.length <= 8 ? byTier.get(0)!.length : Math.ceil(Math.sqrt(byTier.get(0)!.length))
const colWBase = Math.max(...byTier.get(0)!.map(nw)) + COL_GAP * 2
const coreRows = Math.ceil(byTier.get(0)!.length / cols)
const coreBottom = (coreRows - 1) * (NODE_H_ + GRID_VGAP)
const rowY: Record<number, number> = {
  1: coreBottom + ROW_GAP,
  2: coreBottom + ROW_GAP * 2,
  3: coreBottom + ROW_GAP * 3,
}

// PAV-based 1D separation: place sorted `arr` at `desired`, balanced, non-overlapping.
function pavPlace(arr: string[], desired: Map<string, number>, y: number) {
  arr.sort(
    (a, b) =>
      desired.get(a)! - desired.get(b)! ||
      (groupId(a) < groupId(b) ? -1 : groupId(a) > groupId(b) ? 1 : 0) ||
      (a < b ? -1 : 1),
  )
  const prefix: number[] = [0]
  for (let i = 0; i + 1 < arr.length; i++)
    prefix.push(prefix[i] + nw(arr[i]) / 2 + COL_GAP + nw(arr[i + 1]) / 2)
  const target = arr.map((id, i) => desired.get(id)! - prefix[i])
  const blocks: { sum: number; cnt: number }[] = []
  for (const tv of target) {
    blocks.push({ sum: tv, cnt: 1 })
    while (blocks.length >= 2 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].cnt > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].cnt) {
      const b = blocks.pop()!
      blocks[blocks.length - 1].sum += b.sum
      blocks[blocks.length - 1].cnt += b.cnt
    }
  }
  let bi = 0,
    used = 0
  arr.forEach((id, i) => {
    if (used >= blocks[bi].cnt) {
      bi++
      used = 0
    }
    X.set(id, blocks[bi].sum / blocks[bi].cnt + prefix[i])
    Y.set(id, y)
    used++
  })
}

// place tier0 grid given an order, then tiers 1..3 under primary upstreams (grouped).
function placeAll(coreOrder: string[]) {
  coreOrder.forEach((id, i) => {
    X.set(id, (i % cols) * colWBase + colWBase / 2)
    Y.set(id, Math.floor(i / cols) * (NODE_H_ + GRID_VGAP))
  })
  for (const t of [1, 2, 3]) {
    const arr = [...byTier.get(t)!]
    const ind = new Map<string, number>()
    for (const id of arr) {
      const ups = upstreams(id).filter((w) => X.has(w))
      const ns = [...nbr.get(id)!].filter((w) => X.has(w))
      ind.set(
        id,
        ups.length ? ups.reduce((s, w) => s + X.get(w)!, 0) / ups.length : ns.length ? ns.reduce((s, w) => s + X.get(w)!, 0) / ns.length : 0,
      )
    }
    // group barycenter: members of a same-tier group share a desired so PAV keeps them contiguous
    const gsum = new Map<string, number>(),
      gcnt = new Map<string, number>()
    for (const id of arr) {
      const r = groupId(id)
      gsum.set(r, (gsum.get(r) || 0) + ind.get(id)!)
      gcnt.set(r, (gcnt.get(r) || 0) + 1)
    }
    const desired = new Map<string, number>()
    for (const id of arr) {
      const r = groupId(id)
      desired.set(id, gcnt.get(r)! > 1 ? gsum.get(r)! / gcnt.get(r)! : ind.get(id)!)
    }
    pavPlace(arr, desired, rowY[t])
  }
}

// iterated barycenter: reorder core by downstream mean X, re-place, repeat → fewer crossings
let coreOrder = [...byTier.get(0)!].sort()
for (let it = 0; it < 4; it++) {
  placeAll(coreOrder)
  coreOrder = [...byTier.get(0)!].sort((a, b) => {
    const ca = [...nbr.get(a)!].filter((w) => tierOf(w) > 0 && w !== SINK)
    const cb = [...nbr.get(b)!].filter((w) => tierOf(w) > 0 && w !== SINK)
    const ma = ca.length ? ca.reduce((s, w) => s + X.get(w)!, 0) / ca.length : 0
    const mb = cb.length ? cb.reduce((s, w) => s + X.get(w)!, 0) / cb.length : 0
    return ma - mb || (a < b ? -1 : 1)
  })
}
placeAll(coreOrder)

// normalize so leftmost node-edge = 0 (sink excluded — placed at a side rail after)
let minX = Infinity,
  maxX = -Infinity
for (const id of ids) {
  if (id === SINK) continue
  minX = Math.min(minX, X.get(id)! - nw(id) / 2)
  maxX = Math.max(maxX, X.get(id)! + nw(id) / 2)
}
for (const id of ids) if (id !== SINK) X.set(id, X.get(id)! - minX)
let maxRowW = maxX - minX
// sink: side rail on the right, vertically centered in the tier flow
if (SINK) {
  X.set(SINK, maxRowW + 90)
  Y.set(SINK, (rowY[1] + rowY[2]) / 2)
  maxRowW = X.get(SINK)! + nw(SINK) / 2
}
const totalH = rowY[3] + NODE_H

// ---- DEP CHECK 2: how far is each node from its primary upstream horizontally? ----
{
  let sum = 0,
    n = 0,
    aligned = 0
  for (const id of ids) {
    const ups = upstreams(id)
    if (ups.length !== 1) continue
    const d = Math.abs(X.get(id)! - X.get(ups[0])!)
    sum += d
    n++
    if (d < 30) aligned++
  }
  console.log(
    `[DEP CHECK 2] single-upstream nodes: mean |x-parentX|=${(sum / n).toFixed(0)}px, vertically-aligned(<30px)=${aligned}/${n}`,
  )
}

// ---- edge width: log-capped from aggregate bandwidth (the key C-fix) ----
const Gbps = (bw: number) => bw / 1e9
function ewidth(bw: number) {
  const gb = Gbps(bw)
  if (gb <= 0) return 1.5
  return Math.max(1.5, Math.min(8, 1.5 + 1.6 * Math.log10(gb + 1)))
}
function ecolor(bw: number) {
  const gb = Gbps(bw)
  if (gb >= 400) return '#e06c9f' // 400G+
  if (gb >= 100) return '#e0a96c' // 100G
  if (gb >= 25) return '#6ca9e0' // 25-100G
  return '#6ce0a0' // <25G
}

// ---- render SVG ----
const W = maxRowW + PAD * 2,
  H = totalH + PAD * 2
const parts: string[] = []
parts.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${W} ${H}" font-family="ui-sans-serif,system-ui" font-size="11">`,
)
parts.push(`<rect x="${-PAD}" y="${-PAD}" width="${W}" height="${H}" fill="#0d1117"/>`)
// tier band labels
const bandY: Record<number, number> = { 0: -28, 1: rowY[1] - 18, 2: rowY[2] - 18, 3: rowY[3] - 18 }
const tlabels = ['core / backbone (6-router partial mesh)', 'tier 1', 'tier 2', 'tier 3 / edge']
for (const t of tiers)
  parts.push(`<text x="${-PAD + 8}" y="${bandY[t]}" fill="#3d4555">${tlabels[t]}</text>`)
if (SINK)
  parts.push(
    `<text x="${X.get(SINK)!}" y="${Y.get(SINK)! - 18}" fill="#c0506e" text-anchor="middle" font-size="10">shared / default-route</text>`,
  )
// edges first (sink edges faded + dashed so the hub fan-in doesn't dominate)
for (const e of edges) {
  const x1 = X.get(e.a)!,
    y1 = Y.get(e.a)!,
    x2 = X.get(e.b)!,
    y2 = Y.get(e.b)!
  const w = ewidth(e.bw),
    c = ecolor(e.bw)
  const my = (y1 + y2) / 2
  const d = `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  const sinkEdge = e.a === SINK || e.b === SINK
  parts.push(
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w.toFixed(1)}" stroke-opacity="${sinkEdge ? 0.18 : 0.55}"${sinkEdge ? ' stroke-dasharray="4 4"' : ''}/>`,
  )
  if (e.mult >= 2) {
    parts.push(
      `<text x="${(x1 + x2) / 2}" y="${my}" fill="#9fb0c0" font-size="9" text-anchor="middle">×${e.mult}</text>`,
    )
  }
}
// nodes
const fill: Record<string, string> = {
  router: '#1b3a5c',
  firewall: '#5c1b2b',
  'l3-switch': '#1b4c4c',
  hardware: '#2a2f3a',
}
for (const id of ids) {
  const x = X.get(id)!,
    y = Y.get(id)!,
    w = nw(id)
  const isAP = false
  parts.push(
    `<rect x="${x - w / 2}" y="${y - NODE_H / 2}" width="${w}" height="${NODE_H}" rx="6" fill="${fill[dtype(id)] || '#22272e'}" stroke="${coreSet.has(id) ? '#e0a96c' : id === SINK ? '#c0506e' : '#3d4555'}" stroke-width="${coreSet.has(id) || id === SINK ? 1.6 : 0.8}"/>`,
  )
  parts.push(
    `<text x="${x}" y="${y + 3.5}" fill="#d9e0e8" text-anchor="middle">${label(id).slice(0, 18)}</text>`,
  )
}
parts.push('</svg>')
await Bun.write('tmp-test6-proto.svg', parts.join('\n'))
await Bun.write(
  'tmp-test6-v2-pos.json',
  JSON.stringify({
    pos: Object.fromEntries(ids.map((id) => [id, { x: X.get(id), y: Y.get(id), w: nw(id), label: label(id), zone: (node.get(id)?.metadata?.location || 'unzoned').toString(), depth: tierOf(id) }])),
    edges: edges.map((e) => ({ a: e.a, b: e.b, bw: e.bw, structural: Math.abs(tierOf(e.a) - tierOf(e.b)) >= 1 })),
  }),
)
console.log(`\nwrote tmp-test6-proto.svg  (${ids.length} nodes, ${edges.length} logical edges, viewBox ${Math.round(W)}x${Math.round(H)})`)
const widths = edges.map((e) => ewidth(e.bw)).sort((a, b) => a - b)
console.log(
  `edge width: min=${widths[0].toFixed(1)} median=${widths[Math.floor(widths.length / 2)].toFixed(1)} max=${widths[widths.length - 1].toFixed(1)}  (current engine: median 14, max 64)`,
)
