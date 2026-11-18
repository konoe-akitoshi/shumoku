// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Who watches which topology on `/ws`, and what each is sent: a topology's live metrics, and its
 * composition revision and mapping version whenever they move (it was drawn again; a bandwidth or
 * binding changed). One client watches any number of topologies. Free of sockets and services, so
 * the Server only says how to reach a client and how to read a topology.
 */

import type { ClientMessage, LiveMessage, MetricsData } from '../types.js'

/** What the clients read of a topology. */
export interface LiveTopologies {
  exists(topology: string): boolean
  revisionOf(topology: string): number
  mappingVersionOf(topology: string): number
  /** Its live metrics as a client is sent them; nothing before the first poll. */
  metricsOf(topology: string): MetricsData | undefined
}

interface Sent {
  revision: number
  mappingVersion: number
}

export class LiveClients<Client> {
  private readonly watching = new Map<Client, Map<string, Sent>>()

  constructor(
    private readonly topologies: LiveTopologies,
    private readonly send: (client: Client, message: LiveMessage) => void,
    /** A topology gained its first watcher or lost its last one (the poll schedule follows). */
    private readonly watchChanged: (topology: string) => void = () => {},
  ) {}

  get size(): number {
    return this.watching.size
  }

  add(client: Client): void {
    if (!this.watching.has(client)) this.watching.set(client, new Map())
  }

  remove(client: Client): void {
    const watched = this.watching.get(client)
    this.watching.delete(client)
    for (const topology of watched?.keys() ?? []) this.watchChanged(topology)
  }

  isWatched(topology: string): boolean {
    for (const watched of this.watching.values()) if (watched.has(topology)) return true
    return false
  }

  receive(client: Client, message: ClientMessage): void {
    const watched = this.watching.get(client)
    if (!watched || typeof message.topology !== 'string') return
    const topology = message.topology
    if (message.type === 'unsubscribe') {
      if (watched.delete(topology)) this.watchChanged(topology)
      return
    }
    if (message.type !== 'subscribe' || watched.has(topology)) return
    if (!this.topologies.exists(topology)) {
      this.send(client, { type: 'error', topology, error: 'Topology not found' })
      return
    }
    const sent = {
      revision: this.topologies.revisionOf(topology),
      mappingVersion: this.topologies.mappingVersionOf(topology),
    }
    watched.set(topology, sent)
    this.send(client, { type: 'revision', topology, revision: sent.revision })
    this.send(client, { type: 'mappingVersion', topology, version: sent.mappingVersion })
    const metrics = this.topologies.metricsOf(topology)
    if (metrics) this.send(client, { type: 'metrics', topology, data: metrics })
    this.watchChanged(topology)
  }

  /** Send every watcher the live metrics of what it watches. */
  broadcastMetrics(): void {
    for (const [client, watched] of this.watching) {
      for (const topology of watched.keys()) {
        const metrics = this.topologies.metricsOf(topology)
        if (metrics) this.send(client, { type: 'metrics', topology, data: metrics })
      }
    }
  }

  /** Send every watcher the revision and mapping version of what it watches, where they moved. */
  pushVersions(): void {
    for (const [client, watched] of this.watching) {
      for (const [topology, sent] of watched) {
        const revision = this.topologies.revisionOf(topology)
        if (revision !== sent.revision) {
          sent.revision = revision
          this.send(client, { type: 'revision', topology, revision })
        }
        const mappingVersion = this.topologies.mappingVersionOf(topology)
        if (mappingVersion !== sent.mappingVersion) {
          sent.mappingVersion = mappingVersion
          this.send(client, { type: 'mappingVersion', topology, version: mappingVersion })
        }
      }
    }
  }
}
