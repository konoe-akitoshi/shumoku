// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The pure half of a bake: resolve the sources into one model, filter what the display hides,
 * and draw. `derive-worker.ts` runs it in a Worker; this file has no Worker in it so it can be
 * called, and tested, directly.
 */

import {
  type NetworkModel,
  type ObservationLayer,
  resolveNetwork,
  type ScopeFilter,
  type SourceNetwork,
  type SourceSnapshot,
  toNetworkGraph,
} from '@shumoku/core'
import { drawNetworkScene } from '@shumoku/renderer/static'
import { filterDisconnected } from './display-filter.js'
import { type DeviceAttributes, deviceAttributesOf } from './resolved-record.js'
import type { DeriveResult } from './topology.js'

export interface DeriveRequest {
  /** The project's own contribution: its configuration, curation and drawing. */
  project: SourceNetwork
  snapshots: SourceSnapshot[]
  scope?: ScopeFilter
  hideDisconnected: boolean
}

/**
 * Resolves and draws. The drawing reads the model, not the graph: the order a person put siblings
 * in (`drawing.order`) rides through `resolveNetwork` and is read by the engine itself, so the
 * Server's picture of a model is the Editor's. The graph the web UI reads carries nothing of the
 * observation record; the record (provenance, attachments, a source's own ids) and each node's
 * device attributes are returned beside it, keyed by element id, for the Server's bookkeeping.
 */
export function derive(
  req: DeriveRequest,
  onStage: (stage: 'resolve' | 'layout') => void = () => {},
): DeriveResult {
  onStage('resolve')
  const { model, observation } = resolveNetwork(req.project, req.snapshots, { scope: req.scope })
  const resolvedGraph = toNetworkGraph(model)
  const graph = req.hideDisconnected ? filterDisconnected(resolvedGraph) : resolvedGraph
  // The nodes the display filter dropped are dropped from the model that is drawn as well, and
  // from the record kept beside the graph.
  const kept = new Set(graph.nodes.map((n) => n.id))
  const drawn: NetworkModel = req.hideDisconnected
    ? {
        ...model,
        config: { ...model.config, nodes: model.config.nodes.filter((n) => kept.has(n.id)) },
      }
    : model
  const attributes = keep(deviceAttributesOf(drawn), kept)
  const record: ObservationLayer = req.hideDisconnected
    ? { ...observation, ...(observation.nodes && { nodes: keep(observation.nodes, kept) }) }
    : observation

  onStage('layout')
  const scene = drawNetworkScene(drawn)
  return { graph, scene, observation: record, attributes }
}

function keep<T>(record: Readonly<Record<string, T>>, ids: ReadonlySet<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([id]) => ids.has(id)))
}

export type { DeviceAttributes }
