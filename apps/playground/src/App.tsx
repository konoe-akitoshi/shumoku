import { useState } from 'react'
import { themes, applyThemeToCSS } from '@shumoku/core'
import { v2 as modelsV2 } from '@shumoku/core/models'
import { layoutV2 } from '@shumoku/core/layout'
import { rendererV2 } from '@shumoku/core/renderer'
import { parserV2 } from '@shumoku/parser-yaml'
import NetworkSVG from './components/NetworkSVG'
import { sreNextNetwork, simpleTestV2 } from './sampleNetworksV2'
import './App.css'

type NetworkGraphV2 = modelsV2.NetworkGraphV2
type LayoutResult = modelsV2.LayoutResult

function App() {
  const [yamlContent, setYamlContent] = useState<string>(sreNextNetwork)
  const [networkGraph, setNetworkGraph] = useState<NetworkGraphV2 | null>(null)
  const [theme, setTheme] = useState<'modern' | 'dark'>('modern')
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParseAndRender = async () => {
    try {
      // Parse YAML
      const result = parserV2.parse(yamlContent)

      if (result.warnings && result.warnings.length > 0) {
        const errors = result.warnings.filter((w) => w.severity === 'error')
        if (errors.length > 0) {
          setError(`Parse errors: ${errors.map((e) => e.message).join(', ')}`)
          setNetworkGraph(null)
          setLayoutResult(null)
          setSvgContent(null)
          return
        }
        console.log('Parse warnings:', result.warnings.map((w) => w.message).join(', '))
      }

      setNetworkGraph(result.graph)
      console.log('Parsed network:', result.graph)

      // Layout (async with ELK.js)
      // Don't pass settings here - let the layout engine read from graph.settings
      // This allows canvas-aware spacing adjustments
      const layout = new layoutV2.HierarchicalLayoutV2()
      const layoutRes = await layout.layoutAsync(result.graph)
      setLayoutResult(layoutRes)
      console.log('Layout result:', layoutRes)

      // Render SVG
      const renderer = new rendererV2.SVGRendererV2({
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
      })
      const svg = renderer.render(result.graph, layoutRes)
      setSvgContent(svg)

      setError(null)
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
      console.error(e)
    }
  }

  const handleThemeChange = (newTheme: 'modern' | 'dark') => {
    setTheme(newTheme)
    applyThemeToCSS(themes[newTheme])

    // Re-render with new theme
    if (networkGraph && layoutResult) {
      const renderer = new rendererV2.SVGRendererV2({
        backgroundColor: newTheme === 'dark' ? '#0f172a' : '#ffffff',
      })
      const svg = renderer.render(networkGraph, layoutResult)
      setSvgContent(svg)
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
        <html>
          <head>
            <title>Network Diagram (SVG)</title>
            <style>
              body {
                margin: 0;
                background: ${theme === 'dark' ? '#1e293b' : '#f0f4f8'};
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
                box-sizing: border-box;
              }
              .container {
                max-width: 95vw;
                max-height: 95vh;
                overflow: auto;
                border: 1px solid #ccc;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                background: white;
                border-radius: 8px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${svgContent}
            </div>
          </body>
        </html>
      `)
    }
  }

  const handleExportPNG = async () => {
    if (!svgContent || !layoutResult) return

    // Create canvas and draw SVG
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = layoutResult.bounds.width * scale
    canvas.height = layoutResult.bounds.height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create image from SVG
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()

    img.onload = () => {
      ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = pngUrl
            a.download = `network-diagram-${new Date().toISOString().slice(0, 10)}.png`
            a.click()
            URL.revokeObjectURL(pngUrl)
          }
        },
        'image/png',
        1.0,
      )
      URL.revokeObjectURL(url)
    }

    img.src = url
  }

  return (
    <div className="app">
      <header className="header">
        <h1>shumoku v2 Playground</h1>
        <p>Mermaid-like Network Topology Visualization</p>
      </header>

      <div className="controls">
        <div className="control-group">
          <label>Sample:</label>
          <select
            onChange={(e) => {
              const sample = e.target.value
              if (sample === 'sre-next') {
                setYamlContent(sreNextNetwork)
              } else if (sample === 'simple') {
                setYamlContent(simpleTestV2)
              }
            }}
          >
            <option value="sre-next">SRE NEXT Network</option>
            <option value="simple">Simple Test</option>
          </select>
        </div>

        <div className="control-group">
          <label>Theme:</label>
          <select
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as 'modern' | 'dark')}
          >
            <option value="modern">Modern (Light)</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <button onClick={handleParseAndRender} className="parse-button">
          Render Diagram
        </button>

        <button onClick={handleOpenSVG} className="export-button" disabled={!svgContent}>
          Open as SVG
        </button>

        <button onClick={handleExportSVG} className="export-button" disabled={!svgContent}>
          Save as SVG
        </button>

        <button onClick={handleExportPNG} className="export-button" disabled={!svgContent}>
          Save as PNG
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {svgContent && (
        <div
          className="info"
          style={{
            padding: '0.5rem 2rem',
            background: 'var(--shumoku-info-bg, #e0f2fe)',
            color: 'var(--shumoku-info, #0369a1)',
            fontSize: '0.875rem',
          }}
        >
          <strong>操作方法:</strong> マウスホイールで拡大・縮小 | ドラッグで移動 |
          「Open as SVG」で新しいウィンドウで大きく表示
        </div>
      )}

      <div className="content">
        <div className="editor-section">
          <h3>YAML Input (v2 Format)</h3>
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className="yaml-editor"
            rows={20}
            placeholder="Enter your network YAML definition here..."
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

          {networkGraph && (
            <div className="result">
              <h3>Parsed Network</h3>
              <pre style={{ maxHeight: '300px', overflow: 'auto' }}>
                {JSON.stringify(networkGraph, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
