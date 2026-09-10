import { dumpGraph, type NetworkGraph, YamlParser } from '@shumoku/core'

export interface ManualGraphEditorState {
  mode: 'yaml' | 'json'
  yaml: string
  json: string
  yamlSnapshot: string
  jsonSnapshot: string
}

function parseJsonGraph(text: string): NetworkGraph {
  const value: unknown = JSON.parse(text)
  if (
    !value ||
    typeof value !== 'object' ||
    !('nodes' in value) ||
    !Array.isArray(value.nodes) ||
    !('links' in value) ||
    !Array.isArray(value.links)
  ) {
    throw new Error('Expected a graph with nodes and links arrays, not an API response envelope.')
  }
  return value as NetworkGraph
}

function parseYamlGraph(text: string): NetworkGraph {
  const result = new YamlParser().parse(text)
  const errors = (result.warnings ?? []).filter((warning) => warning.severity === 'error')
  if (errors.length > 0) {
    throw new Error(`Invalid YAML:\n${errors.map((warning) => `• ${warning.message}`).join('\n')}`)
  }
  return result.graph
}

export function seedManualGraphEditor(graph: NetworkGraph): ManualGraphEditorState {
  const json = JSON.stringify(graph, null, 2)
  const yaml = dumpGraph(graph)
  return { mode: 'yaml', yaml, json, yamlSnapshot: yaml, jsonSnapshot: json }
}

/** Use the same lossless read for both tab conversion and saving. An unchanged
 * YAML preview must not re-parse (and reject/drop) observation-only JSON fields.
 * Once YAML is edited, the authoring schema must be checked again. */
export function readManualGraphEditor(state: ManualGraphEditorState): NetworkGraph {
  if (state.mode === 'json') return parseJsonGraph(state.json)
  if (state.yaml === state.yamlSnapshot && state.jsonSnapshot !== '') {
    return parseJsonGraph(state.jsonSnapshot)
  }
  return parseYamlGraph(state.yaml)
}

/** Pure transition: a failed conversion cannot replace either pane or snapshot. */
export function switchManualGraphEditor(
  state: ManualGraphEditorState,
  mode: ManualGraphEditorState['mode'],
): ManualGraphEditorState {
  if (state.mode === mode) return state
  const graph = readManualGraphEditor(state)
  let { yaml, json } = state
  if (mode === 'json') {
    json =
      yaml === state.yamlSnapshot && state.jsonSnapshot !== ''
        ? state.jsonSnapshot
        : JSON.stringify(graph, null, 2)
  } else {
    yaml =
      json === state.jsonSnapshot && state.yamlSnapshot !== ''
        ? state.yamlSnapshot
        : dumpGraph(graph)
  }
  return { mode, yaml, json, yamlSnapshot: yaml, jsonSnapshot: json }
}
