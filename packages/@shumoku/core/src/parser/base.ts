/**
 * Base parser implementation
 */

import type { 
  Parser, 
  ParseOptions, 
  ParseResult, 
  ParseWarning,
  ValidationResult 
} from './types'
import type { NetworkGraph } from '../models'
import { DeviceType, LinkType, PortType } from '../models'

export abstract class BaseParser implements Parser {
  abstract name: string
  abstract version: string
  abstract formats: string[]

  abstract parse(input: string, options?: ParseOptions): ParseResult | Promise<ParseResult>
  abstract validate(input: string): ValidationResult | Promise<ValidationResult>
  abstract supports(input: string): boolean

  /**
   * Common validation helpers
   */
  protected validateGraph(graph: NetworkGraph, options?: ParseOptions): ParseWarning[] {
    const warnings: ParseWarning[] = []

    // Check for duplicate IDs
    const deviceIds = new Set<string>()
    for (const device of graph.devices) {
      if (deviceIds.has(device.id)) {
        warnings.push({
          code: 'DUPLICATE_DEVICE_ID',
          message: `Duplicate device ID: ${device.id}`,
          severity: 'error',
        })
      }
      deviceIds.add(device.id)
    }

    // Validate links reference existing devices
    for (const link of graph.links) {
      if (!deviceIds.has(link.source.deviceId)) {
        warnings.push({
          code: 'INVALID_LINK_SOURCE',
          message: `Link ${link.id} references non-existent device: ${link.source.deviceId}`,
          severity: 'error',
        })
      }
      if (!deviceIds.has(link.target.deviceId)) {
        warnings.push({
          code: 'INVALID_LINK_TARGET',
          message: `Link ${link.id} references non-existent device: ${link.target.deviceId}`,
          severity: 'error',
        })
      }
    }

    // Validate ports belong to devices
    const portsByDevice = new Map<string, Set<string>>()
    for (const port of graph.ports) {
      if (!deviceIds.has(port.deviceId)) {
        warnings.push({
          code: 'ORPHANED_PORT',
          message: `Port ${port.id} references non-existent device: ${port.deviceId}`,
          severity: 'error',
        })
      }
      
      const devicePorts = portsByDevice.get(port.deviceId) || new Set()
      if (devicePorts.has(port.id)) {
        warnings.push({
          code: 'DUPLICATE_PORT_ID',
          message: `Duplicate port ID ${port.id} on device ${port.deviceId}`,
          severity: 'error',
        })
      }
      devicePorts.add(port.id)
      portsByDevice.set(port.deviceId, devicePorts)
    }

    // Run custom validators
    if (options?.validators) {
      for (const validator of options.validators) {
        const validatorWarnings = validator.validate(graph)
        warnings.push(...validatorWarnings)
      }
    }

    return warnings
  }

  /**
   * Apply defaults to graph elements
   */
  protected applyDefaults(graph: NetworkGraph, options?: ParseOptions): NetworkGraph {
    const defaults = options?.defaults || {}

    // Apply device defaults
    if (defaults.deviceType) {
      for (const device of graph.devices) {
        if (!device.type) {
          device.type = defaults.deviceType as DeviceType
        }
      }
    }

    // Apply link defaults
    if (defaults.linkType) {
      for (const link of graph.links) {
        if (!link.type) {
          link.type = defaults.linkType as LinkType
        }
      }
    }

    // Apply port defaults
    if (defaults.portType) {
      for (const port of graph.ports) {
        if (!port.type) {
          port.type = defaults.portType as PortType
        }
      }
    }

    // Auto-detect modules if enabled
    if (options?.moduleAutoDetect && !graph.modules?.length) {
      graph.modules = this.autoDetectModules(graph)
    }

    return graph
  }

  /**
   * Auto-detect modules based on device naming patterns
   */
  protected autoDetectModules(graph: NetworkGraph): NetworkGraph['modules'] {
    const modules: NetworkGraph['modules'] = []
    const moduleMap = new Map<string, string[]>()

    // Group by common prefixes
    for (const device of graph.devices) {
      // Extract prefix (e.g., "core-sw-01" -> "core")
      const match = device.name.toLowerCase().match(/^([a-z]+)-/)
      if (match) {
        const prefix = match[1]
        const devices = moduleMap.get(prefix) || []
        devices.push(device.id)
        moduleMap.set(prefix, devices)
      }
    }

    // Create modules for groups with 2+ devices
    let moduleIndex = 0
    for (const [prefix, devices] of moduleMap) {
      if (devices.length >= 2) {
        modules.push({
          id: `module-${prefix}`,
          name: prefix.charAt(0).toUpperCase() + prefix.slice(1) + ' Network',
          devices,
        })
        moduleIndex++
      }
    }

    return modules.length > 0 ? modules : undefined
  }

  /**
   * Generate unique ID if not provided
   */
  protected generateId(prefix: string, index: number): string {
    return `${prefix}-${index.toString().padStart(3, '0')}`
  }
}