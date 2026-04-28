// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { PortConnector, PortRole } from '@shumoku/core'
import type { CatalogEntry, HardwareProperties, PortGroup } from './types.js'

export interface CatalogPortTemplate {
  label: string
  faceplateLabel?: string
  interfaceName?: string
  aliases?: string[]
  role?: PortRole | (string & {})
  speed?: string
  /** Physical receptacle (cage) type the catalog declares for this port. */
  cage?: PortConnector
  poe?: boolean
  source?: 'catalog'
}

const ROLE_KEYS = ['downlink', 'uplink', 'wan', 'lan', 'management'] as const

export function expandCatalogPorts(entry: CatalogEntry | undefined): CatalogPortTemplate[] {
  if (!entry || entry.spec.kind !== 'hardware') return []
  const ports = (entry.properties as HardwareProperties).ports
  if (!ports) return []

  const groups: PortGroup[] = []
  if (ports.groups) groups.push(...ports.groups)
  for (const role of ROLE_KEYS) {
    for (const group of ports[role] ?? []) {
      groups.push({ ...group, role: group.role ?? role })
    }
  }

  const result: CatalogPortTemplate[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    const names = expandGroupNames(group)
    for (const [index, name] of names.entries()) {
      if (seen.has(name)) continue
      seen.add(name)
      const faceplateLabel =
        expandTemplate(group.faceplate_label_pattern, group, index, name) ??
        group.faceplate_labels?.[index]
      result.push({
        label: name,
        faceplateLabel,
        interfaceName:
          expandTemplate(group.interface_name_pattern, group, index, name) ??
          group.interface_names?.[index],
        aliases: group.aliases?.[index],
        role: group.role,
        speed: group.speed,
        cage: group.cage,
        poe: group.poe,
        source: 'catalog',
      })
    }
  }
  return result
}

function expandGroupNames(group: PortGroup): string[] {
  if (group.names?.length) return group.names
  const count = group.count ?? 0
  if (count <= 0) return []

  const pattern = group.namePattern ?? group.name_pattern ?? defaultPattern(group.role)
  const names: string[] = []
  for (let i = 1; i <= count; i++) {
    names.push(
      pattern
        .replaceAll('{n}', String(i))
        .replaceAll('{n0}', String(i - 1))
        .replaceAll('{role}', String(group.role ?? 'port')),
    )
  }
  return names
}

function expandTemplate(
  pattern: string | undefined,
  group: PortGroup,
  index: number,
  name: string,
): string | undefined {
  if (!pattern) return undefined
  const n = index + 1
  return pattern
    .replaceAll('{n}', String(n))
    .replaceAll('{n0}', String(index))
    .replaceAll('{role}', String(group.role ?? 'port'))
    .replaceAll('{name}', name)
}

function defaultPattern(role: PortGroup['role']): string {
  if (role === 'uplink') return 'uplink{n}'
  if (role === 'management') return 'mgmt{n}'
  if (role === 'wan') return 'wan{n}'
  if (role === 'lan') return 'lan{n}'
  return '{n}'
}
