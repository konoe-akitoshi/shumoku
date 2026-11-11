// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku Data Models
 * Network diagram support with Mermaid-like syntax
 */

// ============================================
// Icon Dimensions
// ============================================

/** Icon dimensions for aspect ratio calculation */
export interface IconDimensions {
  width: number
  height: number
}

// ============================================
// Observation Model — provenance & identity
// ============================================

/**
 * Where a node / link / port / group value came from, in the observation record kept beside a
 * model (`ObservationLayer`). A source's contribution may stamp its `<sourceId>` here; the merge
 * (`resolveNetwork`) fills `state` when folding contributions. It is never part of a drawn
 * graph. See `apps/server/docs/design/topology-foundation*.md` for the full design.
 *
 * `source` is an open string (not a union) so external plugins can
 * supply their own identifier without core edits — same regime as
 * `Alert.source` (see `@shumoku/core/plugin-types.ts`).
 */
export interface Provenance {
  /**
   * Source identifier. `'intrinsic'` is the reserved value for the project's own
   * contribution (the topology's intrinsic, project-owned assertions — what the
   * editor writes). It is NOT a "human" layer: it's the ownership/lifecycle
   * distinction (intrinsic vs external feed), the only one the model keeps. Any
   * other value is an external source id (open string, like `Alert.source`).
   */
  source: string
  /**
   * Set by the resolver. Snapshots leave this undefined.
   * - `intrinsic-only`: only the project's own contribution asserts it
   * - `discovered-only`: only external feed(s) assert it
   * - `confirmed`: both
   * - `conflicting`: external feeds disagree (no intrinsic value to settle it)
   */
  state?: 'confirmed' | 'intrinsic-only' | 'discovered-only' | 'conflicting'
  /** Unix ms — when the source observed this value. */
  observedAt?: number
}

/**
 * The keys a hosts or metrics source reports for a host or one of its interfaces, so a node or a
 * port of the configuration can be matched to it: a host's `mgmtIp` is matched against a node's
 * `address`, `chassisId` / `sysName` / `mac` against the node's own; an interface's `ifName`
 * against a port's name, `mac` against its `mac`. Not part of a network: what identifies a
 * device in the network is written on the node itself (`inputModel.Node`), and a source's own
 * identifiers ride in its observation (`NodeObservation.vendorIds`, `PortObservation.ifIndex`).
 */
export interface Identity {
  /** Management IP (v4 or v6 as a string). */
  mgmtIp?: string
  /** LLDP chassisId (MAC or vendor string). */
  chassisId?: string
  /** SNMP sysName. */
  sysName?: string
  /** ifIndex, the SNMP agent's numbering of the interface. */
  ifIndex?: number
  /** ifName ("GigabitEthernet1/0/1"). */
  ifName?: string
  /** Interface MAC, or the device's own. */
  mac?: string
  /** Source-specific identifiers, e.g. `{ 'netbox-device-id': '42' }`. */
  vendorIds?: Record<string, string>
}

// ============================================
// Entity Identity Branding
// ============================================

/**
 * Stable entity id minted by the server-side entity registry (ULID).
 * Branded so element-id strings can't silently flow into entity-keyed
 * storage. Construct only at trust boundaries via `asEntityId`.
 *
 * Trust boundaries:
 *   - Mint: `generateUlid()` in entity-registry.ts
 *   - DB read: row-cast helper in services/topology.ts
 *   - HTTP param: route boundary with DB-lookup validation
 *   - Tests: fixture literals
 */
export type EntityId = string & { readonly __entityId: unique symbol }

/**
 * Trust-boundary cast — DB reads, registry mint, wire-format parse.
 * Use ONLY at: mint, DB row reads, HTTP param boundaries, and tests.
 * If you find yourself casting mid-logic, fix the signature above you instead.
 */
export function asEntityId(id: string): EntityId {
  return id as EntityId
}

// ============================================
// Node Types
// ============================================

export type NodeShape =
  | 'rect' // Rectangle [text]
  | 'rounded' // Rounded rectangle (text)
  | 'circle' // Circle ((text))
  | 'diamond' // Diamond {text}
  | 'hexagon' // Hexagon {{text}}
  | 'cylinder' // Database cylinder [(text)]
  | 'stadium' // Stadium/pill shape ([text])
  | 'trapezoid' // Trapezoid [/text/]

export interface NodeStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  textColor?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  opacity?: number
}

// ============================================
// Physical / logical node ports
// ============================================

export type PortRole = 'downlink' | 'uplink' | 'wan' | 'lan' | 'management' | 'power' | 'console'

export type PortConnector = 'rj45' | 'sfp' | 'sfp+' | 'sfp28' | 'qsfp+' | 'qsfp28' | (string & {})

export type LinkMediumKind = 'twisted-pair' | 'fiber' | 'dac' | 'aoc' | (string & {})

export type FiberMode = 'singlemode' | 'multimode' | (string & {})

/**
 * Installed cable grade. Twisted-pair gets cat5e/6/6a/7/8; multi-mode
 * fiber gets OM3/4/5; single-mode gets OS1/2; DAC and AOC are passive
 * cable assemblies that don't have a separate grade axis but get their
 * own values so the field is one source of truth.
 */
export type CableGrade =
  | 'cat5e'
  | 'cat6'
  | 'cat6a'
  | 'cat7'
  | 'cat8'
  | 'om3'
  | 'om4'
  | 'om5'
  | 'os1'
  | 'os2'
  | 'dac'
  | 'aoc'

/**
 * Cable medium kind, split to distinguish multi-mode and single-mode
 * fiber (they have different reach characteristics and connector
 * conventions). Stored explicitly on `LinkCable.medium` so the user
 * can declare "fiber multi-mode" before picking a specific OM grade.
 */
