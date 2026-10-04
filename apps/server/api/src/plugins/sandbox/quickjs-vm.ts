// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type JSValueHandle, QuickJS } from 'quickjs-wasi'
import { type FetchImpl, type HostFetchRequest, hostFetch } from './host-fetch.js'
import type { NetPolicy } from './net-policy.js'

/**
 * One VM per data source: with quickjs-wasi each VM is its own WASM
 * instance holding one runtime and one context, so the memory limit, GC and
 * interrupt deadline all belong to that data source alone — one plugin
 * exhausting its heap or spinning forever can't take the others with it.
 * Only the compiled `WebAssembly.Module`s (machine code) are shared.
 */
export interface SandboxVmOptions {
  policy: NetPolicy
  fetchImpl: FetchImpl
  /** Defaults to 64MB per VM (i.e. per data source). */
  memoryLimitBytes?: number
  /** Each host→guest entry gets a fresh deadline this many ms out. Defaults to 200ms. */
  interruptAfterMs?: number
  /** The auto-GC trigger's cap, as a percentage of the memory limit. Defaults to 50. */
  gcThresholdPercent?: number
  /** Defaults to forwarding to the real console, prefixed `[Plugin sandbox]`. */
  consoleImpl?: (level: ConsoleLevel, message: string) => void
}

export type ConsoleLevel = 'log' | 'error' | 'warn' | 'info'

function defaultConsoleImpl(level: ConsoleLevel, message: string): void {
  console[level](`[Plugin sandbox] ${message}`)
}

export interface SandboxVm extends Disposable {
  vm: QuickJS
  /**
   * Runs `fn` — one top-level host→guest entry (a method call, a timer
   * firing, a fetch settling) — under a fresh interrupt deadline, lifted
   * again once control is back on the host so a slow-but-legitimate wait
   * (a fetch, a timer) never counts against the guest.
   */
  enter<T>(fn: () => T, deadlineMs?: number): T
  /**
   * A host JSON value as a guest value, through the guest's own `JSON.parse`.
   * Runs no guest code, so it needs no entry.
   */
  toGuest(value: unknown): JSValueHandle
  /**
   * A guest value as a host JSON value, through the guest's `JSON.stringify`
   * rather than `vm.dump()` (see `toHostError`); `undefined` stays
   * `undefined`. Can run guest code (`toJSON`, getters), so call it inside
   * an entry.
   */
  fromGuest(handle: JSValueHandle): unknown
  /**
   * Runs pending promise jobs. Call inside an entry. When a job dies of
   * something the guest can't catch (an interrupt, an OOM), quickjs-wasi
   * throws here instead of rejecting the async function it belonged to, so
   * the awaiting call would never settle; instead every call awaiting on
   * this VM is failed with that error (see `awaitGuestPromise`). One VM holds
   * one plugin instance, so only that instance's own calls are affected.
   */
  drainJobs(): void
  /** Registers `fail` to be called if a job dies (see `drainJobs`); returns an unregister function. */
  onJobFailure(fail: (error: Error) => void): () => void
  /**
   * Size of the VM's WASM linear memory. Unlike `vm.getMemoryUsage()` (the
   * QuickJS heap, which the memory limit caps), this also covers host-side
   * allocations such as handle boxes — the place a handle leak shows up.
   */
  linearMemoryBytes(): number
  dispose(): void
}

const DEFAULT_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024
const DEFAULT_INTERRUPT_AFTER_MS = 200
/** The prelude is ~90KB of our own trusted code; give it room on a slow machine. */
const PRELUDE_EVAL_DEADLINE_MS = 2000
/**
 * Where the auto-GC trigger is capped, as a share of the memory limit (see
 * `keepGcBelowLimit`). QuickJS fails an allocation over the limit outright
 * rather than collecting and retrying, so the gap between trigger and limit
 * is how much one entry can allocate after a GC before garbage it could have
 * freed turns into an OOM. Half leaves a wide gap. The cost of a low cap is
 * small: after a pass QuickJS raises its own trigger to 1.5x the heap, so a
 * plugin whose live data sits above the cap pays at most one extra GC per
 * entry (~0.3ms per MB live, measured).
 */
const DEFAULT_GC_THRESHOLD_PERCENT = 50
const NATIVE_EXTENSIONS = ['url', 'encoding', 'headers'] as const

/**
 * Files this module reads next to the running bundle in production. The
 * build (esbuild.config.js) places them there and the Docker image copies
 * them; both read this list, so a new asset can't be forgotten in one place.
 * `package` is where the file lives in node_modules, for the build to copy
 * from (the prelude is built from source instead).
 */
