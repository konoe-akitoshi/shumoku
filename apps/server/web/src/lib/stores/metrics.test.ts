import { afterEach, describe, expect, it, vi } from 'vitest'
import { metricsStore } from './metrics'

class WebSocketMock {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: WebSocketMock[] = []

  readyState = WebSocketMock.CONNECTING
  onopen = null
  onmessage = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror = null

  constructor(readonly url: string | URL) {
    WebSocketMock.instances.push(this)
  }

  close(): void {
    this.readyState = WebSocketMock.CLOSED
  }

  failConnection(): void {
    this.readyState = WebSocketMock.CLOSED
    this.onclose?.({} as CloseEvent)
  }
}

describe('metricsStore WebSocket connection', () => {
  afterEach(() => {
    metricsStore.disconnect()
    WebSocketMock.instances = []
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uses a same-origin URL handled by the development proxy', () => {
    vi.stubGlobal('WebSocket', WebSocketMock)

    metricsStore.connect()

    expect(WebSocketMock.instances[0]?.url).toBe('/ws')
  })

  it('keeps reconnecting after the previous five-attempt limit', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', WebSocketMock)
    metricsStore.connect()

    for (const expectedConnections of [2, 3, 4, 5, 6, 7]) {
      WebSocketMock.instances.at(-1)?.failConnection()
      await vi.runOnlyPendingTimersAsync()
      expect(WebSocketMock.instances).toHaveLength(expectedConnections)
    }
  })
})
