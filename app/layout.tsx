import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { BootLayer } from '@/components/boot/BootLayer';
import { ShellProviders } from '@/components/boot/ShellProviders';

export const metadata: Metadata = {
  metadataBase: new URL('https://heatt.app'),
  title: {
    default: 'heatt — where ideas burn',
    template: '%s · heatt',
  },
  description:
    'heatt is a dark editorial space for short notes, full stories, thoughtful reading, and beautiful sharing.',
  openGraph: {
    title: 'heatt — where ideas burn',
    description:
      'Short notes and full stories in one calm room. Read, save, and share without leaving the app.',
    type: 'website',
    images: [{ url: '/art/hero-forge.jpg', width: 1200, height: 627, alt: 'heatt — short sparks and full-length forges' }],
    siteName: 'heatt',
  },
  twitter: { card: 'summary_large_image', title: 'heatt — a room for ideas', description: 'Short notes and full stories in one calm room.' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050505',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="ember" data-density="normal" data-measure="normal" data-serif="true" data-reduce-motion="false">
      <head>
        <link rel="preconnect" href="https://dev.to" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://media2.dev.to" crossOrigin="anonymous" />
      </head>
      <body className="ht-grain antialiased">
        <ShellProviders>
          <div className="relative min-h-[100dvh] bg-[var(--ht-void)]">
            <BootLayer>{children}</BootLayer>
          </div>
        </ShellProviders>
      </body>
    </html>
  );
}
