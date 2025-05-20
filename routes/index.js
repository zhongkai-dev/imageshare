const express = require('express');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
  // If user is logged in, redirect to dashboard
  if (req.session.userId) {
    return res.redirect('/files/dashboard');
  }
  
  // Otherwise show login/registration page
  res.render('index');
});

module.exports = router; 