'use client'

import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Validator, validateForm } from '@/lib/validation'
import './CreatePoll.css'

export default function CreatePoll() {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    question: '',
    options: ['', ''],
    isPublished: false,
    expiresAt: '',
    allowVotingAfterExpiry: false,
    showResultsAfterExpiry: true,
    autoArchive: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({})
  const [showExpiryOptions, setShowExpiryOptions] = useState(false)

  const validateField = (field: string, value: string | string[]) => {
    let result: { isValid: boolean; errors: string[] };

    switch (field) {
      case 'question':
        result = Validator.validatePollQuestion(value as string);
        break;
      case 'options':
        result = Validator.validatePollOptions(value as string[]);
        break;
      case 'expiresAt':
        if (value) {
          const date = new Date(value as string);
          if (date <= new Date()) {
            result = { isValid: false, errors: ['Expiration date must be in the future'] };
          } else {
            result = { isValid: true, errors: [] };
          }
        } else {
          result = { isValid: true, errors: [] };
        }
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

  const addOption = () => {
    if (formData.options.length >= 10) {
      setErrors(prev => ({
        ...prev,
        options: ['Maximum 10 options allowed']
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));

    setErrors(prev => ({
      ...prev,
      options: []
    }));
  }

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) {
      setErrors(prev => ({
        ...prev,
        options: ['Poll must have at least 2 options']
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));

    // Revalidate after removal
    setTimeout(() => validateField('options', formData.options.filter((_, i) => i !== index)));
  }

  const updateOption = (index: number, value: string) => {
    const sanitizedValue = Validator.sanitizeInput(value);
    
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? sanitizedValue : opt)
    }));

    // Validate this specific option
    const updatedOptions = [...formData.options];
    updatedOptions[index] = sanitizedValue;
    validateField('options', updatedOptions);
  }

  const updateQuestion = (value: string) => {
    const sanitizedValue = Validator.sanitizeInput(value);
    setFormData(prev => ({ ...prev, question: sanitizedValue }));
    validateField('question', sanitizedValue);
  }

  const handleExpiryChange = (value: string) => {
    setFormData(prev => ({ ...prev, expiresAt: value }));
    validateField('expiresAt', value);
  }

  const handleSubmit = async (e: React.FormEvent, publishNow: boolean = false) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setErrors({})

    // Validate critical fields first
    if (!validateField('question', formData.question) || !validateField('options', formData.options)) {
      setIsSubmitting(false);
      return;
    }

    // Validate expiration date if provided
    if (formData.expiresAt && !validateField('expiresAt', formData.expiresAt)) {
      setIsSubmitting(false);
      return;
    }

    // Sanitize all inputs
    const sanitizedData = {
      question: Validator.sanitizeInput(formData.question),
      options: Validator.sanitizeOptions(formData.options.filter(opt => opt.trim() !== '')),
      isPublished: publishNow || formData.isPublished,
      expiresAt: formData.expiresAt || undefined,
      allowVotingAfterExpiry: formData.allowVotingAfterExpiry,
      showResultsAfterExpiry: formData.showResultsAfterExpiry,
      autoArchive: formData.autoArchive
    };

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(sanitizedData)
      })

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = data.retryAfter || 60;
          throw new Error(`Rate limited: Please wait ${retryAfter} seconds. This should not happen in development mode - check backend console.`);
        }
        
        if (data.details) {
          // Handle validation errors from server
          const serverErrors: { [key: string]: string[] } = {};
          data.details.forEach((detail: any) => {
            const field = detail.field || 'general';
            if (!serverErrors[field]) {
              serverErrors[field] = [];
            }
            serverErrors[field].push(detail.message);
          });
          setErrors(serverErrors);
          throw new Error('Validation failed on server');
        }
        throw new Error(data.error || 'Failed to create poll');
      }

      let successMessage = `Poll created successfully! It is now ${sanitizedData.isPublished ? 'published' : 'a draft'}.`;
      if (formData.expiresAt) {
        const expiryDate = new Date(formData.expiresAt).toLocaleDateString();
        successMessage += ` It will expire on ${expiryDate}.`;
      }

      setMessage(successMessage)
      setFormData({
        question: '',
        options: ['', ''],
        isPublished: false,
        expiresAt: '',
        allowVotingAfterExpiry: false,
        showResultsAfterExpiry: true,
        autoArchive: false
      })
      setShowExpiryOptions(false)
      setErrors({})
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create poll')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasErrors = (field: string) => {
    return errors[field] && errors[field].length > 0;
  };

  const getCharacterCountColor = (text: string, max: number) => {
    const length = text.length;
    if (length > max * 0.9) return '#dc3545'; // red
    if (length > max * 0.8) return '#ffc107'; // yellow
    return '#28a745'; // green
  };

  const presetExpiry = (hours: number) => {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + hours);
    setFormData(prev => ({ 
      ...prev, 
      expiresAt: expiry.toISOString().slice(0, 16)
    }));
    setShowExpiryOptions(true);
  }

  const clearExpiry = () => {
    setFormData(prev => ({ 
      ...prev, 
      expiresAt: '',
      allowVotingAfterExpiry: false,
      showResultsAfterExpiry: true,
      autoArchive: false
    }));
  }

  const getTimeRemaining = () => {
    if (!formData.expiresAt) return null;
    
    const now = new Date();
    const expiry = new Date(formData.expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Invalid date';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `Expires in ${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
    if (hours > 0) return `Expires in ${hours} hour${hours !== 1 ? 's' : ''}`;
    
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `Expires in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  const isFormValid = () => {
    return !hasErrors('question') && 
           !hasErrors('options') && 
           !hasErrors('expiresAt') &&
           formData.question.trim().length > 0 &&
           formData.options.filter(opt => opt.trim().length > 0).length >= 2;
  };

  return (
    <div className="create-poll">
      <div className="create-poll-header">
        <h2>Create New Poll</h2>
        <p>Create a new poll for others to vote on</p>
      </div>

      <form onSubmit={handleSubmit} className="poll-form">
        {/* Question Field */}
        <div className="form-group">
          <label htmlFor="question" className="form-label">
            Poll Question *
            <span 
              className="character-count"
              style={{ color: getCharacterCountColor(formData.question, 500) }}
            >
              {formData.question.length}/500
            </span>
          </label>
          <input
            type="text"
            id="question"
            className={`form-input ${hasErrors('question') ? 'error' : ''}`}
            value={formData.question}
            onChange={(e) => updateQuestion(e.target.value)}
            placeholder="Enter your question here..."
            maxLength={500}
          />
          {hasErrors('question') && (
            <div className="error-messages">
              {errors.question.map((error, index) => (
                <span key={index} className="error-message">• {error}</span>
              ))}
            </div>
          )}
        </div>

        {/* Options Field */}
        <div className="form-group">
          <label className="form-label">
            Poll Options *
            <span className="options-count">{formData.options.length}/10 options</span>
          </label>
          
          {formData.options.map((option, index) => (
            <div key={index} className="option-input-group">
              <div className="option-input-wrapper">
                <input
                  type="text"
                  className={`form-input ${hasErrors('options') ? 'error' : ''}`}
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  maxLength={200}
                />
                <span 
                  className="option-character-count"
                  style={{ color: getCharacterCountColor(option, 200) }}
                >
                  {option.length}/200
                </span>
              </div>
              {formData.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="remove-option-btn"
                  title="Remove option"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          
          {hasErrors('options') && (
            <div className="error-messages">
              {errors.options.map((error, index) => (
                <span key={index} className="error-message">• {error}</span>
              ))}
            </div>
          )}

          {formData.options.length < 10 && (
            <button
              type="button"
              onClick={addOption}
              className="btn btn-secondary add-option-btn"
            >
              + Add Option
            </button>
          )}
        </div>

        {/* Expiration Settings */}
        <div className="form-section">
          <div className="section-header">
            <h3>Expiration Settings</h3>
            <button 
              type="button"
              className={`btn ${showExpiryOptions ? 'btn-secondary' : 'btn-outline'}`}
              onClick={() => setShowExpiryOptions(!showExpiryOptions)}
            >
              {showExpiryOptions ? 'Hide' : 'Show'} Expiration Options
            </button>
          </div>

          {showExpiryOptions && (
            <div className="expiry-options">
              <div className="quick-presets">
                <label>Quick Presets:</label>
                <div className="preset-buttons">
                  <button type="button" onClick={() => presetExpiry(1)}>1 Hour</button>
                  <button type="button" onClick={() => presetExpiry(24)}>1 Day</button>
                  <button type="button" onClick={() => presetExpiry(168)}>1 Week</button>
                  <button type="button" onClick={() => presetExpiry(720)}>1 Month</button>
                  <button type="button" onClick={clearExpiry} className="clear-btn">No Expiry</button>
                </div>
              </div>

              <div className="form-group">
                <label>
                  Expiration Date & Time *
                  {formData.expiresAt && (
                    <span className="time-remaining">{getTimeRemaining()}</span>
                  )}
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => handleExpiryChange(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className={hasErrors('expiresAt') ? 'error' : ''}
                />
                <small>Leave empty for no expiration. Date must be in the future.</small>
                {hasErrors('expiresAt') && (
                  <div className="error-messages">
                    {errors.expiresAt.map((error, index) => (
                      <span key={index} className="error-message">• {error}</span>
                    ))}
                  </div>
                )}
              </div>

              {formData.expiresAt && (
                <div className="expiry-behavior">
                  <h4>Expiration Behavior</h4>
                  
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.allowVotingAfterExpiry}
                        onChange={(e) => setFormData(prev => ({ ...prev, allowVotingAfterExpiry: e.target.checked }))}
                      />
                      <span className="checkmark"></span>
                      Allow voting after expiration
                    </label>
                    <small>Users can still vote even after the poll expires</small>
                  </div>

                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.showResultsAfterExpiry}
                        onChange={(e) => setFormData(prev => ({ ...prev, showResultsAfterExpiry: e.target.checked }))}
                      />
                      <span className="checkmark"></span>
                      Show results after expiration
                    </label>
                    <small>Results remain visible after the poll expires</small>
                  </div>

                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.autoArchive}
                        onChange={(e) => setFormData(prev => ({ ...prev, autoArchive: e.target.checked }))}
                      />
                      <span className="checkmark"></span>
                      Auto-archive when expired
                    </label>
                    <small>Automatically unpublish the poll when it expires</small>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Poll Actions Info */}
        <div className="form-group">
          <div className="poll-actions-info">
            <p><strong>Save Draft:</strong> Your poll will be saved privately. You can edit and publish it later.</p>
            <p><strong>Publish Poll:</strong> Your poll will be visible to everyone and start accepting votes immediately.</p>
          </div>
        </div>

        {/* General Errors */}
        {hasErrors('general') && (
          <div className="error-messages general-errors">
            {errors.general.map((error, index) => (
              <span key={index} className="error-message">• {error}</span>
            ))}
          </div>
        )}

        {/* Success/Error Message */}
        {message && (
          <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="submit-buttons">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            disabled={isSubmitting || !isFormValid()}
            className="btn btn-secondary submit-btn draft-btn"
          >
            {isSubmitting ? 'Creating...' : 'Save Draft'}
          </button>
          
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isSubmitting || !isFormValid()}
            className="btn btn-primary submit-btn publish-btn"
          >
            {isSubmitting ? 'Publishing...' : 'Publish Poll'}
          </button>
        </div>

        {/* Form Help */}
        <div className="form-help">
          <h4>Creating a great poll:</h4>
          <ul>
            <li>Make your question clear and specific</li>
            <li>Provide balanced, non-overlapping options</li>
            <li>Keep options concise but descriptive</li>
            <li>2-6 options usually work best</li>
            <li>Set appropriate expiration based on your needs</li>
            <li>Consider allowing voting after expiry for important polls</li>
          </ul>
        </div>
      </form>
    </div>
  )
}