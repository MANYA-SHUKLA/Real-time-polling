const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const hpp = require('hpp');
require('dotenv').config();
const { 
  generalLimiter, 
  authLimiter,
  pollCreationLimiter 
} = require('./middleware/rateLimit');

const app = express();
const server = http.createServer(app);

// WebSocket Server with ping/pong for connection health
const wss = new WebSocket.Server({ 
  server,
  clientTracking: true,
  perMessageDeflate: false
});

// Security middleware
app.use(helmet()); // Set security headers
// Removed express-mongo-sanitize due to incompatibility (attempted to reassign req.query getter under Express 5)
// Implement lightweight custom sanitizer that strips Mongo operators from body/params/query without reassigning objects.
function deepSanitize(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return;
  Object.keys(obj).forEach(key => {
    // Remove any key starting with $ or containing a dot to prevent operator injection
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      return;
    }
    const val = obj[key];
    if (typeof val === 'string') {
      // Strip leading $ usage inside values that might be used for operator injection
      let cleaned = val
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // remove script tags
        .replace(/<[^>]*>/g, '') // strip remaining HTML tags
        .replace(/\$/g, ''); // remove $ characters
      // Collapse excessive whitespace
      cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
      obj[key] = cleaned;
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (typeof item === 'string') {
          let cleanedItem = item
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\$/g, '')
            .replace(/\s{2,}/g, ' ').trim();
          val[i] = cleanedItem;
        } else if (typeof item === 'object') {
          deepSanitize(item, depth + 1);
        }
      });
    } else if (typeof val === 'object') {
      deepSanitize(val, depth + 1);
    }
  });
}

app.use((req, _res, next) => {
  if (req.body) deepSanitize(req.body);
  if (req.params) deepSanitize(req.params);
  // For query we only mutate existing object, never reassign (avoids getter only issue)
  if (req.query) deepSanitize(req.query);
  next();
});
app.use(hpp()); // Prevent parameter pollution

// Apply rate limiting (more lenient in development)
if (process.env.NODE_ENV === 'production') {
  app.use(generalLimiter);
} else {
  console.log('Development mode: Rate limiting is relaxed');
  // Still apply rate limiting but with much higher limits for development
  app.use(generalLimiter);
}

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10kb' })); // Limit body size

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/polling-app')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));
// Routes with specific rate limiting
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/polls', pollCreationLimiter, require('./routes/polls')); // Limit poll creation
app.use('/api/votes', require('./routes/votes')); // Vote limiting applied in route
app.use('/api/users', require('./routes/users'));
app.use('/api/options', require('./routes/pollOptions'));
// WebSocket connection handling with authentication and error handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket client connected');
  
  // Validate and sanitize WebSocket URL parameters
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = decoded.userId;
      console.log(`Authenticated WebSocket connection for user ${decoded.userId}`);
    }
  } catch (error) {
    console.log('Invalid WebSocket token or URL');
    ws.close(1008, 'Invalid authentication');
    return;
  }

  // Set up heartbeat/ping-pong for connection health
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    try {
      // Validate message size
      if (message.length > 10000) { // 10KB max
        throw new Error('Message too large');
      }

      const data = JSON.parse(message);
      
      // Validate message structure
      if (!data.type || typeof data.type !== 'string') {
        throw new Error('Invalid message format: type is required');
      }

      // Sanitize message data
      const sanitizedData = sanitizeWebSocketMessage(data);
      
      switch (sanitizedData.type) {
        case 'subscribe':
          if (!sanitizedData.pollId || typeof sanitizedData.pollId !== 'string') {
            throw new Error('Invalid subscription: pollId is required');
          }
          ws.pollId = sanitizedData.pollId;
          console.log(`Client subscribed to poll ${sanitizedData.pollId}`);
          
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            pollId: sanitizedData.pollId,
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'unsubscribe':
          console.log(`Client unsubscribed from poll ${ws.pollId}`);
          ws.pollId = null;
          break;
          
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
          
        default:
          console.log('Unknown WebSocket message type:', sanitizedData.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket client disconnected. Code: ${code}, Reason: ${reason}`);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connection established',
    timestamp: new Date().toISOString()
  }));
});

// WebSocket message sanitization
function sanitizeWebSocketMessage(data) {
  const sanitized = { ...data };
  
  if (sanitized.pollId && typeof sanitized.pollId === 'string') {
    sanitized.pollId = sanitized.pollId.replace(/[^a-f0-9]/gi, ''); // Only allow hex characters for IDs
  }
  
  if (sanitized.type && typeof sanitized.type === 'string') {
    sanitized.type = sanitized.type.replace(/[^a-zA-Z_]/g, ''); // Only allow letters and underscores
  }
  
  return sanitized;
}

// Heartbeat interval
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating unresponsive WebSocket connection');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Cleanup on server shutdown
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Broadcast function with validation
const broadcastToPoll = (pollId, data) => {
  // Validate pollId format
  if (!mongoose.Types.ObjectId.isValid(pollId)) {
    console.error('Invalid poll ID for broadcast:', pollId);
    return 0;
  }

  let recipientCount = 0;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.pollId === pollId) {
      try {
        // Sanitize broadcast data
        const sanitizedData = JSON.parse(JSON.stringify(data)); // Deep clone
        client.send(JSON.stringify({
          ...sanitizedData,
          timestamp: new Date().toISOString()
        }));
        recipientCount++;
      } catch (error) {
        console.error('Error sending WebSocket message to client:', error);
      }
    }
  });
  
  console.log(`Broadcasted update to ${recipientCount} clients for poll ${pollId}`);
  return recipientCount;
};

app.locals.broadcastToPoll = broadcastToPoll;

// WebSocket status endpoint
app.get('/api/websocket/status', (req, res) => {
  const stats = {
    totalConnections: wss.clients.size,
    activeSubscriptions: Array.from(wss.clients).filter(client => client.pollId).length,
    uptime: process.uptime()
  };
  
  res.json(stats);
});

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Real-Time Polling API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404 handler (must appear after all other routes). Avoid explicit '*' string which breaks with newer path-to-regexp.
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      error: 'Duplicate entry',
      message: `${field} already exists`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  wss.clients.forEach(client => {
    client.close(1001, 'Server shutting down');
  });
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { broadcastToPoll, wss };