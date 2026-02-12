/**
 * Converter Tests
 * Tests that NetBox data converts to valid NetworkGraph compatible with renderer
 */

import { buildHierarchicalSheets } from '@shumoku/core'
import { HierarchicalLayout } from '@shumoku/core/layout'
import { describe, expect, it } from 'vitest'
import { convertToNetworkGraph } from './converter.js'
import type { NetBoxCableResponse, NetBoxDeviceResponse, NetBoxInterfaceResponse } from './types.js'

// ============================================
// Test Fixtures - Realistic NetBox API Responses
// ============================================

/**
 * Two sites with devices that have cross-site connections
 * This is the key scenario where hierarchical navigation should work
 */
const fixtures = {
  devices: {
    count: 4,
    next: null,
    previous: null,
    results: [
      // Site A - Core
      {
        name: 'core-rtr-01',
        tags: [{ slug: 'core', name: 'Core' }],
        device_type: { model: 'ASR-1001-X', manufacturer: { name: 'Cisco', slug: 'cisco' } },
        status: { value: 'active' as const, label: 'Active' },
        role: { name: 'Router', slug: 'router' },
        site: { id: 1, name: 'Site-A', slug: 'site-a' },
        location: { id: 1, name: 'DC1-Room1', slug: 'dc1-room1' },
      },
      {
        name: 'core-sw-01',
        tags: [{ slug: 'core', name: 'Core' }],
        device_type: { model: 'Nexus 9000', manufacturer: { name: 'Cisco', slug: 'cisco' } },
        status: { value: 'active' as const, label: 'Active' },
        role: { name: 'Core Switch', slug: 'core-switch' },
        site: { id: 1, name: 'Site-A', slug: 'site-a' },
        location: { id: 1, name: 'DC1-Room1', slug: 'dc1-room1' },
      },
      // Site B - Distribution
      {
        name: 'dist-rtr-01',
        tags: [{ slug: 'distribution', name: 'Distribution' }],
        device_type: { model: 'ASR-1001-X', manufacturer: { name: 'Cisco', slug: 'cisco' } },
        status: { value: 'active' as const, label: 'Active' },
        role: { name: 'Router', slug: 'router' },
        site: { id: 2, name: 'Site-B', slug: 'site-b' },
        location: { id: 2, name: 'DC2-Room1', slug: 'dc2-room1' },
      },
      {
        name: 'dist-sw-01',
        tags: [{ slug: 'distribution', name: 'Distribution' }],
        device_type: { model: 'Catalyst 9300', manufacturer: { name: 'Cisco', slug: 'cisco' } },
        status: { value: 'active' as const, label: 'Active' },
        role: { name: 'Switch', slug: 'l2-switch' },
        site: { id: 2, name: 'Site-B', slug: 'site-b' },
        location: { id: 2, name: 'DC2-Room1', slug: 'dc2-room1' },
      },
    ],
  } satisfies NetBoxDeviceResponse,

  interfaces: {
    count: 8,
    next: null,
    previous: null,
    results: [
      // Core router interfaces
      {
        id: 1,
        name: 'GigabitEthernet0/0/0',
        device: { id: 1, name: 'core-rtr-01' },
        enabled: true,
        speed: 1000000,
        untagged_vlan: null,
        tagged_vlans: [],
      },
      {
        id: 2,
        name: 'GigabitEthernet0/0/1',
        device: { id: 1, name: 'core-rtr-01' },
        enabled: true,
        speed: 1000000,
        untagged_vlan: null,
        tagged_vlans: [],
      },
      // Core switch interfaces
      {
        id: 3,
        name: 'Ethernet1/1',
        device: { id: 2, name: 'core-sw-01' },
        enabled: true,
        speed: 10000000,
        untagged_vlan: null,
        tagged_vlans: [],
      },
      {
        id: 4,
        name: 'Ethernet1/2',
        device: { id: 2, name: 'core-sw-01' },
        enabled: true,
        speed: 10000000,
        untagged_vlan: null,
        tagged_vlans: [],
      },
      // Dist router interfaces
      {
        id: 5,
        name: 'GigabitEthernet0/0/0',
        device: { id: 3, name: 'dist-rtr-01' },
        enabled: true,
        speed: 1000000,
        untagged_vlan: null,
        tagged_vlans: [],
      },
      {
        id: 6,
        name: 'GigabitEthernet0/0/1',
        device: { id: 3, name: 'dist-rtr-01' },
        enabled: true,
        speed: 1000000,
        untagged_vlan: null,
        tagged_vlans: [],
      },
      // Dist switch interfaces
      {
        id: 7,
        name: 'GigabitEthernet1/0/1',
        device: { id: 4, name: 'dist-sw-01' },
        enabled: true,
        speed: 1000000,
        untagged_vlan: null,
        tagged_vlans: [],
      },
      {
        id: 8,
        name: 'GigabitEthernet1/0/2',
        device: { id: 4, name: 'dist-sw-01' },
        enabled: true,
        speed: 1000000,
        untagged_vlan: null,
        tagged_vlans: [],
      },
    ],
  } satisfies NetBoxInterfaceResponse,

  cables: {
    count: 3,
    next: null,
    previous: null,
    results: [
      // Internal link: core-rtr-01 <-> core-sw-01 (within Site A)
      {
        id: 1,
        type: 'cat6a',
        a_terminations: [
          { object: { name: 'GigabitEthernet0/0/0', device: { name: 'core-rtr-01' } } },
        ],
        b_terminations: [{ object: { name: 'Ethernet1/1', device: { name: 'core-sw-01' } } }],
        status: { value: 'connected', label: 'Connected' },
      },
      // Cross-site link: core-rtr-01 <-> dist-rtr-01 (Site A to Site B) ★重要
      {
        id: 2,
        type: 'smf',
        a_terminations: [
          { object: { name: 'GigabitEthernet0/0/1', device: { name: 'core-rtr-01' } } },
        ],
        b_terminations: [
          { object: { name: 'GigabitEthernet0/0/0', device: { name: 'dist-rtr-01' } } },
        ],
        status: { value: 'connected', label: 'Connected' },
      },
      // Internal link: dist-rtr-01 <-> dist-sw-01 (within Site B)
      {
        id: 3,
        type: 'cat6a',
        a_terminations: [
          { object: { name: 'GigabitEthernet0/0/1', device: { name: 'dist-rtr-01' } } },
        ],
        b_terminations: [
          { object: { name: 'GigabitEthernet1/0/1', device: { name: 'dist-sw-01' } } },
        ],
        status: { value: 'connected', label: 'Connected' },
      },
    ],
  } satisfies NetBoxCableResponse,
}

