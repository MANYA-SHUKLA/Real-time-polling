const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  poll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
pollOptionSchema.index({ poll: 1 });

module.exports = mongoose.model('PollOption', pollOptionSchema);