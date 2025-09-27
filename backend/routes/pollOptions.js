const express = require('express');
const PollOption = require('../models/PollOption');
const Vote = require('../models/Vote');
const router = express.Router();

// Get all options (with optional poll filter)
router.get('/', async (req, res) => {
  try {
    const { poll } = req.query;
    let query = {};
    
    if (poll) {
      query.poll = poll;
    }

    const options = await PollOption.find(query).populate('poll');
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single option
router.get('/:id', async (req, res) => {
  try {
    const option = await PollOption.findById(req.params.id).populate('poll');
    
    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    // Get vote count for this option
    const voteCount = await Vote.countDocuments({ pollOption: option._id });

    const optionWithVotes = {
      ...option.toObject(),
      votes: voteCount
    };

    res.json(optionWithVotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update option
router.put('/:id', async (req, res) => {
  try {
    const { text } = req.body;
    
    const option = await PollOption.findById(req.params.id);
    
    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    option.text = text;
    await option.save();

    res.json(option);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete option
router.delete('/:id', async (req, res) => {
  try {
    const option = await PollOption.findById(req.params.id);
    
    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    // Check if option has votes
    const voteCount = await Vote.countDocuments({ pollOption: option._id });
    if (voteCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete option that has votes',
        voteCount: voteCount
      });
    }

    await PollOption.findByIdAndDelete(req.params.id);
    res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;