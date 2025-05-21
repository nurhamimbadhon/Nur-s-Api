// api/media.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const axios = require("axios");
const multer = require("multer");
const sharp = require("sharp");

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  }
});

// MongoDB schema
const MediaSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  originalFormat: String,
  fileSize: Number,
  dimensions: { width: Number, height: Number },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Media = mongoose.model("Media", MediaSchema);

// Process raw image buffer to JPEG base64 + metadata
async function processBuffer(buffer) {
  const metadata = await sharp(buffer).metadata();
  const jpegBuffer = await sharp(buffer)
    .jpeg({ quality: 85 })
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
}

// Upload via ImgBB router
async function uploadToImgBB(base64) {
  const res = await axios.post(
    `${process.env.API_BASE_URL || 'http://localhost:' + (process.env.PORT||3000)}/Nurimg`,
    { image: base64 }
  );
  if (!res.data.success) throw new Error(res.data.message || 'ImgBB upload failed');
  return res.data.data.url;
}

// POST: base64
router.post('/', async (req, res) => {
  try {
    const { name, type, image } = req.body;
    if (!name || !type || !image) return res.status(400).json({ success: false, message: 'Missing name/type/image' });
    const { base64, metadata } = await processBuffer(Buffer.from(image.replace(/data:image\/[a-z]+;base64,/, ''), 'base64'));
    const url = await uploadToImgBB(base64);
    const saved = await Media.create({ name, type, originalFormat: metadata.originalFormat, fileSize: metadata.size, dimensions: metadata, url });
    res.json({ success: true, data: saved, metadata });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST: multipart/form-data
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: 'Missing name/type' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { base64, metadata } = await processBuffer(req.file.buffer);
    const url = await uploadToImgBB(base64);
    const saved = await Media.create({ name, type, originalFormat: metadata.originalFormat, fileSize: metadata.size, dimensions: metadata, url });
    res.json({ success: true, data: saved, metadata });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET: list with pagination/filter
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 50, type, format } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const filter = {};
    if (type) filter.type = new RegExp(type, 'i');
    if (format) filter.originalFormat = new RegExp(format, 'i');
    const total = await Media.countDocuments(filter);
    const data = await Media.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit);
    res.json({ success: true, data, pagination: { page, limit, total } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET by name
router.get('/:name', async (req, res) => {
  try {
    const media = await Media.findOne({ name: new RegExp(`^${req.params.name}$`, 'i') });
    if (!media) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: media });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE by ID
router.delete('/:id', async (req, res) => {
  try {
    const media = await Media.findByIdAndDelete(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: media });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Multer & general error handler
router.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message });
  }
  res.status(500).json({ success: false, message: err.message });
});

module.exports = router;
