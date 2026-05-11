// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Saved before `Product.icon` got auto-populated at add time, some
// catalog-bound products landed in IDB with `icon: undefined`. Inherit
// from the catalog at load — once, idempotent, never overwrites a
// user-set icon. Products with no `catalogId` are skipped.
//
// Pure transform on a single Product. The applyProject loop runs this
// alongside `ensureProductSnapshot` (catalog port template
// materialization) which stays in context.svelte.ts because it's also
// used by `addProduct` — not load-only.

import type { Catalog } from '@shumoku/catalog'
import type { Product } from '../types'

export function inheritProductIconFromCatalog(product: Product, catalog: Catalog): Product {
  if (product.icon) return product
  if (!product.catalogId) return product
  const entry = catalog.lookup(product.catalogId)
  if (!entry?.icon) return product
  return { ...product, icon: entry.icon }
}
