'use client'

import { useState, useEffect } from 'react'
import { websocketService } from '@/lib/websocket'
import './WebSocketStatus.css'

export default function WebSocketStatus() {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closing' | 'closed'>('closed')
  const [isVisible, setIsVisible] = useState(false)
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false)

  useEffect(() => {
    const checkStatus = () => {
      const currentStatus = websocketService.getStatus()
      setStatus(currentStatus)
      
      // Track if we've ever attempted a connection
      if (currentStatus !== 'closed' || hasAttemptedConnection) {
        setHasAttemptedConnection(true)
      }
      
      // Only show if we've attempted connection and it's not working perfectly
      setIsVisible(hasAttemptedConnection && currentStatus !== 'open')
    }

    // Check status initially
    checkStatus()

    // Check status every 3 seconds
    const interval = setInterval(checkStatus, 3000)

    return () => clearInterval(interval)
  }, [hasAttemptedConnection])

  if (!isVisible) return null

  const statusConfig = {
    connecting: {
      message: 'Connecting to real-time service...',
      className: 'connecting'
    },
    open: {
      message: 'Real-time updates connected',
      className: 'open'
    },
    closing: {
      message: 'Disconnecting from real-time service...',
      className: 'closing'
    },
    closed: {
      message: 'Real-time updates disconnected',
      className: 'closed'
    }
  }[status]

  return (
    <div className={`websocket-status ${statusConfig.className}`}>
      <div className="status-content">
        <span className="status-message">{statusConfig.message}</span>
        <button 
          className="status-action"
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </button>
      </div>
    </div>
  )
}