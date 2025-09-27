'use client'

import { useState, useEffect } from 'react'
import { Poll } from '@/types'
import { Validator } from '@/lib/validation'
import './EditPollModal.css'

interface EditPollModalProps {
  poll: Poll | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedPoll: Poll) => void
  onDelete: (pollId: string) => void
}

export default function EditPollModal({ poll, isOpen, onClose, onUpdate, onDelete }: EditPollModalProps) {
  const [formData, setFormData] = useState({
    question: '',
    options: [''],
    isPublished: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({})
  const [activeTab, setActiveTab] = useState<'edit' | 'stats' | 'danger'>('edit')

  useEffect(() => {
    if (isOpen && poll) {
      setFormData({
        question: poll.question,
        options: poll.options.map(opt => opt.text),
        isPublished: poll.isPublished
      })
      setErrors({})
      setMessage('')
      setActiveTab('edit')
    }
  }, [isOpen, poll])

  const validateField = (field: string, value: string | string[]) => {
    let result: { isValid: boolean; errors: string[] };

    switch (field) {
      case 'question':
        result = Validator.validatePollQuestion(value as string);
        break;
      case 'options':
        result = Validator.validatePollOptions(value as string[]);
        break;
      default:
        result = { isValid: true, errors: [] };
    }

    setErrors(prev => ({
      ...prev,
      [field]: result.errors
    }));

    return result.isValid;
  };

  const updateOption = (index: number, value: string) => {
    const sanitizedValue = Validator.sanitizeInput(value);
    
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? sanitizedValue : opt)
    }));

    const updatedOptions = [...formData.options];
    updatedOptions[index] = sanitizedValue;
    validateField('options', updatedOptions);
  }

  const addOption = () => {
    if (formData.options.length >= 10) return;
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  }

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return;
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  }

  const handleUpdate = async () => {
    if (!poll) return
    
    setIsSubmitting(true)
    setMessage('')

    const sanitizedData = {
      question: Validator.sanitizeInput(formData.question),
      options: Validator.sanitizeOptions(formData.options.filter(opt => opt.trim() !== '')),
      isPublished: formData.isPublished
    };

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/polls/${poll._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sanitizedData)
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.details) {
          const serverErrors: { [key: string]: string[] } = {};
          data.details.forEach((detail: { field?: string; message: string }) => {
            const field = detail.field || 'general';
            if (!serverErrors[field]) serverErrors[field] = [];
            serverErrors[field].push(detail.message);
          });
          setErrors(serverErrors)
          throw new Error('Validation failed')
        }
        throw new Error(data.error || 'Failed to update poll')
      }

      setMessage('Poll updated successfully!')
      onUpdate(data.poll)
      setTimeout(() => onClose(), 1000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update poll')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePublishToggle = async (publish: boolean) => {
    if (!poll) return
    
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/polls/${poll._id}/${publish ? 'publish' : 'unpublish'}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${publish ? 'publish' : 'unpublish'} poll`)
      }

      setMessage(`Poll ${publish ? 'published' : 'unpublished'} successfully!`)
      onUpdate((await response.json()).poll)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operation failed')
    }
  }

  const handleDelete = async () => {
    if (!poll) return
    
    if (!confirm('Are you sure you want to delete this poll? This action cannot be undone and will delete all associated votes.')) {
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/polls/${poll._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete poll')
      }

      if (poll) {
        onDelete(poll._id)
      }
      onClose()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete poll')
    }
  }

  if (!isOpen) return null
  if (!poll) return null

  return (
    <div className="edit-poll-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Manage Poll</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Edit Poll
          </button>
          <button 
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistics
          </button>
          <button 
            className={`tab ${activeTab === 'danger' ? 'active' : ''}`}
            onClick={() => setActiveTab('danger')}
          >
            Danger Zone
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="tab-content">
            <div className="form-group">
              <label>Question</label>
              <input
                type="text"
                value={formData.question}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, question: e.target.value }))
                  validateField('question', e.target.value)
                }}
                className={errors.question ? 'error' : ''}
              />
              {errors.question && (
                <div className="error-messages">
                  {errors.question.map((error, i) => (
                    <span key={i} className="error-message">• {error}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Options {poll.totalVotes > 0 && <span className="warning">(Cannot modify options after votes)</span>}</label>
              {formData.options.map((option, index) => (
                <div key={index} className="option-input-group">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    disabled={poll.totalVotes > 0}
                    className={errors.options ? 'error' : ''}
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      disabled={poll.totalVotes > 0}
                      className="remove-option-btn"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              
              {formData.options.length < 10 && poll.totalVotes === 0 && (
                <button type="button" onClick={addOption} className="btn btn-secondary">
                  + Add Option
                </button>
              )}
            </div>

            <div className="form-actions">
              <button 
                onClick={() => handlePublishToggle(!formData.isPublished)}
                className={`btn ${formData.isPublished ? 'btn-warning' : 'btn-success'}`}
              >
                {formData.isPublished ? 'Unpublish' : 'Publish'}
              </button>
              <button 
                onClick={handleUpdate}
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Updating...' : 'Update Poll'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="tab-content">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Votes</h3>
                <span className="stat-number">{poll.totalVotes}</span>
              </div>
              <div className="stat-card">
                <h3>Status</h3>
                <span className={`status ${poll.isPublished ? 'published' : 'draft'}`}>
                  {poll.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="stat-card">
                <h3>Created</h3>
                <span>{new Date(poll.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="stat-card">
                <h3>Last Updated</h3>
                <span>{new Date(poll.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="votes-breakdown">
              <h4>Votes Breakdown</h4>
              {poll.options.map(option => (
                <div key={option._id} className="vote-item">
                  <span className="option-text">{option.text}</span>
                  <span className="vote-count">{option.votes || 0} votes</span>
                  <div className="vote-bar">
                    <div 
                      className="vote-fill"
                      style={{ 
                        width: `${poll.totalVotes > 0 ? ((option.votes || 0) / poll.totalVotes) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="tab-content">
            <div className="danger-zone">
              <h3>Danger Zone</h3>
              <p>These actions are irreversible. Please proceed with caution.</p>
              
              <div className="danger-actions">
                <div className="danger-action">
                  <h4>Delete Poll</h4>
                  <p>Permanently delete this poll and all associated votes.</p>
                  <button 
                    onClick={handleDelete}
                    className="btn btn-danger"
                  >
                    Delete Poll
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}