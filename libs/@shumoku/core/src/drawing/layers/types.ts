// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NodeId } from '../../structure/types.js'
import type { FrameId, Item, ItemId, Problem } from '../problem.js'
import type { Hints, Ranks } from '../ranks.js'
import type { Tree } from '../tree.js'

/**
 * One place in a rank's row: a box (a card, bus or cloud, or one member of a unit) or the
 * dummy a line that crosses ranks leaves in each rank it passes. Twins share their dummies.
 */
export type Element =
  | { kind: 'box'; key: string; item: ItemId }
  | { kind: 'dummy'; key: string; family: string; lines: string[]; frame: FrameId; rank: number }

export type Dummy = Extract<Element, { kind: 'dummy' }>

/** A child of a frame that can be moved, with the satellites that stand beside it. */
export interface Cluster {
  anchor: string
  satellites: string[]
}
export interface Row {
  movable: Cluster[]
  tail: string[]
}
/** An order: every frame's children, and the members of every unit. */
export interface State {
  rows: Map<FrameId, Row>
  members: Map<ItemId, NodeId[]>
}
export interface Segment {
  gap: number
  a: string
  b: string
  w: number
  /** The frames the line may cross without cost. */
  allowed: ReadonlySet<FrameId>
  /** The ports (by `ports` key) the segment starts and ends at; none where it meets a dummy. */
  pa: string
  pb: string
}
export interface Looked {
  get(key: string): number | undefined
}
/** The rows with the places in them; a trial's are the base's with what it changed laid over. */
export interface Flat {
  seq: string[][]
  pos: Looked
  /** Where each port stands: its box's place and a part of it. */
  end: Looked
}
export interface Whole extends Flat {
  pos: Map<string, number>
  end: Map<string, number>
  /** The ports of each side of a box, in order along it. */
  ports: Map<string, string[]>
}
/** The ports on one side of a box, with the places their lines lead to. */
export interface PortGroup {
  key: string
  box: string
  side: 'top' | 'bottom'
  ids: string[]
  partners: string[][]
}
/** What an order costs, gap by gap and rank by rank. */
export interface Costs {
  wall: number[]
  gap: number[]
  level: number[]
}

/** What the problem and the ranks say of the rows, looked up the ways the stages need. */
export interface Basis {
  problem: Problem
  ranks: Ranks
  hints: Pick<Hints, 'order' | 'members'>
  tree: Tree
  anchors: Map<string, string>
  items: Map<ItemId, Item>
  frameOfKey: Map<string, FrameId>
  parentFrame: Map<FrameId, FrameId | undefined>
  /** The item each box or member stands for. */
  ownerOf: Map<string, ItemId>
  rankOf(id: string): number
  /** Whether the frame holds some box of rank `r`. */
  reaches(frame: FrameId, r: number): boolean
}

/** What the lines say of the rows: the chain of elements each stands in, rank by rank. */
export interface Wires {
  dummies: Map<string, Dummy>
  segs: Map<string, Segment>
  /** Each port on a top or bottom side: its box and side, and the places its lines lead to. */
  portInfo: Map<string, { box: string; side: 'top' | 'bottom'; partners: string[] }>
  adj: Map<string, { up: string[]; down: string[]; level: string[] }>
  gapSegs: Segment[][]
  degUp: Map<string, number>
  degDown: Map<string, number>
  levelsAt: { r: number; a: string; b: string; w: number }[][]
}

/** The ports of every side of a box, and which of them stand in each rank. */
export interface Ported {
  portGroups: PortGroup[]
  groupsAt: PortGroup[][]
}

export type Ctx = Basis & Wires & Ported
