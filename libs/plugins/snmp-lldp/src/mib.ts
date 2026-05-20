// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * MIB OIDs the SNMP-LLDP plugin walks. Centralized so changes /
 * additional MIBs are easy to spot.
 */

/** RFC 1213 System-MIB scalars (always `.0` suffix to fetch). */
export const SYSTEM_MIB = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
} as const

/** RFC 2863 IF-MIB columns under `ifTable` (1.3.6.1.2.1.2.2.1). */
export const IF_TABLE = {
  base: '1.3.6.1.2.1.2.2.1',
  ifIndex: '1.3.6.1.2.1.2.2.1.1',
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifMtu: '1.3.6.1.2.1.2.2.1.4',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
} as const

/** RFC 2863 IF-MIB ifXTable extensions (1.3.6.1.2.1.31.1.1.1). */
export const IF_X_TABLE = {
  base: '1.3.6.1.2.1.31.1.1.1',
  ifName: '1.3.6.1.2.1.31.1.1.1.1',
  ifHighSpeed: '1.3.6.1.2.1.31.1.1.1.15',
  ifAlias: '1.3.6.1.2.1.31.1.1.1.18',
} as const

/** RFC 4293 IP-MIB ipNetToMedia (ARP cache; v4 only). */
export const IP_NET_TO_MEDIA = {
  base: '1.3.6.1.2.1.4.22.1',
  // index: ifIndex.ipv4-address → physical address
  ipNetToMediaPhysAddress: '1.3.6.1.2.1.4.22.1.2',
} as const

/**
 * IEEE 802.1AB LLDP-MIB — lldpRemTable (remote / neighbor info).
 *
 * Indexes: `lldpRemTimeMark.lldpRemLocalPortNum.lldpRemIndex`
 * which decode to "snapshot generation . local port . per-neighbor index".
 *
 * The `lldpRemLocalPortNum` part is the LOCAL port the neighbor was
 * heard on — important: this is the LLDP-MIB port number, NOT the
 * IF-MIB ifIndex. Most devices align them, but some don 't; for v1 we
 * treat them as equivalent (good enough for a starting MVP).
 */
export const LLDP_REM_TABLE = {
  base: '1.0.8802.1.1.2.1.4.1.1',
  lldpRemChassisIdSubtype: '1.0.8802.1.1.2.1.4.1.1.4',
  lldpRemChassisId: '1.0.8802.1.1.2.1.4.1.1.5',
  lldpRemPortIdSubtype: '1.0.8802.1.1.2.1.4.1.1.6',
  lldpRemPortId: '1.0.8802.1.1.2.1.4.1.1.7',
  lldpRemPortDesc: '1.0.8802.1.1.2.1.4.1.1.8',
  lldpRemSysName: '1.0.8802.1.1.2.1.4.1.1.9',
  lldpRemSysDesc: '1.0.8802.1.1.2.1.4.1.1.10',
} as const

/** LLDP local port translation table. Maps LLDP local port nums
 *  (used as the middle index in lldpRemTable) to actual port info.
 *  v1 mostly assumes the lldpLocalPortNum == ifIndex which is true on
 *  most modern devices. */
export const LLDP_LOC_PORT_TABLE = {
  base: '1.0.8802.1.1.2.1.3.7.1',
  lldpLocPortIdSubtype: '1.0.8802.1.1.2.1.3.7.1.2',
  lldpLocPortId: '1.0.8802.1.1.2.1.3.7.1.3',
  lldpLocPortDesc: '1.0.8802.1.1.2.1.3.7.1.4',
} as const
