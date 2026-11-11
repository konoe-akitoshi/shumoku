import { describe, expect, it } from 'vitest'
import { deepReadDevices, matchPort, type VisitedDevice, type VisitedPort } from './deep-read.js'
import {
  IF_TABLE,
  IF_X_TABLE,
  LLDP_LOC_CHASSIS_ID,
  LLDP_LOC_CHASSIS_ID_SUBTYPE,
  LLDP_LOC_PORT_TABLE,
  LLDP_REM_TABLE,
  SYSTEM_MIB,
} from './mib.js'

function deviceWith(ports: VisitedPort[]): VisitedDevice {
  return {
    nodeId: 'deep-read:node:10.0.0.1',
    attributes: { address: '10.0.0.1' },
    community: 'x',
    ports: new Map(ports.map((p) => [String(p.ifIndex), p])),
  }
}

const port = (ifIndex: number, name: string, mac?: string): VisitedPort => ({
  name,
  ifName: name,
  ifIndex,
  ...(mac ? { mac } : {}),
})

describe('matchPort', () => {
  const device = deviceWith([
    port(1, 'Ethernet1', '2c:dd:e9:28:05:01'),
    port(2, 'Ethernet2', '2c:dd:e9:28:05:02'),
    port(1000049, 'Ethernet49/1', '2c:dd:e9:28:05:31'),
    port(3, 'Management1', '2c:dd:e9:28:05:99'),
    port(4, 'Vlan1', '2c:dd:e9:28:05:99'),
  ])

  it('matches a name id to the interface name', () => {
    expect(matchPort(device, { kind: 'text', value: 'Ethernet49/1' }, undefined)).toBe(
      'Ethernet49/1',
    )
  })

  it('matches a MAC id to the one interface that owns that MAC', () => {
    expect(matchPort(device, { kind: 'mac', value: '2c:dd:e9:28:05:02' }, undefined)).toBe(
      'Ethernet2',
    )
  })

  it('does not guess when several interfaces share the MAC', () => {
    expect(
      matchPort(device, { kind: 'mac', value: '2c:dd:e9:28:05:99' }, undefined),
    ).toBeUndefined()
  })

  it('falls back to the port description', () => {
    expect(matchPort(device, { kind: 'mac', value: '00:00:00:00:00:00' }, 'Ethernet1')).toBe(
      'Ethernet1',
    )
  })

  it('returns undefined when nothing matches, so the wire anchors on the switch', () => {
    expect(matchPort(device, { kind: 'text', value: 'nope' }, 'also-nope')).toBeUndefined()
    expect(matchPort(device, undefined, undefined)).toBeUndefined()
  })
})

const macBytes = (mac: string) => Buffer.from(mac.replaceAll(':', ''), 'hex')

interface FakeDevice {
  chassis: string
  sysName: string
  ports: Array<{ ifIndex: number; name: string; mac?: string }>
  localPorts?: Array<{ num: number; name: string }>
  neighbours?: Array<{
    localNum: number
    chassis: string
    port: string
    sysName?: string
    /** LldpChassisIdSubtype, 4 (a MAC) by default; `chassis` is then taken as text unless 4. */
    chassisSubtype?: number
    /** LldpPortIdSubtype, 5 (a name) by default; 3 takes `port` as a MAC. */
    portSubtype?: number
    description?: string
  }>
  failLldp?: boolean
  /** The agent has no LLDP MIB: its LLDP scalars answer noSuchObject. */
  noLldpMib?: boolean
  /** Only the chassis id subtype is missing. */
  noChassisSubtype?: boolean
  /** The LLDP scalars time out. */
  lldpScalarsTimeOut?: boolean
}

