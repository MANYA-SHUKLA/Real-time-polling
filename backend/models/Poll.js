const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    validate: {
      validator: function(value) {
        // Expiration date must be in the future
        return !value || value > new Date();
      },
      message: 'Expiration date must be in the future'
    }
  },
  allowVotingAfterExpiry: {
    type: Boolean,
    default: false
  },
  showResultsAfterExpiry: {
    type: Boolean,
    default: true
  },
  autoArchive: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Virtual for options (one-to-many relationship)
pollSchema.virtual('options', {
  ref: 'PollOption',
  localField: '_id',
  foreignField: 'poll'
});

// Virtual for votes (through options)
pollSchema.virtual('votes', {
  ref: 'Vote',
  localField: '_id',
  foreignField: 'poll'
});

// Virtual for total votes count
pollSchema.virtual('totalVotes').get(async function() {
  const votes = await mongoose.model('Vote').countDocuments({ poll: this._id });
  return votes;
});

// Virtual for poll status
pollSchema.virtual('status').get(function() {
  if (!this.isPublished) return 'draft';
  if (this.expiresAt && new Date() > this.expiresAt) return 'expired';
  return 'active';
});

// Virtual for time remaining
pollSchema.virtual('timeRemaining').get(function() {
  if (!this.expiresAt) return null;
  
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  const diff = expiry - now;
  
  if (diff <= 0) return 'expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
});

// Virtual for isExpired
pollSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Virtual for canVote (considering expiry and settings)
pollSchema.virtual('canVote').get(function() {
  if (!this.isPublished) return false;
  if (this.isExpired) return this.allowVotingAfterExpiry;
  return true;
});

// Virtual for canViewResults (considering expiry and settings)
pollSchema.virtual('canViewResults').get(function() {
  if (this.isExpired) return this.showResultsAfterExpiry;
  return true; // Always show results for active polls
});

// Middleware to handle expiry
pollSchema.pre('save', function(next) {
  // If expiresAt is set but in the past, don't allow saving
  if (this.expiresAt && new Date(this.expiresAt) <= new Date()) {
    return next(new Error('Expiration date must be in the future'));
  }
  next();
});

// Static method to find active polls (not expired)
pollSchema.statics.findActive = function() {
  return this.find({
    isPublished: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to find expired polls
pollSchema.statics.findExpired = function() {
  return this.find({
    isPublished: true,
    expiresAt: { $lte: new Date() }
  });
};

// Static method to cleanup expired polls (auto-archive)
pollSchema.statics.cleanupExpiredPolls = async function() {
  const expiredPolls = await this.findExpired();
  
  for (const poll of expiredPolls) {
    if (poll.autoArchive) {
      poll.isPublished = false; // Archive the poll
      await poll.save();
    }
  }
  
  return expiredPolls.length;
};

// Index for better query performance
pollSchema.index({ isPublished: 1, expiresAt: 1, createdAt: -1 });
pollSchema.index({ creator: 1 });
pollSchema.index({ expiresAt: 1 }); // For expiry queries
// Removed index on virtual 'status' field - virtuals can't be indexed

// Ensure virtual fields are serialized
pollSchema.set('toJSON', { virtuals: true });
pollSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Poll', pollSchema);