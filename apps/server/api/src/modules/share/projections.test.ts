import { describe, expect, it } from 'vitest'
import { publicDashboardLayout } from './projections.js'

describe('public dashboard layout', () => {
  it('keeps how a widget shows what it reads, and drops every other key', () => {
    const layout = {
      columns: 12,
      rowHeight: 100,
      margin: 8,
      secret: 'dropped',
      widgets: [
        {
          id: 'w1',
          type: 'alerts',
          position: { x: 0, y: 0, w: 4, h: 4 },
          config: {
            dataSourceId: 'ds1',
            title: 'Alerts',
            maxItems: 5,
            autoRefresh: 10,
            showResolved: true,
            staleAfterHours: 12,
            query: 'internal',
          },
        },
        {
          id: 'w2',
          type: 'device-status',
          position: { x: 4, y: 0, w: 4, h: 3 },
          config: { topologyId: 't1', showDetail: true },
        },
      ],
    }
    expect(JSON.parse(publicDashboardLayout(JSON.stringify(layout)))).toEqual({
      columns: 12,
      rowHeight: 100,
      margin: 8,
      widgets: [
        {
          id: 'w1',
          type: 'alerts',
          position: { x: 0, y: 0, w: 4, h: 4 },
          config: {
            dataSourceId: 'ds1',
            title: 'Alerts',
            maxItems: 5,
            autoRefresh: 10,
            showResolved: true,
            staleAfterHours: 12,
          },
        },
        {
          id: 'w2',
          type: 'device-status',
          position: { x: 4, y: 0, w: 4, h: 3 },
          config: { topologyId: 't1', showDetail: true },
        },
      ],
    })
  })

  it('shows nothing for a layout it cannot read', () => {
    expect(publicDashboardLayout('not json')).toBe('{"widgets":[]}')
  })
})
