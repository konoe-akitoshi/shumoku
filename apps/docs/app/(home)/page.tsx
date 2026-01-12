import type { Metadata } from 'next'
import { HeroSection, FeaturesSection, CTASection } from '@/components/home'

export const metadata: Metadata = {
  openGraph: {
    images: '/og',
  },
}

export default function HomePage() {
  return (
    <main className="flex-1">
      <HeroSection />
      <FeaturesSection />
      <CTASection />
    </main>
  )
}
