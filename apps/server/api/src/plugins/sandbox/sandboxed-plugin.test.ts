// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { hasNativeApi, missingCapabilityMethods } from '@shumoku/core'
import { describe, expect, it, vi } from 'vitest'
import { loadSandboxedPlugin } from './sandboxed-plugin.js'

const NOOP_FETCH_IMPL = async () => new Response(null, { status: 501 })

const here = dirname(fileURLToPath(import.meta.url))
const SAMPLE_BUNDLE_PATH = join(
  here,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'examples',
  'sample-plugin',
  'index.mjs',
)
const sampleBundleSource = readFileSync(SAMPLE_BUNDLE_PATH, 'utf-8')

describe('loadSandboxedPlugin', () => {
  it("extracts the bundle's descriptor, and its factory returns a proxy carrying it", async () => {
    const { descriptor, factory } = await loadSandboxedPlugin(sampleBundleSource, {
      fetchImpl: NOOP_FETCH_IMPL,
    })

    expect(descriptor.type).toBe('sample-hosts')
    expect(descriptor.capabilities).toEqual(['hosts'])
    expect(descriptor.configSchema?.properties.label).toMatchObject({ type: 'string' })

    const plugin = await factory({ label: 'web', hostCount: 2 })

    expect(plugin.type).toBe('sample-hosts')
    expect(plugin.displayName).toBe('Sample Hosts')
    expect(plugin.capabilities).toEqual(['hosts'])
    expect(missingCapabilityMethods(plugin)).toEqual([])
  })

  it('rejects a bundle using the legacy registry.register(), pointing at registerDescriptor()', async () => {
    const legacyBundle = `
      export function register(registry) {
        registry.register('legacy-sample', 'Legacy Sample', ['hosts'], () => ({}))
      }
    `

    await expect(loadSandboxedPlugin(legacyBundle, { fetchImpl: NOOP_FETCH_IMPL })).rejects.toThrow(
      /registry\.register\(\) is not supported/,
    )
  })

  it('getHosts() matches running the same plugin in-process', async () => {
    type HostsPlugin = { getHosts(): Promise<unknown[]> }
    let inProcessFactory: ((config: unknown) => HostsPlugin) | undefined
    const inProcessModule = await import(pathToFileURL(SAMPLE_BUNDLE_PATH).href)
    inProcessModule.register({
      registerDescriptor(_descriptor: unknown, factory: (config: unknown) => HostsPlugin) {
        inProcessFactory = factory
      },
      register() {
        throw new Error('sample should use registerDescriptor')
      },
    })
    const inProcessHosts = await inProcessFactory?.({ label: 'web', hostCount: 2 }).getHosts()

    const { factory } = await loadSandboxedPlugin(sampleBundleSource, {
      fetchImpl: NOOP_FETCH_IMPL,
    })
    const sandboxedHosts = await (
      (await factory({ label: 'web', hostCount: 2 })) as unknown as HostsPlugin
    ).getHosts()

    expect(sandboxedHosts).toEqual(inProcessHosts)
  })

  it('a method the guest instance does not have is absent from the proxy (duck-typing stays false)', async () => {
    const { factory } = await loadSandboxedPlugin(sampleBundleSource, {
      fetchImpl: NOOP_FETCH_IMPL,
    })
    const plugin = await factory({ label: 'web', hostCount: 2 })

    expect(hasNativeApi(plugin)).toBe(false)
    expect('nativeApi' in plugin).toBe(false)
  })

  it('an internal-only method not in the DataSourcePlugin contract (e.g. NetBox-style fetchCircuitData) is not exposed', async () => {
    const bundleWithInternalMethod = `
      class InternalMethodPlugin {
        type = 'internal-method-sample'
        displayName = 'Internal Method Sample'
        capabilities = ['topology']

        initialize(config) {
          this.config = config ?? {}
        }

        async testConnection() {
          return { success: true, message: 'ok' }
        }

        async fetchTopology() {
          const circuits = await this.fetchCircuitData()
          return { name: 'sample', nodes: [], links: [], circuits }
        }

        // Internal helper fetchTopology() happens to call — not part of the
        // DataSourcePlugin contract, so it must not reach the proxy.
        async fetchCircuitData() {
          return ['circuit-1']
        }
      }

      export function register(registry) {
        registry.registerDescriptor(
          {
            type: 'internal-method-sample',
            displayName: 'Internal Method Sample',
            capabilities: ['topology'],
          },
          (config) => {
            const plugin = new InternalMethodPlugin()
            plugin.initialize(config)
            return plugin
          },
        )
      }
    `

    const { factory } = await loadSandboxedPlugin(bundleWithInternalMethod, {
      fetchImpl: NOOP_FETCH_IMPL,
    })
    const plugin = await factory({})

    expect('fetchCircuitData' in plugin).toBe(false)
    const graph = await (
      plugin as unknown as { fetchTopology(): Promise<{ circuits: string[] }> }
    ).fetchTopology()
    expect(graph.circuits).toEqual(['circuit-1'])
  })

  it('a sync method (getConnectionInfo) returns its value synchronously, not a Promise', async () => {
    const bundleWithConnectionInfo = `
      class ConnectionInfoPlugin {
        type = 'connection-info-sample'
        displayName = 'Connection Info Sample'
        capabilities = []

        initialize(config) {
          this.config = config ?? {}
        }

        async testConnection() {
          return { success: true, message: 'ok' }
        }

        getConnectionInfo(config, ctx) {
          return [{ label: 'Webhook URL', value: \`\${ctx.serverOrigin}/api/webhooks/x/\${ctx.dataSourceId}\` }]
        }
      }

      export function register(registry) {
        registry.registerDescriptor(
          {
            type: 'connection-info-sample',
            displayName: 'Connection Info Sample',
            capabilities: [],
          },
          (config) => {
            const plugin = new ConnectionInfoPlugin()
            plugin.initialize(config)
            return plugin
          },
        )
      }
    `

    const { factory } = await loadSandboxedPlugin(bundleWithConnectionInfo, {
      fetchImpl: NOOP_FETCH_IMPL,
    })
    const plugin = (await factory({})) as unknown as {
      getConnectionInfo(
        config: unknown,
        ctx: { dataSourceId: string; serverOrigin: string },
      ): Array<{ label: string; value: string }>
    }

    const result = plugin.getConnectionInfo(
      {},
      { dataSourceId: 'ds-1', serverOrigin: 'https://host:8080' },
    )

    expect(result).not.toBeInstanceOf(Promise)
    expect(result).toEqual([
      { label: 'Webhook URL', value: 'https://host:8080/api/webhooks/x/ds-1' },
    ])
  })

  it('a guest-thrown exception rejects on the host with its original name and message', async () => {
    const bundleThatThrows = `
      class ThrowingPlugin {
        type = 'throwing-sample'
        displayName = 'Throwing Sample'
        capabilities = []

        initialize(config) {
          this.config = config ?? {}
        }

        async testConnection() {
          throw Object.assign(new Error('upstream is unreachable'), { name: 'AuthError' })
        }

        // Not async: throws before any Promise exists.
        getHosts() {
          throw new Error('bad state')
        }
      }

      export function register(registry) {
        registry.registerDescriptor(
          { type: 'throwing-sample', displayName: 'Throwing Sample', capabilities: ['hosts'] },
          (config) => {
            const plugin = new ThrowingPlugin()
            plugin.initialize(config)
            return plugin
          },
        )
      }
    `

    const { factory } = await loadSandboxedPlugin(bundleThatThrows, {
      fetchImpl: NOOP_FETCH_IMPL,
    })
    const plugin = await factory({})

    await expect(plugin.testConnection()).rejects.toMatchObject({
      name: 'AuthError',
      message: 'upstream is unreachable',
    })
    await expect(
      (plugin as unknown as { getHosts(): Promise<unknown> }).getHosts(),
    ).rejects.toThrow('bad state')
  })

  describe('interrupt deadline on bundle evaluation', () => {
    /** Busy-waits `ms` at module top level, like a large bundle's initialisation cost. */
    const slowTopLevelBundle = (ms: number) => `
      const until = Date.now() + ${ms}
      while (Date.now() < until) {}

      export function register(registry) {
        registry.registerDescriptor(
          { type: 'slow-sample', displayName: 'Slow Sample', capabilities: ['hosts'] },
          () => ({
            type: 'slow-sample',
            displayName: 'Slow Sample',
            capabilities: ['hosts'],
            async testConnection() {
              return { success: true, message: 'ok' }
            },
            async getHosts() {
              return []
            },
          }),
        )
      }
    `

    it('gives bundle evaluation its own, longer deadline than a method call', async () => {
      const { factory } = await loadSandboxedPlugin(slowTopLevelBundle(150), {
        fetchImpl: NOOP_FETCH_IMPL,
        interruptAfterMs: 50,
      })

      // factory() re-evaluates the bundle in a fresh VM, so it pays the
      // same top-level cost and must get the same longer deadline.
      const plugin = (await factory({})) as unknown as {
        getHosts(): Promise<unknown[]>
        dispose(): void
      }
      await expect(plugin.getHosts()).resolves.toEqual([])
      plugin.dispose()
    })

    it('still interrupts a bundle whose top level never finishes', async () => {
      await expect(
        loadSandboxedPlugin('while (true) {}\nexport function register() {}', {
          fetchImpl: NOOP_FETCH_IMPL,
          bundleEvalInterruptAfterMs: 100,
        }),
      ).rejects.toThrow(/interrupted/)
    })
  })

  describe('interrupt deadline on plugin method calls', () => {
    const bundleWithLoops = `
      let calls = 0

      class LoopingPlugin {
        type = 'looping-sample'
        displayName = 'Looping Sample'
        capabilities = ['hosts']

        initialize(config) {
          this.config = config ?? {}
        }

        async testConnection() {
          return { success: true, message: 'ok' }
        }

        // Loops forever on the first call only, so a follow-up call shows the
        // instance is still usable after the interrupt.
        async getHosts() {
          calls += 1
          if (calls === 1) while (true) {}
          return [{ id: 'h', name: 'h', status: 'up' }]
        }

        getConnectionInfo() {
          while (true) {}
        }

        // Loops only after an await — i.e. on a later host→guest entry
        // (timer callback), not in the method call's own synchronous part.
        async discoverMetrics() {
          await new Promise((resolve) => setTimeout(resolve, 10))
          while (true) {}
        }

      }

      export function register(registry) {
        registry.registerDescriptor(
          { type: 'looping-sample', displayName: 'Looping Sample', capabilities: ['hosts'] },
          (config) => {
            const plugin = new LoopingPlugin()
            plugin.initialize(config)
            return plugin
          },
        )
      }
    `
    type LoopingPlugin = {
      getHosts(): Promise<unknown[]>
      getConnectionInfo(): unknown
      discoverMetrics(): Promise<unknown>
    }

    async function loadLoopingPlugin(): Promise<LoopingPlugin> {
      const { factory } = await loadSandboxedPlugin(bundleWithLoops, {
        fetchImpl: NOOP_FETCH_IMPL,
        interruptAfterMs: 50,
      })
      return (await factory({})) as unknown as LoopingPlugin
    }

    it('interrupts an infinite loop in an async method, and the instance keeps working', async () => {
      const plugin = await loadLoopingPlugin()

      await expect(plugin.getHosts()).rejects.toThrow(/interrupted/)
      await expect(plugin.getHosts()).resolves.toEqual([{ id: 'h', name: 'h', status: 'up' }])
    })

    it('interrupts an infinite loop in a sync method', async () => {
      const plugin = await loadLoopingPlugin()

      expect(() => plugin.getConnectionInfo()).toThrow(/interrupted/)
    })

    it('interrupts an infinite loop that starts after an await (a later host→guest entry)', async () => {
      const plugin = await loadLoopingPlugin()

      await expect(plugin.discoverMetrics()).rejects.toThrow(/interrupted/)
    })
  })

  it("each instance's fetch is gated by its own config's policy, even while another instance's call is in flight", async () => {
    // `url` is the only `format: 'uri'` field, so it alone opens egress;
    // `probeTarget` is a plain string pointing at the *other* instance's host.
    const bundleWithFetch = `
      export function register(registry) {
        registry.registerDescriptor(
          {
            type: 'fetch-sample',
            displayName: 'Fetch Sample',
            capabilities: ['hosts'],
            configSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'uri' },
                probeTarget: { type: 'string' },
              },
            },
          },
          (config) => ({
            type: 'fetch-sample',
            displayName: 'Fetch Sample',
            capabilities: ['hosts'],
            async testConnection() {
              return { success: true, message: 'ok' }
            },
            async getHosts() {
              const own = await (await fetch(config.url + '/own')).text()
              let foreign
              try {
                await fetch(config.probeTarget + '/steal')
                foreign = 'allowed'
              } catch {
                foreign = 'denied'
              }
              return [{ id: own, name: foreign, status: 'up' }]
            },
          }),
        )
      }
    `

    const requestedUrls: string[] = []
    let releaseA: () => void = () => {}
    const aReleased = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    const fetchImpl = async (url: string) => {
      requestedUrls.push(url)
      // Hold A's own request open until B's whole call has run, so B's
      // fetches happen while A's call is still in flight.
      if (url.startsWith('https://a.example.com')) await aReleased
      return new Response(new URL(url).host)
    }

    const { factory } = await loadSandboxedPlugin(bundleWithFetch, { fetchImpl })
    type FetchPlugin = {
      getHosts(): Promise<Array<{ id: string; name: string }>>
      dispose(): void
    }
    const pluginA = (await factory({
      url: 'https://a.example.com',
      probeTarget: 'https://b.example.com',
    })) as unknown as FetchPlugin
    const pluginB = (await factory({
      url: 'https://b.example.com',
      probeTarget: 'https://a.example.com',
    })) as unknown as FetchPlugin

    const hostsA = pluginA.getHosts()
    const hostsB = await pluginB.getHosts()
    releaseA()

    expect(hostsB).toEqual([{ id: 'b.example.com', name: 'denied', status: 'up' }])
    expect(await hostsA).toEqual([{ id: 'a.example.com', name: 'denied', status: 'up' }])
    // Denied probes never reach fetchImpl at all.
    expect(requestedUrls.sort()).toEqual(['https://a.example.com/own', 'https://b.example.com/own'])
    pluginA.dispose()
    pluginB.dispose()
  })

  it('disposing one instance frees only its own VM: other instances (and new ones) keep working', async () => {
    const { factory } = await loadSandboxedPlugin(sampleBundleSource, {
      fetchImpl: NOOP_FETCH_IMPL,
    })
    type HostsPlugin = { getHosts(): Promise<unknown[]>; dispose(): void }
    const disposed = (await factory({ label: 'web', hostCount: 2 })) as unknown as HostsPlugin
    const survivor = (await factory({ label: 'db', hostCount: 1 })) as unknown as HostsPlugin
    const expectedSurvivorHosts = await survivor.getHosts()

    disposed.dispose()

    await expect(disposed.getHosts()).rejects.toThrow()
    await expect(survivor.getHosts()).resolves.toEqual(expectedSurvivorHosts)
    const fresh = (await factory({ label: 'web', hostCount: 2 })) as unknown as HostsPlugin
    await expect(fresh.getHosts()).resolves.toHaveLength(2)
    survivor.dispose()
    fresh.dispose()
  })

  it('one instance exhausting its memory leaves another instance of the same plugin unaffected', async () => {
    // `hoard` keeps everything it allocates reachable (module-level), so it
    // is live memory, not garbage: nothing can reclaim it for others.
    const bundleWithHoard = `
      const hoard = []

      export function register(registry) {
        registry.registerDescriptor(
          { type: 'hoard-sample', displayName: 'Hoard Sample', capabilities: ['hosts'] },
          (config) => ({
            type: 'hoard-sample',
            displayName: 'Hoard Sample',
            capabilities: ['hosts'],
            async testConnection() {
              return { success: true, message: 'ok' }
            },
            async getHosts() {
              if (config.hoard) for (;;) hoard.push('x'.repeat(100_000) + hoard.length)
              const scratch = Array.from({ length: 40 }, (_, i) => 'y'.repeat(100_000) + i)
              return [{ id: 'h', name: String(scratch.length), status: 'up' }]
            },
          }),
        )
      }
    `
    const { factory } = await loadSandboxedPlugin(bundleWithHoard, {
      fetchImpl: NOOP_FETCH_IMPL,
      memoryLimitBytes: 16 * 1024 * 1024,
      interruptAfterMs: 5000,
    })
    type HostsPlugin = { getHosts(): Promise<Array<{ name: string }>>; dispose(): void }
    const hoarder = (await factory({ hoard: true })) as unknown as HostsPlugin
    const neighbour = (await factory({ hoard: false })) as unknown as HostsPlugin

    await expect(hoarder.getHosts()).rejects.toThrow(/out of memory/)

    await expect(neighbour.getHosts()).resolves.toEqual([{ id: 'h', name: '40', status: 'up' }])
    hoarder.dispose()
    neighbour.dispose()
  })

  it('rejects an async method call that never settles once the call timeout passes', async () => {
    const bundleThatNeverSettles = `
      export function register(registry) {
        registry.registerDescriptor(
          { type: 'stuck-sample', displayName: 'Stuck Sample', capabilities: ['hosts'] },
          () => ({
            type: 'stuck-sample',
            displayName: 'Stuck Sample',
            capabilities: ['hosts'],
            async testConnection() {
              return { success: true, message: 'ok' }
            },
            // A guest that forgets to settle: no loop, no error — just never done.
            getHosts() {
              return new Promise(() => {})
            },
          }),
        )
      }
    `
    const { factory } = await loadSandboxedPlugin(bundleThatNeverSettles, {
      fetchImpl: NOOP_FETCH_IMPL,
      methodTimeoutMs: 100,
    })
    type StuckPlugin = {
      getHosts(): Promise<unknown[]>
      testConnection(): Promise<unknown>
      dispose(): void
    }
    const plugin = (await factory({})) as unknown as StuckPlugin

    await expect(plugin.getHosts()).rejects.toThrow(
      /stuck-sample\.getHosts\(\) did not settle within 100ms/,
    )
    await expect(plugin.testConnection()).resolves.toEqual({ success: true, message: 'ok' })
    plugin.dispose()
  })

  it('two factory() calls on the same loaded plugin do not share module-level state', async () => {
    const bundleWithModuleState = `
      let counter = 0

      export function register(registry) {
        registry.registerDescriptor(
          { type: 'counter-sample', displayName: 'Counter Sample', capabilities: ['hosts'] },
          () => ({
            type: 'counter-sample',
            displayName: 'Counter Sample',
            capabilities: ['hosts'],
            async testConnection() {
              return { success: true, message: 'ok' }
            },
            async getHosts() {
              counter += 1
              return [{ id: 'counter', name: 'counter', status: 'up', count: counter }]
            },
          }),
        )
      }
    `

    const { factory } = await loadSandboxedPlugin(bundleWithModuleState, {
      fetchImpl: NOOP_FETCH_IMPL,
    })
    type CounterPlugin = { getHosts(): Promise<Array<{ count: number }>>; dispose(): void }
    const plugin1 = (await factory({})) as unknown as CounterPlugin
    const plugin2 = (await factory({})) as unknown as CounterPlugin

    const hosts1 = await plugin1.getHosts()
    const hosts2 = await plugin2.getHosts()

    expect(hosts1[0]?.count).toBe(1)
    expect(hosts2[0]?.count).toBe(1)
    plugin1.dispose()
    plugin2.dispose()
  })

  it.each([
    [
      'imports a module',
      `import fs from 'node:fs'\nexport function register() {}`,
      /^Cannot import "node:fs": a sandboxed plugin must be a single-file ESM bundle/,
    ],
    [
      'does not export register()',
      'export const x = 1',
      'Plugin bundle does not export a register() function',
    ],
    [
      'never calls registerDescriptor()',
      'export function register() {}',
      'Plugin bundle did not call registerDescriptor() from register()',
    ],
  ])('rejects a bundle that %s', async (_label, bundle, expected) => {
    await expect(loadSandboxedPlugin(bundle, { fetchImpl: NOOP_FETCH_IMPL })).rejects.toThrow(
      expected,
    )
  })

  it('interrupts a never-ending bundle top level at the default 2s deadline', async () => {
    const startedAt = performance.now()
    await expect(
      loadSandboxedPlugin('while (true) {}\nexport function register() {}', {
        fetchImpl: NOOP_FETCH_IMPL,
      }),
    ).rejects.toThrow(/interrupted/)
    expect(performance.now() - startedAt).toBeLessThan(3000)
  })

  it('lets no fetch out while reading the descriptor, whatever the config will allow', async () => {
    const bundleFetchingAtTopLevel = `
      fetch('https://netbox.example.com/probe').catch(() => {})

      export function register(registry) {
        registry.registerDescriptor(
          {
            type: 'top-level-fetch-sample',
            displayName: 'Top-level Fetch Sample',
            capabilities: [],
            configSchema: { type: 'object', properties: { url: { type: 'string', format: 'uri' } } },
          },
          () => ({}),
        )
      }
    `
    let called = false
    const fetchImpl = async () => {
      called = true
      return new Response('')
    }

    await loadSandboxedPlugin(bundleFetchingAtTopLevel, { fetchImpl })

    expect(called).toBe(false)
  })

  describe('dispose()', () => {
    // getHosts() leaves a fetch in flight; the guest's own dispose() logs,
    // and throws when asked to.
    const bundleWithDispose = `
      export function register(registry) {
        registry.registerDescriptor(
          {
            type: 'dispose-sample',
            displayName: 'Dispose Sample',
            capabilities: ['hosts'],
            configSchema: { type: 'object', properties: { url: { type: 'string', format: 'uri' } } },
          },
          (config) => ({
            type: 'dispose-sample',
            displayName: 'Dispose Sample',
            capabilities: ['hosts'],
            async testConnection() {
              return { success: true, message: 'ok' }
            },
            async getHosts() {
              await fetch(config.url + '/hosts')
              return []
            },
            dispose() {
              console.log('guest dispose')
              if (config.throwOnDispose) throw new Error('dispose failed')
            },
          }),
        )
      }
    `

    it.each([
      ['returns normally', false],
      ['throws', true],
    ])(
      "calls the guest's dispose() once and frees the VM when the guest's dispose() %s",
      async (_label, throwOnDispose) => {
        const hostConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const guestLogs: string[] = []
        let hostSignal: AbortSignal | undefined
        const fetchImpl = (_url: string, init?: RequestInit) =>
          new Promise<Response>(() => {
            hostSignal = init?.signal ?? undefined
          })
        const { factory } = await loadSandboxedPlugin(bundleWithDispose, {
          fetchImpl,
          consoleImpl: (_level, message) => guestLogs.push(message),
        })
        const plugin = (await factory({
          url: 'https://netbox.example.com',
          throwOnDispose,
        })) as unknown as { getHosts(): Promise<unknown[]>; dispose(): void }
        plugin.getHosts().catch(() => {})
        await vi.waitFor(() => expect(hostSignal).toBeDefined())

        plugin.dispose()
        plugin.dispose()
        hostConsoleError.mockRestore()

        expect(guestLogs).toEqual(['guest dispose'])
        // The VM going away aborts the fetch it still had in flight.
        expect(hostSignal?.aborted).toBe(true)
      },
    )
  })

  it('frees the VM when the guest factory throws', async () => {
    // A top-level timer that only a live VM would ever fire.
    const bundleWithFailingFactory = `
      setTimeout(() => console.log('timer in a leaked VM'), 20)

      export function register(registry) {
        registry.registerDescriptor(
          { type: 'failing-factory-sample', displayName: 'Failing Factory Sample', capabilities: [] },
          () => {
            throw new Error('bad config')
          },
        )
      }
    `
    const guestLogs: string[] = []
    const { factory } = await loadSandboxedPlugin(bundleWithFailingFactory, {
      fetchImpl: NOOP_FETCH_IMPL,
      consoleImpl: (_level, message) => guestLogs.push(message),
    })

    await expect(factory({})).rejects.toThrow('bad config')
    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(guestLogs).toEqual([])
  })
})
