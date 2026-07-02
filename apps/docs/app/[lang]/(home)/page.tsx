import {
  AdoptersSection,
  BottomSection,
  CommercialSupportSection,
  FeaturesSection,
  ForTeamsSection,
  GallerySection,
  GettingStartedSection,
  HeroSection,
  IntegrationsSection,
  OverviewSection,
  PlatformSection,
  ProjectBackgroundSection,
  // WhySection is temporarily disabled — see apps/docs/components/home/WhySection.tsx
} from '@/components/home'
import type { Locale } from '@/components/home/translations'

export default async function HomePage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params

  return (
    <main className="flex-1">
      <HeroSection locale={lang} />
      <AdoptersSection locale={lang} />
      <OverviewSection locale={lang} />
      {/* <WhySection locale={lang} /> */}
      <PlatformSection locale={lang} />
      <IntegrationsSection locale={lang} />
      <FeaturesSection locale={lang} />
      <GallerySection locale={lang} />
      <GettingStartedSection locale={lang} />
      <ForTeamsSection locale={lang} />
      <ProjectBackgroundSection locale={lang} />
      <CommercialSupportSection locale={lang} />
      <BottomSection locale={lang} />
    </main>
  )
}
