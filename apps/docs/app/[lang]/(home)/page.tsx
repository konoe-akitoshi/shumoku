import type { Metadata } from 'next'
import {
  CTASection,
  FeaturesSection,
  HeroSection,
  IntegrationsSection,
  UseCasesSection,
} from '@/components/home'

export const metadata: Metadata = {
  openGraph: {
    images: '/og',
  },
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params

  return (
    <main className="flex-1">
      <HeroSection locale={lang} />
      <FeaturesSection locale={lang} />
      <UseCasesSection locale={lang} />
      <IntegrationsSection locale={lang} />
      <CTASection locale={lang} />
    </main>
  )
}
