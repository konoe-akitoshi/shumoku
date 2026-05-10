// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Pure helpers that translate a Product's port snapshot into Node ports.
 *
 * These live outside `context.svelte.ts` so they can be unit-tested in
 * isolation. They never read the live catalog — that's the job of the
 * snapshot helpers in `context.svelte.ts`. By the time these run, the
 * Product already carries its own catalog-derived `ports` array.
 */

import { type NodePort, newId } from '@shumoku/core'
import type { DeviceProduct } from '../types'

function productPortTemplates(product: DeviceProduct | undefined): readonly NodePort[] {
  return product?.ports ?? []
}

/**
 * First-time port instantiation from a Product's snapshot. Each port
 * gets a fresh node-side id so multiple placements of the same Product
 * have distinct port handles.
 */
export function instantiatePortsFromProduct(
  product: DeviceProduct | undefined,
): NodePort[] | undefined {
  const tpl = productPortTemplates(product)
  if (tpl.length === 0) return undefined
  return tpl.map((p) => ({ ...p, id: newId('port') }))
}

/**
 * Merge a Product's port snapshot into an existing port list, preserving
 * every existing port's `id` and user-edited `label`. Product-owned
 * physical attributes (`connectors`, `speed`, `poe`, `interfaceName`,
 * `faceplateLabel`) are refreshed from the snapshot.
 *
 * Match key: `interfaceName` first (most stable), else exact label
 * match against the snapshot's default label. Ports that don't match
 * any template (user-added customs or stale catalog ports) are
 * appended at the end so links keep resolving.
 */
export function mergeProductPortsIntoExisting(
  existing: readonly NodePort[],
  product: DeviceProduct | undefined,
): NodePort[] {
  const tpl = productPortTemplates(product)
  if (tpl.length === 0) return [...existing]

  const usedIds = new Set<string>()
  const merged: NodePort[] = []

  for (const t of tpl) {
    const match = existing.find((e) => {
      if (usedIds.has(e.id)) return false
      if (t.interfaceName && e.interfaceName === t.interfaceName) return true
      if (e.label && t.label && e.label === t.label) return true
      return false
    })
    if (match) {
      usedIds.add(match.id)
      merged.push({
        ...match,
        // Product-owned physical attributes refresh; user label stays.
        speed: t.speed ?? match.speed,
        connectors: t.connectors ?? match.connectors,
        poe: t.poe ?? match.poe,
        interfaceName: t.interfaceName ?? match.interfaceName,
        faceplateLabel: t.faceplateLabel ?? match.faceplateLabel,
        role: t.role ?? match.role,
        aliases: t.aliases ?? match.aliases,
      })
    } else {
      merged.push({ ...t, id: newId('port') })
    }
  }
  // Surface any existing ports the snapshot didn't claim (user-added
  // custom ports, or template ports that disappeared) so links don't
  // go orphan.
  for (const e of existing) {
    if (!usedIds.has(e.id)) merged.push(e)
  }
  return merged
}
