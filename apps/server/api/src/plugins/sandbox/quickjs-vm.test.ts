// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  awaitGuestPromise,
  createSandbox,
  createSandboxVm,
  type QuickJsSandbox,
  readGuestPreludeSource,
} from './quickjs-vm.js'

const NOOP_POLICY = { allowedOrigins: [] }
const NOOP_FETCH_IMPL = async () => new Response(null, { status: 501 })

describe('createSandbox (quickjs-wasi)', () => {
  let sandbox: QuickJsSandbox | undefined

  afterEach(() => {
    sandbox?.dispose()
    sandbox = undefined
  })

  it('sees no process, Bun, or require globals from inside the guest', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    const result = await sandbox.run(`
      return JSON.stringify({
        process: typeof process,
        Bun: typeof Bun,
        require: typeof require,
      })
    `)

    expect(result).toEqual({ process: 'undefined', Bun: 'undefined', require: 'undefined' })
  })

  it('resolves an async guest function that awaits setTimeout', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    const result = await sandbox.run(`
      await new Promise((resolve) => setTimeout(resolve, 20))
      return JSON.stringify({ waited: true })
    `)

    expect(result).toEqual({ waited: true })
  })

  it('never fires a timer cancelled with clearTimeout', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    const result = await sandbox.run(`
      let fired = false
      const id = setTimeout(() => { fired = true }, 10)
      clearTimeout(id)
      await new Promise((resolve) => setTimeout(resolve, 40))
      return JSON.stringify({ fired })
    `)

    expect(result).toEqual({ fired: false })
  })

  it('relays fetch through hostFetch both ways, with res.json() available in the guest', async () => {
    const seen: RequestInit[] = []
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      seen.push(init ?? {})
      return new Response(JSON.stringify({ hello: 'world' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    sandbox = await createSandbox({
      policy: { allowedOrigins: ['https://netbox.example.com'] },
      fetchImpl,
    })

    const result = await sandbox.run(`
      const res = await fetch('https://netbox.example.com/api/devices/', {
        method: 'POST',
        headers: { authorization: 'Token abc' },
        body: '{"a":1}',
      })
      const data = await res.json()
      return JSON.stringify({ status: res.status, ok: res.ok, type: res.headers.get('Content-Type'), data })
    `)

    expect(result).toEqual({
      status: 200,
      ok: true,
      type: 'application/json',
      data: { hello: 'world' },
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.headers).toEqual({ authorization: 'Token abc' })
    expect(seen[0]?.body).toBe('{"a":1}')
  })

  it('rejects fetch to a destination the policy disallows', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    const result = await sandbox.run(`
      try {
        await fetch('https://evil.example.com/steal')
        return JSON.stringify({ rejected: false })
      } catch (error) {
        return JSON.stringify({ rejected: true, message: error.message })
      }
    `)

    expect(result).toEqual({
      rejected: true,
      message: 'Sandbox net policy denied fetch to https://evil.example.com/steal',
    })
  })

  it('provides URL, URLSearchParams, TextEncoder, Headers, AbortController, and Buffer', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    const result = await sandbox.run(`
      const origin = new URL('https://netbox.example.com:8443/api/dcim/devices/').origin
      const encoded = new TextEncoder().encode('é').length
      const header = new Headers({ Accept: 'application/json' }).get('accept')
      const controller = new AbortController()
      controller.abort()
      const base64 = Buffer.from('user:pass').toString('base64')
      return JSON.stringify({ origin, encoded, header, aborted: controller.signal.aborted, base64 })
    `)

    expect(result).toEqual({
      origin: 'https://netbox.example.com:8443',
      encoded: 2,
      header: 'application/json',
      aborted: true,
      base64: 'dXNlcjpwYXNz',
    })
  })

  it('builds URLSearchParams from a string, a record, an array of pairs, or another instance', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    const result = await sandbox.run(`
      const fromString = new URLSearchParams('?a=1&b=x y').toString()
      const fromRecord = new URLSearchParams({ limit: '0', q: 'a&b' }).toString()
      const fromPairs = new URLSearchParams([['x', '1'], ['x', '2']]).toString()
      const fromInstance = new URLSearchParams(new URLSearchParams('k=v')).toString()
      const empty = new URLSearchParams().toString()
      return JSON.stringify({ fromString, fromRecord, fromPairs, fromInstance, empty })
    `)

    expect(result).toEqual({
      fromString: 'a=1&b=x+y',
      fromRecord: 'limit=0&q=a%26b',
      fromPairs: 'x=1&x=2',
      fromInstance: 'k=v',
      empty: '',
    })
  })

  it('gives URL a searchParams that reads the query and writes changes back to the URL', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    const result = await sandbox.run(`
      const url = new URL('https://portal.example.com/authorize?code=abc&x=1')
      const code = url.searchParams.get('code')
      url.searchParams.set('state', 's 1')
      url.searchParams.append('x', '2')
      url.searchParams.delete('code')
      const afterWrites = url.href
      url.searchParams.sort()
      const afterSort = url.href
      url.search = '?fresh=yes'
      const afterReassign = url.searchParams.get('fresh')
      return JSON.stringify({ code, afterWrites, afterSort, afterReassign, same: url.searchParams === url.searchParams })
    `)

    expect(result).toEqual({
      code: 'abc',
      afterWrites: 'https://portal.example.com/authorize?x=1&state=s+1&x=2',
      afterSort: 'https://portal.example.com/authorize?state=s+1&x=1&x=2',
      afterReassign: 'yes',
      same: true,
    })
  })

  it('cancels an in-flight fetch when the guest calls AbortController#abort()', async () => {
    let hostSignal: AbortSignal | undefined
    const fetchImpl = (_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        hostSignal = init?.signal ?? undefined
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
        setTimeout(() => resolve(new Response('too slow')), 200)
      })
    sandbox = await createSandbox({
      policy: { allowedOrigins: ['https://netbox.example.com'] },
      fetchImpl,
    })

    const result = await sandbox.run(`
      const controller = new AbortController()
      const pending = fetch('https://netbox.example.com/slow', { signal: controller.signal })
      await new Promise((resolve) => setTimeout(resolve, 10))
      controller.abort()
      try {
        await pending
        return JSON.stringify({ aborted: false })
      } catch (error) {
        return JSON.stringify({ aborted: true, name: error.name })
      }
    `)

    expect(result).toEqual({ aborted: true, name: 'AbortError' })
    expect(hostSignal?.aborted).toBe(true)
  })

  it('rejects fetch at once when its signal is already aborted', async () => {
    let called = false
    const fetchImpl = async () => {
      called = true
      return new Response('should not be reached')
    }
    sandbox = await createSandbox({
      policy: { allowedOrigins: ['https://netbox.example.com'] },
      fetchImpl,
    })

    const result = await sandbox.run(`
      const controller = new AbortController()
      controller.abort()
      try {
        await fetch('https://netbox.example.com/x', { signal: controller.signal })
        return JSON.stringify({ aborted: false })
      } catch (error) {
        return JSON.stringify({ aborted: true, name: error.name })
      }
    `)

    expect(result).toEqual({ aborted: true, name: 'AbortError' })
    expect(called).toBe(false)
  })

  it('forwards console.log/error/warn/info to the host, JSON-encoding non-string args', async () => {
    const logs: Array<{ level: string; message: string }> = []
    sandbox = await createSandbox({
      policy: NOOP_POLICY,
      fetchImpl: NOOP_FETCH_IMPL,
      consoleImpl: (level, message) => logs.push({ level, message }),
    })

    const result = await sandbox.run(`
      console.log('hello', { a: 1 })
      console.error('boom')
      console.warn(42, true)
      console.info('info', null)
      return JSON.stringify({ done: true })
    `)

    expect(result).toEqual({ done: true })
    expect(logs).toEqual([
      { level: 'log', message: 'hello {"a":1}' },
      { level: 'error', message: 'boom' },
      { level: 'warn', message: '42 true' },
      { level: 'info', message: 'info null' },
    ])
  })

  it('console.assert is a no-op when truthy and logs "Assertion failed: ..." when falsy', async () => {
    const logs: Array<{ level: string; message: string }> = []
    sandbox = await createSandbox({
      policy: NOOP_POLICY,
      fetchImpl: NOOP_FETCH_IMPL,
      consoleImpl: (level, message) => logs.push({ level, message }),
    })

    const result = await sandbox.run(`
      console.assert(true, 'should not appear')
      console.assert(false, 'boom', 1)
      return JSON.stringify({ done: true })
    `)

    expect(result).toEqual({ done: true })
    expect(logs).toEqual([{ level: 'error', message: 'Assertion failed: boom 1' }])
  })

  it('keeps the import-rejection message intact after logging an object (quickjs-wasi dump bug)', async () => {
    sandbox = await createSandbox({
      policy: NOOP_POLICY,
      fetchImpl: NOOP_FETCH_IMPL,
      consoleImpl: () => {},
    })

    const result = await sandbox.run(`
      console.log({ type: 'probe', nested: { a: [1, 2] } })
      try {
        await import('node:fs')
        return JSON.stringify({ blocked: false })
      } catch (error) {
        return JSON.stringify({ blocked: true, message: error.message })
      }
    `)

    expect(result).toMatchObject({ blocked: true })
    expect((result as { message: string }).message).toMatch(/^Cannot import "node:fs"/)
  })

  it('enforces the default 64MB memory limit', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    await expect(
      sandbox.run(`return JSON.stringify({ length: 'x'.repeat(80_000_000).length })`),
    ).rejects.toThrow(/out of memory/)
  })

  it('fails an 8MB allocation without crashing when the memory limit is tiny', async () => {
    sandbox = await createSandbox({
      policy: NOOP_POLICY,
      fetchImpl: NOOP_FETCH_IMPL,
      memoryLimitBytes: 4 * 1024 * 1024,
    })

    await expect(
      sandbox.run(`return JSON.stringify({ length: 'x'.repeat(8_000_000).length })`),
    ).rejects.toThrow(/out of memory/)

    // The VM survives the failure — a fresh call still works.
    const result = await sandbox.run(`return JSON.stringify({ ok: true })`)
    expect(result).toEqual({ ok: true })
  })

  it('interrupts an infinite loop at the default 200ms deadline, and the VM stays usable', async () => {
    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })

    const startedAt = performance.now()
    await expect(sandbox.run(`while (true) {}`)).rejects.toThrow(/interrupted/)
    expect(performance.now() - startedAt).toBeLessThan(1000)

    const result = await sandbox.run(`return JSON.stringify({ ok: true })`)
    expect(result).toEqual({ ok: true })
  })

  it('does not count a slow await against the interrupt deadline', async () => {
    // Advance host time only while the guest is awaiting I/O. Real CPU speed
    // must not decide whether the resumed guest exceeds its fresh deadline.
    let now = 1000
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      sandbox = await createSandbox({
        policy: { allowedOrigins: ['https://netbox.example.com'] },
        fetchImpl: async () => {
          await Promise.resolve()
          now += 300
          return new Response(null)
        },
        interruptAfterMs: 200,
      })

      // Enough bytecode to poll the interrupt handler after resuming: a bare
      // resume would not expose a deadline incorrectly carried across await.
      const result = await sandbox.run(`
        await fetch('https://netbox.example.com/x')
        let sum = 0
        for (let i = 0; i < 1_000_000; i++) sum += i
        return JSON.stringify({ resumed: sum > 0 })
      `)

      expect(result).toEqual({ resumed: true })
    } finally {
      clock.mockRestore()
    }
  })

  it.each([
    ['half the memory limit by default', undefined, 2],
    ['the configured percentage of the memory limit', 25, 4],
  ])(
    'pulls the auto-GC trigger back to %s after each entry',
    async (_label, gcThresholdPercent, divisor) => {
      const memoryLimitBytes = 16 * 1024 * 1024
      const sandboxVm = await createSandboxVm({
        policy: NOOP_POLICY,
        fetchImpl: NOOP_FETCH_IMPL,
        memoryLimitBytes,
        gcThresholdPercent,
      })
      sandbox = { run: async () => null, dispose: sandboxVm.dispose }
      sandboxVm.vm.gcThreshold = memoryLimitBytes * 2

      sandboxVm.enter(() => sandboxVm.vm.evalCode('1').dispose())

      expect(sandboxVm.vm.gcThreshold).toBeLessThanOrEqual(memoryLimitBytes / divisor)
    },
  )

  it('recovers from an OOM caused by cyclic garbage, so the next call can allocate again', async () => {
    sandbox = await createSandbox({
      policy: NOOP_POLICY,
      fetchImpl: NOOP_FETCH_IMPL,
      memoryLimitBytes: 16 * 1024 * 1024,
      interruptAfterMs: 5000,
    })
    // Cycles are only freed by a GC pass, never by refcounting. After an OOM
    // near the limit, QuickJS sets its next auto-GC threshold above the limit
    // itself, so without an explicit GC this garbage would stay forever.
    const fillWithCycles = `
      const kept = []
      for (;;) {
        const node = { pad: 'x'.repeat(1000) + kept.length }
        node.self = node
        kept.push(node)
      }
    `
    const allocateCycles = `
      const kept = []
      for (let i = 0; i < 3000; i++) {
        const node = { pad: 'y'.repeat(1000) + i }
        node.self = node
        kept.push(node)
      }
      return JSON.stringify({ allocated: kept.length })
    `

    for (const _round of [1, 2, 3]) {
      await expect(sandbox.run(fillWithCycles)).rejects.toThrow(/out of memory/)
      expect(await sandbox.run(allocateCycles)).toEqual({ allocated: 3000 })
    }
  })

  it('disposes a VM right after an OOM, repeatedly, and still creates working VMs afterwards', async () => {
    for (const _round of [1, 2]) {
      const exhausted = await createSandbox({
        policy: NOOP_POLICY,
        fetchImpl: NOOP_FETCH_IMPL,
        memoryLimitBytes: 8 * 1024 * 1024,
        interruptAfterMs: 5000,
      })
      await expect(
        exhausted.run(
          `const kept = []; for (;;) { const n = { p: 'x'.repeat(1000) }; n.self = n; kept.push(n) }`,
        ),
      ).rejects.toThrow(/out of memory/)
      // The old engine aborted the whole WASM module here (JS_FreeRuntime's
      // gc_obj_list assertion, from objects QuickJS leaks on OOM paths).
      expect(() => exhausted.dispose()).not.toThrow()
    }

    sandbox = await createSandbox({ policy: NOOP_POLICY, fetchImpl: NOOP_FETCH_IMPL })
    expect(await sandbox.run(`return JSON.stringify({ ok: true })`)).toEqual({ ok: true })
  })

  it('disposes with a pending timer and an in-flight fetch, and neither reaches the guest afterwards', async () => {
    const hostErrors: unknown[] = []
    const onHostError = (error: unknown) => hostErrors.push(error)
    process.on('uncaughtException', onHostError)
    process.on('unhandledRejection', onHostError)
    const logs: string[] = []
    let hostSignal: AbortSignal | undefined
    // Ignores the abort and settles anyway, like a fetchImpl that can't be cancelled.
    const fetchImpl = (_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        hostSignal = init?.signal ?? undefined
        setTimeout(() => resolve(new Response('late')), 20)
      })
    sandbox = await createSandbox({
      policy: { allowedOrigins: ['https://netbox.example.com'] },
      fetchImpl,
      consoleImpl: (_level, message) => logs.push(message),
    })

    await sandbox.run(`
      setTimeout(() => console.log('timer fired'), 20)
      fetch('https://netbox.example.com/late').then(() => console.log('fetch settled'))
      return 'null'
    `)
    sandbox.dispose()
    sandbox = undefined
    await new Promise((resolve) => setTimeout(resolve, 80))
    process.off('uncaughtException', onHostError)
    process.off('unhandledRejection', onHostError)

    expect(hostSignal?.aborted).toBe(true)
    expect(logs).toEqual([])
    expect(hostErrors).toEqual([])
  })

  it('does not grow the VM heap or its WASM linear memory across many fetches', async () => {
    const fetchImpl = async () => new Response('{"n":1}')
    const sandboxVm = await createSandboxVm({
      policy: { allowedOrigins: ['https://netbox.example.com'] },
      fetchImpl,
    })
    sandbox = { run: async () => null, dispose: sandboxVm.dispose }
    const fetchMany = async (times: number) => {
      using promise = sandboxVm.enter(() =>
        sandboxVm.vm.evalCode(`(async () => {
          for (let i = 0; i < ${times}; i++) await (await fetch('https://netbox.example.com/x')).json()
        })()`),
      )
      ;(await awaitGuestPromise(sandboxVm, promise)).dispose()
    }

    await fetchMany(500) // warm up: let the allocator reach its steady state
    sandboxVm.vm.runGC()
    const heapBefore = sandboxVm.vm.getMemoryUsage().memoryUsedSize
    const linearBefore = sandboxVm.linearMemoryBytes()

    // Each fetch leaks ~14 bytes of WASM memory if a returned handle isn't
    // freed; it takes this many for that to cross the tolerance below.
    await fetchMany(50_000)
    sandboxVm.vm.runGC()

    expect(sandboxVm.vm.getMemoryUsage().memoryUsedSize - heapBefore).toBeLessThan(64 * 1024)
    expect(sandboxVm.linearMemoryBytes() - linearBefore).toBeLessThan(128 * 1024)
  }, 30_000)
})

