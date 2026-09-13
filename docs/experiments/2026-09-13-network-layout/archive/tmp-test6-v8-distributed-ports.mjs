import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { endpointSide } from './tmp-test6-v8-connection-halo.mjs'
import { interiorPath } from './tmp-test6-v8-virtual-rows.mjs'
import { layoutWireChannels } from './tmp-test6-v8-wire-channels.mjs'

const epsilon = 1e-6
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < epsilon

// Keep the center-derived side choices. Use the direction toward the other
// node's center to order attachments along that side, then space around its center.
export function distributeNodePorts(nodes, links, pitch) {
  if (!Number.isFinite(pitch) || pitch <= 0) throw new Error('Expected positive port pitch')
  const buckets = new Map()
  for (const [li, l] of links.entries())
    for (const end of ['a', 'b']) {
      const node = l[end],
        n = nodes[node],
        other = nodes[end === 'a' ? l.b : l.a]
      const side = endpointSide(n, end === 'a' ? l.points[0] : l.points.at(-1))
      const horizontal = side === 'top' || side === 'bottom'
      const tangent = horizontal ? other.x - n.x : other.y - n.y
      const normal = horizontal ? other.y - n.y : other.x - n.x
      const item = {
        li,
        linkId: l.id,
        end,
        node,
        nodeId: n.id,
        side,
        direction: Math.atan2(tangent, Math.abs(normal)),
        toward: { x: other.x, y: other.y },
      }
      const key = `${node}:${side}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(item)
    }
  return [...buckets.values()].flatMap((items) => {
    const n = nodes[items[0].node],
      side = items[0].side
    const horizontal = side === 'top' || side === 'bottom',
      length = horizontal ? n.w : n.h
    if (items.length * pitch > length + epsilon)
      throw new Error(`Insufficient edge capacity: ${n.id}:${side}`)
    return [...items]
      .sort(
        (a, b) =>
          a.direction - b.direction ||
          a.linkId.localeCompare(b.linkId) ||
          a.end.localeCompare(b.end),
      )
      .map((p, rank) => {
        const offset = (rank - (items.length - 1) / 2) * pitch
        return {
          ...p,
          rank,
          count: items.length,
          pitch,
          offset,
          x: n.x + (horizontal ? offset : side === 'left' ? -n.w / 2 : n.w / 2),
          y: n.y + (horizontal ? (side === 'top' ? -n.h / 2 : n.h / 2) : offset),
        }
      })
  })
}

export function spreadNodeAttachments(baseline, pitch) {
  const ports = distributeNodePorts(baseline.nodes, baseline.links, pitch)
  const lookup = new Map(ports.map((p) => [`${p.li}:${p.end}`, p]))
  const point = (p) => ({ x: p.x, y: p.y })
  const padded = (n, pad) => ({
    left: n.x - n.w / 2 - pad,
    right: n.x + n.w / 2 + pad,
    top: n.y - n.h / 2 - pad,
    bottom: n.y + n.h / 2 + pad,
  })
  const clearance = baseline.avoidance.options.clearance
  let repairs = 0
  const links = baseline.links.map((l, li) => {
    const a = lookup.get(`${li}:a`),
      b = lookup.get(`${li}:b`)
    const owners = new Set([baseline.nodes[l.a].id, baseline.nodes[l.b].id])
    const isVisible = (p, q, gi) =>
      !baseline.groups[gi].members.some((i) => {
        const n = baseline.nodes[i]
        return segmentHits(p, q, padded(n, owners.has(n.id) ? 0 : clearance))
      })
    const first = l.points[0],
      last = l.points.at(-1)
    const straight = l.points.every(
      (p) =>
        Math.abs((last.x - first.x) * (p.y - first.y) - (last.y - first.y) * (p.x - first.x)) <
        epsilon,
    )
    if (!l.crossGroup && !l.virtualIds?.length && straight && isVisible(a, b, l.ga))
      return { ...l, points: [point(a), point(b)] }
    const protectedPoints = [l.exit, l.entry].filter(Boolean)
    for (const v of baseline.virtualNodes.filter((v) => l.virtualIds?.includes(v.id))) {
      if (v.kind === 'row-transit')
        protectedPoints.push({ x: v.x, y: v.y - v.h / 2 }, { x: v.x, y: v.y + v.h / 2 })
      else protectedPoints.push(v)
    }
    const proposals = new Map()
    for (const [end, port] of [
      ['a', a],
      ['b', b],
    ]) {
      const original = end === 'a' ? first : last,
        horizontal = port.side === 'top' || port.side === 'bottom'
      const axis = horizontal ? 'x' : 'y',
        shift = port[axis] - original[axis]
      const indices = l.points.map((_, i) => i)
      if (end === 'b') indices.reverse()
      for (const [j, i] of indices.entries()) {
        if (j === indices.length - 1) break
        const p = l.points[i]
        if (
          j &&
          (Math.abs(p[axis] - original[axis]) > epsilon || protectedPoints.some((q) => same(p, q)))
        )
          break
        const moved = { ...p, [axis]: p[axis] + shift }
        const old = proposals.get(i)
        proposals.set(i, old && !same(old, moved) ? p : moved)
      }
    }
    const moved = l.points.map((p, i) => proposals.get(i) ?? { ...p })
    moved[0] = point(a)
    moved[moved.length - 1] = point(b)
    const repair = (points, gi) => {
      const result = [points[0]]
      for (const [i, p] of points.entries())
        if (i) {
          if (isVisible(points[i - 1], p, gi)) result.push(p)
          else {
            repairs++
            result.push(
              ...interiorPath(
                points[i - 1],
                p,
                baseline.groups[gi].members.map((j) => baseline.nodes[j]),
                baseline.groups[gi],
                owners,
                clearance,
              ).slice(1),
            )
          }
        }
      return result
    }
    if (!l.crossGroup) return { ...l, points: repair(moved, l.ga) }
    const start = moved.findIndex((p) => same(p, l.exit)),
      end = moved.findIndex((p) => same(p, l.entry))
    if (start < 0 || end <= start) throw new Error('Lost boundary points while distributing ports')
    return {
      ...l,
      points: [
        ...repair(moved.slice(0, start + 1), l.ga),
        ...moved.slice(start + 1, end),
        ...repair(moved.slice(end), l.gb),
      ],
    }
  })
  return { ...baseline, links, nodePorts: ports, portRepairs: repairs }
}

export function layoutDistributedPorts(baseline, { wireClearanceScale = 1.5 } = {}) {
  const { wireWidth, clearance } = baseline.avoidance.options
  const pitch = wireWidth + 2 * clearance * wireClearanceScale
  const seeded = spreadNodeAttachments(baseline, pitch)
  const result = layoutWireChannels(seeded, { wireClearanceScale })
  const nodePorts = seeded.nodePorts.map((p) => {
    const n = result.nodes[p.node],
      old = baseline.nodes[p.node]
    const actual = p.end === 'a' ? result.links[p.li].points[0] : result.links[p.li].points.at(-1)
    return {
      ...p,
      ...pointOnly(actual),
      center: { x: n.x, y: n.y },
      toward: { x: p.toward.x, y: p.toward.y },
      seedCenter: { x: old.x, y: old.y },
    }
  })
  return {
    ...result,
    nodePorts,
    portRepairs: seeded.portRepairs,
    options: { ...result.options, distributedPorts: true, portPitch: pitch },
    model: `${result.model} Actual node attachments are distributed along the selected edge around its center, ordered by the opposite node center direction. Port pitch equals wire lane pitch; one link stays centered. Shift initial stems as well, preserve mandatory virtual/frame points, repair obstructed interior segments, then recompute wire channel capacity. Insufficient node-edge capacity throws instead of compressing spacing or silently resizing nodes.`,
  }
}

const pointOnly = (p) => ({ x: p.x, y: p.y })
