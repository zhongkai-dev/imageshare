# File Notes - Multi-User File Storage System

A simple web application that allows multiple users to upload, download, and manage their files using a 6-digit number for authentication.

## Features

- Multi-user support - each user has a private file storage
- User authentication with any 6-digit number (login/registration)
- Upload images and files (up to 10MB)
- View all your uploaded files
- Download files
- Delete files
- User-specific files (each user can only see their own files)

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
3. Upload files using the upload form
4. View, download, or delete your files
5. Logout when finished

### Multiple Users

- Each user gets their own private file storage
- Different users can use different 6-digit numbers (e.g., one user can use 123456, another can use 654321)
- Files are only visible to the user who uploaded them

## Technical Details

- Built with Node.js and Express
- Uses MongoDB for data storage
- File uploads handled by Multer
- Bootstrap 5 for UI
- EJS for templating 