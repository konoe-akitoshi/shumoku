// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type {
  AlertsCapable,
  AutoscanCapable,
  ConfigOptionsCapable,
  ConnectionInfoCapable,
  DataSourcePlugin,
  HostsCapable,
  MetricsCapable,
  NativeApiCapable,
  PluginDescriptor,
  TopologyCapable,
} from '@shumoku/core'
import { EvalFlags, type JSValueHandle } from 'quickjs-wasi'
import { buildNetPolicy, type NetPolicy } from './net-policy.js'
import {
  awaitGuestPromise,
  createSandboxVm,
  type SandboxVm,
  type SandboxVmOptions,
} from './quickjs-vm.js'

/**
 * Everything a plugin instance's VM needs except its network policy, which
 * is never caller-supplied: each `factory(config)` call derives it from that
 * call's own `config` (see `loadSandboxedPlugin`).
 */
export type SandboxedPluginOptions = Omit<SandboxVmOptions, 'policy'> & {
  /** Deadline for evaluating the bundle's top level + `register()`. Defaults to 2s. */
  bundleEvalInterruptAfterMs?: number
  /** Upper bound on one async method call, start to settle. Defaults to 60s. */
  methodTimeoutMs?: number
}

/**
 * Evaluating a bundle is a one-off per VM, and a real one is big: the ~1MB
 * NetBox bundle took ~80-110ms to evaluate — too close to a method call's
 * 200ms default to share that deadline. It still gets one, so a top level
 * that never finishes can't hang the Server.
 */
const DEFAULT_BUNDLE_EVAL_INTERRUPT_AFTER_MS = 2000

/**
 * The interrupt deadline bounds each stretch of guest execution and a dying
 * job fails its VM's pending calls (see `drainJobs`), but a guest can still
 * simply never settle its promise — and the host (a health check, a poll)
 * would wait forever. Longer than a sandboxed fetch's own 30s timeout, so a
 * slow upstream fails as a fetch error rather than as this.
 */
const DEFAULT_METHOD_TIMEOUT_MS = 60_000

/** The descriptor-reading VM runs no instance, so it gets no egress at all. */
const DENY_ALL_POLICY: NetPolicy = { allowedOrigins: [] }

export interface LoadedSandboxedPlugin {
  descriptor: PluginDescriptor
  /** Async: every instance gets its own VM, and creating one is async. */
  factory: (config: unknown) => Promise<DataSourcePlugin>
}

/**
 * A method whose return value isn't itself a plain callable — excludes the
 * callback-based optionals (`watchTopology`/`subscribeMetrics`/
 * `subscribeProgress`), which all return a live "unsubscribe" function that
 * can't cross the JSON boundary. `T[K]` is checked via `NonNullable` so an
 * optional method (`foo?(): ...`) is judged by its function type, not by the
 * `| undefined` the optional modifier adds to it.
 */
type PlainMethodKeys<T> = {
  // biome-ignore lint/suspicious/noExplicitAny: matching an arbitrary method's parameter shape at the type level needs `any`, same as lib.es5.d.ts's own Parameters/ReturnType
  [K in keyof T]-?: NonNullable<T[K]> extends (...args: any[]) => infer R
    ? // biome-ignore lint/suspicious/noExplicitAny: same as above
      R extends (...args: any[]) => unknown
      ? never
      : K
    : never
}[keyof T]

/**
 * Every `DataSourcePlugin` method with a plain request/response shape (JSON
 * args in, JSON-or-void out) that the proxy can dispatch generically —
 * derived structurally from core's actual interfaces (via `PlainMethodKeys`)
 * rather than a hand-picked list of names, so it can't drift from them.
 *
 * Limits of this check (still true, just narrower than "any core change is
 * caught"): a brand-new `*Capable` mixin in plugin-types.ts isn't picked up
 * until its `PlainMethodKeys<...>` is added to the union below by hand — a
 * new interface's mere existence isn't something `keyof` can discover. And
 * this only guards core's *contract* interfaces; an individual plugin's own
 * extra methods (e.g. NetBox's `fetchCircuitData`) are untyped guest JS and
 * are filtered at runtime instead (see `presentMethodNames`), by design.
 */
type PlainMethodName =
  | PlainMethodKeys<DataSourcePlugin>
  | PlainMethodKeys<TopologyCapable>
  | PlainMethodKeys<HostsCapable>
  | PlainMethodKeys<MetricsCapable>
  | PlainMethodKeys<AlertsCapable>
  | PlainMethodKeys<AutoscanCapable>
  | PlainMethodKeys<NativeApiCapable>
  | PlainMethodKeys<ConfigOptionsCapable>
  | PlainMethodKeys<ConnectionInfoCapable>

/**
 * `PlainMethodName` is derived, not written by hand — but TypeScript has no
 * way to turn a type back into a runtime array. Writing it as a
 * `Record<PlainMethodName, true>` (rather than a bare string array) still
 * gets a compile-time check: an excess or missing key fails to build if this
 * list and `PlainMethodName` ever disagree.
 */
