import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://shumoku.dev'),
  title: {
    default: 'Shumoku',
    template: '%s | Shumoku',
  },
  description: 'Network diagrams, as code. YAML でネットワーク構成を定義し、美しい SVG ダイアグラムを自動生成',
  openGraph: {
    title: 'Shumoku',
    description: 'Network diagrams, as code.',
    siteName: 'Shumoku',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
