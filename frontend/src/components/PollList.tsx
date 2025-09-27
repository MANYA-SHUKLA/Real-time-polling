'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import PollCard from './PollCard'
import EditPollModal from './EditPollModal'
import { useAuth } from './AuthContext'
import { Poll } from '@/types'
import './PollList.css'
import PollSkeleton from './PollSkeleton'
export default function PollList() {
  const { isAuthenticated, user } = useAuth()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'published' | 'all'>('published')
  const [showMyPolls, setShowMyPolls] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'active' | 'draft' | 'expired' | 'all'>('active')
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0, limit: 10 })
  interface PollsResponse {
    polls: Poll[]
    pagination?: { page: number; limit: number; total: number; pages: number }
    filters?: { status?: string; myPolls?: boolean }
  }
  // Simple in-memory cache (component instance scope)
  const cacheRef = useRef<Map<string, { ts: number; data: PollsResponse }>>(new Map())
  const abortRef = useRef<AbortController | null>(null)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const handleRateLimit = useCallback((retryAfter: number) => {
    setIsRateLimited(true)
    setRetryCountdown(retryAfter)
    setError(`Rate limited. Retrying in ${retryAfter} seconds...`)
    const interval = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setIsRateLimited(false)
          setError('')
    
          return 0
        }
        setError(`Rate limited. Retrying in ${prev - 1} seconds...`)
        return prev - 1
      })
    }, 1000)
  }, [])

  const fetchPolls = useCallback(async () => {
    if (isRateLimited) return // Don't fetch if rate limited
    
    try {
      setLoading(true)
      setError('')
      
      let url = '/api/polls'
      const params: string[] = []
      if (viewMode === 'all') {
        params.push('includeUnpublished=true')
      }
      if (statusFilter) {
        params.push(`status=${statusFilter}`)
      }
      if (showMyPolls && isAuthenticated) {
        params.push('myPolls=true')
      } else if (showMyPolls && !isAuthenticated) {
        // Reset showMyPolls if user is not authenticated
        setShowMyPolls(false)
        return
      }
      // Pagination params
      if (pagination.page && pagination.page > 1) {
        params.push(`page=${pagination.page}`)
      }
      if (pagination.limit) {
        params.push(`limit=${pagination.limit}`)
      }
      if (params.length) {
        url += '?' + params.join('&')
      }
      
      // Prepare headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      // Add auth token if authenticated
      const token = localStorage.getItem('authToken')
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      
      // Abort previous in-flight request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // Cache key based on URL + auth status (auth influences personalization)
      const cacheKey = `${url}|auth:${!!isAuthenticated}`
      const cached = cacheRef.current.get(cacheKey)
      const now = Date.now()
      const MAX_AGE = 5000 // 5s fresh window
      const STALE_AGE = 15000 // 15s allow stale display while revalidating

      // Stale-while-revalidate: if stale data exists, show it immediately
      if (!polls.length && cached && (now - cached.ts) < STALE_AGE) {
        setPolls(cached.data.polls || [])
        if (cached.data.pagination) {
          setPagination(prev => ({ ...prev, ...cached.data.pagination }))
        }
      }

      // Skip network if still fresh
      if (cached && (now - cached.ts) < MAX_AGE) {
        setLoading(false)
        return
      }

      const response = await fetch(url, { headers, signal: controller.signal })
      
      // Handle rate limiting gracefully
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}))
        const retryAfter = errorData.retryAfter || 60
        handleRateLimit(retryAfter)
        return
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch polls')
      }
      
  const data: PollsResponse = await response.json()
  // Update cache
  cacheRef.current.set(cacheKey, { ts: Date.now(), data })
      
      // Handle the new response structure from backend
      if (data.polls && Array.isArray(data.polls)) {
        setPolls(data.polls)
        if (data.pagination) {
          setPagination(prev => ({
            page: data.pagination ? data.pagination.page : prev.page,
            limit: data.pagination ? data.pagination.limit : prev.limit,
            total: data.pagination ? data.pagination.total : prev.total,
            pages: data.pagination ? data.pagination.pages : prev.pages
          }))
          // console.debug('Pagination updated:', data.pagination)
        }
      } else {
        // Fallback for old format or direct array
        setPolls(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return // Silent on abort
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch polls'
      setError(errorMessage)
      console.error('Error fetching polls:', err)
    } finally {
      setLoading(false)
    }
  }, [viewMode, showMyPolls, statusFilter, isRateLimited, isAuthenticated, handleRateLimit, pagination.page, pagination.limit, polls.length])

  const handleEditPoll = (poll: Poll) => {
    setEditingPoll(poll)
    setIsEditModalOpen(true)
  }

  const handleUpdatePoll = (updatedPoll: Poll) => {
    setPolls(prev => prev.map(p => p._id === updatedPoll._id ? updatedPoll : p))
    // No need to refetch - state is already updated
  }

  const handleDeletePoll = (pollId: string) => {
    setPolls(prev => prev.filter(p => p._id !== pollId))
  }

  const togglePublishStatus = async (pollId: string, publish: boolean) => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/polls/${pollId}/${publish ? 'publish' : 'unpublish'}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 429) {
          const retryAfter = errorData.retryAfter || 60
          throw new Error(`Too many requests. Please wait ${retryAfter} seconds before trying again.`)
        }
        
        throw new Error(errorData.error || `Failed to ${publish ? 'publish' : 'unpublish'} poll`)
      }

      // Update the poll in state instead of refetching all polls
      setPolls(prev => prev.map(poll => 
        poll._id === pollId 
          ? { ...poll, isPublished: publish }
          : poll
      ))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed'
      alert(errorMessage)
      console.error('Error toggling publish status:', error)
    }
  }

  useEffect(() => {
    fetchPolls()
  }, [fetchPolls])

  // Reset to first page when filters change (but ignore when only page itself changes)
  useEffect(() => {
    setPagination(prev => prev.page === 1 ? prev : { ...prev, page: 1 })
  }, [viewMode, statusFilter, showMyPolls])

  // Auto-retry when rate limiting ends
  useEffect(() => {
    if (!isRateLimited && retryCountdown === 0 && error.includes('Rate limited')) {
      fetchPolls()
    }
  }, [isRateLimited, retryCountdown, error, fetchPolls])

  if (loading && !polls.length) {
    return (
      <div className="poll-list">
        <div className="poll-list-header">
          <h2>Active Polls</h2>
        </div>
        <div className="skeleton-grid">
          {Array.from({ length: 4 }).map((_, i) => <PollSkeleton key={i} />)}
        </div>
      </div>
    )
  }
  if (error) return <div className="error">{error}</div>

  return (
    <div className="poll-list">
      <EditPollModal
        poll={editingPoll}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdate={handleUpdatePoll}
        onDelete={handleDeletePoll}
      />

      <div className="poll-list-header">
        <h2>Active Polls</h2>
        <div className="poll-controls">
          <div className="view-controls">
            <button 
              className={`view-btn ${viewMode === 'published' ? 'active' : ''}`}
              onClick={() => setViewMode('published')}
            >
              Published
            </button>
            <button 
              className={`view-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              All Polls
            </button>
          </div>
          <div className="status-controls">
            <select
              aria-label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'draft' | 'expired' | 'all')}
              className="status-select"
            >
              <option value="active">Active</option>
              <option value="draft">Drafts</option>
              <option value="expired">Expired</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="filter-controls">
            <label className="filter-label">
              <input
                type="checkbox"
                checked={showMyPolls}
                onChange={(e) => setShowMyPolls(e.target.checked)}
                disabled={!isAuthenticated}
              />
              Show My Polls Only {!isAuthenticated && '(Login Required)'}
            </label>
          </div>
          <button 
            onClick={fetchPolls} 
            className="btn btn-secondary"
            disabled={isRateLimited}
          >
            {isRateLimited ? `Retry in ${retryCountdown}s` : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Rate limit notice */}
      {isRateLimited && (
        <div className="rate-limit-notice">
          <p>⏰ Too many requests. Auto-retrying in {retryCountdown} seconds...</p>
        </div>
      )}
      
      {error && !isRateLimited && (
        <div className="error-notice">
          <p>{error}</p>
        </div>
      )}
      
      {polls.length === 0 && !loading && !isRateLimited ? (
        <div className="no-polls">
          <p>No polls available. Create the first one!</p>
        </div>
      ) : (
        <div className="polls-grid">
          {polls.map(poll => (
            <div key={poll._id} className="poll-item">
              <PollCard poll={poll} onVote={fetchPolls} />
              
              {/* Poll management controls (only for poll creator) */}
              {user && poll.creator._id === user._id && (
                <div className="poll-management">
                  <div className="poll-status">
                    Status: <span className={`status ${poll.isPublished ? 'published' : 'draft'}`}>
                      {poll.isPublished ? 'Published' : 'Draft'}
                    </span>
                    {poll.totalVotes > 0 && (
                      <span className="vote-count">• {poll.totalVotes} votes</span>
                    )}
                  </div>
                  <div className="poll-actions">
                    <button 
                      onClick={() => handleEditPoll(poll)}
                      className="btn btn-info"
                      disabled={isRateLimited}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Delete this poll? This cannot be undone.')) return
                        try {
                          const token = localStorage.getItem('authToken')
                          const res = await fetch(`/api/polls/${poll._id}`, {
                            method: 'DELETE',
                            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                          })
                          if (!res.ok) {
                            const data = await res.json().catch(() => ({}))
                            throw new Error(data.error || 'Failed to delete poll')
                          }
                          handleDeletePoll(poll._id)
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Delete failed')
                        }
                      }}
                      className="btn btn-danger"
                      disabled={isRateLimited}
                    >
                      Delete
                    </button>
                    {poll.isPublished ? (
                      <button 
                        onClick={() => togglePublishStatus(poll._id, false)}
                        className="btn btn-warning"
                        disabled={isRateLimited}
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button 
                        onClick={() => togglePublishStatus(poll._id, true)}
                        className="btn btn-success"
                        disabled={isRateLimited}
                      >
                        Publish
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {pagination.pages > 1 && (
            <div className="pagination-controls" aria-label="Pagination Navigation">
              <button
                className="btn btn-secondary"
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1 || isRateLimited}
              >
                Prev
              </button>
              <span className="pagination-status">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                disabled={pagination.page === pagination.pages || isRateLimited}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}