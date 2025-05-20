# Image Share - Chat-Style Sharing Platform

A modern web application that allows users to share images and files in a chat-style interface with fullscreen preview capabilities.

## Features

- Chat-style interface for image and file sharing
- Multiple file upload support - upload several files at once
- Fullscreen image preview when clicking on images
- Multi-user support - each user has their own private chat space
- Simple authentication with any 6-digit number
- Instant file sharing and viewing
- Mobile-friendly responsive design

## Setup & Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create an `.env` file with your MongoDB connection string:
   ```
   MONGODB_URI=your_mongodb_connection_string
   PORT=3000
   ```
4. Initialize the database:
   ```
   npm run init-db
   ```
5. Start the application:
   ```
   npm start
   ```

## Quick Start (Windows)

For Windows users, simply double-click the `start.cmd` file which will:
1. Install dependencies
2. Initialize the database
3. Start the application

## Usage

1. Open the application in your browser at http://localhost:3000
2. Enter any 6-digit number (e.g., 123456) to login or register
3. Upload files using the form at the bottom of the chat
4. View your uploaded files in the chat stream
5. Click on images to see them in fullscreen mode
6. Download or delete files as needed

### Multiple Users

- Each user gets their own private chat space
- Different users can use different 6-digit numbers (e.g., one user can use 123456, another can use 654321)
- Files are only visible to the user who uploaded them

## Technical Details

- Built with Node.js and Express
- Uses MongoDB for data storage
- File uploads handled by Multer
- Bootstrap 5 for responsive UI
- Modern chat-style interface
- EJS for templating 