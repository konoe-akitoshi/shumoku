import type { NetworkGraph, LayoutResult, Theme } from '@shumoku/core'

// XMLエスケープ関数
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function exportToSVG(
  network: NetworkGraph,
  layout: LayoutResult,
  theme: Theme,
  width: number = 1920,
  height: number = 1080,
): string {
  // SVGヘッダー
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${layout.bounds.x - 50} ${layout.bounds.y - 50} ${layout.bounds.width + 100} ${layout.bounds.height + 100}" 
     xmlns="http://www.w3.org/2000/svg">
  
  <!-- 背景 -->
  <rect x="${layout.bounds.x - 50}" y="${layout.bounds.y - 50}" 
        width="${layout.bounds.width + 100}" height="${layout.bounds.height + 100}" 
        fill="${theme.colors.background}" />
  
  <!-- スタイル定義 -->
  <defs>
    <style>
      .device-label { 
        font-family: Arial, sans-serif; 
        font-size: 14px; 
        fill: ${theme.colors.text};
        text-anchor: middle;
      }
      .ip-label { 
        font-family: Consolas, monospace; 
        font-size: 12px; 
        fill: ${theme.colors.textSecondary};
        text-anchor: middle;
      }
      .port-label { 
        font-family: Consolas, monospace; 
        font-size: 10px; 
        fill: ${theme.colors.textSecondary};
        text-anchor: middle;
      }
      .bandwidth-label {
        font-family: Consolas, monospace; 
        font-size: 12px; 
        fill: ${theme.colors.text};
        font-weight: bold;
        text-anchor: middle;
      }
    </style>
  </defs>
  
  <!-- モジュール -->
  <g id="modules">`

  // モジュールを描画
  if (layout.modules) {
    layout.modules.forEach((module) => {
      if (module.bounds) {
        svg += `
    <g id="module-${module.id}">
      <rect x="${module.bounds.x - 20}" y="${module.bounds.y - 20}" 
            width="${module.bounds.width + 40}" height="${module.bounds.height + 40}"
            fill="${theme.colors.surface}" fill-opacity="0.5"
            stroke="${theme.colors.grid}" stroke-width="2" stroke-opacity="0.8"
            rx="${theme.dimensions.radius.medium}" />
      <text x="${module.bounds.x}" y="${module.bounds.y - 30}" 
            style="font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; fill: ${theme.colors.text};">
        ${escapeXML(module.data?.name || module.id)}
      </text>
    </g>`
      }
    })
  }

  svg += `
  </g>
  
  <!-- リンク -->
  <g id="links">`

  // リンクを描画
  network.links.forEach((link) => {
    const edge = layout.edges.get(link.id)
    const sourceNode = layout.nodes.get(link.source.deviceId)
    const targetNode = layout.nodes.get(link.target.deviceId)

    if (edge && sourceNode && targetNode) {
      const lineWidth = link.bandwidth?.includes('40G')
        ? 5
        : link.bandwidth?.includes('10G')
          ? 4
          : link.bandwidth?.includes('1G')
            ? 3
            : 2

      svg += `
    <g id="link-${link.id}">
      <line x1="${sourceNode.position.x}" y1="${sourceNode.position.y}" 
            x2="${targetNode.position.x}" y2="${targetNode.position.y}"
            stroke="${theme.colors.link}" stroke-width="${lineWidth}" opacity="0.8" />`

      // 帯域幅ラベル
      if (link.bandwidth) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2
        const midY = (sourceNode.position.y + targetNode.position.y) / 2
        svg += `
      <rect x="${midX - 25}" y="${midY - 10}" width="50" height="20" 
            fill="${theme.colors.background}" fill-opacity="0.9" rx="4" />
      <text x="${midX}" y="${midY + 5}" class="bandwidth-label">
        ${escapeXML(link.bandwidth)}
      </text>`
      }

      // ポートラベル
      if (link.source.portId) {
        svg += `
      <text x="${sourceNode.position.x}" y="${sourceNode.position.y + 45}" class="port-label">
        ${escapeXML(link.source.portId)}
      </text>`
      }

      if (link.target.portId) {
        svg += `
      <text x="${targetNode.position.x}" y="${targetNode.position.y - 35}" class="port-label">
        ${escapeXML(link.target.portId)}
      </text>`
      }

      svg += `
    </g>`
    }
  })

  svg += `
  </g>
  
  <!-- デバイス -->
  <g id="devices">`

  // デバイスを描画
  network.devices.forEach((device) => {
    const node = layout.nodes.get(device.id)
    if (!node) return

    const size = node.size || { width: 120, height: 80 }
    const deviceColor = theme.colors.devices[device.type] || theme.colors.primary

    svg += `
    <g id="device-${device.id}">
      <rect x="${node.position.x - size.width / 2}" y="${node.position.y - size.height / 2}" 
            width="${size.width}" height="${size.height}"
            fill="${deviceColor}" stroke="${theme.colors.grid}" stroke-width="2"
            rx="${theme.dimensions.radius.small}" />
      <text x="${node.position.x}" y="${node.position.y + 5}" class="device-label">
        ${escapeXML(device.name)}
      </text>`

    // IPアドレス
    if (device.metadata?.ip) {
      svg += `
      <text x="${node.position.x}" y="${node.position.y + 20}" class="ip-label">
        ${escapeXML(String(device.metadata.ip))}
      </text>`
    }

    // VLAN
    if (device.metadata?.vlan) {
      svg += `
      <text x="${node.position.x}" y="${node.position.y + 35}" class="ip-label">
        VLAN: ${escapeXML(String(device.metadata.vlan))}
      </text>`
    }

    svg += `
    </g>`
  })

  svg += `
  </g>
</svg>`

  return svg
}

export function downloadSVG(svgString: string, filename: string = 'network-diagram.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function openSVGInNewWindow(svgString: string) {
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(`
      <html>
        <head>
          <title>Network Diagram (SVG)</title>
          <style>
            body { 
              margin: 0; 
              background: #f0f0f0; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh;
            }
            svg { 
              max-width: 95vw; 
              max-height: 95vh; 
              border: 1px solid #ccc; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              background: white;
            }
          </style>
        </head>
        <body>
          ${svgString}
        </body>
      </html>
    `)
  }
}
