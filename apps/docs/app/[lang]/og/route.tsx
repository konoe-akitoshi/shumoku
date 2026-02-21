import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { LogoSvg } from '@/lib/og-brand'

export const revalidate = false

const colors = {
  background: '#0a0a0a',
  text: '#ffffff',
  muted: '#94a3b8',
} as const

const size = { width: 1200, height: 630 } as const

const ogText = {
  en: {
    line1: 'Topology you',
    line2: 'can trust.',
    sub1: 'Auto-generated from your',
    sub2: 'actual infrastructure.',
  },
  ja: {
    line1: '信頼できる',
    line2: '構成図を。',
    sub1: '実際のインフラから',
    sub2: '自動生成される構造基盤。',
  },
} as const

async function loadScreenshot() {
  const imgPath = join(process.cwd(), 'public', 'screenshots', 'topology.png')
  const imgBuffer = await readFile(imgPath)
  return `data:image/png;base64,${imgBuffer.toString('base64')}`
}

export async function GET(_req: Request, { params }: RouteContext<'/[lang]/og'>) {
  const { lang } = await params
  const t = ogText[lang as keyof typeof ogText] ?? ogText.en

  const screenshotUrl = await loadScreenshot()

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
          maxWidth: '50%',
        }}
      >
        <LogoSvg size={64} />
        <h1
          style={{
            color: colors.text,
            fontSize: 52,
            fontWeight: 700,
            marginTop: 20,
            marginBottom: 8,
            lineHeight: 1.1,
          }}
        >
          {t.line1}
          <br />
          {t.line2}
        </h1>
        <p style={{ color: colors.muted, fontSize: 22, fontWeight: 400, margin: 0, lineHeight: 1.5 }}>
          {t.sub1}
          <br />
          {t.sub2}
        </p>
      </div>

      {/* Screenshot preview — right half, bleeding off edge */}
      <div
        style={{
          position: 'absolute',
          right: -200,
          top: 80,
          display: 'flex',
          borderRadius: '16px 0 0 16px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRight: 'none',
          overflow: 'hidden',
          boxShadow: '0 20px 60px -12px rgba(0, 0, 0, 0.6)',
          background: '#ffffff',
        }}
      >
        <img src={screenshotUrl} width={700} />
      </div>
    </div>,
    size,
  )
}
