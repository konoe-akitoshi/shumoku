// Plugin config
export interface ZabbixPluginConfig {
  url: string
  token: string
  pollInterval?: number
  /** Skip TLS certificate verification (self-signed / private-CA upstreams). */
  insecure?: boolean
}

// Zabbix API types
export interface ZabbixHost {
  hostid: string
  host: string
  name: string
  status: string
}

export interface ZabbixItem {
  itemid: string
  hostid: string
  name: string
  key_: string
  lastvalue: string
  lastclock: string
}
