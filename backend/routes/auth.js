const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const { 
  handleValidationErrors, 
  registerValidation, 
  loginValidation,
  emailValidation,
  passwordResetValidation,
  changePasswordValidation,
  updateProfileValidation
} = require('../middleware/validation');
const { authLimiter, strictLimiter } = require('../middleware/rateLimit');
const { sendNotificationEmail } = require('../utils/mailer');
const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Helper function to send response with token
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id, user.email);
  
  const userResponse = user.getPublicProfile();
  userResponse.token = token;

  res.status(statusCode).json(userResponse);
};

// Register new user
router.post('/register', authLimiter, registerValidation, handleValidationErrors, async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // In a real application, you would send an email here
    console.log(`Email verification token for ${user.email}: ${verificationToken}`);
    console.log(`Verification URL: http://localhost:3000/verify-email?token=${verificationToken}`);

    sendTokenResponse(user, 201, res);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: Object.values(error.errors).map(e => e.message)
      });
    }
    res.status(400).json({ error: error.message });
  }
});

// Login user
router.post('/login', authLimiter, loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user (case-insensitive email search)
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000); // minutes
      return res.status(423).json({ 
        error: 'Account temporarily locked',
        message: `Too many failed login attempts. Try again in ${lockTime} minutes.`
      });
    }

    // Check password
    const isPasswordValid = await user.checkPassword(password);
    if (!isPasswordValid) {
      await user.save(); // Save login attempts
      
      const attemptsLeft = 5 - user.loginAttempts;
      return res.status(401).json({ 
        error: 'Invalid email or password',
        attemptsLeft: attemptsLeft > 0 ? attemptsLeft : 0
      });
    }

    await user.save(); // Save last login and reset attempts

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.clearVerificationToken();
    await user.save();

    res.json({ 
      message: 'Email verified successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Resend verification email
router.post('/resend-verification', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Check if verification token is still valid
    if (user.emailVerificationExpires > Date.now()) {
      const timeLeft = Math.ceil((user.emailVerificationExpires - Date.now()) / 60000);
      return res.status(400).json({ 
        error: 'Verification email already sent',
        message: `Please check your email. You can request a new verification email in ${timeLeft} minutes.`
      });
    }

    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // In a real application, you would send an email here
    console.log(`New email verification token for ${user.email}: ${verificationToken}`);

    res.json({ 
      message: 'Verification email sent successfully',
      expiresIn: '24 hours'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Forgot password - generate reset token
router.post('/forgot-password', authLimiter, emailValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don't reveal whether email exists or not
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // In a real application, you would send an email here
    console.log(`Password reset token for ${user.email}: ${resetToken}`);
    console.log(`Reset URL: http://localhost:3000/reset-password?token=${resetToken}`);

    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.',
      expiresIn: '1 hour'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset password with token
router.post('/reset-password', passwordResetValidation, handleValidationErrors, async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    user.password = password;
    user.clearPasswordResetToken();
    user.loginAttempts = 0; // Reset login attempts
    user.lockUntil = undefined;
    await user.save();

    res.json({ 
      message: 'Password reset successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Change password (authenticated)
router.put('/change-password', auth, strictLimiter, changePasswordValidation, handleValidationErrors, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const user = await User.findById(req.user._id);
    
    const isCurrentPasswordValid = await user.checkPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      await user.save(); // Track failed attempt
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    // WebSocket notify user
    try {
      req.app.locals.broadcastToUser && req.app.locals.broadcastToUser(req.user._id, 'password_changed', {
        message: 'Password changed successfully'
      });
    } catch (notifyErr) {
      console.error('Password change notification error:', notifyErr.message);
    }

    // Send email notification
    try {
      await sendNotificationEmail(req.user, 'password_changed');
    } catch (emailErr) {
      console.error('Password change email notification error:', emailErr.message);
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    res.json(req.user.getPublicProfile());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, updateProfileValidation, handleValidationErrors, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (email && email !== user.email) {
      // Check if new email is already taken
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already taken' });
      }
      user.email = email.toLowerCase().trim();
      user.isVerified = false; // Require re-verification if email changes
    }

    if (name) user.name = name.trim();
    
    await user.save();

    // Determine which fields changed for notification context
    const changed = [];
    if (name) changed.push('name');
    if (email && email.toLowerCase().trim() !== req.user.email.toLowerCase()) changed.push('email');
    
    // WebSocket notification
    try {
      if (changed.length && req.app.locals.broadcastToUser) {
        req.app.locals.broadcastToUser(req.user._id, 'profile_updated', {
          changedFields: changed
        });
      }
    } catch (notifyErr) {
      console.error('Profile update notification error:', notifyErr.message);
    }

    // Email notification
    try {
      if (changed.length > 0) {
        await sendNotificationEmail(user, 'profile_updated', { changedFields: changed });
      }
    } catch (emailErr) {
      console.error('Profile update email notification error:', emailErr.message);
    }

    res.json(user.getPublicProfile());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete user account
router.delete('/account', auth, strictLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // In a real application, you might want to soft delete or archive the user
    // For now, we'll delete the user and their associated data
    await User.findByIdAndDelete(req.user._id);

    res.json({ 
      message: 'Account deleted successfully',
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Logout (client-side token invalidation)
router.post('/logout', auth, (req, res) => {
  // Since JWT is stateless, logout is handled client-side by removing the token
  // In a real application, you might want to maintain a blacklist of tokens
  res.json({ message: 'Logged out successfully' });
});

// Check token validity
router.get('/check-token', auth, (req, res) => {
  res.json({ 
    valid: true,
    user: req.user.getPublicProfile(),
    expiresIn: 'Token is valid'
  });
});

// Admin-only: Get all users (for admin purposes)
router.get('/users', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const users = await User.find().select('-passwordHash -emailVerificationToken -passwordResetToken');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;