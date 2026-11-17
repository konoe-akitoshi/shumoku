import { readFile } from 'node:fs/promises'
import { createHttpClient, paginate } from '@shumoku/plugin-sdk'
import type { KubernetesConfig } from './config.js'
import type { Inventory, Resource } from './types.js'

const SERVICE_ACCOUNT = '/var/run/secrets/kubernetes.io/serviceaccount'
/** Only the in-cluster API is supported. UI configuration cannot redirect credentials. */
export async function requestInCluster(path: string): Promise<unknown> {
  if (
    !path.startsWith('/api/v1/') &&
    !path.startsWith('/apis/discovery.k8s.io/v1/') &&
    !path.startsWith('/apis/apps/v1/') &&
    !path.startsWith('/apis/batch/v1/')
  ) {
    throw new Error('Only Kubernetes resource API paths are allowed')
  }
  const [token, ca] = await Promise.all([
    readFile(`${SERVICE_ACCOUNT}/token`, 'utf8'),
    readFile(`${SERVICE_ACCOUNT}/ca.crt`, 'utf8'),
  ])
  // Re-read projected credentials on every page so kubelet token rotation is respected.
  if (!token.trim() || !ca.trim())
    throw new Error('Kubernetes ServiceAccount token and CA are required')
  const client = createHttpClient({
    baseUrl: 'https://kubernetes.default.svc',
    auth: { type: 'bearer', token: token.trim() },
    ca,
    redirect: 'error',
  })
  try {
    return await client.json<unknown>(path, { signal: AbortSignal.timeout(15_000) })
  } finally {
    await client.dispose()
  }
}

export type RequestApi = (path: string) => Promise<unknown>
interface ResourceList {
  items: Resource[]
  metadata?: { continue?: string }
}
function isResourceList(value: unknown): value is ResourceList {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items))
    return false
  return value.items.every((item: unknown) => {
    if (!item || typeof item !== 'object' || !('metadata' in item)) return false
    const metadata = item.metadata
    return (
      !!metadata &&
      typeof metadata === 'object' &&
      'uid' in metadata &&
      typeof metadata.uid === 'string' &&
      !!metadata.uid &&
      'name' in metadata &&
      typeof metadata.name === 'string' &&
      !!metadata.name
    )
  })
}
export async function listResources(request: RequestApi, path: string): Promise<Resource[]> {
  const seen = new Set<string>()
  return paginate<Resource>(
    `${path}?limit=500`,
    async (pagePath) => {
      const result = await request(pagePath)
      if (!isResourceList(result)) throw new Error(`Invalid Kubernetes list response for ${path}`)
      const cursor = result.metadata?.continue
      if (cursor === undefined || cursor === '') return { items: result.items }
      if (typeof cursor !== 'string' || seen.has(cursor)) {
        throw new Error('Invalid Kubernetes pagination cursor')
      }
      seen.add(cursor)
      const params = new URLSearchParams({ limit: '500', continue: cursor })
      return { items: result.items, next: `${path}?${params}` }
    },
    {
      maxPages: 100,
      onTruncated: () => {
        throw new Error('Kubernetes list exceeded 100 pages; narrow the namespace scope')
      },
    },
  )
}
export async function fetchInventory(
  config: KubernetesConfig,
  request: RequestApi,
): Promise<Inventory> {
  const scopes = config.namespaces.length ? config.namespaces : ['']
  const inventory: Inventory = { nodes: [], pods: [], services: [], slices: [] }
  if (config.includeNodes) inventory.nodes = await listResources(request, '/api/v1/nodes')
  for (const namespace of scopes) {
    const scope = namespace ? `/namespaces/${encodeURIComponent(namespace)}` : ''
    // Fail the entire sync on RBAC/API failure rather than replacing a good graph with a partial one.
    inventory.pods.push(...(await listResources(request, `/api/v1${scope}/pods`)))
    inventory.services.push(...(await listResources(request, `/api/v1${scope}/services`)))
    inventory.slices.push(
      ...(await listResources(request, `/apis/discovery.k8s.io/v1${scope}/endpointslices`)),
    )
  }
  if (config.view !== 'pods') {
    inventory.workloads = []
    for (const namespace of scopes) {
      const scope = namespace ? `/namespaces/${encodeURIComponent(namespace)}` : ''
      for (const [api, resource, kind] of [
        ['apps', 'deployments', 'Deployment'],
        ['apps', 'replicasets', 'ReplicaSet'],
        ['apps', 'statefulsets', 'StatefulSet'],
        ['apps', 'daemonsets', 'DaemonSet'],
        ['batch', 'jobs', 'Job'],
        ['batch', 'cronjobs', 'CronJob'],
      ]) {
        inventory.workloads.push(
          ...(await listResources(request, `/apis/${api}/v1${scope}/${resource}`)).map((item) => ({
            ...item,
            kind,
          })),
        )
      }
    }
  }
  return inventory
}