export type CableMedium = 'twisted-pair' | 'fiber-mm' | 'fiber-sm' | 'dac' | 'aoc'

/**
 * Cable-end connector (the physical thing at the cable's tip), e.g.
 * "lc" / "sc" / "mpo" for fiber, "rj45" for twisted-pair.
 *
 * Not stored on `LinkCable` directly — it's derived from
 * `module.standard` via `STANDARD_SPECS[std].cableConnector`. Kept as a
 * type for derivation helpers and display logic.
 */
export type CableConnector = 'rj45' | 'lc' | 'sc' | 'mpo' | (string & {})

/**
 * A node-side receptacle (cage). Ports belong to a Node and define the
 * physical slot a cable plug can be inserted into. The cage type
 * (e.g. "sfp+") describes what kind of plug is accepted; the actual
 * plug carrying the connection is owned by the Link endpoint.
 *
 * Detailed PoE info (class, budget, per-port wattage, PSE/PD role)
 * lives on the catalog's `PowerProperties.poe_in` / `poe_out`, not
 * here — `NodePort.poe` is just the per-port capability flag derived
 * from the catalog's `PortGroup.poe`.
 */
/**
 * The observation record of a port: what a source said of it beyond the configuration, and what
 * the merge of sources adds. A port is recognized across sources by its name (the interface
 * name) and its `mac`, both written in the configuration; this record holds the rest.
 */
export interface PortObservation {
  /**
   * Observation provenance (which source last asserted this port).
   * See `Provenance` type. Optional — omitted on hand-authored ports.
   */
  provenance?: Provenance
  /**
   * The SNMP agent's number for the interface, as the source read it. An agent may renumber
   * across reboots, so it is the source's own identifier, not a fact of the configuration.
   */
  ifIndex?: number
  /**
   * Access / policy / metrics-binding attachments on this port. Link metric
   * bindings (`kind: 'metrics-binding'`) live here, keyed by port name, so
   * the resolver folds them across re-scans like node attachments. See
   * `Attachment` and `attachmentKey`.
   */
  attachments?: Attachment[]
  /**
   * Attachment keys (see `attachmentKey`) the human explicitly removed — the
   * port-level counterpart to `Node.suppressedAttachments`. Survives re-scan so
   * a re-supplied binding won't resurrect a deleted one.
   */
  suppressedAttachments?: string[]
  /**
   * Stable entity id from the server-side entity registry; absent for
   * graphs not resolved through it.
   */
  entityId?: EntityId
}

/**
 * A port as drawn: its name and what is known of the receptacle (the configuration's `Port`).
 * A port's id is its name, which a link end writes. What the sources said of it is not here:
 * that is the observation record kept beside the model.
 */
export interface NodePort {
  /** The port's name, as the device calls it and a link end writes it. */
  id: string
  /** Display/canonical port label, e.g. "Gi1/0/1", "ge-0/0/0", "wan". May be empty. */
  label: string
  /** Physical faceplate marking, e.g. "1". Defaults to `label`. */
  faceplateLabel?: string
  /** Full OS/API interface name, e.g. "GigabitEthernet1/0/1". */
  interfaceName?: string
  /** Alternative names accepted for matching/search. */
  aliases?: string[]
  role?: PortRole | (string & {})
  /** Cage's nominal max speed label, e.g. "1g", "10g". */
  speed?: string
  /**
   * Physical receptacles available on this port. Length 1 = single
   * connector. Length ≥ 2 = combo (e.g. shared RJ45 + SFP slot, only
   * one in use at a time). Empty array = unknown / permissive.
   */
  connectors: PortConnector[]
  /** Whether this port can source PoE (RJ45 only). Capability flag only —
   * detailed class / wattage / role lives on the device's catalog
   * `PowerProperties` (poe_in / poe_out). */
  poe?: boolean
  source?: 'catalog' | 'custom'
  /** The port's hardware address (the configuration's `Port.mac`). */
  mac?: string
  notes?: string
}

/**
 * Bandwidth label/value used by plugin configs and metric overrides.
 * Distinct from `Link.standard` — this is just a parseable bandwidth
 * string ("10G", "2.5Gbps") or raw bps number, suitable wherever a
 * single capacity number is expected (e.g. plugin overrides, runtime
 * metrics). Use `resolveBandwidthBps` to convert to bits/sec.
 */
export type LinkBandwidthLabel =
  | '10M'
  | '100M'
  | '1G'
  | '2.5G'
  | '5G'
  | '10G'
  | '25G'
  | '40G'
  | '50G'
  | '100G'
  | '200G'
  | '400G'

export type LinkBandwidth = number | LinkBandwidthLabel | (string & {})

/**
 * IEEE 802.3 / industry standard identifying the link spec. Picking one
 * cascades down to speed, required cage, cable medium, and reach via the
 * `STANDARD_SPECS` registry — see `core/models/standards.ts`. Unknown /
 * vendor-proprietary values are accepted as plain strings; the registry
 * lookup just returns undefined and downstream code falls back to neutral
 * defaults.
 */
export type EthernetStandard =
  // Twisted-pair (RJ45 cage)
  | '10BASE-T'
  | '100BASE-TX'
  | '1000BASE-T'
  | '2.5GBASE-T'
  | '5GBASE-T'
  | '10GBASE-T'
  // Fiber multi-mode (short reach, OM3/OM4)
  | '1000BASE-SX'
  | '10GBASE-SR'
  | '25GBASE-SR'
  | '40GBASE-SR4'
  | '100GBASE-SR4'
  // Fiber single-mode (long reach)
  | '1000BASE-LX'
  | '10GBASE-LR'
  | '25GBASE-LR'
  | '40GBASE-LR4'
  | '100GBASE-LR4'
  // Direct attach copper (passive twinax cable assemblies)
  | '10GBASE-CR'
  | '25GBASE-CR'
  | '40GBASE-CR4'
  | '100GBASE-CR4'
  // Active optical cable assemblies (SFP/QSFP cage, integrated optics)
  | '10G-AOC'
  | '25G-AOC'
  | '40G-AOC'
  | '100G-AOC'
  | (string & {})

