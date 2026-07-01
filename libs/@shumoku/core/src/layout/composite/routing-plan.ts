// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { LayoutProblem, RoutingGrammar } from '../problem.js'
import type { ResolvedEdge } from '../resolved-types.js'
import type { CompositeLayoutResult } from './index.js'
import { pairKey } from './index.js'

export interface CompositeRoutingPlan {
  /** Couplings render as bridge notation and skip wire routing/scoring. */
  couplingEdges: Set<string>
  /** Parent id -> edge ids allowed to use shared comb bus grammar. */
  combs: Map<string, string[]>
  /** Edge ids allowed to use same-tier lateral ramp grammar. */
  rampEdges: Set<string>
  /** Edge ids allowed to use long through-traffic gutter grammar. */
  gutterEdges: Set<string>
}

export function buildCompositeRoutingPlan(
  problem: LayoutProblem,
  comp: CompositeLayoutResult,
  edges: ReadonlyMap<string, ResolvedEdge>,
): CompositeRoutingPlan {
  const intentById = new Map(problem.routingIntents.map((intent) => [intent.linkId, intent]))
  const allows = (edge: ResolvedEdge, grammar: RoutingGrammar): boolean =>
    intentById.get(edge.id)?.allowedGrammars.includes(grammar) === true
  const plan: CompositeRoutingPlan = {
    couplingEdges: new Set<string>(),
    combs: new Map<string, string[]>(),
    rampEdges: new Set<string>(),
    gutterEdges: new Set<string>(),
  }

  for (const edge of edges.values()) {
    if (
      allows(edge, 'coupling-bridge') ||
      comp.heartbeats.has(pairKey(edge.fromNodeId, edge.toNodeId))
    ) {
      plan.couplingEdges.add(edge.id)
      continue
    }
    if (allows(edge, 'lateral-ramp')) plan.rampEdges.add(edge.id)
    if (allows(edge, 'long-gutter')) plan.gutterEdges.add(edge.id)
    if (!allows(edge, 'comb-bus')) continue
    const da = comp.depths.get(edge.fromNodeId)
    const db = comp.depths.get(edge.toNodeId)
    if (da === undefined || db === undefined || da === db) continue
    const parent = da < db ? edge.fromNodeId : edge.toNodeId
    const list = plan.combs.get(parent) ?? []
    list.push(edge.id)
    plan.combs.set(parent, list)
  }

  for (const [parent, list] of plan.combs) {
    if (list.length < 2) plan.combs.delete(parent)
  }
  return plan
}