export const SANDBOX_RUNTIME_ASSET_SOURCES: readonly { file: string; package?: string }[] = [
  { file: 'guest-prelude.js' },
  { file: 'quickjs.wasm', package: 'quickjs-wasi/quickjs.wasm' },
  ...NATIVE_EXTENSIONS.map((name) => ({ file: `${name}.so`, package: `quickjs-wasi/${name}.so` })),
]

export const SANDBOX_RUNTIME_ASSETS: readonly string[] = SANDBOX_RUNTIME_ASSET_SOURCES.map(
  (asset) => asset.file,
)

interface CompiledModules {
  quickjs: WebAssembly.Module
  extensions: { name: string; wasm: WebAssembly.Module }[]
}

let compiledModules: CompiledModules | undefined

/**
 * In production the WASM files ship next to the running bundle (see
 * esbuild.config.js and the Dockerfile); in dev and tests they come from the
 * installed package. Mirrors how guest-prelude.js and derive-worker.js are
 * found.
 */
function readAsset(file: string, packagePath: string): Uint8Array<ArrayBuffer> {
  const sibling = fileURLToPath(new URL(`./${file}`, import.meta.url))
  const path = existsSync(sibling) ? sibling : fileURLToPath(import.meta.resolve(packagePath))
  // Copied out of Node's pooled Buffer: WebAssembly.Module wants a plain ArrayBuffer view.
  return new Uint8Array(readFileSync(path))
}

/** Compiles the engine and its native extensions once per process; every VM instantiates these. */
function getCompiledModules(): CompiledModules {
  compiledModules ??= {
    quickjs: new WebAssembly.Module(readAsset('quickjs.wasm', 'quickjs-wasi/quickjs.wasm')),
    extensions: NATIVE_EXTENSIONS.map((name) => ({
      name,
      wasm: new WebAssembly.Module(readAsset(`${name}.so`, `quickjs-wasi/${name}.so`)),
    })),
  }
  return compiledModules
}

let guestPreludeSource: Promise<string> | undefined

/**
 * In production the prelude ships as a sibling bundle (see esbuild.config.js);
 * elsewhere no such file sits next to this module, so the entry is bundled
 * once via esbuild's JS API and cached for the life of the process.
 */
function loadGuestPreludeSource(): Promise<string> {
  guestPreludeSource ??= readGuestPreludeSource(new URL('.', import.meta.url))
  return guestPreludeSource
}

/**
 * The prelude for a sandbox module in `dir`. Without a prebuilt bundle, the
 * entry is `.ts` when running from source (dev, tests) and `.js` when running
 * tsc's output (`bun run start`, the systemd unit).
 */
export async function readGuestPreludeSource(dir: URL): Promise<string> {
  const bundled = fileURLToPath(new URL('./guest-prelude.js', dir))
  if (existsSync(bundled)) return readFileSync(bundled, 'utf-8')
  const entry = ['guest-prelude-entry.ts', 'guest-prelude-entry.js']
    .map((file) => fileURLToPath(new URL(`./${file}`, dir)))
    .find((path) => existsSync(path))
  if (!entry) throw new Error(`No guest prelude or its entry in ${fileURLToPath(dir)}`)
  const esbuild = await import('esbuild')
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    // `neutral` + `main`: `--platform=browser` makes esbuild pick
    // abort-controller's `browser` build, a passthrough that assumes a
    // native AbortController already exists.
    platform: 'neutral',
    mainFields: ['main'],
    target: 'esnext',
    format: 'iife',
    write: false,
  })
  const [output] = result.outputFiles
  if (!output) throw new Error(`esbuild produced no output for ${entry}`)
  return output.text
}

