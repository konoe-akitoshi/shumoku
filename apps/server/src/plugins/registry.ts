/**
 * Plugin Registry
 *
 * Central registry for all data source plugins.
 * Plugins are registered at startup and can be instantiated on demand.
 */

import type { DataSourcePlugin, DataSourceCapability } from './types.js'

export type PluginFactory = (config: unknown) => DataSourcePlugin

export interface PluginRegistration {
  type: string
  displayName: string
  capabilities: readonly DataSourceCapability[]
  factory: PluginFactory
}

class PluginRegistry {
  private plugins = new Map<string, PluginRegistration>()
  private instances = new Map<string, DataSourcePlugin>()

  /**
   * Register a plugin type
   */
  register(
    type: string,
    displayName: string,
    capabilities: readonly DataSourceCapability[],
    factory: PluginFactory,
  ): void {
    if (this.plugins.has(type)) {
      console.warn(`[PluginRegistry] Plugin "${type}" is already registered, overwriting`)
    }

    this.plugins.set(type, {
      type,
      displayName,
      capabilities,
      factory,
    })

    console.log(`[PluginRegistry] Registered plugin: ${type} [${capabilities.join(', ')}]`)
  }

  /**
   * Get all registered plugin types
   */
  getRegisteredTypes(): PluginRegistration[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get plugins with a specific capability
   */
  getPluginsWithCapability(capability: DataSourceCapability): PluginRegistration[] {
    return this.getRegisteredTypes().filter((p) => p.capabilities.includes(capability))
  }

  /**
   * Create a new plugin instance
   */
  create(type: string, config: unknown): DataSourcePlugin {
    const registration = this.plugins.get(type)
    if (!registration) {
      throw new Error(`Unknown plugin type: ${type}`)
    }

    const plugin = registration.factory(config)
    plugin.initialize(config)
    return plugin
  }

  /**
   * Get or create a cached plugin instance by ID
   */
  getInstance(instanceId: string, type: string, config: unknown): DataSourcePlugin {
    let instance = this.instances.get(instanceId)
    if (!instance) {
      instance = this.create(type, config)
      this.instances.set(instanceId, instance)
    }
    return instance
  }

  /**
   * Remove a cached instance
   */
  removeInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.dispose?.()
      this.instances.delete(instanceId)
    }
  }

  /**
   * Clear all cached instances
   */
  clearInstances(): void {
    for (const instance of this.instances.values()) {
      instance.dispose?.()
    }
    this.instances.clear()
  }

  /**
   * Check if a plugin type is registered
   */
  has(type: string): boolean {
    return this.plugins.has(type)
  }

  /**
   * Get plugin registration info
   */
  getInfo(type: string): PluginRegistration | undefined {
    return this.plugins.get(type)
  }
}

// Global singleton registry
export const pluginRegistry = new PluginRegistry()
