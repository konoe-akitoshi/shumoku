import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { readerFor } from './dashboard-reader'

describe('dashboard reader', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reads the workspace, live over the socket, when signed in', async () => {
    const view = vi.spyOn(api.topologies, 'getView').mockResolvedValue({ deriving: true })
    const reader = readerFor({ kind: 'workspace' })
    expect(reader.shared).toBe(false)
    await reader.view('t1')
    expect(view).toHaveBeenCalledWith('t1')
    expect(reader.liveSource('t1')).toEqual({ kind: 'ws', topologyId: 't1' })
  })

  it("reads through a shared dashboard's token, live over its stream", async () => {
    const view = vi.spyOn(api.shared.dashboard, 'view').mockResolvedValue({ deriving: true })
    const reader = readerFor({ kind: 'shared', token: 'tok' })
    expect(reader.shared).toBe(true)
    await reader.view('t1')
    expect(view).toHaveBeenCalledWith('tok', 't1')
    expect(reader.liveSource('t1')).toEqual({
      kind: 'sse',
      url: '/api/share/dashboards/tok/topologies/t1/metrics/stream',
    })
  })
})