export async function createSandboxVm(options: SandboxVmOptions): Promise<SandboxVm> {
  const { quickjs, extensions } = getCompiledModules()
  const preludeSource = await loadGuestPreludeSource()
  const interruptAfterMs = options.interruptAfterMs ?? DEFAULT_INTERRUPT_AFTER_MS
  const memoryLimit = options.memoryLimitBytes ?? DEFAULT_MEMORY_LIMIT_BYTES
  const gcThresholdCeiling = Math.floor(
    (memoryLimit * (options.gcThresholdPercent ?? DEFAULT_GC_THRESHOLD_PERCENT)) / 100,
  )
  let deadline = Number.POSITIVE_INFINITY
  let linearMemory: WebAssembly.Memory | undefined

  const vm = await QuickJS.create({
    wasm: quickjs,
    extensions,
    memoryLimit,
    interruptHandler: () => Date.now() > deadline,
    // No WASI overrides — this is only the one public way to get hold of
    // the instance's memory.
    wasi: (memory) => {
      linearMemory ??= memory
      return {}
    },
    // Without a loader `import` already fails, but leaving that implicit
    // would make the guarantee an accident of the engine's default.
    moduleLoader: {
      load: (moduleName) => {
        throw new Error(
          `Cannot import "${moduleName}": a sandboxed plugin must be a single-file ESM bundle ` +
            'with no imports. Bundle it first, e.g. ' +
            '`bun build src/index.ts --target=browser --format=esm --external undici --outfile=index.mjs` ' +
            '(see docs/plugin-authoring.md).',
        )
      },
    },
  })

  let entryDepth = 0

  /**
   * Re-entrant: a nested call (a host function reading guest values while
   * the guest is already running) leaves the outer entry's deadline alone —
   * lifting it on the way out would let the rest of the outer entry run
   * without one.
   */
  function enter<T>(fn: () => T, deadlineMs = interruptAfterMs): T {
    if (entryDepth > 0) return fn()
    entryDepth += 1
    deadline = Date.now() + deadlineMs
    try {
      return fn()
    } finally {
      entryDepth -= 1
      deadline = Number.POSITIVE_INFINITY
      keepGcBelowLimit()
    }
  }

  /**
   * After each GC pass QuickJS moves its next auto-GC trigger to 1.5x the
   * heap size. Once a pass runs above two thirds of the memory limit, that
   * trigger lands beyond the limit, so no auto GC ever runs again: cyclic
   * garbage (freed only by GC, never by refcounting) piles up until every
   * allocation fails, even after the guest has let go of it. Pulling the
   * trigger back under the limit after every entry keeps GC reachable.
   * Cheap: a single number read and write, unlike computing memory usage.
   */
  function keepGcBelowLimit(): void {
    if (vm.gcThreshold > gcThresholdCeiling) vm.gcThreshold = gcThresholdCeiling
  }

  const timers = new Map<number, PendingTimer>()
  const inFlightFetches = new Map<number, AbortController>()
  let disposed = false

  function dispose(): void {
    if (disposed) return
    disposed = true
    for (const pending of timers.values()) {
      clearTimeout(pending.timer)
      pending.callback.dispose()
    }
    timers.clear()
    for (const controller of inFlightFetches.values()) controller.abort()
    inFlightFetches.clear()
    vm.dispose()
  }

  // Captured before any guest code runs; built-ins keep their behaviour even
  // if the guest later reassigns the JSON global.
  const jsonParse = vm.evalCode('JSON.parse')
  const jsonStringify = vm.evalCode('JSON.stringify')

  const jobFailureListeners = new Set<(error: Error) => void>()

  function drainJobs(): void {
    try {
      vm.executePendingJobs()
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      for (const fail of jobFailureListeners) fail(failure)
      jobFailureListeners.clear()
    }
  }

  function onJobFailure(fail: (error: Error) => void): () => void {
    jobFailureListeners.add(fail)
    return () => jobFailureListeners.delete(fail)
  }

  function toGuest(value: unknown): JSValueHandle {
    using text = vm.newString(JSON.stringify(value ?? null))
    return vm.callFunction(jsonParse, vm.undefined, text)
  }

  function fromGuest(handle: JSValueHandle): unknown {
    if (handle.typeof === 'undefined') return undefined
    using text = vm.callFunction(jsonStringify, vm.undefined, handle)
    return text.typeof === 'undefined' ? undefined : JSON.parse(text.toString())
  }

  const sandboxVm: SandboxVm = {
    vm,
    enter,
    toGuest,
    fromGuest,
    drainJobs,
    onJobFailure,
    linearMemoryBytes: () => linearMemory?.buffer.byteLength ?? 0,
    dispose,
    [Symbol.dispose]: dispose,
  }
  // console first: event-target-shim (inside the prelude's abort-controller)
  // calls console.assert on every dispatch.
  installConsole(sandboxVm, options.consoleImpl ?? defaultConsoleImpl)
  enter(() => vm.evalCode(preludeSource).dispose(), PRELUDE_EVAL_DEADLINE_MS)
  installTimers(sandboxVm, timers)
  installFetch(sandboxVm, options, inFlightFetches, () => disposed)
  return sandboxVm
}

/**
 * A host function's return value is dup'd into the guest, but quickjs-wasi
 * never frees the returned handle itself: left alone, every call leaks a box
 * in WASM linear memory — outside the VM's memory limit, so nothing caps it.
 * Frees it once the call has returned. (Disposing a singleton such as
 * `vm.undefined` is a no-op, so any return value can go through here.)
 */
function handOff(handle: JSValueHandle): JSValueHandle {
  queueMicrotask(() => handle.dispose())
  return handle
}

