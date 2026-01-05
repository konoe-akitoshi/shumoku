/**
 * Parser interface definitions
 */

import type { NetworkGraph } from '../models'

export interface ParseOptions {
  /**
   * Strict mode - fail on any validation errors
   */
  strict?: boolean

  /**
   * Auto-detect modules from device naming/grouping
   */
  moduleAutoDetect?: boolean

  /**
   * Default values for missing properties
   */
  defaults?: {
    deviceType?: string
    linkType?: string
    portType?: string
  }

  /**
   * Custom validators
   */
  validators?: ParserValidator[]
}

export interface ParseWarning {
  /**
   * Warning code
   */
  code: string

  /**
   * Human-readable message
   */
  message: string

  /**
   * Location in source (if applicable)
   */
  location?: {
    line?: number
    column?: number
    path?: string
  }

  /**
   * Severity
   */
  severity: 'info' | 'warning' | 'error'
}

export interface ParseResult {
  /**
   * Parsed network graph
   */
  graph: NetworkGraph

  /**
   * Warnings generated during parsing
   */
  warnings?: ParseWarning[]

  /**
   * Parsing statistics
   */
  stats?: {
    parseTimeMs: number
    deviceCount: number
    linkCount: number
    moduleCount: number
  }
}

export interface ValidationResult {
  /**
   * Whether the input is valid
   */
  valid: boolean

  /**
   * Validation errors
   */
  errors?: ParseWarning[]

  /**
   * Validation warnings
   */
  warnings?: ParseWarning[]
}

export interface ParserValidator {
  /**
   * Validator name
   */
  name: string

  /**
   * Validation function
   */
  validate: (graph: NetworkGraph) => ParseWarning[]
}

export interface Parser {
  /**
   * Parser name
   */
  name: string

  /**
   * Parser version
   */
  version: string

  /**
   * Supported formats
   */
  formats: string[]

  /**
   * Parse input into network graph
   */
  parse(input: string, options?: ParseOptions): ParseResult | Promise<ParseResult>

  /**
   * Validate input without full parsing
   */
  validate(input: string): ValidationResult | Promise<ValidationResult>

  /**
   * Check if input format is supported
   */
  supports(input: string): boolean
}