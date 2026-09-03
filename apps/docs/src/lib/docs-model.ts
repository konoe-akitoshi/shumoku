import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface ReferenceParameter {
  name: string
  type: string
  description: string
  optional: boolean
  defaultValue?: string
}

export interface ReferenceSymbol {
  id: string
  name: string
  kind: 'function'
  summary: string
  signature: string
  parameters: ReferenceParameter[]
  returns: string
  source: {
    file: string
    line: number
    url: string
  }
}

export interface PackageReferenceModel {
  schemaVersion: 1
  package: {
    name: string
    version: string
  }
  symbols: ReferenceSymbol[]
}

function isPackageReferenceModel(value: unknown): value is PackageReferenceModel {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const model = value as Record<string, unknown>
  if (model['schemaVersion'] !== 1 || !Array.isArray(model['symbols'])) return false

  const packageValue = model['package']
  if (typeof packageValue !== 'object' || packageValue === null || Array.isArray(packageValue)) {
    return false
  }
  const packageRecord = packageValue as Record<string, unknown>
  if (typeof packageRecord['name'] !== 'string' || typeof packageRecord['version'] !== 'string') {
    return false
  }

  return model['symbols'].every((symbolValue) => {
    if (typeof symbolValue !== 'object' || symbolValue === null || Array.isArray(symbolValue)) {
      return false
    }
    const symbol = symbolValue as Record<string, unknown>
    return (
      typeof symbol['id'] === 'string' &&
      typeof symbol['name'] === 'string' &&
      symbol['kind'] === 'function' &&
      typeof symbol['summary'] === 'string' &&
      typeof symbol['signature'] === 'string' &&
      Array.isArray(symbol['parameters']) &&
      typeof symbol['returns'] === 'string'
    )
  })
}

export async function loadCoreReference(): Promise<PackageReferenceModel> {
  const modelPath = path.resolve('.generated/core.json')
  const model: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
  if (!isPackageReferenceModel(model)) {
    throw new Error(`Invalid generated Core reference model at ${modelPath}`)
  }
  return model
}
