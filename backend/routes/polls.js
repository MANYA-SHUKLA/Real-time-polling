const express = require('express');
const { body } = require('express-validator'); // Added for extend route validation
const Poll = require('../models/Poll');
const PollOption = require('../models/PollOption');
const Vote = require('../models/Vote');
const { auth, optionalAuth } = require('../middleware/auth');
const { 
  handleValidationErrors, 
  createPollValidation, 
  pollIdValidation,
  pollQueryValidation,
  updatePollValidation 
} = require('../middleware/validation');
const { pollCreationLimiter } = require('../middleware/rateLimit');
const { sendNotificationEmail } = require('../utils/mailer');
const router = express.Router();

// Create poll with options (including expiration)
router.post('/', auth, pollCreationLimiter, createPollValidation, handleValidationErrors, async (req, res) => {
  const session = await Poll.startSession();
  session.startTransaction();

  try {
    const { 
      question, 
      options, 
      isPublished = false,
      expiresAt,
      allowVotingAfterExpiry = false,
      showResultsAfterExpiry = true,
      autoArchive = false
    } = req.body;

    // Validate input
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options are required' });
    }

    // Validate expiration date
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return res.status(400).json({ error: 'Expiration date must be in the future' });
    }

    // Create the poll
    const poll = new Poll({
      question,
      creator: req.user._id,
      isPublished,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      allowVotingAfterExpiry,
      showResultsAfterExpiry,
      autoArchive
    });

    await poll.save({ session });

    // Create poll options
    const pollOptions = await PollOption.insertMany(
      options.filter(opt => opt.trim() !== '').map(optionText => ({
        text: optionText,
        poll: poll._id
      })),
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Populate the poll with options and creator
    const populatedPoll = await Poll.findById(poll._id)
      .populate('creator', 'name email')
      .populate('options');

    // Notify creator about poll creation (draft or published)
    try {
      req.app.locals.broadcastToUser && req.app.locals.broadcastToUser(req.user._id, 'poll_created', {
        pollId: populatedPoll._id,
        question: populatedPoll.question,
        status: populatedPoll.isPublished ? 'published' : 'draft'
      });
    } catch (notifyErr) {
      console.error('Poll creation notification error:', notifyErr.message);
    }

    // Send email notification
    try {
      await sendNotificationEmail(req.user, 'poll_created', {
        pollId: populatedPoll._id,
        question: populatedPoll.question,
        status: populatedPoll.isPublished ? 'published' : 'draft'
      });
    } catch (emailErr) {
      console.error('Poll creation email notification error:', emailErr.message);
    }

    res.status(201).json(populatedPoll);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
});

