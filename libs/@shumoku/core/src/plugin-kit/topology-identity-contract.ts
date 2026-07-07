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
 *   - A port with NO port-identity key (ifName/ifIndex/mac — absent and empty
 *     identity objects are equivalent) is fine: ingest stamps
 *     `ifName = port.id` (port ids ARE interface names by convention).
 *   - A port that DOES carry a port key but lacks ifName is flagged: the store
 *     keeps it as-is and it anchors weakly (ifIndex renumbers across reboots).
 */

import type { NetworkGraph } from '../models/types.js'

export interface TopologyIdentityContractResult {
  /** Node ids (node.id) that have no network identity key at all. */
  nodesMissingIdentity: string[]
  /**
   * Port ids that carry a PORT-identity key (ifIndex or mac) but no ifName.
   *
   * The server's fallback (`portIdentityWithIfNameFallback`, contribution-store)
   * fills `ifName = portId` ONLY when a port has none of ifName/ifIndex/mac —
   * an absent OR empty identity object both qualify. A port with ifIndex/mac
   * but no ifName is left as-is by the store and anchors weakly (ifIndex is a
   * last-resort key that renumbers across reboots), so the contract flags it:
   * plugins should provide the interface name whenever they enumerate ports.
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

  for (const node of graph.nodes ?? []) {
    // A node must have at least one identity key.
    if (!hasAnyIdentityKey(node.identity)) {
      nodesMissingIdentity.push(node.id)
    }

    // Mirror the server's ingest EXACTLY (portIdentityWithIfNameFallback):
    // fallback-eligible means the port has NO port-identity key at all —
    // `identity` absent and `identity: {}` are equivalent, both get
    // `ifName = portId` stamped on ingest, so neither is a violation.
    // Only a port that DOES carry a port key (ifIndex / mac) without ifName is
    // flagged: the store keeps it as-is and it anchors weakly.
    for (const port of node.ports ?? []) {
      const id = port.identity
      const hasPortKey = !!(id && (id.ifName || id.ifIndex !== undefined || id.mac))
      if (!hasPortKey) continue // store defaults ifName = port.id on ingest
      if (!id?.ifName) {
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
