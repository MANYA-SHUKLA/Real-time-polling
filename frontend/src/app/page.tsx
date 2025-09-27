import './Home.css'
import { Poll } from '@/types'
import HomeClient from '../components/HomeClient'

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