// Get all polls with expiration support
router.get('/', optionalAuth, pollQueryValidation, handleValidationErrors, async (req, res) => {
  try {
    let { 
      published, 
      includeUnpublished = false, 
      myPolls = false,
      status = 'active',
      page = 1,
      limit = 20
    } = req.query;

    // Normalize booleans from query (which arrive as strings)
    const boolFrom = v => (v === true || v === 'true');
    includeUnpublished = boolFrom(includeUnpublished);
    myPolls = boolFrom(myPolls);

    // Parse numeric pagination early and validate
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 20;

    // Build query based on parameters
    let query = {};

    // Status-based filtering
    if (status !== 'all') {
      switch (status) {
        case 'active':
          query.isPublished = true;
          query.$or = [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ];
          break;
        case 'expired':
          query.isPublished = true;
          query.expiresAt = { $lte: new Date() };
          break;
        case 'draft':
          query.isPublished = false;
          break;
      }
    } else {
      // status === 'all'
      if (published === 'true') {
        query.isPublished = true;
      } else if (published === 'false') {
        // Only include unpublished if explicitly requested
        if (includeUnpublished) {
          query.isPublished = false;
        } else {
          // fallback: show only published if not allowed to see drafts
          query.isPublished = true;
        }
      }
    }

    // If myPolls is true and user is authenticated, show only user's polls
    if (myPolls && req.user) {
      query.creator = req.user._id;
    } else if (myPolls && !req.user) {
      return res.status(401).json({ error: 'Authentication required to view your polls' });
    }

    const skip = (page - 1) * limit;

    const polls = await Poll.find(query)
      .populate('creator', 'name email')
      .populate('options')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Poll.countDocuments(query);    // Get vote counts for each poll and its options
    const pollsWithVotes = await Promise.all(
      polls.map(async (poll) => {
        try {
          const votes = await Vote.find({ poll: poll._id });
          
          let userVoted = false;
          let userVoteOption = null;
          if (req.user) {
            const userVote = await Vote.findOne({ poll: poll._id, user: req.user._id });
            userVoted = !!userVote;
            userVoteOption = userVote ? userVote.pollOption.toString() : null;
          }

        const optionVotes = {};
        votes.forEach(vote => {
          const optionId = vote.pollOption.toString();
          optionVotes[optionId] = (optionVotes[optionId] || 0) + 1;
        });

        const pollObj = poll.toObject();
        pollObj.options = pollObj.options.map(option => ({
          ...option,
          votes: optionVotes[option._id] || 0
        }));

        pollObj.totalVotes = votes.length;
        pollObj.userVoted = userVoted;
        pollObj.userVoteOption = userVoteOption;

        return pollObj;
        } catch (pollError) {
          console.error('Error processing poll:', poll._id, pollError);
          // Return basic poll data without vote counts on error
          const pollObj = poll.toObject();
          pollObj.totalVotes = 0;
          pollObj.userVoted = false;
          pollObj.userVoteOption = null;
          if (pollObj.options) {
            pollObj.options = pollObj.options.map(option => ({
              ...option,
              votes: 0
            }));
          }
          return pollObj;
        }
      })
    );

    res.json({
      polls: pollsWithVotes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        status,
        myPolls
      }
    });
  } catch (error) {
    console.error('Error in GET /api/polls:', error);
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

// Get single poll with options and vote counts
router.get('/:id', optionalAuth, pollIdValidation, handleValidationErrors, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id)
      .populate('creator', 'name email')
      .populate('options');

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Only return published polls unless explicitly requested by creator
    if (!poll.isPublished) {
      if (!req.user || poll.creator._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'This poll is not published' });
      }
    }

    // Get votes for this poll
    const votes = await Vote.find({ poll: poll._id });
    
    // Check if current user has voted on this poll
    let userVoted = false;
    let userVoteOption = null;
    if (req.user) {
      const userVote = await Vote.findOne({ poll: poll._id, user: req.user._id });
      userVoted = !!userVote;
      userVoteOption = userVote ? userVote.pollOption.toString() : null;
    }

    // Count votes per option
    const optionVotes = {};
    votes.forEach(vote => {
      const optionId = vote.pollOption.toString();
      optionVotes[optionId] = (optionVotes[optionId] || 0) + 1;
    });

    // Add vote counts to options
    const pollObj = poll.toObject();
    pollObj.options = pollObj.options.map(option => ({
      ...option,
      votes: optionVotes[option._id] || 0
    }));

    pollObj.totalVotes = votes.length;
    pollObj.userVoted = userVoted;
    pollObj.userVoteOption = userVoteOption;

    res.json(pollObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get polls expiring soon (within 24 hours)
router.get('/expiring-soon', optionalAuth, async (req, res) => {
  try {
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const expiringPolls = await Poll.find({
      isPublished: true,
      expiresAt: {
        $gte: new Date(),
        $lte: twentyFourHoursFromNow
      }
    })
    .populate('creator', 'name email')
    .populate('options')
    .sort({ expiresAt: 1 });

    res.json(expiringPolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update poll question and settings (authenticated - must be creator)
router.put('/:id', auth, pollIdValidation, updatePollValidation, handleValidationErrors, async (req, res) => {
  const session = await Poll.startSession();
  session.startTransaction();

  try {
    const { 
      question, 
      isPublished, 
      options,
      expiresAt,
      allowVotingAfterExpiry,
      showResultsAfterExpiry,
      autoArchive
    } = req.body;
    
    const poll = await Poll.findById(req.params.id).session(session);
    
    if (!poll) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is the creator
    if (poll.creator.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: 'Access denied. You can only update your own polls.' });
    }

    // Check if poll has votes (restrict certain changes)
    const voteCount = await Vote.countDocuments({ poll: poll._id }).session(session);
    
    // Update basic poll information
    if (question) poll.question = question;
    if (typeof isPublished === 'boolean') poll.isPublished = isPublished;
    
    // Update expiration settings
    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === '') {
        poll.expiresAt = null;
      } else {
        const newExpiry = new Date(expiresAt);
        if (newExpiry <= new Date()) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'Expiration date must be in the future' });
        }
        poll.expiresAt = newExpiry;
      }
    }
    
    if (typeof allowVotingAfterExpiry === 'boolean') {
      poll.allowVotingAfterExpiry = allowVotingAfterExpiry;
    }
    
    if (typeof showResultsAfterExpiry === 'boolean') {
      poll.showResultsAfterExpiry = showResultsAfterExpiry;
    }
    
    if (typeof autoArchive === 'boolean') {
      poll.autoArchive = autoArchive;
    }
    
    // Update options if provided (only if no votes exist)
    if (options && Array.isArray(options)) {
      if (voteCount > 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          error: 'Cannot modify options after votes have been cast',
          currentVotes: voteCount
        });
      }

      // Delete existing options
      await PollOption.deleteMany({ poll: poll._id }).session(session);
      
      // Create new options
      await PollOption.insertMany(
        options.filter(opt => opt.trim() !== '').map(optionText => ({
          text: optionText,
          poll: poll._id
        })),
        { session }
      );
    }

    poll.updatedAt = new Date();
    await poll.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate and return updated poll
    const updatedPoll = await Poll.findById(poll._id)
      .populate('creator', 'name email')
      .populate('options');

    // Get updated vote counts
    const votes = await Vote.find({ poll: poll._id });
    const optionVotes = {};
    votes.forEach(vote => {
      const optionId = vote.pollOption.toString();
      optionVotes[optionId] = (optionVotes[optionId] || 0) + 1;
    });

    const pollObj = updatedPoll.toObject();
    pollObj.options = pollObj.options.map(option => ({
      ...option,
      votes: optionVotes[option._id] || 0
    }));
    pollObj.totalVotes = votes.length;

    try {
      req.app.locals.broadcastToUser && req.app.locals.broadcastToUser(req.user._id, 'poll_updated', {
        pollId: pollObj._id,
        question: pollObj.question,
        isPublished: pollObj.isPublished
      });
    } catch (notifyErr) {
      console.error('Poll update notification error:', notifyErr.message);
    }

    // Send email notification
    try {
      await sendNotificationEmail(req.user, 'poll_updated', {
        pollId: pollObj._id,
        question: pollObj.question
      });
    } catch (emailErr) {
      console.error('Poll update email notification error:', emailErr.message);
    }

    res.json({
      message: 'Poll updated successfully',
      poll: pollObj
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
});

