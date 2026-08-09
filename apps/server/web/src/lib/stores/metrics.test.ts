import { afterEach, describe, expect, it, vi } from 'vitest'
import { metricsStore } from './metrics'

describe('metricsStore WebSocket connection', () => {
  afterEach(() => {
    metricsStore.disconnect()
    vi.unstubAllGlobals()
  })

  it('uses a same-origin URL handled by the development proxy', () => {
    let requestedUrl: string | URL | undefined

    class WebSocketMock {
      static readonly CONNECTING = 0
      static readonly OPEN = 1

      readonly readyState = WebSocketMock.CONNECTING
      onopen = null
      onmessage = null
      onclose = null
      onerror = null

      constructor(url: string | URL) {
        requestedUrl = url
      }

      close(): void {}
    }

    vi.stubGlobal('WebSocket', WebSocketMock)

    metricsStore.connect()

    expect(requestedUrl).toBe('/ws')
  })
})
