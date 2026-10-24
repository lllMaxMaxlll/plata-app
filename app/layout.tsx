import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from './shell'
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";
import { ThemedToaster } from "@/components/finance/theme-toggle";

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-lucas-sans' });

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-lucas-mono' });

export const metadata: Metadata = {
  title: 'EN MANO — Tu plata, en claro',
  description:
    'Finanzas personales para Argentina: cuentas en pesos y dólares, gastos anotados en una línea y todo lo que vence en una sola agenda.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'EN MANO' },
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
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
  width: 'device-width',
  initialScale: 1,
  // Sin `userScalable: false` ni `maximumScale`: la app muestra muchos importes
  // en cuerpos chicos y bloquear el zoom incumple WCAG 1.4.4.
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // El script de tema escribe data-theme antes de hidratar: el atributo no
    // coincide con el HTML del servidor, y es a propósito.
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("bg-background", "font-sans", bricolage.variable, jetbrainsMono.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-background font-sans antialiased text-foreground">
        <Providers>
          <AppShell>{children}</AppShell>
          <ThemedToaster />
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
