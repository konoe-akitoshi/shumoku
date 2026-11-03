// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NodeId } from '../../structure/types.js'
import type { DummyKey, FrameKey, PortKey, SideKey } from '../keys.js'
import type { FrameId, Item, ItemId, Problem } from '../problem.js'
import type { Hints, Ranks } from '../ranks.js'
import type { Tree } from '../tree.js'

/**
 * One place in a rank's row: a box (a card, bus or cloud, or one member of a unit) or the
 * dummy a line that crosses ranks leaves in each rank it passes. Twins share their dummies.
 */
export type Element =
  | { kind: 'box'; key: string; item: ItemId }
  | {
      kind: 'dummy'
      key: DummyKey
      family: string
      lines: readonly string[]
      frame: FrameId
      rank: number
    }

export type Dummy = Extract<Element, { kind: 'dummy' }>

/** A child of a frame that can be moved, with the satellites that stand beside it. */
export interface Cluster {
  readonly anchor: string
  readonly satellites: readonly string[]
}
export interface Row {
  readonly movable: readonly Cluster[]
  readonly tail: readonly string[]
}
/** An order: every frame's children, and the members of every unit. Never changed once made; a trial is a new one. */
export interface State {
  readonly rows: ReadonlyMap<FrameId, Row>
  readonly members: ReadonlyMap<ItemId, readonly NodeId[]>
}
/**
 * What an order is, as text: two states with the same rows in the same order and the same members
 * have the same fingerprint, however their maps were filled.
 */
export const fingerprint = (state: State): string => {
  const byKey = <K extends string, V>(m: ReadonlyMap<K, V>) =>
    [...m].sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0))
  return JSON.stringify([
    byKey(state.rows).map(([f, r]) => [f, r.movable.map((c) => [c.anchor, c.satellites]), r.tail]),
    byKey(state.members),
  ])
}
export interface Segment {
  readonly gap: number
  readonly a: string
  readonly b: string
  readonly w: number
  /** The frames the line may cross without cost. */
  readonly allowed: ReadonlySet<FrameId>
  /** The ports (by `ports` key) the segment starts and ends at; none where it meets a dummy. */
  readonly pa: string
  readonly pb: string
}
export interface Looked {
  get(key: string): number | undefined
}
/** The rows with the places in them; a trial's are the base's with what it changed laid over. */
export interface Flat {
  readonly seq: readonly (readonly string[])[]
  readonly pos: Looked
  /** Where each port stands: its box's place and a part of it. */
  readonly end: Looked
}
export interface Whole extends Flat {
  readonly pos: ReadonlyMap<string, number>
  readonly end: ReadonlyMap<string, number>
  /** The ports of each side of a box, in order along it. */
  readonly ports: ReadonlyMap<SideKey, readonly PortKey[]>
}
/** The ports on one side of a box, with the places their lines lead to. */
export interface PortGroup {
  readonly key: SideKey
  readonly box: string
  readonly side: 'top' | 'bottom'
  readonly ids: readonly PortKey[]
  readonly partners: readonly (readonly string[])[]
}
/** What an order costs, gap by gap and rank by rank. */
export interface Costs {
  readonly wall: readonly number[]
  readonly gap: readonly number[]
  readonly level: readonly number[]
}

/** What the problem and the ranks say of the rows, looked up the ways the stages need. */
export interface Basis {
  readonly problem: Problem
  readonly ranks: Ranks
  readonly hints: Pick<Hints, 'order' | 'members'>
  readonly tree: Tree
  readonly anchors: ReadonlyMap<string, string>
  readonly items: ReadonlyMap<ItemId, Item>
  readonly frameOfKey: ReadonlyMap<FrameKey, FrameId>
  readonly parentFrame: ReadonlyMap<FrameId, FrameId | undefined>
  /** The item each box or member stands for. */
  readonly ownerOf: ReadonlyMap<string, ItemId>
  rankOf(id: string): number
  /** Whether the frame holds some box of rank `r`. */
  reaches(frame: FrameId, r: number): boolean
}

/** A port on a top or bottom side: its box and side, and the places its lines lead to. */
export interface PortInfo {
  readonly box: string
  readonly side: 'top' | 'bottom'
  readonly partners: readonly string[]
}
/** The places a place has above, below and beside it. */
export interface Neighbours {
  readonly up: readonly string[]
  readonly down: readonly string[]
  readonly level: readonly string[]
}
/** A line between two places of one rank. */
export interface Level {
  readonly r: number
  readonly a: string
  readonly b: string
  readonly w: number
}

/** What the lines say of the rows: the chain of elements each stands in, rank by rank. */
export interface Wires {
  readonly dummies: ReadonlyMap<DummyKey, Dummy>
  readonly segs: ReadonlyMap<string, Segment>
  readonly portInfo: ReadonlyMap<PortKey, PortInfo>
  readonly adj: ReadonlyMap<string, Neighbours>
  readonly gapSegs: readonly (readonly Segment[])[]
  readonly degUp: ReadonlyMap<string, number>
  readonly degDown: ReadonlyMap<string, number>
  readonly levelsAt: readonly (readonly Level[])[]
}

/** The ports of every side of a box, and which of them stand in each rank. */
export interface Ported {
  readonly portGroups: readonly PortGroup[]
  readonly groupsAt: readonly (readonly PortGroup[])[]
}

export type Lookup = Basis & Wires & Ported
