'use client'

import { useState, useEffect } from 'react'
import { User } from '@/types'
import './UserList.css'

export default function UserList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')


  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])



  if (loading) return <div className="loading">Loading users...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="user-list">
      <div className="user-list-header">
        <h2>Users</h2>
        <p>Browse registered users on the platform</p>
      </div>

      <div className="users-grid">
        {users.map(user => (
          <div key={user._id} className="user-card">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <small>Joined: {new Date(user.createdAt).toLocaleDateString()}</small>
          </div>
        ))}
      </div>
    </div>
  )
}