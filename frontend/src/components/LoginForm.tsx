'use client'

import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Validator } from '@/lib/validation'
import './LoginForm.css'

interface LoginFormProps {
  onClose: () => void
  onSwitchToRegister: () => void
}

export default function LoginForm({ onClose, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{email?: string[], password?: string[]}>({})
  const { login } = useAuth()

  const validateForm = () => {
    const emailValidation = Validator.validateEmail(email)
    const passwordValidation = Validator.validatePassword(password)
    
    const errors = {
      email: emailValidation.errors,
      password: passwordValidation.errors
    }
    
    setFieldErrors(errors)
    
    return emailValidation.isValid && passwordValidation.isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      await login(email, password)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailChange = (value: string) => {
    setEmail(Validator.sanitizeInput(value))
    if (fieldErrors.email) {
      setFieldErrors(prev => ({ ...prev, email: undefined }))
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value) // Don't sanitize passwords
    if (fieldErrors.password) {
      setFieldErrors(prev => ({ ...prev, password: undefined }))
    }
  }

  return (
    <div className="auth-modal">
      <div className="auth-content">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className={fieldErrors.email ? 'error' : ''}
              required
            />
            {fieldErrors.email && (
              <div className="field-errors">
                {fieldErrors.email.map((err, i) => (
                  <span key={i} className="error-text">• {err}</span>
                ))}
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className={fieldErrors.password ? 'error' : ''}
              required
            />
            {fieldErrors.password && (
              <div className="field-errors">
                {fieldErrors.password.map((err, i) => (
                  <span key={i} className="error-text">• {err}</span>
                ))}
              </div>
            )}
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p className="switch-auth">
          Don't have an account?{' '}
          <button type="button" onClick={onSwitchToRegister}>
            Register
          </button>
        </p>
      </div>
    </div>
  )
}