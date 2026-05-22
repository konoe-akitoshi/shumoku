// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Default DeviceType / NodeSpec.kind → semantic tier table.
 *
 * Tiers are integers on a sparse 0-100 scale. Lower = closer to the
 * top of the diagram (closer to the WAN / external boundary). The
 * sparse spacing lets future role variants slot between existing
 * tiers without renumbering — e.g. an "edge router" sub-role could
 * sit at 25 between Router (20) and L3Switch (30).
 *
 * Network engineers' mental model from the conventional Cisco 3-tier
 * design plus modern variations:
 *
 *   0  : External / Internet — what data enters from
 *   10 : VPN concentrators, edge tunnels (still external-facing)
 *   20 : Routers — Layer 3 boundary
 *   30 : L3 switches — distribution layer
 *   40 : L2 switches, console servers — access layer
 *   50 : APs, CPEs — wireless / customer-edge
 *   60 : Generic / unspecified hardware (weakly biased)
 *   70 : Servers, databases, storage — endpoints
 *   80 : Compute — VMs / containers
 *   90 : Cloud services
 *
 * Status: This table is staged for future integration. Today's
 * layout (Buchheim tidy-tree) already produces a reasonable tier
 * ordering from topology depth alone; we only need this table when
 * topology is ambiguous (e.g. a server that's both a client and a
 * router in different contexts) or when the user wants the
 * placement to override topology. See `auto-layout-redesign.md §11`
 * and `auto-layout-implementation-plan.md §8.1` for the broader
 * plan.
 */

import { DeviceType, type NodeSpec } from '../models/types.js'

export interface TierHint {
  /** Tier on the sparse 0-100 scale. Lower = closer to top of diagram. */
  tier: number
  /**
   * How strongly to apply this hint:
   *
   *   `soft`     — topology dominates; tier only biases ambiguous cases (default for inferred tiers)
   *   `normal`   — tier and topology weighted comparably
   *   `strong`   — tier dominates unless topology directly contradicts
   *   `pinned`   — absolute; conflicts surface in diagnostics rather than getting silently demoted
   */
  strength: 'soft' | 'normal' | 'strong' | 'pinned'
  /** Where this hint came from — for diagnostics / debug overlays. */
  source: 'device-type' | 'service' | 'compute' | 'fallback'
}

/**
 * Default DeviceType → tier mapping. Lookups against this table are
 * `soft` strength because the table is opinionated and may not match
 * every deployment's intent.
 */
export const DEVICE_TYPE_TIER: Readonly<Record<DeviceType, number>> = Object.freeze({
  [DeviceType.Cloud]: 0,
  [DeviceType.Internet]: 0,
  [DeviceType.VPN]: 10,
  [DeviceType.Firewall]: 15,
  [DeviceType.LoadBalancer]: 18,
  [DeviceType.Router]: 20,
  [DeviceType.L3Switch]: 30,
  [DeviceType.L2Switch]: 40,
  [DeviceType.ConsoleServer]: 40,
  [DeviceType.Server]: 70,
  [DeviceType.Database]: 70,
  [DeviceType.AccessPoint]: 50,
  [DeviceType.CPE]: 50,
  // Synthetic L2 segment from subnet inference — same tier as a
  // physical L2 switch since that 's what it stands in for.
  [DeviceType.Segment]: 40,
  [DeviceType.Generic]: 60,
})

/**
 * Resolve a tier hint for a node spec. Returns `null` when the spec
 * carries no information at all — in that case the caller should
 * fall back to topology-derived tiering.
 *
 * Resolution order:
 *   1. `hardware` spec with known DeviceType → table lookup, `soft`
 *   2. `hardware` spec with unknown type     → fallback tier 60, `soft`
 *   3. `compute` spec (VM / container)        → tier 80, `soft`
 *   4. `service` spec (cloud service)         → tier 90, `soft`
 *
 * Future resolvers (layoutIntent override, role-from-name inference,
 * HA-group pairing) compose ahead of this one — see the resolver
 * chain in the implementation plan.
 */
export function resolveTierFromSpec(spec: NodeSpec | undefined): TierHint | null {
  if (!spec) return null
  switch (spec.kind) {
    case 'hardware': {
      const type = spec.type
      if (type && type in DEVICE_TYPE_TIER) {
        return { tier: DEVICE_TYPE_TIER[type], strength: 'soft', source: 'device-type' }
      }
      return { tier: 60, strength: 'soft', source: 'fallback' }
    }
    case 'compute':
      return { tier: 80, strength: 'soft', source: 'compute' }
    case 'service':
      return { tier: 90, strength: 'soft', source: 'service' }
  }
}
