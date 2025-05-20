# Image Share - Chat-Style Sharing Platform

A modern Progressive Web App (PWA) that allows users to share images and text messages in a chat-style interface with fullscreen preview capabilities.

## Features

- Chat-style interface for image and text sharing
- Multiple image upload support - upload several images at once
- Text messages with copy functionality
- Fullscreen image preview when clicking on images
- Multi-user support - each user has their own private chat space
- Simple authentication with any 6-digit number
- Instant image sharing and viewing
- Mobile-friendly responsive design
- Progressive Web App (PWA) support:
  - Works offline
  - Can be installed on mobile and desktop devices
  - Responsive design for all screen sizes
  - Push notifications support

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
3. Send messages or upload images using the form at the bottom of the chat
4. View your messages and uploaded images in the chat stream
5. Click on images to see them in fullscreen mode
6. Copy text messages using the copy button
7. Delete entire message bubbles with the delete button

### Multiple Users

- Each user gets their own private chat space
- Different users can use different 6-digit numbers (e.g., one user can use 123456, another can use 654321)
- Messages and images are only visible to the user who created them

### PWA Features

- **Install on Device**: Click the "Install App" button in the navbar to install the app on your device
- **Offline Support**: The app works offline, showing previously loaded messages and images
- **Add to Home Screen**: On iOS devices, use the "Add to Home Screen" option in the share menu

## Technical Details

- Built with Node.js and Express
- Uses MongoDB for data storage
- File uploads handled by Multer
- Bootstrap 5 for responsive UI
- Modern chat-style interface
- EJS for templating
- Service Worker for offline capabilities
- Progressive Web App (PWA) features 