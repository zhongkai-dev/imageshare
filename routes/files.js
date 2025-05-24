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
    
    // Use the actual file path from the database
    if (!fs.existsSync(file.path)) {
      console.error(`File not found on disk: ${file.path}`);
      return res.status(404).send('File not found on disk');
    }
    
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    
    // Add cache control headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    fs.createReadStream(file.path).pipe(res);
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

// Extract phone numbers from an existing image file
router.get('/extract-phone/:id', isAuthenticated, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    // Check if file exists and belongs to the user
    if (!file || file.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    // Check if the file exists on disk
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }
    
    try {
      // Extract text using OCR
      const extractedText = await simulateOCR(file.path);
      
      // Extract phone numbers from text
      const phoneNumbers = extractUSPhoneNumbers(extractedText);
      
      if (phoneNumbers.length > 0) {
        // Store in session for popups
        req.session.extractedNumbers = phoneNumbers;
        req.session.extractedFilename = file.originalName;
        
        // Return the numbers 
        return res.json({ 
          success: true, 
          numbers: phoneNumbers,
          filename: file.originalName 
        });
      } else {
        return res.json({ 
          success: false, 
          error: 'No phone numbers found in the image',
          filename: file.originalName
        });
      }
    } catch (ocrError) {
      // Handle OCR-specific errors
      console.error('OCR error:', ocrError);
      return res.json({ 
        success: false, 
        error: ocrError.message || 'Error during text extraction from image',
        filename: file.originalName
      });
    }
  } catch (err) {
    console.error('Error extracting phone numbers:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Extract US phone numbers using regex
function extractUSPhoneNumbers(text) {
  // Multiple patterns to catch different formats
  const patterns = [
    // Format with parentheses: (555) 123-4567
    /(?:\+?1[ -]?)?(?:\(([2-9][0-9]{2})\)[ -]?)([2-9][0-9]{2})[ -]?([0-9]{4})/g,
    
    // Format with dashes/spaces: 555-123-4567
    /(?:\+?1[ -]?)?(?:([2-9][0-9]{2})[ -])([2-9][0-9]{2})[ -]([0-9]{4})/g,
    
    // Format with dots: 555.123.4567
    /(?:\+?1[ \.]?)?(?:([2-9][0-9]{2})[ \.])([2-9][0-9]{2})[ \.]([0-9]{4})/g,
    
    // Straight format with no separators: 5551234567
    /(?:\+?1)?([2-9][0-9]{2})([2-9][0-9]{2})([0-9]{4})/g,
    
    // Format for 11-digit with country code: 15551234567
    /(?:^|\D)(1)([2-9][0-9]{2})([0-9]{3})([0-9]{4})(?:$|\D)/g
  ];
  
  const numbers = [];
  
  // Try each pattern
  patterns.forEach(pattern => {
    let match;
    const textCopy = text.toString();  // Create a copy for each pattern
    while ((match = pattern.exec(textCopy)) !== null) {
      let areaCode, prefix, lineNumber, countryCode;
      
      if (match.length === 5) {
        // Format for 11-digit with country code
        countryCode = match[1];
        areaCode = match[2];
        prefix = match[3];
        lineNumber = match[4];
      } else {
        // Other formats
        areaCode = match[1] || '';
        prefix = match[2] || '';
        lineNumber = match[3] || '';
      }
      
      if (areaCode && prefix && lineNumber) {
        const formattedNumber = `1${areaCode}${prefix}${lineNumber}`;
        if (formattedNumber.length === 11) {
          numbers.push(formattedNumber);
        }
      }
    }
  });
  
  // Special case for raw 10-digit or 11-digit numbers
  const rawNumberPattern = /\b(1)?([2-9][0-9]{2})([0-9]{3})([0-9]{4})\b/g;
  let rawMatch;
  const textCopy = text.toString();
  while ((rawMatch = rawNumberPattern.exec(textCopy)) !== null) {
    const countryCode = rawMatch[1] || '1';
    const areaCode = rawMatch[2];
    const prefix = rawMatch[3];
    const lineNumber = rawMatch[4];
    
    numbers.push(`${countryCode}${areaCode}${prefix}${lineNumber}`);
  }
  
  // Ensure all numbers are in E.164 format (just digits, no spaces or special chars)
  const formattedNumbers = numbers.map(number => {
    // Remove any non-digit characters
    const digitsOnly = number.replace(/\D/g, '');
    
    // Ensure it has country code
    if (digitsOnly.length === 10) {
      return `1${digitsOnly}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return digitsOnly;
    }
    
    return number; // Return original if we can't format it
  });
  
  // Return unique numbers in E.164 format
  return [...new Set(formattedNumbers)];
}

// Helper function to try to extract text from an image
async function simulateOCR(imagePath) {
  try {
    // Unfortunately, without tesseract.js, we cannot perform real OCR
    // Canvas library is for image manipulation but not OCR
    throw new Error("Cannot perform OCR on the server. Please use the client-side extraction.");
  } catch (error) {
    console.error("OCR error:", error);
    throw error; // Propagate the error to show it to the user
  }
}

// Client-side phone extraction endpoint - responds with empty array since extraction happens in browser
router.get('/extract-phones/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const file = await File.findById(fileId);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Return empty array since the actual extraction happens client-side with Tesseract.js
    res.json({ numbers: [] });
  } catch (err) {
    console.error('Error in phone extraction:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save extracted phone numbers for a file
router.post('/save-phone-numbers/:fileId', isAuthenticated, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const { phoneNumbers } = req.body;
    
    if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
      return res.status(400).json({ success: false, error: 'Invalid phone numbers data' });
    }
    
    const file = await File.findById(fileId);
    
    // Check if file exists and belongs to the user
    if (!file || file.userId !== req.session.userId) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    // Update the file with extracted phone numbers
    file.extractedPhoneNumbers = phoneNumbers;
    await file.save();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving phone numbers:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router; 