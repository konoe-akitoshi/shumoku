import type { NewRelicClient } from './client.js'
import { literal, source, windowAt } from './values.js'

export async function readPortMetrics(
  client: NewRelicClient,
  infra: boolean,
  ids: string[],
  now: number,
  seconds: number,
) {
  const guids = ids.map(literal).join(',')
  const window = windowAt(now, Math.max(seconds * 2, 300))
  return client.nrql(
    infra
      ? `SELECT latest(state) AS oper, latest(receiveBytesPerSecond)*8 AS inBps, latest(transmitBytesPerSecond)*8 AS outBps, filter(latest(timestamp), WHERE state IS NOT NULL) AS stateSeen, filter(latest(timestamp), WHERE receiveBytesPerSecond IS NOT NULL) AS inSeen, filter(latest(timestamp), WHERE transmitBytesPerSecond IS NOT NULL) AS outSeen FROM NetworkSample WHERE entityGuid IN (${guids}) FACET entityGuid, interfaceName LIMIT MAX ${window}`
      : `SELECT count(*) AS samples, latest(if_interface_name) AS name, latest(if_Index) AS index, latest(if_OperStatus) AS oper, latest(if_Speed) AS speed, rate(sum(kentik.snmp.ifHCInOctets)*8,1 SECOND) AS inBps, rate(sum(kentik.snmp.ifHCOutOctets)*8,1 SECOND) AS outBps, filter(latest(timestamp),WHERE metricName='kentik.snmp.if_OperStatus') AS stateSeen, filter(latest(timestamp),WHERE metricName='kentik.snmp.ifHCInOctets') AS inSeen, filter(latest(timestamp),WHERE metricName='kentik.snmp.ifHCOutOctets') AS outSeen ${source} AND entity.guid IN (${guids}) AND if_interface_name IS NOT NULL FACET entity.guid, if_interface_name LIMIT MAX ${window}`,
  )
}
