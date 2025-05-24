const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  groupId: {
    type: String,
    default: null
  },
  fileType: {
    type: String,
    enum: ['image', 'document', 'video', 'audio', 'other'],
    default: 'other'
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  extractedPhoneNumbers: {
    type: [String],
    default: []
  }
});

// Create a schema for messages
const MessageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  groupId: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

const File = mongoose.model('File', FileSchema, 'userfiles');
const Message = mongoose.model('Message', MessageSchema, 'messages');

module.exports = {
  File,
  Message
};