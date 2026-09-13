import { routeBoundaryConnections } from './tmp-test6-v7-boundary-routing.mjs'
import { boundaryTerminals } from './tmp-test6-v7-boundary-search.mjs'
import { haloSeparationMoves, measureHaloSpacing } from './tmp-test6-v8-area-halo.mjs'
import {
  connectionHalos,
  haloProfiles,
  measureConnectionHaloSpacing,
} from './tmp-test6-v8-connection-halo.mjs'
import { measureWires, separationMoves } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { haloOverlapPairs, projectHardHalos } from './tmp-test6-v8-hard-halo.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'
import { nodeSideMidpoint } from './tmp-test6-v8-node-attachments.mjs'

const seq = (n) => Array.from({ length: n }, (_, i) => i)
export function contentBounds(nodes, members) {
  return {
    left: Math.min(...members.map((i) => nodes[i].x - nodes[i].w / 2)),
    right: Math.max(...members.map((i) => nodes[i].x + nodes[i].w / 2)),
    top: Math.min(...members.map((i) => nodes[i].y - nodes[i].h / 2)),
    bottom: Math.max(...members.map((i) => nodes[i].y + nodes[i].h / 2)),
  }
}

// Inherit display chrome from the pre-avoidance layout, not its later unused space.
export function measuredInsets(source) {
  return source.groups.map((g) => {
    const b = contentBounds(source.nodes, g.members)
    return {
      left: b.left - (g.x - g.w / 2),
      right: g.x + g.w / 2 - b.right,
      top: b.top - (g.y - g.h / 2),
      bottom: g.y + g.h / 2 - b.bottom,
    }
  })
}

export function fitFrames(groups, nodes, insets) {
  return groups.map((g, gi) => {
    const b = contentBounds(nodes, g.members),
      p = insets[gi]
    const left = b.left - p.left,
      right = b.right + p.right
    const top = b.top - p.top,
      bottom = b.bottom + p.bottom
    const x = (left + right) / 2,
      y = (top + bottom) / 2
    return {
      ...g,
      x,
      y,
      w: right - left,
      h: bottom - top,
      radius: Math.hypot(x, y),
      angleRadians: Math.atan2(y, x),
    }
  })
}

// Project frame overlaps out by the shortest axis translation. Both movable
// groups share the correction; the Internet group is never translated.
// These are collision corrections, not prescribed directions or placement rings.
export function settleFrames(input, groups, insets, root, gap, maxPasses = 128) {
  let nodes = input.map((n) => ({ ...n }))
  let boxes = fitFrames(groups, nodes, insets)
  const rootGroup = groups.findIndex((g) => g.members.includes(root))
  let corrections = 0
  for (const _ of seq(maxPasses)) {
    let changed = false
    for (const [i] of boxes.entries())
      for (const j of seq(i)) {
        const a = boxes[i],
          b = boxes[j]
        const ox = (a.w + b.w) / 2 + gap - Math.abs(a.x - b.x)
        const oy = (a.h + b.h) / 2 + gap - Math.abs(a.y - b.y)
        if (ox <= 1e-6 || oy <= 1e-6) continue
        const dx = ox < oy ? Math.sign(a.x - b.x || 1) * ox : 0
        const dy = ox < oy ? 0 : Math.sign(a.y - b.y || 1) * oy
        const fa = i === rootGroup ? 0 : j === rootGroup ? 1 : 0.5
        const fb = j === rootGroup ? 0 : i === rootGroup ? 1 : 0.5
        for (const [gi, x, y] of [
          [i, dx * fa, dy * fa],
          [j, -dx * fb, -dy * fb],
        ]) {
          const members = new Set(groups[gi].members)
          nodes = nodes.map((n, ni) => (members.has(ni) ? { ...n, x: n.x + x, y: n.y + y } : n))
        }
        boxes = fitFrames(groups, nodes, insets)
        changed = true
        corrections++
      }
    if (!changed) return { nodes, groups: boxes, corrections }
  }
  return null // Numerical projection did not converge; never output overlapping frames.
}

