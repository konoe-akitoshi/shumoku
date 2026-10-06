import type { autoLayoutFlatTree } from '../../../libs/@shumoku/core/dist/index.js'
import type { Presentation } from './coordinate-prototype'

// Experiment-only equal-level constraint, not a network hierarchy or routing rank.
export function applyRankConstraints(
  layout: ReturnType<typeof autoLayoutFlatTree>,
  presentation: Presentation,
): ReturnType<typeof autoLayoutFlatTree> {
  const nodes = new Map(
    [...layout.nodes].map(([id, node]) => [
      id,
      {
        ...node,
        position: node.position ? { ...node.position } : undefined,
      },
    ]),
  )
  const axis = presentation.direction === 'LR' || presentation.direction === 'RL' ? 'x' : 'y'
  const groups = new Map<string, string[]>()
  for (const entry of presentation.nodeRanks ?? []) {
    const key = JSON.stringify(entry.rank)
    groups.set(key, [...(groups.get(key) ?? []), entry.nodeId])
  }
  const fixed = new Map(presentation.nodePlacements.map((p) => [p.nodeId, p.position]))
  for (const members of groups.values()) {
    const positions = members.map((id) => {
      const position = nodes.get(id)?.position
      if (!position) throw new Error(`Rank node has no position: ${id}`)
      return position[axis]
    })
    const fixedValues = members.flatMap((id) => {
      const position = fixed.get(id)
      return position ? [position[axis]] : []
    })
    const anchor = fixedValues[0]
    if (anchor !== undefined && fixedValues.some((value) => value !== anchor)) {
      throw new Error('Rank conflicts with fixed positions')
    }
    const reverse = presentation.direction === 'BT' || presentation.direction === 'RL'
    const target = anchor ?? (reverse ? Math.min(...positions) : Math.max(...positions))
    for (const id of members) {
      const node = nodes.get(id)
      if (!node?.position) throw new Error(`Rank node has no position: ${id}`)
      nodes.set(id, { ...node, position: { ...node.position, [axis]: target } })
    }
  }
  // Retain the original viewport and expand it to contain any shifted rectangles.
  let minX = layout.bounds.x
  let minY = layout.bounds.y
  let maxX = minX + layout.bounds.width
  let maxY = minY + layout.bounds.height
  for (const node of nodes.values()) {
    if (!node.position || !node.size) throw new Error('Missing rank layout geometry')
    minX = Math.min(minX, node.position.x - node.size.width / 2)
    minY = Math.min(minY, node.position.y - node.size.height / 2)
    maxX = Math.max(maxX, node.position.x + node.size.width / 2)
    maxY = Math.max(maxY, node.position.y + node.size.height / 2)
  }
  return { ...layout, nodes, bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } }
}
