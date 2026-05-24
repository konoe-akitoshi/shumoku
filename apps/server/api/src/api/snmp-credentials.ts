/**
 * SNMP Credentials API — CRUD for named SNMP community strings that
 * the discovery-policy chain can reference per-node / per-subgraph
 * / topology-default.
 *
 *   GET    /api/snmp-credentials
 *   GET    /api/snmp-credentials/:id
 *   POST   /api/snmp-credentials      { name, community }
 *   PUT    /api/snmp-credentials/:id  { name?, community? }
 *   DELETE /api/snmp-credentials/:id
 *
 * `community` is masked in GET / POST / PUT responses (same SECRET
 * convention as `data_sources.config_json`). Real value only ever
 * leaves the DB via the in-process `SnmpCredentialsService` when the
 * sync/scheduler builds its per-target community map for the SNMP-
 * LLDP plugin.
 */

import { Hono } from 'hono'
import { type SnmpCredential, SnmpCredentialsService } from '../services/snmp-credentials.js'

const MASK = '••••••••'

function maskOne(c: SnmpCredential): SnmpCredential {
  return { ...c, community: c.community ? MASK : '' }
}

export function createSnmpCredentialsApi(): Hono {
  const app = new Hono()
  const service = new SnmpCredentialsService()

  app.get('/', (c) => c.json(service.list().map(maskOne)))

  app.get('/:id', (c) => {
    const cred = service.get(c.req.param('id'))
    if (!cred) return c.json({ error: 'SNMP credential not found' }, 404)
    return c.json(maskOne(cred))
  })

  app.post('/', async (c) => {
    try {
      const body = (await c.req.json()) as { name?: unknown; community?: unknown }
      if (typeof body.name !== 'string' || body.name.length === 0) {
        return c.json({ error: '`name` must be a non-empty string' }, 400)
      }
      if (typeof body.community !== 'string' || body.community.length === 0) {
        return c.json({ error: '`community` must be a non-empty string' }, 400)
      }
      const created = await service.create({ name: body.name, community: body.community })
      return c.json(maskOne(created), 201)
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
    }
  })

  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as { name?: unknown; community?: unknown }
      const patch: { name?: string; community?: string } = {}
      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.length === 0) {
          return c.json({ error: '`name` must be a non-empty string when provided' }, 400)
        }
        patch.name = body.name
      }
      // Community update: ignore the mask sentinel so a "just rename"
      // PUT that round-trips the masked GET response doesn't wipe the
      // stored secret.
      if (body.community !== undefined && body.community !== MASK) {
        if (typeof body.community !== 'string' || body.community.length === 0) {
          return c.json(
            { error: '`community` must be a non-empty string when provided (or omit to keep)' },
            400,
          )
        }
        patch.community = body.community
      }
      const updated = service.update(id, patch)
      if (!updated) return c.json({ error: 'SNMP credential not found' }, 404)
      return c.json(maskOne(updated))
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
    }
  })

  app.delete('/:id', (c) => {
    const ok = service.delete(c.req.param('id'))
    if (!ok) return c.json({ error: 'SNMP credential not found' }, 404)
    return c.json({ success: true })
  })

  return app
}
