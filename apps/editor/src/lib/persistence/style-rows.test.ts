import type { Link, Subgraph } from '@shumoku/core'
import { expect, test } from 'vitest'
import { decodeLinkRow, decodeSubgraphRow, encodeLinkRow, encodeSubgraphRow } from './style-rows'

test('a link row is all facts, and a group padding change leaves the structural row identical', () => {
  const link: Link = { id: 'l', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth1' } }
  const group: Subgraph = {
    id: 'g',
    label: 'Group',
    parent: 'root',
    style: { padding: 0 },
  }
  const linkRow = encodeLinkRow('p', 'l', link)
  const groupRow = encodeSubgraphRow('p', 'g', group)
  expect(linkRow).not.toHaveProperty('presentation')
  expect(decodeLinkRow(JSON.parse(JSON.stringify(linkRow)))).toEqual(link)
  expect(decodeSubgraphRow(JSON.parse(JSON.stringify(groupRow)))).toEqual(group)
  expect(encodeSubgraphRow('p', 'g', { ...group, style: {} }).data).toEqual(groupRow.data)
  expect(encodeSubgraphRow('p', 'g', { ...group, style: undefined })).not.toHaveProperty(
    'presentation',
  )
})

test('an older link row’s style is read and dropped', () => {
  const link: Link = { id: 'l', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth1' } }
  const row = {
    ...encodeLinkRow('p', 'l', link),
    presentation: { linkId: 'l', style: { stroke: 'red' } },
  }
  expect(decodeLinkRow(row)).toEqual(link)
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
