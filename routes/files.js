const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { File, Message } = require('../models/File');
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

// File filter for images only
const imageFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Create upload handler for images
const uploadImages = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: imageFilter
}).array('images', 10);

// Dashboard - Show user's files grouped by upload batch
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    // Get all files for this user
    const allFiles = await File.find({ userId: req.session.userId }).sort({ uploadDate: -1 });
    
    // Get all messages for this user
    const allMessages = await Message.find({ userId: req.session.userId }).sort({ uploadDate: -1 });
    
    // Group files and messages by groupId
    const fileGroups = {};
    
    // Process files
    allFiles.forEach(file => {
      const groupId = file.groupId || 'single-' + file._id;
      if (!fileGroups[groupId]) {
        fileGroups[groupId] = {
          files: [],
          messages: [],
          date: file.uploadDate
        };
      }
      fileGroups[groupId].files.push(file);
    });
    
    // Process messages
    allMessages.forEach(message => {
      const groupId = message.groupId;
      if (!fileGroups[groupId]) {
        fileGroups[groupId] = {
          files: [],
          messages: [],
          date: message.uploadDate
        };
      }
      fileGroups[groupId].messages.push(message);
    });
    
    // Convert to array and sort by date
    const groupedFiles = Object.keys(fileGroups).map(key => ({
      groupId: key,
      files: fileGroups[key].files,
      messages: fileGroups[key].messages,
      date: fileGroups[key].date
    })).sort((a, b) => a.date - b.date);
    
    // Helper function for file icons
    const getFileIcon = (mimetype) => {
      if (mimetype.startsWith('image/')) return 'fa-file-image text-primary';
      if (mimetype === 'application/pdf') return 'fa-file-pdf text-danger';
      if (mimetype.includes('document') || mimetype.includes('word')) return 'fa-file-word text-primary';
      if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return 'fa-file-excel text-success';
      if (mimetype.includes('audio')) return 'fa-file-audio text-warning';
      if (mimetype.includes('video')) return 'fa-file-video text-danger';
      if (mimetype.includes('zip') || mimetype.includes('compressed')) return 'fa-file-archive text-warning';
      if (mimetype.includes('text/')) return 'fa-file-alt text-info';
      return 'fa-file text-secondary';
    };
    
    res.render('dashboard', { 
      userId: req.session.userId,
      groupedFiles,
      getFileIcon
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('dashboard', { 
      userId: req.session.userId,
      groupedFiles: [],
      error: 'Failed to load files',
      getFileIcon: (mimetype) => 'fa-file text-secondary'
    });
  }
});

// Upload images and/or text message
router.post('/upload-images', isAuthenticated, (req, res) => {
  uploadImages(req, res, async (err) => {
    if (err) {
      console.error('Image upload error:', err);
      return res.status(400).redirect('/files/dashboard');
    }
    
    try {
      // Generate a group ID for this batch of files/messages
      const groupId = uuidv4();
      
      // Check if there's a text message
      const message = req.body.message ? req.body.message.trim() : '';
      
      // Check if there are files or a message
      if ((!req.files || req.files.length === 0) && !message) {
        return res.status(400).redirect('/files/dashboard');
      }
      
      // Save message if provided
      if (message) {
        await Message.create({
          text: message,
          userId: req.session.userId,
          groupId: groupId
        });
      }
      
      // Save files if provided
      if (req.files && req.files.length > 0) {
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
      }
      
      res.redirect('/files/dashboard');
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).redirect('/files/dashboard');
    }
  });
});

// View a file
router.get('/view/:id', isAuthenticated, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).send('File not found');
    }
    
    // Check if user has access to this file
    if (file.userId !== req.session.userId) {
      return res.status(403).send('Unauthorized');
    }
    
    const filePath = path.join(process.cwd(), 'uploads', file._id.toString());
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    
    // Add cache control headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Error viewing file:', err);
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
    const groupId = req.params.groupId;
    
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
      // Find all files in the group that belong to this user
      const files = await File.find({ 
        groupId: groupId,
        userId: req.session.userId
      });
      
      // Delete all files in the group
      const deleteFilePromises = files.map(file => {
        // Delete file from disk
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        // Delete from database
        return File.findByIdAndDelete(file._id);
      });
      
      // Delete all messages in the group
      const deleteMessagePromises = Message.deleteMany({
        groupId: groupId,
        userId: req.session.userId
      });
      
      // Wait for all deletions to complete
      await Promise.all([...deleteFilePromises, deleteMessagePromises]);
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