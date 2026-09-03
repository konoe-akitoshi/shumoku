import {
  addPlugin,
  getAllPlugins,
  getPluginManifest,
  getPluginsDir,
  installPluginFromUrl,
  installPluginFromZip,
  isBundledPlugin,
  reloadPlugins,
  removePlugin,
  setPluginEnabled,
} from '../plugins/loader.js'
import type { PluginApplicationService, PluginInfoView, PluginMutationResult } from './services.js'

function mutationResult<T extends PluginInfoView>(result: {
  success: boolean
  plugin?: T
  error?: string
}): PluginMutationResult<T> {
  if (result.success && result.plugin) return { ok: true, value: result.plugin }
  return { ok: false, status: 400, error: result.error ?? 'Plugin operation failed' }
}

function pluginsDirectory(): PluginMutationResult<string> {
  const directory = getPluginsDir()
  if (directory) return { ok: true, value: directory }
  return { ok: false, status: 500, error: 'Plugins directory not configured' }
}

export function createPluginApplicationService(): PluginApplicationService {
  return {
    list: getAllPlugins,
    async getManifest(id) {
      if (isBundledPlugin(id)) {
        return { ok: false, status: 400, error: 'Bundled plugins do not have a manifest' }
      }
      const manifest = await getPluginManifest(id)
      return manifest
        ? { ok: true, value: manifest }
        : { ok: false, status: 404, error: 'Plugin not found or manifest not readable' }
    },
    async installFromPath(path) {
      return mutationResult(await addPlugin(path))
    },
    async installFromUrl(url, subdirectory) {
      const directory = pluginsDirectory()
      if (!directory.ok) return directory
      return mutationResult(await installPluginFromUrl(url, directory.value, subdirectory))
    },
    async installFromZip(bytes, subdirectory) {
      const directory = pluginsDirectory()
      if (!directory.ok) return directory
      return mutationResult(
        await installPluginFromZip(Buffer.from(bytes), directory.value, subdirectory),
      )
    },
    async setEnabled(id, enabled) {
      const result = await setPluginEnabled(id, enabled)
      return result.success
        ? { ok: true, value: { success: true } }
        : { ok: false, status: 400, error: result.error ?? 'Plugin operation failed' }
    },
    async remove(id, deleteFiles) {
      const result = await removePlugin(id, deleteFiles)
      return result.success
        ? { ok: true, value: { success: true } }
        : { ok: false, status: 400, error: result.error ?? 'Plugin operation failed' }
    },
    async reload() {
      try {
        await reloadPlugins()
        const plugins = getAllPlugins()
        return {
          ok: true,
          value: {
            success: true,
            plugins,
            count: plugins.filter((plugin) => plugin.enabled && !plugin.error).length,
          },
        }
      } catch (error) {
        return {
          ok: false,
          status: 500,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}
