// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Bundled into a single IIFE and evaluated once per quickjs-wasi VM (see
 * quickjs-vm.ts). `URL`, `URLSearchParams`, `TextEncoder`/`TextDecoder` and
 * `Headers` come from the engine's native extensions; this fills in what
 * they don't cover. All of it is pure computation, so none of it needs a
 * host bridge.
 */
// The trailing slash picks the npm package over Node's built-in `buffer`.
import { Buffer } from 'buffer/'
;(globalThis as { Buffer?: unknown }).Buffer = Buffer

import AbortController from 'abort-controller'
;(globalThis as { AbortController?: unknown }).AbortController = AbortController
;(globalThis as { AbortSignal?: unknown }).AbortSignal = (
  AbortController as unknown as { AbortSignal: unknown }
).AbortSignal

/**
 * The native `URLSearchParams` only parses a query string; handed a record
 * (`new URLSearchParams({ limit: '0' })`, as the bundled NetBox plugin does)
 * or an array of pairs, it silently comes out empty. This accepts every init
 * form the standard does, leaving the encoding to the native `append`.
 */
const NativeURLSearchParams = URLSearchParams
if (new NativeURLSearchParams({ probe: '1' } as unknown as string).toString() !== 'probe=1') {
  type Init = string | Record<string, string> | Iterable<[string, string]> | undefined
  const toQuery = (init: Init): string | undefined => {
    if (init === undefined || init === null || typeof init === 'string') return init ?? undefined
    const pairs =
      typeof (init as Iterable<[string, string]>)[Symbol.iterator] === 'function'
        ? Array.from(init as Iterable<[string, string]>)
        : Object.entries(init)
    const params = new NativeURLSearchParams()
    for (const [name, value] of pairs) params.append(String(name), String(value))
    return params.toString()
  }
  class StandardURLSearchParams extends NativeURLSearchParams {
    constructor(init?: Init) {
      super(toQuery(init))
    }
  }
  Object.defineProperty(StandardURLSearchParams, 'name', { value: 'URLSearchParams' })
  ;(globalThis as { URLSearchParams?: unknown }).URLSearchParams = StandardURLSearchParams
}

/**
 * The native `URL` has no `searchParams`, but plugins routinely write
 * `url.searchParams.set(...)` (the bundled Aruba plugin does). This returns
 * one `URLSearchParams` per URL whose mutating methods write the query back
 * to `url.search`, and which is rebuilt if `url.search` is reassigned.
 */
if (!('searchParams' in URL.prototype)) {
  const MUTATORS = ['append', 'delete', 'set', 'sort'] as const
  const linked = new WeakMap<URL, { search: string; params: URLSearchParams }>()

  const link = (url: URL): { search: string; params: URLSearchParams } => {
    const params = new URLSearchParams(url.search)
    const entry = { search: url.search, params }
    for (const name of MUTATORS) {
      const original = URLSearchParams.prototype[name] as (...args: unknown[]) => unknown
      Object.defineProperty(params, name, {
        value: (...args: unknown[]) => {
          const result = original.apply(params, args)
          const query = params.toString()
          url.search = query ? `?${query}` : ''
          entry.search = url.search
          return result
        },
      })
    }
    linked.set(url, entry)
    return entry
  }

  Object.defineProperty(URL.prototype, 'searchParams', {
    configurable: true,
    enumerable: true,
    get(this: URL) {
      const entry = linked.get(this)
      return entry && entry.search === this.search ? entry.params : link(this).params
    },
  })
}
