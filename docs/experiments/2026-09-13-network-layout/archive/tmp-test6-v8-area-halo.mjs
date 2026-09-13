// The band is outside the painted rectangle, including half a stroke on each side.
// (W + 2d)(H + 2d) - WH = ratio * WH; rationalized to avoid cancellation.
export function areaHalo(rect, stroke, ratio) {
  if (
    ![rect.w, rect.h].every((v) => Number.isFinite(v) && v > 0) ||
    !Number.isFinite(stroke) ||
    stroke < 0 ||
    !Number.isFinite(ratio) ||
    ratio < 0
  )
    throw new Error('Invalid area halo geometry')
  const w = rect.w + stroke,
    h = rect.h + stroke
  const sum = w + h
  const d = (ratio * w * h) / (Math.sqrt(sum * sum + 4 * ratio * w * h) + sum)
  return { ...rect, w: w + 2 * d, h: h + 2 * d, thickness: d, bandArea: ratio * w * h }
}

export function haloPairs(
  items,
  stroke,
  ratio,
  halos = items.map((r) => areaHalo(r, stroke, ratio)),
) {
  const pairs = []
  let penalty = 0,
    contactPairs = 0,
    minVisibleGap = Infinity
  for (const [i, a] of items.entries())
    for (const [offset, b] of items.slice(i + 1).entries()) {
      const j = i + offset + 1,
        ha = halos[i],
        hb = halos[j]
      const gx = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2 - stroke)
      const gy = Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2 - stroke)
      const gap = Math.hypot(gx, gy)
      minVisibleGap = Math.min(minVisibleGap, gap)
      if (gap <= 1e-5) contactPairs++
      const ox =
        Math.min(ha.x + ha.w / 2, hb.x + hb.w / 2) - Math.max(ha.x - ha.w / 2, hb.x - hb.w / 2)
      const oy =
        Math.min(ha.y + ha.h / 2, hb.y + hb.h / 2) - Math.max(ha.y - ha.h / 2, hb.y - hb.h / 2)
      if (ratio === 0 || ox <= 1e-6 || oy <= 1e-6) continue
      const overlapArea = ox * oy
      // Penalize overlap of the expanded footprints, including a neighbor invading
      // the band. Literal ring/ring intersection alone misses side-to-side contact.
      const relativeOverlap = overlapArea / Math.min(ha.bandArea, hb.bandArea)
      penalty += relativeOverlap ** 2
      pairs.push({ i, j, overlapArea, relativeOverlap })
    }
  return {
    pairs,
    penalty,
    contactPairs,
    minVisibleGap: Number.isFinite(minVisibleGap) ? minVisibleGap : null,
    thickness: {
      min: Math.min(...halos.flatMap((h) => (h.sides ? Object.values(h.sides) : [h.thickness]))),
      max: Math.max(...halos.flatMap((h) => (h.sides ? Object.values(h.sides) : [h.thickness]))),
    },
  }
}

export function measureHaloSpacing(nodes, groups, nodeStroke, frameStroke, ratio) {
  const n = haloPairs(nodes, nodeStroke, ratio),
    g = haloPairs(groups, frameStroke, ratio)
  return {
    nodeHaloPenalty: n.penalty,
    groupHaloPenalty: g.penalty,
    nodeHaloPairs: n.pairs.length,
    groupHaloPairs: g.pairs.length,
    nodeContactPairs: n.contactPairs,
    groupContactPairs: g.contactPairs,
    nodeMinVisibleGap: n.minVisibleGap,
    groupMinVisibleGap: g.minVisibleGap,
    nodeHaloThickness: n.thickness,
    groupHaloThickness: g.thickness,
  }
}

export function haloSeparationMoves(
  items,
  index,
  stroke,
  ratio,
  halos = items.map((r) => areaHalo(r, stroke, ratio)),
) {
  const a = halos[index],
    moves = []
  if (ratio === 0) return moves
  for (const [j, b] of halos.entries()) {
    if (j === index) continue
    const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x)
    const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y)
    if (ox <= 1e-6 || oy <= 1e-6) continue
    moves.push(
      { dx: Math.sign(a.x - b.x || index - j) * ox, dy: 0 },
      { dx: 0, dy: Math.sign(a.y - b.y || index - j) * oy },
    )
  }
  return moves
}