// ============================================
// Node Spec — discriminated union by `kind`
// ============================================

/**
 * Shared fields across all spec kinds.
 */
export interface SpecBase {
  /**
   * Icon to render for this node — either inline SVG content
   * (`<path .../>` or `<svg ...>...</svg>`) or a URL. Producers
   * (editor / catalog import) snapshot this from `Product.icon`;
   * renderers fall back to a generic device-type icon when empty.
   */
  icon?: string
  /** Vendor name (e.g., 'aws', 'cisco', 'juniper'). Display metadata only. */
  vendor?: string
}

/** Physical device (switch, router, AP, server, etc.) */
export interface HardwareSpec extends SpecBase {
  kind: 'hardware'
  /** Device type (for default styling/icons) */
  type?: DeviceType
  /** Model name (e.g., 'catalyst-9300', 'rtx3510') */
  model?: string
}

/** Virtual machine — on-prem or cloud-based (EC2, ESXi VM, etc.) */
export interface ComputeSpec extends SpecBase {
  kind: 'compute'
  /** Device type (for default styling/icons) */
  type?: DeviceType
  /** Platform identifier (e.g., 'ec2', 'esxi', 'proxmox') */
  platform?: string
}

/** Managed / cloud service (Lambda, S3, CloudFront, etc.) */
export interface ServiceSpec extends SpecBase {
  kind: 'service'
  /** Service name within the vendor (e.g., 'lambda', 's3', 'rds') */
  service: string
  /** Resource type within the service (e.g., 'function', 'bucket') */
  resource?: string
}

/**
 * Node specification — describes *what* the element represents.
 * Discriminated by `kind` so each variant carries only relevant fields.
 */
export type NodeSpec = HardwareSpec | ComputeSpec | ServiceSpec

/** Extract DeviceType from a spec (hardware and compute only). */
export function specDeviceType(spec: NodeSpec | undefined): DeviceType | undefined {
  if (!spec || spec.kind === 'service') return undefined
  return spec.type
}

/**
 * How a node / subgraph / topology participates in discovery.
 *
 * Mode determines scheduler behaviour, drift / freshness semantics,
 * and alert suppression downstream. Display behaviour is *separate* —
 * a `disabled` node still renders if any authored / observed data
 * exists for it; hiding from the diagram is a future `display` axis.
 *
 *   - `auto`     — scheduled discovery target; freshness and drift
 *                  are tracked, alerts may fire on stale / failure.
 *   - `observe`  — discover, but do NOT auto-adopt observation values.
 *                  Discoveries surface as drift candidates that the
 *                  operator reconciles.
 *   - `disabled` — unmanaged / excluded. No probing, no freshness
 *                  ageing, no drift noise, no stale alerts. Use for
 *                  vendor-managed gear, decommissioned hardware, lab
 *                  segments you want quiet. If you want the node to
 *                  keep displaying with curated values, curate it — the
 *                  project overlay's overrides carry through the resolver
 *                  regardless of discovery mode.
 *
 * History: an earlier revision had a fourth mode `manual-only` meaning
 * "the operator's content is authoritative". That collapses onto
 * `disabled` once you realise the project overlay (the first contribution
 * in the merge's ordering) is independent of discovery mode — the resolver
 * always folds it in. Keeping `manual-only` around invited an impossible state.
 */
export type DiscoveryMode = 'auto' | 'observe' | 'disabled'

/**
 * A unit of authored intent attached to a node — or to a subgraph / the
 * topology default, where `access` and `policy` are inherited by
 * descendants (`topology → subgraph (nearest ancestor wins) → node`).
 * Resolve the effective access/policy at a node via
 * `computeEffectivePolicy()` rather than walking the chain ad-hoc.
 *
 * Attribute overrides (name / model / vendor) are deliberately NOT
 * attachments: they are the authored node's own `label` / `spec`, which
 * the resolver already prefers over observed values. The UI presents
 * them as a "Facts" card over those native fields.
 */
export type Attachment = AccessAttachment | PolicyAttachment | MetricsBindingAttachment

/**
 * Provenance stamped by `resolve()` onto every attachment in the resolved
 * graph: which source contributed it. The project's own (intrinsic)
 * contribution carries `source: 'intrinsic'`; an observed attachment carries
 * the observing source's id. The discovery UI reads this to render
 * observed-derived rows read-only (no ✕) and intrinsic rows editable — the
 * fix for "✕ doesn't remove an observed access". Optional: freshly-saved
 * attachments omit it, and resolve fills it in.
 */
export interface AttachmentMeta {
  provenance?: Provenance
}

/**
 * How to read a device: a protocol plus its connection params. Only
 * `snmp` is wired today; the other protocols reserve the shape so the
 * "+ Add" menu and the read layer can grow without a type overhaul. A
 * node/subgraph/topology may carry several (e.g. SNMP + SSH later).
 */
export type AccessAttachment = (
  | { kind: 'access'; protocol: 'snmp'; community?: string; version?: '2c' | '3' }
  | { kind: 'access'; protocol: 'ssh'; username?: string; port?: number }
  | { kind: 'access'; protocol: 'netconf' | 'http' }
) &
  AttachmentMeta

