import type { Metadata } from 'next'
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { ToastContainer } from '@/components/ui/Toast'
import { AuthProvider } from '@/lib/context/AuthContext'
import { PreferencesProvider } from '@/lib/context/PreferencesContext'
import { ToastProvider } from '@/lib/context/ToastContext'
import './globals.css'
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})
export const metadata: Metadata = {
  title: 'Comanda POS',
  description: 'Sistema de gestión de cafetería',
}
interface RootLayoutProps {
  children: React.ReactNode
}
export default function RootLayout({
  children,
}: RootLayoutProps): React.JSX.Element {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <PreferencesProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
              <ToastContainer />
            </ToastProvider>
          </AuthProvider>
        </PreferencesProvider>
      </body>
    </html>
  )
}
