// Copyright (C) 2026 system_explorer contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Self-registration for the System Explorer plugin (see docs/plugin-authoring.md
// "Bundled plugins"). The host calls `register(registry)` at startup.

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { SystemExplorerPlugin } from './plugin.js'

export { SystemExplorerPlugin } from './plugin.js'
export { parseScenarioDoc } from './scenario/parse.js'
export {
  type EventColor,
  type Fact,
  type FlowEvent,
  type LayerSpec,
  type LocalEvent,
  type Outro,
  type Overview,
  type PacketNode,
  type PktEvent,
  type PktSpec,
  SCENARIO_JSON_SCHEMA,
  type ScenarioDoc,
  type ScenarioSummary,
  type Step,
} from './scenario/schema.js'
export type { SystemExplorerPluginConfig } from './types.js'

/**
 * Connection config. `sample` picks which bundled topology `fetchTopology()`
 * returns; `viewerUrl` is a standalone system_explorer deployment the host can
 * hand to the Embed widget.
 */
const configSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
    sample: {
      type: 'string',
      title: 'Sample',
      help: 'Which bundled sample to expose as the topology (default: the first).',
    },
    viewerUrl: {
      type: 'string',
      format: 'uri',
      title: 'Standalone viewer URL',
      help: 'Base URL of a deployed system_explorer (hash-routed SPA) for embedding.',
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'system-explorer',
      displayName: 'System Explorer',
      description:
        'Bundled public samples: authored topologies plus declarative protocol scenarios (step-by-step packet walkthroughs).',
      capabilities: ['topology', 'scenario'],
      configSchema,
    },
    (config) => {
      const plugin = new SystemExplorerPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}
