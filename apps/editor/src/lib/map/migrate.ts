// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Subgraph, Termination } from '@shumoku/core'
import { nodesInScope } from '../scene/scope'
import type { Scene } from '../types'
import { MAP_UNITS_PER_METER } from './model'

/** One map per project; keep the v1 storage envelope readable during migration. */
export function migrateScenesToMap(
  scenes: Scene[],
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
  links: Link[],
  terms: Termination[],
): { scene: Scene; links: Link[]; terms: Termination[] } {
  const existing = scenes.find((s) => s.map)
  if (existing) return { scene: existing, links, terms }
  const scene: Scene = {
    id: 'map',
    name: 'Map',
    placementOrigin: 'center',
    nodePlacements: [],
    map: {
      drawings: [],
      omissions: [],
      pointDrawingIds: {},
      legacyScenes: scenes.length ? structuredClone(scenes) : undefined,
    },
  }
  const map = scene.map
  if (!map) return { scene, links, terms }
  const transforms = new Map<string, { x: number; scale: number; drawingId?: string }>()
  let x = 0
  for (const old of scenes) {
    const ratio = old.calibration?.pxPerMeter
    const scale = ratio && Number.isFinite(ratio) && ratio > 0 ? MAP_UNITS_PER_METER / ratio : 1
    const drawingId = old.background ? `drawing:${old.id}` : undefined
    transforms.set(old.id, { x, scale, drawingId })
    if (old.background && drawingId)
      map.drawings.push({
        ...old.background,
        id: drawingId,
        name: old.name,
        position: { x, y: 0 },
        scale,
        calibration: old.calibration,
        locked: true,
      })
    x +=
      Math.max(old.background?.width ?? 600, ...old.nodePlacements.map((p) => p.position.x + 100)) *
        scale +
      200
  }
  const preferred = new Map<string, Scene>()
  // Prefer an explicit placement in the node's owning scope, then scoped, then root.
  for (const old of [...scenes].sort(
    (a, b) => Number(!!b.scopeSubgraphId) - Number(!!a.scopeSubgraphId),
  )) {
    const scope = new Set(
      nodesInScope(nodes.values(), subgraphs, old.scopeSubgraphId).map((n) => n.id),
    )
    for (const p of old.nodePlacements) {
      const previous = preferred.get(p.nodeId)
      if (!scope.has(p.nodeId) || old.hiddenNodeIds?.includes(p.nodeId)) continue
      if (!previous || nodes.get(p.nodeId)?.parent === old.scopeSubgraphId)
        preferred.set(p.nodeId, old)
    }
  }
  for (const old of scenes)
    for (const p of old.nodePlacements) if (!preferred.has(p.nodeId)) preferred.set(p.nodeId, old)
  for (const [nodeId, old] of preferred) {
    const p = old.nodePlacements.find((p) => p.nodeId === nodeId)
    const t = transforms.get(old.id)
    if (!p || !t || !nodes.has(nodeId)) continue
    scene.nodePlacements.push({
      ...p,
      position: { x: t.x + p.position.x * t.scale, y: p.position.y * t.scale },
    })
    if (t.drawingId) map.pointDrawingIds[nodeId] = t.drawingId
  }
  // Old bends/terminations were globally positioned. Only transform them when
  // their participating endpoints unambiguously select the same old scene.
  const linkScene = (link: Link) => {
    const a = preferred.get(link.from.node),
      b = preferred.get(link.to.node)
    return a && a.id === b?.id ? transforms.get(a.id) : undefined
  }
  const nextLinks = links.map((link) => {
    const t = linkScene(link)
    if (!t) return link
    return {
      ...link,
      bends: link.bends?.map((b) => {
        if (t.drawingId) map.pointDrawingIds[b.id] = t.drawingId
        return { ...b, x: t.x + b.x * t.scale, y: b.y * t.scale }
      }),
    }
  })
  const nextTerms = terms.map((term) => {
    const uses = links.filter((l) => l.via?.includes(term.id))
    const transformsForUses = uses.map(linkScene)
    const t = transformsForUses[0]
    if (!term.position || !t || transformsForUses.some((v) => v !== t)) return term
    if (t.drawingId) map.pointDrawingIds[term.id] = t.drawingId
    return {
      ...term,
      position: { x: t.x + term.position.x * t.scale, y: term.position.y * t.scale },
    }
  })
  return { scene, links: nextLinks, terms: nextTerms }
}
