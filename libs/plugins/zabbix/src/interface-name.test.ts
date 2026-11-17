import { describe, expect, it, vi } from 'vitest'
import { ZabbixPlugin } from './plugin.js'

/**
 * Which interface a traffic item belongs to. Zabbix's own SNMP interface templates key an item by
 * the counter and the interface index (`net.if.in[ifHCInOctets.10]`); only the item's name says the
 * interface (`Interface Ethernet10(alias): Bits received`). Reading the bracket made every such
 * item an interface called `ifHCInOctets.10`, which no port is, so its link could not be mapped.
 */
function pluginWith(items: { key_: string; name: string }[]): ZabbixPlugin {
  const plugin = new ZabbixPlugin()
  const apiRequest = vi.fn(async () =>
    items.map((it, i) => ({
      itemid: String(i + 1),
      hostid: '1',
      lastvalue: '0',
      units: 'bps',
      ...it,
    })),
  )
  ;(plugin as unknown as { apiRequest: typeof apiRequest }).apiRequest = apiRequest
  return plugin
}

describe('the interface a traffic item belongs to', () => {
  it('is read from the item name when the key names a counter and an index', async () => {
    const plugin = pluginWith([
      {
        key_: 'net.if.in[ifHCInOctets.10]',
        name: 'Interface Ethernet10(to-SPG9000-PTP1): Bits received',
      },
      {
        key_: 'net.if.out[ifHCOutOctets.10]',
        name: 'Interface Ethernet10(to-SPG9000-PTP1): Bits sent',
      },
      { key_: 'net.if.in[ifHCInOctets.20]', name: 'Interface Vlan20(): Bits received' },
    ])
    const names = (await plugin.getHostItems('1')).map((i) => i.interfaceName)
    expect(names).toEqual(['Ethernet10', 'Ethernet10', 'Vlan20'])
  })

  it('is the key bracket when the bracket names the interface', async () => {
    const plugin = pluginWith([
      { key_: 'net.if.in[eth0]', name: 'Interface eth0: Bits received' },
      { key_: 'ifHCInOctets[GigabitEthernet1/0/1]', name: 'GigabitEthernet1/0/1 in' },
      { key_: 'net.if.in[eth0.100]', name: 'Interface eth0.100: Bits received' },
    ])
    const names = (await plugin.getHostItems('1')).map((i) => i.interfaceName)
    expect(names).toEqual(['eth0', 'GigabitEthernet1/0/1', 'eth0.100'])
  })
})
