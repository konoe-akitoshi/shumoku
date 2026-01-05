import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Application } from 'pixi.js'
import type { NetworkGraph, LayoutResult, Theme, LayoutNode } from '@shumoku/core'
import { DeviceType } from '@shumoku/core'

interface NetworkCanvasProps {
  network: NetworkGraph | null
  layout: LayoutResult | null
  theme: Theme
  onNodeClick?: (nodeId: string) => void
  onNodeHover?: (nodeId: string | null) => void
  zoom?: number
}

// Convert hex color string to number
const colorToNumber = (color: string): number => {
  return parseInt(color.replace('#', ''), 16)
}

// Device type to shape mapping
const getDeviceShape = (type: DeviceType): 'rect' | 'circle' | 'hexagon' => {
  switch (type) {
    case DeviceType.Router:
    case DeviceType.Firewall:
      return 'rect'
    case DeviceType.Server:
    case DeviceType.VirtualMachine:
      return 'circle'
    default:
      return 'rect'
  }
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  network,
  layout,
  theme,
  onNodeClick,
  onNodeHover,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Initialize PixiJS application
  useEffect(() => {
    if (!containerRef.current) return

    let app: Application | null = null

    // Create PixiJS application using v8 API
    const initApp = async () => {
      app = new Application()

      await app.init({
        width: containerRef.current!.offsetWidth,
        height: containerRef.current!.offsetHeight,
        backgroundColor: colorToNumber(theme.colors.background),
        backgroundAlpha: 1,
        antialias: true,
        resolution: window.devicePixelRatio || 2,
        autoDensity: true,
        preserveDrawingBuffer: true, // 重要：描画バッファを保持
      })

      // Add canvas to container
      containerRef.current!.appendChild(app.canvas)
      appRef.current = app

      // グローバルに参照を保存（エクスポート用）
      ;(window as any).__PIXI_APP__ = app

      // Handle resize
      const handleResize = () => {
        if (containerRef.current && app) {
          app.renderer.resize(containerRef.current.offsetWidth, containerRef.current.offsetHeight)
        }
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    const cleanupPromise = initApp()

    return () => {
      cleanupPromise.then((cleanup) => {
        cleanup?.()
        if (app) {
          app.destroy(true, { children: true, texture: true })
          appRef.current = null
        }
      })
    }
  }, [theme])

  // Render network
  useEffect(() => {
    const app = appRef.current
    if (!app || !network || !layout) return

    // Clear stage
    app.stage.removeChildren()

    // Create containers for different layers
    const moduleContainer = new PIXI.Container()
    const linkContainer = new PIXI.Container()
    const deviceContainer = new PIXI.Container()

    // モジュール → リンク → デバイスの順で追加（リンクがデバイスの下に来るように）
    app.stage.addChild(moduleContainer)
    app.stage.addChild(linkContainer)
    app.stage.addChild(deviceContainer)

    console.log('Containers added to stage')

    // Create a map of device positions from layout nodes
    const devicePositions = new Map<string, { x: number; y: number }>()
    const deviceNodes = new Map<string, LayoutNode>()
    layout.nodes.forEach((layoutNode) => {
      devicePositions.set(layoutNode.id, {
        x: layoutNode.position.x,
        y: layoutNode.position.y,
      })
      deviceNodes.set(layoutNode.id, layoutNode)
    })

    // Draw modules
    if (network.modules && layout.modules) {
      network.modules.forEach((module) => {
        const layoutModule = layout.modules?.get(module.id)
        if (!layoutModule?.bounds) return

        const graphics = new PIXI.Graphics()
        const { x, y, width, height } = layoutModule.bounds
        const padding = 20

        // Module background
        graphics.beginFill(colorToNumber(theme.colors.surface), 0.5)
        graphics.lineStyle(2, colorToNumber(theme.colors.grid), 0.8)
        graphics.drawRoundedRect(
          x - padding,
          y - padding,
          width + padding * 2,
          height + padding * 2,
          theme.dimensions.radius.medium,
        )
        graphics.endFill()

        moduleContainer.addChild(graphics)

        // Module label
        const labelStyle = new PIXI.TextStyle({
          fontFamily: theme.typography.fontFamily.sans,
          fontSize: theme.dimensions.fontSize.large,
          fontWeight: String(theme.typography.fontWeight.semibold) as PIXI.TextStyleFontWeight,
          fill: colorToNumber(theme.colors.text),
        })

        const label = new PIXI.Text(module.name, labelStyle)
        label.x = x
        label.y = y - 30

        moduleContainer.addChild(label)
      })
    }

    // Draw links - シンプルな直線描画に戻す
    network.links.forEach((link) => {
      const sourcePos = devicePositions.get(link.source.deviceId)
      const targetPos = devicePositions.get(link.target.deviceId)

      if (!sourcePos || !targetPos) {
        console.warn(`Missing position for link ${link.id}`)
        return
      }

      const graphics = new PIXI.Graphics()

      // 線のスタイルを設定（帯域幅に応じた太さ）
      const lineWidth = link.bandwidth?.includes('40G')
        ? 6
        : link.bandwidth?.includes('10G')
          ? 5
          : link.bandwidth?.includes('1G')
            ? 4
            : 3

      // 濃い青色の線を描画（より見やすく）
      graphics.lineStyle(lineWidth, 0x2563eb, 1)
      graphics.moveTo(sourcePos.x, sourcePos.y)
      graphics.lineTo(targetPos.x, targetPos.y)

      // デバッグ用：線の端点を表示
      graphics.beginFill(0x2563eb)
      graphics.drawCircle(sourcePos.x, sourcePos.y, 3)
      graphics.drawCircle(targetPos.x, targetPos.y, 3)
      graphics.endFill()

      linkContainer.addChild(graphics)

      // ポートとラベルの表示
      if (sourcePos && targetPos) {
        // Port labels at connection endpoints
        if (link.source.portId) {
          const portStyle = new PIXI.TextStyle({
            fontFamily: theme.typography.fontFamily.mono,
            fontSize: theme.dimensions.fontSize.tiny,
            fill: colorToNumber(theme.colors.textSecondary),
          })

          const sourcePortLabel = new PIXI.Text(link.source.portId, portStyle)
          sourcePortLabel.x = sourcePos.x
          sourcePortLabel.y = sourcePos.y + 40
          sourcePortLabel.anchor.set(0.5)

          linkContainer.addChild(sourcePortLabel)
        }

        if (link.target.portId) {
          const portStyle = new PIXI.TextStyle({
            fontFamily: theme.typography.fontFamily.mono,
            fontSize: theme.dimensions.fontSize.tiny,
            fill: colorToNumber(theme.colors.textSecondary),
          })

          const targetPortLabel = new PIXI.Text(link.target.portId, portStyle)
          targetPortLabel.x = targetPos.x
          targetPortLabel.y = targetPos.y - 40
          targetPortLabel.anchor.set(0.5)

          linkContainer.addChild(targetPortLabel)
        }

        // Bandwidth label (if available)
        if (link.bandwidth) {
          const labelStyle = new PIXI.TextStyle({
            fontFamily: theme.typography.fontFamily.mono,
            fontSize: theme.dimensions.fontSize.small,
            fill: colorToNumber(theme.colors.text),
            fontWeight: 'bold',
          })

          const label = new PIXI.Text(link.bandwidth, labelStyle)
          label.x = (sourcePos.x + targetPos.x) / 2
          label.y = (sourcePos.y + targetPos.y) / 2
          label.anchor.set(0.5)

          // 背景を追加して見やすくする
          const bg = new PIXI.Graphics()
          bg.beginFill(colorToNumber(theme.colors.background), 0.9)
          bg.drawRoundedRect(-25, -10, 50, 20, 4)
          bg.endFill()
          bg.x = label.x
          bg.y = label.y

          linkContainer.addChild(bg)
          linkContainer.addChild(label)
        }
      }
    })

    // Draw devices
    network.devices.forEach((device) => {
      const pos = devicePositions.get(device.id)
      if (!pos) return

      const container = new PIXI.Container()
      container.x = pos.x
      container.y = pos.y
      container.interactive = true
      container.cursor = 'pointer'

      const graphics = new PIXI.Graphics()
      const shape = getDeviceShape(device.type)
      // レイアウトノードからサイズを取得、なければデフォルトサイズを使用
      const layoutNode = deviceNodes.get(device.id)
      const size = layoutNode?.size || { width: 120, height: 80 }
      const deviceColor =
        theme.colors.devices[device.type] || theme.colors.modules.default || theme.colors.primary
      const isHovered = hoveredNode === device.id

      // Draw shadow if hovered
      if (isHovered) {
        graphics.beginFill(0x000000, 0.1)
        if (shape === 'rect') {
          graphics.drawRect(-size.width / 2 + 2, -size.height / 2 + 2, size.width, size.height)
        } else if (shape === 'circle') {
          graphics.drawCircle(2, 2, size.width / 2)
        }
        graphics.endFill()
      }

      // Draw device shape
      graphics.beginFill(colorToNumber(deviceColor))
      graphics.lineStyle(
        theme.dimensions.lineWidth.normal,
        isHovered ? 0xffffff : colorToNumber(theme.colors.grid),
        isHovered ? 0.8 : 0.3,
      )

      if (shape === 'rect') {
        graphics.drawRect(-size.width / 2, -size.height / 2, size.width, size.height)
      } else if (shape === 'circle') {
        graphics.drawCircle(0, 0, size.width / 2)
      } else if (shape === 'hexagon') {
        const radius = size.width / 2
        const angle = Math.PI / 3
        graphics.moveTo(radius * Math.cos(0), radius * Math.sin(0))
        for (let i = 1; i <= 6; i++) {
          graphics.lineTo(radius * Math.cos(angle * i), radius * Math.sin(angle * i))
        }
        graphics.closePath()
      }

      graphics.endFill()
      container.addChild(graphics)

      // Device name label
      const labelStyle = new PIXI.TextStyle({
        fontFamily: theme.typography.fontFamily.sans,
        fontSize: 16,
        fill: colorToNumber(theme.colors.text),
        align: 'center',
        fontWeight: 'normal',
        dropShadow: false,
        letterSpacing: 0,
      })

      const label = new PIXI.Text(device.name, labelStyle)
      label.anchor.set(0.5)
      label.y = size.height / 2 + 10

      container.addChild(label)

      // IP address label (if available)
      if (device.metadata?.ip) {
        const ipStyle = new PIXI.TextStyle({
          fontFamily: theme.typography.fontFamily.mono,
          fontSize: 12,
          fill: colorToNumber(theme.colors.textSecondary),
          align: 'center',
          fontWeight: 'normal',
        })

        const ipLabel = new PIXI.Text(device.metadata.ip as string, ipStyle)
        ipLabel.anchor.set(0.5)
        ipLabel.y = size.height / 2 + 25

        container.addChild(ipLabel)
      }

      // VLAN label (if available)
      if (device.metadata?.vlan) {
        const vlanStyle = new PIXI.TextStyle({
          fontFamily: theme.typography.fontFamily.mono,
          fontSize: 10,
          fill: colorToNumber(theme.colors.textSecondary),
          align: 'center',
          fontWeight: 'normal',
        })

        const vlanLabel = new PIXI.Text(`VLAN: ${device.metadata.vlan}`, vlanStyle)
        vlanLabel.anchor.set(0.5)
        vlanLabel.y = size.height / 2 + 40

        container.addChild(vlanLabel)
      }

      // Add interactivity
      container.on('pointerover', () => {
        setHoveredNode(device.id)
        onNodeHover?.(device.id)
      })

      container.on('pointerout', () => {
        setHoveredNode(null)
        onNodeHover?.(null)
      })

      container.on('pointerdown', () => {
        onNodeClick?.(device.id)
      })

      deviceContainer.addChild(container)
    })

    // レイアウトの境界を使用してセンタリング
    if (layout.bounds) {
      const padding = 100
      const scaleX = (app.screen.width - padding * 2) / layout.bounds.width
      const scaleY = (app.screen.height - padding * 2) / layout.bounds.height
      const initialScale = Math.min(scaleX, scaleY, 1) // 初期スケールを調整

      app.stage.scale.set(initialScale)

      // 中央配置の改善
      const centerX = layout.bounds.x + layout.bounds.width / 2
      const centerY = layout.bounds.y + layout.bounds.height / 2

      app.stage.x = app.screen.width / 2 - centerX * initialScale
      app.stage.y = app.screen.height / 2 - centerY * initialScale

      // マウスホイールでズーム
      app.canvas.addEventListener('wheel', (e) => {
        e.preventDefault()
        const delta = e.deltaY * -0.001
        const newScale = Math.min(Math.max(0.1, app.stage.scale.x + delta), 5)

        // マウス位置を中心にズーム
        const mouseX = e.offsetX
        const mouseY = e.offsetY

        const worldPos = {
          x: (mouseX - app.stage.x) / app.stage.scale.x,
          y: (mouseY - app.stage.y) / app.stage.scale.y,
        }

        app.stage.scale.set(newScale)

        app.stage.x = mouseX - worldPos.x * newScale
        app.stage.y = mouseY - worldPos.y * newScale
      })

      // ドラッグでパン
      let isDragging = false
      let dragStart = { x: 0, y: 0 }
      let stageStart = { x: 0, y: 0 }

      app.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          // 左クリック
          isDragging = true
          dragStart = { x: e.clientX, y: e.clientY }
          stageStart = { x: app.stage.x, y: app.stage.y }
          app.canvas.style.cursor = 'grabbing'
        }
      })

      window.addEventListener('mousemove', (e) => {
        if (isDragging) {
          app.stage.x = stageStart.x + (e.clientX - dragStart.x)
          app.stage.y = stageStart.y + (e.clientY - dragStart.y)
        }
      })

      window.addEventListener('mouseup', () => {
        isDragging = false
        app.canvas.style.cursor = 'grab'
      })

      // カーソルスタイルの設定
      app.canvas.style.cursor = 'grab'
    }
  }, [network, layout, theme, hoveredNode, onNodeClick, onNodeHover])

  if (!network || !layout) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <div className="placeholder">
          <p>No network data to display</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  )
}

export default NetworkCanvas
