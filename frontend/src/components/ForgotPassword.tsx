'use client'

import { useState } from 'react'
import { Validator } from '@/lib/validation'
import './AuthForms.css'

interface ForgotPasswordProps {
  onClose: () => void
  onSwitchToLogin: () => void
}

export default function ForgotPassword({ onClose, onSwitchToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrors([])

    // Validate email
    const emailValidation = Validator.validateEmail(email)
    if (!emailValidation.isValid) {
      setErrors(emailValidation.errors)
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setMessage(data.message || 'Password reset instructions sent to your email')
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to process request'])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-modal">
      <div className="auth-content">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Forgot Password</h2>
        <p className="auth-subtitle">Enter your email to receive reset instructions</p>

        <form onSubmit={handleSubmit}>
          {message && <div className="message success">{message}</div>}
          {errors.length > 0 && (
            <div className="message error">
              {errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </button>
        </form>

        <div className="auth-links">
          <button type="button" onClick={onSwitchToLogin}>
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}