let nextTimerId = 1

interface PendingTimer {
  timer: ReturnType<typeof setTimeout>
  /** Owned by this entry until the timer fires or is cancelled — must be disposed either way. */
  callback: JSValueHandle
}

/** Installs `setTimeout`/`clearTimeout`, tracked in `timers` so `dispose()` can cancel any still pending. */
function installTimers(
  { vm, enter, drainJobs }: SandboxVm,
  timers: Map<number, PendingTimer>,
): void {
  using setTimeoutFn = vm.newFunction('setTimeout', (callbackArg, delayArg) => {
    const callback = callbackArg.dup()
    const ms = delayArg ? delayArg.toNumber() : 0
    const id = nextTimerId++
    const timer = setTimeout(() => {
      timers.delete(id)
      enter(() => {
        try {
          vm.callFunction(callback, vm.undefined).dispose()
        } catch {
          // Nothing host-side awaits a fired timer; a throwing callback is
          // the guest's own problem, as it would be in a browser.
        } finally {
          callback.dispose()
        }
        drainJobs()
      })
    }, ms)
    timers.set(id, { timer, callback })
    return handOff(vm.newNumber(id))
  })
  vm.setProp(vm.global, 'setTimeout', setTimeoutFn)

  using clearTimeoutFn = vm.newFunction('clearTimeout', (idArg) => {
    const id = idArg.toNumber()
    const pending = timers.get(id)
    if (pending) {
      clearTimeout(pending.timer)
      pending.callback.dispose()
      timers.delete(id)
    }
    return vm.undefined
  })
  vm.setProp(vm.global, 'clearTimeout', clearTimeoutFn)
}

/**
 * The guest half of `fetch`. The promise, the `Response`-like object and the
 * normalisation of `init` all live in the guest, so only strings cross the
 * boundary: the host primitive gets a URL and a JSON request, returns a
 * request id, and settles by calling `settle(error, responseJson)`. (That
 * also keeps `vm.newPromise()` out of the picture — it never frees the unused
 * resolve/reject handle, and fetch runs on every poll.) An `init.signal`
 * (the prelude's `AbortSignal`) is wired to `abortFetch(id)`, so
 * `abort()` cancels the host request too. `json()`/`text()` resolve
 * immediately since `hostFetch` has already read the whole body.
 */
const GUEST_FETCH_SOURCE = `(hostFetch, abortFetch) => {
  const toHeaderRecord = (headers) => {
    if (!headers) return undefined
    if (Array.isArray(headers)) return Object.fromEntries(headers)
    if (typeof headers.entries === 'function') return Object.fromEntries(headers.entries())
    return { ...headers }
  }
  const makeResponse = ({ status, statusText, headers, body }) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    json: async () => JSON.parse(body),
    text: async () => body,
  })
  const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
  return (input, init = {}) =>
    new Promise((resolve, reject) => {
      const signal = init.signal
      if (signal && signal.aborted) return reject(abortError())
      const request = { method: init.method, headers: toHeaderRecord(init.headers), body: init.body }
      const id = hostFetch(String(input), JSON.stringify(request), (error, responseJson) => {
        if (error !== null) reject(signal && signal.aborted ? abortError() : new Error(error))
        else resolve(makeResponse(JSON.parse(responseJson)))
      })
      if (signal) signal.addEventListener('abort', () => abortFetch(id), { once: true })
    })
}`

let nextFetchId = 1

/** Installs `fetch`, relaying through `hostFetch` gated by this VM's own `policy`. */
function installFetch(
  { vm, enter, drainJobs }: SandboxVm,
  { policy, fetchImpl }: SandboxVmOptions,
  inFlight: Map<number, AbortController>,
  isDisposed: () => boolean,
): void {
  using hostFetchFn = vm.newFunction('fetch', (urlArg, requestArg, settleArg) => {
    const url = urlArg.toString()
    const request = JSON.parse(requestArg.toString()) as HostFetchRequest
    const settle = settleArg.dup()
    const id = nextFetchId++
    const controller = new AbortController()
    inFlight.set(id, controller)

    const deliver = (error: string | null, responseJson?: string) => {
      inFlight.delete(id)
      if (isDisposed()) return settle.dispose()
      enter(() => {
        using errorHandle = error === null ? vm.null : vm.newString(error)
        using responseHandle =
          responseJson === undefined ? vm.undefined : vm.newString(responseJson)
        try {
          vm.callFunction(settle, vm.undefined, errorHandle, responseHandle).dispose()
        } finally {
          settle.dispose()
        }
        drainJobs()
      })
    }

    hostFetch(policy, url, request, fetchImpl, { signal: controller.signal }).then(
      (response) => deliver(null, JSON.stringify(response)),
      (error: unknown) => deliver(error instanceof Error ? error.message : String(error)),
    )
    return handOff(vm.newNumber(id))
  })
  using abortFetchFn = vm.newFunction('abortFetch', (idArg) => {
    inFlight.get(idArg.toNumber())?.abort()
    return vm.undefined
  })
  using makeFetch = vm.evalCode(GUEST_FETCH_SOURCE)
  using fetchFn = vm.callFunction(makeFetch, vm.undefined, hostFetchFn, abortFetchFn)
  vm.setProp(vm.global, 'fetch', fetchFn)
}

