const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection with improved error handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nur_api';
mongoose.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1); // Exit process on connection error
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// API Routes
app.use('/Nurimg', require('./apis/imgbb'));
app.use('/api/media', require('./apis/media'));

// Static files
app.use(express.static(path.join(__dirname, 'web')));

// Health check endpoint
app.get('/health', (req, res) => {
  const status = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  };
  res.json(status);
});

// API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    name: "Nur API",
    version: "2.1.0",
    endpoints: {
      "/health": "GET - Health check",
      "/Nurimg": "POST - Upload to ImgBB",
      "/api/media": "GET, POST - Media management"
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Error handlers
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
