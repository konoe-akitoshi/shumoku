// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a port's name is shown as. The stored name (the port's identity) is never touched; only
 * the text drawn in its chip is shortened, to what the device's own CLI prints in its brief
 * listings, so a network engineer reads it without a dictionary.
 */

/**
 * Full spelling (lower case) to the abbreviation. Matched at the start of a name and only when a
 * digit follows. The longer spelling is listed first where one begins with another.
 */
const ABBREVIATIONS: readonly (readonly [string, string])[] = [
  ['hundredgigabitethernet', 'Hu'],
  ['hundredgige', 'Hu'],
  ['fortygigabitethernet', 'Fo'],
  ['twentyfivegige', 'Twe'],
  ['twenty-fivegige', 'WGE'],
  ['ten-gigabitethernet', 'XGE'],
  ['tengigabitethernet', 'Te'],
  ['twogigabitethernet', 'Tw'],
  ['fivegigabitethernet', 'Fi'],
  ['m-gigabitethernet', 'MGE'],
  ['gigabitethernet', 'Gi'],
  ['fastethernet', 'Fa'],
  ['fortygige', 'FGE'],
  ['ethernet', 'Et'],
  ['management', 'Ma'],
  ['port-channel', 'Po'],
  ['bundle-ether', 'BE'],
  ['loopback', 'Lo'],
  ['vlan', 'Vl'],
  ['tunnel', 'Tu'],
]

/** A name this short is already as short as it reads; it is left as written. */
const SHORT = 8

/**
 * The abbreviated name for one port, with no other port in sight. The filler word `Interface `
 * is dropped. A name is abbreviated only if it is longer than a short name, a known spelling
 * starts it, a digit follows, and the abbreviation is shorter.
 */
export function displayPortName(full: string): string {
  const name = full.trim().replace(/^interface\s+/i, '')
  if (name.length <= SHORT) return name
  const lower = name.toLowerCase()
  for (const [long, short] of ABBREVIATIONS) {
    if (!lower.startsWith(long)) continue
    const next = name.charAt(long.length)
    if (next < '0' || next > '9') continue
    return short.length < long.length ? short + name.slice(long.length) : name
  }
  return name
}

/**
 * The displayed names of the ports of one box, by stored name. Different names that would show
 * alike (`Ethernet1` and `Et1`) all go back to their written form, so what is shown is
 * unambiguous within the box.
 */
export function displayPortNames(names: readonly string[]): Map<string, string> {
  const shown = new Map<string, string>()
  for (const name of names) {
    if (!shown.has(name)) shown.set(name, displayPortName(name))
  }
  const owners = new Map<string, string[]>()
  for (const [name, text] of shown) owners.set(text, [...(owners.get(text) ?? []), name])
  const out = new Map(shown)
  for (const group of owners.values()) {
    if (group.length < 2) continue
    for (const name of group) out.set(name, name.trim())
  }
  return out
}

/** A name is cut after a separator, or between letters and digits. */
const SEPARATOR = /[/.\-: ]/
const isLetter = (c: string) => c.toLowerCase() !== c.toUpperCase()
const isDigit = (c: string) => c >= '0' && c <= '9'

/** Whether every name can be cut at `at`, so that what follows the cut starts a new token. */
function cutsAt(names: readonly string[], at: number): boolean {
  return names.every((name) => {
    const before = name.charAt(at - 1)
    const after = name.charAt(at)
    return SEPARATOR.test(before) || (isLetter(before) && isDigit(after))
  })
}

/** The fewest ports that share a start worth writing once. */
const MIN_PORTS = 3
/** The shortest start worth writing once. */
const MIN_PREFIX = 2

/**
 * The start shared by the shown names of the ports on one edge, cut at a token boundary: after a
 * separator (`/ . - : space`) or where letters turn to digits. `Et1/1, Et1/2, Et2/1` share `Et`,
 * not `Et1/`. Empty when there is nothing worth taking out: fewer than three names, a start of
 * one character, a name that would be left with nothing, or names that start differently. Empty
 * names (ports without one) are not counted.
 */
export function commonPrefix(texts: readonly string[]): string {
  const names = texts.filter((t) => t !== '')
  const [head] = names
  if (names.length < MIN_PORTS || head === undefined) return ''
  let end = head.length
  for (const name of names) {
    let i = 0
    while (i < end && i < name.length && name.charAt(i) === head.charAt(i)) i++
    end = i
  }
  for (let at = end; at >= MIN_PREFIX; at--) {
    if (!cutsAt(names, at)) continue
    return names.some((n) => n.length <= at) ? '' : head.slice(0, at)
  }
  return ''
}
