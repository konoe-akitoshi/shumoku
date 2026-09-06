import {
  createMemoryFileResolver,
  HierarchicalParser,
  type NetworkGraph,
  parser,
} from '@shumoku/core'
import { type PreparedRender, prepareRender, renderSvg } from '@shumoku/renderer-svg'

export interface EditorFile {
  name: string
  content: string
}

export interface RenderResult {
  prepared: PreparedRender
  sheets: Map<string, NetworkGraph> | null
}

/** The editor resolves only its in-memory files, never remote or local filesystem paths. */
export async function renderFiles(files: EditorFile[]): Promise<RenderResult> {
  const main = files.find((file) => file.name === 'main.yaml')
  if (!main) throw new Error('main.yaml not found')
  const fileMap = new Map<string, string>()
  for (const file of files) {
    fileMap.set(file.name, file.content)
    fileMap.set(`./${file.name}`, file.content)
    fileMap.set(`/${file.name}`, file.content)
  }
  const hierarchical = files.some((file) => file.content.includes('file:'))
  const hierarchy = hierarchical
    ? await new HierarchicalParser(createMemoryFileResolver(fileMap, '/')).parse(
        main.content,
        '/main.yaml',
      )
    : null
  const result = hierarchy ?? parser.parse(main.content)
  const errors = result.warnings?.filter((warning) => warning.severity === 'error') ?? []
  if (errors.length)
    throw new Error(`Parse errors: ${errors.map((error) => error.message).join(', ')}`)
  return {
    prepared: await prepareRender(result.graph),
    sheets: hierarchy?.sheets ?? null,
  }
}

export async function generateContent(result: RenderResult, format: 'svg' | 'html') {
  if (format === 'svg') return renderSvg(result.prepared)
  // Keep the standalone HTML runtime off the initial Playground and homepage bundles.
  const [{ renderHtml, renderHtmlHierarchical, setIIFE }, { INTERACTIVE_IIFE }] = await Promise.all(
    [import('@shumoku/renderer-html'), import('@shumoku/renderer-html/iife-string')],
  )
  setIIFE(INTERACTIVE_IIFE)
  if (!result.sheets?.size) return renderHtml(result.prepared)
  const sheets = new Map([
    [
      'root',
      {
        graph: result.prepared.graph,
        layout: result.prepared.layout,
        resolved: result.prepared.resolved,
      },
    ],
  ])
  for (const [id, graph] of result.sheets) {
    const prepared = await prepareRender(graph, {
      iconDimensions: result.prepared.iconDimensions ?? undefined,
    })
    sheets.set(id, { graph: prepared.graph, layout: prepared.layout, resolved: prepared.resolved })
  }
  return renderHtmlHierarchical(result.prepared, { sheets })
}
