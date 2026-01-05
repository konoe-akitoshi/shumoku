import { useState } from 'react'
import {
  type NetworkGraph,
  type LayoutResult,
  layoutEngineFactory,
  themes,
  applyThemeToCSS,
  exportNetworkToSVG,
} from '@shumoku/core'
import { YamlParser } from '@shumoku/parser-yaml'
import NetworkCanvas from './components/NetworkCanvas'
import './App.css'

// Sample YAML network definition - Enterprise Hybrid Cloud Network
const sampleYaml = `name: Enterprise Hybrid Cloud Network
version: 2.0.0
description: "Large-scale enterprise network with AWS cloud integration and dual ISP connectivity"

devices:
  # =======================================================================
  # External Connectivity Layer
  # =======================================================================
  
  # ISP / Internet Exchange
  - id: ISP1-Router
    name: "ISP1-Router"
    type: router
    role: edge
    metadata:
      ip: "203.0.113.1"
      asn: "64998"
      provider: "OCN"
      location: "Tokyo IX"
  
  - id: ISP2-Router
    name: "ISP2-Router"
    type: router
    role: edge
    metadata:
      ip: "198.51.100.1"
      asn: "64999"
      provider: "IIJ"
      location: "Tokyo IX"

  # AWS Cloud Infrastructure
  - id: AWS-VGW
    name: "AWS-VGW-Tokyo"
    type: cloud
    role: edge
    metadata:
      ip: "172.16.0.1"
      asn: "64512"
      region: "ap-northeast-1"
      vpc_id: "vpc-12345678"

  # =======================================================================
  # Core Network Layer
  # =======================================================================
  
  # Edge Routers (BGP)
  - id: RTX3510-1
    name: "RTX3510-1"
    type: router
    role: core
    metadata:
      ip: "192.168.0.1"
      asn: "65000"
      location: "DC-01 Rack A1"
      
  - id: RTX3510-2
    name: "RTX3510-2"
    type: router
    role: core
    metadata:
      ip: "192.168.0.2"
      asn: "65000"
      location: "DC-01 Rack A2"

  # Core L3 Switches
  - id: Core-SW-01
    name: "Core-SW-01"
    type: l3-switch
    role: core
    metadata:
      ip: "10.0.0.1"
      location: "DC-01 Rack B1"
      model: "Catalyst 9500"
      
  - id: Core-SW-02
    name: "Core-SW-02"
    type: l3-switch
    role: core
    metadata:
      ip: "10.0.0.2"
      location: "DC-01 Rack B2"
      model: "Catalyst 9500"

  # Firewall Cluster
  - id: FW-01
    name: "FortiGate-800D-1"
    type: firewall
    role: core
    metadata:
      ip: "10.0.1.1"
      location: "DC-01 Rack C1"
      ha_state: "active"
      
  - id: FW-02
    name: "FortiGate-800D-2"
    type: firewall
    role: core
    metadata:
      ip: "10.0.1.2"
      location: "DC-01 Rack C2"
      ha_state: "standby"

  # =======================================================================
  # Distribution Layer
  # =======================================================================
  
  # Distribution Switches
  - id: Dist-SW-01
    name: "Dist-SW-01"
    type: l3-switch
    role: distribution
    metadata:
      ip: "10.1.0.1"
      vlan: "10,20,30,100"
      location: "Floor 2"
      
  - id: Dist-SW-02
    name: "Dist-SW-02"
    type: l3-switch
    role: distribution
    metadata:
      ip: "10.1.0.2"
      vlan: "10,20,30,100"
      location: "Floor 3"
      
  - id: Dist-SW-03
    name: "Dist-SW-03"
    type: l3-switch
    role: distribution
    metadata:
      ip: "10.1.0.3"
      vlan: "40,50,60,200"
      location: "Floor 4"

  # =======================================================================
  # Access Layer
  # =======================================================================
  
  # Access Switches
  - id: Access-SW-01
    name: "Access-SW-01"
    type: l2-switch
    role: access
    metadata:
      ip: "10.2.1.1"
      vlan: "10"
      location: "Floor 2 East"
      
  - id: Access-SW-02
    name: "Access-SW-02"
    type: l2-switch
    role: access
    metadata:
      ip: "10.2.1.2"
      vlan: "20"
      location: "Floor 2 West"
      
  - id: Access-SW-03
    name: "Access-SW-03"
    type: l2-switch
    role: access
    metadata:
      ip: "10.2.2.1"
      vlan: "10"
      location: "Floor 3 East"
      
  - id: Access-SW-04
    name: "Access-SW-04"
    type: l2-switch
    role: access
    metadata:
      ip: "10.2.2.2"
      vlan: "20"
      location: "Floor 3 West"

  # Wireless Access Points
  - id: AP-01
    name: "WiFi-AP-01"
    type: access-point
    role: access
    metadata:
      ip: "10.3.1.1"
      location: "Floor 2"
      ssid: "Corporate"
      
  - id: AP-02
    name: "WiFi-AP-02"
    type: access-point
    role: access
    metadata:
      ip: "10.3.2.1"
      location: "Floor 3"
      ssid: "Corporate"

  # =======================================================================
  # Server Infrastructure
  # =======================================================================
  
  # Physical Servers
  - id: Server-01
    name: "VMware-ESXi-01"
    type: server
    role: access
    metadata:
      ip: "10.10.1.10"
      location: "DC-01 Rack D1"
      
  - id: Server-02
    name: "VMware-ESXi-02"
    type: server
    role: access
    metadata:
      ip: "10.10.1.11"
      location: "DC-01 Rack D2"

modules:
  - id: external
    name: "External Connectivity"
    devices: [ISP1-Router, ISP2-Router, AWS-VGW]
    
  - id: edge
    name: "Edge & Security"
    devices: [RTX3510-1, RTX3510-2, FW-01, FW-02]
    
  - id: core
    name: "Core Layer"
    devices: [Core-SW-01, Core-SW-02]
    
  - id: distribution
    name: "Distribution Layer"
    devices: [Dist-SW-01, Dist-SW-02, Dist-SW-03]
    
  - id: access
    name: "Access Layer"
    devices: [Access-SW-01, Access-SW-02, Access-SW-03, Access-SW-04, AP-01, AP-02]
    
  - id: servers
    name: "Server Infrastructure"
    devices: [Server-01, Server-02]

links:
  # =======================================================================
  # External Connections
  # =======================================================================
  
  # ISP Connections (eBGP)
  - from: ISP1-Router:ge-0/0/0
    to: RTX3510-1:lan2
    bandwidth: "1G"
    type: physical
    metadata:
      protocol: "eBGP"
      local_asn: "65000"
      peer_asn: "64998"
      
  - from: ISP2-Router:ge-0/0/0
    to: RTX3510-2:lan2
    bandwidth: "1G"
    type: physical
    metadata:
      protocol: "eBGP"
      local_asn: "65000"
      peer_asn: "64999"

  # VPN to AWS
  - from: RTX3510-1:tunnel1
    to: AWS-VGW:tun1
    bandwidth: "500M"
    type: tunnel
    metadata:
      protocol: "IPsec"
      encryption: "AES256"

  # =======================================================================
  # Core Network Connections
  # =======================================================================
  
  # Router HA Link
  - from: RTX3510-1:lan3
    to: RTX3510-2:lan3
    bandwidth: "10G"
    type: physical
    metadata:
      protocol: "VRRP"
      
  # Router to Firewall
  - from: RTX3510-1:lan1
    to: FW-01:port1
    bandwidth: "10G"
    type: physical
    
  - from: RTX3510-2:lan1
    to: FW-02:port1
    bandwidth: "10G"
    type: physical

  # Firewall HA Link
  - from: FW-01:ha1
    to: FW-02:ha1
    bandwidth: "10G"
    type: physical
    metadata:
      protocol: "FortiGate HA"

  # Firewall to Core Switch
  - from: FW-01:port2
    to: Core-SW-01:Te1/0/1
    bandwidth: "10G"
    type: physical
    
  - from: FW-02:port2
    to: Core-SW-02:Te1/0/1
    bandwidth: "10G"
    type: physical

  # Core Switch Interconnect
  - from: Core-SW-01:Te1/0/48
    to: Core-SW-02:Te1/0/48
    bandwidth: "40G"
    type: physical
    metadata:
      protocol: "VSL"

  # =======================================================================
  # Core to Distribution
  # =======================================================================
  
  - from: Core-SW-01:Te1/0/2
    to: Dist-SW-01:Gi0/1
    bandwidth: "10G"
    type: physical
    
  - from: Core-SW-02:Te1/0/2
    to: Dist-SW-01:Gi0/2
    bandwidth: "10G"
    type: physical
    
  - from: Core-SW-01:Te1/0/3
    to: Dist-SW-02:Gi0/1
    bandwidth: "10G"
    type: physical
    
  - from: Core-SW-02:Te1/0/3
    to: Dist-SW-02:Gi0/2
    bandwidth: "10G"
    type: physical
    
  - from: Core-SW-01:Te1/0/4
    to: Dist-SW-03:Gi0/1
    bandwidth: "10G"
    type: physical

  # =======================================================================
  # Distribution to Access
  # =======================================================================
  
  - from: Dist-SW-01:Gi0/3
    to: Access-SW-01:Gi0/1
    bandwidth: "1G"
    type: physical
    
  - from: Dist-SW-01:Gi0/4
    to: Access-SW-02:Gi0/1
    bandwidth: "1G"
    type: physical
    
  - from: Dist-SW-02:Gi0/3
    to: Access-SW-03:Gi0/1
    bandwidth: "1G"
    type: physical
    
  - from: Dist-SW-02:Gi0/4
    to: Access-SW-04:Gi0/1
    bandwidth: "1G"
    type: physical

  # Access to APs
  - from: Access-SW-01:Gi0/10
    to: AP-01:eth0
    bandwidth: "1G"
    type: physical
    
  - from: Access-SW-03:Gi0/10
    to: AP-02:eth0
    bandwidth: "1G"
    type: physical

  # =======================================================================
  # Server Connections
  # =======================================================================
  
  - from: Core-SW-01:Te1/0/10
    to: Server-01:eth0
    bandwidth: "10G"
    type: physical
    
  - from: Core-SW-02:Te1/0/10
    to: Server-02:eth0
    bandwidth: "10G"
    type: physical

settings:
  layout: hierarchical
  theme: modern
`

