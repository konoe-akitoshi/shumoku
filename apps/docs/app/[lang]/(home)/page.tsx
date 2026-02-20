import type { Metadata } from 'next'
import {
  AdoptersSection,
  BottomSection,
  FeaturesSection,
  ForTeamsSection,
  GallerySection,
  GettingStartedSection,
  HeroSection,
  IntegrationsSection,
  WhySection,
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
      <AdoptersSection locale={lang} />
      <FeaturesSection locale={lang} />
      <IntegrationsSection locale={lang} />
      <WhySection locale={lang} />
      <GallerySection locale={lang} />
      <GettingStartedSection locale={lang} />
      <ForTeamsSection locale={lang} />
      <BottomSection locale={lang} />
    </main>
  )
}
