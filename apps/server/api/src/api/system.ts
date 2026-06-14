import { Hono } from 'hono'
import { getSystemInfo } from '../services/system-info.js'

export function createSystemApi(): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const force = c.req.query('refresh') === 'true'
    return c.json(await getSystemInfo(force))
  })

  return app
}