// Partial update poll (PATCH) - for specific fields
router.patch('/:id', auth, pollIdValidation, handleValidationErrors, async (req, res) => {
  try {
    const { question, isPublished, expiresAt } = req.body;
    
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is the creator
    if (poll.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only update your own polls.' });
    }

    const updates = {};
    if (question !== undefined) updates.question = question;
    if (isPublished !== undefined) updates.isPublished = isPublished;
    
    // Handle expiration date update
    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === '') {
        updates.expiresAt = null;
      } else {
        const newExpiry = new Date(expiresAt);
        if (newExpiry <= new Date()) {
          return res.status(400).json({ error: 'Expiration date must be in the future' });
        }
        updates.expiresAt = newExpiry;
      }
    }
    
    // Check if there are any valid updates
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.updatedAt = new Date();
    
    const updatedPoll = await Poll.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('creator', 'name email').populate('options');

    res.json({
      message: 'Poll updated successfully',
      poll: updatedPoll
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Extend poll expiration
router.patch('/:id/extend', auth, pollIdValidation, [
  body('newExpiry')
    .notEmpty().withMessage('New expiration date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      const newDate = new Date(value);
      if (newDate <= new Date()) {
        throw new Error('New expiration date must be in the future');
      }
      return true;
    })
], handleValidationErrors, async (req, res) => {
  try {
    const { newExpiry } = req.body;
    
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is the creator
    if (poll.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only extend your own polls.' });
    }

    // Check if poll is already expired
    if (poll.isExpired) {
      return res.status(400).json({ error: 'Cannot extend an expired poll' });
    }

    const newExpiryDate = new Date(newExpiry);
    
    // Ensure new expiry is after current expiry (if exists)
    if (poll.expiresAt && newExpiryDate <= poll.expiresAt) {
      return res.status(400).json({ error: 'New expiration date must be after current expiration date' });
    }

    poll.expiresAt = newExpiryDate;
    poll.updatedAt = new Date();
    await poll.save();

    await poll.populate('creator', 'name email');
    await poll.populate('options');

    res.json({
      message: 'Poll expiration extended successfully',
      poll: poll,
      newExpiry: poll.expiresAt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Publish a poll (authenticated - must be creator)
router.patch('/:id/publish', auth, pollIdValidation, handleValidationErrors, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is the creator
    if (poll.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only publish your own polls.' });
    }

    if (poll.isPublished) {
      return res.status(400).json({ error: 'Poll is already published' });
    }

    poll.isPublished = true;
    poll.updatedAt = new Date();
    await poll.save();

    await poll.populate('creator', 'name email');
    await poll.populate('options');

    try {
      req.app.locals.broadcastToUser && req.app.locals.broadcastToUser(req.user._id, 'poll_published', {
        pollId: poll._id,
        question: poll.question
      });
    } catch (notifyErr) {
      console.error('Poll publish notification error:', notifyErr.message);
    }

    // Send email notification
    try {
      await sendNotificationEmail(req.user, 'poll_published', {
        pollId: poll._id,
        question: poll.question
      });
    } catch (emailErr) {
      console.error('Poll publish email notification error:', emailErr.message);
    }

    res.json({
      message: 'Poll published successfully',
      poll: poll
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Unpublish a poll (authenticated - must be creator)
router.patch('/:id/unpublish', auth, pollIdValidation, handleValidationErrors, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is the creator
    if (poll.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only unpublish your own polls.' });
    }

    if (!poll.isPublished) {
      return res.status(400).json({ error: 'Poll is already unpublished' });
    }

    poll.isPublished = false;
    poll.updatedAt = new Date();
    await poll.save();

    await poll.populate('creator', 'name email');
    await poll.populate('options');

    try {
      req.app.locals.broadcastToUser && req.app.locals.broadcastToUser(req.user._id, 'poll_unpublished', {
        pollId: poll._id,
        question: poll.question
      });
    } catch (notifyErr) {
      console.error('Poll unpublish notification error:', notifyErr.message);
    }

    // Send email notification
    try {
      await sendNotificationEmail(req.user, 'poll_unpublished', {
        pollId: poll._id,
        question: poll.question
      });
    } catch (emailErr) {
      console.error('Poll unpublish email notification error:', emailErr.message);
    }

    res.json({
      message: 'Poll unpublished successfully',
      poll: poll
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Archive an expired poll (authenticated - must be creator)
router.patch('/:id/archive', auth, pollIdValidation, handleValidationErrors, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is the creator
    if (poll.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only archive your own polls.' });
    }

    if (!poll.isExpired) {
      return res.status(400).json({ error: 'Only expired polls can be archived' });
    }

    if (!poll.isPublished) {
      return res.status(400).json({ error: 'Poll is already archived' });
    }

    poll.isPublished = false;
    poll.updatedAt = new Date();
    await poll.save();

    await poll.populate('creator', 'name email');
    await poll.populate('options');

    res.json({
      message: 'Poll archived successfully',
      poll: poll
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete poll and its associated data (authenticated - must be creator)
router.delete('/:id', auth, pollIdValidation, handleValidationErrors, async (req, res) => {
  const session = await Poll.startSession();
  session.startTransaction();

  try {
    const poll = await Poll.findById(req.params.id).session(session);
    
    if (!poll) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is the creator
    if (poll.creator.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: 'Access denied. You can only delete your own polls.' });
    }

    // Get poll info for response before deletion
    const pollInfo = {
      id: poll._id,
      question: poll.question,
      totalVotes: await Vote.countDocuments({ poll: poll._id }).session(session),
      status: poll.status,
      expiresAt: poll.expiresAt,
      createdAt: poll.createdAt
    };

    // Delete associated votes
    await Vote.deleteMany({ poll: poll._id }, { session });
    
    // Delete associated options
    await PollOption.deleteMany({ poll: poll._id }, { session });
    
    // Delete the poll
    await Poll.findByIdAndDelete(req.params.id, { session });

    await session.commitTransaction();
    session.endSession();

    try {
      req.app.locals.broadcastToUser && req.app.locals.broadcastToUser(req.user._id, 'poll_deleted', {
        pollId: pollInfo.id,
        question: pollInfo.question
      });
    } catch (notifyErr) {
      console.error('Poll deletion notification error:', notifyErr.message);
    }

    // Send email notification
    try {
      await sendNotificationEmail(req.user, 'poll_deleted', {
        pollId: pollInfo.id,
        question: pollInfo.question
      });
    } catch (emailErr) {
      console.error('Poll deletion email notification error:', emailErr.message);
    }

    res.json({
      message: 'Poll deleted successfully',
      deletedPoll: pollInfo,
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
});

// Get poll statistics
router.get('/:id/stats', auth, pollIdValidation, handleValidationErrors, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is the creator
    if (poll.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only view stats for your own polls.' });
    }

    const votes = await Vote.find({ poll: poll._id }).populate('user', 'name email');
    const options = await PollOption.find({ poll: poll._id });
    
    const stats = {
      poll: {
        id: poll._id,
        question: poll.question,
        isPublished: poll.isPublished,
        status: poll.status,
        expiresAt: poll.expiresAt,
        timeRemaining: poll.timeRemaining,
        allowVotingAfterExpiry: poll.allowVotingAfterExpiry,
        showResultsAfterExpiry: poll.showResultsAfterExpiry,
        autoArchive: poll.autoArchive,
        createdAt: poll.createdAt,
        updatedAt: poll.updatedAt
      },
      votes: {
        total: votes.length,
        perOption: options.map(option => ({
          optionId: option._id,
          optionText: option.text,
          votes: votes.filter(v => v.pollOption.toString() === option._id.toString()).length,
          percentage: votes.length > 0 ? 
            Math.round((votes.filter(v => v.pollOption.toString() === option._id.toString()).length / votes.length) * 100) : 0
        })),
        recentVotes: votes.slice(-10).map(vote => ({
          user: vote.user.name,
          votedAt: vote.createdAt
        }))
      },
      participation: {
        uniqueVoters: new Set(votes.map(v => v.user._id.toString())).size,
        votingRate: votes.length > 0 ? Math.round((new Set(votes.map(v => v.user._id.toString())).size / votes.length) * 100) : 0
      },
      timeline: {
        votesPerHour: getVotesPerHour(votes),
        peakVotingTime: getPeakVotingTime(votes)
      }
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup expired polls (admin endpoint)
router.post('/cleanup/expired', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const cleanedCount = await Poll.cleanupExpiredPolls();
    
    res.json({
      message: `Cleaned up ${cleanedCount} expired polls`,
      cleanedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for statistics
function getVotesPerHour(votes) {
  const votesByHour = {};
  votes.forEach(vote => {
    const hour = new Date(vote.createdAt).getHours();
    votesByHour[hour] = (votesByHour[hour] || 0) + 1;
  });
  return votesByHour;
}

function getPeakVotingTime(votes) {
  if (votes.length === 0) return null;
  
  const votesByHour = getVotesPerHour(votes);
  let peakHour = 0;
  let maxVotes = 0;
  
  Object.entries(votesByHour).forEach(([hour, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      peakHour = parseInt(hour);
    }
  });
  
  return {
    hour: peakHour,
    votes: maxVotes,
    time: `${peakHour}:00 - ${peakHour + 1}:00`
  };
}

module.exports = router;