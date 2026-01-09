import { useState } from 'react'
import type { NetworkGraph, LayoutResult } from '@shumoku/core/models'
import { HierarchicalLayout } from '@shumoku/core/layout'
import { SVGRenderer } from '@shumoku/core/renderer'
import { parser } from '@shumoku/parser-yaml'
import NetworkSVG from './components/NetworkSVG'
import { enterpriseNetwork, simpleNetwork } from './sampleNetworks'
import './App.css'

function App() {
  const [yamlContent, setYamlContent] = useState<string>(enterpriseNetwork)
  const [networkGraph, setNetworkGraph] = useState<NetworkGraph | null>(null)
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParseAndRender = async () => {
    try {
      const result = parser.parse(yamlContent)

      if (result.warnings && result.warnings.length > 0) {
        const errors = result.warnings.filter((w) => w.severity === 'error')
        if (errors.length > 0) {
          setError(`Parse errors: ${errors.map((e) => e.message).join(', ')}`)
          setNetworkGraph(null)
          setLayoutResult(null)
          setSvgContent(null)
          return
        }
      }

      setNetworkGraph(result.graph)

      const layout = new HierarchicalLayout()
      const layoutRes = await layout.layoutAsync(result.graph)
      setLayoutResult(layoutRes)

      const renderer = new SVGRenderer({
        backgroundColor: '#ffffff',
      })
      const svg = renderer.render(result.graph, layoutRes)
      setSvgContent(svg)
      setError(null)
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleExportSVG = () => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-diagram-${new Date().toISOString().slice(0, 10)}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpenSVG = () => {
    if (!svgContent) return
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Network Diagram</title>
            <style>
              body { margin: 0; background: #f0f4f8; padding: 20px; min-height: 100vh; }
              .container { background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">${svgContent}</div>
          </body>
        </html>
      `)
      win.document.close()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Shumoku Playground</h1>
        </div>
        <p>Network Topology Visualization</p>
      </header>

      <div className="controls">
        <div className="control-group">
          <label>Sample:</label>
          <select
            onChange={(e) => {
              if (e.target.value === 'enterprise') setYamlContent(enterpriseNetwork)
              else if (e.target.value === 'simple') setYamlContent(simpleNetwork)
            }}
          >
            <option value="enterprise">Enterprise Network</option>
            <option value="simple">Simple Network</option>
          </select>
        </div>

        <button onClick={handleParseAndRender} className="parse-button">
          Render
        </button>

        <button onClick={handleOpenSVG} className="export-button" disabled={!svgContent}>
          Open SVG
        </button>

        <button onClick={handleExportSVG} className="export-button" disabled={!svgContent}>
          Download SVG
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="content">
        <div className="editor-section">
          <h3>YAML</h3>
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className="yaml-editor"
            spellCheck={false}
          />
        </div>

        <div className="result-section">
          <div className="canvas-container">
            <NetworkSVG
              network={networkGraph}
              layout={layoutResult}
              svgContent={svgContent}
              onNodeClick={(nodeId) => console.log('Node clicked:', nodeId)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
