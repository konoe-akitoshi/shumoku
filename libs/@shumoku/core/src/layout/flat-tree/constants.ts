// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout constants for the flat-tree engine.
 *
 * Spacing values derive from `PORT_LABEL_OUTER_REACH` so the
 * layout reserves exactly enough room for the renderer's port-
 * label boxes. If the renderer changes its label geometry, the
 * gaps follow automatically.
 *
 * Network-engineering convention: vertical layer gap must fit
 * two facing labels (parent's bottom + child's top); horizontal
 * gap must fit two side labels.
 */

import { PORT_LABEL_OUTER_REACH } from '../../constants.js'

/**
 * Visible breathing room between adjacent label boxes (or
 * between a label and the next node body). 8 px reads as
 * "clearly separate" without wasting canvas.
 */
export const LABEL_CLEARANCE = 8

/**
 * Vertical gap between two layers of nodes inside a block.
 * Sized to fit two facing port labels with `LABEL_CLEARANCE`
 * of air between them so the wire curving between the labels
 * stays visible.
 */
export const INTERNAL_LAYER_GAP = PORT_LABEL_OUTER_REACH * 2 + LABEL_CLEARANCE

/**
 * Horizontal gap between sibling subtrees inside a block.
 * Each sibling may carry a port label on the facing side, so
 * the gap fits one label extent + a little air.
 */
export const INTERNAL_NODE_GAP = PORT_LABEL_OUTER_REACH + LABEL_CLEARANCE

/**
 * Horizontal gap between an emitter root and its side chain
 * inside a block (the {@link
 * ./internal.ts | layoutEmitterWithSideChain} case). Same
 * reasoning as `INTERNAL_NODE_GAP`.
 */
export const INTERNAL_ROOT_GAP = PORT_LABEL_OUTER_REACH + LABEL_CLEARANCE

/** Default node footprint when sizeById is missing the entry. */
export const DEFAULT_NODE_SIZE = { width: 80, height: 60 } as const
