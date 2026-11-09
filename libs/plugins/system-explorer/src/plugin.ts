// Copyright (C) 2026 system_explorer contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// System Explorer data source plugin (bundled).
//
// Exposes the public system_explorer samples to Shumoku two ways:
//
//   - `topology` capability (known): `fetchTopology()` returns the authored
//     `SourceNetwork` for the selected sample, so it renders as an ordinary
//     topology layer in the editor.
//   - `scenario` capability (open): the host does not know this contract and
//     skips it (see `missingCapabilityMethods`), but it is declared so the
//     plugin self-documents. Consumers reach the scenario data through the
//     documented methods `listScenarios()` / `getScenario(id)` /
//     `scenarioSchema()`, or generically via `nativeApi(...)`.
//
// The scenario data is the declarative walkthrough (steps / events / packet
// spec) described by `src/scenario/schema.ts`. Packet *bytes* are not built
// here — that stays in the standalone viewer so this plugin has no dependency
// on the renderer/packet-builder.

import {
  type ConnectionResult,
  type DataSourcePlugin,
  readNetworkModel,
  type SourceNetwork,
  type TopologyCapable,
} from '@shumoku/core'
import { scenarios, topologies } from './generated-data.js'
import { parseScenarioDoc } from './scenario/parse.js'
import { SCENARIO_JSON_SCHEMA, type ScenarioDoc, type ScenarioSummary } from './scenario/schema.js'
import type { SystemExplorerPluginConfig } from './types.js'

/** Map a scenario data key (`<sample>-<name>`) to its owning sample id. */
function sampleOfScenarioKey(key: string): string | undefined {
  return Object.keys(topologies)
    .filter((id) => key === id || key.startsWith(`${id}-`))
    .sort((a, b) => b.length - a.length)[0]
}

export class SystemExplorerPlugin implements DataSourcePlugin, TopologyCapable {
  readonly type = 'system-explorer'
  readonly displayName = 'System Explorer'
  readonly capabilities = ['topology', 'scenario'] as const

  private config: SystemExplorerPluginConfig = {}

  initialize(config: unknown): void {
    this.config = (config ?? {}) as SystemExplorerPluginConfig
  }

  async testConnection(): Promise<ConnectionResult> {
    return {
      success: true,
      message: `System Explorer: ${Object.keys(topologies).length} samples, ${
        Object.keys(scenarios).length
      } scenarios bundled`,
    }
  }

  // ---- TopologyCapable -------------------------------------------------

  async fetchTopology(): Promise<SourceNetwork> {
    const id = this.config.sample ?? Object.keys(topologies)[0]
    const yaml = id ? topologies[id] : undefined
    if (!id || !yaml) throw new Error(`unknown sample '${String(id)}'`)
    const model = readNetworkModel(yaml)
    return { network: model.config }
  }

  // ---- scenario capability (open; documented for consumers) -----------

  /** All bundled scenarios, keyed by their (globally unique) scenario id. */
  listScenarios(): ScenarioSummary[] {
    return this.allDocs().map((doc) => ({
      id: doc.id,
      topology: doc.topology ?? '',
      name: doc.name,
      title: doc.title,
      group: doc.group,
      layerLabel: doc.layerLabel,
      stepCount: doc.steps.length,
    }))
  }

  /** One scenario doc by its id. */
  getScenario(id: string): ScenarioDoc {
    const doc = this.allDocs().find((d) => d.id === id)
    if (!doc) throw new Error(`unknown scenario '${id}'`)
    return doc
  }

  /** The JSON Schema describing a scenario document. */
  scenarioSchema(): Record<string, unknown> {
    return SCENARIO_JSON_SCHEMA
  }

  /** Sample ids available for the `topology` capability. */
  listTopologies(): string[] {
    return Object.keys(topologies)
  }

  // ---- nativeApi escape hatch (generic path for external consumers) ---

  async nativeApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case 'scenario.list':
        return this.listScenarios()
      case 'scenario.get':
        return this.getScenario(String(params['id']))
      case 'scenario.schema':
        return this.scenarioSchema()
      case 'topology.list':
        return this.listTopologies()
      default:
        throw new Error(`unknown nativeApi method '${method}'`)
    }
  }

  private allDocs(): ScenarioDoc[] {
    return Object.entries(scenarios).map(([key, yaml]) =>
      parseScenarioDoc(yaml, sampleOfScenarioKey(key)),
    )
  }
}