const PLUGIN_METHODS: Record<PlainMethodName, true> = {
  initialize: true,
  testConnection: true,
  dispose: true,
  fetchTopology: true,
  getHosts: true,
  getHostItems: true,
  getInterfaceNeighbors: true,
  searchHosts: true,
  discoverMetrics: true,
  pollMetrics: true,
  getAlerts: true,
  scan: true,
  nativeApi: true,
  getConfigOptions: true,
  getConnectionInfo: true,
}
const PLUGIN_METHOD_NAMES = Object.keys(PLUGIN_METHODS) as PlainMethodName[]

/** Methods whose `DataSourcePlugin` signature returns a plain value, not a `Promise`. */
const SYNC_METHOD_NAMES: ReadonlySet<PlainMethodName> = new Set([
  'initialize',
  'dispose',
  'getConnectionInfo',
])

/** Calls `instance[methodName](...args)` with JSON args; returns the raw result handle. */
function callInstanceMethod(
  sandboxVm: SandboxVm,
  instance: JSValueHandle,
  methodName: string,
  args: readonly unknown[],
): JSValueHandle {
  const { vm, enter, toGuest } = sandboxVm
  return enter(() => {
    using method = instance.getProp(methodName)
    const argHandles = args.map((arg) => toGuest(arg))
    try {
      return vm.callFunction(method, instance, ...argHandles)
    } finally {
      for (const handle of argHandles) handle.dispose()
    }
  })
}

function callInstanceMethodSync(
  sandboxVm: SandboxVm,
  instance: JSValueHandle,
  methodName: string,
  args: readonly unknown[],
): unknown {
  using result = callInstanceMethod(sandboxVm, instance, methodName, args)
  return sandboxVm.enter(() => sandboxVm.fromGuest(result))
}

