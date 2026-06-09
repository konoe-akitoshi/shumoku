// Does link from/to encode a meaningful direction (upstream→downstream)?
const g = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const node = new Map(g.nodes.map((n: any) => [n.id, n]))
const label = (id: string) => (node.get(id)?.label || id).toString()
const ep = (x: any) => (x && x.node) || x?.source || x
const mgmt = (id: string) => node.get(id)?.metadata?.management4 || node.get(id)?.identity?.mgmtIp || '?'
const isCore = (id: string) => /mx301|ptx10002|cisco871[12]|mx304|ne8000-f2c/.test(label(id))

// in/out degree per node (treating from→to as directed)
const outd = new Map<string, number>(),
  ind = new Map<string, number>()
for (const id of node.keys() as any) {
  outd.set(id, 0)
  ind.set(id, 0)
}
let withDir = 0
for (const l of g.links) {
  const a = ep(l.from),
    b = ep(l.to)
  if (a == null || b == null || a === b || !node.has(a) || !node.has(b)) continue
  withDir++
  outd.set(a, outd.get(a)! + 1)
  ind.set(b, ind.get(b)! + 1)
}
console.log(`links with from/to: ${withDir}`)

console.log('\n=== backbone routers: out(from) vs in(to) degree, sorted by mgmt ===')
const focus = [...node.keys()].filter((id: any) => isCore(id)) as string[]
for (const id of focus.sort((a, b) => String(mgmt(a)).localeCompare(String(mgmt(b)), undefined, { numeric: true })))
  console.log(`  mgmt=${String(mgmt(id)).padEnd(12)} ${label(id).padEnd(22)} out(from)=${outd.get(id)} in(to)=${ind.get(id)}`)

console.log('\n=== direction of every backbone↔backbone link (from → to) ===')
for (const l of g.links) {
  const a = ep(l.from),
    b = ep(l.to)
  if (!node.has(a) || !node.has(b) || a === b) continue
  if (isCore(a) && isCore(b))
    console.log(`  ${label(a).padEnd(22)} → ${label(b).padEnd(22)} ${(l.rateBps || l.metadata?.speedBps || 0) / 1e9}G`)
}

console.log('\n=== for a few leaf/pod nodes: are they "from" or "to"? (downstream should be consistent) ===')
for (const name of ['qfx5240-64od', 'nexus9164e-ns4', 'fh10.svc', 'ex4400.pod4']) {
  const id = [...node.keys()].find((i: any) => label(i).startsWith(name)) as string
  if (!id) continue
  console.log(`  ${label(id)}: out(from)=${outd.get(id)} in(to)=${ind.get(id)}`)
}
