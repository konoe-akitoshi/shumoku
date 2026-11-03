// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * A small network with random parents, written the same way for one seed: every node hangs from
 * one to four earlier nodes (or `top`), and sometimes a virtual line joins `top` to a node.
 * For tests that want shapes nobody drew by hand.
 */
export function randomYaml(seed: number): string {
  let state = seed
  const next = (n: number) => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state % n
  }
  const count = 8 + next(10)
  const links: string[] = []
  for (let i = 0; i < count; i++) {
    const parents = new Set<number>()
    for (let j = 0; j <= next(4); j++) parents.add(next(i + 1))
    for (const p of parents) {
      const from = p === 0 ? 'top' : `n${p - 1}`
      links.push(`  - { endpoints: [{ node: ${from} }, { node: n${i} }] }`)
    }
  }
  if (next(2) === 0) {
    links.push(`  - { endpoints: [{ node: top }, { node: n${next(count)} }], virtual: true }`)
  }
  const nodes = ['top', ...Array.from({ length: count }, (_, i) => `n${i}`)]
  return `nodes:\n${nodes.map((id) => `  - { id: ${id} }`).join('\n')}\nlinks:\n${links.join('\n')}\n`
}
