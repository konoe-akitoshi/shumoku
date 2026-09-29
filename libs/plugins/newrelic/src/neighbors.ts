import type { InterfaceNeighbor, Link } from '@shumoku/core'
import { normalizeMacKey } from '@shumoku/core/plugin-kit'
import type { Device } from './inventory.js'
import { fresh, num, type Row, str } from './values.js'

export interface Adjacency {
  hostId: string
  neighbor: InterfaceNeighbor
  peerId: string
  peerPort: string
  observedAt: number
}
export function resolveNeighbors(
  devices: Device[],
  rows: Row[],
  now: number,
): { adjacencies: Adjacency[]; links: Link[]; warnings: string[] } {
  const warnings: string[] = []
  const adjacencies: Adjacency[] = []
  const links = new Map<string, Link>()
  for (const row of rows) {
    const guid = str(row['guid'])
    const device = devices.find((d) => d.guid === guid)
    const localName = str(row['localName'])
    const remoteName = str(row['remoteName'])
    const remoteChassis = str(row['remoteChassis'])
      ? normalizeMacKey(String(row['remoteChassis']))
      : undefined
    const remotePort = str(row['remotePort'])
    const seen = num(row['seen'])
    const local = device?.ports.find((p) => p.name === localName)
    if (!device || !local || !remotePort || !seen || !fresh(seen, now, 7200)) {
      warnings.push('Neighbor omitted: missing local interface mapping or stale observation')
      continue
    }
    // Never interpret lldpLocPortNum as ifIndex. Only explicitly joined local names enter here.
    const peers = devices.filter(
      (d) =>
        d.host.id !== device.host.id &&
        ((remoteChassis && d.host.identity?.chassisId === remoteChassis) ||
          (remoteName && d.host.identity?.sysName === remoteName)),
    )
    const peer = peers.length === 1 ? peers[0] : undefined
    const ports = peer?.ports.filter(
      (p) =>
        ((row['remotePortSubtype'] === 'interfaceName' || row['remotePortSubtype'] === 5) &&
          p.name === remotePort) ||
        ((row['remotePortSubtype'] === 'macAddress' || row['remotePortSubtype'] === 3) &&
          p.port.identity?.mac === normalizeMacKey(remotePort)),
    )
    const port = ports?.length === 1 ? ports[0] : undefined
    if (!peer || !port) {
      warnings.push(`Unresolved neighbor for ${device.host.name}/${local.name}`)
      continue
    }
    const neighbor: InterfaceNeighbor = {
      localInterface: local.name,
      localInterfaceIdentity: local.port.identity,
      remoteSysName: remoteName,
      remoteChassisId: remoteChassis,
      remotePortId: port.name,
    }
    adjacencies.push({
      hostId: device.host.id,
      neighbor,
      peerId: peer.host.id,
      peerPort: port.name,
      observedAt: seen,
    })
    const endpoints = [
      { node: device.host.id, port: local.name },
      { node: peer.host.id, port: port.name },
    ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    const from = endpoints[0]
    const to = endpoints[1]
    if (!from || !to) continue
    const id = `newrelic:${JSON.stringify(endpoints)}`
    const speed = Math.min(num(local.raw['speed']) ?? Infinity, num(port.raw['speed']) ?? Infinity)
    links.set(id, {
      id,
      from,
      to,
      ...(Number.isFinite(speed) && speed > 0 ? { bandwidth: speed * 1_000_000 } : {}),
      provenance: { source: 'newrelic', observedAt: seen },
    })
  }
  // A local port reporting contradictory peers must not create multiple physical cables.
  const counts = new Map<string, number>()
  for (const link of links.values())
    for (const endpoint of [link.from, link.to]) {
      const key = JSON.stringify(endpoint)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  const valid = [...links.values()].filter((link) =>
    [link.from, link.to].every((e) => counts.get(JSON.stringify(e)) === 1),
  )
  if (valid.length !== links.size)
    warnings.push('Conflicting neighbors omitted: a port reports multiple peers')
  const validEndpoints = new Set(
    valid.flatMap((l) => [JSON.stringify(l.from), JSON.stringify(l.to)]),
  )
  return {
    links: valid,
    warnings,
    adjacencies: adjacencies.filter((a) =>
      validEndpoints.has(JSON.stringify({ node: a.hostId, port: a.neighbor.localInterface })),
    ),
  }
}
