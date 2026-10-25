import { describe, expect, it } from 'vitest'
import type * as input from '../input/model.js'
import { readNetworkModel } from '../models/network-model-graph.js'
import { plainNetwork, stagesOfYaml, structureOfYaml } from './fixtures.js'
import { deriveStructure, setKey } from './index.js'
import type { Stages } from './stage-types.js'
import type { Structure, Vertex } from './types.js'

/** A vertex as one comparable string. */
const key = (v: Vertex): string =>
  'unit' in v
    ? `unit:${v.unit}`
    : 'segment' in v
      ? `segment:${v.segment}`
      : `routingDomain:${v.routingDomain}`

// A small seeded generator, so a failure can be run again.
function random(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

/** Three sites with a ring between their cores; each has access switches with servers. */
function sitesYaml(
  extra: { server?: string; link?: [string, string]; outside?: string[] } = {},
): string {
  const lines: string[] = ['groups:']
  const nodes: string[] = []
  const links: string[] = []
  const link = (a: string, b: string) =>
    links.push(`  - endpoints: [{ node: ${a} }, { node: ${b} }]`)
  const redundancy: string[] = []
  for (const k of [1, 2, 3]) {
    lines.push(`  - { id: site${k} }`)
    nodes.push(`  - { id: c${k}, group: site${k} }`)
    for (const f of [1, 2]) {
      nodes.push(`  - { id: c${k}-fw${f}, group: site${k} }`)
      link(`c${k}`, `c${k}-fw${f}`)
    }
    redundancy.push(`  - { id: c${k}-ha, nodes: [c${k}-fw1, c${k}-fw2] }`)
    for (const i of [1, 2, 3, 4]) {
      nodes.push(`  - { id: c${k}-a${i}, group: site${k} }`)
      link(`c${k}`, `c${k}-a${i}`)
      for (const j of [1, 2, 3]) {
        nodes.push(`  - { id: c${k}-a${i}-s${j}, group: site${k} }`)
        link(`c${k}-a${i}`, `c${k}-a${i}-s${j}`)
      }
    }
  }
  link('c1', 'c2')
  link('c2', 'c3')
  link('c3', 'c1')
  if (extra.server) {
    nodes.push(`  - { id: ${extra.server.split(':')[0]}, group: site3 }`)
    link(extra.server.split(':')[0] as string, extra.server.split(':')[1] as string)
  }
  if (extra.link) link(extra.link[0], extra.link[1])
  // A node with no group, joined to each named node, puts the outside next to that node.
  for (const [i, at] of (extra.outside ?? []).entries()) {
    nodes.push(`  - { id: ext${i} }`)
    link(`ext${i}`, at)
  }
  return `${lines.join('\n')}\nredundancy:\n${redundancy.join('\n')}\nnodes:\n${nodes.join('\n')}\nlinks:\n${links.join('\n')}\n`
}

const configOf = (yaml: string): input.Network => readNetworkModel(yaml).config

describe('the structure does not depend on the order things are written in', () => {
  const cases: [string, string][] = [
    ['sites', sitesYaml()],
    ['sites with an outside', sitesYaml({ outside: ['c1', 'c3-a2', 'c3-a1-s1'] })],
    [
      'rings and a bipartite core',
      plainNetwork({
        links: 'a-b b-c c-d d-a a-c p1-q1 p1-q2 p1-q3 p2-q1 p2-q2 p2-q3 a-p1 d-p2 d-x x-y',
        rest: 'groups:\n  - { id: g1, groups: [{ id: g2 }] }',
        place: { a: 'g1', b: 'g2', c: 'g2', p1: 'g1', q1: 'g1' },
      }),
    ],
  ]
  for (const [name, yaml] of cases) {
    it(`for ${name}`, () => {
      const base = deriveStructure(configOf(yaml))
      for (const seed of [1, 2, 3, 4, 5]) {
        const rnd = random(seed)
        const config = configOf(yaml)
        const reorderGroups = (gs: readonly input.Group[] | undefined): input.Group[] | undefined =>
          gs && shuffled(gs, rnd).map((g) => ({ ...g, groups: reorderGroups(g.groups) }))
        const mixed: input.Network = {
          ...config,
          groups: reorderGroups(config.groups),
          redundancy:
            config.redundancy &&
            shuffled(config.redundancy, rnd).map((r) => ({
              ...r,
              nodes: shuffled(r.nodes, rnd),
            })),
          nodes: shuffled(config.nodes, rnd),
          links: shuffled(config.links, rnd).map((l) => ({
            ...l,
            endpoints: shuffled(l.endpoints, rnd) as unknown as input.Link['endpoints'],
          })),
        }
        expect(deriveStructure(mixed)).toEqual(base)
      }
    })
  }
})

// ---- renaming -------------------------------------------------------------------------------

/** What renaming `from` to `to` does to a structure written with the old name. */
function renamed<T>(value: T, from: string, to: string): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v === from ? to : v
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k === from ? to : k, walk(x)]))
    }
    return v
  }
  return walk(value) as T
}

