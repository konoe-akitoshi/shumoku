// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Older saves kept what is now Scene data in the network: a termination's position, a link's
 * bends, a node's or a wire's display scale; and kept the ports, products, plugs, cables and
 * terminations in a design layer beside the configuration. These bring either shape forward:
 *
 *   - `documentFromLegacyGraph`: a `NetworkGraph` as a format v4 archive or the one-row-per-entity
 *     cache (DB v2-v6) held it, possibly still with bend and termination Nodes.
 *   - `documentFromLayeredModel`: a model as a format v5 archive or a DB v7 document held it,
 *     with observation, design and drawing layers.
 *
 * Reads RAW input (see ./README.md): the coordinates are read off the legacy shapes before
 * `fromNetworkGraph` drops what the network does not hold, and written into every scene.
 */

import {
  fromNetworkGraph,
  type Link,
  type NetworkGraph,
  type NetworkModel,
  type Node,
  type Termination,
} from '@shumoku/core'
import type { Scene, WireBend } from '../types'
import { migrateBendNodesToLinkBends } from './bend-nodes-to-link-bends'
import { migrateLegacyWireRoutes } from './legacy-wire-routes'
import { migrateTerminationNodesToGraphTerminations } from './termination-nodes-to-graph-terminations'

/** A node as older graphs held it: possibly a cabling waypoint, possibly with a position. */
export type LegacyNode = Node & {
  termination?: { role: 'outlet' | 'eps' | 'panel' | 'bend' }
  position?: { x: number; y: number }
  /** A free bag older graphs kept on a node; its display scale is the only thing read. */
  metadata?: Record<string, unknown>
}
/** A link as older graphs held it: with its bends on itself, and a free metadata bag. */
export type LegacyLink = Link & { bends?: WireBend[]; metadata?: Record<string, unknown> }
/** A termination as older graphs held it: with its own position and a free metadata bag. */
export type LegacyTermination = Termination & {
  position?: { x: number; y: number }
  metadata?: Record<string, unknown>
}
/** A graph as older stores held it. */
export type LegacyGraph = Omit<NetworkGraph, 'nodes' | 'links' | 'terminations'> & {
  nodes: LegacyNode[]
  links: LegacyLink[]
  terminations?: LegacyTermination[]
}

/** What older shapes kept in the network that belongs to the scenes. */
interface SceneData {
  terminationPositions: Map<string, { x: number; y: number }>
  linkBends: Map<string, WireBend[]>
  nodeScales: Map<string, number>
  wireScales: Map<string, number>
}

/** A graph an older store held, as the document it becomes: the model, and the scenes. */
export function documentFromLegacyGraph(
  graph: LegacyGraph,
  rawScenes: readonly Scene[],
  newBendId: () => string,
): { model: NetworkModel; scenes: Scene[] } {
  const nodes = new Map<string, LegacyNode>(graph.nodes.map((n) => [n.id, n]))
  const links: LegacyLink[] = graph.links.map((l) => ({ ...l }))
  const terminations: LegacyTermination[] = (graph.terminations ?? []).map((t) => ({ ...t }))
  const scenes = rawScenes.map((s) => ({ ...s, nodePlacements: [...s.nodePlacements] }))
  // Ancient saves: bends as scene control points, bends and terminations as Nodes.
  migrateLegacyWireRoutes(rawScenes, { links, newBendId })
  migrateBendNodesToLinkBends({ nodes, links, scenes })
  migrateTerminationNodesToGraphTerminations({ nodes, terminations, scenes })

  const data: SceneData = {
    terminationPositions: new Map(
      terminations.flatMap((t) => (t.position ? [[t.id, t.position]] : [])),
    ),
    linkBends: new Map(links.flatMap((l) => (l.id && l.bends?.length ? [[l.id, l.bends]] : []))),
    nodeScales: new Map(
      [...nodes.values()].flatMap((n) => {
        const scale = n.metadata?.['displayScale']
        return typeof scale === 'number' ? [[n.id, scale]] : []
      }),
    ),
    wireScales: new Map(
      links.flatMap((l) => {
        const scale = l.metadata?.['wireScale']
        return l.id && typeof scale === 'number' ? [[l.id, scale]] : []
      }),
    ),
  }
  const current: NetworkGraph = {
    ...graph,
    nodes: [...nodes.values()].map(({ termination: _t, position: _p, ...n }) => withoutScale(n)),
    links: links.map(({ bends: _b, ...l }) => withoutScale(l)),
    terminations: terminations.map(({ position: _p, metadata, ...t }) => {
      const autoFor = metadata?.['autoFor']
      return { ...t, ...(typeof autoFor === 'string' && { autoFor }) }
    }),
  }
  return { model: fromNetworkGraph(current), scenes: sceneDataIntoScenes(scenes, data) }
}

