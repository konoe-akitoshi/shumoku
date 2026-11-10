// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Scene, WireBend, WirePlacement } from '../types'

// Scenes store — pure list + currentSceneId. Mutations are leaf-
// level (no commit, no cross-store side effects). Composite ops
// like placeProductInScene live in the composer.

const scenesState = $state({
  list: [] as Scene[],
  currentId: null as string | null,
})

export const scenesStore = {
  get list(): Scene[] {
    return scenesState.list
  },
  get currentId(): string | null {
    return scenesState.currentId
  },
  get current(): Scene | undefined {
    return scenesState.currentId
      ? scenesState.list.find((s) => s.id === scenesState.currentId)
      : undefined
  },
  set(list: Scene[]) {
    scenesState.list = list
  },
  setCurrentId(id: string | null) {
    scenesState.currentId = id
  },
  find(id: string): Scene | undefined {
    return scenesState.list.find((s) => s.id === id)
  },
  add(scene: Scene) {
    scenesState.list = [...scenesState.list, scene]
  },
  remove(id: string) {
    scenesState.list = scenesState.list.filter((s) => s.id !== id)
    if (scenesState.currentId === id) scenesState.currentId = null
  },
  update(id: string, updates: Partial<Omit<Scene, 'id'>>) {
    scenesState.list = scenesState.list.map((s) => (s.id === id ? { ...s, ...updates } : s))
  },
  /** Place / move a node in a scene. */
  placeNode(sceneId: string, nodeId: string, position: { x: number; y: number }) {
    this.placeNodes(sceneId, [{ nodeId, position }])
  },
  /**
   * Bulk-place / move a batch of nodes in a single scene. Rebuilds
   * the scenes list and target scene's placements once for the whole
   * batch — drastically cheaper than calling `placeNode` per node
   * during multi-drag (O(scenes) array rebuilds drop from N to 1).
   */
  placeNodes(
    sceneId: string,
    updates: Array<{ nodeId: string; position: { x: number; y: number } }>,
  ) {
    if (updates.length === 0) return
    const byId = new Map(updates.map((u) => [u.nodeId, u.position] as const))
    scenesState.list = scenesState.list.map((s) => {
      if (s.id !== sceneId) return s
      const seen = new Set<string>()
      const next = s.nodePlacements.map((p) => {
        const pos = byId.get(p.nodeId)
        if (pos === undefined) return p
        seen.add(p.nodeId)
        return { ...p, position: pos }
      })
      // Append placements for nodes not previously placed.
      for (const [nodeId, pos] of byId) {
        if (!seen.has(nodeId)) next.push({ nodeId, position: pos })
      }
      return { ...s, nodePlacements: next }
    })
  },
  removePlacement(sceneId: string, nodeId: string) {
    scenesState.list = scenesState.list.map((s) =>
      s.id === sceneId
        ? { ...s, nodePlacements: s.nodePlacements.filter((p) => p.nodeId !== nodeId) }
        : s,
    )
  },
  /** Drop a node's or termination's placement from every scene. */
  removePlacementEverywhere(nodeId: string) {
    scenesState.list = scenesState.list.map((s) =>
      s.nodePlacements.some((p) => p.nodeId === nodeId)
        ? { ...s, nodePlacements: s.nodePlacements.filter((p) => p.nodeId !== nodeId) }
        : s,
    )
  },
  /** Set the drawn size multiplier of a placed node; `undefined` clears it back to the scene's. */
  setPlacementScale(sceneId: string, nodeId: string, scale: number | undefined) {
    scenesState.list = scenesState.list.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            nodePlacements: s.nodePlacements.map((p) => {
              if (p.nodeId !== nodeId) return p
              const { scale: _, ...rest } = p
              return scale === undefined ? rest : { ...rest, scale }
            }),
          }
        : s,
    )
  },
  /** The wire of a link in a scene, when the scene says anything about it. */
  wireOf(scene: Scene, linkId: string): WirePlacement | undefined {
    return scene.wires?.find((w) => w.linkId === linkId)
  },
  /** Replace a link's bends in a scene; an empty list drops them. */
  setWireBends(sceneId: string, linkId: string, bends: readonly WireBend[]) {
    this.updateWire(sceneId, linkId, (wire) => ({
      ...wire,
      bends: bends.length > 0 ? bends.map((b) => ({ ...b })) : undefined,
    }))
  },
  /** Set a link's stroke width multiplier in a scene; `undefined` clears it back to the scene's. */
  setWireScale(sceneId: string, linkId: string, wireScale: number | undefined) {
    this.updateWire(sceneId, linkId, ({ wireScale: _, ...wire }) =>
      wireScale === undefined ? wire : { ...wire, wireScale },
    )
  },
  /** Rewrite one link's wire in a scene; a wire that says nothing any more is dropped. */
  updateWire(sceneId: string, linkId: string, change: (wire: WirePlacement) => WirePlacement) {
    scenesState.list = scenesState.list.map((s) => {
      if (s.id !== sceneId) return s
      const current = s.wires?.find((w) => w.linkId === linkId) ?? { linkId }
      const next = change(current)
      const says = (next.bends?.length ?? 0) > 0 || next.wireScale !== undefined
      const others = (s.wires ?? []).filter((w) => w.linkId !== linkId)
      const wires = says ? [...others, next] : others
      return { ...s, wires: wires.length > 0 ? wires : undefined }
    })
  },
  /** Drop a link's wires from every scene. */
  removeWireEverywhere(linkId: string) {
    scenesState.list = scenesState.list.map((s) => {
      if (!s.wires?.some((w) => w.linkId === linkId)) return s
      const wires = s.wires.filter((w) => w.linkId !== linkId)
      return { ...s, wires: wires.length > 0 ? wires : undefined }
    })
  },
  hideNode(sceneId: string, nodeId: string) {
    scenesState.list = scenesState.list.map((s) => {
      if (s.id !== sceneId) return s
      const hidden = new Set(s.hiddenNodeIds ?? [])
      hidden.add(nodeId)
      return { ...s, hiddenNodeIds: [...hidden] }
    })
  },
  unhideNode(sceneId: string, nodeId: string) {
    scenesState.list = scenesState.list.map((s) =>
      s.id === sceneId
        ? { ...s, hiddenNodeIds: (s.hiddenNodeIds ?? []).filter((id) => id !== nodeId) }
        : s,
    )
  },
  hideLink(sceneId: string, linkId: string) {
    scenesState.list = scenesState.list.map((s) => {
      if (s.id !== sceneId) return s
      const hidden = new Set(s.hiddenLinkIds ?? [])
      hidden.add(linkId)
      return { ...s, hiddenLinkIds: [...hidden] }
    })
  },
  unhideLink(sceneId: string, linkId: string) {
    scenesState.list = scenesState.list.map((s) =>
      s.id === sceneId
        ? { ...s, hiddenLinkIds: (s.hiddenLinkIds ?? []).filter((id) => id !== linkId) }
        : s,
    )
  },
}

/**
 * Drop placements, wires and hidden ids that point at orphan node, termination or link ids.
 * Used on project import.
 */
export function sanitizeScenes(
  rawScenes: Scene[],
  placeable: Set<string>,
  linkIdSet: Set<string>,
): Scene[] {
  return rawScenes.map((scene) => {
    const wires = scene.wires?.filter((w) => linkIdSet.has(w.linkId))
    return {
      ...scene,
      nodePlacements: scene.nodePlacements.filter((p) => placeable.has(p.nodeId)),
      ...(wires && wires.length > 0 ? { wires } : { wires: undefined }),
      hiddenNodeIds: scene.hiddenNodeIds?.filter((id) => placeable.has(id)),
      hiddenLinkIds: scene.hiddenLinkIds?.filter((id) => linkIdSet.has(id)),
    }
  })
}