function renameNode(config: input.Network, from: string, to: string): input.Network {
  const text = JSON.stringify(config)
  // Ids appear as whole JSON strings in this network, so a string swap is exact.
  return JSON.parse(text.split(`"${from}"`).join(`"${to}"`))
}

describe('a rename changes only the ids that contain the node', () => {
  const yaml = sitesYaml()

  it('follows an id that keeps its place in the order', () => {
    const base = deriveStructure(configOf(yaml))
    // c2-a3-s1 -> c2-a3-s1x sorts the same against every other id.
    const after = deriveStructure(renameNode(configOf(yaml), 'c2-a3-s1', 'c2-a3-s1x'))
    expect(after).toEqual(renamed(base, 'c2-a3-s1', 'c2-a3-s1x'))
  })

  it('follows a redundancy set and a host', () => {
    const base = deriveStructure(configOf(yaml))
    const after = deriveStructure(renameNode(configOf(yaml), 'c1-ha', 'c1-ha2'))
    expect(after).toEqual(renamed(base, 'c1-ha', 'c1-ha2'))
  })

  it('keeps every block and bundle when the order does change', () => {
    const base = deriveStructure(configOf(yaml))
    const after = deriveStructure(renameNode(configOf(yaml), 'c2-a3-s1', 'zz'))
    const sizes = (s: Structure) => ({
      blocks: s.planes.flatMap((p) => p.blocks.map((b) => b.members.length)).sort(),
      twins: s.planes.flatMap((p) => p.twins.map((t) => t.members.length)).sort(),
      same: s.same.map((c) => c.length).sort(),
    })
    expect(sizes(after)).toEqual(sizes(base))
    const holds = (b: { members: readonly Vertex[] }, id: string) =>
      b.members.some((m) => key(m) === `unit:${id}`)
    const touching = (s: Structure, id: string) =>
      s.planes.flatMap((p) => p.blocks).filter((b) => holds(b, id)).length
    expect(touching(after, 'zz')).toBe(touching(base, 'c2-a3-s1'))
    // The blocks that do not hold the node are the same blocks.
    const without = (s: Structure, id: string) =>
      new Set(
        s.planes
          .flatMap((p) => p.blocks)
          .filter((b) => !holds(b, id))
          .map((b) => setKey(b.members.map(key))),
      )
    expect(without(after, 'zz')).toEqual(without(base, 'c2-a3-s1'))
  })
})

// ---- locality -------------------------------------------------------------------------------

function sets(s: Structure): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>()
  const add = (kind: string, members: readonly Vertex[]) => {
    const keys = members.map(key)
    out.set(`${kind}|${setKey(keys)}`, keys)
  }
  for (const p of s.planes) {
    for (const b of p.blocks) add('block', b.members)
    for (const t of p.twins) add('twins', t.members)
  }
  for (const p of s.planes) {
    for (const [a, b] of p.above) out.set(`above|${key(a)}|${key(b)}`, [key(a), key(b)])
    for (const [a, b] of p.beside) out.set(`beside|${key(a)}|${key(b)}`, [key(a), key(b)])
  }
  return out
}

/** The vertices within some hops of the start, going from vertex to vertex of a block. */
function near(stages: readonly Stages[], start: readonly string[], hops: number): Set<string> {
  const adj = new Map<string, Set<string>>()
  for (const s of stages) {
    for (const p of s.planes) {
      for (const b of p.decomposition.blocks) {
        const keys = b.vertices
        for (const a of keys) {
          for (const c of keys) if (a !== c) adj.set(a, (adj.get(a) ?? new Set()).add(c))
        }
      }
    }
  }
  let ring = new Set(start)
  const seen = new Set(start)
  for (let i = 0; i < hops; i++) {
    const next = new Set<string>()
    for (const v of ring) for (const w of adj.get(v) ?? []) if (!seen.has(w)) next.add(w)
    for (const w of next) seen.add(w)
    ring = next
  }
  return seen
}