describe('readGuestPreludeSource', () => {
  let dir: string | undefined

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = undefined
  })

  async function dirWith(files: Record<string, string>): Promise<URL> {
    dir = await mkdtemp(join(tmpdir(), 'shumoku-prelude-'))
    for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content)
    return pathToFileURL(`${dir}/`)
  }

  it('uses the prebuilt guest-prelude.js when it sits next to the module', async () => {
    const source = await readGuestPreludeSource(
      await dirWith({ 'guest-prelude.js': 'var prebuilt = 1' }),
    )
    expect(source).toBe('var prebuilt = 1')
  })

  // `bun run start` and the systemd unit run tsc's output, where the entry is
  // compiled to .js and there is no prebuilt bundle.
  it("bundles the compiled guest-prelude-entry.js when there is no .ts entry (tsc's output)", async () => {
    const source = await readGuestPreludeSource(
      await dirWith({ 'guest-prelude-entry.js': "globalThis.preludeMarker = 'compiled-entry'" }),
    )
    expect(source).toContain('compiled-entry')
  })

  it('names the directory when it has neither a prebuilt prelude nor an entry', async () => {
    const empty = await dirWith({})

    await expect(readGuestPreludeSource(empty)).rejects.toThrow(
      `No guest prelude or its entry in ${dir}/`,
    )
  })
})
