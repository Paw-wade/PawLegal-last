import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/providers/SessionProvider';

export const metadata: Metadata = {
  title: 'Paw Legal - Droit des étrangers et Droit du travail',
  description: 'Paw Legal - Cabinet juridique spécialisé en droit des étrangers et droit du travail. Accompagnement professionnel pour vos démarches administratives.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