/** A stand-in for the SNMP client, serving only the columns deep-read walks. */
function fakeClients(devices: Record<string, FakeDevice>) {
  return ({ address }: { address: string }) => {
    const device = devices[address]
    const rows = (oid: string, entries: Array<[string, unknown]>) =>
      entries.map(([suffix, value]) => ({ oid: `${oid}.${suffix}`, value }))
    return {
      close: () => {},
      get: async (oids: string[]) => {
        if (!device) throw new Error('timeout')
        const values: Record<string, unknown> = {
          [SYSTEM_MIB.sysName]: device.sysName,
          [SYSTEM_MIB.sysObjectID]: '1.3.6.1.4.1.99999',
          [SYSTEM_MIB.sysDescr]: 'desc',
          [LLDP_LOC_CHASSIS_ID]: macBytes(device.chassis),
          [LLDP_LOC_CHASSIS_ID_SUBTYPE]: 4,
        }
        if (device.lldpScalarsTimeOut && oids.some((o) => o.startsWith('1.0.8802.'))) {
          throw new Error('Request timed out')
        }
        if (device.noLldpMib && oids.some((o) => o.startsWith('1.0.8802.'))) {
          throw new Error(`NoSuchObject: ${oids[0]}`)
        }
        if (device.noChassisSubtype && oids.includes(LLDP_LOC_CHASSIS_ID_SUBTYPE)) {
          throw new Error(`NoSuchObject: ${LLDP_LOC_CHASSIS_ID_SUBTYPE}`)
        }
        return oids.map((oid) => ({ oid, value: values[oid] }))
      },
      walk: async (oid: string) => {
        if (!device) throw new Error('timeout')
        const ports = device.ports
        if (oid === IF_TABLE.ifDescr || oid === IF_X_TABLE.ifName) {
          return rows(
            oid,
            ports.map((p) => [`${p.ifIndex}`, Buffer.from(p.name)]),
          )
        }
        if (oid === IF_TABLE.ifPhysAddress) {
          return rows(
            oid,
            ports.flatMap((p) => (p.mac ? [[`${p.ifIndex}`, macBytes(p.mac)]] : [])),
          )
        }
        if (oid === LLDP_LOC_PORT_TABLE.lldpLocPortId) {
          return rows(
            oid,
            (device.localPorts ?? []).map((p) => [`${p.num}`, Buffer.from(p.name)]),
          )
        }
        if (oid === LLDP_LOC_PORT_TABLE.lldpLocPortIdSubtype) {
          return rows(
            oid,
            (device.localPorts ?? []).map((p) => [`${p.num}`, 5]),
          )
        }
        const remote = Object.values(LLDP_REM_TABLE) as string[]
        if (!remote.includes(oid)) return []
        if (device.failLldp) throw new Error('walk timed out')
        const row = (
          n: FakeDevice['neighbours'] extends Array<infer T> | undefined ? T : never,
        ) => {
          const chassisSubtype = n.chassisSubtype ?? 4
          const portSubtype = n.portSubtype ?? 5
          if (oid === LLDP_REM_TABLE.lldpRemChassisId) {
            return chassisSubtype === 4 ? macBytes(n.chassis) : Buffer.from(n.chassis)
          }
          if (oid === LLDP_REM_TABLE.lldpRemChassisIdSubtype) return chassisSubtype
          if (oid === LLDP_REM_TABLE.lldpRemPortId) {
            return portSubtype === 3 ? macBytes(n.port) : Buffer.from(n.port)
          }
          if (oid === LLDP_REM_TABLE.lldpRemPortIdSubtype) return portSubtype
          if (oid === LLDP_REM_TABLE.lldpRemPortDesc) return Buffer.from(n.description ?? '')
          if (oid === LLDP_REM_TABLE.lldpRemSysName) return Buffer.from(n.sysName ?? '')
          return Buffer.alloc(0)
        }
        return rows(
          oid,
          (device.neighbours ?? []).map((n, i) => [`0.${n.localNum}.${i + 1}`, row(n)]),
        )
      },
    }
  }
}

const SW_A = 'aa:aa:aa:00:00:01'
const SW_B = 'aa:aa:aa:00:00:02'
const read = (devices: Record<string, FakeDevice>) =>
  deepReadDevices(
    Object.keys(devices).map((address) => ({ address, community: 'x' })),
    'deep-read',
    fakeClients(devices),
  )

