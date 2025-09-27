'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Validator } from '@/lib/validation'
import './AuthForms.css'

interface ResetPasswordProps {
  onClose: () => void
  onSwitchToLogin: () => void
}

export default function ResetPassword({ onClose, onSwitchToLogin }: ResetPasswordProps) {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrors([])

    if (!token) {
      setErrors(['Reset token is missing'])
      setLoading(false)
      return
    }

    // Validate passwords
    const passwordValidation = Validator.validatePassword(formData.password)
    if (!passwordValidation.isValid) {
      setErrors(passwordValidation.errors)
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors(['Passwords do not match'])
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
          confirmPassword: formData.confirmPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setMessage('Password reset successfully! You can now login with your new password.')
      setTimeout(() => onSwitchToLogin(), 3000)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to reset password'])
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="auth-modal">
        <div className="auth-content">
          <button className="close-btn" onClick={onClose}>×</button>
          <h2>Invalid Reset Link</h2>
          <div className="message error">
            The password reset link is invalid or has expired.
          </div>
          <div className="auth-links">
            <button type="button" onClick={onSwitchToLogin}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-modal">
      <div className="auth-content">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Reset Password</h2>
        <p className="auth-subtitle">Enter your new password</p>

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
            <label>New Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
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