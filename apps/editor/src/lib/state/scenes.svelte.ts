// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Scene, WireRoute } from '../types'

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
  removePlacement(
    sceneId: string,
    nodeId: string,
    /** Predicate to keep a wire route. Caller passes a check that
     *  references diagram links since this store doesn't know them. */
    keepWire: (linkId: string) => boolean,
  ) {
    scenesState.list = scenesState.list.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            nodePlacements: s.nodePlacements.filter((p) => p.nodeId !== nodeId),
            wireRoutes: s.wireRoutes.filter((w) => keepWire(w.linkId)),
          }
        : s,
    )
  },
  setWireRoute(sceneId: string, route: WireRoute) {
    scenesState.list = scenesState.list.map((s) => {
      if (s.id !== sceneId) return s
      const idx = s.wireRoutes.findIndex((w) => w.linkId === route.linkId)
      if (idx >= 0) {
        const next = [...s.wireRoutes]
        next[idx] = route
        return { ...s, wireRoutes: next }
      }
      return { ...s, wireRoutes: [...s.wireRoutes, route] }
    })
  },
  removeWireRoute(sceneId: string, linkId: string) {
    scenesState.list = scenesState.list.map((s) =>
      s.id === sceneId ? { ...s, wireRoutes: s.wireRoutes.filter((w) => w.linkId !== linkId) } : s,
    )
  },
  hideNode(sceneId: string, nodeId: string, keepWire: (linkId: string) => boolean) {
    scenesState.list = scenesState.list.map((s) => {
      if (s.id !== sceneId) return s
      const hidden = new Set(s.hiddenNodeIds ?? [])
      hidden.add(nodeId)
      return {
        ...s,
        hiddenNodeIds: [...hidden],
        wireRoutes: s.wireRoutes.filter((w) => keepWire(w.linkId)),
      }
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
 * Drop placements / wires / hidden ids that point at orphan node or
 * link ids. Used on project import.
 */
export function sanitizeScenes(
  rawScenes: Scene[],
  nodes: Map<string, unknown>,
  linkIdSet: Set<string>,
): Scene[] {
  return rawScenes.map((scene) => ({
    ...scene,
    nodePlacements: scene.nodePlacements.filter((p) => nodes.has(p.nodeId)),
    wireRoutes: scene.wireRoutes.filter((w) => linkIdSet.has(w.linkId)),
    hiddenNodeIds: scene.hiddenNodeIds?.filter((id) => nodes.has(id)),
    hiddenLinkIds: scene.hiddenLinkIds?.filter((id) => linkIdSet.has(id)),
  }))
}
