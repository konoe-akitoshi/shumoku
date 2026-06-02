/**
 * Plugin Registry
 *
 * Central registry for all data source plugins.
 * Plugins are registered at startup and can be instantiated on demand.
 */

import {
  type DataSourceCapability,
  type DataSourcePlugin,
  missingCapabilityMethods,
  type PluginDescriptor,
  type PluginFactory,
  type PluginRegistration,
} from '@shumoku/core'

class PluginRegistry {
  private plugins = new Map<string, PluginRegistration>()
  private instances = new Map<string, DataSourcePlugin>()

  /**
   * Register a plugin from its full self-description (preferred). Carries
   * configSchema / optionsSchema so bundled plugins describe themselves the
   * same way external ones do (closing the asymmetry where only external
   * plugins surfaced a configSchema).
   */
  registerDescriptor(descriptor: PluginDescriptor, factory: PluginFactory): void {
    if (this.plugins.has(descriptor.type)) {
      console.warn(
        `[PluginRegistry] Plugin "${descriptor.type}" is already registered, overwriting`,
      )
    }

    this.plugins.set(descriptor.type, { ...descriptor, factory })

    console.log(
      `[PluginRegistry] Registered plugin: ${descriptor.type} [${descriptor.capabilities.join(', ')}]`,
    )
  }

  /**
   * Back-compat 4-arg registration (no schema). Delegates to
   * `registerDescriptor`. Retained so existing external plugins and any
   * not-yet-migrated bundled plugin keep working unchanged.
   */
  register(
    type: string,
    displayName: string,
    capabilities: readonly DataSourceCapability[],
    factory: PluginFactory,
  ): void {
    this.registerDescriptor({ type, displayName, capabilities }, factory)
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

    // Factory is responsible for calling initialize
    const plugin = registration.factory(config)

    // Verify the instance actually implements every capability it advertises
    // (decision 7: check at first instantiate, not at registration — no dummy
    // construction). A misdeclared bundled plugin is a bug → throw in dev; in
    // production, log and proceed so one bad external plugin can't wedge boot.
    const missing = missingCapabilityMethods(plugin)
    if (missing.length > 0) {
      const message = `[PluginRegistry] "${type}" advertises capabilities it does not implement: ${missing.join(', ')}`
      if (process.env.NODE_ENV === 'production') {
        console.error(message)
      } else {
        throw new Error(message)
      }
    }

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
