const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const { v4: uuidv4 } = require('uuid'); // Add UUID for group IDs

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

// File filters
const imageFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const documentFilter = (req, file, cb) => {
  // Accept document files
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only document files are allowed!'), false);
  }
};

// Create different upload handlers for images and documents
const uploadImages = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: imageFilter
}).array('images', 10);

const uploadDocuments = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: documentFilter
}).array('files', 10);

// Dashboard - Show user's files grouped by upload batch
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    // Get all files for this user
    const allFiles = await File.find({ userId: req.session.userId }).sort({ uploadDate: -1 });
    
    // Group files by groupId
    const fileGroups = {};
    allFiles.forEach(file => {
      const groupId = file.groupId || 'single-' + file._id;
      if (!fileGroups[groupId]) {
        fileGroups[groupId] = {
          files: [],
          date: file.uploadDate
        };
      }
      fileGroups[groupId].files.push(file);
    });
    
    // Convert to array and sort by date
    const groupedFiles = Object.keys(fileGroups).map(key => ({
      groupId: key,
      files: fileGroups[key].files,
      date: fileGroups[key].date
    })).sort((a, b) => b.date - a.date);
    
    res.render('dashboard', { 
      userId: req.session.userId,
      groupedFiles
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('dashboard', { 
      userId: req.session.userId,
      groupedFiles: [],
      error: 'Failed to load files'
    });
  }
});

// Upload images
router.post('/upload-images', isAuthenticated, (req, res) => {
  uploadImages(req, res, async (err) => {
    if (err) {
      console.error('Image upload error:', err);
      return res.status(400).redirect('/files/dashboard');
    }
    
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).redirect('/files/dashboard');
      }

      // Generate a group ID for this batch of files
      const groupId = uuidv4();
      
      // Save each file info to database with the same groupId
      const filePromises = req.files.map(file => {
        return File.create({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          userId: req.session.userId,
          groupId: groupId,
          fileType: 'image'
        });
      });

      await Promise.all(filePromises);
      res.redirect('/files/dashboard');
    } catch (err) {
      console.error('File upload error:', err);
      res.status(500).redirect('/files/dashboard');
    }
  });
});

// Upload documents
router.post('/upload-documents', isAuthenticated, (req, res) => {
  uploadDocuments(req, res, async (err) => {
    if (err) {
      console.error('Document upload error:', err);
      return res.status(400).redirect('/files/dashboard');
    }
    
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).redirect('/files/dashboard');
      }

      // Generate a group ID for this batch of files
      const groupId = uuidv4();
      
      // Save each file info to database with the same groupId
      const filePromises = req.files.map(file => {
        return File.create({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          userId: req.session.userId,
          groupId: groupId,
          fileType: 'document'
        });
      });

      await Promise.all(filePromises);
      res.redirect('/files/dashboard');
    } catch (err) {
      console.error('File upload error:', err);
      res.status(500).redirect('/files/dashboard');
    }
  });
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

// Delete entire group of files
router.post('/delete-group/:groupId', isAuthenticated, async (req, res) => {
  try {
    // Find all files in the group that belong to this user
    const groupId = req.params.groupId;
    const files = await File.find({ 
      groupId: groupId,
      userId: req.session.userId
    });
    
    // If groupId starts with 'single-', it's a special case for files without a real groupId
    if (groupId.startsWith('single-')) {
      const fileId = groupId.replace('single-', '');
      const singleFile = await File.findOne({ 
        _id: fileId,
        userId: req.session.userId
      });
      
      if (singleFile) {
        // Delete single file from disk
        if (fs.existsSync(singleFile.path)) {
          fs.unlinkSync(singleFile.path);
        }
        // Delete from database
        await File.findByIdAndDelete(fileId);
      }
    } else {
      // Delete all files in the group
      const deletePromises = files.map(file => {
        // Delete file from disk
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        // Delete from database
        return File.findByIdAndDelete(file._id);
      });
      
      await Promise.all(deletePromises);
    }
    
    res.redirect('/files/dashboard');
  } catch (err) {
    console.error('Error deleting group:', err);
    res.status(500).redirect('/files/dashboard');
  }
});

// Serve app icons for PWA
router.get('/icons/:icon', (req, res) => {
  // Placeholder for now - in a real app, you'd have actual icon files
  const size = req.params.icon.includes('192') ? '192x192' : '512x512';
  
  // Create a simple colored square as placeholder icon
  const canvas = require('canvas');
  const c = canvas.createCanvas(parseInt(size), parseInt(size));
  const ctx = c.getContext('2d');
  
  // Draw a blue square with rounded corners
  ctx.fillStyle = '#4e73df';
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(c.width - 20, 0);
  ctx.quadraticCurveTo(c.width, 0, c.width, 20);
  ctx.lineTo(c.width, c.height - 20);
  ctx.quadraticCurveTo(c.width, c.height, c.width - 20, c.height);
  ctx.lineTo(20, c.height);
  ctx.quadraticCurveTo(0, c.height, 0, c.height - 20);
  ctx.lineTo(0, 20);
  ctx.quadraticCurveTo(0, 0, 20, 0);
  ctx.closePath();
  ctx.fill();
  
  // Draw an image icon
  ctx.fillStyle = '#ffffff';
  const centerX = c.width / 2;
  const centerY = c.height / 2;
  const iconSize = c.width * 0.4;
  
  // Draw a simplified camera/image icon
  ctx.beginPath();
  ctx.moveTo(centerX - iconSize/2, centerY - iconSize/4);
  ctx.lineTo(centerX + iconSize/2, centerY - iconSize/4);
  ctx.lineTo(centerX + iconSize/2, centerY + iconSize/2);
  ctx.lineTo(centerX - iconSize/2, centerY + iconSize/2);
  ctx.closePath();
  ctx.fill();
  
  // Draw a camera lens
  ctx.beginPath();
  ctx.arc(centerX, centerY, iconSize/4, 0, Math.PI * 2);
  ctx.fill();
  
  // Add text if it's the larger icon
  if (size === '512x512') {
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('ImageShare', centerX, centerY + iconSize/2 + 80);
  }
  
  res.set('Content-Type', 'image/png');
  res.send(c.toBuffer('image/png'));
});

module.exports = router; 