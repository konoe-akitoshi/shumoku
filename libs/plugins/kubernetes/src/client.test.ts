import { describe, expect, it, vi } from 'vitest'
import { fetchInventory, listResources } from './client.js'
import { parseConfig } from './config.js'
import { KubernetesPlugin } from './plugin.js'

describe('Kubernetes API sync', () => {
  it('follows encoded continuation tokens and retains every page', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ metadata: { uid: 'one', name: 'one' } }],
        metadata: { continue: 'next+/=' },
      })
      .mockResolvedValueOnce({ items: [{ metadata: { uid: 'two', name: 'two' } }] })
    expect(await listResources(request, '/api/v1/pods')).toHaveLength(2)
    expect(request.mock.calls[1]?.[0]).toBe('/api/v1/pods?limit=500&continue=next%2B%2F%3D')
  })
  it('refuses pagination loops, malformed lists and permission failures', async () => {
    await expect(
      listResources(
        vi.fn().mockResolvedValue({ items: [], metadata: { continue: 'same' } }),
        '/api/v1/pods',
      ),
    ).rejects.toThrow('pagination')
    await expect(
      listResources(vi.fn().mockResolvedValue({ items: [{}] }), '/api/v1/pods'),
    ).rejects.toThrow('Invalid Kubernetes')
    await expect(
      listResources(vi.fn().mockRejectedValue(new Error('HTTP 403')), '/api/v1/pods'),
    ).rejects.toThrow('403')
  })
  it('rejects truncated inventories at the page limit', async () => {
    let page = 0
    const request = vi.fn(async () => ({ items: [], metadata: { continue: String(++page) } }))
    await expect(listResources(request, '/api/v1/pods')).rejects.toThrow('exceeded 100 pages')
    expect(request).toHaveBeenCalledTimes(100)
  })
  it('queries only selected namespaces without requiring Nodes when disabled', async () => {
    const request = vi.fn().mockResolvedValue({ items: [] })
    await fetchInventory({ namespaces: ['demo'], includeNodes: false }, request)
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/namespaces/demo/pods?limit=500',
      '/api/v1/namespaces/demo/services?limit=500',
      '/apis/discovery.k8s.io/v1/namespaces/demo/endpointslices?limit=500',
    ])
  })
  it('fails a full sync if EndpointSlice access is denied instead of returning a partial graph', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockRejectedValueOnce(new Error('HTTP 403'))
    const plugin = new KubernetesPlugin(request)
    plugin.initialize({ namespaces: ['demo'], includeNodes: false })
    await expect(plugin.fetchTopology()).rejects.toThrow('403')
  })
  it('does not expose response bodies in connection errors', async () => {
    const plugin = new KubernetesPlugin(
      vi.fn().mockRejectedValue(new Error('sensitive upstream response')),
    )
    const result = await plugin.testConnection()
    expect(result.success).toBe(false)
    expect(result.message).not.toContain('sensitive')
  })
  it('rejects invalid namespace paths and normalizes duplicates', () => {
    expect(parseConfig({ namespaces: ['demo', 'demo'] }).namespaces).toEqual(['demo'])
    expect(() => parseConfig({ namespaces: ['../secrets'] })).toThrow()
    expect(() => parseConfig({ includeNodes: 'false' })).toThrow()
  })
})
