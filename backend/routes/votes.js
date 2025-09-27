const express = require('express');
const Vote = require('../models/Vote');
const Poll = require('../models/Poll');
const PollOption = require('../models/PollOption');
const { auth } = require('../middleware/auth');
const { voteValidation, handleValidationErrors } = require('../middleware/validation');
const { voteLimiter } = require('../middleware/rateLimit');
const router = express.Router();

// Submit vote with expiration check
router.post('/', auth, voteLimiter, voteValidation, handleValidationErrors, async (req, res) => {
  try {
    const { poll, pollOption } = req.body;
    const user = req.user._id;

    // Check if poll exists
    const pollDoc = await Poll.findById(poll);
    if (!pollDoc) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if poll is published
    if (!pollDoc.isPublished) {
      return res.status(400).json({ error: 'Cannot vote on an unpublished poll' });
    }

    // Check if poll is expired and voting is allowed after expiry
    if (pollDoc.isExpired && !pollDoc.allowVotingAfterExpiry) {
      return res.status(400).json({ 
        error: 'This poll has expired',
        expiredAt: pollDoc.expiresAt,
        canViewResults: pollDoc.canViewResults
      });
    }

    // Check if poll option exists and belongs to poll
    const optionDoc = await PollOption.findOne({ _id: pollOption, poll: poll });
    if (!optionDoc) {
      return res.status(400).json({ error: 'Invalid poll option or option does not belong to this poll' });
    }

    // Check if user already voted on this poll
    const existingVote = await Vote.findOne({ user, poll });
    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted on this poll' });
    }

    const vote = new Vote({
      user,
      poll,
      pollOption
    });

    await vote.save();

    // Get updated vote counts
    const votes = await Vote.find({ poll });
    const options = await PollOption.find({ poll });
    
    const voteCounts = {};
    options.forEach(option => {
      voteCounts[option._id] = votes.filter(v => v.pollOption.toString() === option._id.toString()).length;
    });

    // Broadcast real-time update
    const broadcastData = {
      type: 'vote_update',
      pollId: poll,
      voteCounts,
      totalVotes: votes.length,
      isExpired: pollDoc.isExpired
    };

    req.app.locals.broadcastToPoll(poll, broadcastData);

    res.status(201).json({
      message: 'Vote submitted successfully',
      voteCounts,
      totalVotes: votes.length,
      pollStatus: pollDoc.status,
      expiresAt: pollDoc.expiresAt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;