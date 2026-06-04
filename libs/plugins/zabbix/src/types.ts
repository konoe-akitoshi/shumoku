// Plugin config
export interface ZabbixPluginConfig {
  url: string
  token: string
  pollInterval?: number
  /** Skip TLS certificate verification (self-signed / private-CA upstreams). */
  insecure?: boolean
  /**
   * Data-source instance id, injected by the host at construction (NOT a form
   * field). Stamped into `provenance.source` on every topology entity so the
   * resolver can attribute / the human can override. Falls back to the plugin
   * type when absent — see the #339 instance-id plumbing direction.
   */
  instanceId?: string
}

/** Per-attachment topology options passed to `fetchTopology` (from `optionsJson`). */
export interface ZabbixTopologyOptions {
  /** sysmapid of the Zabbix map (sysmap) to import. Required. */
  sysmapId?: string
  /**
   * How to derive subgraphs. `'hostgroup'` (default) nests each node under its
   * most-specific host group; `'none'` uses only standard host-group area
   * elements on the map. See the converter for details.
   */
  groupBy?: 'none' | 'hostgroup'
  /** Host-group names to never use as a subgraph (admin / catch-all groups). */
  groupExclude?: string[]
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

/** A `{groupid, name}` from `host.get` `selectHostGroups` / `hostgroup.get`. */
export interface ZabbixHostGroup {
  groupid: string
  name: string
}

/** A `{name}` from `host.get` `selectParentTemplates`. */
export interface ZabbixParentTemplate {
  templateid?: string
  name: string
}

/**
 * Host inventory (`host.get` `selectInventory`). Free-text fields, mostly empty
 * under auto inventory mode; `hardware` is the most reliable device-facts source
 * (vendor/model/OS as an SNMP sysDescr-style string).
 */
export interface ZabbixInventory {
  hardware?: string
  vendor?: string
  model?: string
  os?: string
  serialno_a?: string
  location?: string
  [key: string]: string | undefined
}

export interface ZabbixHost {
  hostid: string
  host: string
  name: string
  /** '0' = monitored, '1' = unmonitored. */
  status: string
  interfaces?: ZabbixHostInterface[]
  /** Present when `host.get` is called with `selectHostGroups`. */
  hostgroups?: ZabbixHostGroup[]
  /** Present when `host.get` is called with `selectParentTemplates`. */
  parentTemplates?: ZabbixParentTemplate[]
  /** Present when `host.get` is called with `selectInventory`. */
  inventory?: ZabbixInventory
}

// ============================================
// Sysmap (network map) API types — standard `map.get` shapes only.
// https://www.zabbix.com/documentation/7.0/en/manual/api/reference/map/object
// ============================================

/** Element reference inside a `selement.elements` array (varies by elementtype). */
export interface ZabbixSelementRef {
  hostid?: string
  groupid?: string
  triggerid?: string
  sysmapid?: string
}

/**
 * A map element (`selement`). `elementtype`: '0' host, '1' map (submap),
 * '2' trigger, '3' host group, '4' image. `elementsubtype` '1' on a host-group
 * element means "separate hosts" (the group is drawn as an area of its hosts).
 */
export interface ZabbixSelement {
  selementid: string
  elementtype: string
  elementsubtype?: string
  label?: string
  x?: string
  y?: string
  iconid_off?: string
  elements?: ZabbixSelementRef[]
}

/** A map link between two selements. */
export interface ZabbixMapLink {
  linkid: string
  selementid1: string
  selementid2: string
  /** '0' line, '2' bold, '3' dotted, '4' dashed. */
  drawtype?: string
  /** Hex color without '#', e.g. '0000FF'. */
  color?: string
  label?: string
}

/** A Zabbix sysmap (network map) from `map.get`. */
export interface ZabbixSysmap {
  sysmapid: string
  name: string
  width?: string
  height?: string
  selements?: ZabbixSelement[]
  links?: ZabbixMapLink[]
}

export interface ZabbixItem {
  itemid: string
  hostid: string
  name: string
  key_: string
  lastvalue: string
  lastclock: string
}
