const mongoose = require('mongoose');

// Delete any existing collection to avoid index errors
try {
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.dropCollection('users').catch(() => {
      // Ignore if collection doesn't exist
    });
  }
} catch (err) {
  console.log('Error dropping collection:', err);
}

const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    minlength: 6,
    maxlength: 6,
    match: /^\d{6}$/  // Ensures 6 digits only
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Clear any existing indexes and create a new one for userId
UserSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema, 'fileusers'); // Use 'fileusers' collection instead of 'users' 