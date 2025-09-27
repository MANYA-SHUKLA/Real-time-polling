import './Home.css'
import { Poll } from '@/types'
import PollList from '@/components/PollList'
import CreatePoll from '@/components/CreatePoll'
import UserList from '@/components/UserList'
import UserProfile from '@/components/UserProfile'
import LoginForm from '@/components/LoginForm'
import RegisterForm from '@/components/RegisterForm'
import WebSocketStatus from '@/components/WebSocketStatus'
import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'

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
  return <HomeClient initialPolls={initialPolls} />
}

// Client component extracted
function HomeClient({ initialPolls }: { initialPolls: Poll[] }) {
  'use client'
  const { isAuthenticated, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<'polls' | 'create' | 'users'>('polls')
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="home-container">
      <WebSocketStatus />
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1 className="title">Real-Time Polling</h1>
              <p className="subtitle">Vote and see results instantly</p>
            </div>
            <div className="header-actions">
              {isAuthenticated ? (
                <UserProfile />
              ) : (
                <div className="auth-buttons">
                  <button onClick={() => setShowLogin(true)} className="btn btn-secondary">Login</button>
                  <button onClick={() => setShowRegister(true)} className="btn btn-primary">Register</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <nav className="navigation">
        <div className="container">
          <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'polls' ? 'active' : ''}`} onClick={() => setActiveTab('polls')}>View Polls</button>
            <button className={`nav-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')} disabled={!isAuthenticated}>Create Poll</button>
            <button className={`nav-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users</button>
          </div>
        </div>
      </nav>
      <main className="main-content">
        <div className="container">
          {activeTab === 'polls' && <PollList initialPolls={initialPolls} />}
          {activeTab === 'create' && (isAuthenticated ? <CreatePoll /> : (
            <div className="auth-required-message">
              <p>Please log in to create polls</p>
              <button onClick={() => setShowLogin(true)} className="btn btn-primary">Login</button>
            </div>
          ))}
          {activeTab === 'users' && <UserList />}
        </div>
      </main>
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} onSwitchToRegister={() => { setShowLogin(false); setShowRegister(true) }} />}
      {showRegister && <RegisterForm onClose={() => setShowRegister(false)} onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true) }} />}
    </div>
  )
}