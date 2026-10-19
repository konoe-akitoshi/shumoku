// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link, Node } from '../models/types.js'

/**
 * Hosting as layout structure: a node runs on its host, so placement keeps it under the host.
 * These links only shape placement. They draw no line and get no port, so routing and port
 * placement read the graph's own links.
 */
export function hostingLinks(nodes: readonly Node[]): Link[] {
  const ids = new Set(nodes.map((n) => n.id))
  return nodes.flatMap((n) =>
    n.host && n.host !== n.id && ids.has(n.host)
      ? [{ from: { node: n.host, port: '' }, to: { node: n.id, port: '' } }]
      : [],
  )
}

/**
 * Hosting drawn crossed: two hosted nodes whose left-to-right order is the reverse of their
 * hosts'. Placement search scores routed wires, and hosting has none, so this stands in for
 * the crossings its links would make.
 */
export function hostingInversions(
  nodes: readonly Node[],
  placed: ReadonlyMap<string, Pick<Node, 'position'>>,
): number {
  const pairs = hostingLinks(nodes).flatMap((l) => {
    const host = placed.get(l.from.node)?.position?.x
    const hosted = placed.get(l.to.node)?.position?.x
    return host === undefined || hosted === undefined ? [] : [{ id: l.from.node, host, hosted }]
  })
  let inversions = 0
  for (const [i, a] of pairs.entries()) {
    for (const b of pairs.slice(i + 1)) {
      if (a.id !== b.id && (a.host - b.host) * (a.hosted - b.hosted) < 0) inversions++
    }
  }
  return inversions
}