export interface QuickJsSandbox {
  /** Evaluates `code` as the body of an async function and JSON-decodes its returned string. */
  run(code: string): Promise<unknown>
  dispose(): void
}

/**
 * Settles a guest promise into a host one. `resolvePromise` only subscribes
 * to the promise; draining the job queue is up to the caller, and must
 * happen under a deadline since it runs guest code.
 */
export async function awaitGuestPromise(
  sandboxVm: SandboxVm,
  promise: JSValueHandle,
  deadlineMs?: number,
): Promise<JSValueHandle> {
  const { vm, enter, drainJobs, onJobFailure } = sandboxVm
  const settled = vm.resolvePromise(promise)
  let stopListening = () => {}
  const jobFailed = new Promise<never>((_, reject) => {
    stopListening = onJobFailure(reject)
  })
  jobFailed.catch(() => {
    // Only observed through the race below; never an unhandled rejection.
  })
  try {
    enter(() => drainJobs(), deadlineMs)
    const outcome = await Promise.race([settled, jobFailed])
    if ('value' in outcome) return outcome.value
    using error = outcome.error
    throw toHostError(vm, error)
  } finally {
    stopListening()
  }
}

/**
 * Reads a guest rejection reason into a host `Error`, keeping `.message` and
 * `.name`. Goes through the guest's `JSON.stringify` rather than `vm.dump()`:
 * dumping an object leaves a stale engine exception behind that later
 * replaces module-loader errors with "not a TypedArray".
 */
function toHostError(vm: QuickJS, reason: JSValueHandle): Error {
  using describe = vm.evalCode(
    '(e) => JSON.stringify(e && typeof e === "object" ? { name: e.name, message: e.message } : { message: String(e) })',
  )
  using described = vm.callFunction(describe, vm.undefined, reason)
  const { name, message } = JSON.parse(described.toString()) as {
    name?: unknown
    message?: unknown
  }
  const error = new Error(typeof message === 'string' ? message : String(message))
  if (typeof name === 'string') error.name = name
  return error
}

export async function createSandbox(options: SandboxVmOptions): Promise<QuickJsSandbox> {
  const sandboxVm = await createSandboxVm(options)
  const { vm, enter } = sandboxVm

  async function run(code: string): Promise<unknown> {
    using promise = enter(() => vm.evalCode(`(async () => {\n${code}\n})()`))
    using result = await awaitGuestPromise(sandboxVm, promise)
    return JSON.parse(result.toString())
  }

  return { run, dispose: sandboxVm.dispose }
}

/**
 * `console` is formatted in the guest — strings as-is, anything else through
 * `JSON.stringify` — so the host only ever receives two strings. (Reading an
 * object with `vm.dump()` would leave the stale engine exception described
 * at `toHostError`.) `assert` is there because event-target-shim, inside the
 * prelude's abort-controller, calls it on every event dispatch.
 */
const GUEST_CONSOLE_SOURCE = `(write) => {
  const format = (args) =>
    args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')
  return {
    log: (...args) => write('log', format(args)),
    error: (...args) => write('error', format(args)),
    warn: (...args) => write('warn', format(args)),
    info: (...args) => write('info', format(args)),
    assert: (condition, ...args) => {
      if (condition) return
      const detail = format(args)
      write('error', detail ? 'Assertion failed: ' + detail : 'Assertion failed')
    },
  }
}`

function installConsole(
  { vm }: SandboxVm,
  consoleImpl: (level: ConsoleLevel, message: string) => void,
): void {
  using writeFn = vm.newFunction('console', (levelArg, messageArg) => {
    consoleImpl(levelArg.toString() as ConsoleLevel, messageArg.toString())
    return vm.undefined
  })
  using makeConsole = vm.evalCode(GUEST_CONSOLE_SOURCE)
  using consoleObject = vm.callFunction(makeConsole, vm.undefined, writeFn)
  vm.setProp(vm.global, 'console', consoleObject)
}
