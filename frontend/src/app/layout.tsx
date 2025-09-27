import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '@/components/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'
import Footer from '@/components/Footer'

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
        {/* Initial theme inline script to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const s=localStorage.getItem('rtp-theme');if(s){document.documentElement.setAttribute('data-theme',s);}else{const m=window.matchMedia('(prefers-color-scheme: dark)');document.documentElement.setAttribute('data-theme',m.matches?'dark':'light');}}catch(e){}})();`
          }}
        />
        <AuthProvider>
          <div className="min-h-screen" style={{display:'flex', flexDirection:'column'}}>
            <div style={{position:'fixed', top:'1rem', right:'1rem', zIndex:1000}}>
              <ThemeToggle />
            </div>
            <div style={{flex:1, display:'flex', flexDirection:'column'}}>
              {children}
            </div>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}