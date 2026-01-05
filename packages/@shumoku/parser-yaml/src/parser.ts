/**
 * YAML parser implementation for shumoku
 */

import yaml from 'js-yaml'
import {
  BaseParser,
  type ParseOptions,
  type ParseResult,
  type ParseWarning,
  type ValidationResult,
} from '@shumoku/core/parser'
import {
  type NetworkGraph,
  type Device,
  type Port,
  type Link,
  type Module,
  DeviceType,
  LinkType,
  PortType,
} from '@shumoku/core/models'

interface YamlNetwork {
  network?: {
    name?: string
    description?: string
    version?: string
    settings?: Record<string, unknown>
    modules?: YamlModule[]
    devices?: YamlDevice[]
    links?: YamlLinkInput[]
    connections?: YamlLinkInput[] // Alternative name for links
    definitions?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }
  // Support top-level properties too
  name?: string
  description?: string
  version?: string
  settings?: Record<string, unknown>
  devices?: YamlDevice[]
  links?: YamlLinkInput[]
  connections?: YamlLinkInput[]
  modules?: YamlModule[]
  definitions?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

interface YamlDevice {
  id: string
  name: string
  type?: string
  role?: string
  position?: {
    x?: number | 'auto'
    y?: number | 'auto'
  }
  interfaces?: YamlPort[]
  metadata?: Record<string, unknown>
}

interface YamlPort {
  name: string
  type?: string
  speed?: string
  vlan?: number | number[]
  vlans?: number[]
  mode?: 'access' | 'trunk'
}

interface YamlLink {
  id?: string
  from?: string
  source?: string
  to?: string
  target?: string
  type?: string
  bandwidth?: string
  style?: Record<string, unknown>
}

// Support array format: [source, target, bandwidth?]
type YamlLinkArray = [string, string, string?]

type YamlLinkInput = YamlLink | YamlLinkArray

interface YamlModule {
  id?: string
  name: string
  devices?: string[]
  layout?: {
    column?: number
    row?: number
    span?: { columns?: number; rows?: number }
  }
  style?: Record<string, unknown>
}

export class YamlParser extends BaseParser {
  name = 'yaml'
  version = '1.0.0'
  formats = ['yaml', 'yml']

  parse(input: string, options?: ParseOptions): ParseResult {
    const startTime = performance.now()
    const warnings: ParseWarning[] = []

    try {
      // Parse YAML
      const data = yaml.load(input) as YamlNetwork

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid YAML: expected object')
      }

      // Extract network data (support both nested and flat structure)
      const network = data.network || data

      // Convert to NetworkGraph
      const graph: NetworkGraph = {
        version: network.version || '1.0.0',
        name: network.name,
        description: network.description,
        devices: [],
        ports: [],
        links: [],
        modules: network.modules ? this.parseModules(network.modules, warnings) : undefined,
        settings: this.parseSettings(network.settings),
        definitions: network.definitions,
        metadata: network.metadata,
      }

      // Parse devices and ports
      if (network.devices) {
        const { devices, ports } = this.parseDevices(network.devices, warnings)
        graph.devices = devices
        graph.ports = ports
      }

      // Parse links
      const links = network.links || network.connections || []
      if (links && links.length > 0) {
        graph.links = this.parseLinks(links, graph.devices, warnings)
      }

      // Apply defaults
      const processedGraph = this.applyDefaults(graph, options)

      // Validate
      const validationWarnings = this.validateGraph(processedGraph, options)
      warnings.push(...validationWarnings)

      const duration = performance.now() - startTime

      return {
        graph: processedGraph,
        warnings: warnings.length > 0 ? warnings : undefined,
        stats: {
          parseTimeMs: duration,
          deviceCount: processedGraph.devices.length,
          linkCount: processedGraph.links.length,
          moduleCount: processedGraph.modules?.length || 0,
        },
      }
    } catch (error) {
      warnings.push({
        code: 'PARSE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown parse error',
        severity: 'error',
      })

      // Return empty graph on error
      return {
        graph: {
          version: '1.0.0',
          devices: [],
          ports: [],
          links: [],
        },
        warnings,
      }
    }
  }