function tally(changed: ReadonlyMap<string, readonly string[]>) {
  const out = { block: 0, twins: 0, above: 0, beside: 0 }
  for (const k of changed.keys()) out[k.slice(0, k.indexOf('|')) as keyof typeof out]++
  return out
}

function changes(before: Structure, after: Structure) {
  const a = sets(before)
  const b = sets(after)
  const changed = new Map<string, readonly string[]>()
  for (const [k, v] of a) if (!b.has(k)) changed.set(k, v)
  for (const [k, v] of b) if (!a.has(k)) changed.set(k, v)
  return { changed, total: Math.max(a.size, b.size) }
}

describe('adding one node or one line changes only what is around it', () => {
  const base = deriveStructure(configOf(sitesYaml({ outside: ['c1'] })))

  it('adds a server at one site', () => {
    const after = deriveStructure(configOf(sitesYaml({ outside: ['c1'], server: 'newsrv:c3-a1' })))
    const { changed, total } = changes(base, after)
    const around = near(
      [
        stagesOfYaml(sitesYaml({ outside: ['c1'] })),
        stagesOfYaml(sitesYaml({ outside: ['c1'], server: 'newsrv:c3-a1' })),
      ],
      ['unit:newsrv'],
      2,
    )
    expect(changed.size).toBeGreaterThan(0)
    for (const members of changed.values()) {
      expect(
        members.some((m) => around.has(m)),
        members.join(' '),
      ).toBe(true)
    }
    // Nothing that lies wholly inside another site changed.
    for (const members of changed.values()) {
      expect(members.every((m) => /^unit:c[12]/.test(m))).toBe(false)
    }
    const kinds = tally(changed)
    expect(kinds.block + kinds.twins + kinds.above + kinds.beside).toBeLessThan(12)
    expect(total).toBeGreaterThan(60)
  })

  it('adds a second line from a server to another switch of its site', () => {
    const linked = sitesYaml({ outside: ['c1'], link: ['c3-a1-s1', 'c3-a2'] })
    const after = deriveStructure(configOf(linked))
    const { changed, total } = changes(base, after)
    const around = near(
      [stagesOfYaml(sitesYaml({ outside: ['c1'] })), stagesOfYaml(linked)],
      ['unit:c3-a1-s1', 'unit:c3-a2'],
      2,
    )
    expect(changed.size).toBeGreaterThan(0)
    for (const members of changed.values()) {
      expect(
        members.some((m) => around.has(m)),
        members.join(' '),
      ).toBe(true)
    }
    const kinds = tally(changed)
    expect(kinds.block + kinds.twins + kinds.above + kinds.beside).toBeLessThan(12)
    expect(total).toBeGreaterThan(60)
  })
})

// ---- same form ------------------------------------------------------------------------------

/** What a structure says without any name. */
function nameless(s: Structure) {
  const sorted = <T>(xs: T[]) => xs.map((x) => JSON.stringify(x)).sort()
  return {
    folded: Object.keys(s.nodes).length,
    planes: s.planes.map((p) => p.plane),
    blocks: sorted(
      s.planes.flatMap((p) =>
        p.blocks.map((b) => [
          b.members.length,
          (b.shape ?? []).map((x) => Object.keys(x)[0]).sort(),
        ]),
      ),
    ),
    twins: sorted(
      s.planes.flatMap((p) => p.twins.map((t) => [t.members.length, t.with.length, t.adjacent])),
    ),
    same: s.same.map((c) => c.length).sort(),
    lines: s.planes.map((p) => [p.above.length, p.beside.length]),
    edges: sorted(s.edges.map((e) => [e.toward.length, e.members?.length ?? 0])),
  }
}

describe('configurations that differ only in names give the same form', () => {
  for (const outside of [[], ['c1', 'c3-a2']]) {
    it(`for the sites network under another naming (outside at ${outside.length})`, () => {
      const yaml = sitesYaml({ outside })
      const config = configOf(yaml)
      const ids = new Map<string, string>()
      const names = shuffled(
        [
          ...config.nodes.map((n) => n.id),
          ...(config.groups ?? []).map((g) => g.id),
          ...(config.redundancy ?? []).map((r) => r.id),
        ],
        random(7),
      )
      for (const [i, id] of names.entries())
        ids.set(id, `q${String(names.length - i).padStart(4, '0')}`)
      const text = JSON.stringify(config).replace(/"([^"]+)"/g, (whole, id: string) => {
        const mapped = ids.get(id)
        return mapped ? `"${mapped}"` : whole
      })
      const other = deriveStructure(JSON.parse(text) as input.Network)
      expect(nameless(other)).toEqual(nameless(deriveStructure(config)))
    })
  }

  it('for the same sites told in a different order and with other names, by YAML', () => {
    const a = structureOfYaml(plainNetwork({ links: 'a-b b-c c-a c-d' }))
    const b = structureOfYaml(plainNetwork({ links: 'z9-y8 y8-x7 x7-z9 w1-x7' }))
    expect(nameless(a)).toEqual(nameless(b))
  })
})