/** A model as a format v5 archive or a DB v7 document held it, with its layers. */
export interface LayeredModel {
  config: NetworkModel['config']
  observation?: {
    nodes?: Record<string, { metadata?: Record<string, unknown> }>
    links?: Record<string, { metadata?: Record<string, unknown> }>
  }
  design?: {
    nodes?: Record<
      string,
      {
        productId?: string
        spec?: { platform?: string; service?: string; resource?: string }
        ports?: Record<string, Record<string, unknown>>
      }
    >
    links?: Record<
      string,
      {
        via?: string[]
        bends?: WireBend[]
        ends?: [{ plug?: unknown } | undefined, { plug?: unknown } | undefined]
        cable?: { medium?: string; category?: string; productId?: string }
      }
    >
    terminations?: LegacyTermination[]
  }
  drawing?: NetworkModel['drawing']
}

/** Whether a model read from a store still carries the observation or design layer. */
export function isLayeredModel(model: object): model is LayeredModel {
  return 'design' in model || 'observation' in model
}

/** A layered model, as the document it becomes: the model, and the scenes. */
export function documentFromLayeredModel(
  layered: LayeredModel,
  rawScenes: readonly Scene[],
): { model: NetworkModel; scenes: Scene[] } {
  const { config, observation, design, drawing } = layered
  const nodes = config.nodes.map((node) => {
    const designed = design?.nodes?.[node.id]
    if (!designed) return node
    const ports = Object.entries(designed.ports ?? {}).map(([name, port]) => {
      const { label, connectors, disabled: _d, ...rest } = port
      return {
        name,
        ...rest,
        ...(label !== undefined && label !== name && { label }),
        ...(Array.isArray(connectors) && connectors.length > 0 && { connectors }),
      }
    })
    return {
      ...node,
      ...(designed.productId && { productId: designed.productId }),
      ...(designed.spec?.platform && { platform: designed.spec.platform }),
      ...(designed.spec?.service && { service: designed.spec.service }),
      ...(designed.spec?.resource && { resource: designed.spec.resource }),
      ...(ports.length > 0 && { ports }),
    }
  })
  const links = config.links.map((link) => {
    const designed = link.id ? design?.links?.[link.id] : undefined
    if (!designed) return link
    const type = typeof link.cable === 'string' ? link.cable : link.cable?.type
    const cableType = type ?? designed.cable?.category ?? designed.cable?.medium
    const productId =
      (typeof link.cable === 'object' ? link.cable.productId : undefined) ??
      designed.cable?.productId
    const cable = productId
      ? { ...(cableType && { type: cableType }), productId }
      : (cableType ?? undefined)
    return {
      ...link,
      endpoints: link.endpoints.map((end, i) => {
        const plug = designed.ends?.[i]?.plug
        return 'node' in end && plug && !end.plug ? { ...end, plug } : end
      }) as unknown as Link extends never ? never : typeof link.endpoints,
      ...(cable !== undefined && { cable }),
      ...(designed.via?.length && !link.via && { via: designed.via }),
    }
  })
  const terminations = [
    ...(config.terminations ?? []),
    ...(design?.terminations ?? []).map(({ position: _p, metadata, ...t }) => {
      const autoFor = metadata?.['autoFor']
      return { ...t, ...(typeof autoFor === 'string' && { autoFor }) }
    }),
  ]
  const data: SceneData = {
    terminationPositions: new Map(
      (design?.terminations ?? []).flatMap((t) => (t.position ? [[t.id, t.position]] : [])),
    ),
    linkBends: new Map(
      Object.entries(design?.links ?? {}).flatMap(([id, l]) =>
        l.bends?.length ? [[id, l.bends]] : [],
      ),
    ),
    nodeScales: new Map(
      Object.entries(observation?.nodes ?? {}).flatMap(([id, o]) => {
        const scale = o.metadata?.['displayScale']
        return typeof scale === 'number' ? [[id, scale]] : []
      }),
    ),
    wireScales: new Map(
      Object.entries(observation?.links ?? {}).flatMap(([id, o]) => {
        const scale = o.metadata?.['wireScale']
        return typeof scale === 'number' ? [[id, scale]] : []
      }),
    ),
  }
  const nonEmpty = (record: Record<string, unknown>) =>
    Object.keys(record).length > 0 ? record : undefined
  const drawn = drawing && {
    ...drawing,
    nodes: nonEmpty(
      Object.fromEntries(
        Object.entries(drawing.nodes ?? {}).flatMap(([id, d]) => {
          const { position: _p, size: _s, ports: _ports, ...rest } = d as Record<string, unknown>
          return Object.keys(rest).length > 0 ? [[id, rest]] : []
        }),
      ),
    ),
    groups: nonEmpty(
      Object.fromEntries(
        Object.entries(drawing.groups ?? {}).flatMap(([id, d]) => {
          const { direction: _d, bounds: _b, ...rest } = d as Record<string, unknown>
          return Object.keys(rest).length > 0 ? [[id, rest]] : []
        }),
      ),
    ),
  }
  const model: NetworkModel = JSON.parse(
    JSON.stringify({
      config: {
        ...config,
        nodes,
        links,
        ...(terminations.length > 0 && { terminations }),
      },
      ...(drawn && { drawing: drawn }),
    }),
  )
  return { model, scenes: sceneDataIntoScenes(rawScenes, data) }
}