// ============================================
// Basic Conversion Tests
// ============================================

describe('convertToNetworkGraph', () => {
  describe('nodes', () => {
    it('should create nodes from devices', () => {
      const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables)

      expect(graph.nodes).toHaveLength(4)
      expect(graph.nodes.map((n) => n.id)).toEqual([
        'core-rtr-01',
        'core-sw-01',
        'dist-rtr-01',
        'dist-sw-01',
      ])
    })

    it('should set device types from roles', () => {
      const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables)

      const router = graph.nodes.find((n) => n.id === 'core-rtr-01')
      expect(router?.type).toBe('router')

      const l3Switch = graph.nodes.find((n) => n.id === 'core-sw-01')
      expect(l3Switch?.type).toBe('l3-switch')
    })
  })

  describe('links', () => {
    it('should create links from cables', () => {
      const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables)

      expect(graph.links).toHaveLength(3)
    })

    it('should set port names on links', () => {
      const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
        showPorts: true,
      })

      const link = graph.links[0]
      expect(typeof link.from).toBe('object')
      if (typeof link.from === 'object') {
        expect(link.from.port).toBeDefined()
      }
    })
  })

  describe('subgraphs (groupBy)', () => {
    it('should create subgraphs when groupBy is set', () => {
      const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
        groupBy: 'tag',
      })

      expect(graph.subgraphs).toBeDefined()
      expect(graph.subgraphs!.length).toBeGreaterThan(0)
    })

    it('should group by tag', () => {
      const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
        groupBy: 'tag',
      })

      const subgraphIds = graph.subgraphs?.map((s) => s.id) ?? []
      expect(subgraphIds).toContain('core')
      expect(subgraphIds).toContain('distribution')
    })

    it('should group by site', () => {
      const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
        groupBy: 'site',
      })

      const subgraphIds = graph.subgraphs?.map((s) => s.id) ?? []
      expect(subgraphIds).toContain('site-a')
      expect(subgraphIds).toContain('site-b')
    })

    it('should set parent on nodes when grouped', () => {
      const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
        groupBy: 'tag',
      })

      const coreRouter = graph.nodes.find((n) => n.id === 'core-rtr-01')
      expect(coreRouter?.parent).toBe('core')

      const distRouter = graph.nodes.find((n) => n.id === 'dist-rtr-01')
      expect(distRouter?.parent).toBe('distribution')
    })
  })
})

