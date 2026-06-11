/**
 * JSON (de)serialization that round-trips `Map` values, used to ship layout
 * artifacts (ResolvedLayout holds Maps) between the server's persisted
 * artifact, its HTTP responses, and the web client. Maps are tagged as
 * `{ "__map__": [[k, v], ...] }`; everything else is plain JSON.
 */

const MAP_TAG = '__map__'

export function stringifyWithMaps(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v instanceof Map ? { [MAP_TAG]: Array.from(v.entries()) } : v,
  )
}

export function parseWithMaps<T>(text: string): T {
  return JSON.parse(text, (_k, v) => {
    // Only the encoder's exact shape `{ __map__: [...] }` (a single key) is a
    // tagged Map — so a real object that merely *has* a `__map__` array
    // property is not misread as a Map.
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length === 1 &&
      Array.isArray((v as Record<string, unknown>)[MAP_TAG])
    ) {
      return new Map((v as Record<string, [unknown, unknown][]>)[MAP_TAG])
    }
    return v
  }) as T
}
