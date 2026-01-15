/**
 * Tooltip Module
 * Handles tooltip creation, positioning, and display
 */

let tooltip: HTMLDivElement | null = null

export function getTooltip(): HTMLDivElement {
  if (!tooltip) {
    tooltip = document.createElement('div')
    tooltip.style.cssText = `
      position: fixed;
      z-index: 10000;
      padding: 8px 12px;
      background: rgba(30, 41, 59, 0.95);
      color: #fff;
      font-size: 13px;
      line-height: 1.4;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 280px;
      white-space: pre-line;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `
    document.body.appendChild(tooltip)
  }
  return tooltip
}

export function showTooltip(text: string, x: number, y: number): void {
  const t = getTooltip()
  t.textContent = text
  t.style.opacity = '1'

  requestAnimationFrame(() => {
    const rect = t.getBoundingClientRect()
    const pad = 12
    let left = x + pad
    let top = y - rect.height - pad

    if (left + rect.width > window.innerWidth - pad) {
      left = x - rect.width - pad
    }
    if (top < pad) {
      top = y + pad
    }

    t.style.left = `${Math.max(pad, left)}px`
    t.style.top = `${Math.max(pad, top)}px`
  })
}

export function hideTooltip(): void {
  if (tooltip) {
    tooltip.style.opacity = '0'
  }
}

export function destroyTooltip(): void {
  if (tooltip) {
    tooltip.remove()
    tooltip = null
  }
}

export interface TooltipInfo {
  text: string
  element: Element
}

export function getTooltipInfo(el: Element): TooltipInfo | null {
  const port = el.closest('.port[data-port]')
  if (port) {
    const portId = port.getAttribute('data-port') || ''
    const deviceId = port.getAttribute('data-port-device') || ''
    return { text: `${deviceId}:${portId}`, element: port }
  }

  const linkGroup = el.closest('.link-group[data-link-id]')
  if (linkGroup) {
    const from = linkGroup.getAttribute('data-link-from') || ''
    const to = linkGroup.getAttribute('data-link-to') || ''
    const bw = linkGroup.getAttribute('data-link-bandwidth')
    const vlan = linkGroup.getAttribute('data-link-vlan')
    const jsonAttr = linkGroup.getAttribute('data-link-json')

    // For export links, show device:port ↔ destination device:port
    const fromIsExport = from.startsWith('__export_')
    const toIsExport = to.startsWith('__export_')
    if ((fromIsExport || toIsExport) && jsonAttr) {
      try {
        const linkData = JSON.parse(jsonAttr)
        const meta = linkData.metadata
        if (meta?._destDevice) {
          // Get the actual device endpoint (non-export side)
          const localDevice = fromIsExport ? to : from
          // Get the destination device:port from metadata
          const destDevice = meta._destPort
            ? `${meta._destDevice}:${meta._destPort}`
            : meta._destDevice
          // Show: "local device ↔ remote device"
          let text = `${localDevice} ↔ ${destDevice}`
          if (bw) text += `\n${bw}`
          if (vlan) text += `\nVLAN: ${vlan}`
          return { text, element: linkGroup }
        }
      } catch {
        // Fall through to default display
      }
    }

    let text = `${from} ↔ ${to}`
    if (bw) text += `\n${bw}`
    if (vlan) text += `\nVLAN: ${vlan}`
    return { text, element: linkGroup }
  }

  const node = el.closest('.node[data-id]')
  if (node) {
    const json = node.getAttribute('data-device-json')
    if (json) {
      try {
        const data = JSON.parse(json)
        const lines: string[] = []
        if (data.label) lines.push(Array.isArray(data.label) ? data.label.join(' ') : data.label)
        if (data.type) lines.push(`Type: ${data.type}`)
        if (data.vendor) lines.push(`Vendor: ${data.vendor}`)
        if (data.model) lines.push(`Model: ${data.model}`)
        return { text: lines.join('\n'), element: node }
      } catch {
        // fallthrough
      }
    }
    return { text: node.getAttribute('data-id') || '', element: node }
  }

  return null
}
