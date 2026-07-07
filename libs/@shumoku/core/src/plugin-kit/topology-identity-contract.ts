// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * topology-identity-contract.ts
 *
 * Validator that enforces the plugin identity contract for topology-emitting
 * plugins. This is the host-branch-guard-style enforcement called for in #569:
 * a helper + assertions, not a framework.
 *
 * Contract (derived from Phase 0's `portIdentityWithIfNameFallback` in
 * contribution-store.ts and the entity-registry Phase 1 design):
 *
 *   - Every node in a topology graph must carry at least one network identity
 *     key (mgmtIp, chassisId, sysName, or a non-empty vendorIds entry).
 *   - Every port that either (a) carries an `identity` field, or (b) is
 *     referenced as a link endpoint, must have `identity.ifName` OR use a port
 *     id that itself IS the interface name (the contribution-store fallback
 *     accepts a port id used as ifName, so we mirror that leniency here).
 */

import type { NetworkGraph } from '../models/types.js'

export interface TopologyIdentityContractResult {
  /** Node ids (node.id) that have no network identity key at all. */
  nodesMissingIdentity: string[]
  /**
   * Port ids that are referenced by a link endpoint or carry an identity field
   * but lack identity.ifName AND cannot be treated as an interface name via the
   * id-as-ifName fallback.
   *
   * The fallback: contribution-store's `portIdentityWithIfNameFallback` fills
   * `ifName = portId` when a port has no identity key. We mirror that: a port
   * counts as "ok" when it either has `identity.ifName` explicitly, or when its
   * id has no identity at all (the store will default it). A port with a
   * non-ifName identity key (ifIndex, mac) but no ifName is flagged so callers
   * can verify the store will still anchor it.
   */
  portsMissingIfName: string[]
}

/**
 * Check whether `graph` satisfies the topology identity contract.
 *
 * Returns arrays of violating node/port ids. Both arrays empty → contract met.
 *
 * @param graph A NetworkGraph returned by a TopologyCapable plugin's
 *              `fetchTopology()` (or an equivalent in-process fixture).
 */
export function validateTopologyIdentityContract(
  graph: NetworkGraph,
): TopologyIdentityContractResult {
  const nodesMissingIdentity: string[] = []
  const portsMissingIfName: string[] = []

  // --- 1. Collect all port ids referenced by link endpoints. -----------------
  const linkedPortIds = new Set<string>()
  for (const link of graph.links ?? []) {
    if (link.from.port) linkedPortIds.add(link.from.port)
    if (link.to.port) linkedPortIds.add(link.to.port)
  }

  // --- 2. Validate each node and its ports. ----------------------------------
  for (const node of graph.nodes ?? []) {
    // A node must have at least one identity key.
    if (!hasAnyIdentityKey(node.identity)) {
      nodesMissingIdentity.push(node.id)
    }

    // Check ports that are either link-endpoint-referenced or carry an explicit
    // identity.  A port with NO identity field at all is fine: the contribution
    // store will default `ifName = portId` via portIdentityWithIfNameFallback.
    for (const port of node.ports ?? []) {
      const isLinked = linkedPortIds.has(port.id)
      const hasIdentity = port.identity !== undefined

      if (!isLinked && !hasIdentity) {
        // Not linked, no identity field — no concern; store will default on ingest.
        continue
      }

      // Linked or has explicit identity → must have ifName (or no identity at all,
      // relying on the store's id-as-ifName fallback).
      if (!hasIdentity) {
        // No identity field; store will fill ifName from id. Count as ok.
        continue
      }

      // Has an identity field but no ifName — flag it.
      if (!port.identity?.ifName) {
        portsMissingIfName.push(port.id)
      }
    }
  }

  return { nodesMissingIdentity, portsMissingIfName }
}

// ---------------------------------------------------------------------------
// Internal helpers

/** True when `identity` has at least one populated key that identifies a device. */
function hasAnyIdentityKey(identity: NetworkGraph['nodes'][number]['identity']): boolean {
  if (!identity) return false
  if (identity.mgmtIp) return true
  if (identity.chassisId) return true
  if (identity.sysName) return true
  if (identity.ifName) return true
  if (identity.mac) return true
  if (identity.ifIndex !== undefined) return true
  const vendorIds = identity.vendorIds
  if (vendorIds) {
    for (const v of Object.values(vendorIds)) {
      if (v) return true
    }
  }
  return false
}
