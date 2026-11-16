import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  create: vi.fn(),
  json: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }))
vi.mock('@shumoku/plugin-sdk', () => ({ createHttpClient: mocks.create }))

import { requestInCluster } from './client.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockReturnValue({ json: mocks.json, dispose: mocks.dispose })
  mocks.json.mockResolvedValue({ items: [] })
  mocks.dispose.mockResolvedValue(undefined)
})
it('rereads the projected token and CA on every request and refuses redirects', async () => {
  mocks.readFile
    .mockResolvedValueOnce('first-token\n')
    .mockResolvedValueOnce('cluster-ca')
    .mockResolvedValueOnce('rotated-token\n')
    .mockResolvedValueOnce('cluster-ca')
  await requestInCluster('/api/v1/pods')
  await requestInCluster('/api/v1/services')
  expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
    baseUrl: 'https://kubernetes.default.svc',
    auth: { type: 'bearer', token: 'first-token' },
    ca: 'cluster-ca',
    redirect: 'error',
  })
  expect(mocks.create.mock.calls[1]?.[0].auth.token).toBe('rotated-token')
  expect(mocks.readFile.mock.calls.map(([path]) => path)).toEqual([
    '/var/run/secrets/kubernetes.io/serviceaccount/token',
    '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
    '/var/run/secrets/kubernetes.io/serviceaccount/token',
    '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt',
  ])
  expect(mocks.dispose).toHaveBeenCalledTimes(2)
})
it('closes the CA connection pool even when the API rejects a request', async () => {
  mocks.readFile.mockResolvedValueOnce('token').mockResolvedValueOnce('ca')
  mocks.json.mockRejectedValueOnce(new Error('HTTP 403'))
  await expect(requestInCluster('/api/v1/pods')).rejects.toThrow('403')
  expect(mocks.dispose).toHaveBeenCalledOnce()
})

it('refuses absolute destinations before reading credentials', async () => {
  await expect(requestInCluster('https://example.invalid/api/v1/pods')).rejects.toThrow(
    'Only Kubernetes',
  )
  expect(mocks.readFile).not.toHaveBeenCalled()
})
