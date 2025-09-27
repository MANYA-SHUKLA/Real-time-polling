import { authService } from './auth';

export type WebSocketMessage = 
  | { type: 'connected'; message: string }
  | { type: 'subscription_confirmed'; pollId: string }
  | { type: 'vote_update'; pollId?: string; voteCounts: { [key: string]: number }; totalVotes: number }
  | { type: 'pong' }
  | { type: 'error'; message: string }
  | { type: string; [key: string]: unknown };

export interface WebSocketCallbacks {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onReconnect?: (attempt: number) => void;
  onMaxReconnectAttempts?: () => void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000; // 3 seconds
  private isManualClose = false;
  private pollId: string | null = null;
  private callbacks: WebSocketCallbacks = {};
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private url: string) {}

  connect(pollId: string, callbacks: WebSocketCallbacks = {}) {
    this.pollId = pollId;
    this.callbacks = callbacks;
    this.isManualClose = false;
    this.reconnectAttempts = 0;
    
    this._connect();
  }

  private _connect() {
    try {
      // Add authentication token if available
      const token = authService.getToken();
      const wsUrl = token ? `${this.url}?token=${encodeURIComponent(token)}` : this.url;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = (event) => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        
        // Subscribe to the poll
        this.subscribeToPoll(this.pollId!);
        
        // Start heartbeat
        this._startHeartbeat();
        
        if (this.callbacks.onOpen) {
          this.callbacks.onOpen(event);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this._stopHeartbeat();
        
        if (this.callbacks.onClose) {
          this.callbacks.onClose(event);
        }
        
        // Attempt reconnect unless manually closed or normal closure
        if (!this.isManualClose && event.code !== 1000) {
          this._attemptReconnect();
        }
      };
      
      this.ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        
        if (this.callbacks.onError) {
          this.callbacks.onError(event);
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this._handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this._attemptReconnect();
    }
  }

  private _handleMessage(message: WebSocketMessage) {
    console.log('WebSocket message received:', message);
    
    switch (message.type) {
      case 'connected':
        console.log('WebSocket connection confirmed:', message.message);
        break;
        
      case 'subscription_confirmed':
        console.log(`Subscription confirmed for poll ${message.pollId}`);
        break;
        
      case 'vote_update':
        console.log('Vote update received:', message);
        break;
        
      case 'pong':
        // Heartbeat response - no action needed
        break;
        
      case 'error':
        console.error('WebSocket error from server:', message.message);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
    
    if (this.callbacks.onMessage) {
      this.callbacks.onMessage(message);
    }
  }

  private _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      
      if (this.callbacks.onMaxReconnectAttempts) {
        this.callbacks.onMaxReconnectAttempts();
      }
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * this.reconnectAttempts;
    
    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    if (this.callbacks.onReconnect) {
      this.callbacks.onReconnect(this.reconnectAttempts);
    }
    
    setTimeout(() => {
      if (!this.isManualClose) {
        this._connect();
      }
    }, delay);
  }

  private _startHeartbeat() {
    // Send ping every 25 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 25000);
  }

  private _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  subscribeToPoll(pollId: string) {
    this.pollId = pollId;
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        pollId: pollId
      });
    }
  }

  unsubscribeFromPoll() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.pollId) {
      this.send({
        type: 'unsubscribe',
        pollId: this.pollId
      });
    }
    this.pollId = null;
  }

  send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  disconnect() {
    this.isManualClose = true;
    this.unsubscribeFromPoll();
    this._stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  getStatus(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'closed';
    }
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Create singleton instance
// Use env variable so production can point to Render backend.
// NEXT_PUBLIC_WS_URL should include protocol (wss:// for SSL) and path if needed, e.g. wss://your-backend.onrender.com
// Fallback to localhost for local dev.
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';
const websocketService = new WebSocketService(WS_BASE);

export { websocketService };