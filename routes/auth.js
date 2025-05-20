const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Login and registration (same endpoint since they function the same with 6-digit code)
router.post('/login', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Validate the userId is a 6-digit number
    if (!userId || !userId.match(/^\d{6}$/)) {
      return res.status(400).render('index', { error: 'Please enter a 6-digit number' });
    }
    
    // Check if user exists
    let user = await User.findOne({ userId });
    
    // If not, create a new user (registration)
    if (!user) {
      try {
        user = await User.create({ userId });
        console.log(`Created new user with ID: ${userId}`);
      } catch (createErr) {
        console.error('Error creating user:', createErr);
        if (createErr.code === 11000) {
          // Try to find the user again in case it was created between our check and create
          user = await User.findOne({ userId });
          if (!user) {
            return res.status(400).render('index', { error: 'Error creating account. Please try again.' });
          }
        } else {
          return res.status(500).render('index', { error: 'Server error. Please try again.' });
        }
      }
    }
    
    // Set session
    req.session.userId = userId;
    
    // Redirect to dashboard
    res.redirect('/files/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('index', { error: 'Server error' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/files/dashboard');
    }
    res.redirect('/');
  });
});

module.exports = router; 