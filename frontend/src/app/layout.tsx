import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/providers/SessionProvider';

export const metadata: Metadata = {
  title: 'Service d\'accompagnement juridique - Paw Legal',
  description: 'Paw Legal - Service d\'accompagnement juridique spécialisé en droit des étrangers et droit du travail. Accompagnement professionnel pour vos démarches administratives.',
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
