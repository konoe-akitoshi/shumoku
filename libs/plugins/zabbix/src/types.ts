// Plugin config
export interface ZabbixPluginConfig {
  url: string
  token: string
  pollInterval?: number
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
