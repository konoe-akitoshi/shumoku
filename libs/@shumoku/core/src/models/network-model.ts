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
 * The network as kept: its configuration, as the YAML writes it, and the layers that ride on it.
 * Each layer is keyed by the ids of the configuration: a node's, a group's or a link's id, so a
 * layer can be dropped or rebuilt without touching the configuration.
 */
export interface NetworkModel {
  readonly config: input.Network
  readonly observation?: ObservationLayer
  readonly design?: DesignLayer
  readonly drawing?: DrawingLayer
}

/** What Server adds when it merges the configuration with what its sources discover. */
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
