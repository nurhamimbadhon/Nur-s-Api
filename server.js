const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nur_api', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://your-domain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from web folder
app.use(express.static(path.join(__dirname, 'web')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Import API routes
const imgbbRouter = require('./api/imgbb');
const honeyRouter = require('./api/honey');
const mediaRouter = require('./api/media');

// Route mounting
app.use('/Nurimg', imgbbRouter);
app.use('/honey', honeyRouter);
app.use('/api/media', mediaRouter);

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodejs: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    mongodb: 'Disconnected',
    imgbb: process.env.IMGBB_API_KEY ? 'Configured' : 'Not Configured',
    apis: {
      media: 'Active',
      honey: 'Active',
      imgbb: 'Active'
    }
  };

  // Check MongoDB connection
  try {
    if (mongoose.connection.readyState === 1) {
      healthStatus.mongodb = 'Connected';
      // Get database stats
      const admin = mongoose.connection.db.admin();
      const dbStats = await admin.serverStatus();
      healthStatus.mongodb_info = {
        version: dbStats.version,
        uptime: dbStats.uptime,
        connections: dbStats.connections
      };
    } else {
      healthStatus.mongodb = 'Disconnected';
      healthStatus.status = 'WARNING';
    }
  } catch (error) {
    healthStatus.mongodb = 'Error';
    healthStatus.mongodb_error = error.message;
    healthStatus.status = 'ERROR';
  }

  res.json(healthStatus);
});

// Enhanced API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    name: "Nur's Enhanced API Server",
    version: "2.1.0",
    description: "Enhanced API server with MongoDB media management, image processing, and chatbot",
    author: "Nur",
    last_updated: new Date().toISOString(),
    
    endpoints: {
      "/Nurimg": "Image upload to ImgBB service",
      "/honey": "AI Chatbot API with MongoDB storage",
      "/api/media": "Media management API with MongoDB storage and image processing",
      "/health": "Comprehensive server health check",
      "/api-docs": "Complete API documentation",
      "/": "Web interface homepage"
    },
    
    honey_usage: {
      description: "AI Chatbot with learning capabilities",
      endpoints: {
        chat: "GET /honey?text=your_message&senderID=user_id",
        teach: "GET /honey?teach=message&reply=response1,response2&senderID=user_id",
        teach_reaction: "GET /honey?teach=message&react=reaction1,reaction2",
        remove: "GET /honey?remove=message&senderID=user_id",
        remove_specific: "GET /honey?remove=message&index=1",
        list_all: "GET /honey?list=all",
        list_message: "GET /honey?list=specific_message",
        edit: "GET /honey?edit=message&replace=new_response&senderID=user_id",
        intro: "GET /honey?text=message&senderID=user_id&key=intro"
      }
    },
    
    media_usage: {
      description: "Media management with image processing and MongoDB storage",
      endpoints: {
        get_all: "GET /api/media - Get all media with pagination",
        get_by_name: "GET /api/media/:name - Get media by name",
        add_base64: "POST /api/media - Add media from base64 {name, type, image}",
        upload_file: "POST /api/media/upload - Upload image file (multipart/form-data)",
        delete_media: "DELETE /api/media/:id - Delete media by ID"
      },
      supported_formats: [
        "JPEG", "PNG", "WebP", "GIF", "TIFF", "SVG", "BMP", "AVIF"
      ],
      features: [
        "Automatic format conversion",
        "Image compression and optimization",
        "Metadata extraction (dimensions, file size)",
        "Base64 and file upload support",
        "Pagination and filtering",
        "MongoDB storage with indexing"
      ]
    },
    
    imgbb_usage: {
      description: "Image upload service using ImgBB",
      endpoints: {
        upload: "POST /Nurimg - Upload single image {image}",
        upload_url: "POST /Nurimg - Upload from URL {url}",
        info: "GET /Nurimg/info - Get service information"
      }
    },
    
    examples: {
      media_upload_file: {
        method: "POST",
        url: "/api/media/upload",
        content_type: "multipart/form-data",
        body: "FormData with 'image', 'name', 'type' fields"
      },
      media_upload_base64: {
        method: "POST",
        url: "/api/media",
        content_type: "application/json",
        body: {
          name: "my-image",
          type: "photo",
          image: "data:image/png;base64,iVBORw0KGgo..."
        }
      },
      media_get_paginated: {
        method: "GET",
        url: "/api/media?page=1&limit=10&type=photo&format=jpeg"
      }
    }
  });
});

// API status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const Media = mongoose.model('Media');
    const mediaCount = await Media.countDocuments();
    
    res.json({
      success: true,
      server: {
        status: 'running',
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        node_version: process.version
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        media_count: mediaCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Status check failed',
      error: error.message
    });
  }
});

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🍃 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🍃 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('🍃 MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.stack);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      success: false
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID Format',
      message: 'The provided ID is not valid',
      success: false
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
    success: false
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
    success: false,
    available_routes: {
      apis: [
        '/Nurimg - Image upload service',
        '/honey - AI chatbot API',
        '/api/media - Media management API'
      ],
      docs: [
        '/api-docs - Complete API documentation',
        '/health - Server health check',
        '/api/status - API status information'
      ],
      web: [
        '/ - Homepage'
      ]
    },
    suggestion: 'Visit /api-docs for complete API documentation'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('\n🚀 ================================');
  console.log(`🚀 Nur's Enhanced API Server v2.1.0`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('🚀 ================================\n');
  
  console.log('📱 Web Interface:');
  console.log(`   Homepage: http://localhost:${PORT}`);
  console.log(`   Docs: http://localhost:${PORT}/api-docs\n`);
  
  console.log('🔗 API Endpoints:');
  console.log(`   Media API: http://localhost:${PORT}/api/media`);
  console.log(`   Honey Chatbot: http://localhost:${PORT}/honey`);
  console.log(`   ImgBB Upload: http://localhost:${PORT}/Nurimg\n`);
  
  console.log('🔧 Monitoring:');
  console.log(`   Health Check: http://localhost:${PORT}/health`);
  console.log(`   API Status: http://localhost:${PORT}/api/status\n`);
  
  if (!process.env.MONGODB_URI) {
    console.log('⚠️  Warning: MONGODB_URI not set in .env file');
    console.log('   Using default: mongodb://localhost:27017/nur_api\n');
  }
  
  if (!process.env.IMGBB_API_KEY) {
    console.log('⚠️  Warning: IMGBB_API_KEY not set in .env file');
    console.log('   ImgBB service may not work properly\n');
  }
});

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  switch (error.code) {
    case 'EACCES':
      console.error(`❌ Port ${PORT} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`❌ Port ${PORT} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

module.exports = app;
