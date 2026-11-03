// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { joinKey, splitKey } from '../structure/keys.js'
import type { FrameId } from './problem.js'
import type { Side } from './scene.js'

/**
 * Every composite key the drawing stages put in a map, one kind each. A key is a string that
 * knows what it was made from, so a map keyed by one kind refuses a bare string or another kind,
 * and the way a key is written lives here and nowhere else.
 */

declare const brand: unique symbol
type Key<T extends string> = string & { readonly [brand]: T }

/** The one place a string becomes a key. */
const mint = <T extends string>(raw: string): Key<T> => raw as Key<T>

/** What a frame is among items in the maps the layers return; a group may share an item's id. */
export type FrameKey = Key<'frame'>
/** The place a line that crosses a rank leaves in it, shared by its twins. */
export type DummyKey = Key<'dummy'>
/** One edge of a box. */
export type SideKey = Key<'side'>
/** A column node of the corridors. */
export type ColumnKey = Key<'column'>
/** A port: a name on a box's edge, on one side. */
export type PortKey = Key<'port'>
/** The stretch a line runs along in one node of its route. */
export type LaneKey = Key<'lane'>
/** A coordinate in a line's chain: a port or a lane. */
export type VarKey = Key<'var'>
/** The slots a frame holds in one rank. */
export type RowKey = Key<'row'>
/** One column node of a frame, by its rank and its place among the frame's children. */
export type ColumnSlotKey = Key<'column slot'>
/** One row cell of a frame, by its gap and its interval. */
export type CellSlotKey = Key<'cell slot'>

const FRAME = 'frame:'
const DUMMY = 'dummy:'
const SIDES: readonly Side[] = ['top', 'bottom', 'left', 'right']

export const frameKey = (id: FrameId): FrameKey => mint(joinKey(['', `${FRAME}${id}`]))
export const isFrameKey = (key: string): key is FrameKey => key.startsWith(`\0${FRAME}`)

export const dummyKey = (family: string, rank: number): DummyKey =>
  mint(`${DUMMY}${family}@${rank}`)
export const isDummyKey = (key: string): key is DummyKey => key.startsWith(DUMMY)

export const sideKey = (box: string, side: Side): SideKey => mint(joinKey([box, side]))
/** The box and the side a `sideKey` was made from. */
export function splitSide(key: SideKey): { box: string; side: Side } {
  const [box, raw] = splitKey(key)
  const side = SIDES.find((s) => s === raw)
  if (box === undefined || side === undefined) throw new Error(`not a side key: ${key}`)
  return { box, side }
}

export const columnKey = (node: number): ColumnKey => mint(`col:${node}`)

export const portKey = (sceneId: string, side: Side): PortKey => mint(`${sceneId}|${side}`)
export const laneKey = (line: string, index: number): LaneKey => mint(`${line}@${index}`)

export const varKey = (v: { kind: 'port'; id: PortKey } | { kind: 'lane'; key: LaneKey }): VarKey =>
  mint(v.kind === 'port' ? `p:${v.id}` : `l:${v.key}`)

export const rowKey = (frame: FrameId, rank: number): RowKey => mint(joinKey([frame, rank]))
export const columnSlotKey = (frame: FrameId, rank: number, slot: number): ColumnSlotKey =>
  mint(joinKey([frame, rank, slot]))
export const cellSlotKey = (frame: FrameId, gap: number, interval: number): CellSlotKey =>
  mint(joinKey([frame, gap, interval]))

/** A map of one kind of key asked for by a child key of unknown kind: found only if it is of that kind. */
export function frameIn<V>(map: ReadonlyMap<FrameKey, V>, key: string): V | undefined {
  return isFrameKey(key) ? map.get(key) : undefined
}
export function dummyIn<V>(map: ReadonlyMap<DummyKey, V>, key: string): V | undefined {
  return isDummyKey(key) ? map.get(key) : undefined
}
export const hasFrame = (map: ReadonlyMap<FrameKey, unknown>, key: string): boolean =>
  isFrameKey(key) && map.has(key)
export const hasDummy = (map: ReadonlyMap<DummyKey, unknown>, key: string): boolean =>
  isDummyKey(key) && map.has(key)