function App() {
  const [yamlContent, setYamlContent] = useState<string>(sampleYaml)
  const [networkGraph, setNetworkGraph] = useState<NetworkGraph | null>(null)
  const [layoutType, setLayoutType] = useState<'hierarchical' | 'bento'>('hierarchical')
  const [theme, setTheme] = useState<'modern' | 'dark'>('modern')
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParseYaml = () => {
    try {
      const parser = new YamlParser()
      const result = parser.parse(yamlContent)

      if (result.warnings && result.warnings.length > 0) {
        const errors = result.warnings.filter((w) => w.severity === 'error')
        if (errors.length > 0) {
          setError(`Parse errors: ${errors.map((e) => e.message).join(', ')}`)
          setNetworkGraph(null)
        } else {
          // Only warnings, still use the graph
          setNetworkGraph(result.graph)
          setError(`Warnings: ${result.warnings.map((w) => w.message).join(', ')}`)
          console.log('Parsed network with warnings:', result.graph)
        }
      } else {
        setNetworkGraph(result.graph)
        setError(null)
        console.log('Parsed network:', result.graph)
      }
    } catch (e) {
      setError(`Error parsing YAML: ${e instanceof Error ? e.message : String(e)}`)
      setNetworkGraph(null)
    }
  }

  const handleLayout = async () => {
    if (!networkGraph) {
      setError('Please parse YAML first')
      return
    }

    try {
      const engine = layoutEngineFactory.create(layoutType)
      const result = await engine.layout(networkGraph)
      setLayoutResult(result)
      setError(null)
      console.log('Layout result:', result)

      // Debug: レイアウト結果の詳細を表示
      console.log('Layout nodes:')
      result.nodes.forEach((node, id) => {
        console.log(`  ${id}: x=${node.position.x}, y=${node.position.y}`)
      })
      console.log('Layout bounds:', result.bounds)
      console.log('Module count:', result.modules?.size || 0)
    } catch (e) {
      setError(`Layout error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleThemeChange = (newTheme: 'modern' | 'dark') => {
    setTheme(newTheme)
    applyThemeToCSS(themes[newTheme])
  }

  return (
    <div className="app">
      <header className="header">
        <h1>shumoku Playground</h1>
        <p>Network Topology Visualization from YAML</p>
      </header>

      <div className="controls">
        <div className="control-group">
          <label>Layout:</label>
          <select
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value as 'hierarchical' | 'bento')}
          >
            <option value="hierarchical">Hierarchical</option>
            <option value="bento">Bento Grid</option>
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

        <button onClick={handleParseYaml} className="parse-button">
          Parse YAML
        </button>

        <button onClick={handleLayout} className="layout-button" disabled={!networkGraph}>
          Generate Layout
        </button>

        <button
          onClick={() => {
            // PIXIアプリケーションの参照を取得
            const pixiApp = (window as any).__PIXI_APP__
            if (pixiApp) {
              // PIXIの内蔵エクスポート機能を使用
              pixiApp.renderer.extract.canvas(pixiApp.stage).toBlob(
                (blob: Blob | null) => {
                  if (blob) {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `network-diagram-${new Date().toISOString().slice(0, 10)}.png`
                    a.click()
                    URL.revokeObjectURL(url)
                  }
                },
                'image/png',
                1.0,
              )
            } else {
              // フォールバック：通常のキャンバス取得
              const canvas = document.querySelector('canvas') as HTMLCanvasElement
              if (canvas) {
                const scale = 2 // 2倍の解像度でエクスポート
                const newCanvas = document.createElement('canvas')
                newCanvas.width = canvas.width * scale
                newCanvas.height = canvas.height * scale
                const ctx = newCanvas.getContext('2d')

                if (ctx) {
                  ctx.scale(scale, scale)
                  ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#ffffff'
                  ctx.fillRect(0, 0, canvas.width, canvas.height)
                  ctx.drawImage(canvas, 0, 0)

                  newCanvas.toBlob(
                    (blob) => {
                      if (blob) {
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `network-diagram-${new Date().toISOString().slice(0, 10)}.png`
                        a.click()
                        URL.revokeObjectURL(url)
                      }
                    },
                    'image/png',
                    1.0,
                  )
                }
              }
            }
          }}
          className="export-button"
          disabled={!layoutResult}
        >
          Save as PNG (High Quality)
        </button>

        <button
          onClick={() => {
            if (networkGraph && layoutResult) {
              const svg = exportNetworkToSVG(networkGraph, layoutResult, themes[theme])
              const win = window.open('', '_blank')
              if (win) {
                win.document.write(`
                  <html>
                    <head><title>Network Diagram (SVG)</title></head>
                    <body style="margin:0;background:#f0f0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                      <div style="max-width:95vw;max-height:95vh;overflow:auto;border:1px solid #ccc;box-shadow:0 4px 6px rgba(0,0,0,0.1);background:white;">
                        ${svg}
                      </div>
                    </body>
                  </html>
                `)
              }
            }
          }}
          className="export-button"
          disabled={!layoutResult}
        >
          Open as SVG
        </button>

        <button
          onClick={() => {
            if (networkGraph && layoutResult) {
              const svg = exportNetworkToSVG(networkGraph, layoutResult, themes[theme])
              const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `network-diagram-${new Date().toISOString().slice(0, 10)}.svg`
              a.click()
              URL.revokeObjectURL(url)
            }
          }}
          className="export-button"
          disabled={!layoutResult}
        >
          Save as SVG
        </button>

        <button
          onClick={() => {
            const canvasContainer = document.querySelector('.canvas-container') as HTMLElement
            if (canvasContainer && canvasContainer.requestFullscreen) {
              canvasContainer.requestFullscreen()
            }
          }}
          className="export-button"
          disabled={!layoutResult}
        >
          Fullscreen
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {layoutResult && (
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
          ノードをクリックで選択 | 新しいウィンドウで開くまたはフルスクリーンで大きく表示
        </div>
      )}

      <div className="content">
        <div className="editor-section">
          <h3>YAML Input</h3>
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
            <NetworkCanvas
              network={networkGraph}
              layout={layoutResult}
              theme={themes[theme]}
              onNodeClick={(nodeId) => console.log('Node clicked:', nodeId)}
              onNodeHover={(nodeId) => console.log('Node hover:', nodeId)}
            />
          </div>

          {networkGraph && (
            <div className="result">
              <h3>Parsed Network</h3>
              <pre>{JSON.stringify(networkGraph, null, 2)}</pre>
            </div>
          )}

          {layoutResult && (
            <div className="result">
              <h3>Layout Result</h3>
              <pre>{JSON.stringify(layoutResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
