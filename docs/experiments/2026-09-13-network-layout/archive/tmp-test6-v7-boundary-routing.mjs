// Shared renderer geometry used both during final candidate evaluation and final drawing.
const seq = (n) => Array.from({ length: n }, (_, i) => i)
export function nodeBoundaryPoint(nodes, positions, i, toward) {
  const p = positions[i],
    n = nodes[i],
    dx = toward.x - p.x,
    dy = toward.y - p.y
  const t = Math.min(
    Math.abs(dx) > 1e-9 ? n.w / 2 / Math.abs(dx) : Infinity,
    Math.abs(dy) > 1e-9 ? n.h / 2 / Math.abs(dy) : Infinity,
  )
  return Number.isFinite(t) ? { x: p.x + dx * t, y: p.y + dy * t } : { ...p }
}
export function segmentHits(A, B, R) {
  let lo = 0,
    hi = 1
  for (const [p, d, min, max] of [
    [A.x, B.x - A.x, R.left + 1e-6, R.right - 1e-6],
    [A.y, B.y - A.y, R.top + 1e-6, R.bottom - 1e-6],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (p <= min || p >= max) return false
    } else {
      const a = (min - p) / d,
        b = (max - p) / d
      lo = Math.max(lo, Math.min(a, b))
      hi = Math.min(hi, Math.max(a, b))
      if (lo >= hi) return false
    }
  }
  return lo < hi && hi > 0 && lo < 1
}

export function routeBoundaryConnections({
  groups: boxes,
  nodes,
  links,
  positions,
  terminals: inputTerminals,
  nodeAttachment = nodeBoundaryPoint,
}) {
  const terminals = inputTerminals.map((t) => ({ ...t }))
  const terminalLookup = new Map(terminals.map((t) => [`${t.li}:${t.end}`, t]))
  // Only real frame interiors are obstacles. Boundary contact is allowed.
  const obstacles = boxes.map((b) => ({
    left: b.x - b.w / 2,
    right: b.x + b.w / 2,
    top: b.y - b.h / 2,
    bottom: b.y + b.h / 2,
  }))
  const waypoints = []
  for (const R of obstacles)
    for (const [x, y] of [
      [R.left, R.top],
      [R.right, R.top],
      [R.right, R.bottom],
      [R.left, R.bottom],
    ]) {
      const p = { x, y }
      if (
        !obstacles.some(
          (o) => x > o.left + 1e-6 && x < o.right - 1e-6 && y > o.top + 1e-6 && y < o.bottom - 1e-6,
        )
      )
        waypoints.push(p)
    }
  for (const t of terminals) {
    t.waypoint = waypoints.length
    waypoints.push({ x: t.x, y: t.y })
  }
  const adjacency = waypoints.map(() => [])
  for (const [i, A] of waypoints.entries())
    for (const j of seq(i)) {
      const B = waypoints[j]
      if (obstacles.some((R) => segmentHits(A, B, R))) continue
      const distance = Math.hypot(A.x - B.x, A.y - B.y)
      adjacency[i].push({ j, distance })
      adjacency[j].push({ j: i, distance })
    }
  function pathBetween(start, end) {
    // An unobstructed segment is already the Euclidean shortest path.
    if (!obstacles.some((R) => segmentHits(waypoints[start], waypoints[end], R)))
      return [waypoints[start], waypoints[end]]
    const distances = new Float64Array(waypoints.length).fill(Infinity)
    const previous = new Int32Array(waypoints.length).fill(-1),
      seen = new Uint8Array(waypoints.length)
    distances[start] = 0
    for (const _iteration of seq(waypoints.length)) {
      let current = -1
      for (const j of seq(waypoints.length))
        if (!seen[j] && (current < 0 || distances[j] < distances[current])) current = j
      if (current < 0 || !Number.isFinite(distances[current])) break
      if (current === end) {
        const path = []
        let j = end
        while (j !== -1) {
          path.push(waypoints[j])
          j = previous[j]
        }
        return path.reverse()
      }
      seen[current] = 1
      for (const { j, distance } of adjacency[current]) {
        const d = distances[current] + distance
        if (d < distances[j]) {
          distances[j] = d
          previous[j] = current
        }
      }
    }
    throw new Error('No exterior boundary route')
  }
  function nodePoint(i, toward) {
    return nodeAttachment(nodes, positions, i, toward)
  }
  const routes = links.map((l, li) => {
    if (l.ga === l.gb)
      return {
        id: l.id,
        crossGroup: false,
        points: [nodePoint(l.a, positions[l.b]), nodePoint(l.b, positions[l.a])],
      }
    const A = terminalLookup.get(`${li}:a`),
      B = terminalLookup.get(`${li}:b`)
    if (!A || !B) throw new Error('Missing boundary terminal')
    const exterior = pathBetween(A.waypoint, B.waypoint)
    return {
      id: l.id,
      crossGroup: true,
      points: [nodePoint(l.a, A), ...exterior, nodePoint(l.b, B)],
      exit: { x: A.x, y: A.y },
      entry: { x: B.x, y: B.y },
    }
  })

  return routes
}
