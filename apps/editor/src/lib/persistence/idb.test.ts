import { afterEach, beforeEach, expect, test, vi } from 'vitest'

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

function installDatabase(transaction: object) {
  vi.stubGlobal('indexedDB', {
    open: () => {
      const request = {
        result: { transaction: () => transaction },
        onsuccess: () => {},
      }
      queueMicrotask(() => request.onsuccess())
      return request
    },
  })
}

test('rejects transaction abortion promptly while the callback is still pending', async () => {
  const error = new DOMException('Transaction aborted', 'AbortError')
  const transaction = {
    error,
    onabort: () => {},
    abort: vi.fn(),
  }
  installDatabase(transaction)
  const { withTxn } = await import('./idb')
  let release = () => {}
  const callback = new Promise<string>((resolve) => {
    release = () => resolve('late result')
  })
  const result = withTxn(['projects'], 'readonly', () => {
    queueMicrotask(() => transaction.onabort())
    return callback
  })
  try {
    await expect(result).rejects.toBe(error)
    expect(transaction.abort).toHaveBeenCalledOnce()
  } finally {
    release()
  }
})

test('aborts writes and preserves the callback error when validation throws', async () => {
  const transaction = {
    error: new DOMException('Transaction aborted', 'AbortError'),
    onabort: () => {},
    abort: vi.fn(() => queueMicrotask(() => transaction.onabort())),
  }
  installDatabase(transaction)
  const { withTxn } = await import('./idb')
  const error = new Error('Invalid geometry')
  await expect(
    withTxn(['nodes'], 'readwrite', () => {
      throw error
    }),
  ).rejects.toBe(error)
  expect(transaction.abort).toHaveBeenCalledOnce()
})

test('reports an AbortError when explicit abortion leaves the database error unset', async () => {
  const transaction = { error: null, onabort: () => {}, abort: vi.fn() }
  installDatabase(transaction)
  const { withTxn } = await import('./idb')
  await expect(
    withTxn(['projects'], 'readonly', () => {
      queueMicrotask(() => transaction.onabort())
    }),
  ).rejects.toMatchObject({ name: 'AbortError' })
})
