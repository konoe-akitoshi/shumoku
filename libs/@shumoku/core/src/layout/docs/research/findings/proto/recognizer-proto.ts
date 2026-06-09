// Prototype: Structure Recognizer core detectors, run on real test6 graph.
// Validates the Round-2 design against real data. Throwaway research script.
type G = { nodes: any[]; links: any[]; subgraphs?: any[] }
const g: G = JSON.parse(await Bun.file('tmp-test6-graph.json').text())

const ids = g.nodes.map((n) => n.id)
const idx = new Map(ids.map((id, i) => [id, i]))
const N = ids.length

// ---- normalize links to endpoints, collapse parallels ----
function ep(x: any) {
  return (x && x.node) || x?.source || x
}
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const parallels = new Map<string, any[]>()
for (const l of g.links) {
  const a = ep(l.from),
    b = ep(l.to)
  if (a == null || b == null || a === b) continue
  if (!idx.has(a) || !idx.has(b)) continue
  const k = pairKey(a, b)
  if (!parallels.has(k)) parallels.set(k, [])
  parallels.get(k)!.push(l)
}
const nbr = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]))
for (const [k] of parallels) {
  const [a, b] = k.split('|')
  nbr.get(a)!.add(b)
  nbr.get(b)!.add(a)
}
const deg = new Map(ids.map((id) => [id, nbr.get(id)!.size]))

console.log(`N=${N} simpleLinks=${parallels.size} (raw ${g.links.length})`)

// ---- parallel-edge / LAG candidates ----
const lagCandidates = [...parallels.entries()].filter(([, ls]) => ls.length >= 2)
console.log(`\nPARALLEL/LAG groups (mult>=2): ${lagCandidates.length}`)
for (const [k, ls] of lagCandidates.sort((a, b) => b[1].length - a[1].length).slice(0, 8)) {
  const speeds = ls.map((l) => l.rateBps || l.metadata?.speedBps || 0)
  console.log(`  ${k}  x${ls.length}  speeds=${speeds.join(',')}`)
}

// ---- Brandes betweenness (unweighted) ----
function brandes() {
  const Cb = new Map(ids.map((id) => [id, 0]))
  for (const s of ids) {
    const S: string[] = []
    const P = new Map<string, string[]>(ids.map((id) => [id, []]))
    const sigma = new Map(ids.map((id) => [id, 0]))
    sigma.set(s, 1)
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
          sigma.set(w, sigma.get(w)! + sigma.get(v)!)
          P.get(w)!.push(v)
        }
      }
    }
    const delta = new Map(ids.map((id) => [id, 0]))
    while (S.length) {
      const w = S.pop()!
      for (const v of P.get(w)!)
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!))
      if (w !== s) Cb.set(w, Cb.get(w)! + delta.get(w)!)
    }
  }
  for (const id of ids) Cb.set(id, Cb.get(id)! / 2)
  return Cb
}
const Cb = brandes()
const maxCb = Math.max(...Cb.values()) || 1

// ---- discretize betweenness -> 4 tiers by percentile ----
const sorted = [...Cb.values()].sort((a, b) => a - b)
const q = (p: number) => sorted[Math.floor((sorted.length - 1) * p)]
const p90 = q(0.9),
  p60 = q(0.6),
  p20 = q(0.2)
function btier(c: number) {
  if (c >= p90) return 0
  if (c >= p60) return 1
  if (c >= p20) return 2
  return 3
}

// compare betweenness-tier vs degree-rank and spec.type
console.log(`\nTOP nodes by BETWEENNESS (tier from Cb) vs degree:`)
const byCb = [...Cb.entries()].sort((a, b) => b[1] - a[1])
for (const [id, c] of byCb.slice(0, 12)) {
  const n = g.nodes[idx.get(id)!]
  const ty = n.spec?.type || n.spec?.kind || '?'
  console.log(
    `  tier${btier(c)} Cb=${c.toFixed(1).padStart(7)} deg=${String(deg.get(id)).padStart(2)}  ${ty.padEnd(8)} ${(n.label || id).slice(0, 28)}`,
  )
}
// degree-top to show the inversion the design warns about
console.log(`\nTOP nodes by DEGREE (what a degree-based layout would centralize):`)
const byDeg = [...deg.entries()].sort((a, b) => b[1] - a[1])
for (const [id, dg] of byDeg.slice(0, 6)) {
  const n = g.nodes[idx.get(id)!]
  console.log(
    `  deg=${String(dg).padStart(2)} Cb=${Cb.get(id)!.toFixed(1).padStart(7)} btier${btier(Cb.get(id)!)}  ${(n.label || id).slice(0, 28)}`,
  )
}

// ---- articulation points (iterative Tarjan) ----
function articulation() {
  const disc = new Map<string, number>(),
    low = new Map<string, number>()
  const AP = new Set<string>()
  let time = 0
  const visited = new Set<string>()
  for (const s of ids) {
    if (visited.has(s)) continue
    // iterative DFS
    const stack: [string, string | null, Iterator<string>][] = [[s, null, nbr.get(s)![Symbol.iterator]()]]
    let rootChildren = 0
    disc.set(s, time)
    low.set(s, time)
    time++
    visited.add(s)
    while (stack.length) {
      const top = stack[stack.length - 1]
      const [u, parent, it] = top
      const nx = it.next()
      if (!nx.done) {
        const w = nx.value
        if (w === parent) continue
        if (!visited.has(w)) {
          visited.add(w)
          disc.set(w, time)
          low.set(w, time)
          time++
          stack.push([w, u, nbr.get(w)![Symbol.iterator]()])
          if (u === s) rootChildren++
        } else {
          low.set(u, Math.min(low.get(u)!, disc.get(w)!))
        }
      } else {
        stack.pop()
        if (stack.length) {
          const par = stack[stack.length - 1][0]
          low.set(par, Math.min(low.get(par)!, low.get(u)!))
          if (par !== s && low.get(u)! >= disc.get(par)!) AP.add(par)
        }
      }
    }
    if (rootChildren >= 2) AP.add(s)
  }
  return AP
}
const AP = articulation()
console.log(`\nARTICULATION POINTS (single points of failure): ${AP.size}`)
for (const id of AP) {
  const n = g.nodes[idx.get(id)!]
  console.log(`  deg=${deg.get(id)} ${(n.label || id).slice(0, 30)}`)
}

// ---- bipartite-dense / fabric block scan (common-neighbor seed) ----
console.log(`\nFABRIC/BIPARTITE scan (pairs sharing >=3 common neighbors):`)
let found = 0
const upper = byCb.slice(0, 15).map(([id]) => id)
const seen = new Set<string>()
for (let i = 0; i < upper.length; i++)
  for (let j = i + 1; j < upper.length; j++) {
    const s1 = upper[i],
      s2 = upper[j]
    const common = [...nbr.get(s1)!].filter((x) => nbr.get(s2)!.has(x))
    if (common.length >= 3) {
      const key = pairKey(s1, s2)
      if (seen.has(key)) continue
      seen.add(key)
      found++
      const l1 = g.nodes[idx.get(s1)!].label || s1
      const l2 = g.nodes[idx.get(s2)!].label || s2
      console.log(`  ${l1.slice(0, 18)} & ${l2.slice(0, 18)} share ${common.length} leaves`)
    }
  }
if (!found) console.log('  (none — no spine-leaf fabric in test6, as expected for a backbone)')

// degree histogram
const dh: Record<number, number> = {}
for (const d of deg.values()) dh[d] = (dh[d] || 0) + 1
console.log(`\nDEGREE histogram:`, JSON.stringify(dh))