describe('deepReadDevices', () => {
  const pair = (): Record<string, FakeDevice> => ({
    '10.0.0.1': {
      chassis: SW_A,
      sysName: 'a',
      ports: [{ ifIndex: 1, name: 'Ethernet1' }],
      neighbours: [{ localNum: 1, chassis: SW_B, port: 'Ethernet2', sysName: 'b' }],
    },
    '10.0.0.2': {
      chassis: SW_B,
      sysName: 'b',
      ports: [{ ifIndex: 2, name: 'Ethernet2' }],
      neighbours: [{ localNum: 2, chassis: SW_A, port: 'Ethernet1', sysName: 'a' }],
    },
  })

  it('names which devices had their links read', async () => {
    const devices = pair()
    const second = devices['10.0.0.2']
    if (second) second.failLldp = true

    const result = await read(devices)

    expect(result.partial).toBe(true)
    expect(result.linksRead).toEqual(['deep-read:node:10.0.0.1'])
  })

  it('asks the local port table before treating the LLDP port number as an ifIndex', async () => {
    const result = await read({
      '10.0.0.1': {
        chassis: SW_A,
        sysName: 'a',
        // Number 7 is also the ifIndex of a different interface.
        ports: [
          { ifIndex: 7, name: 'Ethernet7' },
          { ifIndex: 1000049, name: 'Ethernet49/1' },
        ],
        localPorts: [{ num: 7, name: 'Ethernet49/1' }],
        neighbours: [{ localNum: 7, chassis: SW_B, port: 'p1', sysName: 'b' }],
      },
    })

    const ends = result.source.network.links[0]?.endpoints ?? []
    expect(ends[0]).toMatchObject({ port: 'Ethernet49/1' })
  })

  const single = (extra: Partial<FakeDevice>): Record<string, FakeDevice> => ({
    '10.0.0.1': {
      chassis: SW_A,
      sysName: 'a',
      ports: [{ ifIndex: 1, name: 'Ethernet1', mac: 'aa:aa:aa:00:01:01' }],
      ...extra,
    },
  })
  const firstLink = (r: Awaited<ReturnType<typeof read>>) => r.source.network.links[0]

  it('reads a device that has no LLDP MIB', async () => {
    const result = await read(single({ noLldpMib: true }))

    expect(result.readCount).toBe(1)
    expect(result.partial).toBe(false)
    expect(result.source.network.nodes[0]?.label).toBe('a')
  })

  it('keeps the chassis id when only its subtype is missing', async () => {
    const result = await read(single({ noChassisSubtype: true }))

    expect(
      result.source.network.nodes.find((n) => n.id === 'deep-read:node:10.0.0.1')?.chassisId,
    ).toBe(SW_A)
  })

  it('treats a timeout on the LLDP scalars as a failed read', async () => {
    const result = await read(single({ lldpScalarsTimeOut: true }))

    expect(result.readCount).toBe(0)
    expect(result.partial).toBe(true)
  })

  it('reads a device-assigned chassis id as text', async () => {
    const result = await read(
      single({
        neighbours: [{ localNum: 1, chassis: 'NEO2101.01071', chassisSubtype: 7, port: 'p1' }],
      }),
    )

    const peer = result.source.network.nodes.find((n) => n.label === 'NEO2101.01071')
    expect(peer).toBeDefined()
    expect(peer?.mac).toBeUndefined()
  })

  it('takes a chassis id of printable bytes as the MAC its subtype says it is', async () => {
    const result = await read(
      single({ neighbours: [{ localNum: 1, chassis: '41:42:43:44:45:46', port: 'p1' }] }),
    )

    const peer = result.source.network.nodes.find((n) => n.id.includes('lldp'))
    expect(peer?.mac).toBe('41:42:43:44:45:46')
  })

  it('names a MAC port by its description', async () => {
    const result = await read(
      single({
        neighbours: [
          {
            localNum: 1,
            chassis: SW_B,
            port: '00:14:57:02:b8:5e',
            portSubtype: 3,
            description: 'Ethernet 3.3',
          },
        ],
      }),
    )

    expect(firstLink(result)?.endpoints[1]).toMatchObject({ port: 'Ethernet 3.3' })
  })

  it('shows a MAC port by its MAC when it has no description', async () => {
    const result = await read(
      single({
        neighbours: [{ localNum: 1, chassis: SW_B, port: '00:20:fc:3a:be:47', portSubtype: 3 }],
      }),
    )

    expect(firstLink(result)?.endpoints[1]).toMatchObject({ port: '00:20:fc:3a:be:47' })
  })

  it('resolves a far MAC to the port of a device it also read', async () => {
    const result = await read({
      '10.0.0.1': {
        chassis: SW_A,
        sysName: 'a',
        ports: [{ ifIndex: 1, name: 'Ethernet1' }],
        neighbours: [{ localNum: 1, chassis: SW_B, port: 'bb:bb:bb:00:00:09', portSubtype: 3 }],
      },
      '10.0.0.2': {
        chassis: SW_B,
        sysName: 'b',
        ports: [{ ifIndex: 9, name: 'Ethernet9', mac: 'bb:bb:bb:00:00:09' }],
      },
    })

    expect(firstLink(result)?.endpoints[1]).toMatchObject({ port: 'Ethernet9' })
  })
})
