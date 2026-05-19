// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Spacing derivation.
 *
 * Every gap, padding and label-band height the engine uses is
 * computed by {@link deriveSpacing} from a small set of inputs:
 *
 *   - `LayoutMetrics`: renderer-supplied measurements (port-
 *     label box reach, font em-size, pre-measured subgraph
 *     label height). All optional — sensible defaults preserve
 *     standalone behaviour.
 *
 *   - `SpacingOverrides`: caller-supplied option values that
 *     win over the derivation (the four `FlatTreeLayoutOptions`
 *     spacing fields).
 *
 * This file is the single source of truth for spacing. No
 * other module in the engine should hardcode a gap value — they
 * all consume a `Spacing` parameter.
 *
 * Derivation rules:
 *
 *   labelClearance         = em * 2/3
 *   internalNodeGap        = portLabelOuterReach + labelClearance
 *   internalLayerGap       = portLabelOuterReach * 2 + labelClearance
 *   internalRootGap        = portLabelOuterReach + labelClearance
 *   outerNodeGap (default) = internalNodeGap + labelClearance
 *   outerLayerGap (default)= internalLayerGap + portLabelOuterReach
 *   subgraphPadding        = labelClearance * 2.5
 *   subgraphLabelHeight    = em + labelClearance * 2
 *
 * The "internal" gaps are the minimum legal spacing between two
 * adjacent label boxes (one parent's bottom label + one child's
 * top label + clearance). The "outer" defaults add one more
 * clearance / reach unit so cross-block routes have visible
 * breathing room.
 */

import { PORT_LABEL_OUTER_REACH } from '../../../constants.js'

/**
 * Renderer-supplied measurements that drive engine spacing.
 *
 * All fields are optional. When a field is absent the engine
 * falls back to a value that matches the historical default
 * (em = 12, port-label reach = the core `PORT_LABEL_OUTER_REACH`
 * constant). Pass the relevant fields when you want the layout
 * to track the renderer's actual geometry.
 */
export interface LayoutMetrics {
  /**
   * Outer extent of a port-label box, measured from the port
   * centre along the port's outward normal. Defaults to the
   * core `PORT_LABEL_OUTER_REACH` constant.
   */
  portLabelOuterReach?: number
  /**
   * Base font em-size in pixels. Drives `labelClearance` and
   * the default subgraph label-band height. Defaults to 12.
   */
  fontEmSize?: number
  /**
   * Pre-measured subgraph label band height. Overrides the
   * em-based derivation. Use this when the renderer has
   * already measured the actual rendered label text.
   */
  subgraphLabelHeight?: number
}

/** Concrete spacing values consumed by the engine pipeline. */
export interface Spacing {
  /** Visible breathing room between two adjacent label boxes. */
  labelClearance: number
  /** Far-edge distance of a port label box from its port. */
  portLabelOuterReach: number
  /** Horizontal gap between sibling subtrees inside a block. */
  internalNodeGap: number
  /** Vertical gap between two layers of nodes inside a block. */
  internalLayerGap: number
  /** Horizontal gap between an emitter root and its side chain. */
  internalRootGap: number
  /** Horizontal gap between sibling blocks in the outer tidy-tree. */
  outerNodeGap: number
  /** Vertical gap between layers in the outer tidy-tree. */
  outerLayerGap: number
  /** Padding inside a subgraph hull, between contents and edge. */
  subgraphPadding: number
  /** Reserved vertical space at the top of a subgraph hull for the label. */
  subgraphLabelHeight: number
}

/** Caller-supplied option overrides. Win over the derivation. */
export interface SpacingOverrides {
  nodeGap?: number
  layerGap?: number
  subgraphPadding?: number
  subgraphLabelHeight?: number
}

/**
 * Default font em-size when `metrics.fontEmSize` is absent.
 * Matches the default 12 px UI label font.
 */
const DEFAULT_FONT_EM = 12

/**
 * Fraction of em-size used as visible label clearance. 2/3 puts
 * the clearance at 8 px when em = 12 (the historical
 * `LABEL_CLEARANCE` constant).
 */
const CLEARANCE_PER_EM = 2 / 3

/**
 * Padding multiplier for the subgraph hull. The hull's interior
 * padding is roughly 2.5 × the label clearance — enough that the
 * rendered hull frame doesn't visually touch the inner node
 * footprints.
 */
const SUBGRAPH_PADDING_PER_CLEARANCE = 2.5

/**
 * Derive every concrete spacing value the engine needs from
 * renderer metrics + caller overrides. Pure function; safe to
 * call once at the top of {@link ../index.ts | layoutFlatTree}
 * and pass the result to every pipeline phase.
 */
export function deriveSpacing(
  metrics: LayoutMetrics = {},
  overrides: SpacingOverrides = {},
): Spacing {
  const em = metrics.fontEmSize ?? DEFAULT_FONT_EM
  const labelClearance = em * CLEARANCE_PER_EM
  const portLabelOuterReach = metrics.portLabelOuterReach ?? PORT_LABEL_OUTER_REACH

  const internalNodeGap = portLabelOuterReach + labelClearance
  const internalLayerGap = portLabelOuterReach * 2 + labelClearance
  const internalRootGap = portLabelOuterReach + labelClearance

  const outerNodeGap = overrides.nodeGap ?? internalNodeGap + labelClearance
  const outerLayerGap = overrides.layerGap ?? internalLayerGap + portLabelOuterReach

  const subgraphPadding =
    overrides.subgraphPadding ?? labelClearance * SUBGRAPH_PADDING_PER_CLEARANCE
  const subgraphLabelHeight =
    overrides.subgraphLabelHeight ?? metrics.subgraphLabelHeight ?? em + labelClearance * 2

  return {
    labelClearance,
    portLabelOuterReach,
    internalNodeGap,
    internalLayerGap,
    internalRootGap,
    outerNodeGap,
    outerLayerGap,
    subgraphPadding,
    subgraphLabelHeight,
  }
}
