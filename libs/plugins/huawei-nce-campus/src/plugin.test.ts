import { describe, expect, it } from 'vitest'
import {
  alarmToAlert,
  deriveUtilization,
  deviceToHost,
  interfacePerfToLinkMetrics,
  mapAlarmSeverity,
  mapDeviceStatus,
  mapLinkStatus,
  perfToNodeMetrics,
  uplinkThroughput,
} from './plugin.js'

describe('mapDeviceStatus', () => {
  it('maps controller status codes to host status', () => {
    expect(mapDeviceStatus('0')).toBe('up') // normal
    expect(mapDeviceStatus('1')).toBe('up') // alarm — device is still reachable
    expect(mapDeviceStatus('3')).toBe('down') // offline
    expect(mapDeviceStatus('4')).toBe('unknown') // not registered
    expect(mapDeviceStatus(undefined)).toBe('unknown')
  })
})

describe('deviceToHost', () => {
  it('builds a host with identity from a device record', () => {
    const host = deviceToHost({
      id: 'dev-1',
      name: 'campus-core-01',
      esn: 'ESN123',
      status: '0',
      mac: '00:11:22:33:44:55',
      ip: '10.0.0.2',
    })
    expect(host).toMatchObject({
      id: 'dev-1',
      name: 'campus-core-01',
      displayName: 'campus-core-01',
      status: 'up',
      ip: '10.0.0.2',
      identity: {
        mgmtIp: '10.0.0.2',
        mac: '00:11:22:33:44:55',
        vendorIds: { 'nce-device-id': 'dev-1', 'nce-esn': 'ESN123' },
      },
    })
  })

  it('returns null for a record without an id', () => {
    expect(deviceToHost({ name: 'ghost' })).toBeNull()
  })
})

describe('perfToNodeMetrics', () => {
  it('maps performance status codes and carries cpu/memory', () => {
    expect(perfToNodeMetrics({ status: 0, cpuRate: 12, memoryRate: 40 })).toMatchObject({
      status: 'up',
      cpu: 12,
      memory: 40,
    })
    expect(perfToNodeMetrics({ status: 1 }).status).toBe('up') // alarm
    expect(perfToNodeMetrics({ status: 2 }).status).toBe('down') // faulty
    expect(perfToNodeMetrics({ status: 3 }).status).toBe('down') // offline
    expect(perfToNodeMetrics({ status: 4 }).status).toBe('unknown') // unregistered
    expect(perfToNodeMetrics({}).status).toBe('unknown')
  })
})

describe('interfacePerfToLinkMetrics', () => {
  it('parses bandwidth-usage percentages into utilization', () => {
    const m = interfacePerfToLinkMetrics({ inputBandwidth: '12.5', outBandwidth: '3' })
    expect(m).toMatchObject({
      status: 'up',
      inUtilization: 12.5,
      outUtilization: 3,
      utilization: 12.5,
    })
  })

  it('omits utilization when the NBI returns nothing parseable', () => {
    const m = interfacePerfToLinkMetrics({ inputBandwidth: '', outBandwidth: 'n/a' })
    expect(m.status).toBe('up')
    expect(m.inUtilization).toBeUndefined()
    expect(m.outUtilization).toBeUndefined()
    expect(m.utilization).toBeUndefined()
  })

  it('clamps out-of-range percentages', () => {
    const m = interfacePerfToLinkMetrics({ inputBandwidth: '250', outBandwidth: '-3' })
    expect(m.inUtilization).toBe(100)
    expect(m.outUtilization).toBe(0)
  })
})

