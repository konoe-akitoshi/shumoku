import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { LogoSvg } from '@/lib/og-brand'

export const revalidate = false

const colors = {
  background: '#0a0a0a',
  primary: '#13ae67',
  text: '#ffffff',
} as const

const size = { width: 1200, height: 630 } as const

async function loadDiagramImage() {
  const imgPath = join(process.cwd(), 'public', 'hero-diagram.png')
  const imgBuffer = await readFile(imgPath)
  return `data:image/png;base64,${imgBuffer.toString('base64')}`
}

export async function GET() {
  const diagramUrl = await loadDiagramImage()

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: colors.background,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 80% -20%, rgba(16, 185, 129, 0.25), transparent 60%)',
        }}
      />

      {/* Text content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 0 60px 80px',
          flex: 1,
          zIndex: 10,
        }}
      >
        <LogoSvg size={80} />
        <h1
          style={{
            color: colors.text,
            fontSize: 64,
            fontWeight: 700,
            marginTop: 24,
            marginBottom: 12,
            lineHeight: 1,
          }}
        >
          Shumoku
        </h1>
        <p style={{ color: colors.primary, fontSize: 28, fontWeight: 500, margin: 0 }}>
          Network diagrams, as code.
        </p>
      </div>

      {/* Diagram preview */}
      <div
        style={{
          position: 'absolute',
          right: 40,
          top: 60,
          display: 'flex',
          borderRadius: '16px 16px 0 0',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          overflow: 'hidden',
          boxShadow: '0 -10px 50px -12px rgba(0, 0, 0, 0.5)',
          paddingTop: 20,
          background: '#ffffff',
        }}
      >
        <img src={diagramUrl} width={480} />
      </div>
    </div>,
    size,
  )
}
