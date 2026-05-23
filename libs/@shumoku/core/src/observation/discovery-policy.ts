// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Discovery-policy resolution: computes the *effective* policy at a
 * given node by merging the inheritance chain
 *
 *     runtime default → topology default → subgraph (nearest ancestor)
 *       → node override
 *
 * Nearest ancestor wins for nested subgraphs. Per-field merge — a
 * subgraph that only overrides `intervalMs` still inherits `mode`
 * from the topology default.
 *
 * Why a centralised helper:
 *   - The same logic runs server-side (scheduler, resolver, API
 *     responses) and client-side (badges, "Why this state?" modal).
 *     Drifting two implementations apart is a known source of bugs.
 *   - Codex's review explicitly called out
 *     "effective policy はフロントで都度推測せず、API が返す". This
 *     module is the single source of truth; the API just stringifies
 *     its output.
 */

import type {
  DiscoveryMode,
  DiscoveryPolicy,
  NetworkGraph,
  Node,
  Subgraph,
} from '../models/types.js'

/**
 * The fully-resolved policy actually applied at a node — every field
 * is concrete. Compare to `DiscoveryPolicy` whose fields are all
 * optional to support the merge chain.
 */
export interface EffectiveDiscoveryPolicy {
  mode: DiscoveryMode
  intervalMs: number
  /**
   * Where each field came from in the inheritance chain. Useful for
   * the "Inherits from: Subgraph X" hint in the node detail modal.
   */
  source: {
    mode: 'node' | 'subgraph' | 'topology' | 'default'
    intervalMs: 'node' | 'subgraph' | 'topology' | 'default'
  }
}

/**
 * Runtime fallbacks used when no layer of the chain supplies a value.
 *
 *   - `auto`: discovery is on by default — the system has to opt out
 *     intentionally, not in.
 *   - 30 minutes: matches what we 'd have used as the SNMP-source
 *     freshness budget before consolidation. Loose enough that a
 *     scheduled SNMP scan can comfortably catch up, tight enough that
 *     a missed re-poll surfaces inside an hour.
 */
const RUNTIME_DEFAULT: { mode: DiscoveryMode; intervalMs: number } = {
  mode: 'auto',
  intervalMs: 30 * 60 * 1000,
}

/** Input to `computeEffectivePolicy` — kept as a record so callers
 *  don 't have to construct a full `NetworkGraph` for unit tests. */
export interface PolicyContext {
  /** The node whose effective policy we want. Only `discovery` and
   *  `parent` are consulted. */
  node: Pick<Node, 'discovery' | 'parent'>
  /** Subgraph lookup, keyed by subgraph id. Used to walk ancestors. */
  subgraphs?: ReadonlyMap<string, Pick<Subgraph, 'parent' | 'discovery'>>
  /** Topology-wide default. */
  topologyDefault?: DiscoveryPolicy
}

export function computeEffectivePolicy(ctx: PolicyContext): EffectiveDiscoveryPolicy {
  // Walk node → ancestor subgraphs → topology default → runtime fallback.
  // The first layer to supply each field wins.
  const layers: Array<{
    origin: EffectiveDiscoveryPolicy['source']['mode']
    policy: DiscoveryPolicy | undefined
  }> = [{ origin: 'node', policy: ctx.node.discovery }]

  let currentParent: string | undefined = ctx.node.parent
  const seen = new Set<string>()
  while (currentParent && ctx.subgraphs?.has(currentParent) && !seen.has(currentParent)) {
    seen.add(currentParent)
    const sg = ctx.subgraphs.get(currentParent)
    layers.push({ origin: 'subgraph', policy: sg?.discovery })
    currentParent = sg?.parent
  }
  layers.push({ origin: 'topology', policy: ctx.topologyDefault })

  let mode: DiscoveryMode | undefined
  let modeOrigin: EffectiveDiscoveryPolicy['source']['mode'] | undefined
  let intervalMs: number | undefined
  let intervalOrigin: EffectiveDiscoveryPolicy['source']['intervalMs'] | undefined

  for (const layer of layers) {
    if (mode === undefined && layer.policy?.mode !== undefined) {
      mode = layer.policy.mode
      modeOrigin = layer.origin
    }
    if (intervalMs === undefined && layer.policy?.intervalMs !== undefined) {
      intervalMs = layer.policy.intervalMs
      intervalOrigin = layer.origin
    }
    if (mode !== undefined && intervalMs !== undefined) break
  }

  return {
    mode: mode ?? RUNTIME_DEFAULT.mode,
    intervalMs: intervalMs ?? RUNTIME_DEFAULT.intervalMs,
    source: {
      mode: modeOrigin ?? 'default',
      intervalMs: intervalOrigin ?? 'default',
    },
  }
}

/**
 * True when the node should NOT be auto-touched by the scheduler or
 * by any source's discovery pass — convenience predicate that hides
 * the mode comparison from callers that just need a yes/no answer.
 */
export function isExcluded(policy: EffectiveDiscoveryPolicy): boolean {
  return policy.mode === 'disabled'
}

/**
 * True when absence in a snapshot should be treated as evidence
 * (retract / mark stale). False when the snapshot 's absence is
 * meaningless because the node was deliberately not asked.
 *
 * This is the *critical* anti-footgun call codex flagged: if we
 * post-filter excluded nodes out of a NetBox snapshot whose status
 * is `ok` (= absence trusted), the resolver would happily interpret
 * the missing entry as "NetBox says it 's gone". We never want that.
 */
export function absenceImpliesRetraction(policy: EffectiveDiscoveryPolicy): boolean {
  return policy.mode === 'auto' || policy.mode === 'observe'
}

/**
 * Convenience: compute the effective discovery policy for a node in
 * the context of a full `NetworkGraph`. Walks the graph 's subgraphs
 * once into a lookup map, then delegates to `computeEffectivePolicy`.
 *
 * The resolver, the scheduler, and the API "GET effective policy for
 * this node" surface all need the same answer; they call this helper.
 */
export function effectivePolicyForNode(
  graph: Pick<NetworkGraph, 'subgraphs' | 'discovery'>,
  node: Pick<Node, 'discovery' | 'parent'>,
): EffectiveDiscoveryPolicy {
  const subgraphs = new Map<string, Pick<Subgraph, 'parent' | 'discovery'>>()
  for (const sg of graph.subgraphs ?? []) {
    subgraphs.set(sg.id, { parent: sg.parent, discovery: sg.discovery })
  }
  return computeEffectivePolicy({
    node,
    subgraphs,
    topologyDefault: graph.discovery,
  })
}
