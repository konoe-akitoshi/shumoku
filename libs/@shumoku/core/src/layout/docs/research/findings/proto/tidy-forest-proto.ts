// Round-3 A-refine: dependency-tree FOREST (not rigid tier bands).
// Each core router roots a tidy subtree; children hang directly below their parent
// (dependency reads vertically); subtrees pack via shared leaf-cursor (uses 2D space,
// not one wide row per tier). Tree edges solid; non-tree (redundancy/mesh/cross) faded.
// Deterministic. Throwaway. Run from repo root → writes tmp-test6-tidy.svg
type G = { nodes: any[]; links: any[] }
const g: G = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const ids = g.nodes.map((n) => n.id)
const node = new Map(g.nodes.map((n) => [n.id, n]))
const label = (id: string) => (node.get(id)?.label || id).toString()
const dtype = (id: string) => (node.get(id)?.spec?.type || node.get(id)?.spec?.kind || '?').toString()

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

// core = densest small cluster (true backbone); sink = default-route
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
const core = new Set<string>()
for (const id of [...bbAll].sort((a, b) => intDeg(b, bbAll) - intDeg(a, bbAll) || (a < b ? -1 : 1))) {
  const t = new Set(core)
  t.add(id)
  if (core.size < 2 || densOf(t) >= 0.45) core.add(id)
}
// THE single backbone root = most-central core router. The connected core is ONE tree
// rooted here (not 6 parallel roots) — so the backbone reads as one network, not 6.
const coreRoot = [...core].sort((a, b) => intDeg(b, core) - intDeg(a, core) || (a < b ? -1 : 1))[0]

// reusable BFS-distance-from-root + primary-parent, parameterized by a skip set
function computeDist(skip: Set<string>) {
  const d = new Map<string, number>(ids.map((id) => [id, Infinity]))
  const q: string[] = []
  {
    d.set(coreRoot, 0)
    q.push(coreRoot)
  }
  while (q.length) {
    const u = q.shift()!
    if (skip.has(u)) continue
    for (const w of [...nbr.get(u)!].sort())
      if (!skip.has(w) && d.get(w)! > d.get(u)! + 1) {
        d.set(w, d.get(u)! + 1)
        q.push(w)
      }
  }
  return d
}
function computeParent(d: Map<string, number>, skip: Set<string>) {
  const par = new Map<string, string | null>()
  for (const id of ids) {
    if (id === coreRoot || skip.has(id)) {
      par.set(id, null)
      continue
    }
    const cands = [...nbr.get(id)!].filter((w) => !skip.has(w) && d.get(w)! < d.get(id)!)
    par.set(
      id,
      cands.length
        ? cands.sort((a, b) => {
            const ba = bwBetween.get(pk(id, a)) || 0,
              bb = bwBetween.get(pk(id, b)) || 0
            return bb - ba || d.get(a)! - d.get(b)! || (a < b ? -1 : 1)
          })[0]
        : null,
    )
  }
  return par
}

// pass A: provisional forest (no exclusion) → who is rarely anyone's PRIMARY parent?
let dist = computeDist(new Set())
const parent0 = computeParent(dist, new Set())
const childCount = new Map<string, number>(ids.map((id) => [id, 0]))
for (const id of ids) {
  const p = parent0.get(id)
  if (p) childCount.set(p, childCount.get(p)! + 1)
}
// (reverted to baseline: single default-route sink only; multi-sink/fabric set aside)
const sinks = new Set(ids.filter((id) => label(id).includes('lastresort')))
void childCount
const isSink = (id: string) => sinks.has(id)
console.log(`shared services (multi-sink): ${[...sinks].map((s) => `${label(s)}(deg${nbr.get(s)!.size},child${childCount.get(s)})`).join(', ') || 'none'}`)

// pass B: final forest excluding shared services
dist = computeDist(sinks)
const parent = computeParent(dist, sinks)
const children = new Map<string, string[]>(ids.map((id) => [id, []]))
for (const id of ids) {
  const p = parent.get(id)
  if (p) children.get(p)!.push(id)
}
for (const id of ids) children.get(id)!.sort()

// ---- per-root tidy subtree as a BLOCK, then 2D shelf-pack the blocks ----
const NODE_H = 26,
  ROWV = 80,
  GAPX = 20
