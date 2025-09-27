'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { AuthUser } from '@/types'
import { authService } from '@/lib/auth'

interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, confirmPassword?: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in on component mount
    const token = authService.getToken()
    const userData = authService.getUser()
    
    if (token && userData) {
      setUser(userData)
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }

      const userData = await response.json()
      authService.setAuth(userData.token, userData)
      if (typeof window !== 'undefined' && userData?._id) {
        localStorage.setItem('userId', userData._id)
      }
      setUser(userData)
    } catch (error) {
      throw error
    }
  }

  const register = async (name: string, email: string, password: string, confirmPassword?: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, confirmPassword: confirmPassword || password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Registration failed')
      }

      const userData = await response.json()
      authService.setAuth(userData.token, userData)
      if (typeof window !== 'undefined' && userData?._id) {
        localStorage.setItem('userId', userData._id)
      }
      setUser(userData)
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const token = authService.getToken()
      if (!token) return
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      // Preserve token but update user profile fields
      const existing = authService.getUser()
      authService.setAuth(token, { ...existing, ...data })
      if (typeof window !== 'undefined' && data?._id) {
        localStorage.setItem('userId', data._id)
      }
      setUser(prev => ({ ...(prev || {} as any), ...data }))
    } catch {}
  }

  const value = {
    user,
    login,
    register,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}