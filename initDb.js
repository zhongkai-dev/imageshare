const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://messaging:messaging@zkmessenger.jbjckib.mongodb.net/?retryWrites=true&w=majority&appName=ZKMessenger';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('MongoDB connected for initialization');
  
  try {
    // Drop collections if they exist to start fresh
    try {
      await mongoose.connection.db.dropCollection('users');
      console.log('Dropped users collection');
    } catch (err) {
      console.log('No users collection to drop');
    }
    
    try {
      await mongoose.connection.db.dropCollection('fileusers');
      console.log('Dropped fileusers collection');
    } catch (err) {
      console.log('No fileusers collection to drop');
    }
    
    try {
      await mongoose.connection.db.dropCollection('userfiles');
      console.log('Dropped userfiles collection');
    } catch (err) {
      console.log('No userfiles collection to drop');
    }
    
    // Create new collections with proper indexes
    const db = mongoose.connection.db;
    await db.createCollection('fileusers');
    await db.collection('fileusers').createIndex({ userId: 1 }, { unique: true });
    console.log('Created fileusers collection with proper index');
    
    await db.createCollection('userfiles');
    console.log('Created userfiles collection');
    
    console.log('Database initialized successfully!');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    // Close connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
}); 