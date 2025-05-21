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
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept any image format
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// MongoDB schema
const MediaSchema = new mongoose.Schema({
  name: String,
  type: String,
  originalFormat: String,
  fileSize: Number,
  dimensions: {
    width: Number,
    height: Number
  },
  url: String,
  createdAt: { type: Date, default: Date.now }
});
const Media = mongoose.model("Media", MediaSchema);

// Helper function to convert image to base64
const processImage = async (imageBuffer, originalFormat) => {
  try {
    // Convert any image format to JPEG for consistent upload
    const processedBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    
    // Convert to base64
    const base64Image = processedBuffer.toString('base64');
    
    return {
      base64: base64Image,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        originalFormat: originalFormat,
        size: processedBuffer.length
      }
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

// Helper function to handle base64 image input
const processBase64Image = async (base64String) => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Get metadata
    const metadata = await sharp(imageBuffer).metadata();
    
    return {
      base64: base64Data,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        originalFormat: metadata.format,
        size: imageBuffer.length
      }
    };
  } catch (error) {
    throw new Error(`Base64 image processing failed: ${error.message}`);
  }
};

// POST /api/media - Handle file upload
router.post("/upload", upload.single('image'), async (req, res) => {
  try {
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: name and type" 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No image file provided" 
      });
    }

    // Process the uploaded image
    const { base64, metadata } = await processImage(req.file.buffer, req.file.mimetype);

    // Upload to Imgur API
    const upload = await axios.post("https://nur-s-api.onrender.com/Nurimg", { 
      image: base64 
    });

    if (!upload.data.success) {
      return res.status(500).json({ 
        success: false, 
        message: "Image upload to external service failed" 
      });
    }

    const imgUrl = upload.data.data.url;

    // Save to MongoDB
    const saved = await Media.create({
      name,
      type,
      originalFormat: metadata.originalFormat,
      fileSize: metadata.size,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      url: imgUrl
    });

    res.json({ 
      success: true, 
      data: saved,
      metadata: metadata
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || "Server error during upload" 
    });
  }
});

// POST /api/media - Handle base64 image input
router.post("/", async (req, res) => {
  try {
    const { name, type, image } = req.body;
    
    if (!name || !type || !image) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: name, type, and image" 
      });
    }

    // Process base64 image
    const { base64, metadata } = await processBase64Image(image);

    // Upload to Imgur API
    const upload = await axios.post("https://nur-s-api.onrender.com/Nurimg", { 
      image: base64 
    });

    if (!upload.data.success) {
      return res.status(500).json({ 
        success: false, 
        message: "Image upload to external service failed" 
      });
    }

    const imgUrl = upload.data.data.url;

    // Save to MongoDB
    const saved = await Media.create({
      name,
      type,
      originalFormat: metadata.originalFormat,
      fileSize: metadata.size,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      url: imgUrl
    });

    res.json({ 
      success: true, 
      data: saved,
      metadata: metadata
    });

  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || "Server error during processing" 
    });
  }
});

// GET /api/media
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, type, format } = req.query;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    if (type) filter.type = new RegExp(type, 'i');
    if (format) filter.originalFormat = new RegExp(format, 'i');
    
    // Get total count for pagination
    const total = await Media.countDocuments(filter);
    
    // Fetch media with pagination
    const media = await Media.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    res.json({ 
      success: true, 
      data: media,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: media.length,
        totalItems: total
      }
    });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch media" 
    });
  }
});

// GET /api/media/:name
router.get("/:name", async (req, res) => {
  try {
    const name = req.params.name.toLowerCase();
    const media = await Media.findOne({ 
      name: new RegExp(`^${name}$`, "i") 
    });
    
    if (!media) {
      return res.status(404).json({ 
        success: false, 
        message: "Media not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: media 
    });
  } catch (err) {
    console.error('Fetch by name error:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch media" 
    });
  }
});

// DELETE /api/media/:id
router.delete("/:id", async (req, res) => {
  try {
    const media = await Media.findByIdAndDelete(req.params.id);
    
    if (!media) {
      return res.status(404).json({ 
        success: false, 
        message: "Media not found" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Media deleted successfully",
      data: media
    });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete media" 
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'An error occurred'
  });
});

module.exports = router;
