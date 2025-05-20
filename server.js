const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');

// Initialize app
const app = express();
dotenv.config();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB with improved options
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://messaging:messaging@zkmessenger.jbjckib.mongodb.net/?retryWrites=true&w=majority&appName=ZKMessenger', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('MongoDB Connected');
    startServer();
  })
  .catch(err => {
    console.log('MongoDB Connection Error:', err);
    process.exit(1); // Exit if cannot connect to MongoDB
  });

// Session configuration using connect-mongo
function startServer() {
  app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
      mongoUrl: process.env.MONGODB_URI || 'mongodb+srv://messaging:messaging@zkmessenger.jbjckib.mongodb.net/?retryWrites=true&w=majority&appName=ZKMessenger',
      ttl: 14 * 24 * 60 * 60, // 14 days
      autoRemove: 'native'
    }),
    cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 } // 14 days
  }));

  // Models
  const User = require('./models/User');
  const File = require('./models/File');

  // Routes
  app.use('/', require('./routes/index'));
  app.use('/auth', require('./routes/auth'));
  app.use('/files', require('./routes/files'));
  
  // PWA Service Worker route
  app.get('/service-worker.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
  });
  
  // PWA Manifest route
  app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
  });

  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}