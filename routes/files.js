const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  next();
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(__dirname, '..', 'uploads', req.session.userId);
    
    // Create user directory if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Use original filename with timestamp to avoid duplicates
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Dashboard - Show user's files
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const files = await File.find({ userId: req.session.userId }).sort({ uploadDate: -1 });
    res.render('dashboard', { 
      userId: req.session.userId,
      files
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('dashboard', { 
      userId: req.session.userId,
      files: [],
      error: 'Failed to load files'
    });
  }
});

// Upload multiple files
router.post('/upload', isAuthenticated, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).redirect('/files/dashboard');
    }

    // Save each file info to database
    const filePromises = req.files.map(file => {
      return File.create({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        userId: req.session.userId
      });
    });

    await Promise.all(filePromises);
    res.redirect('/files/dashboard');
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).redirect('/files/dashboard');
  }
});

// View image file (for previews)
router.get('/view/:id', isAuthenticated, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    // Check if file exists and belongs to the user
    if (!file || file.userId !== req.session.userId) {
      return res.status(404).send('File not found');
    }
    
    // Check if file exists on disk
    if (!fs.existsSync(file.path)) {
      await File.findByIdAndDelete(req.params.id);
      return res.status(404).send('File not found');
    }
    
    // Only allow viewing of image files
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).send('Not an image file');
    }
    
    res.sendFile(file.path);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Download file
router.get('/download/:id', isAuthenticated, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    // Check if file exists and belongs to the user
    if (!file || file.userId !== req.session.userId) {
      return res.status(404).redirect('/files/dashboard');
    }
    
    // Check if the file exists on disk
    if (!fs.existsSync(file.path)) {
      await File.findByIdAndDelete(req.params.id);
      return res.status(404).redirect('/files/dashboard');
    }
    
    res.download(file.path, file.originalName);
  } catch (err) {
    console.error(err);
    res.status(500).redirect('/files/dashboard');
  }
});

// Delete file
router.post('/delete/:id', isAuthenticated, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    // Check if file exists and belongs to the user
    if (!file || file.userId !== req.session.userId) {
      return res.status(404).redirect('/files/dashboard');
    }
    
    // Delete file from disk if it exists
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    // Remove from database
    await File.findByIdAndDelete(req.params.id);
    
    res.redirect('/files/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).redirect('/files/dashboard');
  }
});

module.exports = router; 