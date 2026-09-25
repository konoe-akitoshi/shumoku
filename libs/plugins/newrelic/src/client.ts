import type { ConnectionResult } from '@shumoku/core'
import { createHttpClient, type HttpClient, HttpError } from '@shumoku/plugin-sdk'
import type { NewRelicConfig } from './config.js'
import { type Row, record, str } from './values.js'

export class NewRelicClient {
  private client: HttpClient
  private controller = new AbortController()
  private active = 0
  private queue: Array<() => void> = []
  dispose(): void {
    this.controller.abort()
  }
  private async acquire(): Promise<() => void> {
    if (this.active >= 2) await new Promise<void>((resolve) => this.queue.push(resolve))
    else this.active++
    return () => {
      const next = this.queue.shift()
      if (next) next()
      else this.active--
    }
  }
  constructor(private config: NewRelicConfig) {
    const endpoints = {
      US: 'https://api.newrelic.com',
      EU: 'https://api.eu.newrelic.com',
      JP: 'https://api.jp.newrelic.com',
    }
    this.client = createHttpClient({
      baseUrl: endpoints[config.region],
      defaultHeaders: { 'API-Key': config.apiKey },
      timeoutMs: 35_000,
    })
  }
  async graph(query: string, variables: Row, actorResult = false): Promise<Row> {
    const release = await this.acquire()
    try {
      this.controller.signal.throwIfAborted()
      const response = record(await this.request(query, variables))
      if (Array.isArray(response['errors']) && response['errors'].length)
        throw new Error('New Relic query failed; check account permissions, region and NRQL access')
      const actor = record(record(response['data'])['actor'])
      if (actorResult) return actor
      const account = actor['account']
      if (!account || typeof account !== 'object')
        throw new Error('New Relic account is unavailable')
      return record(account)
    } catch (error) {
      if (error instanceof HttpError)
        throw new Error(
          `New Relic HTTP ${error.status}; check the data region, user key and account permissions`,
        )
      // Never surface arbitrary upstream bodies, which may echo request credentials.
      throw new Error(
        'New Relic request failed; check connectivity, region, permissions and query limits',
      )
    } finally {
      release()
    }
  }

  private async request(query: string, variables: Row): Promise<unknown> {
    for (const attempt of [0, 1, 2]) {
      this.controller.signal.throwIfAborted()
      try {
        return await this.client.json<unknown>('/graphql', {
          method: 'POST',
          body: { query, variables },
          signal: this.controller.signal,
        })
      } catch (error) {
        if (
          !(error instanceof HttpError) ||
          ![429, 502, 503, 504].includes(error.status) ||
          attempt === 2
        )
          throw error
        await new Promise<void>((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
      }
    }
    throw new Error('New Relic retry budget exhausted')
  }

  async nrql(query: string): Promise<Row[]> {
    const data = await this.graph(
      'query($account: Int!, $query: Nrql!) { actor { account(id: $account) { nrql(query: $query, timeout: 30) { results } } } }',
      { account: this.config?.accountId, query },
    )
    const rows = record(data['nrql'])['results']
    if (!Array.isArray(rows)) throw new Error('New Relic returned no query results')
    if (rows.length >= 5000)
      throw new Error('New Relic query reached the 5000-result limit; narrow the monitored account')
    return rows.map(record)
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const data = await this.graph(
        'query($account: Int!) { actor { account(id: $account) { id name } } }',
        { account: this.config?.accountId },
      )
      return { success: true, message: `Connected to ${str(data['name']) ?? 'New Relic'}` }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }
}
