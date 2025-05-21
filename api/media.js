const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const axios = require("axios");
const multer = require("multer");
const sharp = require("sharp");

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1 // Only allow 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// MongoDB schema with indexes for better performance
const MediaSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    maxlength: 255
  },
  type: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  originalFormat: {
    type: String,
    trim: true,
    maxlength: 10
  },
  fileSize: {
    type: Number,
    min: 0
  },
  dimensions: { 
    width: { type: Number, min: 0 }, 
    height: { type: Number, min: 0 }
  },
  url: { 
    type: String, 
    required: true,
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
});

// Add indexes for better query performance
MediaSchema.index({ name: 1 });
MediaSchema.index({ type: 1 });
MediaSchema.index({ createdAt: -1 });

const Media = mongoose.model("Media", MediaSchema);

// Process raw image buffer to JPEG base64 + metadata
async function processBuffer(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    const jpegBuffer = await sharp(buffer)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
      
    return {
      base64: jpegBuffer.toString('base64'),
      metadata: {
        width: metadata.width,
        height: metadata.height,
        originalFormat: metadata.format,
        size: jpegBuffer.length
      }
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

// Upload to ImgBB using internal API
async function uploadToImgBB(base64) {
  try {
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const response = await axios.post(
      `${baseUrl}/Nurimg`,
      { image: base64 },
      {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'ImgBB upload failed');
    }
    
    return response.data.data.url;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to image upload service');
    }
    throw new Error(`Upload failed: ${error.message}`);
  }
}

// Validation middleware
function validateMediaInput(req, res, next) {
  const { name, type } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Name is required and must be a non-empty string'
    });
  }
  
  if (!type || typeof type !== 'string' || type.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Type is required and must be a non-empty string'
    });
  }
  
  // Sanitize inputs
  req.body.name = name.trim();
  req.body.type = type.trim();
  
  next();
}

// POST: Upload via base64
router.post('/', validateMediaInput, async (req, res) => {
  try {
    const { name, type, image } = req.body;
    
    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Image data is required'
      });
    }
    
    // Check if media with same name already exists
    const existingMedia = await Media.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingMedia) {
      return res.status(409).json({
        success: false,
        message: 'Media with this name already exists'
      });
    }
    
    // Clean base64 string
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const { base64, metadata } = await processBuffer(Buffer.from(base64Data, 'base64'));
    const url = await uploadToImgBB(base64);
    
    const mediaData = {
      name,
      type,
      originalFormat: metadata.originalFormat,
      fileSize: metadata.size,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      url
    };
    
    const savedMedia = await Media.create(mediaData);
    
    res.status(201).json({
      success: true,
      data: savedMedia,
      metadata
    });
    
  } catch (error) {
    console.error('Media upload error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Media with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST: Upload via multipart/form-data
router.post('/upload', upload.single('image'), validateMediaInput, async (req, res) => {
  try {
    const { name, type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }
    
    // Check if media with same name already exists
    const existingMedia = await Media.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingMedia) {
      return res.status(409).json({
        success: false,
        message: 'Media with this name already exists'
      });
    }
    
    const { base64, metadata } = await processBuffer(req.file.buffer);
    const url = await uploadToImgBB(base64);
    
    const mediaData = {
      name,
      type,
      originalFormat: metadata.originalFormat,
      fileSize: metadata.size,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      url
    };
    
    const savedMedia = await Media.create(mediaData);
    
    res.status(201).json({
      success: true,
      data: savedMedia,
      metadata
    });
    
  } catch (error) {
    console.error('Media upload error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Media with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET: List with pagination and filtering
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 50, type, format, search } = req.query;
    
    // Validate and sanitize pagination parameters
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit) || 50)); // Cap at 100
    
    // Build filter object
    const filter = {};
    
    if (type && typeof type === 'string') {
      filter.type = new RegExp(type.trim(), 'i');
    }
    
    if (format && typeof format === 'string') {
      filter.originalFormat = new RegExp(format.trim(), 'i');
    }
    
    if (search && typeof search === 'string') {
      filter.name = new RegExp(search.trim(), 'i');
    }
    
    const total = await Media.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    const data = await Media.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(); // Use lean() for better performance
    
    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
    
  } catch (error) {
    console.error('Media list error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET: Media by name
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid name parameter'
      });
    }
    
    const media = await Media.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    }).lean();
    
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }
    
    res.json({
      success: true,
      data: media
    });
    
  } catch (error) {
    console.error('Media get error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE: Media by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID parameter'
      });
    }
    
    const media = await Media.findByIdAndDelete(id);
    
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Media deleted successfully',
      data: media
    });
    
  } catch (error) {
    console.error('Media delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Error handler for multer and other middleware errors
router.use((err, req, res, next) => {
  console.error('Router error:', err);
  
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: `Validation error: ${err.message}`
    });
  }
  
  res.status(500).json({
    success: false,
    message: err.message
  });
});

module.exports = router;
