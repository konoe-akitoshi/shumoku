import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, parseLayout, rowBelow } from './layout'

describe('dashboard layout', () => {
  it('reads a stored layout as it is', () => {
    const stored = {
      columns: 12,
      rowHeight: 80,
      margin: 4,
      widgets: [
        {
          id: 'a',
          type: 'topology',
          config: { topologyId: 't1' },
          position: { x: 0, y: 0, w: 6, h: 4 },
        },
      ],
    }
    expect(parseLayout(JSON.stringify(stored))).toEqual(stored)
  })

  it('takes the defaults for what is missing or malformed', () => {
    expect(parseLayout(undefined)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout('not json')).toEqual(DEFAULT_LAYOUT)
    const layout = parseLayout(
      JSON.stringify({
        columns: -3,
        widgets: [
          { id: 'a', type: 'alerts', position: { x: -1, y: 2.4, w: 0 } },
          { type: 'alerts' },
          { id: 'b' },
          { id: 'a', type: 'topology' },
          'nonsense',
        ],
      }),
    )
    expect(layout.columns).toBe(DEFAULT_LAYOUT.columns)
    expect(layout.widgets).toEqual([
      { id: 'a', type: 'alerts', config: {}, position: { x: 0, y: 2, w: 4, h: 3 } },
    ])
  })

  it('finds the row below every widget', () => {
    expect(rowBelow([])).toBe(0)
    const { widgets } = parseLayout(
      JSON.stringify({
        widgets: [
          { id: 'a', type: 'x', position: { x: 0, y: 0, w: 2, h: 3 } },
          { id: 'b', type: 'x', position: { x: 2, y: 1, w: 2, h: 4 } },
        ],
      }),
    )
    expect(rowBelow(widgets)).toBe(5)
  })
})
