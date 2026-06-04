// Plugin config
export interface ZabbixPluginConfig {
  url: string
  token: string
  pollInterval?: number
  /** Skip TLS certificate verification (self-signed / private-CA upstreams). */
  insecure?: boolean
}

// Zabbix API types
export interface ZabbixHostInterface {
  ip?: string
  dns?: string
  /** '1' = default interface for its type. */
  main?: string
  /** '1' agent, '2' SNMP, '3' IPMI, '4' JMX. */
  type?: string
  /** '1' connect via IP, '0' via DNS. */
  useip?: string
}

export interface ZabbixHost {
  hostid: string
  host: string
  name: string
  status: string
  interfaces?: ZabbixHostInterface[]
}

export interface ZabbixItem {
  itemid: string
  hostid: string
  name: string
  key_: string
  lastvalue: string
  lastclock: string
}
