'use client'

import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Validator } from '@/lib/validation'
import './UserProfile.css'

export default function UserProfile() {
  const { user, logout, refreshUser } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const updateProfile = async (profileData: { name: string; email: string }) => {
    const token = localStorage.getItem('authToken')
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(profileData)
    })

    if (!response.ok) {
      let err
      try { err = await response.json() } catch { err = { error: 'Failed to update profile' } }
      throw new Error(err.error || 'Failed to update profile')
    }

    const updated = await response.json()
    await refreshUser()
    return updated
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrors([])

    try {
  await updateProfile(formData)
  setMessage('Profile updated successfully!')
      setShowProfileModal(false)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to update profile'])
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrors([])

    // Validate passwords
    const passwordValidation = Validator.validatePassword(passwordData.newPassword)
    if (!passwordValidation.isValid) {
      setErrors(passwordValidation.errors)
      setLoading(false)
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrors(['New passwords do not match'])
      setLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(passwordData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      setMessage('Password changed successfully!')
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowChangePassword(false)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to change password'])
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <>
      <div className="user-profile">
        <button 
          className="user-button"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <span className="user-avatar">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="user-name">{user.name}</span>
        </button>

        {showDropdown && (
          <div className="user-dropdown">
            <div className="user-info">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <div className="dropdown-actions">
              <button onClick={() => { setShowProfileModal(true); setShowDropdown(false); }}>
                Edit Profile
              </button>
              <button onClick={() => { setShowChangePassword(true); setShowDropdown(false); }}>
                Change Password
              </button>
              <button onClick={logout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>
        )}

        {showDropdown && (
          <div 
            className="dropdown-overlay"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button onClick={() => setShowProfileModal(false)}>×</button>
            </div>
            <form onSubmit={handleProfileUpdate}>
              {message && <div className="message success">{message}</div>}
              {errors.length > 0 && (
                <div className="message error">
                  {errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowProfileModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Change Password</h3>
              <button onClick={() => setShowChangePassword(false)}>×</button>
            </div>
            <form onSubmit={handlePasswordChange}>
              {message && <div className="message success">{message}</div>}
              {errors.length > 0 && (
                <div className="message error">
                  {errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowChangePassword(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}