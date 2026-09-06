import { generateContent, type RenderResult } from './render'

export type Format = 'svg' | 'html' | 'png'

async function toPng(svg: string): Promise<Blob> {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = document.querySelector('svg')
  const bounds = root
    ?.getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const width = bounds?.[2] ?? 0
  const height = bounds?.[3] ?? 0
  if (!root || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid SVG dimensions')
  }
  // Responsive SVGs have no intrinsic pixel size. Rasterize from their viewBox,
  // not the browser's 300×150 fallback, with a bounded canvas for large diagrams.
  const scale = Math.min(2, 8192 / width, 8192 / height, Math.sqrt(16_000_000 / (width * height)))
  const pixelWidth = Math.max(1, Math.round(width * scale))
  const pixelHeight = Math.max(1, Math.round(height * scale))
  root.style.removeProperty('width')
  root.style.removeProperty('height')
  root.setAttribute('width', String(pixelWidth))
  root.setAttribute('height', String(pixelHeight))
  const images = Array.from(document.querySelectorAll('image'))
  await Promise.all(
    images.map(async (image) => {
      const url = image.getAttribute('href')
      if (!url || !/^https?:\/\//.test(url)) return
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Unable to load image for PNG: ${response.status}`)
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('Invalid image'))
        reader.onerror = () => reject(new Error('Unable to read image'))
        response.blob().then((blob) => reader.readAsDataURL(blob), reject)
      })
      image.setAttribute('href', data)
    }),
  )
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(document)], { type: 'image/svg+xml' }),
  )
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = window.document.createElement('canvas')
    canvas.width = pixelWidth
    canvas.height = pixelHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.fillStyle = '#f5f5f5'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))),
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportDiagram(
  result: RenderResult,
  format: Format,
  action: 'open' | 'download',
) {
  // Reserve the tab synchronously within the click to avoid popup blocking after await.
  const tab = action === 'open' ? window.open('about:blank', '_blank') : null
  if (action === 'open' && !tab) throw new Error('Allow popups to open the diagram')
  if (tab) tab.opener = null
  try {
    const content = await generateContent(result, format === 'png' ? 'svg' : format)
    const blob =
      format === 'png'
        ? await toPng(content)
        : new Blob([content], {
            type: format === 'svg' ? 'image/svg+xml;charset=utf-8' : 'text/html;charset=utf-8',
          })
    const url = URL.createObjectURL(blob)
    if (tab) tab.location.replace(url)
    else {
      const link = document.createElement('a')
      const name = (result.prepared.graph.name || 'network-diagram')
        .replace(/[^\p{L}\p{N}_-]+/gu, '-')
        .toLowerCase()
      link.href = url
      link.download = `${name}-${new Date().toISOString().slice(0, 10)}.${format}`
      link.click()
    }
    // Give the new document/download time to consume its URL before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    tab?.close()
    throw error
  }
}
