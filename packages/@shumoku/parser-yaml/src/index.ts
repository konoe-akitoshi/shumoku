/**
 * @shumoku/parser-yaml - YAML parser for shumoku network definitions
 */

export { YamlParser } from './parser'
export { YamlParserV2, parserV2 } from './parser-v2'
export type { ParseResultV2, ParseWarning } from './parser-v2'

// Create default instance
import { YamlParser } from './parser'
export const parser = new YamlParser()