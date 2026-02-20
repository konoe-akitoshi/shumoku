import Image from 'next/image'
import { homeTranslations, type Locale } from './translations'

type Adopter = {
  name: string
  logo: string
  url?: string
}

const adopters: Adopter[] = [
  {
    name: '電気通信大学 情報基盤センター',
    logo: '/adopters/itcuec_logo_300.png',
    url: 'https://www.cc.uec.ac.jp/',
  },
]

export function AdoptersSection({ locale }: { locale: string }) {
  const label =
    homeTranslations[locale as Locale]?.adopters?.title ?? homeTranslations.en.adopters.title

  return (
    <section className="py-6 sm:py-8">
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm text-neutral-500 dark:text-neutral-500">{label}</span>
        <div className="flex items-center gap-8">
          {adopters.map((adopter) =>
            adopter.url ? (
              <a
                key={adopter.name}
                href={adopter.url}
                target="_blank"
                rel="noopener noreferrer"
                title={adopter.name}
              >
                <Image
                  src={adopter.logo}
                  alt={adopter.name}
                  width={180}
                  height={54}
                  className="h-10 sm:h-12 w-auto object-contain"
                />
              </a>
            ) : (
              <Image
                key={adopter.name}
                src={adopter.logo}
                alt={adopter.name}
                width={180}
                height={54}
                className="h-10 sm:h-12 w-auto object-contain"
              />
            ),
          )}
        </div>
      </div>
    </section>
  )
}
