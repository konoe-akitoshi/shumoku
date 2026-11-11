// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type {
  Attachment,
  GraphSettings,
  LinkDrawing,
  LinkObservation,
  NodeDrawing,
  NodeExclusion,
  NodeObservation,
  NodeSpec,
  PortObservation,
  SubgraphDrawing,
  SubgraphObservation,
} from './types.js'

/**
 * The network as kept: its configuration data, in the shape the YAML has, and how it is drawn.
 *
 * The configuration holds everything a network is made of: nodes with their ports, links with
 * their plugs and cables, groups, segments, terminations. Every source describes what it found in
 * this same shape (`SourceNetwork`), and `resolveNetwork` merges the project's configuration and
 * the sources' into one network of the shape, the sources ordered among themselves. A node the
 * project writes keeps its id through the merge; one only a source found gets a stable id of its
 * own. The drawing is keyed by those ids, so it can be dropped or rebuilt without touching the
 * configuration. Without sources, the merged network is the configuration itself.
 *
 * What identifies a device is configuration: a node's `address`, `chassisId`, `sysName` and
 * `mac`, a port's name and `mac`, and the merge matches on them. What each source said beyond
 * that (where a value came from, its own identifiers, attachments) is not part of the model: it
 * is the merge's input (`SourceNetwork.observation`) and its record (`ObservationLayer`, returned
 * beside the merged model).
 */
export interface NetworkModel {
  /** The network's configuration data, in the shape the YAML has. */
  readonly config: input.Network
  readonly drawing?: DrawingLayer
}

/**
 * One contribution to a network, in the configuration's shape: what one source found, or the
 * project's own configuration, with what the source says of it beyond the configuration (its own
 * identifiers, provenance, attachments) and how it would have the network drawn. Keyed by the
 * contributor's own ids.
 */
export interface SourceNetwork {
  readonly network: input.Network
  readonly observation?: ObservationLayer
  /** How the contributor would have its nodes drawn, such as the icons it knows. */
  readonly drawing?: DrawingLayer
}

/** A model and the observation record kept beside it. */
export interface ObservedModel {
  readonly model: NetworkModel
  readonly observation?: ObservationLayer
}

/** Ports are keyed by the port name a link end writes, such as `ge-0/0/1`. */
type ByPort<T> = Readonly<Record<string, T>>

/**
 * What the sources said beyond the configuration: provenance, a source's own identifiers,
 * attachments, exclusions. A contribution carries its own; the merge returns the merged record
 * beside the model. Nothing of it is drawn.
 */
export interface ObservationLayer {
  readonly nodes?: Readonly<
    Record<
      input.NodeId,
      NodeObservation & {
        readonly ports?: ByPort<PortObservation>
        /** Fields a source keeps as it found them, such as its own host id. */
        readonly metadata?: Readonly<Record<string, unknown>>
      }
    >
  >
  readonly links?: Readonly<
    Record<
      input.LinkId,
      LinkObservation & {
        /** Fields a source keeps as it found them, such as how it found the link. */
        readonly metadata?: Readonly<Record<string, unknown>>
      }
    >
  >
  readonly groups?: Readonly<Record<input.GroupId, SubgraphObservation>>
  /** Defaults every node inherits through its groups. */
  readonly attachments?: readonly Attachment[]
  readonly exclusions?: readonly NodeExclusion[]
}

/**
 * How it is drawn: the looks, icons and order the person chose. Where things sit is drawn from
 * the network each time, not kept: the configuration gives the structure, the structure the
 * relative placement (frames, rows, order), and `order` is the one thing a person adds to that
 * before the coordinates are solved. Sheets were removed in the engine swap; revisit as a view.
 */
export interface DrawingLayer {
  readonly nodes?: Readonly<
    Record<
      input.NodeId,
      NodeDrawing & {
        /** An icon to draw instead of the one its type and product give: SVG or a URL. */
        readonly icon?: string
      }
    >
  >
  readonly links?: Readonly<Record<input.LinkId, LinkDrawing>>
  readonly groups?: Readonly<
    Record<
      input.GroupId,
      SubgraphDrawing & {
        /** What the group is drawn as, such as a cloud provider or a chassis, and its icon. */
        readonly spec?: NodeSpec
      }
    >
  >
  readonly settings?: GraphSettings
  /**
   * The left-to-right order a person put siblings in by dragging, by the frame they sit in: a
   * group's id, or `ROOT_FRAME` for the top level. Each list is sparse: it names only the nodes,
   * redundancy sets and groups whose relative order was chosen, and the drawing holds those in
   * that order (one order of a frame's children serves every row of it) and places the rest
   * itself. A name the drawing has no child for is ignored, not removed, so a node a source
   * stops reporting for a while comes back to its place; one the structure places otherwise is
   * reported in the drawing's `Arrangement.unmet`. `drawNetwork` reads this itself, so the Editor
   * and the Server draw one model the same way. Positions are never stored.
   */
  readonly order?: Readonly<Record<string, readonly string[]>>
}

/** The key of `DrawingLayer.order` for the top level, which no group id can be. */
export const ROOT_FRAME = ''