/**
 * Write what the network held into every scene: a termination's position becomes a placement, a
 * link's bends and width become its wire, a node's display scale the scale of its placement.
 * Older saves held one position for all scenes, so each scene gets the same.
 */
function sceneDataIntoScenes(scenes: readonly Scene[], data: SceneData): Scene[] {
  return scenes.map((scene) => {
    const placed = new Set(scene.nodePlacements.map((p) => p.nodeId))
    const nodePlacements = [
      ...scene.nodePlacements.map((p) => {
        const scale = data.nodeScales.get(p.nodeId)
        return scale !== undefined && p.scale === undefined ? { ...p, scale } : p
      }),
      ...[...data.terminationPositions]
        .filter(([id]) => !placed.has(id))
        .map(([nodeId, position]) => ({ nodeId, position: { ...position } })),
    ]
    const wireIds = new Set([...data.linkBends.keys(), ...data.wireScales.keys()])
    const wires = [
      ...(scene.wires ?? []),
      ...[...wireIds]
        .filter((id) => !scene.wires?.some((w) => w.linkId === id))
        .map((linkId) => {
          const bends = data.linkBends.get(linkId)
          const wireScale = data.wireScales.get(linkId)
          return {
            linkId,
            ...(bends && { bends: bends.map((b) => ({ ...b })) }),
            ...(wireScale !== undefined && { wireScale }),
          }
        }),
    ]
    return { ...scene, nodePlacements, ...(wires.length > 0 && { wires }) }
  })
}

/** The element without the display scale older saves kept in its metadata. */
function withoutScale<T extends { metadata?: Record<string, unknown> }>(element: T): T {
  const { displayScale: _d, wireScale: _w, ...metadata } = element.metadata ?? {}
  const { metadata: _m, ...rest } = element
  return (Object.keys(metadata).length > 0 ? { ...rest, metadata } : rest) as T
}
