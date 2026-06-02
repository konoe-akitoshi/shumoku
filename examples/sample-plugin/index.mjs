// Sample external data source plugin — a worked example for
// docs/plugin-authoring.md. Plain ESM (what an external plugin ships); it
// imports NOTHING from the host. The whole point: this plugin reaches the UI
// (config form, capability dispatch, validation) purely through its descriptor
// — adding it requires ZERO edits to @shumoku/core or the web app.

/**
 * Connection config schema. The host renders this with its generic SchemaForm —
 * no per-plugin form code. Mirrors plugin.json's configSchema (the manifest is
 * what the loader reads; this copy keeps register() self-contained).
 */
const configSchema = {
  type: 'object',
  required: ['label'],
  properties: {
    label: {
      type: 'string',
      title: 'Host label prefix',
      placeholder: 'host',
      help: 'Each generated host is named <label>-N.',
    },
    hostCount: {
      type: 'number',
      title: 'How many hosts',
      default: 3,
      minimum: 1,
      maximum: 50,
      step: 1,
    },
    region: {
      type: 'string',
      title: 'Region',
      default: 'tokyo',
      oneOf: [
        { const: 'tokyo', title: 'Tokyo' },
        { const: 'osaka', title: 'Osaka' },
        { const: 'global', title: 'Global' },
      ],
    },
    tags: { type: 'array', items: { type: 'string' }, freeSolo: true, title: 'Tags' },
    verbose: { type: 'boolean', title: 'Verbose logging', default: false },
  },
}

/**
 * Implements DataSourcePlugin + HostsCapable. The registry verifies at first
 * instantiate that a plugin advertising `hosts` actually has `getHosts`.
 */
export class SampleHostsPlugin {
  type = 'sample-hosts'
  displayName = 'Sample Hosts'
  capabilities = ['hosts']

  initialize(config) {
    this.config = config ?? {}
  }

  async testConnection() {
    return { success: true, message: `Sample plugin OK (region: ${this.config.region ?? 'tokyo'})` }
  }

  async getHosts() {
    const label = this.config.label ?? 'host'
    const count = this.config.hostCount ?? 3
    return Array.from({ length: count }, (_, i) => ({
      id: `sample-${i + 1}`,
      name: `${label}-${i + 1}`,
      status: 'up',
    }))
  }
}

/**
 * Entry point the loader calls. registerDescriptor carries the configSchema, so
 * the host renders the form and validates config from it — bundled and external
 * plugins use the exact same path.
 */
export function register(registry) {
  registry.registerDescriptor(
    {
      type: 'sample-hosts',
      displayName: 'Sample Hosts',
      capabilities: ['hosts'],
      version: '1.0.0',
      configSchema,
    },
    (config) => {
      const plugin = new SampleHostsPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}
