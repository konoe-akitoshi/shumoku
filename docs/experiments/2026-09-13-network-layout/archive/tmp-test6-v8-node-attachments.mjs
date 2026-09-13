// V8: choose the ray-facing side, then use that side's exact midpoint.
// No perpendicular stub, offset port, or extra bend is introduced.
export function nodeSideMidpoint(nodes, positions, i, toward) {
  const n = nodes[i],
    p = positions[i],
    dx = toward.x - p.x,
    dy = toward.y - p.y
  if (n.w <= 0 || n.h <= 0) throw new Error('Node dimensions must be positive')
  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12)
    throw new Error('Attachment direction is undefined')
  const tx = Math.abs(dx) > 1e-12 ? n.w / 2 / Math.abs(dx) : Infinity
  const ty = Math.abs(dy) > 1e-12 ? n.h / 2 / Math.abs(dy) : Infinity
  // Exact corner ties choose the horizontal side deterministically.
  return tx <= ty
    ? { x: p.x + ((dx > 0 ? 1 : -1) * n.w) / 2, y: p.y }
    : { x: p.x, y: p.y + ((dy > 0 ? 1 : -1) * n.h) / 2 }
}