  validate(input: string): ValidationResult {
    try {
      const data = yaml.load(input)

      if (!data || typeof data !== 'object') {
        return {
          valid: false,
          errors: [
            {
              code: 'INVALID_YAML',
              message: 'Invalid YAML: expected object',
              severity: 'error',
            },
          ],
        }
      }

      // Basic structure validation
      const warnings: ParseWarning[] = []
      const network = (data as YamlNetwork).network || (data as YamlNetwork)

      if (!network.devices || !Array.isArray(network.devices)) {
        warnings.push({
          code: 'NO_DEVICES',
          message: 'No devices defined',
          severity: 'warning',
        })
      }

      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            code: 'YAML_SYNTAX_ERROR',
            message: error instanceof Error ? error.message : 'YAML syntax error',
            severity: 'error',
          },
        ],
      }
    }
  }

  supports(input: string): boolean {
    // Simple check for YAML-like content
    return (
      input.includes(':') &&
      (input.includes('devices:') || input.includes('network:') || input.includes('name:'))
    )
  }

  private parseDevices(
    yamlDevices: YamlDevice[],
    warnings: ParseWarning[],
  ): { devices: Device[]; ports: Port[] } {
    const devices: Device[] = []
    const ports: Port[] = []

    yamlDevices.forEach((yamlDevice, index) => {
      // Ensure ID
      const deviceId = yamlDevice.id || yamlDevice.name || this.generateId('device', index)

      // Parse device type
      const deviceType = this.parseDeviceType(yamlDevice.type, warnings)

      const device: Device = {
        id: deviceId,
        name: yamlDevice.name || deviceId,
        type: deviceType,
        role: yamlDevice.role as Device['role'],
        position: yamlDevice.position && {
          x: yamlDevice.position.x ?? 'auto',
          y: yamlDevice.position.y ?? 'auto',
        },
        metadata: yamlDevice.metadata,
      }

      devices.push(device)

      // Parse interfaces/ports
      if (yamlDevice.interfaces) {
        yamlDevice.interfaces.forEach((yamlPort) => {
          const port: Port = {
            id: `${deviceId}:${yamlPort.name}`,
            deviceId: deviceId,
            name: yamlPort.name,
            type: this.parsePortType(yamlPort.type),
            speed: yamlPort.speed,
            vlan: this.parseVlanConfig(yamlPort),
          }

          ports.push(port)
        })
      }
    })

    return { devices, ports }
  }

  private parseLinks(
    yamlLinks: YamlLinkInput[],
    devices: Device[],
    warnings: ParseWarning[],
  ): Link[] {
    // const deviceMap = new Map(devices.map((d) => [d.id, d]))
    const links: Link[] = []

    yamlLinks.forEach((yamlLink, index) => {
      let linkData: YamlLink

      // Handle array format [source, target, bandwidth?]
      if (Array.isArray(yamlLink)) {
        linkData = {
          from: yamlLink[0],
          to: yamlLink[1],
          bandwidth: yamlLink[2],
        }
      } else {
        linkData = yamlLink
      }

      const linkId = linkData.id || this.generateId('link', index)

      // Parse endpoints (support both from/to and source/target)
      const sourceId = linkData.from || linkData.source
      const targetId = linkData.to || linkData.target

      if (!sourceId || !targetId) {
        warnings.push({
          code: 'INVALID_LINK',
          message: `Link ${linkId} missing source or target`,
          severity: 'error',
        })
        return
      }

      // Extract device and port from notation like "device:port"
      const source = this.parseEndpoint(sourceId)
      const target = this.parseEndpoint(targetId)

      const link: Link = {
        id: linkId,
        source: {
          deviceId: source.deviceId,
          portId: source.portId,
        },
        target: {
          deviceId: target.deviceId,
          portId: target.portId,
        },
        type: this.parseLinkType(linkData.type),
        bandwidth: linkData.bandwidth,
        style: linkData.style,
      }

      links.push(link)
    })

    return links
  }

  private parseModules(yamlModules: YamlModule[], warnings: ParseWarning[]): Module[] {
    return yamlModules.map((yamlModule, index) => {
      const moduleId = yamlModule.id || yamlModule.name || this.generateId('module', index)

      return {
        id: moduleId,
        name: yamlModule.name,
        devices: yamlModule.devices || [],
        layout: yamlModule.layout,
        style: yamlModule.style,
      }
    })
  }

  private parseSettings(settings?: Record<string, unknown>): NetworkGraph['settings'] {
    if (!settings) return undefined

    return {
      layout: settings.layout as NetworkGraph['settings']['layout'],
      theme: settings.theme as NetworkGraph['settings']['theme'],
      animation: settings.animation as NetworkGraph['settings']['animation'],
      interaction: settings.interaction as NetworkGraph['settings']['interaction'],
      performance: settings.performance as NetworkGraph['settings']['performance'],
      grid: settings.grid as NetworkGraph['settings']['grid'],
    }
  }

  private parseDeviceType(type?: string, warnings?: ParseWarning[]): DeviceType {
    if (!type) return DeviceType.Unknown

    const typeMap: Record<string, DeviceType> = {
      router: DeviceType.Router,
      'l3-switch': DeviceType.L3Switch,
      l3switch: DeviceType.L3Switch,
      'l2-switch': DeviceType.L2Switch,
      l2switch: DeviceType.L2Switch,
      switch: DeviceType.L2Switch,
      firewall: DeviceType.Firewall,
      fw: DeviceType.Firewall,
      'load-balancer': DeviceType.LoadBalancer,
      lb: DeviceType.LoadBalancer,
      server: DeviceType.Server,
      ap: DeviceType.AccessPoint,
      'access-point': DeviceType.AccessPoint,
      vm: DeviceType.VirtualMachine,
      container: DeviceType.Container,
      cloud: DeviceType.Cloud,
      internet: DeviceType.Internet,
    }

    const normalized = type.toLowerCase()
    return typeMap[normalized] || DeviceType.Unknown
  }

  private parsePortType(type?: string): PortType {
    if (!type) return PortType.Ethernet

    const typeMap: Record<string, PortType> = {
      ethernet: PortType.Ethernet,
      eth: PortType.Ethernet,
      fiber: PortType.Fiber,
      sfp: PortType.Fiber,
      virtual: PortType.Virtual,
      vlan: PortType.Virtual,
      tunnel: PortType.Tunnel,
      vpn: PortType.Tunnel,
      wireless: PortType.Wireless,
      wifi: PortType.Wireless,
      management: PortType.Management,
      mgmt: PortType.Management,
    }

    const normalized = type.toLowerCase()
    return typeMap[normalized] || PortType.Ethernet
  }

  private parseLinkType(type?: string): LinkType {
    if (!type) return LinkType.Physical

    const typeMap: Record<string, LinkType> = {
      physical: LinkType.Physical,
      logical: LinkType.Logical,
      vlan: LinkType.Logical,
      tunnel: LinkType.Tunnel,
      vpn: LinkType.Tunnel,
      ipsec: LinkType.Tunnel,
      wireless: LinkType.Wireless,
      wifi: LinkType.Wireless,
      virtual: LinkType.Virtual,
    }

    const normalized = type.toLowerCase()
    return typeMap[normalized] || LinkType.Physical
  }

  private parseVlanConfig(yamlPort: YamlPort): Port['vlan'] {
    const vlans = yamlPort.vlans || (yamlPort.vlan ? [yamlPort.vlan].flat() : undefined)

    if (!vlans) return undefined

    return {
      mode: (yamlPort.mode as PortMode) || (vlans.length > 1 ? PortMode.Trunk : PortMode.Access),
      access: vlans.length === 1 ? vlans[0] : undefined,
      trunk: vlans.length > 1 ? vlans : undefined,
    }
  }

  private parseEndpoint(endpoint: string): { deviceId: string; portId?: string } {
    const parts = endpoint.split(':')
    return {
      deviceId: parts[0],
      portId: parts[1],
    }
  }
}
