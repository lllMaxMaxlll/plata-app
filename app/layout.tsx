import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { AppShell } from './shell'

export const metadata: Metadata = {
  title: 'PLATA — Finanzas Cloud Dashboard',
  description:
    'App de finanzas personales para Argentina con UI Cloudflare: cuentas en pesos y dólares, ingresos, gastos y transferencias.',
  generator: 'v0.app',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PLATA' },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0e1015',
  userScalable: false,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className="bg-background"
    >
      <body className="bg-background font-sans antialiased text-foreground">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <Toaster theme="dark" position="top-center" closeButton richColors />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
