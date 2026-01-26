/**
 * Health Checker Service
 * Background service that periodically checks data source connection status
 */

import { DataSourceService } from './datasource.js'

// Check interval in milliseconds
const DEFAULT_CHECK_INTERVAL = 30_000 // 30 seconds
const MAX_BACKOFF_INTERVAL = 300_000 // 5 minutes max backoff

export class HealthChecker {
  private service: DataSourceService
  private intervalId: ReturnType<typeof setInterval> | null = null
  private checkInterval: number
  private isRunning = false

  constructor(checkInterval = DEFAULT_CHECK_INTERVAL) {
    this.service = new DataSourceService()
    this.checkInterval = checkInterval
  }

  /**
   * Start the health checker
   */
  start(): void {
    if (this.isRunning) {
      console.log('[HealthChecker] Already running')
      return
    }

    console.log(`[HealthChecker] Starting with ${this.checkInterval / 1000}s interval`)
    this.isRunning = true

    // Run initial check immediately
    this.checkAll()

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAll()
    }, this.checkInterval)
  }

  /**
   * Stop the health checker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('[HealthChecker] Stopped')
  }

  /**
   * Check all data sources
   */
  async checkAll(): Promise<void> {
    const dataSources = this.service.list()

    if (dataSources.length === 0) {
      return
    }

    // Check all data sources in parallel with concurrency limit
    const concurrencyLimit = 5
    for (let i = 0; i < dataSources.length; i += concurrencyLimit) {
      const batch = dataSources.slice(i, i + concurrencyLimit)
      await Promise.all(batch.map((ds) => this.checkOne(ds.id)))
    }
  }

  /**
   * Check a single data source
   * Implements backoff strategy for failed connections
   */
  async checkOne(id: string): Promise<void> {
    const ds = this.service.get(id)
    if (!ds) return

    // Backoff check: skip if recently checked and failed
    if (ds.failCount > 0 && ds.lastCheckedAt) {
      const backoffMs = this.calculateBackoff(ds.failCount)
      const timeSinceLastCheck = Date.now() - ds.lastCheckedAt
      if (timeSinceLastCheck < backoffMs) {
        // Skip this check due to backoff
        return
      }
    }

    try {
      const result = await this.service.testConnection(id)

      if (result.success) {
        // Connection successful - reset fail count
        this.service.updateHealthStatus(id, 'connected', result.message, 0)
      } else {
        // Connection failed - increment fail count
        const newFailCount = ds.failCount + 1
        this.service.updateHealthStatus(id, 'disconnected', result.message, newFailCount)
        console.log(
          `[HealthChecker] ${ds.name}: disconnected (fail #${newFailCount}) - ${result.message}`,
        )
      }
    } catch (error) {
      // Unexpected error - increment fail count
      const newFailCount = ds.failCount + 1
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.service.updateHealthStatus(id, 'disconnected', message, newFailCount)
      console.log(`[HealthChecker] ${ds.name}: error (fail #${newFailCount}) - ${message}`)
    }
  }

  /**
   * Calculate backoff interval based on fail count
   * Uses exponential backoff: 30s, 60s, 120s, 240s, 300s (max)
   */
  private calculateBackoff(failCount: number): number {
    const backoff = this.checkInterval * Math.pow(2, Math.min(failCount - 1, 4))
    return Math.min(backoff, MAX_BACKOFF_INTERVAL)
  }

  /**
   * Force check a specific data source (bypasses backoff)
   */
  async forceCheck(id: string): Promise<void> {
    const ds = this.service.get(id)
    if (!ds) return

    try {
      const result = await this.service.testConnection(id)

      if (result.success) {
        this.service.updateHealthStatus(id, 'connected', result.message, 0)
      } else {
        this.service.updateHealthStatus(id, 'disconnected', result.message, ds.failCount + 1)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.service.updateHealthStatus(id, 'disconnected', message, ds.failCount + 1)
    }
  }
}

// Singleton instance
let healthChecker: HealthChecker | null = null

export function getHealthChecker(): HealthChecker {
  if (!healthChecker) {
    healthChecker = new HealthChecker()
  }
  return healthChecker
}

export function startHealthChecker(): void {
  getHealthChecker().start()
}

export function stopHealthChecker(): void {
  if (healthChecker) {
    healthChecker.stop()
  }
}