/** Discovery scheduling for a node / subgraph / topology default. */
export interface PolicyAttachment extends AttachmentMeta {
  kind: 'policy'
  mode?: DiscoveryMode
  /**
   * Expected freshness budget in milliseconds. A node is fresh when
   * `lastObservedAt + intervalMs ≥ now`. Only meaningful for `auto` /
   * `observe` modes — ignored for `disabled`.
   */
  intervalMs?: number
}

/**
 * Binds an element to the metrics provider that supplies its live values
 * (axis 2 — the "mapping", modeled as a dependency-resolution field on the
 * resolved element rather than a side store). Folded by `resolve()` exactly
 * like access/policy, so it inherits identity-keyed re-sync follow,
 * priority-merge, suppression, and provenance for free.
 *
 * Lives on a `Node` (node binding → host) or a `NodePort` (link binding →
 * interface). The match key is IDENTITY, never a name string: `hostId` /
 * `interfaceIdentity` are the durable keys; `hostName` / `interfaceName` are
 * human labels and migration fallbacks only, so a provider-side rename
 * re-resolves instead of breaking.
 *
 * Today bindings are authored/human contributions. A future
 * binding-discovery capability could let a metrics source emit them as
 * observations, at which point auto-map becomes mostly observed — the model
 * already accommodates that additively.
 *
 * See `apps/server/docs/design/topology-composition-store.md § 1`.
 */
export interface MetricsBindingAttachment extends AttachmentMeta {
  kind: 'metrics-binding'
  /** Which metrics data source supplies values for this element. */
  sourceId: string
  /** Node binding: host id within that source (durable match key). */
  hostId?: string
  /** Node binding: host display name (label / migration fallback only). */
  hostName?: string
  /** Link binding (on NodePort): source-side interface identity (match key). */
  interfaceIdentity?: Identity
  /** Link binding: interface display name (label / migration fallback only). */
  interfaceName?: string
  /** Link bandwidth override in bits per second. */
  bandwidth?: number
}

/**
 * Stable merge / suppression key for an attachment. `access` is keyed per
 * protocol (SNMP and SSH are distinct slots); `metrics-binding` is keyed per
 * metrics source (two metrics sources can each bind one element — but ONE
 * binding per (source, element) is the invariant; extend with a role segment
 * if per-metric-role binding is ever needed, don't overload the slot); every
 * other kind keys by its `kind`. The resolver merges attachments by this key
 * (the first contribution in the ordering wins per key) and the human suppresses by it
 * (`suppressedAttachments`). One definition so merge and suppression never
 * disagree on what "the same attachment slot" means.
 */
export function attachmentKey(a: Attachment): string {
  if (a.kind === 'access') return `access:${a.protocol}`
  if (a.kind === 'metrics-binding') return `metrics-binding:${a.sourceId}`
  return a.kind
}

// ============================================
// Layers
// ============================================
//
// The configuration is the input (see ../input/model.ts), as the YAML writes it: the network, its
// ports, plugs, cables and terminations, and the attributes a device is recognized by (address,
// chassis id, sysName, hardware addresses). The drawing layer (looks and order) rides on it, keyed
// by its ids (see NetworkModel); the observation record (what each source said, where a value came
// from, a source's own identifiers) is kept beside the model, not in it. `Node`, `Link`, `Subgraph`
// and `NetworkGraph` are the graph drawn from these: configuration and drawing joined, and nothing
// of the observation record, so a drawing carries no identity.

/** The observation record of a node: what a source said of it, and what the merge adds. */
export interface NodeObservation {
  /**
   * Presence claim this contribution makes about the node (resolve input only):
   * - `'scoop'` (default, also when omitted) — positive: "this node exists".
   * - `'anchor'` — NO presence claim: the node carries identity / attachments
   *   only, to ride onto a node some OTHER contribution scoops. An anchor-only
   *   cluster is dropped by resolve(), so e.g. an overlay node that merely holds
   *   a metrics-binding does not keep a ghost alive once every source stops
   *   observing the device. (`'hide'` is expressed via `NetworkGraph.exclusions`,
   *   not here.)
   */
  presence?: 'scoop' | 'anchor'

  /**
   * Observation provenance (which source last asserted this node).
   * See `Provenance`. Optional — omitted on authored nodes that pre-date
   * the observation model.
   */
  provenance?: Provenance

  /**
   * The source's own identifiers for the node, by namespace, e.g. `{ 'netbox-device-id': '42' }`.
   * A key the source alone understands: the merge matches on it as on the configuration's
   * attributes (address, chassisId, sysName, mac), and it never reaches the drawing.
   */
  vendorIds?: Record<string, string>

  /**
   * Authored overlay for this node: access (how to read it) and policy
   * (discovery scheduling) attachments. Access/policy merge with the
   * parent subgraph and topology default via `computeEffectivePolicy()`.
   * Set on the **resolved** / **authored** node so overrides survive
   * re-scans. Attribute overrides (name/model/vendor) are NOT here — they
   * are this node's own `label` / `spec`.
   */
  attachments?: Attachment[]

  /**
   * Attachment keys (see `attachmentKey`) the human has explicitly removed —
   * the negative counterpart to `attachments`. A node is one thing every
   * source contributes to; the human (first in the ordering) can add / override a
   * value (`attachments`) AND remove one a source supplied (here). There are
   * no observed/authored layers — this is just the human asserting "no
   * attachment of this key". `resolve()` drops any merged attachment whose
   * key is listed, so a deleted access stays gone across re-scans (the
   * assertion persists) until Reset removes the whole human contribution.
   * Meaningful on the human contribution; the resolver passes it through onto
   * the resolved node so the UI can round-trip it.
   */
  suppressedAttachments?: string[]
  /**
   * Stable entity id from the server-side entity registry; absent for
   * graphs not resolved through it.
   */
  entityId?: EntityId
}

