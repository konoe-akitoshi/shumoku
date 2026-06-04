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

/**
 * Per-attachment topology options passed to `fetchTopology` (from `optionsJson`).
 * Topology is generated from hosts (nodes) + LLDP neighbor items (links) — see
 * `apps/server/docs/design/zabbix-lldp-topology.md`.
 */
export interface ZabbixTopologyOptions {
  /**
   * Host-group ids to scope the import to. Strongly recommended — a Zabbix
   * instance can hold thousands of hosts. Empty / absent = all hosts.
   */
  hostGroups?: string[]
  /**
   * How to derive subgraphs. `'hostgroup'` (default) nests each node under its
   * most-specific host group; `'none'` emits a flat graph.
   */
  groupBy?: 'none' | 'hostgroup'
  /** Host-group names to never use as a subgraph (admin / catch-all groups). */
  groupExclude?: string[]
  /**
   * Synthesize a node for an LLDP neighbor that isn't a Zabbix host (default
   * true) so the link still renders and a later discovery of that device
   * clusters with it. When false, links to non-host neighbors are dropped.
   */
  includeExternalNeighbors?: boolean
}

/**
 * One LLDP adjacency discovered on a host, assembled by the plugin from the
 * per-interface `lldp.rem.*` / `lldp.loc.if.*` items and handed to the converter.
 */
export interface ZabbixLldpNeighbor {
  /** Local interface name (e.g. `et-0/0/5`). */
  localIf: string
  /** Remote system name reported by LLDP (resolved against `host.name`). */
  remSysname: string
  /** Remote port id (a port name, or a MAC when port-id is MAC-typed). */
  remPortId?: string
  /** Remote chassis id (identity key for a synthesized external node). */
  remChassisId?: string
  /** Local interface speed in bits/sec, when known. */
  speedBps?: number
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

export interface ZabbixItem {
  itemid: string
  hostid: string
  name: string
  key_: string
  lastvalue: string
  lastclock: string
}
