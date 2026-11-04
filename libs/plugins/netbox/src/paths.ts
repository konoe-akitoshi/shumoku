/**
 * What a traced cable path says. NetBox follows a cable through patch panels and circuits and
 * reports the far end in `connected_endpoints`; these read that, so the client and the converter
 * agree on which paths are one cable.
 */

import type { NetBoxInterface } from './types.js'

/**
 * The id of the cable when the interface's whole path is that one cable between interfaces: the
 * far end sits on the same cable. A path through a panel or a circuit has several cables with
 * several media, so no cable type or length describes it.
 */
export function directCableId(iface: NetBoxInterface): number | undefined {
  const cable = iface.cable?.id
  if (cable === undefined || iface.wireless_link) return undefined
  if (iface.connected_endpoints_type !== 'dcim.interface') return undefined
  if (iface.connected_endpoints_reachable !== true) return undefined
  const ends = iface.connected_endpoints ?? []
  if (ends.length === 0) return undefined
  return ends.every((end) => end.cable?.id === cable) ? cable : undefined
}
