import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync } from 'node:fs'
import path from 'node:path'

const output = path.resolve(process.argv[2] ?? '/app/runtime-node_modules')
const copied = new Map()

function resolvePackage(name, from) {
  let directory = from
  while (true) {
    for (const modules of ['node_modules', 'node_modules/.bun/node_modules']) {
      const candidate = path.join(directory, modules, name)
      if (existsSync(path.join(candidate, 'package.json'))) return realpathSync(candidate)
    }
    const parent = path.dirname(directory)
    if (parent === directory) throw new Error(`Missing runtime dependency: ${name}`)
    directory = parent
  }
}

function materialize(source) {
  const previous = copied.get(source)
  if (previous) return previous
  const manifest = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8'))
  const destination = path.join(
    output,
    '.runtime',
    `${manifest.name.replaceAll('/', '+')}@${manifest.version}`,
  )
  copied.set(source, destination)
  mkdirSync(path.dirname(destination), { recursive: true })
  cpSync(source, destination, {
    recursive: true,
    filter: (file) => file !== path.join(source, 'node_modules'),
  })
  const required = { ...manifest.dependencies, ...manifest.peerDependencies }
  const optional = manifest.optionalDependencies ?? {}
  for (const name of new Set([...Object.keys(required), ...Object.keys(optional)])) {
    let dependency
    try {
      dependency = resolvePackage(name, source)
    } catch (error) {
      if (name in optional || manifest.peerDependenciesMeta?.[name]?.optional) continue
      throw error
    }
    link(name, materialize(dependency), path.join(destination, 'node_modules'))
  }
  return destination
}

function link(name, target, directory) {
  const destination = path.join(directory, name)
  mkdirSync(path.dirname(destination), { recursive: true })
  symlinkSync(path.relative(path.dirname(destination), target), destination, 'dir')
}

for (const name of ['jsdom', '@resvg/resvg-js']) {
  link(name, materialize(resolvePackage(name, process.cwd())), output)
}
