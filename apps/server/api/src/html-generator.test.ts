import { describe, expect, it } from 'vitest'
import { generateMetricsHtml } from './html-generator.js'
import type { TopologyInstance, WeathermapConfig } from './types.js'

const topology: TopologyInstance = {
  name: 'test',
  config: { name: 'test', file: 'test.yaml' },
  graph: { name: 'Test topology', nodes: [], links: [] },
  layout: {
    nodes: new Map(),
    links: new Map(),
    subgraphs: new Map(),
    bounds: { x: 0, y: 0, width: 0, height: 0 },
  },
  metrics: { nodes: {}, links: {}, timestamp: 0 },
}

const weathermap: WeathermapConfig = {
  thresholds: [{ value: 0, color: '#73BF69' }],
}

describe('generateMetricsHtml', () => {
  it('uses a same-origin WebSocket URL and keeps reconnecting', () => {
    const html = generateMetricsHtml(topology, { weathermap })

    expect(html).toContain("new WebSocket('/ws')")
    expect(html).not.toContain('maxReconnectAttempts')
    expect(html).not.toMatch(/new WebSocket\(['"]ws:/)
  })
})
