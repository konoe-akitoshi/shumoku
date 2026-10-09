// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type {
  Attachment,
  GraphSettings,
  LinkDesign,
  LinkDrawing,
  LinkObservation,
  NodeDesign,
  NodeDrawing,
  NodeExclusion,
  NodeObservation,
  NodePort,
  SubgraphDrawing,
  SubgraphObservation,
  Termination,
} from './types.js'

/**
 * The network as kept: its configuration, as the YAML writes it, what each source discovered in
 * the same shape, and the layers that ride on them.
 *
 * Server merges the configuration with the sources into one network of the same shape. A node
 * that is written in the configuration keeps its id there; one only a source found gets a stable
 * id of its own. The layers are keyed by the ids of that merged network: a node's, a group's or a
 * link's id, so a layer can be dropped or rebuilt without touching the configuration. Without
 * sources, the merged network is the configuration itself.
 */
export interface NetworkModel {
  /** What people write. */
  readonly config: input.Network
  /** What each source discovered, by source id. */
  readonly sources?: Readonly<Record<string, SourceNetwork>>
  readonly observation?: ObservationLayer
  readonly design?: DesignLayer
  readonly drawing?: DrawingLayer
}

/**
 * What one source, such as a monitoring system or a scan, discovered: the network in the
 * input's shape, with how each of its nodes is recognized across sources, keyed by the source's
 * own ids. A node written in the configuration is recognized through the top-level observation
 * layer instead.
 */
export interface SourceNetwork {
  readonly network: input.Network
  readonly observation?: ObservationLayer
}

/** What Server adds about the network: how nodes are recognized, where facts came from. */
export interface ObservationLayer {
  readonly nodes?: Readonly<Record<input.NodeId, NodeObservation>>
  readonly links?: Readonly<Record<input.LinkId, LinkObservation>>
  readonly groups?: Readonly<Record<input.GroupId, SubgraphObservation>>
  /** Defaults every node inherits through its groups. */
  readonly attachments?: readonly Attachment[]
  readonly exclusions?: readonly NodeExclusion[]
}

/** What Editor adds for physical design. */
export interface DesignLayer {
  readonly nodes?: Readonly<Record<input.NodeId, NodeDesign & { readonly ports?: NodePort[] }>>
  readonly links?: Readonly<Record<input.LinkId, LinkDesign>>
  readonly terminations?: readonly Termination[]
}

/** Where and how it is drawn. Geometry is written by layout or by Editor. */
export interface DrawingLayer {
  readonly nodes?: Readonly<Record<input.NodeId, NodeDrawing>>
  readonly links?: Readonly<Record<input.LinkId, LinkDrawing>>
  readonly groups?: Readonly<Record<input.GroupId, SubgraphDrawing>>
  readonly settings?: GraphSettings
}