async function callInstanceMethodAsync(
  sandboxVm: SandboxVm,
  instance: JSValueHandle,
  call: { pluginType: string; methodName: string; timeoutMs: number },
  args: readonly unknown[],
): Promise<unknown> {
  const { pluginType, methodName, timeoutMs } = call
  using promise = callInstanceMethod(sandboxVm, instance, methodName, args)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${pluginType}.${methodName}() did not settle within ${timeoutMs}ms`)),
      timeoutMs,
    )
  })
  const guestSettled = awaitGuestPromise(sandboxVm, promise)
  try {
    using settled = await Promise.race([guestSettled, timedOut])
    return sandboxVm.enter(() => sandboxVm.fromGuest(settled))
  } catch (error) {
    // Timed out: whatever the guest settles with later has no one waiting —
    // free a late value, and don't let a late rejection go unhandled.
    guestSettled.then(
      (late) => late.dispose(),
      () => {},
    )
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** Which `PLUGIN_METHOD_NAMES` this instance actually implements — duck-typed, like the host's own `hasNativeApi` etc. */
function presentMethodNames(
  { enter }: SandboxVm,
  instance: JSValueHandle,
): ReadonlySet<PlainMethodName> {
  return enter(
    () =>
      new Set(
        PLUGIN_METHOD_NAMES.filter((name) => {
          using prop = instance.getProp(name)
          return prop.typeof === 'function'
        }),
      ),
  )
}

/**
 * Builds the `DataSourcePlugin`-shaped proxy the registry sees: only the
 * methods the guest instance actually implements are exposed, each
 * forwarding to it with JSON-in/JSON-out across the sandbox boundary.
 */
function buildPluginProxy(
  sandboxVm: SandboxVm,
  descriptor: PluginDescriptor,
  instance: JSValueHandle,
  methodTimeoutMs: number,
): DataSourcePlugin {
  const present = presentMethodNames(sandboxVm, instance)
  const proxy: Record<string, unknown> = {
    type: descriptor.type,
    displayName: descriptor.displayName,
    capabilities: descriptor.capabilities,
  }

  for (const name of present) {
    if (name === 'dispose') continue
    proxy[name] = SYNC_METHOD_NAMES.has(name)
      ? (...args: unknown[]) => callInstanceMethodSync(sandboxVm, instance, name, args)
      : (...args: unknown[]) =>
          callInstanceMethodAsync(
            sandboxVm,
            instance,
            { pluginType: descriptor.type, methodName: name, timeoutMs: methodTimeoutMs },
            args,
          )
  }

  let disposed = false
  proxy['dispose'] = () => {
    if (disposed) return
    disposed = true
    if (present.has('dispose')) {
      try {
        callInstanceMethodSync(sandboxVm, instance, 'dispose', [])
      } catch (error) {
        console.error(`[Plugin sandbox] ${descriptor.type} dispose() failed:`, error)
      }
    }
    instance.dispose()
    // One VM lives for exactly one plugin instance's whole life (see
    // loadSandboxedPlugin), so the instance going away frees the VM too.
    sandboxVm.dispose()
  }

  return proxy as unknown as DataSourcePlugin
}

interface CapturedRegistration {
  descriptor: PluginDescriptor
  guestFactory: JSValueHandle
}

/**
 * Evaluates a plugin bundle (a single-file ESM with no imports) in
 * `sandboxVm` and calls its `register()` with a registry stand-in that only
 * records what gets registered, all under `deadlineMs`.
 */
async function evaluateBundle(
  sandboxVm: SandboxVm,
  bundleSource: string,
  deadlineMs: number,
): Promise<CapturedRegistration> {
  const { vm, enter } = sandboxVm
  using namespacePromise = enter(
    () => vm.evalCode(bundleSource, 'plugin.mjs', EvalFlags.TYPE_MODULE),
    deadlineMs,
  )
  // A module's body runs as a job, so draining the queue needs the bundle's
  // deadline too, not a method call's.
  using namespace = await awaitGuestPromise(sandboxVm, namespacePromise, deadlineMs)
  return enter(() => captureRegistration(sandboxVm, namespace), deadlineMs)
}

/** A registry stand-in: records what a plugin bundle registers without a real `PluginRegistry`. */
function captureRegistration(
  { vm, fromGuest }: SandboxVm,
  namespace: JSValueHandle,
): CapturedRegistration {
  let captured: CapturedRegistration | undefined

  using registry = vm.newObject()
  using registerDescriptorFn = vm.newFunction('registerDescriptor', (descriptorArg, factoryArg) => {
    captured = {
      descriptor: fromGuest(descriptorArg) as PluginDescriptor,
      guestFactory: factoryArg.dup(),
    }
    return vm.undefined
  })
  vm.setProp(registry, 'registerDescriptor', registerDescriptorFn)

  // The legacy `register(type, displayName, capabilities, factory)` form has
  // no `configSchema`, so a sandboxed instance would get no network egress at
  // all (its net policy is built from the schema's `format: 'uri'` fields).
  // Rather than a bare "not a function" from the guest, fail with a pointer.
  using registerFn = vm.newFunction('register', () => {
    throw new Error(
      'registry.register() is not supported for sandboxed plugins; ' +
        'use registry.registerDescriptor({ type, displayName, capabilities, configSchema }, factory)',
    )
  })
  vm.setProp(registry, 'register', registerFn)

  using registerExport = namespace.getProp('register')
  if (registerExport.typeof !== 'function') {
    throw new Error('Plugin bundle does not export a register() function')
  }
  vm.callFunction(registerExport, vm.undefined, registry).dispose()

  if (!captured) {
    throw new Error('Plugin bundle did not call registerDescriptor() from register()')
  }
  return captured
}

/** Evaluates the bundle into `sandboxVm` and creates the one plugin instance that VM will hold. */
async function instantiateInVm(
  sandboxVm: SandboxVm,
  bundleSource: string,
  bundleEvalDeadlineMs: number,
  config: unknown,
): Promise<JSValueHandle> {
  const { vm, enter, toGuest } = sandboxVm
  const registration = await evaluateBundle(sandboxVm, bundleSource, bundleEvalDeadlineMs)
  using guestFactory = registration.guestFactory
  using configHandle = toGuest(config)
  return enter(() => vm.callFunction(guestFactory, vm.undefined, configHandle))
}

/**
 * Reads a plugin bundle's descriptor from a throwaway VM, then returns an
 * async `factory` that gives every instance its own fresh VM, re-evaluating
 * the bundle there — so no two instances share module-level state, memory,
 * or GC, and each instance's host bridges belong to it alone. In particular
 * its `fetch` is gated by a policy built from that instance's own `config`
 * (the origins of its `format: 'uri'` fields), never another instance's.
 * Disposing an instance frees only its own VM.
 */
export async function loadSandboxedPlugin(
  bundleSource: string,
  options: SandboxedPluginOptions,
): Promise<LoadedSandboxedPlugin> {
  const bundleEvalDeadlineMs =
    options.bundleEvalInterruptAfterMs ?? DEFAULT_BUNDLE_EVAL_INTERRUPT_AFTER_MS

  const descriptor = await (async () => {
    using probe = await createSandboxVm({ ...options, policy: DENY_ALL_POLICY })
    const registration = await evaluateBundle(probe, bundleSource, bundleEvalDeadlineMs)
    registration.guestFactory.dispose()
    return registration.descriptor
  })()

  const factory = async (config: unknown): Promise<DataSourcePlugin> => {
    const sandboxVm = await createSandboxVm({
      ...options,
      policy: buildNetPolicy(descriptor.configSchema, config),
    })
    try {
      const instance = await instantiateInVm(sandboxVm, bundleSource, bundleEvalDeadlineMs, config)
      return buildPluginProxy(
        sandboxVm,
        descriptor,
        instance,
        options.methodTimeoutMs ?? DEFAULT_METHOD_TIMEOUT_MS,
      )
    } catch (error) {
      sandboxVm.dispose()
      throw error
    }
  }

  return { descriptor, factory }
}
