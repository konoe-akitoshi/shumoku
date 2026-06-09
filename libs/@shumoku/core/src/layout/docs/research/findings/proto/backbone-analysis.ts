// Research: characterize test6's backbone structure BEFORE choosing a rendering for M.
// Is the core a dense mesh (→ matrix/circular) or sparse routers with big fan-out (→ pod columns)?
type G = { nodes: any[]; links: any[] }
const g: G = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const node = new Map(g.nodes.map((n) => [n.id, n]))
const ids = g.nodes.map((n) => n.id)
const label = (id: string) => (node.get(id)?.label || id).toString()
const dtype = (id: string) => (node.get(id)?.spec?.type || node.get(id)?.spec?.kind || '?').toString()
const ep = (x: any) => (x && x.node) || x?.source || x
const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const par = new Map<string, { mult: number; bw: number }>()
for (const l of g.links) {
  const a = ep(l.from),
    b = ep(l.to)
  if (a == null || b == null || a === b || !node.has(a) || !node.has(b)) continue
  const k = pk(a, b)
  const e = par.get(k) || { mult: 0, bw: 0 }
  e.mult++
  e.bw += l.rateBps || l.metadata?.speedBps || 0
  par.set(k, e)
}
const nbr = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]))
for (const k of par.keys()) {
  const [a, b] = k.split('|')
  nbr.get(a)!.add(b)
  nbr.get(b)!.add(a)
}
const deg = (id: string) => nbr.get(id)!.size

function induced(set: Set<string>) {
  let e = 0
  for (const k of par.keys()) {
    const [a, b] = k.split('|')
    if (set.has(a) && set.has(b)) e++
  }
  const n = set.size
  const possible = (n * (n - 1)) / 2
  return { n, e, density: possible ? e / possible : 0, possible }
}

// type distribution
const tc: Record<string, number> = {}
for (const id of ids) tc[dtype(id)] = (tc[dtype(id)] || 0) + 1
console.log('TYPES:', JSON.stringify(tc))

// 1. router/firewall/l3 backbone candidates
const backboneTypes = new Set(['router', 'firewall', 'l3-switch'])
const bb = new Set(ids.filter((id) => backboneTypes.has(dtype(id))))
console.log(`\n[ROUTER/L3/FW subgraph] ${[...bb].map(label).join(', ')}`)
const bbi = induced(bb)
console.log(`  nodes=${bbi.n} internal-edges=${bbi.e}/${bbi.possible} density=${bbi.density.toFixed(2)}`)

// 2. for each backbone node: internal degree (to other backbone) vs fanout (to non-backbone)
console.log('\n[backbone node: internal-deg vs fan-out-deg]')
for (const id of [...bb].sort((a, b) => deg(b) - deg(a))) {
  const internal = [...nbr.get(id)!].filter((w) => bb.has(w)).length
  const fan = deg(id) - internal
  console.log(`  ${label(id).padEnd(24)} type=${dtype(id).padEnd(9)} internal=${internal}  fanout=${fan}`)
}

// 3. k-core max set density (the 17)
function coreness() {
  const d = new Map(ids.map((id) => [id, deg(id)]))
  const c = new Map<string, number>()
  const rem = new Set(ids)
  while (rem.size) {
    let mv = Infinity
    for (const id of rem) mv = Math.min(mv, d.get(id)!)
    for (const id of [...rem].filter((id) => d.get(id)! <= mv).sort()) {
      c.set(id, mv)
      rem.delete(id)
      for (const w of nbr.get(id)!) if (rem.has(w)) d.set(w, d.get(w)! - 1)
    }
  }
  return c
}
const cor = coreness()
const maxc = Math.max(...cor.values())
const kset = new Set(ids.filter((id) => cor.get(id)! >= maxc))
const ki = induced(kset)
console.log(`\n[max k-core=${maxc}] nodes=${ki.n} internal-edges=${ki.e}/${ki.possible} density=${ki.density.toFixed(2)}`)

// 4. is there a TRUE dense sub-mesh? find max clique-ish via greedy on backbone
//    (largest subset of backbone with density > 0.6)
console.log('\n[densest backbone sub-cluster, greedy]')
const sorted = [...bb].sort((a, b) => {
  const ia = [...nbr.get(a)!].filter((w) => bb.has(w)).length
  const ib = [...nbr.get(b)!].filter((w) => bb.has(w)).length
  return ib - ia
})
const cl = new Set<string>()
for (const id of sorted) {
  const test = new Set(cl)
  test.add(id)
  if (induced(test).density >= 0.5 || cl.size < 2) cl.add(id)
}
const cli = induced(cl)
console.log(`  cluster=${[...cl].map(label).join(', ')}`)
console.log(`  nodes=${cli.n} edges=${cli.e} density=${cli.density.toFixed(2)}`)

console.log('\n=> 結論ヒント: density高(>0.5)=密mesh→matrix/circular; density低=疎ルータ+fanout→pod列編成')