// ============================================
// Hierarchical Sheet Tests (Critical for HTML rendering)
// ============================================

describe('buildHierarchicalSheets integration', () => {
  it('should generate sheets for each subgraph', async () => {
    const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
      groupBy: 'tag',
    })

    const layout = new HierarchicalLayout()
    const rootLayout = await layout.layoutAsync(graph)
    const sheets = await buildHierarchicalSheets(graph, rootLayout, layout)

    // Should have root + 2 subgraphs (core, distribution)
    expect(sheets.size).toBeGreaterThanOrEqual(3)
    expect(sheets.has('root')).toBe(true)
    expect(sheets.has('core')).toBe(true)
    expect(sheets.has('distribution')).toBe(true)
  })

  it('should add export connectors for cross-subgraph links', async () => {
    const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
      groupBy: 'tag',
    })

    const layout = new HierarchicalLayout()
    const rootLayout = await layout.layoutAsync(graph)
    const sheets = await buildHierarchicalSheets(graph, rootLayout, layout)

    // Check "core" sheet has export connector to "distribution"
    const coreSheet = sheets.get('core')
    expect(coreSheet).toBeDefined()

    const exportNodes = coreSheet!.graph.nodes.filter((n) => n.id.startsWith('__export_'))
    expect(exportNodes.length).toBeGreaterThan(0)

    // Export node should reference the other subgraph
    const exportNode = exportNodes[0]
    expect(exportNode.label).toBe('distribution') // subgraph label (from tag slug)
    expect(exportNode.shape).toBe('stadium')

    // Check export links exist
    const exportLinks = coreSheet!.graph.links.filter((l) => l.id?.startsWith('__export_link_'))
    expect(exportLinks.length).toBeGreaterThan(0)
    expect(exportLinks[0].type).toBe('dashed')
    expect(exportLinks[0].arrow).toBe('forward')
  })

  it('should mark subgraphs as clickable (file attribute)', async () => {
    const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
      groupBy: 'tag',
    })

    const layout = new HierarchicalLayout()
    const rootLayout = await layout.layoutAsync(graph)
    await buildHierarchicalSheets(graph, rootLayout, layout)

    // After buildHierarchicalSheets, subgraphs should have file set
    for (const sg of graph.subgraphs ?? []) {
      expect(sg.file).toBe(sg.id)
    }
  })

  it('child sheets should contain only their own nodes', async () => {
    const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
      groupBy: 'tag',
    })

    const layout = new HierarchicalLayout()
    const rootLayout = await layout.layoutAsync(graph)
    const sheets = await buildHierarchicalSheets(graph, rootLayout, layout)

    const coreSheet = sheets.get('core')
    const distSheet = sheets.get('distribution')

    // Core sheet should have core devices + export connectors
    const coreDeviceIds = coreSheet!.graph.nodes
      .filter((n) => !n.id.startsWith('__export_'))
      .map((n) => n.id)
    expect(coreDeviceIds).toContain('core-rtr-01')
    expect(coreDeviceIds).toContain('core-sw-01')
    expect(coreDeviceIds).not.toContain('dist-rtr-01')

    // Distribution sheet should have dist devices + export connectors
    const distDeviceIds = distSheet!.graph.nodes
      .filter((n) => !n.id.startsWith('__export_'))
      .map((n) => n.id)
    expect(distDeviceIds).toContain('dist-rtr-01')
    expect(distDeviceIds).toContain('dist-sw-01')
    expect(distDeviceIds).not.toContain('core-rtr-01')
  })

  it('child sheets should have internal links only (plus export links)', async () => {
    const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
      groupBy: 'tag',
    })

    const layout = new HierarchicalLayout()
    const rootLayout = await layout.layoutAsync(graph)
    const sheets = await buildHierarchicalSheets(graph, rootLayout, layout)

    const coreSheet = sheets.get('core')

    // Internal links (not export links)
    const internalLinks = coreSheet!.graph.links.filter((l) => !l.id?.startsWith('__export_link_'))

    // Should have the core-rtr-01 <-> core-sw-01 link
    expect(internalLinks.length).toBe(1)

    // Export links
    const exportLinks = coreSheet!.graph.links.filter((l) => l.id?.startsWith('__export_link_'))
    // Should have export link for cross-site connection
    expect(exportLinks.length).toBe(1)
  })
})

