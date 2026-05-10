// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Shared label-extraction helpers — `Node.label` can be string,
// string[], or absent, and almost every page that surfaces a node
// in human form needs the same "first label or fall back to id"
// rule. Centralizing here keeps the format uniform across the app
// and avoids the four copies that drifted apart.

interface Labelable {
  id: string
  label?: string | string[]
}

/**
 * Display label for a node-like value: first entry of the array,
 * the string itself, or the id as a last resort. Pass `undefined`
 * + an explicit `fallbackId` for lookup-failed cases.
 */
export function nodeDisplayLabel(node: Labelable | undefined, fallbackId = ''): string {
  if (!node) return fallbackId
  if (Array.isArray(node.label)) return node.label[0] ?? node.id
  return node.label ?? node.id
}
