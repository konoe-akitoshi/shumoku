import {
  blankState,
  evaluateCoupled,
  overlapCorrection,
  sides,
} from './tmp-test6-v8-coupled-geometry.mjs'

export function randomGenerator(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const mean = (ps) => ({
  x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
  y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
})

// This seed consumes structure, measured dimensions and randomness only. It has
// no access to the previous node positions, rows, paths, terminals or port sides.
export function structuralSeed(model, seed) {
  const random = randomGenerator(seed),
    positions = model.nodes.map(() => ({ x: 0, y: 0 }))
  const groupScale = Math.sqrt(model.nodes.reduce((s, n) => s + n.w * n.h, 0) / model.groups.length)
  for (const g of model.groups) {
    const depth = Math.min(...g.members.map((i) => model.depths[i])),
      angle = (random() - 0.5) * Math.PI
    const radius =
      (Number.isFinite(depth) ? depth : Math.sqrt(model.groups.length)) *
      groupScale *
      Math.sqrt(model.groups.length)
    const gx = radius * Math.sin(angle),
      gy = radius * Math.cos(angle)
    const localScale = Math.sqrt(
      g.members.reduce((s, i) => s + model.nodes[i].w * model.nodes[i].h, 0),
    )
    for (const i of g.members) {
      const theta = random() * Math.PI * 2,
        r = localScale * Math.sqrt(random())
      positions[i] = { x: gx + r * Math.cos(theta), y: gy + r * Math.sin(theta) }
    }
  }
  const dx = model.options.anchor.x - positions[model.root].x,
    dy = model.options.anchor.y - positions[model.root].y
  return blankState(positions.map((p) => ({ x: p.x + dx, y: p.y + dy })))
}

// A cheap, structure-only warm start. These springs are NOT the acceptance
// objective: all subsequent proposals are evaluated against actual routed wires.
// Every pass may choose a different collision axis. No rows or rings are fixed.
export function relaxedStructuralSeed(model, seed, passes = 240) {
  const random = randomGenerator(seed)
  const local = model.nodes.map((n) => ({ x: (random() - 0.5) * n.w, y: (random() - 0.5) * n.h }))
  const relax = (items, edges, count) => {
    const degree = items.map(() => 0)
    for (const e of edges) {
      degree[e.a]++
      degree[e.b]++
    }
    for (const _pass of Array.from({ length: count })) {
      const forces = items.map(() => ({ x: 0, y: 0 }))
      for (const e of edges) {
        const a = items[e.a],
          b = items[e.b]
        const dy = b.y - a.y - Math.sign(e.direction) * ((a.h + b.h) / 2 + model.options.pitch)
        const dx = b.x - a.x
        forces[e.a].x += dx
        forces[e.a].y += dy
        forces[e.b].x -= dx
        forces[e.b].y -= dy
      }
      for (const [i, p] of items.entries()) {
        p.x += (forces[i].x / Math.max(1, degree[i])) * 0.15
        p.y += (forces[i].y / Math.max(1, degree[i])) * 0.15
      }
      for (const [i, a] of items.entries())
        for (const b of items.slice(i + 1)) {
          const correction = overlapCorrection(a, b)
          if (correction) {
            a.x += correction.x / 2
            a.y += correction.y / 2
            b.x -= correction.x / 2
            b.y -= correction.y / 2
          }
        }
    }
  }
  const boxes = model.groups.map((g) => {
    const items = g.members.map((i) => ({
      ...local[i],
      w: model.nodes[i].w + model.options.pitch * 2,
      h: model.nodes[i].h + model.options.pitch * 2,
    }))
    const indices = new Map(g.members.map((i, j) => [i, j]))
    const edges = model.links
      .filter((l) => indices.has(l.a) && indices.has(l.b))
      .map((l) => ({
        a: indices.get(l.a),
        b: indices.get(l.b),
        direction: model.depths[l.b] - model.depths[l.a],
      }))
    relax(items, edges, passes)
    const center = mean(items)
    for (const [j, i] of g.members.entries())
      local[i] = { x: items[j].x - center.x, y: items[j].y - center.y }
    const width =
      Math.max(...items.map((n) => n.x + n.w / 2)) - Math.min(...items.map((n) => n.x - n.w / 2))
    const height =
      Math.max(...items.map((n) => n.y + n.h / 2)) - Math.min(...items.map((n) => n.y - n.h / 2))
    const external = model.links.filter(
      (l) => l.crossGroup && (l.ga === model.groups.indexOf(g) || l.gb === model.groups.indexOf(g)),
    ).length
    const bandScale = 1 + model.options.areaRatio * Math.sqrt(1 + external)
    return {
      x: (random() - 0.5) * model.scale * Math.sqrt(model.groups.length),
      y: (random() - 0.5) * model.scale * Math.sqrt(model.groups.length),
      w: (width + model.options.insets.left + model.options.insets.right) * bandScale,
      h: (height + model.options.insets.top + model.options.insets.bottom) * bandScale,
    }
  })
  const depths = model.groups.map((g) => Math.min(...g.members.map((i) => model.depths[i])))
  relax(
    boxes,
    model.links
      .filter((l) => l.crossGroup)
      .map((l) => ({ a: l.ga, b: l.gb, direction: depths[l.gb] - depths[l.ga] })),
    passes,
  )
  const positions = local.map((p, i) => ({
    x: p.x + boxes[model.groupOf[i]].x,
    y: p.y + boxes[model.groupOf[i]].y,
  }))
  const dx = model.options.anchor.x - positions[model.root].x,
    dy = model.options.anchor.y - positions[model.root].y
  return blankState(positions.map((p) => ({ x: p.x + dx, y: p.y + dy })))
}

export const moveKinds = [
  'node',
  'group',
  'node-swap',
  'group-swap',
  'node-side',
  'boundary-side',
  'node-order',
  'boundary-order',
  'boundary-slide',
  'route',
  'route-order',
  'release',
]

export function proposeCoupled(model, result, random, fraction, kind) {
  const state = structuredClone(result.state),
    pick = (xs) => xs[Math.floor(random() * xs.length)]
  const unit = model.scale * (1 - fraction + model.options.pitch / model.scale)
  const shift = (members, dx, dy) => {
    for (const i of members) {
      state.positions[i].x += dx
      state.positions[i].y += dy
    }
  }
  let target = null
  if (kind === 'node') {
    const i = pick(model.nodes.map((_n, i) => i).filter((i) => i !== model.root)),
      p = state.positions[i]
    target = model.nodes[i].id
    if (random() < 0.5 && model.neighbors[i].size) {
      const q = mean([...model.neighbors[i]].map((j) => state.positions[j]))
      shift([i], (q.x - p.x) * random(), (q.y - p.y) * random())
    } else {
      const angle = random() * Math.PI * 2
      shift([i], unit * Math.cos(angle), unit * Math.sin(angle))
    }
  } else if (kind === 'group') {
    const gi = pick(
        model.groups.map((_g, i) => i).filter((i) => !model.groups[i].members.includes(model.root)),
      ),
      g = result.groups[gi]
    target = g.id
    const connected = model.links.flatMap((l) =>
      !l.crossGroup
        ? []
        : l.ga === gi
          ? [result.groups[l.gb]]
          : l.gb === gi
            ? [result.groups[l.ga]]
            : [],
    )
    if (random() < 0.5 && connected.length) {
      const q = mean(connected),
        factor = random()
      shift(g.members, (q.x - g.x) * factor, (q.y - g.y) * factor)
    } else {
      const angle = random() * Math.PI * 2,
        scale = Math.hypot(g.w, g.h) * (1 - fraction) + unit
      shift(g.members, Math.cos(angle) * scale, Math.sin(angle) * scale)
    }
  } else if (kind === 'node-swap') {
    const g = pick(model.groups.filter((g) => g.members.filter((i) => i !== model.root).length > 1))
    if (!g) return null
    const a = pick(g.members.filter((i) => i !== model.root)),
      b = pick(g.members.filter((i) => i !== a && i !== model.root))
    const first = state.positions[a]
    state.positions[a] = state.positions[b]
    state.positions[b] = first
    target = [model.nodes[a].id, model.nodes[b].id]
  } else if (kind === 'group-swap') {
    const gs = result.groups.filter((g) => !g.members.includes(model.root)),
      a = pick(gs),
      b = pick(gs.filter((g) => g.id !== a.id))
    shift(a.members, b.x - a.x, b.y - a.y)
    shift(b.members, a.x - b.x, a.y - b.y)
    target = [a.id, b.id]
  } else if (kind === 'node-side' || kind === 'boundary-side') {
    const boundary = kind === 'boundary-side',
      p = pick(boundary ? result.terminals : result.nodePorts)
    state[boundary ? 'boundarySides' : 'nodeSides'][p.key] = pick(sides.filter((s) => s !== p.side))
    target = p.key
  } else if (kind === 'node-order' || kind === 'boundary-order') {
    const boundary = kind === 'boundary-order',
      ps = boundary ? result.terminals : result.nodePorts,
      p = pick(ps)
    const peers = ps.filter(
      (q) => q.key !== p.key && q.side === p.side && (boundary ? q.g === p.g : q.node === p.node),
    )
    if (!peers.length) return null
    const q = pick(peers),
      field = boundary ? 'boundaryOrders' : 'nodeOrders'
    const tangent = (p) => (p.side === 'left' || p.side === 'right' ? p.toward.y : p.toward.x)
    const a = state[field][p.key] ?? tangent(p),
      b = state[field][q.key] ?? tangent(q)
    state[field][p.key] = b
    state[field][q.key] = a
    if (a === b) {
      state[field][p.key] = b + model.options.pitch
      state[field][q.key] = a - model.options.pitch
    }
    target = [p.key, q.key]
  } else if (kind === 'boundary-slide') {
    const p = pick(result.terminals)
    state.boundaryOffsets ??= {}
    state.boundaryOffsets[p.key] = (state.boundaryOffsets[p.key] ?? 0) + (random() * 2 - 1) * unit
    target = p.key
  } else if (kind === 'route-order') {
    state.routeOrder ??= model.links.map((_l, i) => i)
    const a = Math.floor(random() * state.routeOrder.length),
      b = Math.floor(random() * state.routeOrder.length)
    const first = state.routeOrder[a]
    state.routeOrder[a] = state.routeOrder[b]
    state.routeOrder[b] = first
    target = [state.routeOrder[a], state.routeOrder[b]]
  } else if (kind === 'route') {
    const li = Math.floor(random() * model.links.length)
    if (state.routeFocus[li]) delete state.routeFocus[li]
    else state.routeFocus[li] = true
    target = model.links[li].id
  } else {
    for (const field of [
      'nodeSides',
      'boundarySides',
      'nodeOrders',
      'boundaryOrders',
      'boundaryOffsets',
      'routeFocus',
    ])
      state[field] = {}
    delete state.routeOrder
    target = 'all-explicit-routing-choices'
  }
  return { state, target }
}

export async function optimizeCoupled(model, initial, { iterations, seed, onProgress = () => {} }) {
  const random = randomGenerator(seed),
    statistics = Object.fromEntries(
      moveKinds.map((k) => [k, { proposed: 0, feasible: 0, accepted: 0, improved: 0 }]),
    )
  let current = evaluateCoupled(model, initial)
  if (!current) throw new Error(`Infeasible initial state for seed ${seed}`)
  const first = current
  let best = current
  const trace = [{ step: 0, score: best.score, terms: best.terms, metrics: best.metrics }],
    accepted = []
  for (const step of Array.from({ length: iterations }, (_, i) => i)) {
    const kind = moveKinds[step % moveKinds.length],
      stats = statistics[kind],
      fraction = step / iterations
    const proposal = proposeCoupled(model, current, random, fraction, kind)
    if (proposal) {
      stats.proposed++
      const next = evaluateCoupled(model, proposal.state)
      if (next) {
        stats.feasible++
        // Finite annealing budget, not a geometric constraint or initial-position penalty.
        const temperature = (first.score / model.nodes.length) * (1 - fraction) ** 2
        const improvement = next.score < current.score - 1e-7
        if (
          improvement ||
          (temperature > 0 && random() < Math.exp((current.score - next.score) / temperature))
        ) {
          stats.accepted++
          if (improvement) stats.improved++
          accepted.push({
            step: step + 1,
            kind,
            target: proposal.target,
            before: current.score,
            after: next.score,
          })
          current = next
          if (current.score < best.score - 1e-7) {
            best = current
            trace.push({
              step: step + 1,
              score: best.score,
              terms: best.terms,
              metrics: best.metrics,
            })
          }
        }
      }
    }
    if ((step + 1) % 20 === 0) {
      onProgress({
        step: step + 1,
        iterations,
        best: best.score,
        current: current.score,
        crossings: best.metrics.crossings,
      })
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  return {
    ...best,
    search: {
      iterations,
      seed,
      firstScore: first.score,
      firstMetrics: first.metrics,
      statistics,
      accepted,
      trace,
    },
  }
}
