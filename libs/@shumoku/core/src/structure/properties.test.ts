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
  extra: { server?: string; link?: [string, string]; boundary?: string[] } = {},
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
  // A virtual line from each named node to a node of its own makes the named node a boundary point.
  for (const [i, at] of (extra.boundary ?? []).entries()) {
    nodes.push(`  - { id: ext${i} }`)
    links.push(`  - { endpoints: [{ node: ext${i} }, { node: ${at} }], virtual: true }`)
  }
  return `${lines.join('\n')}\nredundancy:\n${redundancy.join('\n')}\nnodes:\n${nodes.join('\n')}\nlinks:\n${links.join('\n')}\n`
}

const configOf = (yaml: string): input.Network => readNetworkModel(yaml).config

describe('the structure does not depend on the order things are written in', () => {
  const atThree = ['c1', 'c3-a2', 'c3-a1-s1']
  const cases: [string, string, string[]?][] = [
    ['sites', sitesYaml()],
    ['sites with boundary points', sitesYaml({ boundary: atThree }), atThree],
    [
      'rings and a bipartite core',
      plainNetwork({
        links: 'a-b b-c c-d d-a a-c p1-q1 p1-q2 p1-q3 p2-q1 p2-q2 p2-q3 a-p1 d-p2 d-x x-y',
        rest: 'groups:\n  - { id: g1, groups: [{ id: g2 }] }',
        place: { a: 'g1', b: 'g2', c: 'g2', p1: 'g1', q1: 'g1' },
      }),
    ],
  ]
  for (const [name, yaml, boundary] of cases) {
    it(`for ${name}`, () => {
      const base = deriveStructure(configOf(yaml), { boundary })
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
        expect(deriveStructure(mixed, { boundary })).toEqual(base)
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

  it('keeps every line and its way when the order does change', () => {
    const at = { boundary: ['c1'] }
    const base = deriveStructure(configOf(sitesYaml(at)), at)
    const after = deriveStructure(renameNode(configOf(sitesYaml(at)), 'c2-a3-s1', 'zz'), at)
    const ways = (s: Structure, id: string) =>
      s.planes
        .flatMap((p) => [
          ...p.flows.map(([a, b]) => `${key(a)}>${key(b)}`),
          ...p.even.map(([a, b]) => setKey([key(a), key(b)])),
        ])
        .map((w) => w.split(`unit:${id}`).join('unit:@'))
        .sort()
    expect(ways(after, 'zz')).toEqual(ways(base, 'c2-a3-s1'))
  })
})

// ---- locality -------------------------------------------------------------------------------

function sets(s: Structure): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>()
  for (const p of s.planes) {
    for (const [a, b] of p.flows) out.set(`flows|${key(a)}|${key(b)}`, [key(a), key(b)])
    for (const [a, b] of p.even) out.set(`even|${key(a)}|${key(b)}`, [key(a), key(b)])
  }
  return out
}

/** The vertices within some hops of the start, going along the lines. */
function near(stages: readonly Stages[], start: readonly string[], hops: number): Set<string> {
  const adj = new Map<string, Set<string>>()
  for (const s of stages) {
    for (const p of s.planes) {
      for (const e of p.edges) {
        adj.set(e.a, (adj.get(e.a) ?? new Set()).add(e.b))
        adj.set(e.b, (adj.get(e.b) ?? new Set()).add(e.a))
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
  const out = { flows: 0, even: 0 }
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
  const atC1 = { boundary: ['c1'] }
  const base = deriveStructure(configOf(sitesYaml(atC1)), atC1)

  it('adds a server at one site', () => {
    const after = deriveStructure(configOf(sitesYaml({ ...atC1, server: 'newsrv:c3-a1' })), atC1)
    const { changed, total } = changes(base, after)
    const around = near(
      [
        stagesOfYaml(sitesYaml(atC1), atC1),
        stagesOfYaml(sitesYaml({ ...atC1, server: 'newsrv:c3-a1' }), atC1),
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
    expect(kinds.flows + kinds.even).toBeLessThan(12)
    expect(total).toBeGreaterThan(50)
  })

  it('adds a second line from a server to another switch of its site', () => {
    const linked = sitesYaml({ ...atC1, link: ['c3-a1-s1', 'c3-a2'] })
    const after = deriveStructure(configOf(linked), atC1)
    const { changed, total } = changes(base, after)
    const around = near(
      [stagesOfYaml(sitesYaml(atC1), atC1), stagesOfYaml(linked, atC1)],
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
    expect(kinds.flows + kinds.even).toBeLessThan(12)
    expect(total).toBeGreaterThan(50)
  })
})

// ---- same form ------------------------------------------------------------------------------

/** What a structure says without any name. */
function nameless(s: Structure) {
  return {
    folded: Object.keys(s.nodes).length,
    planes: s.planes.map((p) => p.plane),
    lines: s.planes.map((p) => [p.flows.length, p.even.length]),
  }
}

describe('configurations that differ only in names give the same form', () => {
  for (const boundary of [[], ['c1', 'c3-a2']]) {
    it(`for the sites network under another naming (${boundary.length} boundary points)`, () => {
      const yaml = sitesYaml({ boundary })
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
      const other = deriveStructure(JSON.parse(text) as input.Network, {
        boundary: boundary.map((id) => ids.get(id) ?? id),
      })
      expect(nameless(other)).toEqual(nameless(deriveStructure(config, { boundary })))
    })
  }

  it('for the same sites told in a different order and with other names, by YAML', () => {
    const a = structureOfYaml(plainNetwork({ links: 'a-b b-c c-a c-d' }))
    const b = structureOfYaml(plainNetwork({ links: 'z9-y8 y8-x7 x7-z9 w1-x7' }))
    expect(nameless(a)).toEqual(nameless(b))
  })
})

// ---- orientation ----------------------------------------------------------------------------

describe('the way the lines run', () => {
  const plane = (yaml: string, boundary: string[]) =>
    structureOfYaml(yaml, { boundary }).planes.find((p) => p.plane === 'default')

  it('never goes round: following the lines away from the boundary points comes to an end', () => {
    const at = ['c1', 'c3-a2', 'c3-a1-s1']
    const p = plane(sitesYaml({ boundary: at }), at)
    const next = new Map<string, string[]>()
    for (const [a, b] of p?.flows ?? []) next.set(key(a), [...(next.get(key(a)) ?? []), key(b)])
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

  it('lists every line a boundary point reaches once, either flowing or even', () => {
    const yaml = sitesYaml({ boundary: ['c1'] })
    const lines = stagesOfYaml(yaml).planes.flatMap((q) => q.edges)
    const listed = structureOfYaml(yaml, { boundary: ['c1'] })
      .planes.flatMap((q) => [...q.flows, ...q.even])
      .map(([a, b]) => setKey([key(a), key(b)]))
    expect(new Set(listed).size).toBe(listed.length)
    expect(new Set(listed)).toEqual(new Set(lines.map((e) => setKey([e.a, e.b]))))
  })

  it('does not change at one site when a boundary point is added at another', () => {
    const at = (boundary: string[]) =>
      (plane(sitesYaml({ boundary }), boundary)?.flows ?? [])
        .map(([a, b]) => `${key(a)}>${key(b)}`)
        .filter((l) => l.startsWith('unit:c1-'))
        .sort()
    const before = at(['c1'])
    expect(before.length).toBeGreaterThan(10)
    expect(at(['c1', 'c3-a1-s1'])).toEqual(before)
  })
})
