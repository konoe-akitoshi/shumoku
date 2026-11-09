// Copyright (C) 2026 system_explorer contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Scenario JSON schema — the declarative structure a system_explorer scenario
// is written in (one scenario = one YAML document, shipped by the plugin as a
// data example). This is the contract a consumer (the standalone viewer, or a
// future Shumoku editor feature) uses to render a protocol walkthrough:
// step by step, event by event, with an optional packet byte spec per event.
//
// The schema is intentionally self-contained (no dependency on the packet
// builder): a `packet` field is either `null` (prose only), a named reference
// (`{ ref, args }`), or an inline `PktSpec`. Consumers that do not build
// packets can ignore `packet` and still drive the narrative (steps / facts /
// state / labels).

/** Color vocabulary shared by legend entries and packet events. */
export type EventColor = 'green' | 'teal' | 'amber' | 'violet' | 'blue' | 'red' | 'gray' | 'pink'

/** A `[label, value]` fact row shown in a step / overview table. */
export type Fact = [string, string]

/** The intro screen (step -1). */
export interface Overview {
  /** Short name used as the heading. */
  full: string
  /** One or more paragraphs explaining the scenario. */
  description: string
  facts?: Fact[]
}

/** The closing screen (after the last step). */
export interface Outro {
  title: string
  text: string
  points?: string[]
}

/**
 * A packet field spec. The first element is always the field name; the rest
 * are type-specific. Kept as an open union so the schema documents intent
 * without pinning every byte encoding.
 *
 * Examples:
 *   { u8:  ["version", 0x21, "v2 / Advertisement"] }
 *   { ip4: ["src", "10.0.0.10"] }
 *   { hex: ["AName", "c00c", "name-compression pointer"] }
 *   { csum:["checksum", undefined, { kind: "udp" } ] }
 */
export type FieldSpec =
  | { u8: [string, number, string?, string?] }
  | { u16: [string, number, string?, string?] }
  | { u32: [string, number, string?, string?] }
  | { str: [string, string, string?] }
  | { hex: [string, string | number[], string?, string?] }
  | { raw: [string, number[], string?, string?] }
  | { blob: [string, string | number, number, string?, string?] }
  | { dnsname: [string, string, string?, string?] }
  | { ip4: [string, string, string?, string?] }
  | { ip6: [string, string, string?, string?] }
  | { mac: [string, string, string?, string?] }
  | { len: [string, number, string?, { from?: 'layer' | 'rest'; adj?: number; unit?: number }?] }
  | { csum: [string, string?, { kind?: 'udp' | 'tcp' | 'icmp6' | 'icmp4' | 'vrrp' | 'ip4' }?] }

/**
 * A packet layer. Either a named protocol (eth / ipv4 / ipv6 / udp / tcp) or
 * an arbitrary named group carrying `fields`. `decoded` marks a layer whose
 * bytes are shown as a hex blob rather than reconstructed.
 */
export type LayerSpec =
  | { eth: Record<string, unknown> }
  | { ipv4: Record<string, unknown> }
  | { ipv6: Record<string, unknown> }
  | { udp: Record<string, unknown> }
  | { tcp: Record<string, unknown> }
  | { name: string; decoded?: boolean; basic?: boolean; note?: string; fields?: FieldSpec[] }

/** An inline packet definition (the bytes a consumer would render). */
export interface PktSpec {
  /** Human summary line, e.g. "DNS query: A www.example.com". */
  summary?: string
  /** Note shown under the summary. */
  note?: string
  layers?: LayerSpec[]
}

/**
 * The `packet` of a packet event: `null` (prose only, no bytes), a named
 * reference resolved from a shared registry, or an inline {@link PktSpec}.
 */
export type PacketNode = null | { ref: string; args?: Record<string, unknown> } | PktSpec

/** A packet traveling from one node to another (or a multicast set). */
export interface PktEvent {
  kind: 'pkt'
  from: string
  /** A node id, or an array of node ids for multicast. */
  to: string | string[]
  /** Optional link id to pin the wire (parallel links). */
  link?: string
  color: EventColor
  label: string
  packet?: PacketNode
  /** Runs in parallel with the previous event. */
  with?: boolean
}

/** In-device processing (no packet on the wire). */
export interface LocalEvent {
  kind: 'local'
  node: string
  label: string
  text?: string
  with?: boolean
}

export type FlowEvent = PktEvent | LocalEvent

/** One step of the walkthrough. */
export interface Step {
  title: string
  desc: string
  /** Extra detail paragraphs (split on blank lines by the viewer). */
  detail?: string
  facts?: Fact[]
  /** Cumulative node -> status label, shown as state chips. */
  state?: Record<string, string>
  events: FlowEvent[]
}

/**
 * The full scenario document (what `SystemExplorerPlugin.getScenario(id)`
 * returns, and what each `data/scenario-*.yml` holds).
 *
 * `topology` is set by the plugin to the owning sample id (the scenario is
 * authored inside `examples/<topology>/scenario/`).
 */
