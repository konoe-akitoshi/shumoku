import { LayoutInvariantError } from '../errors'

/** Reads an element the caller knows exists; throws instead of yielding `undefined`. */
export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new LayoutInvariantError(`No item at index ${index}`)
  return item
}

export function firstItem<T>(items: readonly T[]): T {
  return itemAt(items, 0)
}

export function lastItem<T>(items: readonly T[]): T {
  return itemAt(items, items.length - 1)
}

/** Reads a map entry the caller knows exists; throws instead of yielding `undefined`. */
export function mapValue<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key)
  if (value === undefined) throw new LayoutInvariantError(`No entry for key ${String(key)}`)
  return value
}

/** `[0, 1, …, count - 1]` */
export function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
}
