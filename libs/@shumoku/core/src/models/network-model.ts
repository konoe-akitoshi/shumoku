// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type {
  Attachment,
  GraphSettings,
  LinkCable,
  LinkDesign,
  LinkDrawing,
  LinkObservation,
  LinkPlug,
  NodeDesign,
  NodeDrawing,
  NodeExclusion,
  NodeObservation,
  NodeSpec,
  PortDesign,
  PortDrawing,
  PortObservation,
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
  /** What the source knows of the hardware, such as each port's speed, role and notes. */
  readonly design?: DesignLayer
  /** How the source would have its nodes drawn, such as the icons it knows. */
  readonly drawing?: DrawingLayer
}

/** Ports are keyed by the port name a link end writes, such as `ge-0/0/1`. */
type ByPort<T> = Readonly<Record<string, T>>

/** What Server adds about the network: how nodes are recognized, where facts came from. */
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

/** What Editor adds for physical design. */
export interface DesignLayer {
  readonly nodes?: Readonly<
    Record<
      input.NodeId,
      NodeDesign & {
        /** The ports its product has, including those no link uses. */
        readonly ports?: ByPort<PortDesign>
        /**
         * What the product catalog says it is, as a snapshot: a VM's platform or a cloud
         * service's name, beyond the type and product the configuration names.
         */
        readonly spec?: NodeSpec
      }
    >
  >
  readonly links?: Readonly<
    Record<
      input.LinkId,
      LinkDesign & {
        /** What is plugged in at each end, in the order of the link's endpoints. */
        readonly ends?: readonly [LinkEndDesign, LinkEndDesign]
        /**
         * The cable as designed: its medium and grade, and its product. The configuration names
         * its type and length.
         */
        readonly cable?: Omit<LinkCable, 'length_m'>
      }
    >
  >
  readonly terminations?: readonly Termination[]
}

/** What is plugged into the port at one end of a link: its form factor and transceiver. */
export interface LinkEndDesign {
  readonly plug?: LinkPlug
}

/**
 * How it is drawn: the looks, icons and order the person chose. Where things sit is drawn from
 * the network each time, not kept. Sheets were removed in the engine swap; revisit as a view.
 */
export interface DrawingLayer {
  readonly nodes?: Readonly<
    Record<
      input.NodeId,
      NodeDrawing & {
        /** An icon to draw instead of the one its type and product give: SVG or a URL. */
        readonly icon?: string
        readonly ports?: ByPort<PortDrawing>
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
   * The left-to-right order the person put siblings in by dragging, by the frame they sit in: a
   * group's id, or `ROOT_FRAME` for the top level. Each list names the nodes and groups of that
   * frame; the drawing reads it as the order within a row. Positions are never stored: the
   * drawing solves them each time.
   */
  readonly order?: Readonly<Record<string, readonly string[]>>
}

/** The key of `DrawingLayer.order` for the top level, which no group id can be. */
export const ROOT_FRAME = ''
