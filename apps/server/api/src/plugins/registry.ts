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
} from '@shumoku/core'

/**
 * Core's `PluginFactory` is synchronous, and bundled plugins keep using it.
 * A sandboxed plugin's factory has to create a VM first, which is async, so
 * the Server's registry takes either. (Kept Server-side on purpose: widening
 * core's public type isn't needed for this.)
 */
export type ServerPluginFactory = (config: unknown) => DataSourcePlugin | Promise<DataSourcePlugin>

export interface ServerPluginRegistration extends PluginDescriptor {
  factory: ServerPluginFactory
}

interface CachedInstance {
  readonly type: string
  readonly plugin: Promise<DataSourcePlugin>
}

class PluginRegistry {
  private plugins = new Map<string, ServerPluginRegistration>()
  /**
   * Promises, not instances: an async factory takes time, and every caller
   * asking for the same data source meanwhile must share the one creation
   * rather than start its own.
   */
  private instances = new Map<string, CachedInstance>()

  /**
   * Register a plugin from its full self-description (preferred). Carries
   * configSchema / optionsSchema so bundled plugins describe themselves the
   * same way external ones do (closing the asymmetry where only external
   * plugins surfaced a configSchema).
   */
  registerDescriptor(descriptor: PluginDescriptor, factory: ServerPluginFactory): void {
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
  getRegisteredTypes(): ServerPluginRegistration[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get plugins with a specific capability
   */
  getPluginsWithCapability(capability: DataSourceCapability): ServerPluginRegistration[] {
    return this.getRegisteredTypes().filter((p) => p.capabilities.includes(capability))
  }

  /**
   * Create a new plugin instance
   */
  async create(type: string, config: unknown): Promise<DataSourcePlugin> {
    const registration = this.plugins.get(type)
    if (!registration) {
      throw new Error(`Unknown plugin type: ${type}`)
    }

    // Factory is responsible for calling initialize
    const plugin = await registration.factory(config)

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
   * Get or create a cached plugin instance by ID. Concurrent callers share one
   * creation; a failed one is forgotten so the next call tries again.
   */
  getInstance(instanceId: string, type: string, config: unknown): Promise<DataSourcePlugin> {
    const cached = this.instances.get(instanceId)
    if (cached) return cached.plugin

    const created = this.create(type, config)
    this.instances.set(instanceId, { type, plugin: created })
    created.catch(() => {
      if (this.instances.get(instanceId)?.plugin === created) this.instances.delete(instanceId)
    })
    return created
  }

  /**
   * Remove a cached instance. One still being created is disposed as soon as
   * it exists, since nothing will hold on to it any more.
   */
  removeInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId)
    if (!instance) return
    this.instances.delete(instanceId)
    disposeWhenCreated(instance.plugin)
  }

  /**
   * Clear all cached instances
   */
  clearInstances(): void {
    for (const instance of this.instances.values()) disposeWhenCreated(instance.plugin)
    this.instances.clear()
  }

  /**
   * Remove a plugin type and dispose every cached instance of it, so data
   * sources of that type stop running its code at once instead of at the next
   * restart. Instances are keyed by data source id, hence the scan by type.
   */
  unregister(type: string): void {
    this.plugins.delete(type)
    const ofType = [...this.instances].filter(([, instance]) => instance.type === type)
    for (const [instanceId] of ofType) this.removeInstance(instanceId)
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
  getInfo(type: string): ServerPluginRegistration | undefined {
    return this.plugins.get(type)
  }
}

function disposeWhenCreated(instance: Promise<DataSourcePlugin>): void {
  instance.then(
    (plugin) => plugin.dispose?.(),
    () => {
      // Creation failed: there is nothing to dispose.
    },
  )
}

// Global singleton registry
export const pluginRegistry = new PluginRegistry()
