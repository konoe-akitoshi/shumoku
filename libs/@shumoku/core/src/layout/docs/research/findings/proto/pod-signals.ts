// Does test6 carry explicit pod/grouping signals we can use for "core + pod columns"?
type G = { nodes: any[]; links: any[]; subgraphs?: any[] }
const g: G = JSON.parse(await Bun.file('tmp-test6-graph.json').text())
const label = (n: any) => (n.label || n.id).toString()

console.log('subgraphs:', JSON.stringify((g.subgraphs || []).map((s: any) => ({ id: s.id, name: s.name, n: (s.nodes || s.members || s.nodeIds || []).length }))))

const byParent: Record<string, string[]> = {}
const byLoc: Record<string, number> = {}
const byHG: Record<string, number> = {}
const bySuffix: Record<string, number> = {}
for (const n of g.nodes) {
  const p = (n.parent || 'none').toString()
  ;(byParent[p] ||= []).push(label(n))
  const loc = (n.metadata?.location || 'none').toString()
  byLoc[loc] = (byLoc[loc] || 0) + 1
  for (const hg of n.metadata?.hostGroups || []) byHG[hg] = (byHG[hg] || 0) + 1
  const m = label(n).match(/\.([a-z0-9]+)$/i)
  const suf = m ? m[1] : '(none)'
  bySuffix[suf] = (bySuffix[suf] || 0) + 1
}
console.log('\n[parent] groups=', Object.keys(byParent).length)
for (const [p, ns] of Object.entries(byParent).sort((a, b) => b[1].length - a[1].length))
  console.log(`  ${ns.length.toString().padStart(2)}  ${p.slice(0, 55)}  e.g. ${ns.slice(0, 4).join(', ')}`)
console.log('\n[label suffix] (pod hint):', JSON.stringify(bySuffix))
console.log('\n[metadata.location] groups=', Object.keys(byLoc).length, JSON.stringify(byLoc))
console.log('\n[hostGroups top]:')
for (const [h, c] of Object.entries(byHG).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${c}  ${h}`)