/** Presentation layer of a node: where and how it is drawn. */
export interface NodeDrawing {
  /**
   * Node shape. Optional — the renderer defaults to `'rounded'` when
   * omitted (and uses `spec.icon` / `specDeviceType(spec)` to overlay
   * the right device icon on top). Producers should only set this
   * when they actually want a non-default background (e.g. `'cylinder'`
   * for a database, `'cloud'` for a cloud boundary). The default
   * carries shape away from being "data the plugin must invent".
   */
  shape?: NodeShape

  /**
   * Custom style
   */
  style?: NodeStyle
}

export interface Node extends NodeDrawing {
  id: string

  /**
   * The product in the project's own library that this node is (the configuration's
   * `productId`). `spec` is what the node is; this is which library entry it is bound to.
   */
  productId?: string

  /**
   * Display label - can be single line or multiple lines
   * Supports basic HTML: <b>, <i>, <br/>
   */
  label: string | string[]

  /**
   * Parent subgraph ID
   */
  parent?: string

  /**
   * What this node represents (hardware, compute, or service)
   */
  spec?: NodeSpec

  /**
   * Concrete ports owned by this node. Catalog-backed nodes snapshot
   * their port list here so saved diagrams do not change when catalog
   * definitions are updated later.
   */
  ports?: NodePort[]

  /**
   * The drawn node it runs on, such as a VM's hypervisor. Hosting is not a link: no line or
   * port is drawn for it, and layout keeps the node beside its host.
   */
  host?: string

  /**
   * Facts from the configuration, for display: `toNetworkGraph` builds them, and they are not
   * split back into the configuration, which keeps the facts themselves.
   */
  annotations?: DiagramAnnotation[]
}

// ============================================
// Link Types
// ============================================

export type LinkType =
  | 'dashed' // Dashed line (a virtual link)
  | 'dotted' // Dotted line (a link assumed rather than confirmed)

export interface LinkStyle {
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  opacity?: number
  /** Minimum length for this link (controls node spacing for HA pairs) */
  minLength?: number
}

/**
 * Module / transceiver attached to one end of a link. Each endpoint owns
 * its own module instance — the cable runs between two modules. For
 * RJ45 ports the module is the port's built-in PHY (no swappable
 * transceiver), but the standard it speaks still belongs here.
 */
export interface LinkModule {
  /**
   * IEEE / industry standard the module implements. Picking this pins
   * the cage form factor and cable medium kind via the `STANDARD_SPECS`
   * registry.
   */
  standard: EthernetStandard
  /** Vendor SKU for inventory, e.g. "SFP-10G-SR-S". Optional. */
  sku?: string
  /** Project-local product definition assigned to this endpoint module. */
  productId?: string
}

/**
 * The cable-side plug at one end of a link — what's mechanically
 * inserted into a port's cage. `cage` is the form factor (RJ45 / SFP+
 * / etc.) and is the structural anchor; **optional** because it's
 * derivable from `port.cage` (when set) or `module.standard` (via
 * `STANDARD_SPECS[std].cage`). Store explicit `cage` only when neither
 * source has it (e.g. user picked a plug form factor before picking a
 * module, on a port without catalog cage info). `module` is the
 * transceiver inside the plug for pluggable form factors (SFP /
 * SFP+ / SFP28 / QSFP+ / QSFP28); RJ45 direct, DAC, and AOC have no
 * separate module so it stays undefined.
 *
 * Invariants (validator-enforced):
 * - If both `cage` and `module.standard` are set, `module`'s required
 *   cage must equal `plug.cage`.
 * - `plug.cage` must be present in `port.connectors` (when both known).
 */
export interface LinkPlug {
  /** Form factor the plug presents. Optional when derivable. */
  cage?: PortConnector
  /** Transceiver inside the plug. Absent for RJ45 direct / DAC / AOC. */
  module?: LinkModule
}

/**
 * Link endpoint. Conceptually a cable end plugged into a port on a node.
 * The endpoint references its node and port by id and owns its per-end
 * `plug` — symmetric links share the same plug shape on both ends;
 * asymmetric ones (BiDi pairs, BiDi-pair etc.) carry different plug
 * configs per end.
 */
export interface LinkEndpoint {
  node: string
  /** NodePort.id on the endpoint node — must reference an existing port. */
  port: string
  /** Cable-side plug at this end (form factor + optional module). */
  plug?: LinkPlug
  ip?: string // e.g., "10.57.0.1/30"
}

/**
 * Physical cable details that aren't fully implied by the link's standard.
 * `medium` is the cable kind (twisted-pair / fiber-mm / fiber-sm / dac /
 * aoc), stored explicitly so the user can declare "this is fiber" before
 * picking a specific OM grade. `category` is the installed grade within
 * that medium. `length_m` is informational (reach validation). The
 * cable-end connector is *not* stored — derived from `module.standard`
 * via `STANDARD_SPECS[std].cableConnector` to keep the model normalized.
 *
 * Invariant (validator-enforced): when both `medium` and `category` are
 * set, the category's medium must agree with `medium`.
 */
export interface LinkCable {
  /** Cable medium kind. Optional when not yet decided / not relevant. */
  medium?: CableMedium
  /** Installed cable grade within the medium. */
  category?: CableGrade
  /** Run length in meters. Used for reach warnings. */
  length_m?: number
  /** Project-local product definition assigned to this cable run. */
  productId?: string
}

