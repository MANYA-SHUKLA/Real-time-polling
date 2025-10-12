const rateLimit = require('express-rate-limit');
const userVoteStore = new Map();

const userVoteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // limit each user to 3 votes per minute
  message: {
    error: 'Too many votes from your account, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, fallback to IP
    return req.user ? req.user._id.toString() : req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many votes',
      message: 'Please wait a moment before voting again',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) - Math.floor(Date.now() / 1000)
    });
  }
});

// IP-based rate limiter for additional protection
const ipVoteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 votes per minute
  message: {
    error: 'Too many votes from this IP address.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many votes from this network',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) - Math.floor(Date.now() / 1000)
    });
  }
});

// Global rate limiter - disabled in development
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000, // very high limit
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Always skip rate limiting in non-production environments
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment && req.url.includes('/api/polls')) {
      console.log('🚀 Development mode: Skipping general rate limiting for polls');
    }
    return isDevelopment;
  }
});

// Strict rate limiter for sensitive operations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter - disabled in development
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // very high limit for development
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  skip: (req) => {
    // Skip rate limiting in development
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      console.log('🚀 Development mode: Skipping auth rate limiting');
    }
    return isDevelopment;
  }
});

// Poll creation rate limiter - disabled in development
const pollCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // very high limit
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  },
  message: {
    error: 'Too many polls created. Please wait before creating another poll.'
  },
  skip: (req) => {
    // Always skip rate limiting in non-production environments
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      console.log('🚀 Development mode: Skipping poll creation rate limiting');
    }
    return isDevelopment;
  }
});

// Custom store for more control (optional)
class CustomStore {
  constructor() {
    this.hits = new Map();
  }

  async increment(key) {
    const now = Math.floor(Date.now() / 1000);
    const current = this.hits.get(key) || { count: 0, resetTime: now + 60 };
    
    if (now > current.resetTime) {
      current.count = 1;
      current.resetTime = now + 60;
    } else {
      current.count += 1;
    }
    
    this.hits.set(key, current);
    return {
      totalHits: current.count,
      resetTime: current.resetTime
    };
  }

  async decrement(key) {
    const current = this.hits.get(key);
    if (current) {
      current.count = Math.max(0, current.count - 1);
      this.hits.set(key, current);
    }
  }

  async resetKey(key) {
    this.hits.delete(key);
  }
}

// Enhanced vote limiter with custom store
const enhancedVoteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // maximum votes per window
  store: new CustomStore(),
  keyGenerator: (req) => {
    // Combine user ID and poll ID for per-poll rate limiting
    const pollId = req.body.poll;
    const userId = req.user ? req.user._id.toString() : req.ip;
    return `vote:${userId}:${pollId}`;
  },
  skip: (req) => {
    // Skip rate limiting for certain conditions (admin users, etc.)
    return req.user && req.user.role === 'admin';
  },
  handler: (req, res) => {
    const resetTime = Math.ceil(req.rateLimit.resetTime / 1000);
    const currentTime = Math.floor(Date.now() / 1000);
    const retryAfter = resetTime - currentTime;
    
    res.status(429).json({
      error: 'Vote rate limit exceeded',
      message: `Please wait ${retryAfter} seconds before voting again`,
      retryAfter,
      limit: req.rateLimit.limit,
      remaining: 0,
      reset: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

module.exports = {
  generalLimiter,
  strictLimiter,
  authLimiter,
  userVoteLimiter,
  ipVoteLimiter,
  pollCreationLimiter,
  enhancedVoteLimiter,
  voteLimiter: enhancedVoteLimiter // Default to enhanced version
};
