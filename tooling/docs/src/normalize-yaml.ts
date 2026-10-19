import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/**
 * Generates the YAML reference from the input model's types: each interface is a section, each
 * property a field, and the TSDoc comments are the descriptions. The types are the spec, so the
 * reference cannot drift from what the YAML is read as.
 */

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const outputPath = path.join(repositoryRoot, 'apps/docs/.generated/yaml.json')
const exampleFile = 'examples/getting-started.yaml'
const schemaFile = 'libs/@shumoku/core/src/input/model.ts'

/** Sections in reading order: the document, then what it lists, then the smaller shapes. */
const SECTIONS: Array<{ id: string; title: string; type: string }> = [
  { id: 'document', title: 'Document', type: 'Network' },
  { id: 'node', title: 'Node', type: 'Node' },
  { id: 'link', title: 'Link', type: 'Link' },
  { id: 'node-end', title: 'Link end: node', type: 'NodeEnd' },
  { id: 'segment-end', title: 'Link end: segment', type: 'SegmentEnd' },
  { id: 'routing-domain-end', title: 'Link end: routing domain', type: 'RoutingDomainEnd' },
  { id: 'group', title: 'Group', type: 'Group' },
  { id: 'segment', title: 'Segment', type: 'Segment' },
  { id: 'routing-domain', title: 'Routing domain', type: 'RoutingDomain' },
  { id: 'connection', title: 'Connection', type: 'Connection' },
  { id: 'redundancy', title: 'Redundancy set', type: 'Redundancy' },
]

/** Value shapes that fields refer to by name. */
const VALUE_TYPES = ['Rate', 'Length', 'Product', 'OneOrMore']

const program = ts.createProgram([path.join(repositoryRoot, schemaFile)], {
  strict: true,
  target: ts.ScriptTarget.ES2022,
})
const checker = program.getTypeChecker()
const source = program.getSourceFile(path.join(repositoryRoot, schemaFile))
if (!source) throw new Error(`${schemaFile} not found`)

const declarations = new Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration>()
for (const statement of source.statements) {
  if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
    declarations.set(statement.name.text, statement)
  }
}

function docOf(node: ts.Node & { name?: ts.Node }): string {
  const symbol = node.name && checker.getSymbolAtLocation(node.name)
  return symbol ? ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim() : ''
}

/** An id type reads as what it names: `NodeId` → `node id`. */
const idWords = (name: string) => `${name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} id`

/** The type as written, without `readonly`, so a field reads as the YAML is written. */
function typeText(type: ts.TypeNode | undefined): string {
  return (type?.getText(source) ?? 'unknown')
    .replace(/\breadonly\s+/g, '')
    .replace(/\b(Group|RoutingDomain|Connection|Segment|Node|Redundancy|Link)Id\b/g, (_, n) =>
      idWords(n),
    )
    .replace(/\s+/g, ' ')
}

function literalValues(type: ts.TypeNode | undefined): string[] {
  if (!type) return []
  const parts = ts.isUnionTypeNode(type) ? type.types : [type]
  return parts.every(ts.isLiteralTypeNode) ? parts.map((p) => p.getText(source)) : []
}

function section(id: string, title: string, typeName: string) {
  const declaration = declarations.get(typeName)
  if (!declaration || !ts.isInterfaceDeclaration(declaration)) {
    throw new Error(`${typeName} is not an interface in ${schemaFile}`)
  }
  return {
    id,
    title,
    description: docOf(declaration),
    fields: declaration.members.filter(ts.isPropertySignature).map((member) => {
      const values = literalValues(member.type)
      return {
        name: member.name.getText(source),
        type: typeText(member.type),
        description: docOf(member),
        required: !member.questionToken,
        ...(values.length > 0 ? { values } : {}),
      }
    }),
  }
}

const valueTypes = {
  id: 'value-types',
  title: 'Value types',
  description: 'Shapes that fields above refer to by name.',
  fields: VALUE_TYPES.map((name) => {
    const declaration = declarations.get(name)
    if (!declaration || !ts.isTypeAliasDeclaration(declaration)) {
      throw new Error(`${name} is not a type alias in ${schemaFile}`)
    }
    return {
      name,
      type: typeText(declaration.type),
      description: docOf(declaration),
      required: false,
    }
  }),
}

/** The input model's own description: the comment that opens the file. */
function moduleDescription(): string {
  const text = source?.getFullText() ?? ''
  const match = /^\/\*\*([\s\S]*?)\*\//.exec(text)
  return (match?.[1] ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const model = {
  schemaVersion: 2,
  title: 'Shumoku YAML',
  description: moduleDescription(),
  sections: [...SECTIONS.map((s) => section(s.id, s.title, s.type)), valueTypes],
  example: {
    file: exampleFile,
    contents: await readFile(path.join(repositoryRoot, exampleFile), 'utf8'),
  },
  source: {
    file: schemaFile,
    url: `https://github.com/konoe-akitoshi/shumoku/blob/main/${schemaFile}`,
  },
}

await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${model.sections.length} sections)`,
)