/** Observation layer of a link: what Server's merge of sources adds. */
export interface LinkObservation {
  /**
   * Presence claim (resolve input only), mirroring `Node.presence`:
   * - `'scoop'` (default / omitted) — assert this link exists.
   * - `'anchor'` — NO presence claim: only contribute fields to a link some
   *   other contribution scoops. A link cluster with only anchor members is
   *   dropped by resolve(). Set by an `link_contribution: 'update'` source.
   */
  presence?: 'scoop' | 'anchor'

  /**
   * Observation provenance (which source last asserted this link).
   * See `Provenance`. Links are identified by their endpoints rather
   * than by a stable identity record, so no `identity` field here.
   */
  provenance?: Provenance
  /**
   * Stable entity id from the server-side entity registry; absent for
   * graphs not resolved through it.
   */
  entityId?: EntityId
}

/** Presentation layer of a link: how it is drawn. */
export interface LinkDrawing {
  /**
   * Link label - can be multiple lines (displayed at center)
   */
  label?: string | string[]

  /**
   * Link type
   */
  type?: LinkType

  /**
   * Custom style
   */
  style?: LinkStyle
}

/**
 * A fact drawn with a node or link. Its kind decides where it goes: `identity` in the subtitle
 * (a link's first caption line), `relation`, `address` and `note` (text the author wrote) in the
 * rows (a link's caption), `status` and `badge` as marks. A `detail` is supplementary and only
 * in the title, as is the full text of anything shortened.
 */
export interface DiagramAnnotation {
  kind: 'identity' | 'address' | 'relation' | 'note' | 'detail' | 'status' | 'badge'
  label: string
  value: string
  /**
   * What the fact is about, where a drawing may say it another way: `hosting` (where a node runs)
   * is left off a card drawn inside its host's box or its cluster's frame.
   */
  about?: 'hosting'
}

export interface Link extends LinkDrawing {
  id?: string

  /**
   * The terminations the cable physically passes between `from` and `to`, in order (wall outlet,
   * riser, patch panel), by id; the configuration's `via`. Scene-derived length sums the run
   * per segment and the BOM breaks it into structured and patch cables. The network drawing
   * ignores it.
   */
  via?: string[]

  /**
   * Facts from the configuration, for display: `toNetworkGraph` builds them, and they are not
   * split back into the configuration, which keeps the facts themselves.
   */
  annotations?: DiagramAnnotation[]

  /**
   * Source endpoint. Always a structured LinkEndpoint at runtime —
   * the parser normalizes any YAML shorthand.
   */
  from: LinkEndpoint

  /**
   * Target endpoint. Always a structured LinkEndpoint at runtime —
   * the parser normalizes any YAML shorthand.
   */
  to: LinkEndpoint

  /**
   * Cable details that don't follow from the standard. Optional — the
   * standard's defaults are sufficient for most diagrams.
   */
  cable?: LinkCable

  /**
   * The link's nominal speed in bits/sec, for a link that no module standard
   * describes (when the ends' standards name a speed, that is the speed and
   * this is left unset). What the link is rated for, never its current
   * traffic: the drawing derives the line's width from it.
   */
  speedBps?: number

  /**
   * Redundancy/clustering type - nodes connected with this will be placed on the same layer
   * ha: High Availability (VRRP, HSRP, GLBP, keepalive)
   * vc: Virtual Chassis (Juniper)
   * vss: Virtual Switching System (Cisco)
   * vpc: Virtual Port Channel (Cisco Nexus)
   * mlag: Multi-Chassis Link Aggregation
   * stack: Stacking
   */
  redundancy?: 'ha' | 'vc' | 'vss' | 'vpc' | 'mlag' | 'stack'

  /**
   * VLANs carried on this link
   * Single VLAN for access ports, multiple for trunk ports
   */
  vlan?: number[]
}

/**
 * Helper to get node ID from endpoint. Kept as a tiny accessor so callers
 * read intent ("the link's source node") rather than reaching into shape.
 */
export function getNodeId(endpoint: LinkEndpoint): string {
  return endpoint.node
}

// ============================================
// Subgraph Types
// ============================================

export interface SubgraphStyle {
  /**
   * Fill color - can be a hex color or a surface token (e.g., "surface-1", "accent-blue")
   * Surface tokens are resolved to actual colors based on the current theme
   */
  fill?: string
  /**
   * Stroke color - can be a hex color or a surface token
   * If using a surface token, the stroke color from that token is used
   */
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  labelPosition?: 'top' | 'bottom' | 'left' | 'right'
  labelFontSize?: number
  /** Padding inside this subgraph (like CSS padding) */
  padding?: number
  /** Horizontal spacing between nodes in this subgraph. Not read by the drawing engine (`drawNetwork`) or the renderers; the drawing decides positions and sizes itself. */
  nodeSpacing?: number
  /** Vertical spacing between layers in this subgraph. Not read by the drawing engine (`drawNetwork`) or the renderers; the drawing decides positions and sizes itself. */
  rankSpacing?: number
}

/**
 * Region identity for cross-source subgraph merge. A subgraph that carries an
 * identity is treated as a REGION: subgraphs from different sources whose
 * identities share ANY key are merged into one region by resolve() — the same
 * any-key clustering nodes use. Without identity a subgraph stays source-local
 * (each source keeps its own group).
 */
export interface RegionIdentity {
  /** Human-facing region name; also a match key (`name=<value>`). */
  name?: string
  /** Namespaced keys, e.g. `{ 'zabbix-hostgroup': '98', 'netbox-site': 'backbone' }`. */
  keys?: Record<string, string>
}

/**
 * One rule of a topology's {@link ScopeFilter}, matched against a node whichever source placed it.
 *
 * - `name`     — `value` (a regex) matches the node's label or its `sysName`.
 * - `subnet`   — the node's `address` falls inside the IPv4 CIDR `value`.
 * - `metadata` — the node's observation `metadata[key]` equals `value` (string compare).
 */
