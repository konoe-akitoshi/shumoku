// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NetworkGraph } from '@shumoku/core'

/**
 * Collect URL-form icons that need dimension or byte resolution.
 *
 * This utility is intentionally independent of the legacy SVG renderer so
 * canonical layout/render pipelines do not need to pull that implementation in.
 */
export function collectIconUrls(graph: NetworkGraph): string[] {
  const urls = new Set<string>()
  const isUrl = (icon: string | undefined): icon is string => !!icon && !icon.trim().startsWith('<')

  for (const node of graph.nodes) {
    if (isUrl(node.spec?.icon)) urls.add(node.spec.icon)
  }

  for (const subgraph of graph.subgraphs ?? []) {
    if (isUrl(subgraph.spec?.icon)) urls.add(subgraph.spec.icon)
  }

  return [...urls]
}
