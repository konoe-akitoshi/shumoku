/**
 * Plugins API
 * Manage external plugins (list, add, remove, enable/disable, reload)
 */

import { Hono } from 'hono'
import {
  getAllPlugins,
  getPluginManifest,
  addPlugin,
  removePlugin,
  setPluginEnabled,
  reloadPlugins,
  installPluginFromZip,
  installPluginFromUrl,
  getPluginsDir,
  isBuiltinPlugin,
} from '../plugins/loader.js'

export function createPluginsApi(): Hono {
  const app = new Hono()

  // List all plugins (builtin + external)
  app.get('/', (c) => {
    const plugins = getAllPlugins()
    return c.json(plugins)
  })

  // Get plugin manifest (external only)
  app.get('/:id/manifest', async (c) => {
    const id = c.req.param('id')

    if (isBuiltinPlugin(id)) {
      return c.json({ error: 'Builtin plugins do not have a manifest' }, 400)
    }

    const manifest = await getPluginManifest(id)
    if (!manifest) {
      return c.json({ error: 'Plugin not found or manifest not readable' }, 404)
    }

    return c.json(manifest)
  })

  // Add plugin by path, URL, or file upload
  app.post('/', async (c) => {
    const contentType = c.req.header('content-type') || ''

    // Handle ZIP upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData()
      const file = formData.get('file')
      const subdirectory = formData.get('subdirectory')?.toString()

      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file uploaded' }, 400)
      }

      const pluginsDir = getPluginsDir()
      if (!pluginsDir) {
        return c.json({ error: 'Plugins directory not configured' }, 500)
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await installPluginFromZip(buffer, pluginsDir, subdirectory)

      if (!result.success) {
        return c.json({ error: result.error }, 400)
      }

      return c.json(result.plugin, 201)
    }

    // Handle JSON body with path or url
    const body = await c.req.json<{ path?: string; url?: string; subdirectory?: string }>()

    const pluginsDir = getPluginsDir()
    if (!pluginsDir) {
      return c.json({ error: 'Plugins directory not configured' }, 500)
    }

    // URL-based installation
    if (body.url) {
      const result = await installPluginFromUrl(body.url, pluginsDir, body.subdirectory)

      if (!result.success) {
        return c.json({ error: result.error }, 400)
      }

      return c.json(result.plugin, 201)
    }

    // Path-based installation
    if (body.path) {
      const result = await addPlugin(body.path)

      if (!result.success) {
        return c.json({ error: result.error }, 400)
      }

      return c.json(result.plugin, 201)
    }

    return c.json({ error: 'Either path or url is required' }, 400)
  })

  // Enable/disable plugin
  app.patch('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{ enabled?: boolean }>()

    if (typeof body.enabled !== 'boolean') {
      return c.json({ error: 'enabled (boolean) is required' }, 400)
    }

    const result = await setPluginEnabled(id, body.enabled)

    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    return c.json({ success: true })
  })

  // Remove plugin
  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const deleteFiles = c.req.query('deleteFiles') === 'true'

    const result = await removePlugin(id, deleteFiles)

    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    return c.json({ success: true })
  })

  // Reload all plugins (hot reload)
  app.post('/reload', async (c) => {
    try {
      const plugins = await reloadPlugins()
      return c.json({
        success: true,
        plugins,
        count: plugins.filter((p) => p.enabled && !p.error).length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  return app
}
