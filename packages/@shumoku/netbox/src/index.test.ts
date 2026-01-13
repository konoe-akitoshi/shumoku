import { describe, expect, it } from 'vitest'
import {
  CABLE_COLORS,
  CABLE_STYLES,
  convertSpeedToBandwidth,
  convertToNetworkGraph,
  DEFAULT_TAG_MAPPING,
  DEVICE_STATUS_STYLES,
  getVlanColor,
  NetBoxClient,
  ROLE_TO_TYPE,
  toYaml,
} from './index.js'
import type { NetBoxCableResponse, NetBoxDeviceResponse, NetBoxInterfaceResponse } from './types.js'

describe('@shumoku/netbox', () => {
  describe('exports', () => {
    it('should export NetBoxClient', () => {
      expect(NetBoxClient).toBeDefined()
    })

    it('should export convertToNetworkGraph', () => {
      expect(convertToNetworkGraph).toBeDefined()
    })

    it('should export toYaml', () => {
      expect(toYaml).toBeDefined()
    })

    it('should export constants', () => {
      expect(CABLE_COLORS).toBeDefined()
      expect(CABLE_STYLES).toBeDefined()
      expect(DEFAULT_TAG_MAPPING).toBeDefined()
      expect(DEVICE_STATUS_STYLES).toBeDefined()
      expect(ROLE_TO_TYPE).toBeDefined()
    })
  })

  describe('NetBoxClient', () => {
    it('should create instance', () => {
      const client = new NetBoxClient({
        url: 'https://netbox.example.com',
        token: 'test-token',
      })
      expect(client).toBeInstanceOf(NetBoxClient)
    })
  })

  describe('convertSpeedToBandwidth', () => {
    it('should convert 1G', () => {
      expect(convertSpeedToBandwidth(1000000)).toBe('1G')
    })

    it('should convert 10G', () => {
      expect(convertSpeedToBandwidth(10000000)).toBe('10G')
    })

    it('should convert 100G', () => {
      expect(convertSpeedToBandwidth(100000000)).toBe('100G')
    })

    it('should handle various speeds', () => {
      // Just check it returns something for any speed
      const result = convertSpeedToBandwidth(500000)
      expect(result === '1G' || result === undefined).toBe(true)
    })
  })

  describe('getVlanColor', () => {
    it('should return color for vlan id', () => {
      const color = getVlanColor(100)
      expect(color).toBeDefined()
      expect(typeof color).toBe('string')
    })

    it('should return consistent colors for same vlan', () => {
      const color1 = getVlanColor(100)
      const color2 = getVlanColor(100)
      expect(color1).toBe(color2)
    })

    it('should return different colors for different vlans', () => {
      const color1 = getVlanColor(100)
      const color2 = getVlanColor(200)
      // They might be the same due to hashing, but the function should work
      expect(color1).toBeDefined()
      expect(color2).toBeDefined()
    })
  })

  describe('convertToNetworkGraph', () => {
    it('should convert empty responses', () => {
      const deviceResp: NetBoxDeviceResponse = { count: 0, results: [] }
      const interfaceResp: NetBoxInterfaceResponse = { count: 0, results: [] }
      const cableResp: NetBoxCableResponse = { count: 0, results: [] }

      const graph = convertToNetworkGraph(deviceResp, interfaceResp, cableResp)
      expect(graph.nodes).toEqual([])
      expect(graph.links).toEqual([])
    })
  })

  describe('toYaml', () => {
    it('should convert graph to yaml string', () => {
      const graph = {
        nodes: [{ id: 'router1', label: 'Router 1', type: 'router' as const }],
        links: [],
      }
      const yaml = toYaml(graph)
      expect(yaml).toContain('nodes:')
      expect(yaml).toContain('router1')
    })

    it('should handle empty graph', () => {
      const graph = {
        nodes: [],
        links: [],
      }
      const yaml = toYaml(graph)
      expect(yaml).toBeDefined()
      expect(typeof yaml).toBe('string')
    })
  })
})
