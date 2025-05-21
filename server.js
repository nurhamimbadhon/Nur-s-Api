const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

// Import API routes
const imgbbRouter = require('./api/imgbb');
const honeyRouter = require('./api/honey');
const mediaRouter = require('./api/media');  // New media API
//const removebgRouter = require('./api/removebg');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from web folder
app.use(express.static(path.join(__dirname, 'web')));

// API Routes
app.use('/Nurimg', imgbbRouter);
app.use('/honey', honeyRouter);
app.use('/media', mediaRouter);  // New media API route
//app.use('/Removebg', removebgRouter);

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: 'Connected',
    imgbb: process.env.IMGBB_API_KEY ? 'Configured' : 'Not Configured'
  });
});

// API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    name: "Nur's API Server",
    version: "2.0.0",
    description: "Enhanced API server with MongoDB media management",
    endpoints: {
      "/Nurimg": "Image upload to ImgBB",
      "/honey": "Chatbot API with MongoDB",
      "/api/media": "Media management API with MongoDB storage",
      "/honey/health": "Health check for chatbot API",
      "/honey/stats": "Statistics for chatbot API",
      "/health": "Overall server health check"
    },
    honey_usage: {
      chat: "/honey?text=your_message&senderID=user_id",
      teach: "/honey?teach=message&reply=response1,response2&senderID=user_id",
      teach_reaction: "/honey?teach=message&react=reaction1,reaction2",
      remove: "/honey?remove=message&senderID=user_id",
      remove_specific: "/honey?remove=message&index=1",
      list_all: "/honey?list=all",
      list_message: "/honey?list=specific_message",
      edit: "/honey?edit=message&replace=new_response&senderID=user_id",
      intro: "/honey?text=message&senderID=user_id&key=intro"
    },
    media_usage: {
      get_all: "GET /api/media - Get all media",
      add_media: "POST /api/media - Add new media {url, name, type}",
      remove_media: "DELETE /api/media - Remove media {url}",
      search_media: "GET /api/media/search/{name} - Search media by name",
      random_media: "GET /api/media/random/{userId} - Get random media with usage tracking"
    },
    imgbb_usage: {
      upload: "POST /Nurimg/upload - Upload image to ImgBB {url OR image, name?}",
      upload_multiple: "POST /Nurimg/upload-multiple - Upload multiple images",
      info: "GET /Nurimg/info - Get ImgBB service information"
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message,
    success: false
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    success: false,
    available_routes: [
      '/Nurimg', 
      '/honey', 
      '/api/media', 
      '/api-docs', 
      '/health'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Nur's Enhanced API Server running on port ${PORT}`);
  console.log(`📱 Visit http://localhost:${PORT} to view the web interface`);
  console.log(`📖 Visit http://localhost:${PORT}/api-docs for API usage guide`);
  console.log(`🤖 Honey Chatbot API: http://localhost:${PORT}/honey`);
  console.log(`🖼️  ImgBB Upload API: http://localhost:${PORT}/Nurimg`);
  console.log(`🎬 Media Management API: http://localhost:${PORT}/api/media`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;