const nw = (id: string) => Math.max(58, label(id).length * 6.1 + 14)
const X = new Map<string, number>(),
  Y = new Map<string, number>()

type Block = { root: string; members: string[]; lx: Map<string, number>; ld: Map<string, number>; w: number; h: number; ox: number; oy: number }
function layoutSubtree(root: string): Block {
  let c = 0
  const lx = new Map<string, number>(),
    ld = new Map<string, number>()
  function rec(id: string, depth: number) {
    ld.set(id, depth)
    const ch = children.get(id)!
    if (!ch.length) {
      lx.set(id, c + nw(id) / 2)
      c += nw(id) + GAPX
      return
    }
    for (const k of ch) rec(k, depth + 1)
    lx.set(id, (lx.get(ch[0])! + lx.get(ch[ch.length - 1])!) / 2)
  }
  rec(root, 0)
  const members = [...lx.keys()]
  const w = Math.max(...members.map((m) => lx.get(m)! + nw(m) / 2))
  const h = (Math.max(...members.map((m) => ld.get(m)!)) + 1) * ROWV
  return { root, members, lx, ld, w, h, ox: 0, oy: 0 }
}
// subtree membership (descendants incl self) — for crossing-reduction barycenter
const subtree = new Map<string, Set<string>>()
function buildSubtree(id: string): Set<string> {
  const s = new Set<string>([id])
  for (const c of children.get(id)!) for (const x of buildSubtree(c)) s.add(x)
  subtree.set(id, s)
  return s
}
buildSubtree(coreRoot)

// place forest given a root order. Dependency-driven (NOT screen-fitting): all cones share
// the same top (core row), so depth=down is globally consistent ("upstream is up").
// Cones sit side-by-side in connection order; width is whatever the structure needs.
let blocks: Block[] = []
function placeForest(rootOrder: string[]) {
  blocks = rootOrder.map(layoutSubtree)
  let px = 0
  for (const blk of blocks) {
    blk.ox = px
    blk.oy = 0
    for (const m of blk.members) {
      X.set(m, px + blk.lx.get(m)!)
      Y.set(m, blk.ld.get(m)! * ROWV)
    }
    px += blk.w + 80
  }
}

