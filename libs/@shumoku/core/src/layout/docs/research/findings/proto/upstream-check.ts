// Check: which backbone routers are actually "upstream"? User says mx301/ptx10002/cisco8712.
// My algorithm picked cisco8711 (max internal degree). Inspect mgmt IP, neighbors, bandwidths.
const g = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const ids: string[] = g.nodes.map((n: any) => n.id)
const node = new Map(g.nodes.map((n: any) => [n.id, n]))
const label = (id: string) => (node.get(id)?.label || id).toString()
const ep = (x: any) => (x && x.node) || x?.source || x
const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

const adj = new Map<string, { to: string; bw: number }[]>(ids.map((id) => [id, []]))
for (const l of g.links) {
  const a = ep(l.from),
    b = ep(l.to)
  if (a == null || b == null || a === b || !node.has(a) || !node.has(b)) continue
  const bw = l.rateBps || l.metadata?.speedBps || 0
  adj.get(a)!.push({ to: b, bw })
  adj.get(b)!.push({ to: a, bw })
}
const meta = (id: string, k: string) => node.get(id)?.metadata?.[k]
const mgmt = (id: string) => meta(id, 'management4') || node.get(id)?.identity?.mgmtIp || '?'

const focus = ids.filter((id) =>
  /mx301|ptx10002|cisco8712|cisco8711|mx304|ne8000-f2c/.test(label(id)),
)
console.log('=== backbone router properties ===')
for (const id of focus.sort((a, b) => adj.get(b)!.length - adj.get(a)!.length)) {
  const n = node.get(id)
  const deg = adj.get(id)!.length
  const maxBw = Math.max(0, ...adj.get(id)!.map((e) => e.bw)) / 1e9
  const sumBw = adj.get(id)!.reduce((s, e) => s + e.bw, 0) / 1e9
  console.log(
    `${label(id).padEnd(22)} mgmt=${String(mgmt(id)).padEnd(14)} model=${(n?.spec?.model || '?').padEnd(16)} deg=${deg} maxLink=${maxBw}G totalBw=${sumBw}G loc=${meta(id, 'location') || '?'}`,
  )
}

console.log('\n=== mgmt IPs of ALL routers (sorted) — low IP often = core/upstream ===')
const routers = ids.filter((id) => /router/.test((node.get(id)?.spec?.type || '').toString()))
for (const id of routers.sort((a, b) => String(mgmt(a)).localeCompare(String(mgmt(b)), undefined, { numeric: true })))
  console.log(`  ${String(mgmt(id)).padEnd(14)} ${label(id)}`)

console.log('\n=== who does cisco8711 connect to? (its neighbors + bw) ===')
const c8711 = ids.find((id) => /cisco8711-32fh/.test(label(id)))!
for (const e of adj.get(c8711)!.sort((a, b) => b.bw - a.bw))
  console.log(`  ${label(e.to).padEnd(24)} ${(e.bw / 1e9) || '?'}G`)

console.log('\n=== the 3 claimed-upstream: their neighbors + bw ===')
for (const name of ['mx301.noc', 'ptx10002-60mr', 'ptx10002-36qdd', 'cisco8712.noc']) {
  const id = ids.find((i) => label(i).startsWith(name))
  if (!id) continue
  console.log(`-- ${label(id)} (mgmt ${mgmt(id)}):`)
  for (const e of adj.get(id)!.sort((a, b) => b.bw - a.bw))
    console.log(`     ${label(e.to).padEnd(24)} ${(e.bw / 1e9) || '?'}G`)
}

console.log('\n=== UNCONNECTED ports (= likely transit/upstream-facing) per backbone router ===')
// a port is "connected" if it appears as from.port/to.port in some link
const usedPorts = new Set<string>()
for (const l of g.links) {
  if (l.from?.port) usedPorts.add(`${ep(l.from)}::${l.from.port}`)
  if (l.to?.port) usedPorts.add(`${ep(l.to)}::${l.to.port}`)
}
const speedToG = (s: string) => { const m = String(s).match(/(\d+)g/i); return m ? +m[1] : 0 }
for (const id of focus.sort((a, b) => String(mgmt(a)).localeCompare(String(mgmt(b)), undefined, { numeric: true }))) {
  const ports = node.get(id)?.ports || []
  const unconn = ports.filter((p: any) => p.speed && !usedPorts.has(`${id}::${p.id}`) && speedToG(p.speed) >= 10)
  const totG = unconn.reduce((s: number, p: any) => s + speedToG(p.speed), 0)
  console.log(`  ${label(id).padEnd(22)} mgmt=${mgmt(id)}  unconnected≥10G ports=${unconn.length} (${totG}G): ${unconn.slice(0,6).map((p:any)=>p.label+'/'+p.speed).join(', ')}`)
}