export interface MembershipCriterion {
  attr: 'name' | 'subnet' | 'metadata'
  value: string
  /** Metadata key to read when `attr === 'metadata'`. */
  key?: string
}

/**
 * A topology-level scope: the SINGLE, plugin-independent definition of which
 * nodes the topology covers, as a list of {@link MembershipCriterion} rules. A node is in scope when it matches an
 * `include` criterion (or `include` is empty) AND no `exclude` criterion.
 * Both empty → no scoping (open-world union).
 *
 * This is the common shape every topology source's "what to pull" filter folds
 * into (Zabbix host groups, NetBox sites/tags/roles, subnets → criteria).
 * Plugins MAY push it down to their upstream query for efficiency, but resolve()
 * enforces it post-merge regardless, so coverage never depends on push-down.
 */
export interface ScopeFilter {
  include?: MembershipCriterion[]
  exclude?: MembershipCriterion[]
}

/** Observation layer of a subgraph: what Server's merge of sources adds. */
export interface SubgraphObservation {
  /**
   * Region identity — when set, resolve() merges this subgraph with same-region
   * subgraphs from other sources (any-key match). See {@link RegionIdentity}.
   */
  identity?: RegionIdentity

  /**
   * Scope marker (resolve input only). `'closed'` makes this region a closed
   * world: resolve() drops any node cluster that is not a member of some closed
   * region. Stamped by the caller per the topology's scope policy (auto / open /
   * closed-to a chosen source). Default (undefined) = open.
   */
  scope?: 'closed'

  /**
   * Observation provenance (which source last asserted this subgraph).
   * See `Provenance`. Subgraphs are logical groupings — typically
   * authored — so this stays undefined for hand-drawn diagrams. Workload
   * sources (k8s namespaces, Proxmox clusters) may populate it later.
   */
  provenance?: Provenance

  /**
   * Access / policy attachments inherited by every descendant node
   * (unless that node attaches its own). For nested subgraphs the
   * nearest ancestor wins per field. Compute the effective value with
   * `computeEffectivePolicy()` — don 't walk the chain by hand.
   */
  attachments?: Attachment[]
}

/** Presentation layer of a subgraph: how it is drawn. */
export interface SubgraphDrawing {
  /**
   * Custom style
   */
  style?: SubgraphStyle
}

export interface Subgraph extends SubgraphDrawing {
  id: string

  /**
   * Display label
   */
  label: string

  /**
   * Child subgraph IDs
   */
  children?: string[]

  /**
   * Parent subgraph ID (for nested subgraphs)
   */
  parent?: string

  /**
   * What this subgraph represents (hardware, compute, or service)
   */
  spec?: NodeSpec
}

// ============================================
// Canvas Size Types
// ============================================

/**
 * Standard paper size presets
 */
export type PaperSize =
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'B0'
  | 'B1'
  | 'B2'
  | 'B3'
  | 'B4'
  | 'letter'
  | 'legal'
  | 'tabloid'

/**
 * Paper orientation
 */
export type PaperOrientation = 'portrait' | 'landscape'

/**
 * Paper size dimensions in mm
 */
export const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  B0: { width: 1000, height: 1414 },
  B1: { width: 707, height: 1000 },
  B2: { width: 500, height: 707 },
  B3: { width: 353, height: 500 },
  B4: { width: 250, height: 353 },
  letter: { width: 216, height: 279 },
  legal: { width: 216, height: 356 },
  tabloid: { width: 279, height: 432 },
}

/**
 * Canvas size settings
 */
export interface CanvasSettings {
  /**
   * Paper size preset (A0, A1, A2, A3, A4, etc.)
   */
  preset?: PaperSize

  /**
   * Paper orientation (portrait or landscape)
   * Only used with preset
   */
  orientation?: PaperOrientation

  /**
   * Custom width in pixels
   * Takes precedence over preset
   */
  width?: number

  /**
   * Custom height in pixels
   * Takes precedence over preset
   */
  height?: number

  /**
   * DPI for print output (default: 96 for screen, 300 for print)
   */
  dpi?: number

  /**
   * Fit content to canvas with padding
   * If true, scales content to fit within canvas
   */
  fit?: boolean

  /**
   * Padding around content when fit is true (in pixels)
   */
  padding?: number
}

/**
 * Convert paper size to pixels at given DPI
 */
export function paperSizeToPixels(
  size: PaperSize,
  orientation: PaperOrientation = 'portrait',
  dpi = 96,
): { width: number; height: number } {
  const dimensions = PAPER_SIZES[size]
  const mmToInch = 1 / 25.4

  let width = Math.round(dimensions.width * mmToInch * dpi)
  let height = Math.round(dimensions.height * mmToInch * dpi)

  if (orientation === 'landscape') {
    ;[width, height] = [height, width]
  }

  return { width, height }
}

// ============================================
// Graph Types
// ============================================

/**
 * Theme type for diagram appearance
 */
export type ThemeType = 'light' | 'dark'

export interface LegendSettings {
  /**
   * Show legend in the diagram
   */
  enabled?: boolean

  /**
   * Legend position
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

  /**
   * Show device type icons
   */
  showDeviceTypes?: boolean

  /**
   * Show bandwidth indicators
   */
  showBandwidth?: boolean

  /**
   * Show cable/link types
   */
  showCableTypes?: boolean

  /**
   * Show VLAN colors
   */
  showVlans?: boolean
}

export interface GraphSettings {
  /**
   * Default layout direction.
   * Not read by the drawing engine (`drawNetwork`); the drawing decides directions itself.
   */
  direction?: Direction

