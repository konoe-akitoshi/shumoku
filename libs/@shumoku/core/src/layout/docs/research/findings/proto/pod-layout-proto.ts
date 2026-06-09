// Round-3 M-reframed prototype: "core + pod/segment clusters" layout for test6.
// Hypothesis: organizing by pod (segment) — not flat tiers — keeps intra-pod edges
// local so only core↔pod uplinks cross. Deterministic. Throwaway.
// Run from repo root: bun run <this> ; reads tmp-test6-graph.json ; writes tmp-test6-pods.svg
type G = { nodes: any[]; links: any[] }
const g: G = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const node = new Map(g.nodes.map((n) => [n.id, n]))
const ids = g.nodes.map((n) => n.id)
const label = (id: string) => (node.get(id)?.label || id).toString()
const dtype = (id: string) => (node.get(id)?.spec?.type || node.get(id)?.spec?.kind || '?').toString()
const loc = (id: string) => (node.get(id)?.metadata?.location || '').toString()

// collapse parallels
const ep = (x: any) => (x && x.node) || x?.source || x
const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
type LE = { a: string; b: string; mult: number; bw: number }
const logical = new Map<string, LE>()
for (const l of g.links) {
  const a = ep(l.from),
    b = ep(l.to)
  if (a == null || b == null || a === b || !node.has(a) || !node.has(b)) continue
  const k = pk(a, b)
  const e = logical.get(k)
  const bw = l.rateBps || l.metadata?.speedBps || 0
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

// ---- core = densest small cluster among router/l3/fw nodes (greedy, density>=0.5) ----
const bbTypes = new Set(['router', 'firewall', 'l3-switch'])
const bb = ids.filter((id) => bbTypes.has(dtype(id)))
const intDeg = (id: string, set: Set<string>) => [...nbr.get(id)!].filter((w) => set.has(w)).length
const dens = (set: Set<string>) => {
  let e = 0
  for (const x of set) e += intDeg(x, set)
  e /= 2
  const n = set.size
  return n < 2 ? 1 : e / ((n * (n - 1)) / 2)
}
const sortedBB = [...bb].sort((a, b) => intDeg(b, new Set(bb)) - intDeg(a, new Set(bb)) || (a < b ? -1 : 1))
const core = new Set<string>()
for (const id of sortedBB) {
  const t = new Set(core)
  t.add(id)
  if (core.size < 2 || dens(t) >= 0.45) core.add(id)
}
console.log(`core (${core.size}, density ${dens(core).toFixed(2)}): ${[...core].map(label).join(', ')}`)

// ---- segment key for non-core nodes ----
const SINK = ids.find((id) => label(id).includes('lastresort'))
function seg(id: string): string {
  if (core.has(id)) return 'CORE'
  if (id === SINK) return 'SINK'
  const m = label(id).match(/\.([a-z0-9]+)$/i)
  let s = m ? m[1] : 'other'
  if (/^pod/.test(s)) s = 'pods'
  return s
}
const segs = new Map<string, string[]>()
for (const id of ids) {
  const s = seg(id)
  if (s === 'CORE' || s === 'SINK') continue
  ;(segs.get(s) || segs.set(s, []).get(s)!).push(id)
}
console.log(
  'segments:',
  [...segs.entries()].map(([k, v]) => `${k}(${v.length})`).join(' '),
)

// ---- layout ----
const NODE_H = 26,
  ROWH = 40,
  PAD = 60,
  GAPX = 26
const nw = (id: string) => Math.max(58, label(id).length * 6.1 + 16)
const X = new Map<string, number>(),
  Y = new Map<string, number>()

// core block: compact grid top-center
const coreArr = [...core].sort(
  (a, b) => intDeg(b, core) - intDeg(a, core) || (a < b ? -1 : 1),
)
const ccols = Math.ceil(Math.sqrt(coreArr.length))
const ccolW = Math.max(...coreArr.map(nw)) + GAPX
coreArr.forEach((id, i) => {
  X.set(id, (i % ccols) * ccolW + ccolW / 2)
  Y.set(id, Math.floor(i / ccols) * ROWH)
})
const coreBlockW = ccols * ccolW
const coreH = Math.ceil(coreArr.length / ccols) * ROWH

// each segment: mini dependency tree (head = most core-connected; BFS depth = row)
const SEG_TOP = coreH + 90
type SegBlock = { key: string; members: string[]; rows: string[][]; w: number; h: number; desiredX: number }
const blocks: SegBlock[] = []
for (const [key, members] of segs) {
  const head = [...members].sort((a, b) => {
    const ca = [...nbr.get(a)!].filter((w) => core.has(w)).length
    const cb = [...nbr.get(b)!].filter((w) => core.has(w)).length
    return cb - ca || [...nbr.get(b)!].length - [...nbr.get(a)!].length || (a < b ? -1 : 1)
  })[0]
  // BFS within segment from head
  const depth = new Map<string, number>([[head, 0]])
  const q = [head]
  while (q.length) {
    const u = q.shift()!
    for (const w of [...nbr.get(u)!].sort())
      if (members.includes(w) && !depth.has(w)) {
        depth.set(w, depth.get(u)! + 1)
        q.push(w)
      }
  }
  for (const m of members) if (!depth.has(m)) depth.set(m, 1) // disconnected within seg
  const maxD = Math.max(...depth.values())
  const rows: string[][] = Array.from({ length: maxD + 1 }, () => [])
  for (const m of [...members].sort()) rows[depth.get(m)!].push(m)
  const w = Math.max(...rows.map((r) => r.reduce((s, id) => s + nw(id) + GAPX, 0) - GAPX), 1)
  const h = rows.length * ROWH
  // desiredX = avg x of core neighbors of the head/members
  const coreNs = members.flatMap((m) => [...nbr.get(m)!].filter((w) => core.has(w)))
  const dX = coreNs.length ? coreNs.reduce((s, w) => s + X.get(w)!, 0) / coreNs.length : 0
  blocks.push({ key, members, rows, w, h, desiredX: dX })
}

// 2D shelf-pack segment blocks (wrap rows) so it stays compact instead of sprawling wide
blocks.sort((a, b) => b.members.length - a.members.length || (a.key < b.key ? -1 : 1))
const TARGET_W = 1400
let px = 0,
  py = SEG_TOP,
  rowH = 0,
  packW = 0
for (const blk of blocks) {
  if (px > 0 && px + blk.w > TARGET_W) {
    px = 0
    py += rowH + 70
    rowH = 0
  }
  const left = px,
    top = py
  blk.rows.forEach((row, r) => {
    let x = left
    for (const id of row) {
      X.set(id, x + nw(id) / 2)
      Y.set(id, top + r * ROWH)
      x += nw(id) + GAPX
    }
  })
  blk.desiredX = left + blk.w / 2 // for label placement
  px += blk.w + 70
  rowH = Math.max(rowH, blk.h)
  packW = Math.max(packW, px - 70)
}
const totalW = Math.max(packW, coreBlockW)
const coreShift = (totalW - coreBlockW) / 2
for (const id of coreArr) X.set(id, X.get(id)! + coreShift)
// sink: central, just below core — everything connects to it, so keep its edges short
if (SINK) {
  X.set(SINK, totalW / 2)
  Y.set(SINK, coreH + 44)
}

// ---- edge width/color (same C-fix) ----
const ew = (bw: number) => {
  const gb = bw / 1e9
  return gb <= 0 ? 1.5 : Math.max(1.5, Math.min(8, 1.5 + 1.6 * Math.log10(gb + 1)))
}
const ec = (bw: number) => {
  const gb = bw / 1e9
  return gb >= 400 ? '#e06c9f' : gb >= 100 ? '#e0a96c' : gb >= 25 ? '#6ca9e0' : '#6ce0a0'
}

// ---- render ----
let minX = Infinity,
  maxX = -Infinity,
  maxY = -Infinity
for (const id of ids) {
  minX = Math.min(minX, X.get(id)! - nw(id) / 2)
  maxX = Math.max(maxX, X.get(id)! + nw(id) / 2)
  maxY = Math.max(maxY, Y.get(id)!)
}
for (const id of ids) X.set(id, X.get(id)! - minX)
const W = maxX - minX + PAD * 2,
  H = maxY + NODE_H + PAD * 2
const fill: Record<string, string> = { router: '#1b3a5c', firewall: '#5c1b2b', 'l3-switch': '#1b4c4c', hardware: '#2a2f3a' }
const P: string[] = []
P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${W} ${H}" font-family="ui-sans-serif" font-size="11">`)
P.push(`<rect x="${-PAD}" y="${-PAD}" width="${W}" height="${H}" fill="#0d1117"/>`)
// segment region labels
for (const blk of blocks) {
  const xs = blk.members.map((m) => X.get(m)!)
  const cxs = xs.reduce((s, x) => s + x, 0) / xs.length
  const topY = Math.min(...blk.members.map((m) => Y.get(m)!))
  P.push(`<text x="${cxs}" y="${topY - 18}" fill="#5a6577" text-anchor="middle" font-size="11">${blk.key} (${blk.members.length})</text>`)
}
P.push(`<text x="${X.get(coreArr[0])! - ccolW / 2}" y="-22" fill="#e0a96c" font-size="12">core mesh (${core.size}, peer)</text>`)
if (SINK) P.push(`<text x="${X.get(SINK)!}" y="${Y.get(SINK)! - 18}" fill="#c06" text-anchor="middle" font-size="11">sink</text>`)
// edges
for (const e of edges) {
  const x1 = X.get(e.a)!,
    y1 = Y.get(e.a)!,
    x2 = X.get(e.b)!,
    y2 = Y.get(e.b)!
  const my = (y1 + y2) / 2
  P.push(`<path d="M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}" fill="none" stroke="${ec(e.bw)}" stroke-width="${ew(e.bw).toFixed(1)}" stroke-opacity="0.5"/>`)
  if (e.mult >= 2) P.push(`<text x="${(x1 + x2) / 2}" y="${my}" fill="#9fb0c0" font-size="9" text-anchor="middle">×${e.mult}</text>`)
}
// nodes
for (const id of ids) {
  const x = X.get(id)!,
    y = Y.get(id)!,
    w = nw(id)
  P.push(`<rect x="${x - w / 2}" y="${y - NODE_H / 2}" width="${w}" height="${NODE_H}" rx="6" fill="${fill[dtype(id)] || '#22272e'}" stroke="${core.has(id) ? '#e0a96c' : id === SINK ? '#c06' : '#3d4555'}" stroke-width="${core.has(id) || id === SINK ? 1.6 : 0.8}"/>`)
  P.push(`<text x="${x}" y="${y + 3.5}" fill="#d9e0e8" text-anchor="middle">${label(id).slice(0, 18)}</text>`)
}
P.push('</svg>')
await Bun.write('tmp-test6-pods.svg', P.join('\n'))
console.log(`\nwrote tmp-test6-pods.svg (viewBox ${Math.round(W)}x${Math.round(H)})`)

// crossing proxy: count edges whose endpoints are in different segments (cross the gaps)
let crossSeg = 0,
  intraSeg = 0
for (const e of edges) (seg(e.a) === seg(e.b) ? (intraSeg++, 0) : crossSeg++)
console.log(`edges: intra-segment=${intraSeg} cross-segment=${crossSeg} (cross = the uplinks that span gaps)`)

// decompose cross edges: core-involved (expected uplinks) vs pod-pod (breaks modularity)
let coreInv = 0, podPod = 0, sinkInv = 0
for (const e of edges) {
  const sa = seg(e.a), sb = seg(e.b)
  if (sa === sb) continue
  if (sa === 'CORE' || sb === 'CORE') coreInv++
  else if (sa === 'SINK' || sb === 'SINK') sinkInv++
  else podPod++
}
console.log(`cross breakdown: core<->pod=${coreInv} (expected)  sink<->x=${sinkInv}  POD<->POD=${podPod} (breaks modularity)`)