// CROSSING REDUCTION: iterate — order children & blocks by barycenter of EXTERNAL links
// (pull each subtree toward the side where its non-tree connections live).
function externalBaryX(id: string): number {
  const st = subtree.get(id)!
  let sum = 0,
    n = 0
  for (const d of st) for (const w of nbr.get(d)!) if (!st.has(w) && !isSink(w) && X.has(w)) {
    sum += X.get(w)!
    n++
  }
  return n ? sum / n : (X.get(id) ?? 0)
}
const rootOrder = [coreRoot] // ONE tree rooted at the central backbone router
for (let it = 0; it < 6; it++) {
  placeForest(rootOrder)
  for (const id of ids) {
    const ch = children.get(id)!
    if (ch.length > 1) ch.sort((a, b) => externalBaryX(a) - externalBaryX(b) || (a < b ? -1 : 1))
  }
}
placeForest(rootOrder)
let packW = 0
for (const blk of blocks) packW = Math.max(packW, blk.ox + blk.w)
let maxY = 0
for (const id of ids) if (!isSink(id)) maxY = Math.max(maxY, Y.get(id)!)
let W0 = packW
// shared services: a row of boxes along the bottom (a "shared services" rail)
const sinkArr = [...sinks].sort()
{
  let sx = 0
  for (const s of sinkArr) {
    X.set(s, sx + nw(s) / 2)
    Y.set(s, maxY + ROWV + 10)
    sx += nw(s) + GAPX
  }
  if (sinkArr.length) {
    maxY = maxY + ROWV + 10
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
const isTree = (e: { a: string; b: string }) => parent.get(e.a) === e.b || parent.get(e.b) === e.a

// ---- render ----
const PAD = 60
const W = W0 + PAD * 2,
  H = maxY + NODE_H + PAD * 2
const fill: Record<string, string> = { router: '#1b3a5c', firewall: '#5c1b2b', 'l3-switch': '#1b4c4c', hardware: '#2a2f3a' }
const P: string[] = []
P.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${W} ${H}" font-family="ui-sans-serif" font-size="11">`)
P.push(`<rect x="${-PAD}" y="${-PAD}" width="${W}" height="${H}" fill="#0d1117"/>`)
// faint box per subtree block (each core router's dependency cone)
for (const blk of blocks) {
  P.push(
    `<rect x="${blk.ox - 12}" y="${blk.oy - 30}" width="${blk.w + 24}" height="${blk.h + 24}" rx="10" fill="none" stroke="#202734" stroke-width="1"/>`,
  )
}
P.push(`<text x="${-PAD + 8}" y="-22" fill="#5a6577" font-size="11">core routers = block roots (each box = one router's dependency cone)</text>`)
if (sinkArr.length)
  P.push(`<text x="${-PAD + 8}" y="${Y.get(sinkArr[0])! - 18}" fill="#c0506e" font-size="11">shared services (reached by many — not redundancy)</text>`)
// non-tree edges first (faded), then tree edges (solid) on top so dependency pops
for (const pass of [0, 1]) {
  for (const e of edges) {
    const tree = isTree(e)
    if ((pass === 0) === tree) continue
    const x1 = X.get(e.a)!,
      y1 = Y.get(e.a)!,
      x2 = X.get(e.b)!,
      y2 = Y.get(e.b)!
    const my = (y1 + y2) / 2
    const d = `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
    const sink = isSink(e.a) || isSink(e.b)
    const op = sink ? 0.16 : tree ? 0.85 : 0.3
    P.push(`<path d="${d}" fill="none" stroke="${ec(e.bw)}" stroke-width="${ew(e.bw).toFixed(1)}" stroke-opacity="${op}"${sink || !tree ? ' stroke-dasharray="4 4"' : ''}/>`)
    if (e.mult >= 2 && tree) P.push(`<text x="${(x1 + x2) / 2}" y="${my}" fill="#9fb0c0" font-size="9" text-anchor="middle">×${e.mult}</text>`)
  }
}
for (const id of ids) {
  const x = X.get(id)!,
    y = Y.get(id)!,
    w = nw(id)
  P.push(`<rect x="${x - w / 2}" y="${y - NODE_H / 2}" width="${w}" height="${NODE_H}" rx="6" fill="${fill[dtype(id)] || '#22272e'}" stroke="${core.has(id) ? '#e0a96c' : isSink(id) ? '#c0506e' : '#3d4555'}" stroke-width="${core.has(id) || isSink(id) ? 1.6 : 0.8}"/>`)
  P.push(`<text x="${x}" y="${y + 3.5}" fill="#d9e0e8" text-anchor="middle">${label(id).slice(0, 18)}</text>`)
}
P.push('</svg>')
await Bun.write('tmp-test6-tidy.svg', P.join('\n'))
console.log(`core ${core.size}, sinks ${sinks.size}, blocks ${blocks.length} sizes [${blocks.map((b) => b.members.length).join(',')}]`)
console.log(`wrote tmp-test6-tidy.svg (viewBox ${Math.round(W)}x${Math.round(H)})  tree-edges=${edges.filter(isTree).length}/${edges.length}`)

// ---- classify NON-TREE edges: are the horizontal ones all "redundancy"? ----
{
  const cat = (e: { a: string; b: string }) => {
    if (isSink(e.a) || isSink(e.b)) return 'sink'
    if (core.has(e.a) && core.has(e.b)) return 'core-mesh(peer)'
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
    .filter((e) => !isTree(e) && !isSink(e.a) && !isSink(e.b) && !(core.has(e.a) && core.has(e.b)))
    .sort((a, b) => b.bw - a.bw)
  for (const e of list.slice(0, 16)) {
    const gb = (e.bw / 1e9).toFixed(0)
    const sameDist = dist.get(e.a)! === dist.get(e.b)! ? 'same-tier' : '2nd-uplink'
    console.log(`  ${label(e.a).slice(0, 20).padEnd(20)} — ${label(e.b).slice(0, 20).padEnd(20)} ${gb.padStart(4)}G  ${sameDist}`)
  }
}

// ---- crossing count (straight-segment approximation of the drawn edges) ----
function segInt(ax:number,ay:number,bx:number,by:number,cx:number,cy:number,dx:number,dy:number){
  const d1=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax)
  const d2=(bx-ax)*(dy-ay)-(by-ay)*(dx-ax)
  const d3=(dx-cx)*(ay-cy)-(dy-cy)*(ax-cx)
  const d4=(dx-cx)*(by-cy)-(dy-cy)*(bx-cx)
  return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0))
}
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
