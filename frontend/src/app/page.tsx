import './Home.css'
import { Poll } from '@/types'
import HomeClient from '../components/HomeClient'
import Link from 'next/link'

async function fetchInitialPolls(): Promise<Poll[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/polls?status=active&limit=10`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.polls) ? data.polls : []
  } catch {
    return []
  }
}

export default async function Home() {
  const initialPolls = await fetchInitialPolls()
  return (
    <div className="home-container">
      {/* Hero / Intro Section */}
      <section className="header">
        <div className="container header-content animate-fade-up">
          <h1 className="title">Real‑Time Polling</h1>
          <p className="subtitle">Create engaging polls, vote instantly, and watch live results update in real-time. Empower your audience with instant feedback and interactive decision making.</p>
          <div className="header-actions animate-fade-up-delayed">
            <div className="auth-buttons">
              <Link href="/register" className="btn btn-primary">Get Started</Link>
              <Link href="/login" className="btn btn-secondary">Sign In</Link>
            </div>
          </div>
        </div>
      </section>
      {/* Poll Listing / Interactive Client */}
      <div className="main-content container animate-fade-up-slower">
        <HomeClient initialPolls={initialPolls} />
      </div>
    </div>
  )
}