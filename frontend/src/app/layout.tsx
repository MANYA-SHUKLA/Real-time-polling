import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '@/components/AuthContext'

export const metadata: Metadata = {
  title: 'Real-Time Polling App',
  description: 'Vote and see results in real-time',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <div className="min-h-screen">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}