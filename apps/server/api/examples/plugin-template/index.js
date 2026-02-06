/**
 * Example External Plugin Template
 *
 * This file demonstrates the structure of an external plugin.
 * Place this directory in your plugins path and reference it in plugins.yaml.
 */

/**
 * Register function - called by the plugin loader
 * @param {import('@shumoku/core').PluginRegistryInterface} pluginRegistry
 */
export function register(pluginRegistry) {
  pluginRegistry.register(
    'example-plugin',
    'Example Plugin',
    ['topology', 'hosts'],
    (config) => {
      const plugin = new ExamplePlugin()
      plugin.initialize(config)
      return plugin
    }
  )
}

/**
 * Example Plugin Implementation
 * Implements DataSourcePlugin, TopologyCapable, and HostsCapable interfaces
 */
export class ExamplePlugin {
  type = 'example-plugin'
  displayName = 'Example Plugin'
  capabilities = ['topology', 'hosts']

  /** @type {string} */
  url = ''
  /** @type {string} */
  token = ''

  /**
   * Initialize the plugin with configuration
   * @param {object} config
   * @param {string} config.url - API URL
   * @param {string} config.token - API Token
   */
  initialize(config) {
    this.url = config.url
    this.token = config.token
  }

  /**
   * Test connection to the data source
   * @returns {Promise<import('@shumoku/core').ConnectionResult>}
   */
  async testConnection() {
    try {
      // Example: Make a test API call
      const response = await fetch(`${this.url}/health`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      })

      if (response.ok) {
        return {
          success: true,
          message: 'Connected successfully',
          version: '1.0.0'
        }
      } else {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        }
      }
    } catch (err) {
      return {
        success: false,
        message: err.message
      }
    }
  }

  /**
   * Fetch the current topology
   * @param {Record<string, unknown>} [_options]
   * @returns {Promise<import('@shumoku/core').NetworkGraph>}
   */
  async fetchTopology(_options) {
    // Example: Fetch data from your API and convert to NetworkGraph
    // Replace this with your actual implementation

    return {
      version: '1.0',
      name: 'Example Topology',
      nodes: [
        { id: 'node-1', label: 'Example Node 1', shape: 'rect' },
        { id: 'node-2', label: 'Example Node 2', shape: 'rect' }
      ],
      links: [
        { from: 'node-1', to: 'node-2' }
      ]
    }
  }

  /**
   * Get all available hosts
   * @returns {Promise<import('@shumoku/core').Host[]>}
   */
  async getHosts() {
    // Example: Return a list of hosts for mapping UI
    return [
      { id: '1', name: 'host-1', displayName: 'Host 1', status: 'up' },
      { id: '2', name: 'host-2', displayName: 'Host 2', status: 'up' }
    ]
  }

  /**
   * Clean up resources (optional)
   */
  dispose() {
    // Clean up any resources if needed
  }
}
