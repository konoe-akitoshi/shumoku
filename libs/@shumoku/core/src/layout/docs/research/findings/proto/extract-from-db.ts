import { Database } from 'bun:sqlite'

const db = new Database('apps/server/data/shumoku.db', { readonly: true })
const TID = 'zwf0FSU08IMr'

// resolved graph table
const cols = db.query(`PRAGMA table_info(topology_resolved_graph)`).all() as any[]
console.log('topology_resolved_graph cols:', cols.map((c) => c.name).join(', '))
const row = db.query(`SELECT * FROM topology_resolved_graph WHERE topology_id = ?`).get(TID) as any
if (!row) {
  console.log('no resolved graph row; trying all rows')
  const all = db.query(`SELECT topology_id FROM topology_resolved_graph`).all() as any[]
  console.log('topology_ids:', all.map((r) => r.topology_id).join(', '))
  process.exit(0)
}

// find the JSON column
let graph: any = null
for (const k of Object.keys(row)) {
  const v = row[k]
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try {
      const p = JSON.parse(v)
      if (p.nodes || p.links) {
        graph = p
        console.log('graph JSON in column:', k)
        break
      }
    } catch {}
  }
}
if (!graph) {
  console.log('columns/values:')
  for (const k of Object.keys(row)) console.log(' ', k, '=', String(row[k]).slice(0, 80))
  process.exit(0)
}

const nodes = graph.nodes || []
const links = graph.links || []
const subs = graph.subgraphs || []
console.log('NODES', nodes.length, 'LINKS', links.length, 'SUBGRAPHS', subs.length)
console.log('sample node:', JSON.stringify(nodes[0]))
console.log('sample link:', JSON.stringify(links[0]))

// role/type distribution
const roleCount: Record<string, number> = {}
for (const n of nodes) {
  const r = (n.role || n.type || n.deviceType || 'none').toString().toLowerCase()
  roleCount[r] = (roleCount[r] || 0) + 1
}
console.log('roles/types:', JSON.stringify(roleCount))

// write graph out for analysis
await Bun.write('tmp-test6-graph.json', JSON.stringify(graph))
console.log('wrote tmp-test6-graph.json')
db.close()
