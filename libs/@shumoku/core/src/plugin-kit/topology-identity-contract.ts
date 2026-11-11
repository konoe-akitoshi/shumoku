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
 * Contract:
 *
 *   - Every node a topology plugin returns carries at least one attribute the device is
 *     recognized by: `address`, `chassisId`, `sysName` or `mac` on the node (the configuration's
 *     own fields), or a non-empty `vendorIds` entry in the node's observation (the source's own
 *     id). `sysName` is the name the device reports for itself, never a display string the
 *     operator typed (that is `label`; #581).
 *   - A port is recognized by its name, which is the interface name, so every port the node
 *     writes, every port a link end names and every port the observation describes carries a
 *     non-empty name. A port known only by its hardware address is named by that address.
 */

import type { SourceNetwork } from '../models/network-model.js'
import { nodeIdentityKeys } from '../observation/identity.js'

export interface TopologyIdentityContractResult {
  /** Node ids (node.id) with no attribute the device is recognized by. */
  nodesMissingIdentity: string[]
  /**
   * Ports (as `<node id>:<port name>`) whose name is empty: a port written on a node, named by
   * a link end or described in the observation with nothing to recognize it by.
   */
  portsMissingName: string[]
}

/**
 * Check whether what a topology plugin discovered satisfies the identity contract.
 *
 * Returns arrays of violating node / port ids. Both arrays empty → contract met.
 *
 * @param source What a TopologyCapable plugin's `fetchTopology()` returned
 *               (or an equivalent in-process fixture).
 */
export function validateTopologyIdentityContract(
  source: SourceNetwork,
): TopologyIdentityContractResult {
  const nodesMissingIdentity: string[] = []
  const portsMissingName: string[] = []
  const blank = (name: string) => name.trim() === ''

  for (const node of source.network.nodes) {
    const observed = source.observation?.nodes?.[node.id]
    if (nodeIdentityKeys({ ...node, vendorIds: observed?.vendorIds }).length === 0) {
      nodesMissingIdentity.push(node.id)
    }
    const names = [...(node.ports ?? []).map((p) => p.name), ...Object.keys(observed?.ports ?? {})]
    for (const name of names) {
      if (blank(name)) portsMissingName.push(`${node.id}:${name}`)
    }
  }
  for (const link of source.network.links) {
    for (const end of link.endpoints) {
      if ('node' in end && end.port !== undefined && blank(end.port)) {
        portsMissingName.push(`${end.node}:${end.port}`)
      }
    }
  }

  return { nodesMissingIdentity, portsMissingName }
}
