import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '@/components/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'
import Footer from '@/components/Footer'
import React from 'react'

export const metadata: Metadata = {
  title: 'Real-Time Polling App',
  description: 'Vote and see results in real-time',
  keywords: ['polls', 'real-time', 'voting', 'websocket', 'live results', 'survey'],
  openGraph: {
    title: 'Real-Time Polling App',
    description: 'Create polls, vote instantly, and watch live results update.',
    type: 'website',
    url: 'https://example.com',
    siteName: 'Real-Time Polling',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real-Time Polling App',
    description: 'Create polls, vote instantly, and watch live results update.'
  },
  manifest: '/site.webmanifest'
}

// Move themeColor into the viewport export per Next.js 15 recommendation
export const viewport = {
  themeColor: '#6366f1'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="theme-transition">
        <a href="#main" className="skip-link">Skip to content</a>
        {/* Initial theme inline script to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const s=localStorage.getItem('rtp-theme');if(s){document.documentElement.setAttribute('data-theme',s);}else{const m=window.matchMedia('(prefers-color-scheme: dark)');document.documentElement.setAttribute('data-theme',m.matches?'dark':'light');}}catch(e){}})();`
          }}
        />
        <AuthProvider>
          <div className="app-shell min-h-screen flex flex-col">
            <div className="fixed top-4 right-4 z-[1000]">
              <ThemeToggle />
            </div>
            <main id="main" className="flex-1 flex flex-col">
              {children}
            </main>
            <Footer />
          </div>
        </AuthProvider>
        {/* Decorative background gradients (non-intrusive) */}
        <div aria-hidden="true" className="bg-accent-orbs" />
      </body>
    </html>
  )
}