/**
 * Configuration loader
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as yaml from 'js-yaml'
import type { Config } from './types.js'

/**
 * Get default data directory path
 * - Docker/systemd: uses DATA_DIR environment variable
 * - Local: resolves to apps/server/data, both in dev (api/src) and from the
 *   built output (api/dist/api/src), by walking up to the api package root
 */
const getDefaultDataDir = (): string => {
  if (process.env['DATA_DIR']) {
    return process.env['DATA_DIR']
  }
  let dir = import.meta.dir
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir)
    if (parent === dir) {
      return path.join(process.cwd(), 'data')
    }
    dir = parent
  }
  return path.join(path.dirname(dir), 'data')
}

const DEFAULT_CONFIG: Config = {
  server: {
    port: 8080,
    host: '0.0.0.0',
    dataDir: getDefaultDataDir(),
  },
}

/**
 * Load configuration from file or environment
 */
export function loadConfig(configPath?: string): Config {
  let config = { ...DEFAULT_CONFIG }

  // Try to load from file
  const filePath = configPath || process.env['SHUMOKU_CONFIG'] || './config.yaml'
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fileConfig = yaml.load(content) as Partial<Config>

    config = {
      ...config,
      ...fileConfig,
      server: { ...config.server, ...fileConfig.server },
    }
  }

  // Override with environment variables
  if (process.env['PORT']) {
    config.server.port = Number.parseInt(process.env['PORT'], 10)
  }
  if (process.env['HOST']) {
    config.server.host = process.env['HOST']
  }
  if (process.env['DATA_DIR']) {
    config.server.dataDir = process.env['DATA_DIR']
  }
  if (process.env['POLL_INTERVAL']) {
    config.server.pollInterval = Number.parseInt(process.env['POLL_INTERVAL'], 10)
  }
  if (process.env['BACKGROUND_POLL_INTERVAL']) {
    config.server.backgroundPollInterval = Number.parseInt(
      process.env['BACKGROUND_POLL_INTERVAL'],
      10,
    )
  }
  if (process.env['POLL_CONCURRENCY_LIMIT']) {
    config.server.concurrencyLimit = Number.parseInt(process.env['POLL_CONCURRENCY_LIMIT'], 10)
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
