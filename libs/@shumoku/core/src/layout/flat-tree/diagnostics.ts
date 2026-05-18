// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Input validation and engine diagnostics.
 *
 * The flat-tree engine accepts a `NetworkGraph` whose contents
 * may not be internally consistent — caller might pass a node
 * whose `parent` subgraph isn't declared, a link to a missing
 * node, a node with a missing size entry, etc. Rather than
 * silently swallowing these (the engine still produces *some*
 * output, but the caller has no way to notice the bug), we
 * collect `Diagnostic` entries and return them in the result.
 *
 * Severities:
 *   - **error** — invalid structure that prevented layout
 *     (currently nothing throws; reserved for the future).
 *   - **warning** — usable input but probably a bug in the
 *     caller (e.g. dangling subgraph parent).
 *   - **info** — non-critical engine decisions worth surfacing
 *     to users with `--verbose` editors (e.g. cycle break).
 */

import type { NetworkGraph } from '../../models/types.js'

export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  severity: DiagnosticSeverity
  code: string
  message: string
  /** Optional offending entity reference. */
  ref?: { kind: 'node' | 'subgraph' | 'link'; id: string }
}

/** Validate the input graph; return all problems found. */
export function validateGraph(graph: NetworkGraph): Diagnostic[] {
  const out: Diagnostic[] = []
  const nodeIds = new Set(graph.nodes.map((n) => n.id))
  const subgraphIds = new Set((graph.subgraphs ?? []).map((s) => s.id))

  // Duplicate node ids.
  const seen = new Set<string>()
  for (const n of graph.nodes) {
    if (seen.has(n.id)) {
      out.push({
        severity: 'warning',
        code: 'duplicate-node-id',
        message: `Node id '${n.id}' appears more than once. Later occurrences are ignored.`,
        ref: { kind: 'node', id: n.id },
      })
    }
    seen.add(n.id)
  }

  // Node referencing missing subgraph.
  for (const n of graph.nodes) {
    if (n.parent && !subgraphIds.has(n.parent)) {
      out.push({
        severity: 'warning',
        code: 'missing-subgraph-parent',
        message: `Node '${n.id}' references subgraph '${n.parent}' that isn't declared.`,
        ref: { kind: 'node', id: n.id },
      })
    }
  }

  // Subgraph parent loop / missing.
  for (const sg of graph.subgraphs ?? []) {
    if (sg.parent && !subgraphIds.has(sg.parent)) {
      out.push({
        severity: 'warning',
        code: 'missing-subgraph-parent',
        message: `Subgraph '${sg.id}' references parent subgraph '${sg.parent}' that isn't declared.`,
        ref: { kind: 'subgraph', id: sg.id },
      })
    }
  }

  // Link endpoints to missing nodes.
  for (const link of graph.links) {
    if (!nodeIds.has(link.from.node)) {
      out.push({
        severity: 'warning',
        code: 'link-endpoint-missing',
        message: `Link source node '${link.from.node}' is not declared.`,
      })
    }
    if (!nodeIds.has(link.to.node)) {
      out.push({
        severity: 'warning',
        code: 'link-endpoint-missing',
        message: `Link target node '${link.to.node}' is not declared.`,
      })
    }
  }

  // Self-loop links — accepted but worth surfacing.
  for (const link of graph.links) {
    if (link.from.node === link.to.node) {
      out.push({
        severity: 'info',
        code: 'self-loop',
        message: `Self-loop on node '${link.from.node}' — kept for rendering, ignored by layout.`,
      })
    }
  }

  return out
}

/**
 * Diagnostic for a node lookup that fell back to the default
 * size. Caller should provide explicit sizes; this records the
 * caller's omission so the editor can flag it.
 */
export function missingSizeDiagnostic(nodeId: string): Diagnostic {
  return {
    severity: 'warning',
    code: 'missing-node-size',
    message: `No size entry for node '${nodeId}' — used the engine's default. Provide an explicit size via the renderer's computeNodeFootprint.`,
    ref: { kind: 'node', id: nodeId },
  }
}

/** Diagnostic for cycle breaking. */
export function cycleBreakDiagnostic(nodeId: string): Diagnostic {
  return {
    severity: 'info',
    code: 'cycle-broken',
    message: `Primary-parent cycle through node '${nodeId}' was broken to keep the graph acyclic.`,
    ref: { kind: 'node', id: nodeId },
  }
}
