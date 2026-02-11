import { notFound } from 'next/navigation'
import { ImageResponse } from 'next/og'
import { getPageImage, source } from '@/lib/source'
import { LogoSvg } from '@/lib/og-brand'

export const revalidate = false

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params
  const page = source.getPage(slug.slice(0, -1))
  if (!page) notFound()

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#1F2328',
        padding: '60px',
      }}
    >
      {/* Header with logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <LogoSvg size={48} />
        <span style={{ color: '#13ae67', fontSize: '28px', fontWeight: 600 }}>Shumoku</span>
      </div>

      {/* Title */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
        }}
      >
        <h1
          style={{
            color: '#ffffff',
            fontSize: '64px',
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {page.data.title}
        </h1>
      </div>

      {/* Description */}
      {page.data.description && (
        <p
          style={{
            color: '#94a3b8',
            fontSize: '24px',
            margin: 0,
          }}
        >
          {page.data.description}
        </p>
      )}
    </div>,
    {
      width: 1200,
      height: 630,
    },
  )
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }))
}