  /**
   * Theme for diagram appearance (light or dark)
   */
  theme?: ThemeType

  /**
   * Node spacing.
   * Not read by the drawing engine (`drawNetwork`); spacing follows the kit's metrics.
   */
  nodeSpacing?: number

  /**
   * Rank spacing (between layers).
   * Not read by the drawing engine (`drawNetwork`); spacing follows the kit's metrics.
   */
  rankSpacing?: number

  /**
   * Subgraph padding.
   * Not read by the drawing engine (`drawNetwork`); padding follows the kit's metrics.
   */
  subgraphPadding?: number

  /**
   * Canvas size settings.
   * Not read by the drawing engine (`drawNetwork`); the Scene's `bounds` is the canvas.
   */
  canvas?: CanvasSettings

  /**
   * Legend configuration.
   * Not read by the drawing engine (`drawNetwork`) or the kit's renderers.
   */
  legend?: boolean | LegendSettings

  /**
   * Hide every node that has no links (degree 0) in the RESOLVED graph.
   * A project-level display preference: evaluated after resolve() has folded
   * every source, so a node linked by any source is kept. There is no exemption:
   * a node placed by hand is hidden like any other. Only the Server applies it
   * (`apps/server/api/src/services/display-filter.ts`); `drawNetwork`, the CLI and the renderers ignore it.
   */
  hideDisconnected?: boolean

  /**
   * Where the network meets what lies beyond it (ids of nodes, segments or routing domains),
   * which the drawing's direction is measured from. The drawing (`boundaryOf`) takes, in this
   * order, and an earlier step wins: (1) this setting; (2) the structure's own candidates, the
   * nodes that have both a cable and a virtual link; (3) the `external` or `cloud` nodes and the
   * routing domains that links reach (`internet` is not among them); (4) for each connected
   * part that none of these reaches, a guessed upstream (by node type, else the node ending the
   * fastest link, else the graph centre), also when other parts have a boundary; a lone node
   * gets nothing. A choice of how to draw, not a fact of the configuration, so it lives in the
   * drawing layer only.
   */
  boundary?: string[]
}

/**
 * A passive point a cable runs through: a wall outlet, a riser (EPS) or a patch panel; the
 * configuration's `Termination`, as drawn. Unlike a `Node` it carries no ports and no logical
 * role. It lives in `NetworkGraph.terminations`, apart from `nodes`, so the logical topology
 * (JSON export, the network drawing, the BOM's equipment) does not see it as a device;
 * `Link.via` names it by id. Where it sits on a floor plan is the Editor's scene data.
 */
export interface Termination {
  id: string
  /** Display label. User can edit. */
  label: string
  /** Termination kind — drives the rendered glyph. */
  role: 'eps' | 'outlet' | 'panel'
  /**
   * Set on an outlet a routing dialog made for one link's run through one riser, as
   * `<linkId>:<epsId>`, so unrouting the run finds and removes the outlet again.
   */
  autoFor?: string
}

/** Presentation layer of a graph: how the whole is drawn. */
export interface NetworkGraphDrawing {
  /**
   * Global settings
   */
  settings?: GraphSettings
}

export interface NetworkGraph extends NetworkGraphDrawing {
  version: string
  name?: string
  description?: string

  /**
   * The passive points cables run through, referenced by `Link.via`; the configuration's
   * `terminations`. Each has a stable id so several wires can pass the same riser or panel.
   */
  terminations?: Termination[]

  /**
   * All nodes (flat list). Only logical entities — devices, compute,
   * services. Physical cabling waypoints live in `NetworkGraph.terminations`.
   */
  nodes: Node[]

  /**
   * All links
   */
  links: Link[]

  /**
   * Subgraph definitions
   */
  subgraphs?: Subgraph[]
}

/**
 * One hidden-node rule, kept in the project's observation record (`ObservationLayer.exclusions`).
 * Matches a merged node when ANY present key equals the node's attribute in the configuration:
 * `mgmtIp` its `address`, `chassisId` its `chassisId`, `sysName` its `sysName`. Keyed by those
 * rather than by node id so a hide survives a re-scan that re-numbers ephemeral ids. At least one
 * key should be set; an all-empty entry matches nothing (ignored).
 */
export interface NodeExclusion {
  mgmtIp?: string
  chassisId?: string
  sysName?: string
}

// ============================================
// Device Types (for default styling)
// ============================================

export enum DeviceType {
  Router = 'router',
  L3Switch = 'l3-switch',
  L2Switch = 'l2-switch',
  Firewall = 'firewall',
  LoadBalancer = 'load-balancer',
  Server = 'server',
  AccessPoint = 'access-point',
  CPE = 'cpe',
  ConsoleServer = 'console-server',
  Cloud = 'cloud',
  Internet = 'internet',
  VPN = 'vpn',
  Database = 'database',
  /**
   * Layer-2 broadcast domain / subnet. Used by discovery plugins that
   * can see a set of devices on the same IP subnet but can 't see the
   * physical L2 switch in the middle. Modeled as a virtual transit
   * node so each device 's link to "the segment" stays a clean 1-port
   * = 1-link relationship, instead of producing a mesh that violates
   * the editor / renderer 's "1 port owns 1 link endpoint" invariant.
   */
  Segment = 'segment',
  Generic = 'generic',
}

// ============================================
// Geometry (the Scene's and the Editor's; never kept in the network)
// ============================================

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Layout flow direction. Not read by the drawing engine (`drawNetwork`), which decides
 * directions itself; kept for the settings that still carry it.
 *   - `TB` top→bottom (default)
 *   - `BT` bottom→top
 *   - `LR` left→right
 *   - `RL` right→left
 */
export type Direction = 'TB' | 'BT' | 'LR' | 'RL'
