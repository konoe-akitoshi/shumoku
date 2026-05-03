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
    scenesState.list = scenesState.list.map((s) => {
      if (s.id !== sceneId) return s
      const idx = s.nodePlacements.findIndex((p) => p.nodeId === nodeId)
      if (idx >= 0) {
        const next = [...s.nodePlacements]
        next[idx] = { ...next[idx], position }
        return { ...s, nodePlacements: next }
      }
      return { ...s, nodePlacements: [...s.nodePlacements, { nodeId, position }] }
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