// ---- the decomposition on random graphs -----------------------------------------------------

describe('the SPQR tree of random blocks', () => {
  for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
    it(`holds together (seed ${seed})`, () => {
      const rnd = random(seed)
      const n = 5 + Math.floor(rnd() * 5)
      const pairs: string[] = []
      for (let i = 1; i < n; i++) pairs.push(`v${i}-v${Math.floor(rnd() * i)}`)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) if (rnd() < 0.25) pairs.push(`v${i}-v${j}`)
      }
      // A line twice is one line to the graph; take each pair once.
      const once = [...new Set(pairs.map((p) => p.split('-').sort().join('-')))]
      const d = stagesOfYaml(plainNetwork({ links: once.join(' ') })).planes[0]?.decomposition
      for (const block of d?.blocks ?? []) {
        const nodes = block.spqr?.nodes ?? []
        if (block.vertices.length < 3) continue
        const real = nodes.flatMap((x) => x.edges.filter((e) => e.kind === 'real'))
        expect(real).toHaveLength(block.edges.length)
        const virtual = nodes.flatMap((x) => x.edges.filter((e) => e.kind === 'virtual'))
        expect(virtual).toHaveLength(2 * (nodes.length - 1))
        for (const x of nodes) {
          if (x.kind === 'P') expect(x.edges.length).toBeGreaterThanOrEqual(3)
          if (x.kind === 'S') {
            expect(x.edges).toHaveLength(x.vertices.length)
            expect(x.vertices.length).toBeGreaterThanOrEqual(3)
          }
          if (x.kind === 'R') expect(x.vertices.length).toBeGreaterThanOrEqual(4)
          for (const e of x.edges) {
            if (e.kind !== 'virtual') continue
            const other = nodes.find((m) => m.key === e.to)
            expect(other).toBeDefined()
            // Neighbours of the same kind would have been one node.
            if (other && x.kind !== 'R') expect(other.kind).not.toBe(x.kind)
          }
        }
        // The vertices of the nodes cover the block and the nodes make a tree.
        expect(new Set(nodes.flatMap((x) => x.vertices))).toEqual(new Set(block.vertices))
      }
    })
  }
})

// ---- orientation ----------------------------------------------------------------------------

describe('the way the lines run', () => {
  const plane = (yaml: string) => structureOfYaml(yaml).planes.find((p) => p.plane === 'default')

  it('never goes round: following the lines away from the outside comes to an end', () => {
    const p = plane(sitesYaml({ outside: ['c1', 'c3-a2', 'c3-a1-s1'] }))
    const next = new Map<string, string[]>()
    for (const [a, b] of p?.above ?? []) next.set(key(a), [...(next.get(key(a)) ?? []), key(b)])
    const state = new Map<string, 'open' | 'done'>()
    const visit = (v: string): void => {
      expect(state.get(v), v).not.toBe('open')
      if (state.get(v) === 'done') return
      state.set(v, 'open')
      for (const w of next.get(v) ?? []) visit(w)
      state.set(v, 'done')
    }
    for (const v of next.keys()) visit(v)
  })

  it('lists every line the outside reaches once, either running or beside', () => {
    const yaml = sitesYaml({ outside: ['c1'] })
    const p = plane(yaml)
    const lines = stagesOfYaml(yaml).planes.find((q) => q.plane === 'default')?.edges ?? []
    const listed = [...(p?.above ?? []), ...(p?.beside ?? [])].map(([a, b]) =>
      setKey([key(a), key(b)]),
    )
    expect(new Set(listed).size).toBe(listed.length)
    expect(new Set(listed)).toEqual(new Set(lines.map((e) => setKey([e.a, e.b]))))
  })

  it('does not change at one site when an outside is added at another', () => {
    const at = (yaml: string) =>
      (plane(yaml)?.above ?? [])
        .map(([a, b]) => `${key(a)}>${key(b)}`)
        .filter((l) => l.startsWith('unit:c1-'))
        .sort()
    const before = at(sitesYaml({ outside: ['c1'] }))
    expect(before.length).toBeGreaterThan(10)
    expect(at(sitesYaml({ outside: ['c1', 'c3-a1-s1'] }))).toEqual(before)
  })
})
