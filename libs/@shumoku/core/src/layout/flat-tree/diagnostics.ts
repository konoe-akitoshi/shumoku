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
export function cycleBreakDiagnostic(nodeId: string, cycle: readonly string[]): Diagnostic {
  return {
    severity: 'info',
    code: 'cycle-broken',
    message: `Primary-parent cycle through [${cycle.join(' → ')}] was broken by dropping the parent edge of node '${nodeId}' (lexically-last member of the cycle).`,
    ref: { kind: 'node', id: nodeId },
  }
}

/**
 * Why a node ended up in a particular block. Most cases are
 * structural (one block per single-emitter subgraph, etc.) but
 * non-emitter joins to the nearest emitter ancestor are worth
 * surfacing when debugging a multi-emitter subgraph's split.
 */
export function blockJoinDiagnostic(
  nodeId: string,
  blockId: string,
  reason:
    | 'top-level-singleton'
    | 'single-emitter-subgraph'
    | 'emitter-of-multi-emitter-subgraph'
    | 'non-emitter-joined-nearest-emitter',
): Diagnostic {
  return {
    severity: 'info',
    code: 'block-join',
    message: `Node '${nodeId}' joined block '${blockId}' (reason: ${reason}).`,
    ref: { kind: 'node', id: nodeId },
  }
}

/**
 * Why a sibling-block sort ordering was chosen. Emitted at most
 * once per parent block whose children were sorted.
 *
 * Reasons:
 *
 *   - `source-port-label` — at least one pair was decided by
 *     the parent's source-port label sequence (the primary
 *     intended signal).
 *   - `port-label-absent-fallback` — every sibling pair tied
 *     on port labels (all-equal or all-null). Sort fell back
 *     to subgraph-clustering + lexical id. The diagnostic
 *     surfaces this so an editor / harness can flag fixtures
 *     where the engine had no primary signal to rely on.
 *   - `id-tiebreaker` — deprecated; emitted by the previous
 *     diagnostics PR. New runs use `source-port-label` or
 *     `port-label-absent-fallback`.
 *   - `singleton` — only one child; ordering is vacuous.
 */
export function siblingOrderDiagnostic(
  parentBlockId: string,
  reason: 'source-port-label' | 'port-label-absent-fallback' | 'id-tiebreaker' | 'singleton',
  order: readonly string[],
): Diagnostic {
  return {
    severity: 'info',
    code: 'sibling-order',
    message: `Sibling blocks under '${parentBlockId}' ordered by ${reason}: [${order.join(', ')}].`,
  }
}

/**
 * Spine alignment shifted a child block onto its same-subgraph
 * parent's x column. Useful when investigating "why is this
 * subgraph rendering as a narrow strip?" — when present, it's
 * working as designed; when absent for a vertical-strip case,
 * the spine detection missed.
 */
export function spineAlignedDiagnostic(
  parentBlockId: string,
  childBlockId: string,
  subgraphId: string,
  shift: number,
): Diagnostic {
  return {
    severity: 'info',
    code: 'spine-aligned',
    message: `Spine alignment pulled block '${childBlockId}' onto x of '${parentBlockId}' (subgraph '${subgraphId}', shift ${shift.toFixed(1)}px).`,
    ref: { kind: 'subgraph', id: subgraphId },
  }
}
