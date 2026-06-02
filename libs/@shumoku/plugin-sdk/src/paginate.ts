// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/** One page of a paginated upstream response. */
export interface Page<T> {
  items: T[]
  /** Absolute URL (or path) of the next page, or null/undefined when done. */
  next?: string | null
}

export interface PaginateOptions {
  /** Hard cap on pages followed, so a broken `next` loop can't run forever. */
  maxPages?: number
  /** Called once the cap is hit, so the caller can surface partial coverage. */
  onTruncated?: (pages: number) => void
}

/**
 * Follow a cursor-paginated endpoint to exhaustion, concatenating items.
 *
 * `fetchPage` receives the first path, then each subsequent `next` URL, and
 * returns `{ items, next }`. NetBox's `{ results, next }` was the motivating
 * case: the previous code took only the first page and silently dropped the
 * rest. This actually follows `next` until it is null — with a `maxPages`
 * backstop (default 1000) that reports truncation rather than hiding it.
 */
export async function paginate<T>(
  firstPath: string,
  fetchPage: (pathOrUrl: string) => Promise<Page<T>>,
  options: PaginateOptions = {},
): Promise<T[]> {
  const maxPages = options.maxPages ?? 1000
  const all: T[] = []
  let cursor: string | null | undefined = firstPath
  let pages = 0
  while (cursor) {
    const page = await fetchPage(cursor)
    all.push(...page.items)
    pages++
    if (pages >= maxPages) {
      if (page.next) options.onTruncated?.(pages)
      break
    }
    cursor = page.next ?? null
  }
  return all
}
