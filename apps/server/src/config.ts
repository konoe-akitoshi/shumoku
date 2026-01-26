/**
 * Configuration loader
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as yaml from 'js-yaml'
import type { Config, WeathermapConfig } from './types.js'

const DEFAULT_WEATHERMAP_CONFIG: WeathermapConfig = {
  thresholds: [
    { value: 0, color: '#73BF69' }, // Green
    { value: 50, color: '#FADE2A' }, // Yellow
    { value: 75, color: '#FF9830' }, // Orange
    { value: 90, color: '#FF0000' }, // Red
  ],
}

const DEFAULT_CONFIG: Config = {
  server: {
    port: 3000,
    host: '0.0.0.0',
    dataDir: './data',
  },
  topologies: [],
  weathermap: DEFAULT_WEATHERMAP_CONFIG,
}

/**
 * Load configuration from file or environment
 */
export function loadConfig(configPath?: string): Config {
  let config = { ...DEFAULT_CONFIG }

  // Try to load from file
  const filePath = configPath || process.env.SHUMOKU_CONFIG || './config.yaml'
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fileConfig = yaml.load(content) as Partial<Config>

    config = {
      ...config,
      ...fileConfig,
      server: { ...config.server, ...fileConfig.server },
      weathermap: { ...config.weathermap, ...fileConfig.weathermap },
    }
  }

  // Override with environment variables
  if (process.env.PORT) {
    config.server.port = Number.parseInt(process.env.PORT, 10)
  }
  if (process.env.HOST) {
    config.server.host = process.env.HOST
  }
  if (process.env.DATA_DIR) {
    config.server.dataDir = process.env.DATA_DIR
  }
  if (process.env.ZABBIX_URL) {
    config.zabbix = config.zabbix || { url: '', token: '', pollInterval: 30000 }
    config.zabbix.url = process.env.ZABBIX_URL
  }
  if (process.env.ZABBIX_TOKEN) {
    config.zabbix = config.zabbix || { url: '', token: '', pollInterval: 30000 }
    config.zabbix.token = process.env.ZABBIX_TOKEN
  }
  if (process.env.ZABBIX_POLL_INTERVAL) {
    config.zabbix = config.zabbix || { url: '', token: '', pollInterval: 30000 }
    config.zabbix.pollInterval = Number.parseInt(process.env.ZABBIX_POLL_INTERVAL, 10)
  }

  // Handle ${VAR} syntax in config values
  config = replaceEnvVars(config)

  return config
}

/**
 * Replace ${VAR} syntax with environment variables
 */
function replaceEnvVars<T>(obj: T): T {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '') as T
  }
  if (Array.isArray(obj)) {
    return obj.map(replaceEnvVars) as T
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceEnvVars(value)
    }
    return result as T
  }
  return obj
}

/**
 * Resolve path relative to config file directory
 */
export function resolvePath(filePath: string, basePath?: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  return path.resolve(basePath || process.cwd(), filePath)
}
