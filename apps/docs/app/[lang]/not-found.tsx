import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <h1 className="text-6xl font-bold text-fd-foreground">404</h1>
      <p className="mt-4 text-lg text-fd-muted-foreground">
        Page not found
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
      >
        Back to Home
      </Link>
    </main>
  )
}
