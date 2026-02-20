import Link from 'next/link'
import { cn } from '@/lib/cn'
import { ArrowRightIcon, GitHubIcon } from './icons'
import { backgrounds, buttonStyles, sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function EmailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  )
}

const icons: Record<string, React.ReactNode> = {
  GitHub: <GitHubIcon className="w-4 h-4" />,
  X: <XIcon className="w-4 h-4" />,
  Email: <EmailIcon className="w-4 h-4" />,
}

export function BottomSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.bottom ?? homeTranslations.en.bottom

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.cta)} />

      <div className="relative max-w-3xl mx-auto">
        {/* FAQ */}
        <h2 className={cn(sectionStyles.title, 'text-center mb-8')}>{t.faq.title}</h2>
        <div className="space-y-5 mb-12 sm:mb-16">
          {t.faq.items.map((item) => (
            <div key={item.question} className="border-b border-neutral-200 dark:border-neutral-800 pb-5">
              <h3 className="text-sm font-semibold mb-1.5">{item.question}</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{item.answer}</p>
            </div>
          ))}
        </div>

        {/* Community */}
        <div className="flex justify-center gap-3 mb-12 sm:mb-16">
          {t.community.items.map((item) => (
            <a
              key={item.name}
              href={item.url}
              target={item.url.startsWith('mailto:') ? undefined : '_blank'}
              rel={item.url.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              {icons[item.name]}
              {item.name}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className={cn(sectionStyles.title, 'mb-6 sm:mb-8')}>{t.cta.title}</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href={`/${locale}/docs/server`} className={cn(...buttonStyles.primaryLarge)}>
              {t.cta.deploy}
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <a href="mailto:info@shumoku.dev" className={cn(...buttonStyles.secondaryLarge)}>
              {t.cta.contact}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