export interface ScenarioDoc {
  /** Globally unique scenario id (deep-link key). */
  id: string
  /** Menu name. */
  name: string
  /** Subtitle. */
  title?: string
  /** Menu group label. */
  group?: string
  /** Protocol / layer badge text. */
  layerLabel?: string
  /** Owning sample (topology) id — set by the plugin. */
  topology?: string
  /** Sequence-diagram lifeline order. */
  lifelines?: string[]
  /** Legend: `[color, label]` pairs. */
  legend?: [EventColor, string][]
  /** Node id -> sub-label (usually an address). */
  nodeSub?: Record<string, string>
  overview?: Overview
  outro?: Outro
  steps: Step[]
}

/**
 * A summary of one scenario, as returned by `listScenarios()`.
 */
export interface ScenarioSummary {
  id: string
  topology: string
  name: string
  title?: string
  group?: string
  layerLabel?: string
  stepCount: number
}

/**
 * JSON Schema (draft 2020-12) describing {@link ScenarioDoc}.
 * Exposed via `nativeApi('scenario.schema')` and shipped as documentation so a
 * consumer can validate a scenario without importing this package.
 */
export const SCENARIO_JSON_SCHEMA: Record<string, unknown> = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://shumoku.dev/schemas/system-explorer-scenario.json',
  title: 'System Explorer Scenario',
  description:
    'A declarative protocol walkthrough: steps, per-step events (in-device or packet), and an optional packet byte spec.',
  type: 'object',
  required: ['id', 'name', 'steps'],
  properties: {
    id: { type: 'string', description: 'Globally unique scenario id (deep-link key).' },
    name: { type: 'string', description: 'Menu name.' },
    title: { type: 'string' },
    group: { type: 'string' },
    layerLabel: { type: 'string' },
    topology: { type: 'string', description: 'Owning sample (topology) id.' },
    lifelines: { type: 'array', items: { type: 'string' } },
    legend: {
      type: 'array',
      items: {
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'string' }],
        minItems: 2,
        maxItems: 2,
      },
    },
    nodeSub: { type: 'object', additionalProperties: { type: 'string' } },
    overview: {
      type: 'object',
      required: ['full', 'description'],
      properties: {
        full: { type: 'string' },
        description: { type: 'string' },
        facts: { type: 'array', items: { type: 'array', minItems: 2, maxItems: 2 } },
      },
    },
    outro: {
      type: 'object',
      required: ['title', 'text'],
      properties: {
        title: { type: 'string' },
        text: { type: 'string' },
        points: { type: 'array', items: { type: 'string' } },
      },
    },
    steps: { type: 'array', minItems: 1, items: { $ref: '#/$defs/step' } },
  },
  $defs: {
    eventColor: { enum: ['green', 'teal', 'amber', 'violet', 'blue', 'red', 'gray', 'pink'] },
    step: {
      type: 'object',
      required: ['title', 'desc', 'events'],
      properties: {
        title: { type: 'string' },
        desc: { type: 'string' },
        detail: { type: 'string' },
        facts: { type: 'array', items: { type: 'array', minItems: 2, maxItems: 2 } },
        state: { type: 'object', additionalProperties: { type: 'string' } },
        events: { type: 'array', items: { $ref: '#/$defs/event' } },
      },
    },
    event: {
      oneOf: [
        {
          type: 'object',
          required: ['kind', 'from', 'to', 'color', 'label'],
          properties: {
            kind: { const: 'pkt' },
            from: { type: 'string' },
            to: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
            link: { type: 'string' },
            color: { $ref: '#/$defs/eventColor' },
            label: { type: 'string' },
            packet: { $ref: '#/$defs/packetNode' },
            with: { type: 'boolean' },
          },
        },
        {
          type: 'object',
          required: ['kind', 'node', 'label'],
          properties: {
            kind: { const: 'local' },
            node: { type: 'string' },
            label: { type: 'string' },
            text: { type: 'string' },
            with: { type: 'boolean' },
          },
        },
      ],
    },
    packetNode: {
      oneOf: [
        { type: 'null' },
        {
          type: 'object',
          required: ['ref'],
          properties: {
            ref: { type: 'string' },
            args: { type: 'object' },
          },
          description: 'Named reference resolved from a shared packet registry.',
        },
        { $ref: '#/$defs/pktSpec' },
      ],
    },
    pktSpec: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        note: { type: 'string' },
        layers: { type: 'array', items: { $ref: '#/$defs/layer' } },
      },
    },
    layer: {
      description:
        'A named protocol layer (eth/ipv4/ipv6/udp/tcp) or an arbitrary group with fields.',
      type: 'object',
      oneOf: [
        { required: ['eth'], properties: { eth: { type: 'object' } } },
        { required: ['ipv4'], properties: { ipv4: { type: 'object' } } },
        { required: ['ipv6'], properties: { ipv6: { type: 'object' } } },
        { required: ['udp'], properties: { udp: { type: 'object' } } },
        { required: ['tcp'], properties: { tcp: { type: 'object' } } },
        {
          required: ['name'],
          properties: {
            name: { type: 'string' },
            decoded: { type: 'boolean' },
            basic: { type: 'boolean' },
            note: { type: 'string' },
            fields: { type: 'array', items: { type: 'object' } },
          },
        },
      ],
    },
  },
}
