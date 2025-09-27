'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { websocketService, WebSocketMessage } from '@/lib/websocket'
import { Poll } from '@/types'
import './PollCard.css'
interface PollCardProps {
  poll: Poll
  onVote: () => void
}

export default function PollCard({ poll, onVote }: PollCardProps) {
  const { isAuthenticated, user } = useAuth()
  const [selectedOption, setSelectedOption] = useState('')
  const [localPoll, setLocalPoll] = useState(poll)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('closed')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    if (!poll?._id) return

    const callbacks = {
      onOpen: () => {
        setWsStatus('open')
        setReconnectAttempts(0)
        console.log('WebSocket connected for poll:', poll._id)
      },
      
      onClose: (event: CloseEvent) => {
        setWsStatus('closed')
        console.log('WebSocket disconnected for poll:', poll._id, event.code, event.reason)
      },
      
      onError: (event: Event) => {
        console.error('WebSocket error for poll:', poll._id, event)
      },
      
      onMessage: (message: WebSocketMessage) => {
        setLastUpdate(new Date())
        
        if (message.type === 'vote_update' && message.pollId === poll._id) {
          console.log('Received real-time vote update')
          const voteUpdate = message as { type: 'vote_update'; pollId?: string; voteCounts: { [key: string]: number }; totalVotes: number };
          setLocalPoll(prev => ({
            ...prev,
            options: prev.options.map(opt => ({
              ...opt,
              votes: voteUpdate.voteCounts[opt._id] || 0
            })),
            totalVotes: voteUpdate.totalVotes
          }))
        }
        
        if (message.type === 'subscription_confirmed') {
          console.log('Poll subscription confirmed')
        }
      },
      
      onReconnect: (attempt: number) => {
        setWsStatus('connecting')
        setReconnectAttempts(attempt)
        console.log(`Reconnection attempt ${attempt} for poll ${poll._id}`)
      },
      
      onMaxReconnectAttempts: () => {
        console.error('Max reconnection attempts reached for poll:', poll._id)
        setWsStatus('closed')
      }
    }

    // Connect to WebSocket for this poll
    websocketService.connect(poll._id, callbacks)

    // Cleanup on component unmount
    return () => {
      websocketService.unsubscribeFromPoll()
    }
  }, [poll._id])

  const handleVote = async () => {
    if (!selectedOption || !isAuthenticated) return

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          poll: poll._id,
          pollOption: selectedOption
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit vote')
      }
      
      setSelectedOption('')
      onVote() // Refresh the poll list
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit vote')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPercentage = (votes: number) => {
    if (localPoll.totalVotes === 0) return 0
    return Math.round((votes / localPoll.totalVotes) * 100)
  }

  const getConnectionStatusText = () => {
    switch (wsStatus) {
      case 'connecting':
        return reconnectAttempts > 0 
          ? `Reconnecting... (attempt ${reconnectAttempts})`
          : 'Connecting...'
      case 'open':
        return 'Live'
      case 'closed':
        return 'Disconnected'
      default:
        return 'Unknown'
    }
  }

  const getConnectionStatusColor = () => {
    switch (wsStatus) {
      case 'open':
        return '#28a745'
      case 'connecting':
        return '#ffc107'
      case 'closed':
        return '#dc3545'
      default:
        return '#6c757d'
    }
  }

  // If user has already voted, show their selection
  useEffect(() => {
    if (poll.userVoted && poll.userVoteOption) {
      setSelectedOption(poll.userVoteOption)
    }
  }, [poll.userVoted, poll.userVoteOption])

  return (
    <div className="poll-card">
      {!poll.isPublished && (
        <div className="draft-badge" title="This poll is a draft and not visible to others until published">
          Draft
        </div>
      )}
      <div className="poll-header">
        <div className="poll-title-section">
          <h3 className="poll-question">{localPoll.question}</h3>
          <div className="connection-status">
            <span 
              className="status-dot"
              style={{ backgroundColor: getConnectionStatusColor() }}
            />
            <span className="status-text">{getConnectionStatusText()}</span>
            {lastUpdate && (
              <span className="last-update">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="poll-meta">
          <span>By {localPoll.creator.name}</span>
          <span>{new Date(localPoll.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="poll-options">
        {localPoll.options.map(option => (
          <div key={option._id} className="poll-option">
            <label className="option-label">
              <input
                type="radio"
                name={`poll-${poll._id}`}
                value={option._id}
                checked={selectedOption === option._id}
                onChange={(e) => setSelectedOption(e.target.value)}
                disabled={isSubmitting || !isAuthenticated || poll.userVoted}
              />
              <span className="option-text">{option.text}</span>
            </label>
            
            <div className="vote-results">
              <div className="vote-bar">
                <div 
                  className="vote-fill"
                  style={{ width: `${getPercentage(option.votes || 0)}%` }}
                ></div>
              </div>
              <div className="vote-counts">
                <span>{option.votes || 0} votes</span>
                <span>({getPercentage(option.votes || 0)}%)</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="poll-footer">
        <div className="poll-stats">
          <div className="total-votes">
            Total votes: {localPoll.totalVotes}
          </div>
          {poll.userVoted && (
            <div className="user-voted-badge">
              ✓ You voted
            </div>
          )}
          {!poll.isPublished && user && user._id === poll.creator._id && (
            <button
              className="btn btn-success small-publish-btn"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('authToken')
                  const res = await fetch(`/api/polls/${poll._id}/publish`, {
                    method: 'PATCH',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                  })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || 'Publish failed')
                  }
                  await res.json()
                  setLocalPoll(prev => ({ ...prev, isPublished: true }))
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Publish failed')
                }
              }}
            >
              Publish
            </button>
          )}
        </div>
        
        {!isAuthenticated ? (
          <div className="auth-required">
            Please log in to vote
          </div>
        ) : poll.userVoted ? (
          <div className="already-voted">
            Thank you for voting!
          </div>
        ) : (
          <button 
            onClick={handleVote}
            disabled={!selectedOption || isSubmitting}
            className="btn btn-primary vote-btn"
          >
            {isSubmitting ? 'Voting...' : 'Vote'}
          </button>
        )}
      </div>

      {/* Connection status banner for poor connection */}
      {wsStatus === 'connecting' && reconnectAttempts > 0 && (
        <div className="connection-banner connecting">
          <div className="banner-content">
            <span>Attempting to reconnect... ({reconnectAttempts}/5)</span>
            <button 
              onClick={() => websocketService.connect(poll._id, {})}
              className="retry-btn"
            >
              Retry Now
            </button>
          </div>
        </div>
      )}
      
      {wsStatus === 'closed' && reconnectAttempts >= 5 && (
        <div className="connection-banner closed">
          <div className="banner-content">
            <span>Connection lost. Real-time updates unavailable.</span>
            <button 
              onClick={() => {
                setReconnectAttempts(0)
                websocketService.connect(poll._id, {})
              }}
              className="retry-btn"
            >
              Reconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}