export function rebuildRoutes(groups, nodes, links) {
  const terminals = boundaryTerminals(groups, links, nodes)
  const routes = routeBoundaryConnections({
    groups,
    nodes,
    links,
    positions: nodes,
    terminals,
    nodeAttachment: nodeSideMidpoint,
  })
  return { terminals, links: routes.map((r, i) => ({ ...links[i], ...r })) }
}

export function optimizeElasticFrames(
  baseline,
  displaySource,
  svg,
  { maxSweeps = 8, areaRatio = 0, connectionAware = false, hardHalos = false } = {},
) {
  if (!Number.isFinite(areaRatio) || areaRatio < 0) throw new Error('Invalid halo area ratio')
  if (hardHalos && (!connectionAware || areaRatio <= 0))
    throw new Error('Hard halos require connection-aware positive area ratio')
  const wireWidth = Math.max(
    ...[...svg.matchAll(/<path data-link="[^>]*stroke-width="([\d.]+)"/g)].map((m) => Number(m[1])),
  )
  const nodeStroke = Math.max(
    ...[...svg.matchAll(/<g data-node="[^>]*><rect\b([^>]*)>/g)].map((m) =>
      Number(m[1].match(/stroke-width="([\d.]+)"/)?.[1] ?? 1),
    ),
  )
  const frameStroke = Math.max(
    ...[...svg.matchAll(/<rect[^>]*fill-opacity="0.04"[^>]*stroke-width="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    ),
  )
  if (![wireWidth, nodeStroke, frameStroke].every((x) => Number.isFinite(x) && x > 0))
    throw new Error('Missing display stroke geometry')
  const clearance = (wireWidth + nodeStroke) / 2
  const insets = measuredInsets(displaySource)
  const original = baseline.nodes
  const root = original.findIndex((n) => n.id === 'test:internet')
  if (root < 0) throw new Error('Missing explicit Internet anchor')
  const measure = (nodes, links, groups, terminals) => ({
    ...measureLineAvoidance(nodes, links, clearance),
    ...measureWires(links),
    ...(areaRatio > 0
      ? connectionAware
        ? measureConnectionHaloSpacing(
            nodes,
            groups,
            links,
            terminals,
            nodeStroke,
            frameStroke,
            areaRatio,
          )
        : measureHaloSpacing(nodes, groups, nodeStroke, frameStroke, areaRatio)
      : {}),
  })
  const before = measure(original, baseline.links, baseline.groups, baseline.terminals)
  const getHalos = (state) =>
    connectionHalos(
      state.nodes,
      state.groups,
      state.links,
      state.terminals,
      nodeStroke,
      frameStroke,
      areaRatio,
    )
  const spacingMoves = (state, kind, i) => {
    if (areaRatio <= 0) return []
    return haloSeparationMoves(
      state[kind],
      i,
      kind === 'nodes' ? nodeStroke : frameStroke,
      areaRatio,
      connectionAware ? getHalos(state)[kind] : undefined,
    )
  }
  const metricKeys = [
    'penalty',
    'crossings',
    'overlapLength',
    'length',
    ...(areaRatio > 0 && !hardHalos ? ['nodeHaloPenalty', 'groupHaloPenalty'] : []),
  ]
  const ratios = (m) => metricKeys.reduce((s, k) => s + m[k] / Math.max(1, before[k]), 0)
  const feasible = (nodes) => {
    if (nodes[root].x !== original[root].x || nodes[root].y !== original[root].y) return false
    for (const g of baseline.groups)
      for (const i of g.members)
        for (const j of g.members) {
          if (i === j) continue
          const a = nodes[i],
            b = nodes[j]
          if (
            Math.abs(a.x - b.x) < (a.w + b.w) / 2 + nodeStroke - 1e-6 &&
            Math.abs(a.y - b.y) < (a.h + b.h) / 2 + nodeStroke - 1e-6
          )
            return false
          if (a.depth < b.depth && a.y + a.h / 2 + nodeStroke > b.y - b.h / 2 + 1e-6) return false
        }
    return true
  }
  let evaluations = 0
  let haloRejected = 0
  const evaluate = (ps) => {
    if (!feasible(ps)) return null
    const geometry = hardHalos
      ? projectHardHalos(ps, {
          groups: baseline.groups,
          links: baseline.links,
          insets,
          root,
          nodeStroke,
          frameStroke,
          areaRatio,
          fitFrames,
        })
      : settleFrames(ps, baseline.groups, insets, root, frameStroke)
    if (hardHalos && !geometry) haloRejected++
    if (!geometry || !feasible(geometry.nodes)) return null
    const routing = rebuildRoutes(geometry.groups, geometry.nodes, baseline.links)
    if (hardHalos) {
      const halos = getHalos({ ...geometry, ...routing })
      if (haloOverlapPairs(halos.nodes).length || haloOverlapPairs(halos.groups).length) {
        haloRejected++
        return null
      }
    }
    evaluations++
    const metrics = measure(geometry.nodes, routing.links, geometry.groups, routing.terminals)
    return {
      ...geometry,
      ...routing,
      metrics,
      score: ratios(metrics),
      displacement: geometry.nodes.reduce(
        (s, n, i) => s + (n.x - original[i].x) ** 2 + (n.y - original[i].y) ** 2,
        0,
      ),
    }
  }
  const better = (a, b) =>
    a &&
    (a.metrics.hits < b.metrics.hits ||
      (a.metrics.hits === b.metrics.hits &&
        (a.score < b.score - 1e-8 ||
          (Math.abs(a.score - b.score) < 1e-8 && a.displacement < b.displacement))))
  let state = evaluate(original)
  if (!state) throw new Error('Invalid initial geometry')
  const rebuiltInitial = state.metrics
  const trace = []
  for (const sweep of seq(maxSweeps)) {
    let accepted = 0
    for (const [i] of original.entries()) {
      if (i === root) continue
      const n = state.nodes[i],
        moves = spacingMoves(state, 'nodes', i)
      for (const c of state.metrics.conflicts.filter((c) => c.node === i)) {
        const l = state.links.find((l) => l.id === c.link)
        if (!l) continue
        for (const [j, b] of l.points.entries())
          if (j) moves.push(...separationMoves(l.points[j - 1], b, n, clearance))
      }
      const targets = state.links.flatMap((l) =>
        l.a === i ? [state.nodes[l.b]] : l.b === i ? [state.nodes[l.a]] : [],
      )
      if (targets.length)
        moves.push({
          dx: targets.reduce((s, p) => s + p.x, 0) / targets.length - n.x,
          dy: targets.reduce((s, p) => s + p.y, 0) / targets.length - n.y,
        })
      moves.push({ dx: original[i].x - n.x, dy: original[i].y - n.y })
      let best = state
      const seen = new Set()
      for (const move of moves) {
        let lo = 0,
          hi = 1
        const positions = (f) =>
          state.nodes.map((v, j) =>
            j === i ? { ...v, x: v.x + move.dx * f, y: v.y + move.dy * f } : v,
          )
        if (!feasible(positions(hi))) {
          for (const _ of seq(20)) {
            const mid = (lo + hi) / 2
            if (feasible(positions(mid))) lo = mid
            else hi = mid
          }
          hi = lo
        }
        for (const f of [hi, hi / 2]) {
          const dx = move.dx * f,
            dy = move.dy * f
          if (Math.hypot(dx, dy) < 1e-6) continue
          const key = `${dx.toFixed(6)}:${dy.toFixed(6)}`
          if (seen.has(key)) continue
          seen.add(key)
          const trial = evaluate(positions(f))
          if (better(trial, best)) best = trial
        }
      }
      if (best !== state) {
        state = best
        accepted++
      }
    }
    // Whole-group moves are also candidates: preserve the interior and seek the
    // mean external endpoint translation, measuring fully rerouted geometry.
    for (const [gi, g] of state.groups.entries()) {
      if (g.members.includes(root)) continue
      const members = new Set(g.members)
      const pulls = state.links.flatMap((l) =>
        l.ga === l.gb
          ? []
          : l.ga === gi
            ? [{ a: state.nodes[l.a], b: state.nodes[l.b] }]
            : l.gb === gi
              ? [{ a: state.nodes[l.b], b: state.nodes[l.a] }]
              : [],
      )
      const moves = spacingMoves(state, 'groups', gi)
      if (pulls.length)
        moves.push({
          dx: pulls.reduce((s, p) => s + p.b.x - p.a.x, 0) / pulls.length,
          dy: pulls.reduce((s, p) => s + p.b.y - p.a.y, 0) / pulls.length,
        })
      let best = state
      for (const { dx, dy } of moves)
        for (const f of [1, 0.5]) {
          const trial = evaluate(
            state.nodes.map((n, i) =>
              members.has(i) ? { ...n, x: n.x + dx * f, y: n.y + dy * f } : n,
            ),
          )
          if (better(trial, best)) best = trial
        }
      if (best !== state) {
        state = best
        accepted++
      }
    }
    trace.push({
      sweep,
      accepted,
      evaluations,
      hits: state.metrics.hits,
      crossings: state.metrics.crossings,
      overlapLength: state.metrics.overlapLength,
      length: state.metrics.length,
      ...(areaRatio > 0
        ? {
            nodeContacts: state.metrics.nodeContactPairs,
            groupContacts: state.metrics.groupContactPairs,
            nodeHaloPenalty: state.metrics.nodeHaloPenalty,
            groupHaloPenalty: state.metrics.groupHaloPenalty,
            ...(hardHalos
              ? {
                  nodeHaloPairs: state.metrics.nodeHaloPairs,
                  groupHaloPairs: state.metrics.groupHaloPairs,
                  haloRejected,
                }
              : {}),
          }
        : {}),
      score: state.score,
    })
    console.log('elastic', JSON.stringify(trace.at(-1)))
    if (!accepted) break
  }
  const groupOf = new Map(state.groups.flatMap((g, gi) => g.members.map((i) => [i, gi])))
  const nodes = state.nodes.map((n, i) => {
    const g = state.groups[groupOf.get(i)]
    return { ...n, localX: n.x - g.x, localY: n.y - g.y }
  })
  return {
    ...state,
    nodes,
    before,
    rebuiltInitial,
    trace,
    evaluations,
    ...(hardHalos ? { haloRejected } : {}),
    model:
      'Content-derived resizable frames; overlap projection translates groups; regenerate boundary terminals and all exterior routes for every evaluated candidate. No frame size or node movement cap. Node/link hits first, then equal baseline-relative penetration, crossings, overlap and length; displacement breaks ties. Existing display insets, boundary-terminal spacing, node dimensions and internal depth order remain. Internet node anchored; no fixed frame order or ring.' +
      (hardHalos
        ? ' Node/node and group/group connection-derived bands must not overlap. Project and recompute counts, frames and bands to feasibility before evaluation; reject nonconverged candidates. Halo overlap penalties are diagnostics only and removed from the objective. No rewards for extra space. Feasible candidates minimize node/link hits first, then wire metrics.'
        : areaRatio > 0
          ? ' Add soft node/node and group/group expanded-footprint overlap penalties. Band area is areaRatio times each painted rectangle area, outside the stroke; thickness is recomputed with frame size. Halo separation proposals are scored, not hard-projected. Each halo penalty is a separate initial-relative objective with equal weight.'
          : '') +
      (connectionAware
        ? " Multiply band area by sqrt(1 + incident link count) for nodes or boundary terminal count for groups. Preserve the base isotropic band and allocate the extra area by per-side count/edge length, solving corner area exactly. Counts and sides come from each candidate's actual rerouted endpoints and terminals."
        : ''),
    options: {
      maxSweeps,
      wireWidth,
      nodeStroke,
      frameStroke,
      clearance,
      insets,
      normalization: before,
      ...(areaRatio > 0 ? { areaRatio } : {}),
      ...(connectionAware ? { connectionAware: true } : {}),
      ...(hardHalos ? { hardHalos: true, haloTolerance: 1e-6, haloProjectionMaxPasses: 128 } : {}),
    },
    ...(connectionAware
      ? {
          haloProfiles: {
            before: haloProfiles(getHalos(baseline)),
            after: haloProfiles(getHalos(state)),
          },
        }
      : {}),
    moved: nodes.flatMap((n, i) => {
      const dx = n.x - original[i].x,
        dy = n.y - original[i].y
      return Math.hypot(dx, dy) > 1e-6 ? [{ id: n.id, dx, dy, distance: Math.hypot(dx, dy) }] : []
    }),
  }
}
