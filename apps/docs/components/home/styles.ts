export const buttonStyles = {
  primary: [
    'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-base',
    'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400 text-neutral-950',
    'shadow-[0_16px_35px_-18px_rgba(16,185,129,0.75)]',
    'hover:shadow-[0_18px_40px_-18px_rgba(16,185,129,0.9)] transition-shadow',
  ],
  primaryLarge: [
    'inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-semibold',
    'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400 text-neutral-950',
    'shadow-[0_16px_35px_-18px_rgba(16,185,129,0.75)]',
    'hover:shadow-[0_18px_40px_-18px_rgba(16,185,129,0.9)] transition-shadow',
  ],
  secondary: [
    'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-base',
    'bg-white/80 dark:bg-neutral-900/70',
    'text-neutral-800 dark:text-neutral-200',
    'border border-neutral-200/70 dark:border-neutral-700/60',
    'hover:bg-white dark:hover:bg-neutral-900 transition-colors',
  ],
  secondaryLarge: [
    'inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-semibold',
    'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    'border border-neutral-200 dark:border-neutral-700',
    'hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors',
  ],
} as const

export const backgrounds = {
  hero: 'bg-[radial-gradient(ellipse_120%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent_60%)] dark:bg-[radial-gradient(ellipse_120%_40%_at_50%_-10%,rgba(16,185,129,0.08),transparent_60%)]',
  features:
    'bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(16,185,129,0.10),transparent_50%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(16,185,129,0.06),transparent_50%)]',
  cta: 'bg-[radial-gradient(ellipse_80%_60%_at_80%_110%,rgba(16,185,129,0.12),transparent_60%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_80%_110%,rgba(16,185,129,0.08),transparent_60%)]',
} as const

export const sectionStyles = {
  title: 'text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight',
  subtitle: 'text-base sm:text-lg text-neutral-600 dark:text-neutral-400',
  padding: 'py-12 sm:py-16 lg:py-20 px-4 sm:px-6',
} as const

export const cardStyles = {
  feature: [
    'group p-6 rounded-2xl',
    'bg-white/90 dark:bg-neutral-800/60',
    'border border-neutral-200/70 dark:border-neutral-700/50',
    'hover:border-emerald-300 dark:hover:border-emerald-700',
    'hover:-translate-y-1 hover:shadow-2xl transition-all',
  ],
  install: [
    'inline-flex items-center gap-3 px-4 py-2.5 rounded-lg',
    'bg-neutral-950/90 dark:bg-neutral-900/90',
    'border border-neutral-800/80 dark:border-neutral-700/80',
    'shadow-[0_10px_30px_-20px_rgba(0,0,0,0.6)]',
  ],
} as const
