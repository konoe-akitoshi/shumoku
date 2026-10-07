import type { Link, Subgraph } from '@shumoku/core'
import { expect, test } from 'vitest'
import { decodeLinkRow, decodeSubgraphRow, encodeLinkRow, encodeSubgraphRow } from './style-rows'

test('link and group style changes leave structural rows identical and clearing styles removes overrides', () => {
  const link: Link = {
    id: 'l',
    from: { node: 'a', port: 'eth0' },
    to: { node: 'b', port: 'eth1' },
    style: { stroke: 'red' },
  }
  const group: Subgraph = {
    id: 'g',
    label: 'Group',
    parent: 'root',
    style: { fill: 'blue', padding: 0 },
  }
  const linkRow = encodeLinkRow('p', 'l', link)
  const groupRow = encodeSubgraphRow('p', 'g', group)
  expect(decodeLinkRow(JSON.parse(JSON.stringify(linkRow)))).toEqual(link)
  expect(decodeSubgraphRow(JSON.parse(JSON.stringify(groupRow)))).toEqual(group)
  expect(encodeLinkRow('p', 'l', { ...link, style: {} }).data).toEqual(linkRow.data)
  expect(encodeSubgraphRow('p', 'g', { ...group, style: {} }).data).toEqual(groupRow.data)
  expect(encodeLinkRow('p', 'l', { ...link, style: undefined })).not.toHaveProperty('presentation')
  expect(encodeSubgraphRow('p', 'g', { ...group, style: undefined })).not.toHaveProperty(
    'presentation',
  )
})

test('row codecs reject row and presentation target ID mismatches', () => {
  const link: Link = { id: 'l', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth1' } }
  const group: Subgraph = { id: 'g', label: 'Group' }
  expect(() => encodeLinkRow('p', 'wrong', link)).toThrow('Link row ID')
  expect(() => encodeSubgraphRow('p', 'wrong', group)).toThrow('Subgraph row ID')
  expect(() =>
    decodeLinkRow({
      ...encodeLinkRow('p', 'l', link),
      presentation: { linkId: 'wrong', style: {} },
    }),
  ).toThrow('Link presentation ID')
  expect(() =>
    decodeSubgraphRow({
      ...encodeSubgraphRow('p', 'g', group),
      presentation: { subgraphId: 'wrong', style: {} },
    }),
  ).toThrow('Subgraph presentation ID')
})
