// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node } from '@shumoku/core'
import type { Product } from '../types'

// Products store — pure list, no diagram-side cleanup. Composer
// handles cross-store consequences (clearing node/link bindings on
// product remove etc.) since those reach into diagram state.

const productsState = $state({ list: [] as Product[] })

export const productsStore = {
  get list(): Product[] {
    return productsState.list
  },
  set(list: Product[]) {
    productsState.list = list
  },
  add(entry: Product) {
    productsState.list = [...productsState.list, entry]
  },
  remove(id: string) {
    productsState.list = productsState.list.filter((p) => p.id !== id)
  },
  update(id: string, updates: Partial<Product>) {
    productsState.list = productsState.list.map((p) =>
      p.id === id ? ({ ...p, ...updates } as Product) : p,
    )
  },
  find(id: string): Product | undefined {
    return productsState.list.find((p) => p.id === id)
  },
}

/**
 * Reconcile imported products + their references on the diagram.
 * Diagram-side `productId` references (Node / LinkModule / LinkCable)
 * are cleared when the referenced product is gone. Returns the
 * cleaned list and link array — caller writes them back into state.
 */
export function sanitizeProducts(
  rawProducts: Product[],
  nodes: Map<string, Node>,
  links: Link[],
): { products: Product[]; links: Link[] } {
  const productIds = new Set<string>()
  const cleanProducts: Product[] = []
  let duplicates = 0
  for (const entry of rawProducts) {
    if (productIds.has(entry.id)) {
      duplicates++
      continue
    }
    productIds.add(entry.id)
    cleanProducts.push(entry)
  }
  if (duplicates > 0) {
    console.warn(`[import] dropped ${duplicates} duplicate product id(s)`)
  }

  let clearedNodes = 0
  for (const [id, node] of nodes) {
    if (node.productId && !productIds.has(node.productId)) {
      nodes.set(id, { ...node, productId: undefined })
      clearedNodes++
    }
  }
  if (clearedNodes > 0) {
    console.warn(`[import] cleared ${clearedNodes} node(s) with unknown productId`)
  }

  let clearedLinks = 0
  const cleanLinks = links.map((link) => {
    let next = link
    for (const side of ['from', 'to'] as const) {
      const mod = next[side].plug?.module
      if (mod?.productId && !productIds.has(mod.productId)) {
        const { productId: _drop, ...rest } = mod
        next = {
          ...next,
          [side]: { ...next[side], plug: { ...(next[side].plug ?? {}), module: rest } },
        }
        clearedLinks++
      }
    }
    if (next.cable?.productId && !productIds.has(next.cable.productId)) {
      const { productId: _drop, ...rest } = next.cable
      next = { ...next, cable: rest }
      clearedLinks++
    }
    return next
  })
  if (clearedLinks > 0) {
    console.warn(`[import] cleared ${clearedLinks} link product reference(s)`)
  }

  return { products: cleanProducts, links: cleanLinks }
}