describe('uplinkThroughput', () => {
  it('maps device speeds onto the uplink, device->network as out', () => {
    expect(uplinkThroughput({ upwardSpeed: 3379224, downwardSpeed: 1003386 })).toEqual({
      outBps: 3379224,
      inBps: 1003386,
    })
  })

  it('fills the missing direction with zero when only one is reported', () => {
    expect(uplinkThroughput({ upwardSpeed: 500 })).toEqual({ outBps: 500, inBps: 0 })
  })

  it('returns nothing when the controller reports neither', () => {
    // An idle or not-yet-collected device must get status only — a fabricated
    // zero would read as "measured, and it is zero".
    expect(uplinkThroughput({})).toBeUndefined()
    expect(uplinkThroughput({ cpuRate: 5 })).toBeUndefined()
  })

  it('keeps a genuine zero', () => {
    expect(uplinkThroughput({ upwardSpeed: 0, downwardSpeed: 0 })).toEqual({ outBps: 0, inBps: 0 })
  })
})

describe('deriveUtilization', () => {
  it('divides throughput by the port capacity Link Management reports', () => {
    // 3 Mbit/s out, 1.5 Mbit/s in on a 1G port — the shape of a live AP uplink.
    expect(deriveUtilization({ inBps: 1_500_000, outBps: 3_000_000 }, 1e9)).toEqual({
      inUtilization: 0.15,
      outUtilization: 0.3,
      utilization: 0.3,
    })
  })

  it('clamps a counter that overshoots the negotiated speed', () => {
    expect(deriveUtilization({ inBps: 5e9, outBps: 0 }, 1e9)).toEqual({
      inUtilization: 100,
      outUtilization: 0,
      utilization: 100,
    })
  })

  it('stays silent without a capacity to divide by', () => {
    // No denominator means no percentage. Emitting 0 would paint the link the
    // "idle" grey as if it had been measured and found empty.
    expect(deriveUtilization({ inBps: 1e6, outBps: 1e6 }, undefined)).toBeUndefined()
    expect(deriveUtilization({ inBps: 1e6, outBps: 1e6 }, 0)).toBeUndefined()
  })

  it('stays silent without throughput', () => {
    expect(deriveUtilization(undefined, 1e9)).toBeUndefined()
  })
})

describe('mapLinkStatus', () => {
  it('maps the Link Management status enum', () => {
    expect(mapLinkStatus(0)).toBe('up') // normal
    expect(mapLinkStatus(2)).toBe('down') // major
    expect(mapLinkStatus(3)).toBe('down') // critical
    expect(mapLinkStatus(4)).toBe('down') // offline — a record whose endpoint left
    expect(mapLinkStatus(6)).toBe('down') // faulty
    expect(mapLinkStatus(1)).toBe('unknown') // unknown
    expect(mapLinkStatus(5)).toBe('unknown') // unmanaged
  })
})

describe('mapAlarmSeverity', () => {
  it('maps the 1–4 NCE scale to the neutral scale', () => {
    expect(mapAlarmSeverity(1)).toBe('critical')
    expect(mapAlarmSeverity(2)).toBe('high')
    expect(mapAlarmSeverity(3)).toBe('medium')
    expect(mapAlarmSeverity(4)).toBe('low')
    expect(mapAlarmSeverity(undefined)).toBe('info')
  })
})

describe('alarmToAlert', () => {
  it('maps an uncleared alarm to an active alert', () => {
    const alert = alarmToAlert({
      csn: '28100132',
      alarmName: 'Device offline',
      alarmLevel: 1,
      alarmResName: 'campus-core-01',
      alarmCategory: 'communication',
      latestOccurUtc: '1711029340291',
      cleared: 0,
      probableCause: 'The device lost its management channel.',
    })
    expect(alert).toMatchObject({
      id: '28100132',
      severity: 'critical',
      title: 'Device offline',
      startTime: 1711029340291,
      status: 'active',
      source: 'huawei-nce-campus',
      labels: { category: 'communication', resource: 'campus-core-01' },
    })
    expect(alert.description).toContain('management channel')
  })

  it('maps a cleared alarm to resolved', () => {
    const alert = alarmToAlert({ csn: '1', alarmName: 'x', cleared: 1 })
    expect(alert.status).toBe('resolved')
  })
})