// ============================================
// Edge Cases
// ============================================

describe('edge cases', () => {
  it('should handle empty responses', () => {
    const graph = convertToNetworkGraph(
      { count: 0, next: null, previous: null, results: [] },
      { count: 0, next: null, previous: null, results: [] },
      { count: 0, next: null, previous: null, results: [] },
    )

    expect(graph.nodes).toEqual([])
    expect(graph.links).toEqual([])
  })

  it('should only include devices with cables (devices without cables are excluded)', () => {
    // This test documents the converter behavior:
    // Only devices that appear in cable terminations are included in the output.
    // Devices without cables are not included - this is by design.
    const devicesNoCables: NetBoxDeviceResponse = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          name: 'orphan-device',
          tags: [{ slug: 'core', name: 'Core' }],
          status: { value: 'active', label: 'Active' },
          role: { name: 'Server', slug: 'server' },
        },
      ],
    }

    const graph = convertToNetworkGraph(
      devicesNoCables,
      { count: 0, next: null, previous: null, results: [] },
      { count: 0, next: null, previous: null, results: [] }, // No cables
      { groupBy: 'tag' },
    )

    // Device is NOT included because it has no cables
    expect(graph.nodes).toHaveLength(0)
  })

  it('should assign "other" tag to devices without tags in cables', () => {
    // When a device appears in a cable but has no tags, it gets "other" as primaryTag
    const devicesNoTags: NetBoxDeviceResponse = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          name: 'device-a',
          tags: [], // No tags
          status: { value: 'active', label: 'Active' },
          role: { name: 'Server', slug: 'server' },
        },
        {
          name: 'device-b',
          tags: [{ slug: 'core', name: 'Core' }],
          status: { value: 'active', label: 'Active' },
          role: { name: 'Server', slug: 'server' },
        },
      ],
    }

    const cablesWithNoTagDevice: NetBoxCableResponse = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          type: 'cat6a',
          a_terminations: [{ object: { name: 'eth0', device: { name: 'device-a' } } }],
          b_terminations: [{ object: { name: 'eth0', device: { name: 'device-b' } } }],
        },
      ],
    }

    const graph = convertToNetworkGraph(
      devicesNoTags,
      { count: 0, next: null, previous: null, results: [] },
      cablesWithNoTagDevice,
      { groupBy: 'tag' },
    )

    expect(graph.nodes).toHaveLength(2)
    const deviceA = graph.nodes.find((n) => n.id === 'device-a')
    expect(deviceA?.parent).toBe('other') // Falls back to 'other' tag
  })

  it('should handle groupBy: none', () => {
    const graph = convertToNetworkGraph(fixtures.devices, fixtures.interfaces, fixtures.cables, {
      groupBy: 'none',
    })

    // Should have nodes but no subgraphs
    expect(graph.nodes.length).toBe(4)
    expect(graph.subgraphs).toBeUndefined()
  })
})
